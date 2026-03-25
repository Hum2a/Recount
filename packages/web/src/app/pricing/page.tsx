import Link from "next/link";
import { AppMark } from "@/components/brand/app-mark";
import { Button } from "@/components/ui/button";
import { AnimatedCard } from "@/components/motion/animated-card";
import { PricingCheckout } from "./pricing-checkout";

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default function PricingPage({ searchParams }: Props) {
  const cancelled = searchParams.payment === "cancelled";

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <AppMark href="/" />
        <div className="flex flex-wrap gap-3">
          <Link href="/login">
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link href="/signup">
            <Button>Get started</Button>
          </Link>
        </div>
      </header>

      {cancelled && (
        <AnimatedCard className="mt-6">
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Checkout was cancelled — you have not been charged.
          </p>
        </AnimatedCard>
      )}

      <AnimatedCard delay={0.05} className="mt-8 space-y-4">
        <h1 className="bg-gradient-to-br from-white to-white/70 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
          Pricing
        </h1>
        <p className="max-w-2xl text-muted">
          One honest price. No subscription fatigue — pay once, keep full history and AI accountability reports.
        </p>
      </AnimatedCard>

      <div className="mt-12 grid gap-8 md:grid-cols-2">
        <AnimatedCard delay={0.08} className="rounded-xl bg-card/80 p-6 shadow-lg shadow-black/20 ring-1 ring-white/10 backdrop-blur-sm">
          <h2 className="text-lg font-medium">Free</h2>
          <p className="mt-2 text-3xl font-semibold">£0</p>
          <p className="mt-3 text-sm text-muted">
            Core tracking and dashboard access. Activity and exports are limited to a rolling <strong className="text-foreground/90">7 UTC-day</strong> window (see table below).
          </p>
          <div className="mt-8">
            <Link href="/signup">
              <Button variant="secondary" className="w-full">
                Start free
              </Button>
            </Link>
          </div>
        </AnimatedCard>

        <AnimatedCard delay={0.12} className="rounded-xl bg-card/80 p-6 shadow-lg shadow-blue-500/10 ring-1 ring-accent/45 backdrop-blur-sm">
          <h2 className="text-lg font-medium">Lifetime</h2>
          <p className="mt-2 text-3xl font-semibold">£14.99</p>
          <p className="text-sm text-muted">One-time purchase</p>
          <p className="mt-3 text-sm text-muted">
            Unlocks <strong className="text-foreground/90">full activity history</strong>, <strong className="text-foreground/90">AI reports</strong>, longer charts and export windows.
          </p>
          <div className="mt-8">
            <PricingCheckout />
          </div>
        </AnimatedCard>
      </div>

      <AnimatedCard delay={0.16} className="mt-16 space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Everything Recount includes</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            How features compare on the <strong className="text-foreground/90">Free</strong> plan versus <strong className="text-foreground/90">Lifetime</strong> (one-time license). Limits follow UTC dates unless noted.
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.04]">
                <th scope="col" className="px-4 py-3 font-medium text-foreground">
                  Feature
                </th>
                <th scope="col" className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                  Free
                </th>
                <th scope="col" className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                  Lifetime
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06] text-muted">
              <FeatureRow
                feature="Account, web dashboard & browser extension"
                free="Yes"
                premium="Yes"
              />
              <FeatureRow
                feature="Passive tab time tracking (HTTP/HTTPS pages)"
                free="Yes"
                premium="Yes"
              />
              <FeatureRow
                feature="Extension: domain blocklist (never record those sites)"
                free="Yes"
                premium="Yes"
              />
              <FeatureRow
                feature="Daily intentions (extension popup & web)"
                free="Yes"
                premium="Yes"
              />
              <FeatureRow
                feature="Dashboard overview (today’s tracked time, top domains, intentions)"
                free="Yes"
                premium="Yes"
              />
              <FeatureRow
                feature="Intention & tracking streaks (dashboard & extension)"
                free="Yes"
                premium="Yes"
              />
              <FeatureRow
                feature="Pomodoro / focus timer in extension (tags uploaded segments)"
                free="Yes"
                premium="Yes"
              />
              <FeatureRow
                feature="Intent lock & distraction list (settings → extension sync)"
                free="Yes"
                premium="Yes"
              />
              <FeatureRow
                feature="Privacy: send tab titles or domains-only (setting)"
                free="Yes"
                premium="Yes"
              />
              <FeatureRow
                feature="Profile settings (timezone, hourly rate, team slug, etc.)"
                free="Yes"
                premium="Yes"
              />
              <FeatureRow
                feature="Team leaderboard (shared slug, opt-in nickname)"
                free="Yes"
                premium="Yes"
              />
              <FeatureRow
                feature="Weekly digest email (opt-in in settings)"
                free="Yes — if your host runs the digest job & email (not tied to license)"
                premium="Same"
              />
              <FeatureRow
                feature="Extension: end-of-day reminder"
                free="Yes"
                premium="Yes"
              />
              <FeatureRow
                feature="Activity page (filters, analytics, delete your own rows)"
                free="Last 7 UTC days of data"
                premium="Full history"
              />
              <FeatureRow
                feature="Per-day summary API (reports, extension “today”, etc.)"
                free="Last 7 UTC calendar days"
                premium="Any day you have data for"
              />
              <FeatureRow
                feature="History chart (dashboard)"
                free="Last 7 days"
                premium="Last 14 days"
              />
              <FeatureRow
                feature="CSV export (Settings)"
                free="7 days of daily totals"
                premium="30 days"
              />
              <FeatureRow
                feature="Calendar (.ics) export (Settings)"
                free="~7-day default window"
                premium="~30-day default; up to about 1 year of daily events"
              />
              <FeatureRow
                feature="AI accountability reports (generate, history, detail pages)"
                free="No"
                premium="Yes (e.g. GPT-4o–powered summary & score)"
              />
            </tbody>
          </table>
        </div>

        <p className="text-xs leading-relaxed text-muted">
          <strong className="text-foreground/80">Staff / admin tools</strong> (user directory, support edits) are{" "}
          <strong className="text-foreground/80">not</strong> part of Free vs Lifetime — they are assigned by role (admin/developer) only.
        </p>
      </AnimatedCard>
    </main>
  );
}

function FeatureRow({ feature, free, premium }: { feature: string; free: string; premium: string }) {
  return (
    <tr className="hover:bg-white/[0.02]">
      <th scope="row" className="px-4 py-3.5 font-normal text-foreground/95">
        {feature}
      </th>
      <td className="px-4 py-3.5 align-top">{free}</td>
      <td className="px-4 py-3.5 align-top">{premium}</td>
    </tr>
  );
}
