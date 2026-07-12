/**
 * Server-only data helpers for the Research section. Reads the public-read
 * `compounds` table via the server Supabase client. Pure presentation logic
 * lives in `@/lib/compounds`; this file only handles data fetching.
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { unstable_cache } from 'next/cache';
import type { Compound } from '@/lib/compounds';

// These research pages are statically prerendered at build. In production the
// Supabase env vars are present, so they bake in real compound data. On Vercel
// Preview deployments the env vars (incl. the service-role key, which must NOT
// be exposed to preview URLs) are absent, so constructing the service client
// throws "Your project's URL and Key are required" and fails the whole build.
// This guard lets those pages prerender to an empty index on env-less builds
// instead of crashing. It NEVER changes production behavior: when the env vars
// exist (always, in prod build + runtime) the real fetch path runs unchanged.
export function supabaseEnvReady(): boolean {
  return Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim() &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  );
}

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

// Data Cache TTL for every compound reader below. Compounds change only via
// the weekly sync crons (pubmed-sync, chembl-sync, search-refresh) and admin
// writes, all of which now bust the 'compounds' tag explicitly - so a 1-hour
// revalidate window is purely a safety net, not the freshness mechanism.
const COMPOUND_CACHE_SECONDS = 3600;

const PUBLIC_COMPOUND_COLUMNS = 'id, slug, display_name, aliases, category, evidence_tier, compound_class, molecular_target, identity, mechanism, studied_for, research_areas, benefits, side_effects, warnings, handling, regulatory, wada_status, sources, plain_summary, is_temp_sensitive, is_pro_angiogenic, is_glp1, is_stack, stack_components, stack_rationale, reconstitution_shelf_days, best_stacked_with, efficacy_scores, eli5_summary, quality_score, risk_level, half_life, molecular_weight_da, pubmed_citation_count, active_trial_count, updated_at, created_at';

export const getAllCompounds = unstable_cache(
  async (): Promise<Compound[]> => {
    if (!supabaseEnvReady()) return [];
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from('compounds')
      .select(PUBLIC_COMPOUND_COLUMNS)
      .order('display_name', { ascending: true });
    if (error || !data) return [];
    return data.map((row) => coerceCompound(row as Record<string, unknown>));
  },
  ['research-all-compounds'],
  { revalidate: COMPOUND_CACHE_SECONDS, tags: ['compounds'] }
);

/**
 * Fetch many compounds at once, keyed by slug. Used by the storefront product
 * display to embed the full monograph in each product detail without an extra
 * client round-trip. Empty / missing slugs are ignored.
 */
const fetchCompoundsBatch = unstable_cache(
  async (slugStr: string) => {
    const supabase = await createServiceClient();
    const unique = slugStr.split(',');
    const { data, error } = await supabase
      .from('compounds')
      .select(PUBLIC_COMPOUND_COLUMNS)
      .in('slug', unique);
    if (error || !data) return {} as Record<string, Compound>;
    const map: Record<string, Compound> = {};
    for (const row of data) {
      const c = coerceCompound(row as Record<string, unknown>);
      map[c.slug] = c;
    }
    return map;
  },
  ['compounds-by-slugs'],
  { revalidate: COMPOUND_CACHE_SECONDS, tags: ['compounds'] }
);

export async function getCompoundsBySlugs(
  slugs: Array<string | null | undefined>
): Promise<Record<string, Compound>> {
  const unique = Array.from(
    new Set(slugs.filter((s): s is string => typeof s === 'string' && s.length > 0))
  ).sort(); // sort for stable cache key
  if (unique.length === 0) return {};
  if (!supabaseEnvReady()) return {};

  return fetchCompoundsBatch(unique.join(','));
}

export const getCompound = unstable_cache(
  async (slug: string): Promise<Compound | null> => {
    if (!supabaseEnvReady()) return null;
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from('compounds')
      .select(PUBLIC_COMPOUND_COLUMNS)
      .eq('slug', slug)
      .maybeSingle();
    if (error || !data) return null;
    return coerceCompound(data as Record<string, unknown>);
  },
  ['research-single-compound'],
  { revalidate: COMPOUND_CACHE_SECONDS, tags: ['compounds'] }
);

export const getCompoundBindings = unstable_cache(
  async (slug: string) => {
    if (!supabaseEnvReady()) return [];
    const supabase = await createServiceClient();
    const { data } = await supabase
      .from('compound_chembl_bindings')
      .select('target_name, standard_type, standard_value, standard_units, pchembl_value, target_organism')
      .eq('compound_slug', slug)
      .limit(40);
    return data ?? [];
  },
  ['research-compound-bindings'],
  { revalidate: COMPOUND_CACHE_SECONDS, tags: ['compounds', 'bindings'] }
);

export const getCompoundStructures = unstable_cache(
  async (slug: string) => {
    if (!supabaseEnvReady()) return [];
    const supabase = await createServiceClient();
    const { data } = await supabase
      .from('compound_pdb_structures')
      .select('pdb_id, source, resolution_a, title, release_year, url')
      .eq('compound_slug', slug)
      .limit(8);
    return data ?? [];
  },
  ['research-compound-structures'],
  { revalidate: COMPOUND_CACHE_SECONDS, tags: ['compounds', 'structures'] }
);
