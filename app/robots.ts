import type { MetadataRoute } from 'next';

/**
 * Next.js native robots.ts - dynamically generated per request.
 * Replaces the static public/robots.txt so updates take effect immediately
 * without waiting for Vercel's edge CDN to invalidate static files.
 *
 * Public-facing pages are explicitly allowed. Authenticated/private surfaces
 * are disallowed. All private/authenticated pages explicitly set
 * robots: { index: false } in their metadata as a second layer of protection.
 *
 * AI crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.) get their own explicit
 * rule groups with the SAME allow/disallow lists (shared consts below so the
 * lists can never drift apart). A crawler obeys only the most specific
 * matching group, so naming them guarantees they keep public access even if
 * the wildcard group is ever tightened. AI-search visibility (ChatGPT,
 * Claude, Perplexity, Grok) depends on these bots staying allowed.
 */

const ALLOW = [
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

  // Local SEO - Peptides by City (prefix covers /peptides/[state]/[city])
  '/peptides',
  '/peptides/',

  // Legal / Compliance
  '/compliance',
  '/disclaimer',
  '/privacy',
  '/terms',

  // Research Library - Hub
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

  // Research Library - Tools
  '/research/calculators',
  '/research/compare',
  '/research/stacks',
  '/research/match',

  // Research Library - Browse Filters
  '/research/by-class',
  '/research/by-target',
  '/research/by-mechanism',
  '/research/by-route',
  '/research/by-half-life',
  '/research/by-mw',

  // Research Library - Curated Lists
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

  // Research Library - Dynamic paths (compound monographs + area/target sub-pages)
  '/research/area/',
  '/research/by-target/',
  '/research/guides/',
  '/research/compare/',

  // Research Library - API Docs
  '/research/api-docs',

  // AI / LLM discoverability - machine-readable surfaces.
  // These sit under /api (which is Disallowed below); the longer,
  // more specific Allow wins for compliant crawlers (Googlebot,
  // Bingbot, GPTBot, ClaudeBot, PerplexityBot), so the per-compound
  // markdown monographs remain fetchable by AI answer engines.
  '/api/llm',
  '/api/llm/',
  '/llms.txt',
  '/llms-full.txt',
  '/feed.xml',
  '/sitemap.xml',
];

const DISALLOW = [
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
];

// AI / answer-engine crawlers we explicitly welcome. Bingbot is covered by
// the wildcard group and powers ChatGPT search results.
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'meta-externalagent',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ALLOW,
        disallow: DISALLOW,
      },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: ALLOW,
        disallow: DISALLOW,
      })),
    ],
    sitemap: 'https://pepnationlab.com/sitemap.xml',
    host: 'https://pepnationlab.com',
  };
}
