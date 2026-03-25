import Link from "next/link";
import { AnimatedCard } from "@/components/motion/animated-card";
import { Button } from "@/components/ui/button";
import { PRICING_FEATURES } from "@/app/pricing/pricing-features-data";
import { cn } from "@/lib/utils";

const HIGHLIGHT_IDS = [
  "tab-tracking",
  "intentions",
  "ai-reports",
  "activity",
  "intent-lock",
  "streaks",
  "team-leaderboard",
  "csv-export",
  "ics-export",
  "account-extension",
] as const;

const highlights = HIGHLIGHT_IDS.map((id) => PRICING_FEATURES.find((f) => f.id === id)).filter(
  (f): f is NonNullable<typeof f> => f != null
);

type FeatureAccent = {
  label: string;
  card: string;
  orb: string;
  chip: string;
};

const ACCENT_BY_ID: Record<string, FeatureAccent> = {
  "tab-tracking": {
    label: "Tracking",
    card: "border-sky-500/30 shadow-sky-500/10",
    orb: "bg-sky-500/20",
    chip: "bg-sky-500/15 text-sky-100 ring-sky-400/35",
  },
  intentions: {
    label: "Goals",
    card: "border-amber-500/30 shadow-amber-500/10",
    orb: "bg-amber-500/15",
    chip: "bg-amber-500/15 text-amber-100 ring-amber-400/35",
  },
  "ai-reports": {
    label: "AI",
    card: "border-violet-500/40 shadow-violet-500/15",
    orb: "bg-violet-500/20",
    chip: "bg-violet-500/15 text-violet-100 ring-violet-400/40",
  },
  activity: {
    label: "Data",
    card: "border-cyan-500/30 shadow-cyan-500/10",
    orb: "bg-cyan-500/15",
    chip: "bg-cyan-500/15 text-cyan-100 ring-cyan-400/35",
  },
  "intent-lock": {
    label: "Focus",
    card: "border-rose-500/30 shadow-rose-500/10",
    orb: "bg-rose-500/15",
    chip: "bg-rose-500/15 text-rose-100 ring-rose-400/35",
  },
  streaks: {
    label: "Habits",
    card: "border-emerald-500/30 shadow-emerald-500/10",
    orb: "bg-emerald-500/15",
    chip: "bg-emerald-500/15 text-emerald-100 ring-emerald-400/35",
  },
  "team-leaderboard": {
    label: "Team",
    card: "border-indigo-500/35 shadow-indigo-500/10",
    orb: "bg-indigo-500/18",
    chip: "bg-indigo-500/15 text-indigo-100 ring-indigo-400/35",
  },
  "csv-export": {
    label: "Export",
    card: "border-teal-500/30 shadow-teal-500/10",
    orb: "bg-teal-500/15",
    chip: "bg-teal-500/15 text-teal-100 ring-teal-400/35",
  },
  "ics-export": {
    label: "Calendar",
    card: "border-cyan-500/30 shadow-cyan-500/10",
    orb: "bg-cyan-500/12",
    chip: "bg-cyan-500/15 text-cyan-100 ring-cyan-400/30",
  },
  "account-extension": {
    label: "Platform",
    card: "border-blue-500/25 shadow-blue-500/10",
    orb: "bg-blue-500/12",
    chip: "bg-blue-500/12 text-blue-100 ring-blue-400/30",
  },
};

const DEFAULT_ACCENT: FeatureAccent = {
  label: "Feature",
  card: "border-white/12 shadow-black/20",
  orb: "bg-white/5",
  chip: "bg-white/[0.06] text-zinc-200 ring-white/15",
};

function accentFor(id: string): FeatureAccent {
  return ACCENT_BY_ID[id] ?? DEFAULT_ACCENT;
}

export function HomeCapabilities() {
  return (
    <section className="flex flex-col gap-10">
      <AnimatedCard delay={0.08} className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-accent/90">Plans</p>
        <h2 className="bg-gradient-to-br from-white via-white to-white/65 bg-clip-text text-2xl font-semibold tracking-tight text-transparent md:text-3xl">
          Simple pricing, serious depth
        </h2>
        <p className="max-w-2xl text-muted">
          Start free with real tracking and a full dashboard. Upgrade once for full history, longer charts, exports, and
          AI accountability reports — no subscription.
        </p>
      </AnimatedCard>

      <div className="grid gap-6 md:grid-cols-2">
        <AnimatedCard
          delay={0.1}
          className="relative overflow-hidden rounded-xl border border-emerald-500/25 bg-gradient-to-br from-card/95 via-card/85 to-emerald-950/35 p-6 shadow-lg shadow-emerald-950/25 ring-1 ring-white/10 backdrop-blur-sm"
        >
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-emerald-400/15 blur-3xl"
            aria-hidden
          />
          <p className="relative text-xs font-semibold uppercase tracking-wider text-emerald-400/95">Starter</p>
          <h3 className="relative mt-1 text-lg font-medium text-foreground">Free</h3>
          <p className="relative mt-2 text-3xl font-semibold text-emerald-50">£0</p>
          <p className="relative mt-3 text-sm text-muted">
            Core tracking and dashboard access. Activity, summaries, CSV, and the history chart use a rolling{" "}
            <strong className="text-emerald-100/90">7 UTC-day</strong> window — same limits as on the pricing page.
          </p>
        </AnimatedCard>
        <AnimatedCard
          delay={0.12}
          className="relative overflow-hidden rounded-xl border border-blue-500/45 bg-gradient-to-br from-card/95 via-blue-950/25 to-violet-950/45 p-6 shadow-lg shadow-blue-500/20 ring-1 ring-blue-500/25 backdrop-blur-sm"
        >
          <div
            className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-12 left-1/2 h-32 w-48 -translate-x-1/2 rounded-full bg-violet-500/15 blur-3xl"
            aria-hidden
          />
          <p className="relative text-xs font-semibold uppercase tracking-wider text-blue-300">Full archive + AI</p>
          <h3 className="relative mt-1 text-lg font-medium text-foreground">Lifetime</h3>
          <p className="relative mt-2 text-3xl font-semibold bg-gradient-to-r from-white to-blue-100/90 bg-clip-text text-transparent">
            £14.99
          </p>
          <p className="relative text-sm text-blue-200/80">One-time purchase</p>
          <p className="relative mt-3 text-sm text-muted">
            <strong className="text-blue-100/95">Full activity history</strong>,{" "}
            <strong className="text-violet-200/95">AI end-of-day reports</strong>, a{" "}
            <strong className="text-blue-100/95">14-day</strong> history chart, and wider{" "}
            <strong className="text-blue-100/95">CSV / calendar</strong> export windows.
          </p>
        </AnimatedCard>
      </div>

      <AnimatedCard delay={0.14} className="space-y-6">
        <div>
          <h3 className="text-xl font-semibold tracking-tight">What you get with Recount</h3>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Colour groups are themes, not separate products — everything ships in one app. Free vs Lifetime mainly changes
            how far back you can analyze and whether AI reports run. Open the full comparison for row-by-row detail.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {highlights.map((f) => {
            const a = accentFor(f.id);
            return (
              <li
                key={f.id}
                className={cn(
                  "group relative overflow-hidden rounded-xl border bg-gradient-to-br from-white/[0.05] to-transparent p-4 shadow-md backdrop-blur-sm transition-[border-color,box-shadow,transform] duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-lg",
                  a.card
                )}
              >
                <div
                  className={cn(
                    "pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-70 blur-2xl transition-opacity duration-300 group-hover:opacity-100",
                    a.orb
                  )}
                  aria-hidden
                />
                <div className="relative">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset",
                      a.chip
                    )}
                  >
                    {a.label}
                  </span>
                  <p className="mt-2.5 font-medium text-foreground/95">{f.name}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.tagline}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="flex flex-col gap-0.5 rounded-lg bg-zinc-500/10 px-2.5 py-2 ring-1 ring-zinc-400/20">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Free</span>
                      <span className="text-xs leading-snug text-zinc-100/95">{f.free}</span>
                    </div>
                    <div className="flex flex-col gap-0.5 rounded-lg bg-blue-500/12 px-2.5 py-2 ring-1 ring-blue-400/30">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300/95">Lifetime</span>
                      <span className="text-xs leading-snug text-blue-50/95">{f.premium}</span>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-3">
          <Link href="/pricing">
            <Button variant="secondary">Full feature comparison</Button>
          </Link>
          <Link href="/signup">
            <Button>Create free account</Button>
          </Link>
        </div>
        <p className="text-xs leading-relaxed text-muted">
          Staff and admin tools are role-based, not part of the Free vs Lifetime split — see the note on the pricing
          page.
        </p>
      </AnimatedCard>
    </section>
  );
}
