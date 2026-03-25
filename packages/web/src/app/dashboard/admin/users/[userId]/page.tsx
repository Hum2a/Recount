import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getVerifiedStaffAccess, staffHasFullManageAccess } from "@/lib/auth/staff-access";
import { AdminUserDetail } from "../../admin-user-detail";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function AdminUserPage({ params }: { params: { userId: string } }) {
  const staff = await getVerifiedStaffAccess();
  if (!staff) redirect("/dashboard");
  if (!UUID_RE.test(params.userId)) notFound();

  const canManage = staffHasFullManageAccess(staff.role);

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/admin"
        className="inline-block text-sm text-muted transition-colors hover:text-foreground"
      >
        ← Back to directory
      </Link>
      <AdminUserDetail userId={params.userId} canManage={canManage} currentUserId={staff.user.id} />
    </div>
  );
}
