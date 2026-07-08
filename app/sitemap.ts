/**
 * Next.js native sitemap generator. Emits /sitemap.xml.
 * Lists every public path: static info pages, legal, research library, and compound monographs.
 */
import type { MetadataRoute } from 'next';
import { createServiceClient } from '@/lib/supabase/server';
import { CITIES, getStatesSlugs, CITY_CONTENT_UPDATED } from '@/lib/cities/cities-data';
import { DEFAULT_STORE_SLUG } from '@/lib/default-store';
import { GUIDES, GUIDES_UPDATED } from '@/lib/research/guides';
import { COMPARISON_PAIRS, matchupSlug } from '@/lib/research/comparisons';
import { RESEARCH_AREAS } from '@/lib/compounds';
const BASE = 'https://pepnationlab.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPaths: MetadataRoute.Sitemap = [
    // Core
    { url: `${BASE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/become-agent`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/find-a-peptide`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/peptide-101`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/${DEFAULT_STORE_SLUG}`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },

    // Local SEO - Peptides by City (hub + states; city URLs are emitted once
    // below with tier-scored priority - do NOT list them twice)
    { url: `${BASE}/peptides`, lastModified: CITY_CONTENT_UPDATED, changeFrequency: 'weekly', priority: 0.8 },
    ...getStatesSlugs().map((stateSlug) => ({
      url: `${BASE}/peptides/${stateSlug}`,
      lastModified: CITY_CONTENT_UPDATED,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),

    // Legal / Compliance
    { url: `${BASE}/compliance`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/disclaimer`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },

    // Research Library - Hub Pages
    { url: `${BASE}/research`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/research/areas`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/research/about-areas`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/research/catalog`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/research/a-z`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/research/glossary`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/research/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/research/learn`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/research/evidence`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },

    // Research Library - Tools
    { url: `${BASE}/research/calculators`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/research/compare`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/research/stacks`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/research/match`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },

    // Research Library - Browse Filters
    { url: `${BASE}/research/by-class`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/research/by-target`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/research/by-mechanism`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/research/by-route`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${BASE}/research/by-half-life`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${BASE}/research/by-mw`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },

    // Research Library - Curated Lists
    { url: `${BASE}/research/most-cited`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/research/most-studied-2026`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/research/new-additions`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE}/research/approved-drugs`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/research/intranasal-peptides`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/research/timeline`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },

    // Research Library - Pipeline / Status
    { url: `${BASE}/research/in-pipeline`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/research/discontinued`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/research/orphan-drugs`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/research/correlated`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },

    // Research Library - API Docs
    { url: `${BASE}/research/api-docs`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },

    // Research Library - Editorial Guides
    { url: `${BASE}/research/guides`, lastModified: new Date(GUIDES_UPDATED), changeFrequency: 'monthly', priority: 0.7 },
    ...GUIDES.map((g) => ({
      url: `${BASE}/research/guides/${g.slug}`,
      lastModified: new Date(g.dateModified),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),

    // Research Library - Editorial Standards + Compound Comparisons
    { url: `${BASE}/research/methodology`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    ...COMPARISON_PAIRS.map((p) => ({
      url: `${BASE}/research/compare/${matchupSlug(p.a, p.b)}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),

    // Research Areas - deep use-case hub pages (now indexable). High-intent
    // category landing pages (weight management, tissue repair, cognitive, etc).
    ...Object.keys(RESEARCH_AREAS).map((area) => ({
      url: `${BASE}/research/area/${area}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];

  let compounds: MetadataRoute.Sitemap = [];
  try {
    // Create the client inside the try so that on Vercel Preview builds (no
    // Supabase env vars) createServiceClient's throw is caught and we fall back
    // to the static paths below, instead of crashing the prerender of
    // /sitemap.xml and failing the whole build. Production always has env, so
    // the full DB-backed sitemap is generated unchanged.
    const supabase = await createServiceClient();
    const { data } = await supabase
      .from('compounds')
      .select('slug, updated_at, research_areas')
      .limit(2000);
    const rows = (data ?? []) as Array<{ slug: string; updated_at: string | null; research_areas: string[] | null }>;
    compounds = rows.map((r) => ({
      url: `${BASE}/research/${r.slug}`,
      lastModified: r.updated_at ? new Date(r.updated_at) : now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));

    const areas = new Set<string>();
    const targets = new Set<string>();
    for (const r of rows) {
      if (Array.isArray(r.research_areas)) for (const a of r.research_areas) areas.add(a);
    }
    const { data: targetData } = await supabase.from('compounds').select('receptors').limit(2000);
    for (const t of ((targetData ?? []) as Array<{ receptors: string[] | null }>)) {
      if (Array.isArray(t.receptors)) for (const r of t.receptors) targets.add(r);
    }
    // NOTE: /research/area/ hubs are now indexable and emitted above (in
    // staticPaths). /research/by-target/ pages remain noindexed (thin filter
    // pages) and are intentionally excluded to avoid Search Console warnings.
  } catch {
    // best-effort: fall back to static paths only
  }

  // City landing pages - priority scored by market tier
  const cityPriority: Record<number, number> = { 1: 0.8, 2: 0.7, 3: 0.6 };
  const cityChangeFreq: Record<number, MetadataRoute.Sitemap[number]['changeFrequency']> = {
    1: 'weekly',
    2: 'weekly',
    3: 'monthly',
  };
  const cityPages: MetadataRoute.Sitemap = CITIES.map((city) => ({
    url: `${BASE}/peptides/${city.stateSlug}/${city.slug}`,
    lastModified: CITY_CONTENT_UPDATED,
    changeFrequency: cityChangeFreq[city.tier] ?? 'monthly',
    priority: cityPriority[city.tier] ?? 0.6,
  }));

  return [...staticPaths, ...compounds, ...cityPages];
}
