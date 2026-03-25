import { redirect } from "next/navigation";
import { getVerifiedStaffAccess } from "@/lib/auth/staff-access";
import { AnimatedCard } from "@/components/motion/animated-card";
import { AdminUsersPanel } from "./admin-users-panel";

export default async function AdminPage() {
  const staff = await getVerifiedStaffAccess();
  if (!staff) redirect("/dashboard");

  const isAdmin = staff.role === "admin";
  const roleLabel = staff.role === "admin" ? "Administrator" : "Developer (staff)";

  return (
    <div className="space-y-8">
      <AnimatedCard className="rounded-xl bg-card/80 p-6 shadow-lg shadow-black/15 ring-1 ring-white/10 backdrop-blur-sm">
        <h1 className="text-2xl font-semibold text-foreground">Admin</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Browse everyone with a Recount account. Open <strong className="text-foreground">Manage</strong> to see or
          edit their profile, daily intentions, activity, generated reports, and payment history. Administrators can
          change data; developers can review it.
        </p>
        <p className="mt-4 text-sm text-muted">
          Signed in as <span className="font-medium text-foreground">{staff.user.email}</span>
          <span className="mx-2 text-white/20">·</span>
          Your access: <span className="font-medium text-foreground">{roleLabel}</span>
        </p>
        {!isAdmin && (
          <p className="mt-4 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-muted">
            You can view the list below. Only an <strong className="text-foreground">Administrator</strong> can change
            someone&apos;s access level.
          </p>
        )}
      </AnimatedCard>

      <AdminUsersPanel canEditRoles={isAdmin} currentUserId={staff.user.id} />
    </div>
  );
}
