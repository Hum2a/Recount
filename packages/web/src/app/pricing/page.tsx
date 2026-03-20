import Link from "next/link";
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
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← Home
      </Link>

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
          <ul className="mt-6 space-y-2 text-sm text-muted">
            <li>Passive tab tracking (extension)</li>
            <li>7-day history in the dashboard</li>
            <li>Morning intentions</li>
            <li className="text-foreground/70">No AI end-of-day report</li>
          </ul>
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
          <ul className="mt-6 space-y-2 text-sm text-muted">
            <li>Full history</li>
            <li>AI accountability reports (GPT-4o)</li>
            <li>Weekly trends &amp; CSV export</li>
          </ul>
          <div className="mt-8">
            <PricingCheckout />
          </div>
        </AnimatedCard>
      </div>
    </main>
  );
}
