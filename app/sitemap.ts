import type { MetadataRoute } from 'next';
import { FAQ_CATEGORIES, FAQ_ITEMS } from '@/lib/help-faq';

const BASE = 'https://pepnationlab.com';

// R28: include the Help & Support page, each public FAQ category as a
// `?cat=<id>` query, and each public FAQ item as a `#faq-<id>` hash. This
// makes support replies that paste a deep-link internally indexable and
// lets search engines surface direct answer fragments. Admin/agent-only
// answers are excluded so role-gated content stays out of public crawl.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const legal: MetadataRoute.Sitemap = [
    '/login',
    '/become-agent',
    '/about',
    '/terms',
    '/privacy',
    '/compliance',
    '/disclaimer',
  ].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: path === '/login' ? 1.0 : 0.5,
  }));

  const helpRoot: MetadataRoute.Sitemap = [
    {
      url: `${BASE}/account/help`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
  ];

  const helpCategories: MetadataRoute.Sitemap = FAQ_CATEGORIES
    .filter((c) => c.audience === 'all')
    .map((cat) => ({
      url: `${BASE}/account/help?cat=${cat.id}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }));

  const helpItems: MetadataRoute.Sitemap = FAQ_ITEMS
    .filter((it) => !it.audience || it.audience === 'all')
    .map((it) => ({
      url: `${BASE}/account/help#faq-${it.id}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.4,
    }));

  return [...legal, ...helpRoot, ...helpCategories, ...helpItems];
}
