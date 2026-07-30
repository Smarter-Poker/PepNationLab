import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { getSupabaseUrl } from '@/lib/supabase/url';
import { captureError } from '@/lib/sentry';
import { isEffectiveAdmin } from '@/lib/platform-admins';
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
  const q = encodeURIComponent(code);
  const pRes = await fetch(
    `${base}/rest/v1/profiles?select=id,role,is_sub_agent,parent_agent_id,referring_agent_id,is_active,deleted_at&or=(username.ilike.${q},referral_code.ilike.${q})&limit=1`,
    { headers },
  );
  if (!pRes.ok) return null;
  const [p] = (await pRes.json()) as Array<{
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
    const sRes = await fetch(
      `${base}/rest/v1/agent_profiles?select=slug&id=eq.${encodeURIComponent(storeOwnerId)}&limit=1`,
      { headers },
    );
    if (sRes.ok) {
      const [s] = (await sRes.json()) as Array<{ slug: string | null }>;
      slug = s?.slug ?? null;
    }
  }

  return {
    c: code,
    a: storeOwnerId ?? p.id,
    s: slug,
    sa: p.is_sub_agent && p.parent_agent_id ? p.id : null,
    t: Date.now(),
  };
}

// --- RESTRICTED ACCESS: ACCOUNT REQUIRED FOR EVERYTHING ---
// The guest view has been removed. Nothing is browsable without an account.
// Only the logged-out account-creation + sign-in flow, the legal pages linked
// from the signup acknowledgements, and non-user infra callers (external
// webhooks, scheduled crons, uptime/health, PWA assets) remain public. Every
// other route -- the landing page, agent storefronts, research, cart, and all
// marketing pages -- now requires authentication (redirects to /login).
// EXCEPTION: visitors holding a signed QR referral lock (see lib/ref-lock.ts)
// may browse the referring agent's storefront as a guest — nothing else.

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
  if (request.method === 'GET' && !pathname.startsWith('/api/')) {
    refLock = await verifyRefLock(request.cookies.get(REF_LOCK_COOKIE)?.value);
    const refParam = request.nextUrl.searchParams.get('ref')?.trim();
    if (!refLock && refParam && REF_CODE_RE.test(refParam)) {
      try {
        const resolved = await resolveRefCode(refParam);
        if (resolved) {
          refLock = resolved;
          refCookiesToSet = { lock: await signRefLock(resolved), code: resolved.c };
        }
      } catch (err) {
        captureError(err, { context: 'proxy.refCapture', path: pathname });
      }
    }
  }
  const withRefCookies = <T extends NextResponse>(res: T): T => {
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

  if (pathname.startsWith('/register')) {
    const url = request.nextUrl.clone();
    url.pathname = '/signup';
    url.search = '';
    // 308 Permanent: /register is permanently retired; consolidate crawl and
    // link equity on /signup (matches the 308 host redirects in next.config).
    return NextResponse.redirect(url, 308);
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
  if (!isLoginRoute && PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))) {
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

  const redirectWithCookies = (url: URL) => {
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
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
    // QR-locked guest browsing: a visitor who arrived via an agent's referral
    // QR may browse THAT agent's storefront without an account — and nothing
    // else. Any other page bounces them back into their locked storefront.
    // Guests with no lock keep the original behavior: sign in required.
    if (refLock?.s) {
      const slug = refLock.s;
      if (pathname === `/${slug}` || pathname.startsWith(`/${slug}/`)) {
        return withRefCookies(response);
      }
      const url = request.nextUrl.clone();
      url.pathname = `/${slug}`;
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
