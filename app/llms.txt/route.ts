import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const revalidate = 3600; // Cache for 1 hour

export async function GET() {
  const supabase = await createServiceClient();
  const { data: compounds } = await supabase
    .from('compounds')
    .select('slug, display_name, category')
    .order('display_name', { ascending: true });

  let text = `# Pep Nation Lab\n\n`;
  text += `> Premium wholesale research peptide distribution and comprehensive research library for qualified institutions. All products are strictly for in vitro laboratory research use only. Not for human consumption.\n\n`;
  text += `## Full Site Context\n`;
  text += `- [Full Compound Database](/llms-full.txt) - A single, massive markdown file containing all compound monographs.\n\n`;

  text += `## Individual Compound Monographs\n`;
  if (compounds) {
    compounds.forEach((c) => {
      text += `- [${c.display_name}](/api/llm/compound/${c.slug}): ${c.category}\n`;
    });
  }

  text += `\n## Policies\n`;
  text += `- [Compliance & Disclaimer](/disclaimer)\n`;
  text += `- [Terms of Service](/terms)\n`;

  return new NextResponse(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
