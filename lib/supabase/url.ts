// Canonical Supabase project URL for PepNationLab (ydsaqnnuwyvtyxgvrnys).
//
// WHY THIS FILE EXISTS (2026-07-07 login outage):
// NEXT_PUBLIC_SUPABASE_URL was switched to https://auth.pepnationlab.com,
// a vanity subdomain that only has a raw DNS CNAME to the project host.
// The custom domain was never activated on the Supabase side, so no TLS
// certificate is served for it and every browser/server request to it
// fails ("Failed to fetch"). Result: all logins (old and new accounts)
// authenticated against stale cached bundles but the server could never
// read the session, bouncing everyone back to /login.
//
// Every Supabase client in the app must resolve its URL through
// getSupabaseUrl() so a bad env value can never take auth down again.
// If the custom domain is ever properly activated on Supabase (paid
// add-on + activation, which provisions the certificate), remove the
// DEAD_HOSTS guard below and set the env var back.

const CANONICAL_SUPABASE_URL = 'https://ydsaqnnuwyvtyxgvrnys.supabase.co';

// Hostnames that must never be used for Supabase traffic until they are
// activated as a real Supabase custom domain.
const DEAD_HOSTS = ['auth.pepnationlab.com'];

export function getSupabaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  if (!raw) return CANONICAL_SUPABASE_URL;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    if (DEAD_HOSTS.includes(host)) return CANONICAL_SUPABASE_URL;
  } catch {
    return CANONICAL_SUPABASE_URL;
  }
  return raw;
}
