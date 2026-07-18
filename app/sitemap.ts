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

// Regenerate at most hourly - each hit builds thousands of URLs and runs up to
// three 2000-row Supabase queries, which crawlers should not trigger per-request.
export const revalidate = 3600;

const BASE = 'https://pepnationlab.com';

// Real content-edit date for hand-authored static/hub/list pages. Bump this
// when their content meaningfully changes. Using a fixed date (instead of
// `new Date()` at build time) keeps <lastmod> honest - emitting "now" on every
// deploy tells crawlers everything changed constantly, which dilutes the
// signal and slows recrawl of pages that DID change.
const STATIC_CONTENT_UPDATED = new Date('2026-07-11');

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPaths: MetadataRoute.Sitemap = [
    // Core
    { url: `${BASE}/`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE}/about`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/become-agent`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/contact`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/find-a-peptide`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/coa`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/help`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/peptide-101`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/${DEFAULT_STORE_SLUG}`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'weekly', priority: 0.9 },

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
    { url: `${BASE}/compliance`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/disclaimer`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE}/privacy`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/terms`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.5 },

    // Research Library - Hub Pages
    { url: `${BASE}/research`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/research/areas`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/research/about-areas`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/research/catalog`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/research/a-z`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/research/glossary`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/research/faq`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/research/learn`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/research/evidence`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'weekly', priority: 0.6 },

    // Research Library - Tools
    { url: `${BASE}/research/calculators`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/research/compare`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/research/stacks`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/research/match`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.7 },

    // Research Library - Browse Filters
    { url: `${BASE}/research/by-class`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/research/by-target`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/research/by-mechanism`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/research/by-route`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${BASE}/research/by-half-life`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${BASE}/research/by-mw`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'weekly', priority: 0.5 },

    // Research Library - Curated Lists
    { url: `${BASE}/research/most-cited`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/research/most-studied-2026`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/research/new-additions`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE}/research/approved-drugs`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/research/intranasal-peptides`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/research/timeline`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'weekly', priority: 0.6 },

    // Research Library - Pipeline / Status
    { url: `${BASE}/research/in-pipeline`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/research/discontinued`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/research/orphan-drugs`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/research/correlated`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'weekly', priority: 0.5 },

    // Research Library - API Docs
    { url: `${BASE}/research/api-docs`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.5 },

    // Research Library - References Hub (aggregates all citations)
    { url: `${BASE}/research/references`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'weekly', priority: 0.7 },

    // Research Library - Editorial Guides
    { url: `${BASE}/research/guides`, lastModified: new Date(GUIDES_UPDATED), changeFrequency: 'monthly', priority: 0.7 },
    ...GUIDES.map((g) => ({
      url: `${BASE}/research/guides/${g.slug}`,
      lastModified: new Date(g.dateModified),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),

    // Research Library - Editorial Standards + Compound Comparisons
    { url: `${BASE}/research/methodology`, lastModified: STATIC_CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.6 },
    ...COMPARISON_PAIRS.map((p) => ({
      url: `${BASE}/research/compare/${matchupSlug(p.a, p.b)}`,
      lastModified: STATIC_CONTENT_UPDATED,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),

    // Research Areas - deep use-case hub pages (now indexable). High-intent
    // category landing pages (weight management, tissue repair, cognitive, etc).
    ...Object.keys(RESEARCH_AREAS).map((area) => ({
      url: `${BASE}/research/area/${area}`,
      lastModified: STATIC_CONTENT_UPDATED,
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

    // Per-compound sub-pages: /references and /regulatory are now indexed.
    // /spec and /structure remain noindexed (print tool / 3D viewer).
    for (const r of rows) {
      compounds.push(
        {
          url: `${BASE}/research/${r.slug}/references`,
          lastModified: r.updated_at ? new Date(r.updated_at) : now,
          changeFrequency: 'monthly' as const,
          priority: 0.5,
        },
        {
          url: `${BASE}/research/${r.slug}/regulatory`,
          lastModified: r.updated_at ? new Date(r.updated_at) : now,
          changeFrequency: 'monthly' as const,
          priority: 0.5,
        },
      );
    }

    // /research/by-target/[target] pages are now indexed — emit them.
    for (const target of targets) {
      compounds.push({
        url: `${BASE}/research/by-target/${encodeURIComponent(target)}`,
        lastModified: STATIC_CONTENT_UPDATED,
        changeFrequency: 'monthly' as const,
        priority: 0.5,
      });
    }
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

  // Compound-city pages (/peptides/*/*/*) are intentionally excluded from the
  // sitemap: at current domain authority they were crawl-budget sinks (Google
  // "Discovered/Crawled - not indexed"). The routes stay live and tier-1/2
  // remain indexable via internal links.

  return [...staticPaths, ...compounds, ...cityPages];
}
