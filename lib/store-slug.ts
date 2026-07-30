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
 * The shape the DATABASE will actually accept, which is NARROWER than
 * STORE_SLUG_RE.
 *
 * agent_profiles carries two overlapping CHECK constraints on `slug`:
 *
 *   agent_profiles_slug_shape  CHECK (slug ~ '^[a-z0-9][a-z0-9_-]{1,49}')  -- allows `_`
 *   slug_format (older, stale) CHECK (slug ~ '^[a-z0-9\-]+')                -- forbids `_`
 *
 * Postgres ANDs every CHECK on a column, so the effective rule is the
 * INTERSECTION of the two: no underscores. STORE_SLUG_RE stays permissive
 * because it is the READ/MATCH path -- proxy.ts uses it to recognise an
 * incoming `/<slug>` URL, and narrowing it would orphan any existing row that
 * somehow already contains an underscore. DB_SLUG_RE is the guard for anything
 * we are about to INSERT, so a slug derived from a username like `bob_smith`
 * fails at creation with a message that names the problem instead of blowing
 * up at the database with a generic SQLSTATE 23514 the user sees as
 * "an unexpected error".
 */
export const DB_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,49}$/;

/**
 * True when `slug` is a shape the database will actually store. Creation and
 * rename paths that build their own candidate (e.g. slugs derived from a
 * username) should test with THIS, not STORE_SLUG_RE.
 */
export function isDbSafeSlug(slug: string | null | undefined): boolean {
  if (typeof slug !== 'string') return false;
  return DB_SLUG_RE.test(slug.trim().toLowerCase());
}

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
 * PARTIALLY mirrored by the `agent_profiles_slug_not_reserved` database
 * trigger. NEITHER list is authoritative and neither contains the other -- the
 * DB list has 48 entries, this one has entries the DB lacks, and the DB has
 * entries this one lacks. Segments this app list covers that the DB trigger
 * does NOT: peptides, research, coa, wallet, invite, find-a-peptide,
 * peptide-101, lab-journal, lab-tools, messenger, onboarding, reset-password,
 * shelf-life, advertising, accept-disclaimer, account, test-card, monitoring.
 * For the segments that matter to ROUTING, this app-side list is the stricter
 * of the two, so it must never be weakened on the assumption that the trigger
 * will catch what slips through -- it will not. Both checks have to run: this
 * one at creation, the trigger as the backstop for any write path that bypasses
 * it. Keeping the two in sync is still the goal; until they are, treat the
 * union as the real reserved set.
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
  // DB_SLUG_RE, not STORE_SLUG_RE. This is the CREATION-time validator, and the
  // database refuses underscores (see DB_SLUG_RE for the
  // intersection-of-two-CHECK-constraints reasoning). Passing a slug that only
  // satisfies STORE_SLUG_RE green-lights an INSERT the database then rejects
  // with SQLSTATE 23514, which every caller surfaces as a generic "unexpected
  // error" with nothing pointing at the slug.
  if (!DB_SLUG_RE.test(s)) {
    if (s.includes('_')) {
      return 'Storefront URL Cannot Contain Underscores. Use A Hyphen Instead (For Example: bob-smith).';
    }
    return 'Storefront URL May Only Contain Lowercase Letters, Numbers And Hyphens, And Must Start With A Letter Or Number.';
  }
  if (RESERVED_SEGMENTS.has(s)) return 'That Storefront URL Is Reserved By The Site.';
  return null;
}
