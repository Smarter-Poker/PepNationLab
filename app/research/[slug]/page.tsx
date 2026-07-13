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

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCompound, getAllCompounds, getCompoundBindings } from '@/lib/compounds-server';
import { relatedCompounds } from '@/lib/compounds';
import { COMPARISON_PAIRS, matchupSlug } from '@/lib/research/comparisons';
import MonographTabs from '@/components/research/MonographTabs';
import CompoundKnowledgePanel from '@/components/research/CompoundKnowledgePanel';
import CompoundCityLinks from '@/components/CompoundCityLinks';
import SequenceMotifViewer from '@/components/research/SequenceMotifViewer';
import MechanismSVG from '@/components/research/MechanismSVG';
import { PKChart, ReceptorAffinityHeatmap } from '@/components/research/LazyCharts';
import SaveToCollectionButton from '@/components/research/SaveToCollectionButton';
import AddToReadingQueueButton from '@/components/research/AddToReadingQueueButton';
import MarkQueueRead from '@/components/research/MarkQueueRead';
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
  const raw = compound.plain_summary ?? '';
  const clipped = raw.length > 130 ? raw.slice(0, 130).replace(/\s+\S*$/, '') + '...' : raw;
  const description = clipped
    ? `${name}: ${clipped} Research Use Only.`
    : `${name} research-use-only reference: mechanism, evidence, handling, and references.`;
  // Open this monograph to indexing - it's pure RUO reference content.
  return {
    title: `${name} | Research Library | Pep Nation Lab`,
    description,
    keywords: [name, ...(compound.aliases ?? []).slice(0, 4), 'research peptide', 'RUO compound', 'peptide research', 'Pep Nation Lab'].join(', '),
    robots: { index: true, follow: true },
    alternates: { 
      canonical: `https://pepnationlab.com/research/${slug}`,
      types: {
        'text/markdown': `https://pepnationlab.com/api/llm/compound/${slug}`,
      },
    },
    // NOTE: no `images` here on purpose - the file-based opengraph-image.tsx
    // in this route segment generates a unique per-compound OG card. Declaring
    // a static image in metadata would override and kill the dynamic one.
    openGraph: {
      title: `${name} - Research Reference | Pep Nation Lab`,
      description,
      url: `https://pepnationlab.com/research/${slug}`,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} | Pep Nation Lab Research Library`,
      description,
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

  // FAQ built ONLY from fields this compound actually has -- never fabricated.
  // Every entry is also rendered visibly further down the page, so the FAQPage
  // schema below describes on-page content (Google requires this). Drives
  // People-Also-Ask placements and AI answer-engine citations across every
  // compound page.
  const faqEntries: Array<{ q: string; a: string }> = [];
  if (compound.plain_summary) {
    faqEntries.push({ q: `What Is ${compound.display_name}?`, a: compound.plain_summary });
  }
  if (compound.mechanism) {
    faqEntries.push({ q: `How Does ${compound.display_name} Work?`, a: compound.mechanism });
  }
  if ((compound.studied_for ?? []).length > 0) {
    faqEntries.push({
      q: `What Has ${compound.display_name} Been Studied For?`,
      a: `In the referenced literature, ${compound.display_name} has been studied for ${(compound.studied_for ?? []).join(', ')}. This summarizes research focus only and is not a claim of efficacy.`,
    });
  }
  if (compound.half_life) {
    faqEntries.push({
      q: `What Is The Reported Half-Life Of ${compound.display_name}?`,
      a: `${compound.display_name} has a reported half-life of ${compound.half_life} in the referenced literature.`,
    });
  }
  faqEntries.push({
    q: `Is ${compound.display_name} Approved For Human Use?`,
    a: `No. ${compound.display_name} is supplied strictly for in vitro laboratory research use only. It is not intended for human or animal consumption, ingestion, or injection, and it has not been evaluated by the FDA.`,
  });

  const faqJsonLd = faqEntries.length >= 2
    ? {
        '@type': 'FAQPage',
        '@id': `https://pepnationlab.com/research/${compound.slug}#faq`,
        mainEntity: faqEntries.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      }
    : null;

  // Curated "X vs Y" comparison pages that feature this compound. Surfacing
  // them here links high-intent comparison pages into the monograph cluster
  // (they were previously reachable only from the compare hub + sitemap).
  const compareLinks = COMPARISON_PAIRS
    .filter((p) => p.a === compound.slug || p.b === compound.slug)
    .map((p) => {
      const otherSlug = p.a === compound.slug ? p.b : p.a;
      const other = all.find((x) => x.slug === otherSlug);
      if (!other) return null;
      return { href: `/research/compare/${matchupSlug(p.a, p.b)}`, name: other.display_name };
    })
    .filter((x): x is { href: string; name: string } => x !== null);

  // Content freshness pulled from the compound row itself (updated_at /
  // created_at) - never fabricated from the render date.
  const freshness = compound as { updated_at?: string | null; created_at?: string | null };
  const reviewedDate = (freshness.updated_at ?? freshness.created_at)?.slice(0, 10) ?? null;
  const publishedDate = freshness.created_at?.slice(0, 10) ?? null;

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
        ...(reviewedDate ? { lastReviewed: reviewedDate, dateModified: reviewedDate } : {}),
        ...(publishedDate ? { datePublished: publishedDate } : {}),
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
      ...(faqJsonLd ? [faqJsonLd] : []),
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
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
        <MarkQueueRead compoundSlug={compound.slug} />
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

      {/* Curated comparison pages featuring this compound. Server-rendered so
          crawlers see the links, and it pulls high-intent "X vs Y" pages into
          the monograph's internal-link cluster. */}
      {compareLinks.length > 0 && (
        <section
          aria-label={`Compare ${compound.display_name} With Other Compounds`}
          style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 var(--space-4, 16px) var(--space-6, 32px)' }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--white, #FFFFFF)', margin: '0 0 12px' }}>
            Compare {compound.display_name}
          </h2>
          <ul style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 18px', listStyle: 'none', padding: 0, margin: 0 }}>
            {compareLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} style={{ color: 'var(--teal, #00C4BC)', fontWeight: 600, textDecoration: 'none' }}>
                  {compound.display_name} vs {l.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Visible FAQ. Mirrors the FAQPage JSON-LD emitted above -- schema must
          describe content that is actually on the page. Also gives non-JS AI
          crawlers a clean, quotable Q&A block. */}
      {faqJsonLd && (
        <section
          aria-label={`${compound.display_name} Frequently Asked Questions`}
          style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 var(--space-4, 16px) var(--space-6, 32px)' }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--white, #FFFFFF)', margin: '0 0 12px' }}>
            {compound.display_name} Frequently Asked Questions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {faqEntries.map((f) => (
              <details key={f.q} style={{ border: '1px solid rgba(192,184,168,0.14)', borderRadius: 10, padding: '14px 16px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '0.98rem', color: 'var(--white, #FFFFFF)' }}>
                  {f.q}
                </summary>
                <p style={{ margin: '10px 0 0', lineHeight: 1.65, fontSize: '0.92rem', color: 'var(--silver-light, #D0DAE4)' }}>
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </section>
      )}

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
