import { createSupabaseAdmin } from "../supabase";
import type { WorkerEnv } from "../env";

export function optionalDateParam(query: Record<string, string | undefined>, key: string) {
  const v = query[key];
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  return v;
}

function sanitizeTabDomainSub(query: Record<string, string | undefined>) {
  const raw = typeof query.domain === "string" ? query.domain.trim().slice(0, 120) : "";
  const s = raw.replace(/[%_\\]/g, "");
  return s || undefined;
}

function parseOptionalMinDurationSec(value: string | undefined) {
  if (value == null || value === "") return undefined;
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 0 || n > 86400) return undefined;
  return n;
}

export function parseTabEventFilters(query: Record<string, string | undefined>) {
  return {
    from: optionalDateParam(query, "from"),
    to: optionalDateParam(query, "to"),
    domainSub: sanitizeTabDomainSub(query),
    category: typeof query.category === "string" && query.category.trim() ? query.category.trim().slice(0, 200) : undefined,
    minDurationSec: parseOptionalMinDurationSec(query.min_duration_sec),
  };
}

const TAB_EVENT_SORT: Record<string, { column: string; ascending: boolean }> = {
  start_time_desc: { column: "start_time", ascending: false },
  start_time_asc: { column: "start_time", ascending: true },
  duration_desc: { column: "duration_sec", ascending: false },
  duration_asc: { column: "duration_sec", ascending: true },
  domain_asc: { column: "domain", ascending: true },
  domain_desc: { column: "domain", ascending: false },
  date_desc: { column: "date", ascending: false },
  date_asc: { column: "date", ascending: true },
};

export function parseTabEventSort(query: Record<string, string | undefined>) {
  const key = typeof query.sort === "string" ? query.sort : "start_time_desc";
  return TAB_EVENT_SORT[key] ?? TAB_EVENT_SORT.start_time_desc;
}

export function buildFilteredTabEventsSelect(
  env: WorkerEnv,
  userId: string,
  filters: ReturnType<typeof parseTabEventFilters>,
  selectSpec: string,
  countOptions?: { count?: "exact"; head?: boolean }
) {
  const supabaseAdmin = createSupabaseAdmin(env);
  let qb = supabaseAdmin.from("tab_events").select(selectSpec, countOptions).eq("user_id", userId);
  if (filters.from) qb = qb.gte("date", filters.from);
  if (filters.to) qb = qb.lte("date", filters.to);
  if (filters.domainSub) qb = qb.ilike("domain", `%${filters.domainSub}%`);
  if (filters.category) qb = qb.eq("category", filters.category);
  if (filters.minDurationSec != null) qb = qb.gte("duration_sec", filters.minDurationSec);
  return qb;
}

export function parseTabEventPagination(query: Record<string, string | undefined>, defaultLimit = 50, maxLimit = 150) {
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

export function applyFreeTierActivityWindow(filters: ReturnType<typeof parseTabEventFilters>, licensed: boolean) {
  if (licensed) return { ...filters };
  const cutoff = utcCutoff7DaysStr();
  const today = utcTodayStr();
  const out = { ...filters };
  if (out.from && out.from < cutoff) {
    const err = new Error("Free plan limited to the last 7 days of activity") as Error & { status?: number };
    err.status = 403;
    throw err;
  }
  if (!out.from) out.from = cutoff;
  if (!out.to) out.to = today;
  else if (out.to > today) out.to = today;
  if (out.from > out.to) out.from = cutoff;
  return out;
}

export async function tabEventSummaryFallback(
  env: WorkerEnv,
  userId: string,
  filters: ReturnType<typeof parseTabEventFilters>
) {
  const MAX_SAMPLE = 12000;
  const PAGE = 800;

  const { count, error: cErr } = await buildFilteredTabEventsSelect(env, userId, filters, "*", { count: "exact", head: true });
  if (cErr) throw Object.assign(new Error(cErr.message), { status: 400 });

  const total = count ?? 0;
  const toRead = Math.min(total, MAX_SAMPLE);
  type ActivityRow = { date: string | null; category: string | null; duration_sec: number | null; domain: string };
  const rows: ActivityRow[] = [];
  for (let off = 0; off < toRead; off += PAGE) {
    const { data, error } = await buildFilteredTabEventsSelect(env, userId, filters, "domain,duration_sec,date,category")
      .order("start_time", { ascending: false })
      .range(off, Math.min(off + PAGE - 1, toRead - 1));
    if (error) throw Object.assign(new Error(error.message), { status: 400 });
    if (data?.length) {
      for (const row of data as unknown[]) {
        const r = row as Partial<ActivityRow>;
        rows.push({
          date: typeof r.date === "string" ? r.date : null,
          category: typeof r.category === "string" ? r.category : null,
          duration_sec: typeof r.duration_sec === "number" ? r.duration_sec : null,
          domain: typeof r.domain === "string" ? r.domain : "",
        });
      }
    }
    if (!data?.length || data.length < PAGE) break;
  }

  const domainMap = new Map<string, number>();
  let totalDurationSec = 0;
  let completedDurationRows = 0;
  const daySet = new Set<string>();
  const catSet = new Set<string>();
  for (const r of rows) {
    if (r.date) daySet.add(r.date);
    if (r.category && String(r.category).trim()) catSet.add(String(r.category).trim());
    if (r.duration_sec != null && Number.isFinite(r.duration_sec)) {
      totalDurationSec += r.duration_sec;
      completedDurationRows += 1;
      const d = r.domain ?? "";
      domainMap.set(d, (domainMap.get(d) ?? 0) + r.duration_sec);
    }
  }

  const top_domains = [...domainMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, duration_sec]) => ({ domain, duration_sec }));

  const categories = [...catSet].sort().slice(0, 80);
  const avg_duration_sec = completedDurationRows > 0 ? Math.round(totalDurationSec / completedDurationRows) : null;
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

export async function fetchTabEventSummary(
  env: WorkerEnv,
  userId: string,
  filters: ReturnType<typeof parseTabEventFilters>
) {
  const supabaseAdmin = createSupabaseAdmin(env);
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

  return tabEventSummaryFallback(env, userId, filters);
}
