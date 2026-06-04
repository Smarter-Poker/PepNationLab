/**
 * Compound monograph — the full Research-Use-Only detail page for one compound.
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
import SequenceMotifViewer from '@/components/research/SequenceMotifViewer';
import MechanismSVG from '@/components/research/MechanismSVG';
import PKChart from '@/components/research/PKChart';
import ReceptorAffinityHeatmap from '@/components/research/ReceptorAffinityHeatmap';
import SaveToCollectionButton from '@/components/research/SaveToCollectionButton';
import AddToReadingQueueButton from '@/components/research/AddToReadingQueueButton';
import SubscribeButton from '@/components/research/SubscribeButton';
import PinToCompareButton from '@/components/research/PinToCompareButton';
import ResearchCartButton from '@/components/research/ResearchCartButton';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const compound = await getCompound(slug);
  if (!compound) return { title: 'Compound | Research | Pep Nation Lab' };
  const name = compound.display_name;
  const summary = (compound.plain_summary ?? '').slice(0, 155);
  // Open this monograph to indexing — it's pure RUO reference content.
  return {
    title: `${name} | Research Library | Pep Nation Lab`,
    description: summary || `${name} research-use-only reference: mechanism, evidence, handling, and references.`,
    robots: { index: true, follow: true },
    alternates: { canonical: `https://pepnationlab.com/research/${slug}` },
    openGraph: {
      title: `${name} — Pep Nation Lab Research Library`,
      description: summary,
      url: `https://pepnationlab.com/research/${slug}`,
      type: 'article',
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


  // Build MedicalSubstance JSON-LD — only emit fields that exist on the row.
  const c: Record<string, unknown> = compound as unknown as Record<string, unknown>;
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'MedicalSubstance',
    name: compound.display_name,
    identifier: compound.slug,
    url: `https://pepnationlab.com/research/${compound.slug}`,
  };
  if (compound.aliases && compound.aliases.length > 0) jsonLd.alternateName = compound.aliases;
  if (compound.plain_summary) jsonLd.description = compound.plain_summary;
  if (compound.mechanism) jsonLd.mechanismOfAction = compound.mechanism;
  if (compound.warnings) jsonLd.warning = compound.warnings;
  if (compound.side_effects) jsonLd.adverseOutcome = compound.side_effects;
  const code: Record<string, unknown> = {};
  if (c.chembl_id) { code.codingSystem = 'ChEMBL'; code.codeValue = c.chembl_id; }
  if (c.uniprot_id) { code.codingSystem = 'UniProt'; code.codeValue = c.uniprot_id; }
  if (c.unii) { code.codingSystem = 'UNII'; code.codeValue = c.unii; }
  if (Object.keys(code).length > 0) jsonLd.code = code;

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

      <MonographTabs compound={compound} related={related} />

      {/* Personalization rail — server emits markup; the buttons handle auth themselves. */}
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
        />
        <ResearchCartButton
          productName={compound.display_name}
        />
      </div>

      {/* Visualization rail — each component fails gracefully when its data is missing. */}
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

      {/* Right-rail knowledge panel — desktop only via CSS in the component. */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 var(--space-4, 16px) var(--space-7, 48px)' }}>
        <CompoundKnowledgePanel compound={compound} />
      </div>
    </div>
  );
}
