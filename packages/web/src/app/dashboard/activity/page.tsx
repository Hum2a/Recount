import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { apiFetch } from "@/lib/api";
import { AnimatedCard } from "@/components/motion/animated-card";
import { MyActivityClient } from "./my-activity-client";

export default async function ActivityPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const payRes = await apiFetch("/api/payments/status", session.access_token);
  const pay = await payRes.json().catch(() => ({}));
  const licensed = Boolean(pay.data?.license_active);

  return (
    <div className="space-y-8">
      <AnimatedCard className="rounded-xl bg-card/80 p-6 shadow-lg shadow-black/15 ring-1 ring-white/10 backdrop-blur-sm">
        <h1 className="text-2xl font-semibold text-foreground">My activity</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Deep view of your browser time: same breakdowns and tools staff use in support — scoped strictly to your
          account.
        </p>
      </AnimatedCard>
      <AnimatedCard delay={0.05} className="rounded-xl bg-card/80 p-6 shadow-lg shadow-black/15 ring-1 ring-white/10 backdrop-blur-sm">
        <MyActivityClient licensed={licensed} />
      </AnimatedCard>
    </div>
  );
}
