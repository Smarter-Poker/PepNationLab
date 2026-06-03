/**
 * buildResearchSearchDocs — assembles the universal search index for the
 * Research Library from every searchable entity: compounds, stacks, research
 * areas, learn guides, glossary terms, and FAQ entries. Pure (no server imports)
 * so it can run in a server component and hand the flat doc list to the client
 * UniversalSearch ranker. Research-use-only reference content only.
 */

import type { Compound } from '@/lib/compounds';
import { RESEARCH_AREAS, evidenceTier, researchAreaLabel } from '@/lib/compounds';
import { PEPTIDE_GLOSSARY, PEPTIDE_FAQ, LEARN_GUIDES } from '@/lib/research-education';
import type { SearchDoc } from '@/lib/research-search';

// search_keywords / match_phrases are DB columns not in the Compound TS type.
type CompoundSearchExtras = { search_keywords?: string[]; match_phrases?: string[] };

export function buildResearchSearchDocs(compounds: Compound[]): SearchDoc[] {
  const docs: SearchDoc[] = [];

  for (const c of compounds) {
    const extra = c as unknown as CompoundSearchExtras;
    const tier = evidenceTier(c.evidence_tier);
    const haystack = [
      c.plain_summary,
      c.mechanism,
      c.benefits,
      (c.studied_for || []).join(', '),
      (c.research_areas || []).map(researchAreaLabel).join(', '),
      c.compound_class,
      c.molecular_target,
      c.half_life,
      c.pk_summary,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    docs.push({
      id: `compound:${c.slug}`,
      type: c.is_stack ? 'stack' : 'compound',
      title: c.display_name,
      subtitle: c.category || c.compound_class || (c.is_stack ? 'Stack' : 'Compound'),
      url: `/research/${c.slug}`,
      haystack,
      keywords: [
        ...(c.aliases || []),
        ...(extra.search_keywords || []),
        ...(extra.match_phrases || []),
        ...(c.studied_for || []),
        ...(c.research_areas || []).map(researchAreaLabel),
      ],
      badge: tier.label,
    });
  }

  for (const key of Object.keys(RESEARCH_AREAS)) {
    const meta = RESEARCH_AREAS[key];
    docs.push({
      id: `area:${key}`,
      type: 'area',
      title: meta.label,
      subtitle: 'Research Area',
      url: `/research/area/${key}`,
      haystack: meta.blurb.toLowerCase(),
      keywords: [key.replace(/_/g, ' ')],
    });
  }

  for (const g of LEARN_GUIDES) {
    const body = [g.intro, ...g.sections.map((s) => `${s.heading} ${s.body}`)].join(' ').toLowerCase();
    docs.push({
      id: `guide:${g.slug}`,
      type: 'guide',
      title: g.title,
      subtitle: 'Learn Guide',
      url: `/research/learn#${g.slug}`,
      haystack: body,
    });
  }

  for (const e of PEPTIDE_GLOSSARY) {
    docs.push({
      id: `term:${e.term}`,
      type: 'term',
      title: e.term,
      subtitle: 'Glossary Term',
      url: '/research/glossary',
      haystack: e.def.toLowerCase(),
    });
  }

  for (let i = 0; i < PEPTIDE_FAQ.length; i++) {
    const f = PEPTIDE_FAQ[i];
    docs.push({
      id: `faq:${i}`,
      type: 'faq',
      title: f.q,
      subtitle: f.category,
      url: '/research/faq',
      haystack: f.a.toLowerCase(),
    });
  }

  // Tools & sections — so the search doubles as navigation.
  const TOOLS: { title: string; url: string; subtitle: string; keywords: string[] }[] = [
    { title: 'Search Everything', url: '/research/search', subtitle: 'Universal Search', keywords: ['search', 'find', 'lookup'] },
    { title: 'Full Data Table', url: '/research/data', subtitle: 'Sortable Database', keywords: ['table', 'database', 'sort', 'filter', 'grid', 'spreadsheet', 'all compounds'] },
    { title: 'Compare Compounds', url: '/research/compare', subtitle: 'Side-By-Side', keywords: ['compare', 'versus', 'vs', 'side by side', 'difference'] },
    { title: 'Stacks & Combinations', url: '/research/stacks', subtitle: 'Combinations', keywords: ['stack', 'combination', 'combo', 'protocol'] },
    { title: 'Evidence & Safety', url: '/research/evidence', subtitle: 'Evidence Hub', keywords: ['evidence', 'safety', 'wada', 'prohibited', 'risk'] },
    { title: 'Dosing & Unit Converter', url: '/research/converter', subtitle: 'Calculator', keywords: ['converter', 'calculator', 'dose', 'dosing', 'mg', 'mcg', 'iu', 'reconstitution', 'units'] },
    { title: 'References Library', url: '/research/references', subtitle: 'Citations', keywords: ['references', 'sources', 'citations', 'bibliography', 'studies'] },
    { title: 'Match Me To A Peptide', url: '/research/match', subtitle: 'Goal Matcher', keywords: ['match', 'recommend', 'suggestion', 'goal', 'which peptide'] },
    { title: 'Learn', url: '/research/learn', subtitle: 'Education Hub', keywords: ['learn', 'guide', 'education', 'how to', 'basics'] },
    { title: 'Glossary', url: '/research/glossary', subtitle: 'Term Reference', keywords: ['glossary', 'terms', 'definitions'] },
    { title: 'FAQ', url: '/research/faq', subtitle: 'Questions', keywords: ['faq', 'questions', 'help'] },
    { title: 'Research Areas', url: '/research/areas', subtitle: 'Browse By Area', keywords: ['areas', 'categories', 'browse'] },
  ];
  for (const t of TOOLS) {
    docs.push({
      id: `tool:${t.url}`,
      type: 'tool',
      title: t.title,
      subtitle: t.subtitle,
      url: t.url,
      haystack: `${t.title} ${t.subtitle} ${t.keywords.join(' ')}`.toLowerCase(),
      keywords: t.keywords,
    });
  }

  return docs;
}
