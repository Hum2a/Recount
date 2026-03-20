import { redirect } from "next/navigation";
import { getVerifiedStaffAccess } from "@/lib/auth/staff-access";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const staff = await getVerifiedStaffAccess();
  if (!staff) redirect("/dashboard");

  return <>{children}</>;
}
