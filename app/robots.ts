import type { MetadataRoute } from 'next';

// The site is research-only and gated. Disallow all crawlers.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        disallow: '/',
      },
    ],
    sitemap: 'https://pepnationlab.com/sitemap.xml',
  };
}
