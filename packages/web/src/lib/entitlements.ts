/** Matches `profiles.app_role` for staff (API + extension semantics). */
export const STAFF_APP_ROLES = ["admin", "developer"] as const;

export function isStaffAppRole(role: string | null | undefined): boolean {
  return Boolean(role && (STAFF_APP_ROLES as readonly string[]).includes(role));
}

/**
 * Licensed users and staff (admin/developer) get the same product surface as “full” access
 * (AI reports, extended history, etc.).
 */
export function hasFullProductAccess(licenseActive: boolean, appRole: string | null | undefined): boolean {
  return Boolean(licenseActive) || isStaffAppRole(appRole);
}

/** Settings / account summary line — keep in sync with extension “plan” wording where possible. */
export function planLabelForDisplay(licenseActive: boolean, appRole: string | null | undefined): string {
  const staff = isStaffAppRole(appRole);
  const lic = Boolean(licenseActive);
  if (staff && lic) return "Premium · Staff";
  if (staff) return "Staff (full access)";
  if (lic) return "Premium (license active)";
  return "Free";
}
