import { supabaseAdmin } from "../db/client.js";

export function optionalDateParam(query, key) {
  const v = query[key];
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  return v;
}

function sanitizeTabDomainSub(query) {
  const raw = typeof query.domain === "string" ? query.domain.trim().slice(0, 120) : "";
  const s = raw.replace(/[%_\\]/g, "");
  return s || undefined;
}

function parseOptionalMinDurationSec(value) {
  if (value == null || value === "") return undefined;
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 0 || n > 86400) return undefined;
  return n;
}

export function parseTabEventFilters(query) {
  return {
    from: optionalDateParam(query, "from"),
    to: optionalDateParam(query, "to"),
    domainSub: sanitizeTabDomainSub(query),
    category:
      typeof query.category === "string" && query.category.trim()
        ? query.category.trim().slice(0, 200)
        : undefined,
    minDurationSec: parseOptionalMinDurationSec(query.min_duration_sec),
  };
}

const TAB_EVENT_SORT = {
  start_time_desc: { column: "start_time", ascending: false },
  start_time_asc: { column: "start_time", ascending: true },
  duration_desc: { column: "duration_sec", ascending: false },
  duration_asc: { column: "duration_sec", ascending: true },
  domain_asc: { column: "domain", ascending: true },
  domain_desc: { column: "domain", ascending: false },
  date_desc: { column: "date", ascending: false },
  date_asc: { column: "date", ascending: true },
};

export function parseTabEventSort(query) {
  const key = typeof query.sort === "string" ? query.sort : "start_time_desc";
  return TAB_EVENT_SORT[key] ?? TAB_EVENT_SORT.start_time_desc;
}

export function buildFilteredTabEventsSelect(userId, filters, selectSpec, countOptions) {
  let qb = supabaseAdmin.from("tab_events").select(selectSpec, countOptions).eq("user_id", userId);
  if (filters.from) qb = qb.gte("date", filters.from);
  if (filters.to) qb = qb.lte("date", filters.to);
  if (filters.domainSub) qb = qb.ilike("domain", `%${filters.domainSub}%`);
  if (filters.category) qb = qb.eq("category", filters.category);
  if (filters.minDurationSec != null) qb = qb.gte("duration_sec", filters.minDurationSec);
  return qb;
}

export function parseTabEventPagination(query, defaultLimit = 50, maxLimit = 150) {
  const limitRaw = Number.parseInt(String(query.limit ?? String(defaultLimit)), 10);
  const offsetRaw = Number.parseInt(String(query.offset ?? "0"), 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(maxLimit, Math.max(1, limitRaw)) : defaultLimit;
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;
  return { limit, offset };
}

function utcTodayStr() {
  const t = new Date();
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())).toISOString().slice(0, 10);
}

function utcCutoff7DaysStr() {
  const t = new Date();
  const d = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

/**
 * Free users: cannot query before UTC today−7; default empty range to [cutoff, today].
 * @param {ReturnType<typeof parseTabEventFilters>} filters
 */
export function applyFreeTierActivityWindow(filters, licensed) {
  if (licensed) return { ...filters };
  const cutoff = utcCutoff7DaysStr();
  const today = utcTodayStr();
  const out = { ...filters };
  if (out.from && out.from < cutoff) {
    const err = new Error("Free plan limited to the last 7 days of activity");
    err.status = 403;
    throw err;
  }
  if (!out.from) out.from = cutoff;
  if (!out.to) out.to = today;
  else if (out.to > today) out.to = today;
  if (out.from > out.to) out.from = cutoff;
  return out;
}

/** When RPC `admin_tab_event_summary` is missing, aggregate up to MAX sampled rows. */
export async function tabEventSummaryFallback(userId, filters) {
  const MAX_SAMPLE = 12000;
  const PAGE = 800;

  const { count, error: cErr } = await buildFilteredTabEventsSelect(
    userId,
    filters,
    "*",
    { count: "exact", head: true }
  );
  if (cErr) throw Object.assign(new Error(cErr.message), { status: 400 });

  const total = count ?? 0;
  const toRead = Math.min(total, MAX_SAMPLE);
  const rows = [];
  for (let off = 0; off < toRead; off += PAGE) {
    const { data, error } = await buildFilteredTabEventsSelect(userId, filters, "domain,duration_sec,date,category")
      .order("start_time", { ascending: false })
      .range(off, Math.min(off + PAGE - 1, toRead - 1));
    if (error) throw Object.assign(new Error(error.message), { status: 400 });
    if (data?.length) rows.push(...data);
    if (!data?.length || data.length < PAGE) break;
  }

  const domainMap = new Map();
  let totalDurationSec = 0;
  let completedDurationRows = 0;
  const daySet = new Set();
  const catSet = new Set();

  for (const r of rows) {
    if (r.date) daySet.add(r.date);
    if (r.category && String(r.category).trim()) catSet.add(String(r.category).trim());
    if (r.duration_sec != null && Number.isFinite(r.duration_sec)) {
      totalDurationSec += r.duration_sec;
      completedDurationRows += 1;
      const d = r.domain ?? "";
      domainMap.set(d, (domainMap.get(d) || 0) + r.duration_sec);
    }
  }

  const top_domains = [...domainMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, duration_sec]) => ({ domain, duration_sec }));

  const categories = [...catSet].sort().slice(0, 80);

  const avg_duration_sec =
    completedDurationRows > 0 ? Math.round(totalDurationSec / completedDurationRows) : null;

  return {
    event_count: total,
    total_duration_sec: totalDurationSec,
    completed_duration_rows: completedDurationRows,
    distinct_days: daySet.size,
    avg_duration_sec,
    top_domains,
    categories,
    stats_incomplete: total > rows.length,
  };
}

export async function fetchTabEventSummary(userId, filters) {
  const { data, error } = await supabaseAdmin.rpc("admin_tab_event_summary", {
    p_user_id: userId,
    p_from: filters.from ?? null,
    p_to: filters.to ?? null,
    p_domain_sub: filters.domainSub ?? null,
    p_category: filters.category ?? null,
    p_min_duration_sec: filters.minDurationSec ?? null,
  });

  if (!error && data != null) {
    const row = typeof data === "object" && !Array.isArray(data) ? data : JSON.parse(String(data));
    return { ...row, stats_incomplete: false };
  }

  return tabEventSummaryFallback(userId, filters);
}
