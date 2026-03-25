"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useReducedMotion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { adminApi } from "./admin-fetch";
import { CHART } from "./analytics-chart-theme";

type DomainRow = { domain: string; total_duration_sec: number; distinct_users: number };

type AudiencePayload = {
  generated_at?: string;
  profiles?: { total?: number; licensed?: number; with_any_demographic?: number };
  countries?: { code: string; count: number }[];
  birth_years?: { year: number; count: number }[];
  company_size?: { size: string; count: number }[];
  industries_top?: { label: string; count: number }[];
  occupations_top?: { label: string; count: number }[];
  referral_sources_top?: { label: string; count: number }[];
  primary_use_cases_top?: { label: string; count: number }[];
  logins?: { last_7d?: number; last_30d?: number; unique_users_30d?: number };
  domain_trends_30d_utc?: DomainRow[];
};

export type DailyTrendPoint = {
  date: string;
  signups: number;
  login_events: number;
  login_only: number;
  signup_events_logged: number;
  tracked_minutes: number;
  tab_segments: number;
  active_users: number;
  reports: number;
  intentions: number;
};

type TrendsPayload = {
  days?: number;
  start?: string;
  end?: string;
  daily?: DailyTrendPoint[];
};

function formatSec(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatMinutes(m: number) {
  if (!Number.isFinite(m) || m < 0) return "0";
  if (m >= 1440) return `${(m / 1440).toFixed(1)}d`;
  if (m >= 60) return `${(m / 60).toFixed(1)}h`;
  return `${Math.round(m)}m`;
}

function shortDate(iso: string) {
  const d = iso.slice(5, 10);
  return d || iso;
}

function ChartTooltip({
  active,
  payload,
  label,
  formatters,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string }>;
  label?: string;
  formatters?: Record<string, (v: number) => string>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/15 bg-[hsl(240,4%,10%)]/95 px-3 py-2 text-xs shadow-xl ring-1 ring-black/50 backdrop-blur-md">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      <ul className="space-y-0.5">
        {payload.map((e) => {
          const v = typeof e.value === "number" ? e.value : 0;
          const key = String(e.dataKey ?? e.name ?? "");
          const fmt = formatters?.[key];
          const text = fmt ? fmt(v) : String(v);
          return (
            <li key={key + (e.name ?? "")} className="flex items-center gap-2 text-muted">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: e.color }} />
              <span className="text-foreground/90">{e.name}</span>
              <span className="font-medium text-foreground">{text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-white/10 bg-card/50 p-4 ring-1 ring-white/[0.06] sm:p-5 ${className ?? ""}`}
    >
      {title ? <h2 className="text-sm font-semibold text-foreground">{title}</h2> : null}
      {subtitle ? <p className={`text-xs text-muted ${title ? "mt-1" : ""}`}>{subtitle}</p> : null}
      <div className={title || subtitle ? "mt-4" : ""}>{children}</div>
    </section>
  );
}

const DAY_OPTIONS = [30, 90, 180] as const;

export function AdminAnalyticsDashboard() {
  const reduceMotion = useReducedMotion();
  const anim = reduceMotion ? false : true;

  const [days, setDays] = useState<(typeof DAY_OPTIONS)[number]>(90);
  const [audience, setAudience] = useState<AudiencePayload | null>(null);
  const [trends, setTrends] = useState<TrendsPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [trendsErr, setTrendsErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setTrendsErr(null);
    try {
      const [aRes, tRes] = await Promise.all([
        adminApi("/api/admin/analytics/audience"),
        adminApi(`/api/admin/analytics/trends?days=${days}`),
      ]);
      const aBody = await aRes.json().catch(() => ({}));
      const tBody = await tRes.json().catch(() => ({}));
      if (!aRes.ok) {
        setErr(typeof aBody.error === "string" ? aBody.error : "Could not load audience analytics.");
        setAudience(null);
      } else {
        setAudience((aBody.data as AudiencePayload) ?? {});
      }
      if (!tRes.ok) {
        setTrendsErr(typeof tBody.error === "string" ? tBody.error : "Trend charts unavailable (run migration 009?).");
        setTrends(null);
      } else {
        setTrends((tBody.data as TrendsPayload) ?? {});
      }
    } catch {
      setErr("Could not load analytics.");
      setAudience(null);
      setTrends(null);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const daily = useMemo(() => trends?.daily ?? [], [trends?.daily]);
  const p = audience?.profiles;
  const total = p?.total ?? 0;
  const licensed = p?.licensed ?? 0;
  const free = Math.max(0, total - licensed);

  const planPie = useMemo(
    () => [
      { name: "Licensed (Pro)", value: licensed, key: "lic" },
      { name: "Free", value: free, key: "free" },
    ],
    [licensed, free]
  );

  const surveyPie = useMemo(() => {
    const w = p?.with_any_demographic ?? 0;
    const wo = Math.max(0, total - w);
    return [
      { name: "Shared survey field(s)", value: w },
      { name: "None yet", value: wo },
    ];
  }, [p?.with_any_demographic, total]);

  const domainBars = useMemo(() => {
    const rows = audience?.domain_trends_30d_utc ?? [];
    return rows.slice(0, 16).map((r) => ({
      domain: r.domain.length > 28 ? `${r.domain.slice(0, 26)}…` : r.domain,
      fullDomain: r.domain,
      hours: Math.round((Number(r.total_duration_sec) / 3600) * 10) / 10,
      users: r.distinct_users,
    }));
  }, [audience?.domain_trends_30d_utc]);

  const loginCompare = useMemo(
    () => [
      { period: "Last 7 days", events: audience?.logins?.last_7d ?? 0 },
      { period: "Last 30 days", events: audience?.logins?.last_30d ?? 0 },
    ],
    [audience?.logins]
  );

  const stackedLoginTail = useMemo(() => {
    const tail = daily.slice(-Math.min(45, daily.length));
    return tail.map((d) => ({
      ...d,
      label: shortDate(d.date),
    }));
  }, [daily]);

  const xInterval = daily.length > 56 ? Math.floor(daily.length / 14) : daily.length > 31 ? 6 : 0;

  const axisProps = {
    stroke: CHART.tick,
    tick: { fill: CHART.tick, fontSize: 11 },
    tickLine: { stroke: CHART.grid },
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Analytics dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Audience composition, optional survey breakdowns, auth activity, and tracked browsing — with daily trends
            over the window you select. All times use UTC for series alignment with stored dates.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Trend window</span>
          <div className="flex rounded-lg border border-white/10 p-0.5">
            {DAY_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  days === d ? "bg-white/15 text-foreground" : "text-muted hover:bg-white/[0.06] hover:text-foreground"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <Link href="/dashboard/admin" className="text-sm font-medium text-accent hover:underline">
            ← Staff
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md border border-white/15 bg-white/[0.06] px-3 py-1.5 text-sm text-foreground hover:bg-white/[0.1]"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-muted">Loading charts…</p>}
      {err && !loading && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{err}</p>
      )}

      {!loading && !err && audience && (
        <>
          {audience.generated_at && (
            <p className="text-xs text-muted">
              Snapshot{" "}
              {new Date(audience.generated_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </p>
          )}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi title="Accounts" value={total} hint="All profiles" />
            <Kpi title="Licensed" value={licensed} hint="Pro / paid flag" />
            <Kpi title="Survey participation" value={p?.with_any_demographic ?? 0} hint="≥1 optional field" />
            <Kpi
              title="Logins (30d)"
              value={audience.logins?.last_30d ?? 0}
              hint={`Unique users: ${audience.logins?.unique_users_30d ?? 0} · 7d events: ${audience.logins?.last_7d ?? 0}`}
            />
          </section>

          {trendsErr && (
            <p className="rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              {trendsErr}
            </p>
          )}

          {daily.length > 0 && !trendsErr && (
            <>
              <div className="grid gap-6 xl:grid-cols-2">
                <ChartCard
                  title="New accounts per day"
                  subtitle={`UTC calendar days · ${trends?.start} → ${trends?.end}`}
                >
                  <div className="h-[260px] w-full min-h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gSignups" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={CHART.blue} stopOpacity={0.35} />
                            <stop offset="100%" stopColor={CHART.blue} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickFormatter={shortDate}
                          interval={xInterval}
                          {...axisProps}
                        />
                        <YAxis allowDecimals={false} width={36} {...axisProps} />
                        <Tooltip
                          content={
                            <ChartTooltip formatters={{ signups: (v) => `${v} signups` }} />
                          }
                        />
                        <Area
                          type="monotone"
                          dataKey="signups"
                          name="Signups"
                          stroke={CHART.blue}
                          fill="url(#gSignups)"
                          strokeWidth={2}
                          isAnimationActive={anim}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>

                <ChartCard
                  title="Auth events per day"
                  subtitle="API-recorded password logins + signup events"
                >
                  <div className="h-[260px] w-full min-h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                        <XAxis dataKey="date" tickFormatter={shortDate} interval={xInterval} {...axisProps} />
                        <YAxis allowDecimals={false} width={36} {...axisProps} />
                        <Tooltip
                          content={
                            <ChartTooltip
                              formatters={{
                                login_events: (v) => `${v} events`,
                                login_only: (v) => `${v} logins`,
                                signup_events_logged: (v) => `${v} signups`,
                              }}
                            />
                          }
                        />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                        <Line
                          type="monotone"
                          dataKey="login_events"
                          name="All auth events"
                          stroke={CHART.violet}
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={anim}
                        />
                        <Line
                          type="monotone"
                          dataKey="login_only"
                          name="Logins"
                          stroke={CHART.blue}
                          strokeWidth={1.5}
                          dot={false}
                          isAnimationActive={anim}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>
              </div>

              <ChartCard
                title="Tracked time & active users"
                subtitle="Minutes summed from completed tab segments · distinct users with activity that day"
              >
                <div className="h-[300px] w-full min-h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={daily} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                      <XAxis dataKey="date" tickFormatter={shortDate} interval={xInterval} {...axisProps} />
                      <YAxis
                        yAxisId="left"
                        allowDecimals={false}
                        width={44}
                        tickFormatter={(v) => formatMinutes(Number(v))}
                        {...axisProps}
                      />
                      <YAxis yAxisId="right" orientation="right" allowDecimals={false} width={36} {...axisProps} />
                      <Tooltip
                        content={
                          <ChartTooltip
                            formatters={{
                              tracked_minutes: (v) => formatMinutes(v),
                              active_users: (v) => `${v} users`,
                            }}
                          />
                        }
                      />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                      <Bar
                        yAxisId="left"
                        dataKey="tracked_minutes"
                        name="Tracked minutes"
                        fill={CHART.mint}
                        fillOpacity={0.55}
                        radius={[4, 4, 0, 0]}
                        isAnimationActive={anim}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="active_users"
                        name="Active users"
                        stroke={CHART.amber}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={anim}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <div className="grid gap-6 xl:grid-cols-2">
                <ChartCard title="Product usage (daily)" subtitle="Intentions saved · AI reports generated (by report date)">
                  <div className="h-[260px] w-full min-h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                        <XAxis dataKey="date" tickFormatter={shortDate} interval={xInterval} {...axisProps} />
                        <YAxis allowDecimals={false} width={36} {...axisProps} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                        <Line
                          type="monotone"
                          dataKey="intentions"
                          name="Intentions"
                          stroke={CHART.cyan}
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={anim}
                        />
                        <Line
                          type="monotone"
                          dataKey="reports"
                          name="Reports"
                          stroke={CHART.rose}
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={anim}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>

                <ChartCard
                  title="Tab recording volume"
                  subtitle="Segments uploaded per day (all users)"
                >
                  <div className="h-[260px] w-full min-h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gSeg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={CHART.violet} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={CHART.violet} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                        <XAxis dataKey="date" tickFormatter={shortDate} interval={xInterval} {...axisProps} />
                        <YAxis allowDecimals={false} width={44} {...axisProps} />
                        <Tooltip content={<ChartTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="tab_segments"
                          name="Segments"
                          stroke={CHART.violet}
                          fill="url(#gSeg)"
                          strokeWidth={2}
                          isAnimationActive={anim}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>
              </div>

              <ChartCard
                title="Login vs signup events (recent days)"
                subtitle={`Stacked bars — last ${stackedLoginTail.length} days in window`}
              >
                <div className="h-[280px] w-full min-h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stackedLoginTail} margin={{ top: 8, right: 8, left: 0, bottom: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                      <XAxis dataKey="label" interval={stackedLoginTail.length > 20 ? 4 : 0} {...axisProps} />
                      <YAxis allowDecimals={false} width={36} {...axisProps} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                      <Bar
                        dataKey="login_only"
                        name="Logins"
                        stackId="a"
                        fill={CHART.blue}
                        isAnimationActive={anim}
                      />
                      <Bar
                        dataKey="signup_events_logged"
                        name="Signups (logged)"
                        stackId="a"
                        fill={CHART.amber}
                        isAnimationActive={anim}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Cumulative signups (trend)" subtitle="Running total over selected window">
                <CumulativeLineChart data={daily} anim={anim} axisProps={axisProps} xInterval={xInterval} />
              </ChartCard>
            </>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Plan mix" subtitle="Current snapshot">
              <div className="mx-auto h-[240px] w-full max-w-sm">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={planPie}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={80}
                      paddingAngle={2}
                      isAnimationActive={anim}
                    >
                      {planPie.map((_, i) => (
                        <Cell key={_.key} fill={CHART.pie[i % CHART.pie.length]} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Optional survey fields" subtitle="Users who entered at least one demographic field">
              <div className="mx-auto h-[240px] w-full max-w-sm">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={surveyPie}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={80}
                      paddingAngle={2}
                      isAnimationActive={anim}
                    >
                      {surveyPie.map((_, i) => (
                        <Cell key={_.name} fill={CHART.pie[(i + 2) % CHART.pie.length]} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>

          <ChartCard title="Auth volume (rolling windows)" subtitle="From login_events table">
            <div className="h-[200px] w-full max-w-md">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={loginCompare} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} {...axisProps} />
                  <YAxis type="category" dataKey="period" width={100} {...axisProps} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="events" name="Events" fill={CHART.violet} radius={[0, 6, 6, 0]} isAnimationActive={anim} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard
            title="Top domains by tracked time (30d UTC)"
            subtitle="Same data as table below — hours across all users"
          >
            {domainBars.length === 0 ? (
              <p className="text-sm text-muted">No domain activity in the last 30 UTC days.</p>
            ) : (
              <div className="h-[420px] w-full max-w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={domainBars}
                    layout="vertical"
                    margin={{ left: 4, right: 16, top: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => `${v}h`} {...axisProps} />
                    <YAxis type="category" dataKey="domain" width={108} tick={{ fontSize: 10, fill: CHART.tick }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        const row = payload[0].payload as (typeof domainBars)[0];
                        return (
                          <div className="rounded-lg border border-white/15 bg-[hsl(240,4%,10%)]/95 px-3 py-2 text-xs shadow-lg">
                            <p className="font-mono text-foreground">{row.fullDomain}</p>
                            <p className="text-muted">{row.hours}h · {row.users} users</p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="hours" name="Hours" fill={CHART.mint} radius={[0, 4, 4, 0]} isAnimationActive={anim} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          <div className="grid gap-6 xl:grid-cols-2">
            <BarDistribution
              title="Countries (ISO)"
              rows={(audience.countries ?? []).slice(0, 12).map((r) => ({ label: r.code, count: r.count }))}
              anim={anim}
              axisProps={axisProps}
            />
            <BarDistribution
              title="Company size"
              rows={(audience.company_size ?? []).map((r) => ({ label: r.size, count: r.count }))}
              anim={anim}
              axisProps={axisProps}
            />
            <BarDistribution
              title="Birth year"
              rows={(audience.birth_years ?? [])
                .slice()
                .sort((a, b) => a.year - b.year)
                .slice(-18)
                .map((r) => ({ label: String(r.year), count: r.count }))}
              anim={anim}
              axisProps={axisProps}
            />
            <BarDistribution
              title="Referral sources (top 12)"
              rows={(audience.referral_sources_top ?? []).slice(0, 12).map((r) => ({
                label: r.label.length > 24 ? `${r.label.slice(0, 22)}…` : r.label,
                count: r.count,
              }))}
              anim={anim}
              axisProps={axisProps}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <BarDistribution
              title="Industries (top 12)"
              rows={(audience.industries_top ?? []).slice(0, 12).map((r) => ({
                label: r.label.length > 28 ? `${r.label.slice(0, 26)}…` : r.label,
                count: r.count,
              }))}
              anim={anim}
              axisProps={axisProps}
              color={CHART.cyan}
            />
            <BarDistribution
              title="Occupations (top 12)"
              rows={(audience.occupations_top ?? []).slice(0, 12).map((r) => ({
                label: r.label.length > 28 ? `${r.label.slice(0, 26)}…` : r.label,
                count: r.count,
              }))}
              anim={anim}
              axisProps={axisProps}
              color={CHART.rose}
            />
          </div>

          <ChartCard title="Primary use cases (top 15)" subtitle="Free-text aggregation">
            <BarDistribution
              rows={(audience.primary_use_cases_top ?? []).slice(0, 15).map((r) => ({
                label: r.label.length > 36 ? `${r.label.slice(0, 34)}…` : r.label,
                count: r.count,
              }))}
              anim={anim}
              axisProps={axisProps}
              color={CHART.violet}
              embed
            />
          </ChartCard>

          <section className="rounded-xl border border-white/10 bg-card/40 p-4 ring-1 ring-white/[0.06]">
            <h2 className="text-sm font-semibold text-foreground">Domain detail (table)</h2>
            <p className="mt-1 text-xs text-muted">30-day UTC window — same source as the horizontal bar chart.</p>
            <div className="mt-4 overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03] text-muted">
                    <th className="px-3 py-2 font-medium">Domain</th>
                    <th className="px-3 py-2 font-medium">Total time</th>
                    <th className="px-3 py-2 font-medium">Users</th>
                  </tr>
                </thead>
                <tbody>
                  {(audience.domain_trends_30d_utc ?? []).length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-muted">
                        No activity in this window.
                      </td>
                    </tr>
                  )}
                  {(audience.domain_trends_30d_utc ?? []).map((row) => (
                    <tr key={row.domain} className="border-b border-white/5">
                      <td className="px-3 py-2 font-mono text-xs text-foreground">{row.domain}</td>
                      <td className="px-3 py-2 text-muted">{formatSec(Number(row.total_duration_sec))}</td>
                      <td className="px-3 py-2 text-muted">{row.distinct_users}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({ title, value, hint }: { title: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-card/60 p-4 ring-1 ring-white/10">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function CumulativeLineChart({
  data,
  anim,
  axisProps,
  xInterval,
}: {
  data: DailyTrendPoint[];
  anim: boolean;
  axisProps: Record<string, unknown>;
  xInterval: number;
}) {
  let cum = 0;
  const series = data.map((d) => {
    cum += d.signups;
    return { ...d, cumulative: cum };
  });
  return (
    <div className="h-[260px] w-full min-h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} interval={xInterval} {...axisProps} />
          <YAxis allowDecimals={false} width={44} {...axisProps} />
          <Tooltip content={<ChartTooltip />} />
          <Line
            type="monotone"
            dataKey="cumulative"
            name="Cumulative signups"
            stroke={CHART.cyan}
            strokeWidth={2}
            dot={false}
            isAnimationActive={anim}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function BarDistribution({
  title,
  rows,
  anim,
  axisProps,
  color = CHART.blue,
  className,
  embed = false,
}: {
  title?: string;
  rows: { label: string; count: number }[];
  anim: boolean;
  axisProps: Record<string, unknown>;
  color?: string;
  className?: string;
  embed?: boolean;
}) {
  const data = rows.map((r) => ({ ...r, short: r.label.length > 20 ? `${r.label.slice(0, 18)}…` : r.label }));
  const body =
    data.length === 0 ? (
      <p className="text-sm text-muted">No data yet.</p>
    ) : (
      <div className="h-[280px] w-full min-h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 4, right: 12, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} horizontal={false} />
            <XAxis type="number" allowDecimals={false} {...axisProps} />
            <YAxis type="category" dataKey="short" width={100} tick={{ fontSize: 10, fill: CHART.tick }} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const row = payload[0].payload as (typeof data)[0];
                return (
                  <div className="rounded-lg border border-white/15 bg-[hsl(240,4%,10%)]/95 px-3 py-2 text-xs">
                    <p className="text-foreground">{row.label}</p>
                    <p className="text-muted">{row.count} accounts</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="count" name="Count" fill={color} radius={[0, 4, 4, 0]} isAnimationActive={anim} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );

  if (embed) return <div className={className}>{body}</div>;

  return (
    <ChartCard title={title} className={className}>
      {body}
    </ChartCard>
  );
}
