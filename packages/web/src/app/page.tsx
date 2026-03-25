import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AnimatedCard } from "@/components/motion/animated-card";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { createClient } from "@/lib/supabase/server";
import { HomeCapabilities } from "./home-capabilities";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-12 px-6 py-16">
      <AnimatedCard>
        <MarketingHeader user={user} />
      </AnimatedCard>
      <AnimatedCard delay={0.06} className="space-y-6">
        <h1 className="bg-gradient-to-br from-white via-white to-white/60 bg-clip-text text-4xl font-semibold tracking-tight text-transparent md:text-5xl">
          Honest productivity, zero manual timers.
        </h1>
        <p className="max-w-2xl text-lg text-muted">
          Recount passively tracks where your attention actually goes, compares it to the intentions you set each
          morning, and delivers an end-of-day AI report that tells the truth.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href={user ? "/dashboard" : "/signup"}>
            <Button>{user ? "Open dashboard" : "Create account"}</Button>
          </Link>
          <a href="https://chrome.google.com/webstore" target="_blank" rel="noreferrer">
            <Button variant="secondary">Chrome extension</Button>
          </a>
        </div>
      </AnimatedCard>
      <HomeCapabilities />
    </main>
  );
}
