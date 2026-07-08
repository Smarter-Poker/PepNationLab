import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Edge middleware — runs before every matched route.
 * Refreshes the Supabase auth session cookie and redirects
 * unauthenticated users away from protected paths.
 *
 * Protected path groups:
 *   /admin/*      — admin dashboard (role further checked in requireAdmin())
 *   /account/*    — researcher account pages
 *   /dashboard/*  — agent dashboard
 *   /lab-journal  — requires login
 *   /lab-tools    — requires login
 *   /shelf-life   — requires login
 *   /messenger    — requires login
 *   /wallet/*     — requires login
 */

const PROTECTED_PREFIXES = [
  '/admin',
  '/account',
  '/dashboard',
  '/lab-journal',
  '/lab-tools',
  '/shelf-life',
  '/messenger',
  '/wallet',
];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Build a Supabase client that reads/writes cookies through Next.js middleware APIs
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: Do not call supabase.auth.getSession() here — it reads from the cookie
  // without verifying. Always use getUser() to validate the JWT against the Supabase server.
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!user && isProtected) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static  (static files)
     * - _next/image   (image optimisation)
     * - favicon.ico, og-card.png, robots.txt, sitemap.xml, llms.txt, feed.xml
     * - /api/*        (API routes handle their own auth)
     * - /login, /signup, /verify-email (auth pages)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|og-card\\.png|robots\\.txt|sitemap\\.xml|llms\\.txt|feed\\.xml|api/|login|signup|verify-email).*)',
  ],
};
