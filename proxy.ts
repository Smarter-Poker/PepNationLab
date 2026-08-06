import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { getSupabaseUrl } from '@/lib/supabase/url';
import { captureError } from '@/lib/sentry';
import { isEffectiveAdmin } from '@/lib/platform-admins';
import { DEFAULT_STORE_SLUG } from '@/lib/default-store';
// Slug shape + reserved app routes live in ONE module shared by the middleware,
// the creation endpoints and the client capture component. They used to be
// three separate regexes that disagreed, so a slug could be legal at creation,
// get a QR generated for it, and be permanently unroutable here.
import { STORE_SLUG_RE, RESERVED_SEGMENTS } from '@/lib/store-slug';
import {
  REF_LOCK_COOKIE,
  REF_DISPLAY_COOKIE,
  REF_LOCK_MAX_AGE,
  REF_CODE_RE,
  type RefLock,
  signRefLock,
  verifyRefLock,
} from '@/lib/ref-lock';

// --- Global API Rate Limiting ---
// Edge-level backstop against scrape bots and abuse across all ~80 /api/*
// endpoints. Individual hot routes keep their own tighter limits (register,
// orders, disclaimer-log, research search) -- this is the outer wall.
// Uses lib/rate-limit.ts: Upstash when UPSTASH_REDIS_REST_* is configured,
// otherwise per-instance in-memory sliding window (fails open, never locks
// out real users because of limiter infrastructure problems).
const RL_EXEMPT_PREFIXES = [
  '/api/cron/', // Vercel cron -- authenticated via CRON_SECRET inside each route
  '/api/messenger/cron/', // same
  '/api/webhooks/', // signed webhooks (EasyPost) -- verified in-route, may burst on retry
  '/api/health', // uptime probe
];

async function applyApiRateLimit(request: NextRequest, pathname: string): Promise<NextResponse | null> {
  if (!pathname.startsWith('/api/')) return null;
  if (RL_EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) return null;

  const ip = getClientIp(request);
  const result = await rateLimit({
    key: 'api_global',
    limit: 240,
    windowSeconds: 60,
    identifier: ip,
  });
  if (result.allowed) return null;

  const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { error: 'Too Many Requests' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': '240',
        'X-RateLimit-Remaining': '0',
      },
    },
  );
}

// --- REFERRAL RESOLUTION HELPERS ---
// Escape Postgres LIKE/ILIKE metacharacters so a referral code is matched
// LITERALLY. Without this `_` and `%` inside a user-supplied code act as
// wildcards against every username/referral_code in the table.
function likeEscape(v: string): string {
  return v.replace(/([%_\\])/g, '\\$1');
}

// Every middleware DB hop is on the critical path of a page render, is made
// with the service role, and is reachable by unauthenticated visitors. Bound
// it: hard timeout, non-2xx -> null (caller falls back to "no lock"), and
// never let a fetch rejection escape into the request.
const REF_FETCH_TIMEOUT_MS = 2500;
async function fetchJson(url: string, headers: Record<string, string>): Promise<unknown[] | null> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(REF_FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    const body = await res.json();
    return Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

// --- QR REFERRAL LOCK ---
// Resolve a scanned referral code (?ref=<code>) to the referring agent and
// their storefront slug, using the service-role REST API (middleware has no
// RLS session). Called at most once per visitor: only when ?ref= is present
// and no valid lock cookie exists yet (first scan wins).
async function resolveRefCode(code: string): Promise<RefLock | null> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  const base = getSupabaseUrl();
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  // LIKE-wildcard escape is MANDATORY. REF_CODE_RE permits `_`, which ilike
  // treats as a single-character wildcard, so an unescaped code turns the
  // lookup into a pattern match: `?ref=____l` would resolve to an arbitrary
  // agent (enumeration oracle + traffic-hijack vector), and any legitimate
  // code containing `_` would resolve nondeterministically. encodeURIComponent
  // alone does NOT neutralise `_`/`%` — they must be backslash-escaped first.
  const q = encodeURIComponent(likeEscape(code));
  const pRes = await fetchJson(
    `${base}/rest/v1/profiles?select=id,role,is_sub_agent,parent_agent_id,referring_agent_id,is_active,deleted_at&or=(username.ilike.${q},referral_code.ilike.${q})&is_active=is.true&deleted_at=is.null&order=username.asc,id.asc&limit=1`,
    headers,
  );
  if (!pRes) return null;
  const [p] = pRes as Array<{
    id: string; role: string | null; is_sub_agent: boolean | null;
    parent_agent_id: string | null; referring_agent_id: string | null;
    is_active: boolean | null; deleted_at: string | null;
  }>;
  if (!p || p.is_active === false || p.deleted_at != null) return null;

  // Whose storefront should this scan lock guests to?
  //   sub-agent code   -> the parent agent's store (sub still gets credit via sa)
  //   agent/super/admin -> their own store
  //   researcher code   -> the store they themselves belong to
  const storeOwnerId = p.is_sub_agent && p.parent_agent_id
    ? p.parent_agent_id
    : (p.role === 'agent' || p.role === 'super_agent' || p.role === 'admin')
      ? p.id
      : p.referring_agent_id;

  let slug: string | null = null;
  if (storeOwnerId) {
    const sRes = await fetchJson(
      `${base}/rest/v1/agent_profiles?select=slug&id=eq.${encodeURIComponent(storeOwnerId)}&is_active=is.true&limit=1`,
      headers,
    );
    if (sRes) {
      const [s] = sRes as Array<{ slug: string | null }>;
      slug = s?.slug ?? null;
    }
  }

  // A slug the middleware cannot route is worse than no slug: it would send the
  // guest to a URL this very function's caller bounces back, forever. Drop it
  // and let the house-store browsing fallback take over.
  if (slug && !(STORE_SLUG_RE.test(slug) && !RESERVED_SEGMENTS.has(slug))) slug = null;

  return {
    c: code,
    a: storeOwnerId ?? p.id,
    s: slug,
    sa: p.is_sub_agent && p.parent_agent_id ? p.id : null,
    t: Date.now(),
    // Explicit HARD kind. Legacy locks omit `k` and are treated as hard too,
    // but stamping it removes the ambiguity for anything reading the payload.
    k: 'qr',
  };
}

// --- DIRECT STOREFRONT URL ENTRY ---
// A logged-out visitor who types (or follows a plain link to)
// pepnationlab.com/<agent-slug> should get exactly what a QR scan gives them:
// guest browsing confined to that store, and signup credit locked to its
// owner. Resolve the slug to its storefront owner and mint a SOFT lock.
//
// The lock's `c` is the owner's own referral code / username -- NOT the slug.
// Slugs and referral codes are separate namespaces (the store `scooters` is
// owned by username `adam`, while a *different* agent owns the store `adam`),
// so feeding a slug into the code namespace credits the wrong agent.
async function resolveStoreSlug(slug: string): Promise<RefLock | null> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  const base = getSupabaseUrl();
  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  const aRes = await fetchJson(
    `${base}/rest/v1/agent_profiles?select=id,slug&slug=eq.${encodeURIComponent(slug)}&is_active=is.true&limit=1`,
    headers,
  );
  if (!aRes) return null;
  const [store] = aRes as Array<{ id: string | null; slug: string | null }>;
  if (!store?.id || !store.slug) return null;

  const pRes = await fetchJson(
    `${base}/rest/v1/profiles?select=id,username,referral_code,is_active,deleted_at&id=eq.${encodeURIComponent(store.id)}&is_active=is.true&deleted_at=is.null&limit=1`,
    headers,
  );
  if (!pRes) return null;
  const [owner] = pRes as Array<{
    id: string; username: string | null; referral_code: string | null;
    is_active: boolean | null; deleted_at: string | null;
  }>;
  if (!owner || owner.is_active === false || owner.deleted_at != null) return null;

  // Credit code must live in the profiles username/referral_code namespace and
  // must satisfy REF_CODE_RE, or verifyRefLock would reject the cookie we mint.
  const code = [owner.referral_code, owner.username].find(
    (v): v is string => typeof v === 'string' && REF_CODE_RE.test(v),
  );
  if (!code) return null;

  return { c: code, a: owner.id, s: store.slug, sa: null, t: Date.now(), k: 'url' };
}

// --- ACCESS MODEL: BROWSE FREELY, COMMIT WITH AN ACCOUNT ---
// This block used to say "nothing is browsable without an account." That is no
// longer true and had not been for some time; leaving it stood as an invitation
// to reintroduce the exact login wall the guest-storefront rule forbids.
//
// The rule, stated once, here:
//   A visitor who scans an agent's QR code, follows an agent link, or types a
//   storefront URL DIRECTLY MUST land on that storefront (or the landing page)
//   and MUST be able to browse it, see pricing and read product detail without
//   ever being told to create an account first.
//
// So the public surface is: the landing page, every agent storefront (for a
// visitor holding a referral lock -- and a direct storefront URL mints one, see
// the storefront-URL capture in the handler), the public SEO trees /peptides
// and /research, COA lookup, the logged-out auth pages, the legal pages, and
// non-user infra callers (external webhooks, scheduled crons, uptime/health,
// PWA assets).
//
// The ACCOUNT ASK happens at COMMITMENT, not at entry: checking out, saving to
// an account, subscribing to a stock alert. Those are enforced in the UI as
// signup checkpoints (components/GuestAuthModal.tsx) and, for the routes that
// touch real user data, by the deny-by-default gate below. A guest is still
// CONFINED to their locked storefront -- everything outside it redirects back
// into it rather than to /login.

// Routes that are always public (no auth required)
const PUBLIC_ROUTES = [
  // Public landing page — always accessible to unauthenticated visitors.
  // Without this, pepnationlab.com redirects every guest to /login instead
  // of showing the landing artwork.
  '/',
  // Account creation + sign-in (logged-out pages)
  '/login',
  '/signup',
  '/forgot-password',
  '/auth/callback',
  '/invite',                    // invite acceptance -> creates an account
  '/account/change-password',   // forced password-reset page
  // Legal / compliance pages linked from the signup acknowledgements
  '/terms',
  '/privacy',
  '/compliance',
  '/disclaimer',
  // Public Certificate-of-Analysis verification (lot-number lookup).
  // Indexable trust surface linked from vial lot numbers, the footer and
  // the sitemap; renders via service client from public COA data (no PII).
  '/coa',
  // --- PUBLIC SEO SURFACE ---
  // sitemap.xml advertises 3,184 URLs, 2,795 of them under /peptides. Every
  // one of those was answering 307 -> /login for logged-out visitors, which
  // means Googlebot saw a login wall on the entire indexable surface and a
  // human following a city or research link was told to create an account
  // before reading anything. Both trees are service-rendered public content
  // with no per-user data, EXCEPT the three personal /research pages listed
  // in GATED_SUBROUTES below, which stay behind auth.
  '/peptides',
  '/research',
  // Auth + signup APIs (called while logged out)
  '/api/auth/resolve',
  '/api/auth/signout',
  '/api/auth/change-password',
  '/api/auth/request-code',
  '/api/auth/reset-password',
  '/api/auth/verify-agent-access',
  '/api/auth/events',               // login security-event logging (logged out)
  '/api/availability',              // signup username / slug availability check
  '/api/storefront/register',       // creates the account
  '/api/disclaimer-log',            // registration disclaimer log
  '/api/agent-invitations/redeem',  // invite acceptance
  // External / infra callers that are not user sessions
  '/api/webhooks',            // signed external webhooks (verified in-route)
  '/api/unsubscribe',         // CAN-SPAM one-click unsubscribe (token-gated)
  '/api/seo/indexnow',        // daily cron trigger (CRON_SECRET in-route)
  '/api/social/ingest',       // GitHub Actions batch enqueue (CRON_SECRET in-route)
  '/api/health',
  '/api/status',
  // Web-push infrastructure reachable without a session:
  //  - vapid-public-key hands out the (public, opaque) application server key;
  //    the route itself is documented as public but was 401ing for logged-out
  //    callers because it was never listed here.
  //  - receipt is the service worker's proof-of-display beacon. Push events
  //    fire (and must confirm display) even when the site's auth cookies have
  //    expired on that device. The route only bumps a timestamp on an exact
  //    match of an unguessable high-entropy endpoint and is rate-limited.
  '/api/push/vapid-public-key',
  '/api/push/receipt',
  // Public storefront read-data endpoints (service-client, no user PII).
  // The storefront PAGES are gated, so guests still cannot browse the UI --
  // these keep logged-in shopping (catalog grid, search, recommendations)
  // and the research article iframe proxy working. They are fetched with
  // credentials:'omit' and are edge-cacheable public product data.
  '/api/storefront/catalog',
  '/api/storefront/semantic',
  '/api/storefront/recommendations',
  '/api/storefront/search',
  '/api/proxy',
  // PWA / static infra
  '/manifest.webmanifest',
  '/sw.js',
  '/sitemap.xml',
  // NOTE: /api/cron/* and /api/messenger/cron/* are exempted by prefix in the
  // handler below (CRON_SECRET enforced in each route), so they are not listed.
];

// PUBLIC_ROUTES matches by PREFIX, so listing '/research' would otherwise hand
// out the per-user pages that live underneath it. These are carved back out.
// Keep this list in sync with any new personal page added under a public tree:
// a miss here leaks one user's saved items to every logged-out visitor.
// Logged-out entry points that ask the visitor to make an account. Reached
// WITH a ?ref= code they are stale QR targets and get rerouted to the store
// (see the block in the handler); reached without one they are ordinary pages.
const ACCOUNT_ENTRY_PREFIXES = ['/signup', '/register', '/login', '/join', '/create-account'];

const GATED_SUBROUTES = [
  '/research/saved',
  '/research/reading-queue',
  '/research/subscriptions',
];

// STORE_SLUG_RE demands two or more characters, which is correct for slug
// CREATION but wrong as the logged-out fallback test further down: a ONE
// character first segment (/r/savagebrands, /q/<code>, a bare /r -- the shapes
// short and legacy QR links use) is not slug-shaped, so it escaped the "send
// them to the landing page" branch and fell straight through to /login. Same
// character class, one character shorter.
const GUEST_FALLBACK_SEGMENT_RE = /^[a-z0-9][a-z0-9_-]{0,49}$/;

// Per-IP, per-minute budget for the two unauthenticated service-role lookups a
// logged-out visitor can trigger: resolveRefCode() for ?ref=<code> and
// resolveStoreSlug() for a bare /<slug>.
//
// This was 20, which is roughly one busy minute for a SINGLE person and was
// never a per-person budget in the first place: getClientIp() returns the
// carrier's or the office's egress address, so an entire mobile NAT gateway
// shares one bucket. Measured against production, the 21st distinct storefront
// resolution inside a minute -- from any phone on that gateway -- failed, and
// the failure was silently read downstream as "that slug does not exist."
//
// A real scanner costs exactly ONE token: the resolution mints pnl_ref_lock and
// every later page view short-circuits on the cookie. So the honest question is
// how many DISTINCT first-time visitors may share one egress IP in one minute,
// and for a carrier gateway or an event hotspot 20 is far too low while a few
// hundred still shuts down enumeration (the whole slug namespace is ~60 rows;
// an attacker willing to spend an hour walks it at any cap, which is why the
// real defence is that the endpoint leaks nothing but "this store exists").
// Overridable without a deploy so the cap can be tuned against real traffic.
const REF_RESOLVE_LIMIT = Number(process.env.REF_RESOLVE_LIMIT) || 120;

function isGatedSubroute(pathname: string): boolean {
  return GATED_SUBROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'));
}

export default async function proxy(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request });
  }

  const pathname = request.nextUrl.pathname;

  // Global API rate limit -- runs before auth so bots can't even burn a
  // Supabase auth.getUser() round trip per request.
  const limited = await applyApiRateLimit(request, pathname);
  if (limited) return limited;

  // --- QR referral capture (first scan wins) ---
  // A visit carrying ?ref=<code> (agent QR) locks this browser to that
  // referrer: signed httpOnly cookie for the server, plus a client-readable
  // display cookie so the signup form can show who referred them.
  let refLock: RefLock | null = null;
  let refCookiesToSet: { lock: string; code: string } | null = null;
  let clearRefCookies = false;
  // Set when the ref_resolve limiter DENIES a lookup, as opposed to the lookup
  // running and finding nothing. The two are indistinguishable downstream --
  // both leave `store`/`resolved` null -- and conflating them is what turned a
  // perfectly live storefront into a bounce: past the cap, /savagebrands looked
  // exactly like a dead slug and got sent to the landing page (and, before the
  // landing-page fallback existed, to /login -- the reported "white page, then
  // the login screen" scan). A throttled request must degrade attribution, not
  // routing, so this flag suppresses every "this slug must not exist" branch.
  let refResolveThrottled = false;
  if (request.method === 'GET' && !pathname.startsWith('/api/')) {
    refLock = await verifyRefLock(request.cookies.get(REF_LOCK_COOKIE)?.value);
    const refParam = request.nextUrl.searchParams.get('ref')?.trim();
    // First scan wins for HARD (QR) locks. A SOFT lock -- one minted merely
    // because the visitor typed a storefront URL -- yields to a real QR scan,
    // so an incidental visit can never rob an agent of their scan credit.
    if ((!refLock || refLock.k === 'url') && refParam && REF_CODE_RE.test(refParam)) {
      try {
        // Referral resolution is an unauthenticated, service-role DB hop.
        // Cap it per IP so ?ref= cannot be used as a free enumeration or
        // amplification channel. Real scanners resolve once and are then
        // served from the cookie.
        //
        // The cap is REF_RESOLVE_LIMIT, not 20. getClientIp() sees the carrier
        // or corporate egress address, not a person: every phone behind one
        // mobile NAT gateway, and every employee in one office, shares a single
        // budget. At 20/min a few dozen simultaneous first-time scanners --
        // one table at a trade show -- exhausted it for everyone on that
        // gateway, and the overflow got bounced off the storefront they had
        // just scanned. See REF_RESOLVE_LIMIT for the sizing argument.
        const rl = await rateLimit({
          key: 'ref_resolve', limit: REF_RESOLVE_LIMIT, windowSeconds: 60, identifier: getClientIp(request),
        });
        if (!rl.allowed) refResolveThrottled = true;
        const resolved = rl.allowed ? await resolveRefCode(refParam) : null;
        if (resolved) {
          // signRefLock returns null when no server-side signing secret is
          // configured. Writing the cookie anyway would persist an unsigned
          // value that verifyRefLock rejects on the very next request, so the
          // guest would be silently re-resolved on every page view. Skip it.
          const signed = await signRefLock(resolved);
          if (signed) {
            refLock = resolved;
            refCookiesToSet = { lock: signed, code: resolved.c };
          }
        }
      } catch (err) {
        captureError(err, { context: 'proxy.refCapture', path: pathname });
      }
    }
  }
  const withRefCookies = <T extends NextResponse>(res: T): T => {
    if (clearRefCookies) {
      // maxAge 0 with the SAME path/secure/sameSite attributes the cookie was
      // written with -- anything else leaves the original cookie in place.
      res.cookies.set(REF_LOCK_COOKIE, '', {
        httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0,
      });
      res.cookies.set(REF_DISPLAY_COOKIE, '', {
        httpOnly: false, secure: true, sameSite: 'lax', path: '/', maxAge: 0,
      });
      return res;
    }
    if (refCookiesToSet) {
      res.cookies.set(REF_LOCK_COOKIE, refCookiesToSet.lock, {
        httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: REF_LOCK_MAX_AGE,
      });
      res.cookies.set(REF_DISPLAY_COOKIE, refCookiesToSet.code, {
        httpOnly: false, secure: true, sameSite: 'lax', path: '/', maxAge: REF_LOCK_MAX_AGE,
      });
    }
    return res;
  };

  // --- A REFERRAL LINK MUST NEVER OPEN AN ACCOUNT-CREATION SCREEN ---
  // QR codes printed, saved to camera rolls or pasted into chats BEFORE the
  // storefront-first change still encode the old account-first targets:
  // /signup?ref=<code>, /register?ref=<code>, /join?ref=<code>. Every one of
  // those paths is in PUBLIC_ROUTES, so it renders normally and the scanner is
  // met with "create an account" before seeing a single product or price --
  // the exact thing the storefront-first rule forbids, and the symptom
  // reported from a real-world scan.
  //
  // The trigger is the ?ref= QUERY PARAMETER, never the lock cookie. In-app
  // "Sign In" / "Create Account" links carry no ?ref=, so a guest already
  // browsing a locked store can still reach /login and /signup deliberately.
  // Only a referral ENTRY POINT is rerouted. /invite/* is deliberately absent:
  // an invitation is an account-creation link somebody was sent on purpose.
  //
  // Placement: after the ?ref= capture above (so the lock is minted and both
  // cookies ride along on this redirect) and before the /register 308 and the
  // PUBLIC_ROUTES early return, either of which would otherwise win.
  //
  // EXEMPTION -- an in-app click is not a referral entry point. The comment
  // above assumed no in-app link carries ?ref=; app/HomeClient.tsx did exactly
  // that, sending a locked guest's "Create Account" button to
  // /signup?ref=<code>, which this block then bounced straight back to the
  // storefront. A locked guest could therefore never reach the sign-up form
  // from the landing page -- a hole opened by this very block.
  //
  // Sec-Fetch-Site tells the two apart with no guessing: a camera app opening
  // a scanned URL sends `none` (or omits the header entirely), a foreign page
  // linking in sends `cross-site`, and a click or router.push() from one of
  // our own pages sends `same-origin`. Only the first two are entry points.
  // Header absent -> not exempt, i.e. the safe pre-existing behaviour, so an
  // old browser still gets the storefront rather than an account wall.
  //
  // HomeClient.tsx separately no longer appends ?ref= at all (attribution
  // rides the httpOnly pnl_ref_lock cookie, which is what the register route
  // actually trusts); this exemption is the general guard so the next in-app
  // link that carries a ref does not silently reopen the same hole.
  const isSameOriginNav = request.headers.get('sec-fetch-site') === 'same-origin';
  if (
    request.method === 'GET' &&
    !isSameOriginNav &&
    request.nextUrl.searchParams.has('ref') &&
    ACCOUNT_ENTRY_PREFIXES.some((r) => pathname === r || pathname.startsWith(r + '/'))
  ) {
    const lockedSlug =
      refLock?.s && STORE_SLUG_RE.test(refLock.s) && !RESERVED_SEGMENTS.has(refLock.s)
        ? refLock.s
        : null;
    const url = request.nextUrl.clone();
    // No resolvable storefront (researcher code, deactivated store, unknown
    // code) still beats an account wall: the landing page is a sanctioned QR
    // landing target and offers "Continue As Guest".
    url.pathname = lockedSlug ? `/${lockedSlug}` : '/';
    url.search = '';
    return withRefCookies(NextResponse.redirect(url));
  }

  if (pathname.startsWith('/register')) {
    const url = request.nextUrl.clone();
    url.pathname = '/signup';
    url.search = '';
    // 308 Permanent: /register is permanently retired; consolidate crawl and
    // link equity on /signup (matches the 308 host redirects in next.config).
    // withRefCookies: a QR whose target is /register?ref=<code> must still
    // persist the lock across the redirect, or the scan credit is lost.
    return withRefCookies(NextResponse.redirect(url, 308));
  }

  // --- A REFERRAL LINK LANDS ON THE STORE, NOT THE SIGN-UP SCREEN ---
  // Scanning an agent's QR code must open that agent's storefront so the
  // visitor can browse products and see pricing immediately. The landing page
  // leads with LOG IN / CREATE ACCOUNT, so routing a scan there reads as
  // "make an account before you may look at anything" -- the exact opposite of
  // what a referral QR is for.
  //
  // app/api/agent/my-qr now encodes `/<slug>?ref=<code>` directly, but QR codes
  // already printed, saved to camera rolls or shared in chats still carry the
  // old `/?ref=<code>` target and must keep working. This also covers repeat
  // scans: first-scan-wins means no new cookie is minted on those requests, so
  // the store has to be resolved from the existing lock instead.
  //
  // Placement matters: after the /register 308 (explicit sign-up intent is
  // honoured) and before the PUBLIC_ROUTES check (which returns early for '/').
  // NextResponse.redirect is used directly because `response` and
  // redirectWithCookies are not in scope until after the Supabase client is
  // built -- there is no session to preserve here anyway.
  if (
    request.method === 'GET' &&
    pathname === '/' &&
    request.nextUrl.searchParams.has('ref') &&
    refLock?.s &&
    STORE_SLUG_RE.test(refLock.s) &&
    !RESERVED_SEGMENTS.has(refLock.s)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/${refLock.s}`;
    url.search = '';
    return withRefCookies(NextResponse.redirect(url));
  }

  // Scheduled jobs (Vercel Cron + GitHub Actions) hit /api/cron/* and
  // /api/messenger/cron/* with only an `Authorization: Bearer CRON_SECRET`
  // header and never a Supabase session cookie. Every such route enforces
  // CRON_SECRET in-handler via lib/cron.ts assertCronAuth (fail-closed), so
  // exempt the whole prefix from middleware auth here. Listing paths one by
  // one previously left new crons to 401 the moment they were scheduled.
  if (pathname.startsWith('/api/cron/') || pathname.startsWith('/api/messenger/cron/')) {
    return NextResponse.next({ request });
  }

  const isLoginRoute = pathname === '/login';
  if (
    !isLoginRoute &&
    !isGatedSubroute(pathname) &&
    PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))
  ) {
    return withRefCookies(NextResponse.next({ request }));
  }

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|gif|css|js|map|txt)$/)
  ) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    getSupabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set({ name, value, ...options });
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({ name, value, ...options });
          });
        },
      },
    },
  );
  let user = null;
  let authBackendDown = false;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
  } catch (err) {
    // Supabase auth outage / network blip. This is NOT the same as "no
    // session": treating it as logged-out silently 401s every user site-wide
    // and looks like a mass logout instead of a backend incident.
    authBackendDown = true;
    console.error('[proxy] AUTH_BACKEND_ERROR - auth.getUser() threw:', err);
    captureError(err, { context: 'proxy.getUser', path: pathname });
  }

  // --- STALE LOCK CLEANUP ---
  // The referral lock is a LOGGED-OUT concept: it confines guest browsing and
  // it decides who gets credited at signup. Once the visitor has an account,
  // attribution is settled in profiles.referring_agent_id and the cookie is
  // pure liability -- it survives logout on a shared device, so the NEXT
  // person to sign up on that browser gets credited to whatever store the
  // previous user happened to scan months ago. Expire it on the first
  // authenticated, gated request.
  //
  // Signup attribution is unaffected: /auth/callback and
  // /api/storefront/register are PUBLIC_ROUTES and return above, before
  // getUser() ever runs, so they still read the lock they need.
  if (user && !authBackendDown) {
    refLock = null;
    refCookiesToSet = null;
    if (request.cookies.has(REF_LOCK_COOKIE) || request.cookies.has(REF_DISPLAY_COOKIE)) {
      clearRefCookies = true;
      response.cookies.set(REF_LOCK_COOKIE, '', {
        httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0,
      });
      response.cookies.set(REF_DISPLAY_COOKIE, '', {
        httpOnly: false, secure: true, sameSite: 'lax', path: '/', maxAge: 0,
      });
    }
  }

  const redirectWithCookies = (url: URL) => {
    const redirectResponse = NextResponse.redirect(url);
    // Copy the FULL cookie descriptor, not just name/value. Dropping the
    // options downgraded refreshed Supabase session cookies to host-only,
    // non-httpOnly, non-secure, session-lifetime cookies on every gated
    // redirect - readable by page scripts and silently expiring at browser
    // close.
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  };

  if (authBackendDown) {
    // Fail loudly and honestly: 503 (retryable) instead of a misleading 401
    // or a redirect that wipes in-progress client state (e.g. checkout).
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Authentication Service Temporarily Unavailable. Please Try Again In A Moment.' },
        { status: 503, headers: { 'Retry-After': '10' } },
      );
    }
    return new NextResponse(
      '<!DOCTYPE html><html><head><title>Temporarily Unavailable</title><meta http-equiv="refresh" content="8"></head>'
      + '<body style="background:#050A0F;color:#D0DAE4;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center">'
      + '<div><h1 style="color:#00C4BC">One Moment</h1><p>We Are Having Trouble Reaching The Sign-In Service.<br>This Page Will Retry Automatically.</p></div></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html', 'Retry-After': '10' } },
    );
  }

  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (pathname === '/login') {
      return withRefCookies(response);
    }
    // Direct storefront URL entry, e.g. someone types pepnationlab.com/
    // savagebrands with no account and no QR. Mint a SOFT lock for that store
    // and RENDER IT. This used to 307 to /?agent=<slug>, which put the landing
    // page's LOG IN / CREATE ACCOUNT buttons between the visitor and the
    // products they followed a link to see. A storefront link must open the
    // storefront; the guest confinement gate below still keeps them inside it.
    //
    // Skipped when a HARD (QR) lock is already held, when a ?ref= capture just
    // fired on this same request, and when the current lock already points at
    // this slug — that last guard hands the request to the browsing gate below,
    // which is what actually serves repeat views of the locked store.
    if (!refCookiesToSet && (!refLock || refLock.k === 'url')) {
      const rawSeg = pathname.split('/')[1] ?? '';
      const seg = rawSeg.toLowerCase();
      if (seg && seg !== refLock?.s && STORE_SLUG_RE.test(seg) && !RESERVED_SEGMENTS.has(seg)) {
        try {
          // Same amplification guard as the ?ref= path above, same budget.
          const rl = await rateLimit({
            key: 'ref_resolve', limit: REF_RESOLVE_LIMIT, windowSeconds: 60, identifier: getClientIp(request),
          });
          if (!rl.allowed) refResolveThrottled = true;
          const store = rl.allowed ? await resolveStoreSlug(seg) : null;
          // Throttled, not missing. Render the path as-is and let the page
          // decide: a real storefront draws normally (attribution falls back to
          // the client-side <AgentLinkCapture> on the page, exactly as it does
          // when REF_LOCK_SECRET is unset) and a genuinely bogus slug reaches
          // its own notFound(). Both beat bouncing a paying visitor off a store
          // that exists because somebody else on their carrier's NAT scanned a
          // code in the same minute.
          if (!store && refResolveThrottled) {
            return withRefCookies(response);
          }
          if (store) {
            const signed = await signRefLock(store);
            if (signed) {
              refLock = store;
              refCookiesToSet = { lock: signed, code: store.c };
            }
            // Render the store even when signing failed (no REF_LOCK_SECRET):
            // attribution then degrades to the client-side <AgentLinkCapture>
            // on the storefront, which is a far better outcome than turning a
            // storefront link into a login wall.
            const canonical = store.s ?? seg;
            if (rawSeg !== canonical) {
              // Case-mismatched entry (/SavageBrands). The page's
              // .eq('slug', agentSlug) lookup is case-sensitive and would
              // notFound(), so send them to the canonical lowercase URL once.
              const url = request.nextUrl.clone();
              url.pathname = `/${canonical}`;
              url.search = '';
              return withRefCookies(redirectWithCookies(url));
            }
            return withRefCookies(response);
          }
        } catch (err) {
          captureError(err, { context: 'proxy.storeUrlCapture', path: pathname });
        }
      }
    }
    // QR-locked guest browsing: a visitor who arrived via an agent's referral
    // QR may browse THAT agent's storefront without an account — and nothing
    // else. Any other page bounces them back into their locked storefront.
    // Guests with no lock keep the original behavior: sign in required.
    //
    // A lock with NO storefront slug is a real, common case: the referrer is a
    // researcher, or an agent whose agent_profiles row is inactive/missing, so
    // resolveRefCode legitimately returns s:null. Sending those scanners to
    // /login threw away a valid scan — the attribution cookie is set and the
    // credit is real, they just have nowhere to browse. Fall back to the house
    // store so "Continue As Guest" works for every lock we ever mint.
    const browseSlug = refLock ? (refLock.s ?? DEFAULT_STORE_SLUG) : null;
    if (browseSlug) {
      if (pathname === `/${browseSlug}` || pathname.startsWith(`/${browseSlug}/`)) {
        return withRefCookies(response);
      }
      const url = request.nextUrl.clone();
      url.pathname = `/${browseSlug}`;
      url.search = '';
      return withRefCookies(redirectWithCookies(url));
    }

    // --- A DEAD STOREFRONT URL IS NOT A REASON TO DEMAND AN ACCOUNT ---
    // The visitor asked for a single-segment path that LOOKS like a store but
    // did not resolve above: a typo (`/savagebrand`), a slug that has since
    // been renamed while printed QR codes still point at the old one, a
    // deactivated storefront, or an agent whose account was closed.
    //
    // Falling through to /login turned every one of those into "sign in or
    // create an account" — the precise thing the guest-storefront rule
    // forbids, aimed at exactly the people least willing to tolerate it
    // (someone who just scanned a code and has seen nothing of the store).
    // Send them to the landing page instead, which is a sanctioned QR landing
    // target and offers "Continue As Guest".
    //
    // This cannot swallow a gated page. RESERVED_SEGMENTS is the set of
    // first-segment app routes — /admin, /dashboard, /checkout, /wallet,
    // /orders, /messages and the rest are all in it and still get /login with
    // their `redirect` parameter. That completeness is already load-bearing:
    // slug CREATION rejects the same set, so a missing entry would let an
    // agent claim a slug that shadows a real route — a strictly worse bug than
    // a lost `redirect` param.
    //
    // The test is on the FIRST segment only. It used to require the path to be
    // exactly one segment, which meant any deeper URL a guest could plausibly
    // land on -- a storefront product page from a shared link
    // (/savagebrands/products/bpc-157), a renamed store's old deep link -- fell
    // straight through to /login. Same failure mode, one path segment further
    // in.
    //
    // Suppressed entirely when the resolver was throttled rather than run:
    // "did not resolve" would then be a statement about the limiter, not about
    // the slug, and bouncing on it is how a live store came to look dead.
    const firstSegment = pathname.split('/').filter(Boolean)[0]?.toLowerCase() ?? null;
    if (
      request.method === 'GET' &&
      !refResolveThrottled &&
      firstSegment &&
      GUEST_FALLBACK_SEGMENT_RE.test(firstSegment) &&
      !RESERVED_SEGMENTS.has(firstSegment)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.search = '';
      return withRefCookies(redirectWithCookies(url));
    }

    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname + request.nextUrl.search);
    return withRefCookies(redirectWithCookies(url));
  }

  let { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('is_active, deleted_at, role, must_change_password, disclaimer_v1_accepted, is_admin_account')
    .eq('id', user.id)
    .maybeSingle();

  if (profileErr) {
    // One retry for transient blips before deciding anything.
    const retry = await supabase
      .from('profiles')
      .select('is_active, deleted_at, role, must_change_password, disclaimer_v1_accepted, is_admin_account')
      .eq('id', user.id)
      .maybeSingle();
    profile = retry.data;
    profileErr = retry.error;
  }

  if (profileErr) {
    // The disabled-account (is_active) and forced-password-change gates
    // cannot be evaluated. Previously this failed OPEN (profile came back
    // null and every gate silently passed) -- a deactivated agent could keep
    // operating through any profiles-read blip. Fail CLOSED with a retryable
    // 503 and report the incident.
    captureError(profileErr, { context: 'proxy.profile', userId: user.id, path: pathname });
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Service Temporarily Unavailable. Please Try Again In A Moment.' },
        { status: 503, headers: { 'Retry-After': '10' } },
      );
    }
    return new NextResponse(
      '<!DOCTYPE html><html><head><title>Temporarily Unavailable</title><meta http-equiv="refresh" content="8"></head>'
      + '<body style="background:#050A0F;color:#D0DAE4;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center">'
      + '<div><h1 style="color:#00C4BC">One Moment</h1><p>We Are Having Trouble Loading Your Account.<br>This Page Will Retry Automatically.</p></div></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html', 'Retry-After': '10' } },
    );
  }

  if (profile && (profile.is_active === false || (profile as { deleted_at?: string | null }).deleted_at != null)) {
    await supabase.auth.signOut();
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Account disabled' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('error', 'account_disabled');
    return redirectWithCookies(url);
  }

  // Paths that must stay reachable while must_change_password is set:
  // /account/change-password is the standalone reset page, and
  // /api/agent/onboarding backs the /onboarding wizard, whose FIRST step is
  // the in-wizard password change. Without the API exemption a flagged agent
  // landing directly on /onboarding got a permanent "Could Not Load Your
  // Setup" dead end (the wizard's initial GET was 403'd before it could even
  // render the password step).
  const mustChangePasswordExempt =
    pathname === '/account/change-password' || pathname === '/api/agent/onboarding';
  if ((profile as { must_change_password?: boolean } | null)?.must_change_password === true && !mustChangePasswordExempt) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Must change password' }, { status: 403 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/account/change-password';
    url.search = '';
    return redirectWithCookies(url);
  }

  // Mandatory Research-Only acknowledgment gate. A first-time user -- or any
  // account created without the sign-up disclaimer (agent-created researchers,
  // OAuth sign-ups, legacy accounts) -- must accept the 3-box Research-Only
  // acknowledgment before reaching any authenticated surface. Mirrors the
  // must_change_password gate above. Exempt: the acceptance page + its API,
  // sign-out, the password-change gate, and the legal content pages linked
  // from within the acknowledgment.
  const disclaimerExempt =
    pathname === '/accept-disclaimer' ||
    pathname === '/api/disclaimer/accept' ||
    pathname === '/api/auth/signout' ||
    pathname === '/account/change-password' ||
    pathname === '/api/agent/onboarding' ||
    pathname === '/terms' ||
    pathname === '/privacy' ||
    pathname === '/compliance' ||
    pathname === '/disclaimer';
  if (
    (profile as { disclaimer_v1_accepted?: boolean } | null)?.disclaimer_v1_accepted !== true &&
    !disclaimerExempt
  ) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Research-Only acknowledgment required.' }, { status: 403 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/accept-disclaimer';
    url.searchParams.set('redirect', pathname + request.nextUrl.search);
    return redirectWithCookies(url);
  }

  if (pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = profile?.role === 'admin' ? '/admin' : '/dashboard';
    return redirectWithCookies(url);
  }

  // Admin PANEL access gate. MUST mirror app/admin/layout.tsx exactly, or this
  // edge check silently bounces an allowlisted admin to /dashboard before the
  // layout ever runs. Three independent pathways grant /admin:
  //   1. role === 'admin'          -- real platform admin
  //   2. id in PLATFORM_ADMIN_IDS  -- isEffectiveAdmin allowlist
  //   3. is_admin_account === true -- DB flag (e.g. Savage Brands, a
  //                                   super_agent with full admin parity)
  if (
    pathname.startsWith('/admin') &&
    !isEffectiveAdmin(user.id, profile?.role) &&
    (profile as { is_admin_account?: boolean } | null)?.is_admin_account !== true
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return redirectWithCookies(url);
  }

  // Mandatory 2FA enforcement is DISABLED per owner decision (2026-06-09).
  // Two-factor auth remains available for anyone who wants it via
  // /account/security, but no role is forced to enroll. To re-enable the hard
  // gate for a role, add it back to this set (e.g. new Set(['super_agent'])).
  const mfaRequiredRoles = new Set<string>();
  if (profile?.role && mfaRequiredRoles.has(profile.role)) {
    const isMfaExempt =
      pathname === '/' ||
      pathname === '/account/security' ||
      pathname.startsWith('/account/security/') ||
      pathname.startsWith('/api/auth/') ||
      pathname === '/api/health';

    if (!isMfaExempt) {
      const { data: aal } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const hasVerifiedFactor = aal?.currentLevel === 'aal2';

      if (!hasVerifiedFactor) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            { error: 'MFA enrollment required.' },
            { status: 403 }
          );
        }
        const url = request.nextUrl.clone();
        url.pathname = '/account/security';
        url.search = '?reason=mfa_required';
        return redirectWithCookies(url);
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo.*|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|css|js|map|txt)$).*)',
  ],
};
