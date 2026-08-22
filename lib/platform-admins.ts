/**
 * Platform-admin allowlist.
 *
 * Accounts listed here get admin-PANEL access (the /admin pages and /api/admin/*
 * routes) WITHOUT carrying role='admin'. They keep their own role -- so their
 * dashboard, storefront, hamburger menu and entire experience stay exactly that
 * role's -- and simply gain the ability to open /admin plus a single "Admin"
 * entry at the top of their hamburger.
 *
 * SINGLE source of truth: the server gates (lib/admin-auth requireAdmin /
 * requireOrdersAccess, app/admin/layout, every self-gating admin page) and the
 * client Navbar all read it. Dependency-free on purpose so it is safe to import
 * from both server and client code.
 *
 * Revoke: delete the id. Grant another account: add its id.
 */
export const PLATFORM_ADMIN_IDS: ReadonlySet<string> = new Set<string>([
  '844dca4b-6f01-4779-bc95-bfa1e0809c0c', // Savage Brands (savagebrands) -- super_agent with admin-panel access
]);

/** True when this user id is on the platform-admin allowlist. */
export function isPlatformAdminId(userId: string | null | undefined): boolean {
  return typeof userId === 'string' && PLATFORM_ADMIN_IDS.has(userId);
}

/**
 * The one check every admin gate should use. True for real admins
 * (role === 'admin') OR allowlisted platform admins. It only ADDS the
 * allowlisted ids; it never weakens the existing role check.
 */
export function isEffectiveAdmin(userId: string | null | undefined, role: string | null | undefined): boolean {
  return role === 'admin' || isPlatformAdminId(userId);
}
