/**
 * Next.js native sitemap generator. Emits /sitemap.xml.
 * Lists every public /research/* path.
 */
import type { MetadataRoute } from 'next';
import { createServiceClient } from '@/lib/supabase/server';

const BASE = 'https://pepnationlab.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPaths: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE}/research`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/research/calculators`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/research/compare`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/research/stacks`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/research/match`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/research/api-docs`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/research/a-z`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/research/timeline`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/research/most-cited`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/research/new-additions`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE}/research/approved-drugs`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/research/by-class`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/research/by-target`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/research/by-mechanism`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/research/by-route`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${BASE}/research/by-half-life`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${BASE}/research/by-mw`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${BASE}/research/intranasal-peptides`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/research/most-studied-2026`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/research/correlated`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${BASE}/research/discontinued`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/research/in-pipeline`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/research/orphan-drugs`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/research/repurposed`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
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
      url: `${BASE}/research/compounds/${r.slug}`,
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
    for (const a of areas) {
      compounds.push({
        url: `${BASE}/research/area/${encodeURIComponent(a)}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.7,
      });
    }
    for (const t of targets) {
      compounds.push({
        url: `${BASE}/research/by-target/${encodeURIComponent(t)}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.6,
      });
    }
  } catch {
    // best-effort: fall back to static paths only
  }

  return [...staticPaths, ...compounds];
}
