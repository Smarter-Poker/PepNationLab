/**
 * Server-only data helpers for the Research section. Reads the public-read
 * `compounds` table via the server Supabase client. Pure presentation logic
 * lives in `@/lib/compounds`; this file only handles data fetching.
 */
import { createClient } from '@/lib/supabase/server';
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
  };
}

export async function getAllCompounds(): Promise<Compound[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('compounds')
    .select('*')
    .order('display_name', { ascending: true });
  if (error || !data) return [];
  return data.map((row) => coerceCompound(row as Record<string, unknown>));
}

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
  );
  if (unique.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('compounds')
    .select('*')
    .in('slug', unique);
  if (error || !data) return {};
  const map: Record<string, Compound> = {};
  for (const row of data) {
    const c = coerceCompound(row as Record<string, unknown>);
    map[c.slug] = c;
  }
  return map;
}

export async function getCompound(slug: string): Promise<Compound | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('compounds')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error || !data) return null;
  return coerceCompound(data as Record<string, unknown>);
}
