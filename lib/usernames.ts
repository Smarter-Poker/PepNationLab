/**
 * Username helpers.
 *
 * Usernames are stored lowercase and restricted to `[a-z0-9_]` so they map
 * one-to-one with the synthetic `${username}@internal.auth` Supabase auth
 * identity. Centralizing the sanitizer keeps every entry point - admin
 * create-agent, agent create-researcher, storefront self-register, and the
 * client-side controlled inputs - in agreement on what a "valid" username
 * actually is.
 */

export function sanitizeUsername(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
}

export function validateUsername(s: string): { valid: boolean; error?: string } {
  const u = sanitizeUsername(s);
  if (!u) return { valid: false, error: 'Invalid Username.' };
  if (u.length < 3) return { valid: false, error: 'Username Must Be At Least 3 Characters.' };
  if (u.length > 30) return { valid: false, error: 'Username Must Be 30 Characters Or Fewer.' };
  return { valid: true };
}
