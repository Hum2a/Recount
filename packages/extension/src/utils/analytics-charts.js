/**
 * Small bar charts for the popup Analytics tab (no external chart lib).
 * All dates are UTC YYYY-MM-DD strings from the API.
 */

/** @param {number} n Days including today */
export function utcDateStringsEndingToday(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * @param {string} iso YYYY-MM-DD
 * @returns {string} Short label for narrow popup
 */
export function shortUtcDayLabel(iso) {
  try {
    const d = new Date(`${iso}T12:00:00.000Z`);
    return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
  } catch {
    return iso.slice(5);
  }
}

/**
 * @param {HTMLElement} el
 * @param {{ date: string, seconds: number }[]} days Oldest → newest
 */
export function renderDailyMinutesChart(el, days) {
  el.replaceChildren();
  if (!days.length) {
    const p = document.createElement("p");
    p.className = "muted analytics-empty";
    p.textContent = "No data in this range.";
    el.appendChild(p);
    return;
  }
  const maxSec = Math.max(1, ...days.map((d) => d.seconds));
  const wrap = document.createElement("div");
  wrap.className = "vbar-wrap";
  wrap.setAttribute("role", "img");
  wrap.setAttribute("aria-label", "Tracked time per UTC day");

  for (const row of days) {
    const col = document.createElement("div");
    col.className = "vbar-col";
    const pct = row.seconds <= 0 ? 0 : Math.max(4, (row.seconds / maxSec) * 100);
    const bar = document.createElement("div");
    bar.className = "vbar-bar";
    bar.style.height = `${pct}%`;
    bar.title = `${row.date} · ${formatMin(row.seconds)}`;
    const lab = document.createElement("span");
    lab.className = "vbar-label";
    lab.textContent = shortUtcDayLabel(row.date);
    col.appendChild(bar);
    col.appendChild(lab);
    wrap.appendChild(col);
  }
  el.appendChild(wrap);
}

/**
 * @param {HTMLElement} el
 * @param {{ domain: string, seconds: number }[]} domains Sorted desc
 * @param {number} [maxBars]
 */
export function renderDomainBarsChart(el, domains, maxBars = 6) {
  el.replaceChildren();
  const slice = domains.slice(0, maxBars);
  if (slice.length === 0) {
    const p = document.createElement("p");
    p.className = "muted analytics-empty";
    p.textContent = "No sites for today (UTC) yet.";
    el.appendChild(p);
    return;
  }
  const maxSec = Math.max(1, ...slice.map((d) => d.seconds));
  const chart = document.createElement("div");
  chart.className = "hbar-chart";
  chart.setAttribute("role", "img");
  chart.setAttribute("aria-label", "Top sites by time today");

  for (const row of slice) {
    const r = document.createElement("div");
    r.className = "hbar-row";
    const label = document.createElement("span");
    label.className = "hbar-label";
    const dom = row.domain || "—";
    label.textContent = dom.length > 14 ? `${dom.slice(0, 13)}…` : dom;
    label.title = dom;
    const track = document.createElement("div");
    track.className = "hbar-track";
    const fill = document.createElement("div");
    fill.className = "hbar-fill";
    fill.style.width = `${(row.seconds / maxSec) * 100}%`;
    fill.title = `${dom} · ${formatMin(row.seconds)}`;
    track.appendChild(fill);
    r.appendChild(label);
    r.appendChild(track);
    chart.appendChild(r);
  }
  el.appendChild(chart);
}

function formatMin(sec) {
  const m = Math.round(sec / 60);
  if (m < 1) return "<1 min";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}
