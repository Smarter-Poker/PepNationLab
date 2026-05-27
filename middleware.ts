import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// ─── SITE LOCKDOWN ──────────────────────────────────────────────────────────
// The site is locked. Only authenticated users may access any page.
// New account registration is disabled — /register always redirects to /login.
// The only public route is /login itself (plus static assets handled by matcher).
// ────────────────────────────────────────────────────────────────────────────

// Routes that are always public (no auth required)
const PUBLIC_ROUTES = ['/login', '/forgot-password', '/become-agent', '/about', '/terms', '/privacy', '/compliance'];

// Dynamic route check — agent storefronts are public
// e.g. /midway, /orlando-peps, etc. (but NOT /admin, /dashboard, /api, etc.)
function isPublicDynamicRoute(pathname: string): boolean {
  // Exclude known protected prefixes
  const protectedPrefixes = [
    '/admin', '/dashboard', '/api', '/orders', '/products',
    '/checkout', '/messages', '/register', '/login', '/forgot-password',
    '/become-agent', '/about', '/terms', '/privacy', '/compliance',
    '/disclaimer',
  ];
  if (protectedPrefixes.some(p => pathname.startsWith(p))) return false;
  // A single-segment slug path (e.g. /midway) is a public storefront
  const segments = pathname.split('/').filter(Boolean);
  return segments.length === 1;
}

export async function middleware(request: NextRequest) {
  // Pass through if Supabase env vars not configured yet (early deploy)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request });
  }

  const pathname = request.nextUrl.pathname;

  // Registration is permanently disabled — redirect to login
  if (pathname.startsWith('/register')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.delete('redirect');
    return NextResponse.redirect(url);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Allow public routes through (login, forgot-password, become-agent, agent storefronts)
  const isPublicRoute = PUBLIC_ROUTES.some(r => pathname.startsWith(r)) || isPublicDynamicRoute(pathname);
  if (isPublicRoute) {
    // If user is already logged in on a public route, send them to the right place
    if (user) {
      const url = request.nextUrl.clone();
      // Check role via the profile — admins go to /admin, everyone else to /dashboard
      // We use a lightweight DB read with the anon key (RLS allows user to read own profile)
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      url.pathname = profile?.role === 'admin' ? '/admin' : '/dashboard';
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Every other route requires authentication
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // Preserve the intended destination so we can redirect after login
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
