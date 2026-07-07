import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const revalidate = 3600; // Cache for 1 hour
export const maxDuration = 60; // Allow more time on Vercel for building this large file

export async function GET() {
  const supabase = await createServiceClient();
  const { data: compounds } = await supabase
    .from('compounds')
    .select('*')
    .order('display_name', { ascending: true });

  let text = `# Pep Nation Lab - Full Research Database\n\n`;
  text += `> Premium wholesale research peptide distribution and comprehensive research library for qualified institutions. All products are strictly for in vitro laboratory research use only. Not for human consumption.\n\n`;
  text += `---\n\n`;

  if (compounds) {
    compounds.forEach((c) => {
      text += `# ${c.display_name}\n\n`;
      text += `- **Category**: ${c.category}\n`;
      text += `- **Aliases**: ${Array.isArray(c.aliases) ? c.aliases.join(', ') : c.aliases}\n`;
      text += `- **Evidence Tier**: ${c.evidence_tier}\n`;
      text += `- **Mechanism**: ${c.mechanism || 'N/A'}\n\n`;
      text += `## Description\n${c.description}\n\n`;
      
      if (c.half_life_hours) text += `- **Half-life**: ${c.half_life_hours} hours\n`;
      if (c.molecular_weight) text += `- **Molecular Weight**: ${c.molecular_weight} Da\n`;
      if (c.sequence) text += `- **Sequence**: ${c.sequence}\n`;
      if (c.cas_number) text += `- **CAS Number**: ${c.cas_number}\n`;
      
      text += `\n## Content Outline\n${c.content_outline || 'N/A'}\n\n`;
      text += `---\n\n`;
    });
  }

  return new NextResponse(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
