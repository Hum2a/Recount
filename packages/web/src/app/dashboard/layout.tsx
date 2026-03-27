import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppMark } from "@/components/brand/app-mark";
import { createClient } from "@/lib/supabase/server";
import { getMaybeStaffForNav } from "@/lib/auth/staff-access";
import { DashboardEntitlementsProvider } from "@/components/layout/dashboard-entitlements";
import { DashboardNav } from "@/components/layout/dashboard-nav";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { PaymentSuccessHandler } from "./payment-success-handler";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const showAdminLink = await getMaybeStaffForNav();

  return (
    <DashboardEntitlementsProvider staffNavFallback={showAdminLink}>
      <div className="mx-auto min-h-screen max-w-5xl px-6 py-10">
        <Suspense fallback={null}>
          <PaymentSuccessHandler />
        </Suspense>
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <AppMark href="/dashboard" wordmarkClassName="text-lg font-semibold" />
            <p className="text-sm text-muted">{user.email}</p>
          </div>
          <SignOutButton />
        </header>
        <DashboardNav />
        <div className="mt-8">{children}</div>
      </div>
    </DashboardEntitlementsProvider>
  );
}
