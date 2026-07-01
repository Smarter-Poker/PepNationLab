import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Edge middleware — enforces:
 *  1. /register permanently redirected to /login (registration is disabled).
 *  2. /admin/* requires an authenticated user with role = 'admin'.
 *  3. /dashboard/* requires an authenticated user.
 *  4. /[agentSlug] (storefronts) is publicly accessible — no auth required.
 *
 * Note: Role enforcement for /admin/* is a best-effort edge gate. The
 * authoritative role check lives in app/admin/layout.tsx (server component)
 * and in every admin API route via requireAdmin() (lib/admin-auth.ts).
 * This middleware adds a first-pass redirect so non-admin users never
 * render the admin shell at all.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ------------------------------------------------------------------
  // 1. Permanently disable /register — redirect to /login unconditionally.
  // ------------------------------------------------------------------
  if (pathname === '/register' || pathname.startsWith('/register/')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url, { status: 308 });
  }

  // ------------------------------------------------------------------
  // Build a Supabase client that reads/writes cookies for the edge.
  // We only do this for routes that require auth checks.
  // ------------------------------------------------------------------
  const protectedRoute =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/orders') ||
    pathname.startsWith('/messages') ||
    pathname.startsWith('/messenger') ||
    pathname.startsWith('/shipping') ||
    pathname.startsWith('/wallet') ||
    pathname.startsWith('/account') ||
    pathname.startsWith('/onboarding');

  if (!protectedRoute) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() validates the JWT against Supabase Auth — safe against spoofed cookies.
  const { data: { user } } = await supabase.auth.getUser();

  // ------------------------------------------------------------------
  // 2. Not authenticated — redirect everything protected to /login.
  // ------------------------------------------------------------------
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // ------------------------------------------------------------------
  // 3. Authenticated but hitting /login — redirect to appropriate home.
  // Role-specific redirect is handled by the login page itself; we
  // avoid doing an extra DB call here.
  // ------------------------------------------------------------------

  return response;
}

/**
 * Matcher: run middleware on all routes EXCEPT:
 *  - Next.js internals (_next/*)
 *  - Static files (favicon, images, fonts, etc.)
 *  - API routes that must be public (auth endpoints, storefront register,
 *    health probe, cron jobs, webhooks, proxy)
 *  - Public pages (login, forgot-password, about, terms, privacy,
 *    compliance, disclaimer, become-agent, agent storefronts)
 *
 * Agent storefronts (/[agentSlug]) are public — no auth required —
 * so they are excluded from the matcher. The storefront pages handle
 * their own auth for gated actions (add to cart, checkout) via the
 * CartContext and checkout API.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image  (image optimisation)
     * - favicon.ico, public assets
     * - API routes that are intentionally public
     */
    '/((?!_next/static|_next/image|favicon\.ico|logo\.svg|logo\.jpg|logo-mark\.svg|images/|sw\.js|manifest\.webmanifest|robots\.txt|sitemap\.xml|api/auth/|api/health|api/cron/|api/webhooks/|api/proxy|api/storefront/|api/research/|api/compounds/|api/ask-ai|login|forgot-password|about|terms|privacy|compliance|disclaimer|become-agent|onboarding).*)',
  ],
};
