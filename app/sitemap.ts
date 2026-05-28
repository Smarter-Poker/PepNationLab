import type { MetadataRoute } from 'next';

const BASE = 'https://pepnationlab.com';

// Only the legal/onboarding public surfaces are listed.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = [
    '/login',
    '/become-agent',
    '/about',
    '/terms',
    '/privacy',
    '/compliance',
    '/disclaimer',
  ];
  return routes.map(path => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: path === '/login' ? 1.0 : 0.5,
  }));
}
