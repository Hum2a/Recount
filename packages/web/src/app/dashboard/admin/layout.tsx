import { redirect } from "next/navigation";
import { getVerifiedStaffAccess } from "@/lib/auth/staff-access";

/** Auth + API checks use cookies; never statically prerender this segment. */
export const dynamic = "force-dynamic";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const staff = await getVerifiedStaffAccess();
  if (!staff) redirect("/dashboard");

  return <>{children}</>;
}
