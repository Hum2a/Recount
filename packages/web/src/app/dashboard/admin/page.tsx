import { redirect } from "next/navigation";
import { getVerifiedStaffAccess } from "@/lib/auth/staff-access";
import { AdminRoleForm } from "./admin-role-form";

export default async function AdminPage() {
  const staff = await getVerifiedStaffAccess();
  if (!staff) redirect("/dashboard");

  const isAdmin = staff.role === "admin";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Staff</h1>
        <p className="mt-2 text-sm text-muted">
          Access is enforced on the <strong>server</strong> using your real session and the Recount API — not something
          you can fake by editing requests in the browser for this page load. Only Supabase auth + database role data
          grant entry.
        </p>
        <p className="mt-3 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
          Signed in as <span className="font-medium text-foreground">{staff.user.email}</span> · role{" "}
          <span className="font-mono text-foreground">{staff.role}</span>
        </p>
      </div>

      <div className="rounded-lg border border-white/10 bg-card/30 p-5 text-sm text-muted">
        <h2 className="text-base font-medium text-foreground">Security notes</h2>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>
            Run migration <code className="text-foreground">004_profiles_rls_select_only.sql</code> so the browser
            cannot <code className="text-foreground">UPDATE profiles</code> via the Supabase anon key to become admin.
          </li>
          <li>
            Admin-only actions (e.g. changing someone else&apos;s <code className="text-foreground">app_role</code>)
            are enforced again in the API with <code className="text-foreground">requireAppRole(&quot;admin&quot;)</code>
            .
          </li>
        </ul>
      </div>

      {isAdmin ? (
        <AdminRoleForm />
      ) : (
        <p className="text-sm text-muted">
          <strong>Developers</strong> can open this page for internal tools later. Only <strong>admins</strong> can
          assign roles via the API.
        </p>
      )}
    </div>
  );
}
