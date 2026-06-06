import type { MetadataRoute } from 'next';

/**
 * Next.js native robots.ts - dynamically generated per request.
 * Replaces the static public/robots.txt so updates take effect immediately
 * without waiting for Vercel's edge CDN to invalidate static files.
 *
 * The Research Library is public RUO reference content (open for indexing).
 * Commerce, admin, dashboard, account, and API surfaces stay disallowed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/research', '/research/', '/about', '/become-agent', '/terms', '/privacy', '/compliance', '/disclaimer'],
        disallow: [
          '/admin',
          '/admin/',
          '/api',
          '/api/',
          '/dashboard',
          '/dashboard/',
          '/checkout',
          '/orders',
          '/messages',
          '/messenger',
          '/account',
          '/invite',
          '/login',
          '/forgot-password',
        ],
      },
    ],
    sitemap: 'https://pepnationlab.com/sitemap.xml',
    host: 'https://pepnationlab.com',
  };
}
