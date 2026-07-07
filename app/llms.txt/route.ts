import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const revalidate = 3600; // Cache for 1 hour

export async function GET() {
  const supabase = await createServiceClient();
  const { data: compounds } = await supabase
    .from('compounds')
    .select('slug, display_name, category')
    .order('display_name', { ascending: true });

  const base = 'https://pepnationlab.com';

  let text = `# Pep Nation Lab\n\n`;
  text += `> Pep Nation Lab (pepnationlab.com) is a US wholesale distribution platform for research-grade peptides, serving verified researchers and scientific institutions. It provides 300+ research-grade peptide monographs covering mechanism of action, evidence tier, pharmacokinetics, molecular identity, handling, and referenced findings, plus reconstitution calculators, a comparison engine, and an AI match engine. Every product and all content are strictly for in vitro laboratory research use only — not for human or animal consumption, ingestion, or injection, and not FDA-approved. Access requires a verified researcher account.\n\n`;

  text += `Key facts:\n`;
  text += `- Catalog: 100+ research-grade peptides and compounds (BPC-157, Semaglutide, Tirzepatide, TB-500, Ipamorelin, CJC-1295, Sermorelin, PT-141, GHK-Cu, Epithalon, and more)\n`;
  text += `- Shipping: all 50 US states; same-day processing on qualifying verified-researcher orders\n`;
  text += `- Documentation: batch certificate of analysis (COA) with every order\n`;
  text += `- Pricing: wholesale, tiered agent structure; no retail markup\n`;
  text += `- Compliance: 4-layer Research Use Only acknowledgment; verified accounts only; no needles or syringes ever sold\n\n`;

  text += `## Full Site Context\n`;
  text += `- [Full Compound Database (markdown)](${base}/llms-full.txt): A single markdown file containing every compound monograph in full.\n\n`;

  text += `## Key Pages\n`;
  text += `- [Research Library](${base}/research): Browsable database of all research compounds.\n`;
  text += `- [Find A Peptide](${base}/find-a-peptide): Discover compounds by research goal and attributes.\n`;
  text += `- [Peptide 101 Academy](${base}/peptide-101): Foundational peptide science education.\n`;
  text += `- [Compound Catalog](${base}/research/catalog): Full catalog view.\n`;
  text += `- [A To Z Index](${base}/research/a-z): Alphabetical compound index.\n`;
  text += `- [Glossary](${base}/research/glossary): Peptide science terms and definitions.\n`;
  text += `- [Reconstitution Calculators](${base}/research/calculators): Research dosing and dilution math.\n`;
  text += `- [Compare Compounds](${base}/research/compare): Side-by-side comparison tool.\n`;
  text += `- [Research FAQ](${base}/research/faq): Frequently asked questions.\n`;
  text += `- [About Pep Nation Lab](${base}/about): Company and platform overview.\n\n`;

  text += `## Individual Compound Monographs\n`;
  text += `Each entry links to the human-readable monograph. A machine-readable markdown version is available at /api/llm/compound/{slug}.\n`;
  if (compounds) {
    compounds.forEach((c) => {
      text += `- [${c.display_name}](${base}/research/${c.slug}): ${c.category ?? 'Research Compound'} (markdown: ${base}/api/llm/compound/${c.slug})\n`;
    });
  }

  text += `\n## Policies\n`;
  text += `- [Compliance & Disclaimer](${base}/disclaimer): Research-use-only compliance and safety framing.\n`;
  text += `- [Terms of Service](${base}/terms)\n`;
  text += `- [Privacy Policy](${base}/privacy)\n`;

  return new NextResponse(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
