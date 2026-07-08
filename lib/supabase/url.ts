// Canonical Supabase project URL for PepNationLab (ydsaqnnuwyvtyxgvrnys).
//
// WHY THIS FILE EXISTS (2026-07-07 login outage):
// NEXT_PUBLIC_SUPABASE_URL was switched to https://auth.pepnationlab.com,
// a vanity subdomain with a DNS CNAME to the project host. Even after the
// custom domain was reportedly activated on the Supabase side, requests to
// it from real browsers still fail TLS ("Failed to fetch"), which broke
// every login (old and new accounts): auth calls never completed, or
// completed against stale cached bundles whose session the server could
// not read, bouncing everyone back to /login.
//
// Every Supabase client in the app must resolve its URL through
// getSupabaseUrl() so a bad env value can never take auth down again.
//
// DO NOT remove a host from DEAD_HOSTS until this check passes from a
// real browser (not curl, not the server):
//   fetch('https://auth.pepnationlab.com/auth/v1/health') returns a
//   response (any status) instead of a TLS/network error.
// The canonical URL below always works, so keeping the guard on costs
// nothing except vanity-domain branding on the OAuth redirect.

const CANONICAL_SUPABASE_URL = 'https://ydsaqnnuwyvtyxgvrnys.supabase.co';

// Hostnames that must never be used for Supabase traffic until they are
// verified to serve TLS as a real activated Supabase custom domain.
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
