import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AnimatedCard } from "@/components/motion/animated-card";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { createClient } from "@/lib/supabase/server";
import { PricingCheckout } from "./pricing-checkout";
import { PricingFeatureTable } from "./pricing-feature-table";

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function PricingPage({ searchParams }: Props) {
  const cancelled = searchParams.payment === "cancelled";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <div className="mb-8">
        <MarketingHeader user={user} loginHref="/login?next=%2Fpricing" showPricingNav={false} />
      </div>

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
            <Link href={user ? "/dashboard" : "/signup"}>
              <Button variant="secondary" className="w-full">
                {user ? "Open dashboard" : "Start free"}
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

        <PricingFeatureTable />
      </AnimatedCard>
    </main>
  );
}
