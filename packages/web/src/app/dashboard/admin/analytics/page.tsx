import { redirect } from "next/navigation";
import { AnimatedCard } from "@/components/motion/animated-card";
import { getVerifiedStaffAccess } from "@/lib/auth/staff-access";
import { AdminAudienceClient } from "../admin-audience-client";

export default async function AdminAnalyticsPage() {
  const staff = await getVerifiedStaffAccess();
  if (!staff) redirect("/dashboard");

  return (
    <div className="space-y-8">
      <AnimatedCard className="rounded-xl bg-card/80 p-6 shadow-lg shadow-black/15 ring-1 ring-white/10 backdrop-blur-sm">
        <AdminAudienceClient />
      </AnimatedCard>
    </div>
  );
}
