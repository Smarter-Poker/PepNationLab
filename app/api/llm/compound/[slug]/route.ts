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

  const aliases = Array.isArray(compound.aliases) ? compound.aliases.filter(Boolean) : [];
  const halfLife =
    compound.half_life ??
    (compound.measured_half_life_hours != null ? `${compound.measured_half_life_hours} hours` : null) ??
    (compound.predicted_half_life_hours != null ? `~${compound.predicted_half_life_hours} hours (predicted)` : null);
  const sequence = compound.sequence_one_letter ?? compound.identity?.sequence ?? null;
  const studiedFor = Array.isArray(compound.studied_for) ? compound.studied_for.filter(Boolean) : [];
  const researchAreas = Array.isArray(compound.research_areas) ? compound.research_areas.filter(Boolean) : [];
  const sources = Array.isArray(compound.sources) ? compound.sources.filter(Boolean) : [];

  let text = `# ${compound.display_name}\n\n`;
  if (compound.plain_summary) text += `> ${compound.plain_summary}\n\n`;

  text += `## Properties\n`;
  text += `- **Category**: ${compound.category ?? 'Research Compound'}\n`;
  if (aliases.length) text += `- **Aliases**: ${aliases.join(', ')}\n`;
  text += `- **Evidence Tier**: ${compound.evidence_tier}\n`;
  if (compound.compound_class) text += `- **Compound Class**: ${compound.compound_class}\n`;
  if (compound.molecular_target) text += `- **Molecular Target**: ${compound.molecular_target}\n`;
  if (halfLife) text += `- **Half-Life**: ${halfLife}\n`;
  if (compound.molecular_weight_da != null) text += `- **Molecular Weight**: ${compound.molecular_weight_da} Da\n`;
  if (sequence) text += `- **Sequence**: ${sequence}\n`;
  if (Array.isArray(compound.route_of_admin) && compound.route_of_admin.filter(Boolean).length)
    text += `- **Route Of Administration**: ${compound.route_of_admin.filter(Boolean).join(', ')}\n`;
  if (compound.wada_status) text += `- **WADA Status**: ${compound.wada_status}\n`;
  if (compound.chembl_id) text += `- **ChEMBL ID**: ${compound.chembl_id}\n`;
  if (compound.uniprot_id) text += `- **UniProt ID**: ${compound.uniprot_id}\n`;
  if (compound.unii) text += `- **UNII**: ${compound.unii}\n`;
  text += `\n`;

  if (compound.mechanism) text += `## Mechanism Of Action\n${compound.mechanism}\n\n`;
  if (studiedFor.length) text += `## Studied For\n${studiedFor.map((s) => `- ${s}`).join('\n')}\n\n`;
  if (compound.benefits) text += `## Reported Research Findings\n${compound.benefits}\n\n`;
  if (compound.pk_summary) text += `## Pharmacokinetics\n${compound.pk_summary}\n\n`;
  if (compound.side_effects || compound.warnings) {
    text += `## Safety And Handling\n`;
    if (compound.side_effects) text += `${compound.side_effects}\n\n`;
    if (compound.warnings) text += `${compound.warnings}\n\n`;
  }
  if (compound.regulatory) text += `## Regulatory Status\n${compound.regulatory}\n\n`;
  if (researchAreas.length) text += `## Research Areas\n${researchAreas.map((a) => `- ${a}`).join('\n')}\n\n`;
  if (sources.length) text += `## References\n${sources.map((s) => `- ${s}`).join('\n')}\n\n`;

  text += `---\n`;
  text += `*Note: All products are strictly for in vitro laboratory research use only. Not for human consumption.*\n`;
  text += `[View full interactive page on Pep Nation Lab](https://pepnationlab.com/research/${slug})\n`;

  return new NextResponse(text, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  });
}
