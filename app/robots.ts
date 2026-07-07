import type { MetadataRoute } from 'next';

/**
 * Next.js native robots.ts - dynamically generated per request.
 * Replaces the static public/robots.txt so updates take effect immediately
 * without waiting for Vercel's edge CDN to invalidate static files.
 *
 * Public-facing pages are explicitly allowed. Authenticated/private surfaces
 * are disallowed. All private/authenticated pages explicitly set
 * robots: { index: false } in their metadata as a second layer of protection.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          // Core public pages
          '/',
          '/about',
          '/become-agent',
          '/contact',
          '/find-a-peptide',
          '/peptide-101',
          '/peptide-101/',
          '/products',
          '/shipping',

          // Local SEO — Peptides by City
          '/peptides',
          '/peptides/',

          // Legal / Compliance
          '/compliance',
          '/disclaimer',
          '/privacy',
          '/terms',

          // Research Library — Hub
          '/research',
          '/research/',
          '/research/areas',
          '/research/about-areas',
          '/research/catalog',
          '/research/a-z',
          '/research/glossary',
          '/research/faq',
          '/research/learn',
          '/research/evidence',

          // Research Library — Tools
          '/research/calculators',
          '/research/compare',
          '/research/stacks',
          '/research/match',

          // Research Library — Browse Filters
          '/research/by-class',
          '/research/by-target',
          '/research/by-mechanism',
          '/research/by-route',
          '/research/by-half-life',
          '/research/by-mw',

          // Research Library — Curated Lists
          '/research/most-cited',
          '/research/most-studied-2026',
          '/research/new-additions',
          '/research/approved-drugs',
          '/research/intranasal-peptides',
          '/research/timeline',
          '/research/in-pipeline',
          '/research/discontinued',
          '/research/orphan-drugs',
          '/research/correlated',

          // Research Library — Dynamic paths (compound monographs + area/target sub-pages)
          '/research/area/',
          '/research/by-target/',

          // Research Library — API Docs
          '/research/api-docs',
        ],
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
          '/signup',
          '/register',
          '/forgot-password',
          '/onboarding',
          '/wallet',
          '/status',
          '/auth',
        ],
      },
    ],
    sitemap: 'https://pepnationlab.com/sitemap.xml',
    host: 'https://pepnationlab.com',
  };
}
