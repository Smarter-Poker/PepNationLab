/**
 * Server-only data helpers for the Research section. Reads the public-read
 * `compounds` table via the server Supabase client. Pure presentation logic
 * lives in `@/lib/compounds`; this file only handles data fetching.
 */
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { unstable_cache } from 'next/cache';
import type { Compound } from '@/lib/compounds';

function coerceCompound(row: Record<string, unknown>): Compound {
  return {
    ...(row as unknown as Compound),
    identity: (row.identity as Compound['identity']) ?? {},
    handling: (row.handling as Compound['handling']) ?? {},
    aliases: (row.aliases as string[]) ?? [],
    studied_for: (row.studied_for as string[]) ?? [],
    research_areas: (row.research_areas as string[]) ?? [],
    sources: (row.sources as string[]) ?? [],
    stack_components: (row.stack_components as string[]) ?? [],
    risk_reasons: (row.risk_reasons as string[]) ?? [],
    // Phase 2/3 fields: ensure safe defaults if DB returns null
    best_stacked_with: (row.best_stacked_with as string[] | null) ?? [],
    efficacy_scores: (row.efficacy_scores as Record<string, number> | null) ?? {},
  };
}

export const getAllCompounds = unstable_cache(
  async (): Promise<Compound[]> => {
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from('compounds')
      .select('*')
      .order('display_name', { ascending: true });
    if (error || !data) return [];
    return data.map((row) => coerceCompound(row as Record<string, unknown>));
  },
  ['research-all-compounds'],
  { revalidate: 60, tags: ['compounds'] }
);

/**
 * Fetch many compounds at once, keyed by slug. Used by the storefront product
 * display to embed the full monograph in each product detail without an extra
 * client round-trip. Empty / missing slugs are ignored.
 */
export async function getCompoundsBySlugs(
  slugs: Array<string | null | undefined>
): Promise<Record<string, Compound>> {
  const unique = Array.from(
    new Set(slugs.filter((s): s is string => typeof s === 'string' && s.length > 0))
  ).sort(); // sort for stable cache key
  if (unique.length === 0) return {};

  // Build a per-slug-set cache key so different storefronts with different
  // product lists never share the same cached entry.
  const cacheKey = `compounds-by-slugs:${unique.join(',')}`;

  const fetcher = unstable_cache(
    async () => {
      const supabase = await createServiceClient();
      const { data, error } = await supabase
        .from('compounds')
        .select('*')
        .in('slug', unique);
      if (error || !data) return {} as Record<string, Compound>;
      const map: Record<string, Compound> = {};
      for (const row of data) {
        const c = coerceCompound(row as Record<string, unknown>);
        map[c.slug] = c;
      }
      return map;
    },
    [cacheKey],
    { revalidate: 60, tags: ['compounds'] }
  );

  return fetcher();
}

export const getCompound = unstable_cache(
  async (slug: string): Promise<Compound | null> => {
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from('compounds')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (error || !data) return null;
    return coerceCompound(data as Record<string, unknown>);
  },
  ['research-single-compound'],
  { revalidate: 60, tags: ['compounds'] }
);

export const getCompoundBindings = unstable_cache(
  async (slug: string) => {
    const supabase = await createServiceClient();
    const { data } = await supabase
      .from('compound_chembl_bindings')
      .select('target_name, standard_type, standard_value, standard_units, pchembl_value, target_organism')
      .eq('compound_slug', slug)
      .limit(40);
    return data ?? [];
  },
  ['research-compound-bindings'],
  { revalidate: 60, tags: ['compounds', 'bindings'] }
);

export const getCompoundStructures = unstable_cache(
  async (slug: string) => {
    const supabase = await createServiceClient();
    const { data } = await supabase
      .from('compound_pdb_structures')
      .select('pdb_id, source, resolution_a, title, release_year, url')
      .eq('compound_slug', slug)
      .limit(8);
    return data ?? [];
  },
  ['research-compound-structures'],
  { revalidate: 60, tags: ['compounds', 'structures'] }
);
