import { NextResponse } from 'next/server';
import { getCompound } from '@/lib/compounds-server';

export const revalidate = 3600;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  
  if (!slug) {
    return new NextResponse('Missing slug', { status: 400 });
  }

  const compound = await getCompound(slug);
  
  if (!compound) {
    return new NextResponse('Compound not found', { status: 404 });
  }

  let text = `# ${compound.display_name}\n\n`;
  text += `> ${compound.description}\n\n`;
  
  text += `## Properties\n`;
  text += `- **Category**: ${compound.category}\n`;
  text += `- **Aliases**: ${Array.isArray(compound.aliases) ? compound.aliases.join(', ') : compound.aliases}\n`;
  text += `- **Evidence Tier**: ${compound.evidence_tier}\n`;
  text += `- **Mechanism**: ${compound.mechanism || 'N/A'}\n`;
  if (compound.half_life_hours) text += `- **Half-life**: ${compound.half_life_hours} hours\n`;
  if (compound.molecular_weight) text += `- **Molecular Weight**: ${compound.molecular_weight} Da\n`;
  if (compound.sequence) text += `- **Sequence**: ${compound.sequence}\n`;
  if (compound.cas_number) text += `- **CAS Number**: ${compound.cas_number}\n`;
  text += `\n`;
  
  text += `## Content Outline\n${compound.content_outline || 'N/A'}\n\n`;
  
  text += `---\n`;
  text += `*Note: All products are strictly for in vitro laboratory research use only. Not for human consumption.*\n`;
  text += `[View full interactive page on Pep Nation Lab](https://pepnationlab.com/research/${slug})\n`;

  return new NextResponse(text, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  });
}
