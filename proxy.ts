import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { getSupabaseUrl } from '@/lib/supabase/url';

// ─── Global API Rate Limiting ────────────────────────────────────────────────
// Edge-level backstop against scrape bots and abuse across all ~80 /api/*
// endpoints. Individual hot routes keep their own tighter limits (register,
// orders, disclaimer-log, research search) — this is the outer wall.
// Uses lib/rate-limit.ts: Upstash when UPSTASH_REDIS_REST_* is configured,
// otherwise per-instance in-memory sliding window (fails open, never locks
// out real users because of limiter infrastructure problems).
const RL_EXEMPT_PREFIXES = [
  '/api/cron/', // Vercel cron — authenticated via CRON_SECRET inside each route
  '/api/messenger/cron/', // same
  '/api/webhooks/', // signed webhooks (EasyPost) — verified in-route, may burst on retry
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

// --- PUBLIC LANDING + HOUSE-STORE SIGNUP ---
// The landing page (/) is public. New accounts are created through /signup
// (or Google sign-in) and are always linked to the house storefront
// (see lib/default-store.ts). Legacy /register redirects to /signup.
// Guests may browse agent storefronts and research pages; everything else
// still requires authentication.

// Routes that are always public (no auth required)
const PUBLIC_ROUTES = [
  '/',
  '/signup',
  '/auth/callback',
  '/login',
  '/forgot-password',
  '/become-agent',
  '/about',
  '/contact',
  '/terms',
  '/privacy',
  '/compliance',
  '/disclaimer',
  // Public Certificate Of Analysis verification. A researcher holding a vial
  // must be able to check its lot number and view the certificate without an
  // account. Covers /coa, /coa?lot=..., and /coa/<lot>/certificate.
  '/coa',
  '/account/change-password',
  '/api/auth/resolve',
  '/api/auth/signout',
  '/api/auth/change-password',
  // Public signup email-verification code issuer (rate-limited inside the route).
  '/api/auth/request-code',
  // Public code-based password reset (both steps are for logged-out users;
  // each is rate-limited + CSRF-checked inside its route).
  '/api/auth/reset-password',
  '/api/auth/verify-agent-access',
  '/api/health',
  '/api/availability',
  '/api/disclaimer-log',
  '/api/storefront/register',
  '/api/storefront/search',
  '/api/storefront/recommendations',
  // Public-by-design storefront + social-proof endpoints. These are called
  // with credentials: 'omit' from guest-facing components (storefront grid
  // cache refresh, semantic search, GuestCTA member count) and were being
  // 401'd by this proxy before they could reach their own rate-limited,
  // service-client handlers.
  '/api/storefront/catalog',
  '/api/storefront/semantic',
  '/api/stats/member-count',
  // Guest cart endpoints. The global CartProvider runs on the guest
  // storefront and calls these; each is either a service-client price/data
  // lookup (refresh, recommendations, bac-water) or explicitly falls back to
  // the house 'researchstore' storefront for anonymous visitors
  // (resolve-name). Blocking them 401'd guest cart pricing/recs and made the
  // add-by-name button show a misleading "Unauthorized" error toast.
  // NOTE: /api/cart/sync is intentionally NOT here — it persists to the
  // user's profile and is user-only by design (its 401 is caught silently;
  // the guest cart still persists to localStorage).
  '/api/cart/refresh',
  '/api/cart/resolve-name',
  '/api/cart/recommendations',
  '/api/cart/bac-water',
  '/research',
  // Local SEO city landing pages — /peptides, /peptides/[state], AND
  // /peptides/[state]/[city]. The 3-segment city URLs are NOT covered by
  // isPublicDynamicRoute (it only allows 1-2 segments), so without this
  // prefix guests hitting a city landing page were bounced to /login.
  '/peptides',
  '/find-a-peptide',
  '/peptide-101',
  '/api/research/ask',
  '/api/research/cart-warnings',
  '/api/research/match',
  '/api/research/search',
  '/api/research/suggest',
  '/api/research/instant-answer',
  '/api/research/click',
  // Guest-safe research data endpoints. These are stateless (NLP) or read
  // public compound data with no per-user gating, and are called by
  // guest-facing surfaces: the storefront AI discovery hero + /research/match
  // (ai-match), the compare drawer + calculators (compounds-list), and the
  // /research/catalog browser (products). Previously 401'd before they ran,
  // silently breaking those headline guest features.
  '/api/research/ai-match',
  '/api/research/compounds-list',
  '/api/research/products',
  // Research Library v3 Wave 2 public API (bearer-token auth handled in route)
  '/api/research/public',
  // Research Library v3 Wave 2 embed widget (iframe-able knowledge card)
  '/api/research/widget',
  // Research Library v3 Wave 2 public API docs page
  '/research/api-docs',
  // /lab-tools redirects to /research/calculators (which is already public via /research prefix)
  '/lab-tools',
  // Allow proxy route for full-screen iframes
  '/api/proxy',
  // SEO surfaces
  '/sitemap.xml',
  '/feed.xml',
  // IndexNow submission trigger — hit by the daily cron (vercel.json); it only
  // submits our own canonical URLs to Bing/Yandex. Public so the cron reaches it.
  '/api/seo/indexnow',
  // AI/LLM discoverability — llms.txt and robots.ts advertise these
  // machine-readable markdown endpoints to anonymous crawlers (GPTBot,
  // ClaudeBot, PerplexityBot), so they must not require auth.
  '/llms.txt',
  '/llms-full.txt',
  '/api/llm',
  '/api/analytics/faq-click',
  '/invite',
  '/api/agent-invitations/redeem',
  '/api/cron/invoices',
  '/api/cron/reminders',
  // Daily auth flow canary — CRON_SECRET enforced in-route (lib/cron.ts).
  '/api/cron/auth-canary',
  // Social autoposter cron — CRON_SECRET enforced in-route; gated by SOCIAL_AUTOPOST_ENABLED.
  '/api/cron/social-autopost',
  // Generator -> queue batch enqueue, called by GitHub Actions with no user
  // session. CRON_SECRET is enforced inside the route (see app/api/social/ingest).
  // NOTE: this exact path only — /api/social/oauth/* stays admin-gated.
  '/api/social/ingest',
  '/api/cron/sms-dispatch',
  '/api/cron/abandoned-cart-recovery',
  '/api/cron/apply-price-changes',
  '/api/cron/subscriptions-process',
  '/api/cron/referrals-fulfil',
  '/api/cron/rma-stale',
  '/api/cron/push-dispatch',
  '/api/cron/recommendations-refresh',
  '/api/cron/webhooks-dispatch',
  '/api/cron/search-refresh',
  '/api/cron/pubmed-sync',
  '/api/cron/trials-sync',
  // Research Library v3 Wave 2 evidence-sync crons (CRON_SECRET enforced inside each route)
  '/api/cron/uniprot-sync',
  '/api/cron/chembl-sync',
  '/api/cron/fda-drugs-sync',
  '/api/cron/dailymed-sync',
  '/api/cron/patents-sync',
  '/api/cron/rxnorm-sync',
  '/api/cron/europepmc-sync',
  '/api/cron/biorxiv-watch',
  '/api/cron/retraction-watch',
  '/api/cron/companion-papers-compute',
  '/api/cron/broken-link-crawler',
  '/api/cron/label-jobs',
  '/api/cron/shipping-reconcile',
  '/api/cron/shipping-webhook-retry',
  '/api/messenger/cron',
  '/api/webhooks/easypost',
  '/manifest.webmanifest',
  '/sw.js',
  '/api/push/vapid-public-key',
  '/api/status',
  '/status',
  '/api/storefront/events',
  '/api/shipping/quote',
  '/api/shipping/validate-address',
  '/api/messenger/call-signal-unload-broadcast',
];

// Dynamic route check — agent storefronts are public
// e.g. /midway, /orlando-peps, etc. (but NOT /admin, /dashboard, /api, etc.)
// Also allows /[slug]/[productId] for storefront product detail pages.
function isPublicDynamicRoute(pathname: string): boolean {
  // Exclude known protected prefixes
  const protectedPrefixes = [
    '/admin', '/dashboard', '/api', '/orders', '/products', '/account',
    '/checkout', '/messages', '/messenger', '/register', '/signup', '/auth', '/login', '/forgot-password',
    '/become-agent', '/about', '/contact', '/terms', '/privacy', '/compliance',
    '/disclaimer', '/shipping', '/invite',
  ];
  if (protectedPrefixes.some(p => pathname.startsWith(p))) return false;
  const segments = pathname.split('/').filter(Boolean);
  return segments.length === 1 || segments.length === 2;
}

export default async function proxy(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request });
  }

  const pathname = request.nextUrl.pathname;

  // Global API rate limit — runs before auth so bots can't even burn a
  // Supabase auth.getUser() round trip per request.
  const limited = await applyApiRateLimit(request, pathname);
  if (limited) return limited;

  if (pathname.startsWith('/register')) {
    const url = request.nextUrl.clone();
    url.pathname = '/signup';
    url.search = '';
    return NextResponse.redirect(url);
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
    return NextResponse.next({ request });
  }

  if (isPublicDynamicRoute(pathname)) {
    let storeResponse = NextResponse.next({ request });
    try {
      const storeSupabase = createServerClient(
        getSupabaseUrl(),
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() { return request.cookies.getAll(); },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) => {
                request.cookies.set({ name, value, ...options });
              });
              storeResponse = NextResponse.next({ request });
              cookiesToSet.forEach(({ name, value, options }) => {
                storeResponse.cookies.set({ name, value, ...options });
              });
            },
          },
        },
      );
      await storeSupabase.auth.getUser();
    } catch { /* ignore — unauthenticated visitors are fine */ }
    return storeResponse;
  }

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|gif|css|js|woff|woff2|map)$/)
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
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
  } catch (err) {
    console.error('[proxy.ts] Failed to retrieve user session:', err);
  }

  const redirectWithCookies = (url: URL) => {
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  };

  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (pathname === '/login') {
      return response;
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname + request.nextUrl.search);
    return redirectWithCookies(url);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_active, role, must_change_password')
    .eq('id', user.id)
    .maybeSingle();

  if (profile && profile.is_active === false) {
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

  if (pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = profile?.role === 'admin' ? '/admin' : '/dashboard';
    return redirectWithCookies(url);
  }

  if (pathname.startsWith('/admin') && profile?.role !== 'admin') {
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
    '/((?!_next/static|_next/image|favicon.ico|logo.*|.*\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|css|js|map|txt)$).*)',
  ],
};
