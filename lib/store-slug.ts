// lib/store-slug.ts
//
// SINGLE SOURCE OF TRUTH for what a storefront slug may be.
//
// This used to be three different regexes that disagreed with each other:
//   - creation (app/api/admin/agents)  /^[a-z0-9\-]+$/      max 80
//   - middleware (proxy.ts)            /^[a-z0-9][a-z0-9_-]{1,50}$/
//   - client capture (AgentLinkCapture) /^[a-z0-9-]{1,60}$/i
// A slug that is legal at creation but illegal in the middleware is created
// successfully, gets a QR code generated for it, and is then PERMANENTLY
// unroutable — direct-URL entry silently does nothing and no error is raised
// anywhere. Everything that validates, matches or routes a slug must import
// from here.
//
// Edge-safe: no imports, no Node APIs. Usable from middleware, route handlers,
// server components and client components alike.

/**
 * Canonical storefront slug shape: 2-50 chars, lowercase alphanumeric start,
 * then alphanumerics / hyphen / underscore.
 */
export const STORE_SLUG_RE = /^[a-z0-9][a-z0-9_-]{1,49}$/;

/**
 * First path segments that are real app routes and can therefore never be a
 * storefront.
 *
 * Two jobs:
 *   1. proxy.ts skips a service-role lookup on every logged-out hit to a
 *      gated page.
 *   2. Slug CREATION rejects these, so an agent can never be handed a slug
 *      like `wallet` or `checkout` — which would generate a QR pointing at an
 *      app route and leave their storefront unreachable forever.
 *
 * Mirrored by the `agent_profiles_slug_not_reserved` database trigger, which
 * is the real enforcement point (it covers all five creation routes and any
 * future one). Keep the two in sync; the DB is authoritative.
 */
export const RESERVED_SEGMENTS = new Set([
  'about', 'accept-disclaimer', 'account', 'admin', 'advertising', 'api', 'auth',
  'become-agent', 'checkout', 'coa', 'compliance', 'contact', 'dashboard',
  'disclaimer', 'favicon.ico', 'feed.xml', 'find-a-peptide', 'forgot-password',
  'help', 'invite', 'lab-journal', 'lab-tools', 'llms.txt', 'llms-full.txt',
  'login', 'manifest.webmanifest', 'messages', 'messenger', 'onboarding',
  'orders', 'peptide-101', 'peptides', 'privacy', 'products', 'register',
  'research', 'reset-password', 'robots.txt', 'shelf-life', 'shipping',
  'signup', 'sitemap.xml', 'status', 'sw.js', 'terms', 'wallet', '_next',
  // Real routes that were missing from this list. Either one could have been
  // handed out as a storefront slug, and the agent who received it would have
  // had a QR code and a printed URL pointing at an app route forever, with no
  // error raised anywhere.
  //   test-card  -> app/test-card/page.tsx
  //   monitoring -> injected by Sentry (tunnelRoute: '/monitoring' in
  //                 next.config.ts), so it exists at runtime with no folder
  //                 under app/ to notice it by.
  'test-card', 'monitoring',
]);

/**
 * Canonical form of a storefront slug, or null when it is not a legal slug.
 *
 * The validators below lowercase INTERNALLY and then throw that value away, so
 * `MyStore` passes validation and whatever the caller happens to persist is
 * whatever it was handed. A mixed-case slug in the database is a silent
 * time-bomb: proxy.ts matches with STORE_SLUG_RE, which is lowercase-only, so
 * the referral lock is minted with no store attached and the guest is sent to
 * the house storefront instead of the agent whose code they scanned.
 *
 * Every creation and rename path must persist THIS value, not its own input.
 */
export function normalizeStoreSlug(slug: string | null | undefined): string | null {
  if (typeof slug !== 'string') return null;
  const s = slug.trim().toLowerCase();
  if (!STORE_SLUG_RE.test(s) || RESERVED_SEGMENTS.has(s)) return null;
  return s;
}

export function isReservedSegment(slug: string): boolean {
  return RESERVED_SEGMENTS.has((slug || '').toLowerCase());
}

/** True only when `slug` is both well-formed AND not an app route. */
export function isValidStoreSlug(slug: string | null | undefined): boolean {
  if (typeof slug !== 'string') return false;
  const s = slug.toLowerCase();
  return STORE_SLUG_RE.test(s) && !RESERVED_SEGMENTS.has(s);
}

/**
 * Validation for slug CREATION / RENAME endpoints. Returns a human-readable
 * error string, or null when the slug is acceptable.
 */
export function validateStoreSlug(slug: string | null | undefined): string | null {
  if (typeof slug !== 'string' || !slug.trim()) return 'Storefront URL Is Required.';
  const s = slug.trim().toLowerCase();
  if (s.length < 2) return 'Storefront URL Must Be At Least 2 Characters.';
  if (s.length > 50) return 'Storefront URL Must Be 50 Characters Or Fewer.';
  if (!STORE_SLUG_RE.test(s)) {
    return 'Storefront URL May Only Contain Lowercase Letters, Numbers, Hyphens And Underscores, And Must Start With A Letter Or Number.';
  }
  if (RESERVED_SEGMENTS.has(s)) return 'That Storefront URL Is Reserved By The Site.';
  return null;
}
