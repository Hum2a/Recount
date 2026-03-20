import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMaybeStaffForNav } from "@/lib/auth/staff-access";
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
    <div className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <Suspense fallback={null}>
        <PaymentSuccessHandler />
      </Suspense>
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/dashboard" className="text-lg font-semibold">
            Recount
          </Link>
          <p className="text-sm text-muted">{user.email}</p>
        </div>
        <SignOutButton />
      </header>
      <DashboardNav showAdminLink={showAdminLink} />
      <div className="mt-8">{children}</div>
    </div>
  );
}
