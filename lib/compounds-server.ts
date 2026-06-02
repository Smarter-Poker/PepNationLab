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
