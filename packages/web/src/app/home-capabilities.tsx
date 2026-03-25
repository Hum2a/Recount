import Link from "next/link";
import { AnimatedCard } from "@/components/motion/animated-card";
import { Button } from "@/components/ui/button";
import { PRICING_FEATURES } from "@/app/pricing/pricing-features-data";

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
          className="rounded-xl bg-card/80 p-6 shadow-lg shadow-black/20 ring-1 ring-white/10 backdrop-blur-sm"
        >
          <h3 className="text-lg font-medium">Free</h3>
          <p className="mt-2 text-3xl font-semibold">£0</p>
          <p className="mt-3 text-sm text-muted">
            Core tracking and dashboard access. Activity, summaries, CSV, and the history chart use a rolling{" "}
            <strong className="text-foreground/90">7 UTC-day</strong> window — same limits as on the pricing page.
          </p>
        </AnimatedCard>
        <AnimatedCard
          delay={0.12}
          className="rounded-xl bg-card/80 p-6 shadow-lg shadow-blue-500/10 ring-1 ring-accent/45 backdrop-blur-sm"
        >
          <h3 className="text-lg font-medium">Lifetime</h3>
          <p className="mt-2 text-3xl font-semibold">£14.99</p>
          <p className="text-sm text-muted">One-time purchase</p>
          <p className="mt-3 text-sm text-muted">
            <strong className="text-foreground/90">Full activity history</strong>,{" "}
            <strong className="text-foreground/90">AI end-of-day reports</strong>, a{" "}
            <strong className="text-foreground/90">14-day</strong> history chart, and wider{" "}
            <strong className="text-foreground/90">CSV / calendar</strong> export windows.
          </p>
        </AnimatedCard>
      </div>

      <AnimatedCard delay={0.14} className="space-y-6">
        <div>
          <h3 className="text-xl font-semibold tracking-tight">What you get with Recount</h3>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Everything below is included in the product; Free vs Lifetime mainly changes how far back you can analyze
            and whether AI reports run. Open the full comparison for row-by-row detail.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {highlights.map((f) => (
            <li
              key={f.id}
              className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4 transition-[border-color,background-color] duration-200 motion-safe:hover:border-white/[0.12] motion-safe:hover:bg-white/[0.05]"
            >
              <p className="font-medium text-foreground/95">{f.name}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.tagline}</p>
              <p className="mt-2 text-xs text-muted/90">
                <span className="text-foreground/70">Free:</span> {f.free}
                <span className="mx-1.5 text-white/20">·</span>
                <span className="text-foreground/70">Lifetime:</span> {f.premium}
              </p>
            </li>
          ))}
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
