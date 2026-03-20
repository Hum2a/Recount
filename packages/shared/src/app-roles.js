/** @typedef {'user' | 'admin' | 'developer'} AppRole */

/** Canonical role names (DB `profiles.app_role` and API checks). */
export const APP_ROLES = /** @type {readonly AppRole[]} */ (["user", "admin", "developer"]);

/** @param {string} value */
export function isAppRole(value) {
  return APP_ROLES.includes(/** @type {AppRole} */ (value));
}
