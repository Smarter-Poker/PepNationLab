/**
 * lib/messenger/identity.ts
 *
 * Shared, dependency-free DISPLAY-identity masking for the in-app Messenger.
 *
 * Product rule: a real platform admin (profiles.role === 'admin', e.g. the
 * owner "Daniel Bekavac") must never surface by real name / email / avatar to a
 * NON-admin viewer. To non-admins, every admin participant or message sender
 * renders as the generic support identity "PepNation Support". Admin viewers
 * (role === 'admin') keep seeing real identities everywhere.
 *
 * This is DISPLAY-ONLY: it never touches sender_id or any stored row. Apply it
 * at read time, in each messenger read surface, to the OTHER party's / sender's
 * profile just before returning it to the client.
 */

export const SUPPORT_DISPLAY_NAME = 'PepNation Support';

/**
 * Mask an admin profile for a non-admin viewer.
 *
 * Returns the profile unchanged when the viewer IS an admin OR the profile is
 * not an admin. Otherwise returns a shallow copy with the identifying fields
 * replaced: full_name -> "PepNation Support", email -> null, avatar_url -> null
 * (so the UI falls back to generic initials).
 */
export function maskAdminIdentity<
  T extends {
    role?: string | null;
    full_name?: string | null;
    email?: string | null;
    avatar_url?: string | null;
  },
>(profile: T | null, viewerIsAdmin: boolean): T | null {
  if (!profile) return profile;
  if (viewerIsAdmin) return profile;
  if (profile.role !== 'admin') return profile;
  return { ...profile, full_name: SUPPORT_DISPLAY_NAME, email: null, avatar_url: null };
}

/**
 * Same rule as maskAdminIdentity, but for the flattened `counterparty_*` shape
 * used by the conversation list and global search results. Also blanks
 * counterparty_username so the UI cannot fall back to the admin's handle.
 */
export function maskAdminCounterparty<
  T extends {
    counterparty_role?: string | null;
    counterparty_full_name?: string | null;
    counterparty_username?: string | null;
    counterparty_avatar_url?: string | null;
  },
>(row: T, viewerIsAdmin: boolean): T {
  if (viewerIsAdmin) return row;
  if (row.counterparty_role !== 'admin') return row;
  return {
    ...row,
    counterparty_full_name: SUPPORT_DISPLAY_NAME,
    counterparty_username: null,
    counterparty_avatar_url: null,
  };
}
