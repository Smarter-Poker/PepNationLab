/**
 * Compound monograph - the full Research-Use-Only detail page for one compound.
 *
 * Server component. Renders:
 *   - MedicalSubstance JSON-LD (SEO entity for Google / Bing / ChatGPT indexers)
 *   - MonographTabs (existing tabbed prose detail)
 *   - SequenceMotifViewer (peptides only)
 *   - MechanismSVG (mechanism / receptor flow)
 *   - PKChart (pharmacokinetic decay curve, if Cmax/Tmax/half-life present)
 *   - ReceptorAffinityHeatmap (ChEMBL bindings)
 *   - CompoundKnowledgePanel (right-rail at-a-glance card)
 *   - ConfidenceBand on every reference
 *   - "Save", "Add To Reading Queue", "Subscribe" personalization buttons
 */

import { notFound } from 'next/navigation';
import { getCompound, getAllCompounds, getCompoundBindings } from '@/lib/compounds-server';
import { relatedCompounds } from '@/lib/compounds';
import MonographTabs from '@/components/research/MonographTabs';
import CompoundKnowledgePanel from '@/components/research/CompoundKnowledgePanel';
import CompoundCityLinks from '@/components/CompoundCityLinks';
import SequenceMotifViewer from '@/components/research/SequenceMotifViewer';
import MechanismSVG from '@/components/research/MechanismSVG';
import { PKChart, ReceptorAffinityHeatmap } from '@/components/research/LazyCharts';
import SaveToCollectionButton from '@/components/research/SaveToCollectionButton';
import AddToReadingQueueButton from '@/components/research/AddToReadingQueueButton';
import SubscribeButton from '@/components/research/SubscribeButton';
import PinToCompareButton from '@/components/research/PinToCompareButton';
import ResearchCartButton from '@/components/research/ResearchCartButton';
import MonographSeoContent from '@/components/research/MonographSeoContent';
import MonographCitations from '@/components/research/MonographCitations';

// ISR: monographs are static reference content that changes rarely. Pre-render
// every compound at build and revalidate hourly. This ships full, instant HTML
// to search engines and non-JS AI crawlers (previously force-dynamic streamed
// the body, which lightweight fetchers truncated) and dramatically improves
// Core Web Vitals. dynamicParams=true renders any new/unknown slug on demand
// and caches it at the edge.
export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const all = await getAllCompounds();
    return all.map((compound) => ({ slug: compound.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const compound = await getCompound(slug);
  if (!compound) return { title: 'Compound | Research | Pep Nation Lab', robots: { index: false } };
  const name = compound.display_name;
  const summary = (compound.plain_summary ?? '').slice(0, 155);
  // Open this monograph to indexing - it's pure RUO reference content.
  return {
    title: `${name} | Research Library | Pep Nation Lab`,
    description: summary || `${name} research-use-only reference: mechanism, evidence, handling, and references.`,
    keywords: [name, ...(compound.aliases ?? []).slice(0, 4), 'research peptide', 'RUO compound', 'peptide research', 'Pep Nation Lab'].join(', '),
    robots: { index: true, follow: true },
    alternates: { 
      canonical: `https://pepnationlab.com/research/${slug}`,
      types: {
        'text/markdown': `https://pepnationlab.com/api/llm/compound/${slug}`,
      },
    },
    openGraph: {
      title: `${name} - Research Reference | Pep Nation Lab`,
      description: summary || `${name} research-use-only reference: mechanism, evidence, handling, and references.`,
      url: `https://pepnationlab.com/research/${slug}`,
      type: 'article',
      images: [{ url: '/og-card.png', width: 1200, height: 630, alt: `${name} Research Reference - Pep Nation Lab` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} | Pep Nation Lab Research Library`,
      description: summary || `${name} RUO research reference: mechanism, evidence tier, and handling data.`,
      images: ['/og-card.png'],
    },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const compound = await getCompound(slug);
  if (!compound) notFound();

  const all = await getAllCompounds();
  const related = relatedCompounds(compound, all);

  // Server-fetch the Wave 2 enriched data (bindings + structures); fail-soft.
  const [bindingsRes] = await Promise.all([
    getCompoundBindings(slug),
  ]);
  const bindings = bindingsRes as Array<{
    target_name: string;
    standard_type: string | null;
    standard_value: number | null;
    standard_units: string | null;
    pchembl_value: number | null;
    target_organism: string | null;
  }>;


  // Build MedicalSubstance JSON-LD - only emit fields that exist on the row.
  const c: Record<string, unknown> = compound as unknown as Record<string, unknown>;
  const medicalSubstance: Record<string, unknown> = {
    '@type': 'MedicalSubstance',
    '@id': `https://pepnationlab.com/research/${compound.slug}#substance`,
    name: compound.display_name,
    identifier: compound.slug,
    url: `https://pepnationlab.com/research/${compound.slug}`,
  };
  if (compound.aliases && compound.aliases.length > 0) medicalSubstance.alternateName = compound.aliases;
  if (compound.plain_summary) medicalSubstance.description = compound.plain_summary;
  if (compound.mechanism) medicalSubstance.mechanismOfAction = compound.mechanism;
  if (compound.warnings) medicalSubstance.warning = compound.warnings;
  if (compound.side_effects) medicalSubstance.adverseOutcome = compound.side_effects;
  const codes: Array<Record<string, unknown>> = [];
  if (c.chembl_id) codes.push({ '@type': 'MedicalCode', codingSystem: 'ChEMBL', codeValue: c.chembl_id });
  if (c.uniprot_id) codes.push({ '@type': 'MedicalCode', codingSystem: 'UniProt', codeValue: c.uniprot_id });
  if (c.unii) codes.push({ '@type': 'MedicalCode', codingSystem: 'UNII', codeValue: c.unii });
  if (codes.length > 0) medicalSubstance.code = codes;

  // Directive C: ChemicalSubstance - lets AI crawlers treat this as a molecular
  // entity (weight, sequence, identifiers) rather than generic web copy.
  const chemicalSubstance: Record<string, unknown> = {
    '@type': 'ChemicalSubstance',
    '@id': `https://pepnationlab.com/research/${compound.slug}#chemical`,
    name: compound.display_name,
    url: `https://pepnationlab.com/research/${compound.slug}`,
  };
  if (compound.aliases && compound.aliases.length > 0) chemicalSubstance.alternateName = compound.aliases;
  const mw = (c.molecular_weight_da as number | null) ?? compound.identity?.molecular_weight ?? null;
  if (mw != null) {
    const mwNum = typeof mw === 'number' ? mw : parseFloat(String(mw));
    chemicalSubstance.molecularWeight = Number.isFinite(mwNum)
      ? { '@type': 'QuantitativeValue', value: mwNum, unitText: 'Da' }
      : mw;
  }
  const seqOne = (c.sequence_one_letter as string | null) ?? compound.identity?.sequence ?? null;
  if (seqOne) chemicalSubstance.description = `Amino acid sequence: ${seqOne}`;
  if (compound.identity?.cas) chemicalSubstance.identifier = compound.identity.cas;
  const sameAs: string[] = [];
  if (c.chembl_id) sameAs.push(`https://www.ebi.ac.uk/chembl/compound_report_card/${c.chembl_id}/`);
  if (c.uniprot_id) sameAs.push(`https://www.uniprot.org/uniprotkb/${c.uniprot_id}/entry`);
  if (sameAs.length > 0) chemicalSubstance.sameAs = sameAs;

  // Directive C: Dataset - declares this monograph as a structured research
  // data record, part of the larger compound database, for Google Dataset
  // Search and dataset-aware AI crawlers.
  const dataset: Record<string, unknown> = {
    '@type': 'Dataset',
    '@id': `https://pepnationlab.com/research/${compound.slug}#dataset`,
    name: `${compound.display_name} Research Data`,
    description:
      compound.plain_summary ??
      `Structured research reference data for ${compound.display_name}: mechanism, evidence tier, pharmacokinetics, molecular identity, and references. In vitro research use only.`,
    url: `https://pepnationlab.com/research/${compound.slug}`,
    isPartOf: { '@id': 'https://pepnationlab.com/research/catalog#dataset' },
    license: 'https://pepnationlab.com/terms',
    isAccessibleForFree: true,
    creator: { '@id': 'https://pepnationlab.com/#organization' },
    about: { '@id': `https://pepnationlab.com/research/${compound.slug}#chemical` },
    keywords: [compound.display_name, ...(compound.aliases ?? []), 'research peptide', compound.category ?? 'research compound']
      .filter(Boolean)
      .join(', '),
    variableMeasured: ['Molecular Weight', 'Amino Acid Sequence', 'Half-Life', 'Mechanism Of Action', 'Evidence Tier'],
  };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'MedicalWebPage',
        '@id': `https://pepnationlab.com/research/${compound.slug}#webpage`,
        name: `${compound.display_name} | Research Library | Pep Nation Lab`,
        url: `https://pepnationlab.com/research/${compound.slug}`,
        description: compound.plain_summary ?? `${compound.display_name} research-use-only reference for qualified researchers.`,
        isPartOf: { '@id': 'https://pepnationlab.com/#website' },
        about: { '@id': `https://pepnationlab.com/research/${compound.slug}#substance` },
        // E-E-A-T / YMYL trust signals: identify who publishes and maintains
        // this reference. reviewedBy + maintainer point to the organization
        // entity; lastReviewed communicates content freshness to Google and
        // AI answer engines.
        publisher: { '@id': 'https://pepnationlab.com/#organization' },
        reviewedBy: { '@id': 'https://pepnationlab.com/#organization' },
        maintainer: { '@id': 'https://pepnationlab.com/#organization' },
        lastReviewed: new Date().toISOString().slice(0, 10),
        audience: {
          '@type': 'Audience',
          audienceType: 'Qualified Researchers And Scientific Institutions',
        },
        speakable: {
          '@type': 'SpeakableSpecification',
          cssSelector: ['h1', '.compound-summary', '.mechanism-text'],
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pepnationlab.com' },
          { '@type': 'ListItem', position: 2, name: 'Research Library', item: 'https://pepnationlab.com/research' },
          { '@type': 'ListItem', position: 3, name: compound.display_name, item: `https://pepnationlab.com/research/${compound.slug}` },
        ],
      },
      medicalSubstance,
      chemicalSubstance,
      dataset,
    ],
  };


  // Pull the most-recent PK numbers off the compound row (Wave 1 columns).
  const tmax = (c.tmax_hours as number | null) ?? null;
  const halfLife = (c.measured_half_life_hours as number | null) ?? (c.predicted_half_life_hours as number | null) ?? null;
  const cmax = (c.cmax_ng_ml as number | null) ?? null;
  const sequence = (c.sequence_one_letter as string | null) ?? compound.identity?.sequence ?? null;
  const receptors = ((c.receptors as string[] | null) ?? []).filter(Boolean);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--black)' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Server-rendered SEO content: emits the core compound prose into the
          initial HTML so non-JS AI crawlers (GPTBot, ClaudeBot, PerplexityBot)
          and search engines can read the substance without executing the
          client-rendered tabs below. */}
      <MonographSeoContent compound={compound} />

      {/* Directive D: server-visible, Omega-compliant citation anchors so AI
          crawlers see the outbound PubMed/NCBI authority links in the initial
          HTML. Clicks are intercepted into IframeModal (never navigate away). */}
      <MonographCitations sources={compound.sources ?? []} compoundName={compound.display_name} />

      <MonographTabs compound={compound} related={related} />

      {/* Personalization rail - server emits markup; the buttons handle auth themselves. */}
      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: 'var(--space-4, 16px)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-2, 8px)',
        }}
      >
        <SaveToCollectionButton compoundSlug={compound.slug} compoundName={compound.display_name} />
        <AddToReadingQueueButton compoundSlug={compound.slug} compoundName={compound.display_name} />
        <SubscribeButton compoundSlug={compound.slug} compoundName={compound.display_name} />
        <PinToCompareButton
          compoundSlug={compound.slug}
          compoundName={compound.display_name}
          evidenceTierKey={compound.evidence_tier}
          category={compound.category}
        />
        <ResearchCartButton
          productName={compound.display_name}
        />
      </div>

      {/* Visualization rail - each component fails gracefully when its data is missing. */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 var(--space-4, 16px) var(--space-6, 32px)', display: 'grid', gap: 'var(--space-4, 16px)' }}>
        {sequence && typeof sequence === 'string' && sequence.length >= 3 && (
          <SequenceMotifViewer sequence={sequence} />
        )}
        {(compound.mechanism || receptors.length > 0) && (
          <MechanismSVG mechanism={compound.mechanism ?? ''} receptors={receptors} />
        )}
        {(tmax !== null || halfLife !== null || cmax !== null) && (
          <PKChart tmaxHours={tmax} halfLifeHours={halfLife} cmaxNgMl={cmax} />
        )}
        {bindings.length > 0 && <ReceptorAffinityHeatmap bindings={bindings} />}
      </div>

      {/* Internal Linking Strategy - Cross-link to Local SEO landing pages */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 var(--space-4, 16px) var(--space-6, 32px)' }}>
        <CompoundCityLinks compoundName={compound.display_name} />
      </div>

      {/* Right-rail knowledge panel - desktop only via CSS in the component. */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 var(--space-4, 16px) var(--space-7, 48px)' }}>
        <CompoundKnowledgePanel compound={compound} />
      </div>
    </div>
  );
}
