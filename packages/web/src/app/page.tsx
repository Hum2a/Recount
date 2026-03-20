import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AnimatedCard } from "@/components/motion/animated-card";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-12 px-6 py-16">
      <AnimatedCard>
        <header className="flex items-center justify-between gap-4">
          <span className="text-lg font-semibold tracking-tight">Recount</span>
          <div className="flex flex-wrap gap-3">
            <Link href="/pricing">
              <Button variant="ghost">Pricing</Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button>Get started</Button>
            </Link>
          </div>
        </header>
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
          <Link href="/signup">
            <Button>Create account</Button>
          </Link>
          <a href="https://chrome.google.com/webstore" target="_blank" rel="noreferrer">
            <Button variant="secondary">Chrome extension</Button>
          </a>
        </div>
      </AnimatedCard>
      <section className="grid gap-6 md:grid-cols-2">
        <AnimatedCard delay={0.1} className="rounded-xl bg-card/80 p-6 shadow-lg shadow-black/20 ring-1 ring-white/10 backdrop-blur-sm">
          <h2 className="text-lg font-medium">Free</h2>
          <p className="mt-2 text-3xl font-semibold">£0</p>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            <li>Passive tracking</li>
            <li>7-day history</li>
            <li>No AI accountability report</li>
          </ul>
        </AnimatedCard>
        <AnimatedCard delay={0.14} className="rounded-xl bg-card/80 p-6 shadow-lg shadow-blue-500/10 ring-1 ring-accent/35 backdrop-blur-sm">
          <h2 className="text-lg font-medium">Lifetime</h2>
          <p className="mt-2 text-3xl font-semibold">£14.99</p>
          <p className="text-sm text-muted">One-time purchase</p>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            <li>Full history</li>
            <li>AI end-of-day reports</li>
            <li>Weekly trends &amp; CSV export</li>
          </ul>
          <div className="mt-6">
            <Link href="/pricing">
              <Button className="w-full">View pricing &amp; unlock</Button>
            </Link>
          </div>
        </AnimatedCard>
      </section>
    </main>
  );
}
