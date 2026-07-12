import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const revalidate = 3600; // Cache for 1 hour
export const maxDuration = 60; // Allow more time on Vercel for building this large file

export async function GET() {
  let compounds: Record<string, unknown>[] = [];
  try {
    const supabase = await createServiceClient();
    const { data } = await supabase
      .from('compounds')
      .select('*')
      .order('display_name', { ascending: true })
      .limit(2000);
    compounds = data ?? [];
  } catch { /* best-effort — return empty text on failure */ }

  let text = `# Pep Nation Lab - Full Research Database\n\n`;
  text += `> Premium wholesale research peptide distribution and comprehensive research library for qualified institutions. All products are strictly for in vitro laboratory research use only. Not for human consumption.\n\n`;
  text += `---\n\n`;

  compounds.forEach((c) => {
      // identity is a JSONB column; read it once into a narrowly-typed local so
      // the optional-chained fallbacks below typecheck (c is Record<string, unknown>).
      const identity = (c.identity ?? undefined) as
        | { molecular_weight?: unknown; sequence?: unknown; cas?: unknown }
        | undefined;

      text += `# ${c.display_name}\n\n`;
      text += `- **Category**: ${c.category}\n`;
      text += `- **Aliases**: ${Array.isArray(c.aliases) ? c.aliases.join(', ') : c.aliases}\n`;
      text += `- **Evidence Tier**: ${c.evidence_tier}\n`;
      text += `- **Mechanism**: ${c.mechanism || 'N/A'}\n\n`;
      text += `## Description\n${c.description}\n\n`;
      
      if (c.measured_half_life_hours ?? c.predicted_half_life_hours) text += `- **Half-life**: ${c.measured_half_life_hours ?? c.predicted_half_life_hours} hours\n`;
      if (c.molecular_weight_da ?? identity?.molecular_weight) text += `- **Molecular Weight**: ${c.molecular_weight_da ?? identity?.molecular_weight} Da\n`;
      if (c.sequence_one_letter ?? identity?.sequence) text += `- **Sequence**: ${c.sequence_one_letter ?? identity?.sequence}\n`;
      if (identity?.cas ?? c.cas_number) text += `- **CAS Number**: ${identity?.cas ?? c.cas_number}\n`;
      
      text += `\n## Summary\n${c.plain_summary || c.description || 'N/A'}\n\n`;
      text += `---\n\n`;
    });

  return new NextResponse(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // CDN edge cache to match the 1h ISR revalidate above; stale for a day.
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
