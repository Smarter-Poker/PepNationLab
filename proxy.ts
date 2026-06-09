import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// --- SITE LOCKDOWN ---
// The site is locked. Only authenticated users may access any page.
// New account registration is disabled -- /register always redirects to /login.
// The only public route is /login itself (plus static assets handled by matcher).

// Routes that are always public (no auth required)
const PUBLIC_ROUTES = [
  '/login',
  '/forgot-password',
  '/become-agent',
  '/about',
  '/terms',
  '/privacy',
  '/compliance',
  '/disclaimer',
  '/account/change-password',
  '/api/auth/resolve',
  '/api/auth/signout',
  '/api/auth/change-password',
  '/api/auth/verify-agent-access',
  '/api/health',
  '/api/availability',
  '/api/disclaimer-log',
  '/api/storefront/register',
  '/api/storefront/search',
  '/api/storefront/recommendations',
  '/research',
  '/api/research/ask',
  '/api/research/cart-warnings',
  '/api/research/match',
  '/api/research/search',
  '/api/research/suggest',
  '/api/research/instant-answer',
  '/api/research/click',
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
  '/api/analytics/faq-click',
  '/invite',
  '/api/agent-invitations/redeem',
  '/api/cron/invoices',
  '/api/cron/reminders',
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
  '/api/cron/shippo-reconcile',
  '/api/messenger/cron',
  '/api/webhooks/shippo',
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
    '/checkout', '/messages', '/messenger', '/register', '/login', '/forgot-password',
    '/become-agent', '/about', '/terms', '/privacy', '/compliance',
    '/disclaimer', '/shipping', '/invite',
  ];
  if (protectedPrefixes.some(p => pathname.startsWith(p))) return false;
  const segments = pathname.split('/').filter(Boolean);
  return segments.length === 1 || segments.length === 2;
}

export default async function proxy(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request });
  }

  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith('/register')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  const isLoginRoute = pathname === '/login';
  if (!isLoginRoute && PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))) {
    return NextResponse.next({ request });
  }

  if (isPublicDynamicRoute(pathname)) {
    let storeResponse = NextResponse.next({ request });
    try {
      const storeSupabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
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
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
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

  if ((profile as { must_change_password?: boolean } | null)?.must_change_password === true && pathname !== '/account/change-password') {
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
    '/((?!_next/static|_next/image|favicon.ico|logo.*|.*\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|css|js|map)$).*)',
  ],
};
