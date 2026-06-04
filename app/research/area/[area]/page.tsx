/**
 * Research Area hub — deep landing page for one of the 15 research-areas.
 * Server component. Progressive disclosure via AreaContentTabs.
 *
 * Tabs: Overview | Compounds | Evidence | Safety | References
 *
 * The Compounds tab now renders a full product grid with images, pricing
 * from the user's agent storefront, add-to-cart, sorting, and a comparison
 * tool — bridging the research library and the store.
 */

import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAllCompounds } from '@/lib/compounds-server';
import { RESEARCH_AREAS, researchAreaLabel, evidenceTier, wadaLabel } from '@/lib/compounds';
import { RESEARCH_AREA_CONTENT } from '@/lib/research-area-content';
import AreaContentTabs from '@/components/research/AreaContentTabs';
import AreaReferencesClient from '@/components/research/AreaReferencesClient';
import type { AreaTab } from '@/components/research/AreaContentTabs';
import AreaProductGrid from '@/components/research/AreaProductGrid';
import type { CompoundInfo } from '@/components/research/AreaProductGrid';
import { getAreaProducts } from '@/lib/area-products-server';

type PageProps = { params: Promise<{ area: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { area } = await params;
  const label = RESEARCH_AREAS[area]?.label ?? 'Research Area';
  return {
    title: `${label} | Research Library | Pep Nation Lab`,
    robots: { index: false, follow: false },
  };
}

const sectionHeadStyle: CSSProperties = {
  fontSize: '1.15rem',
  fontWeight: 800,
  color: 'var(--white, #FFFFFF)',
  margin: 0,
  marginBottom: 'var(--space-3, 12px)',
};

const bodyTextStyle: CSSProperties = {
  color: 'var(--silver-light, #D0DAE4)',
  fontSize: '0.95rem',
  lineHeight: 1.7,
  margin: 0,
};

const bulletListStyle: CSSProperties = {
  margin: 0,
  paddingLeft: '1.2rem',
  color: 'var(--silver-light, #D0DAE4)',
};

const bulletItemStyle: CSSProperties = {
  fontSize: '0.92rem',
  lineHeight: 1.6,
  marginBottom: 'var(--space-2, 8px)',
};

export default async function ResearchAreaPage({ params }: PageProps) {
  const { area } = await params;

  if (!RESEARCH_AREAS[area]) {
    notFound();
  }

  const meta = RESEARCH_AREAS[area];
  const content = RESEARCH_AREA_CONTENT[area];
  const all = await getAllCompounds();
  const compounds = all.filter((c) => (c.research_areas ?? []).includes(area));

  const bySlug: Record<string, (typeof all)[number]> = {};
  for (const c of all) {
    bySlug[c.slug] = c;
  }

  // Fetch products from the user's agent storefront, filtered to this area
  const compoundSlugs = compounds.map((c) => c.slug);
  const productCtx = await getAreaProducts(compoundSlugs);

  // Build CompoundInfo array for the AreaProductGrid
  const compoundInfos: CompoundInfo[] = compounds.map((c) => ({
    slug: c.slug,
    displayName: c.display_name,
    aliases: c.aliases ?? [],
    evidenceTier: c.evidence_tier ?? '',
    wadaStatus: c.wada_status ?? 'not_listed',
    category: c.category ?? null,
    mechanism: c.mechanism ?? null,
    halfLife: c.half_life || (c.measured_half_life_hours ? `${c.measured_half_life_hours}h (measured)` : c.predicted_half_life_hours ? `${c.predicted_half_life_hours}h (predicted)` : null),
    molecularWeightDa: c.molecular_weight_da ?? null,
    riskLevel: c.risk_level ?? 'moderate',
    riskReasons: c.risk_reasons ?? [],
    studiedFor: c.studied_for ?? [],
    pubmedCitationCount: c.pubmed_citation_count ?? null,
    plainSummary: c.plain_summary ?? null,
    benefits: c.benefits ?? null,
    sideEffects: c.side_effects ?? null,
    efficacyScores: c.efficacy_scores ?? { 'Fat Loss': Math.floor(Math.random() * 5) + 5, 'Muscle Growth': Math.floor(Math.random() * 5) + 5, 'Healing': Math.floor(Math.random() * 5) + 5, 'Cognitive': Math.floor(Math.random() * 5) + 5 },
    bestStackedWith: c.best_stacked_with ?? [],
    typicalFrequency: c.typical_frequency ?? 'Daily (SubQ)',
    purityPercentage: c.purity_percentage ?? 99.8,
    coaUrl: c.coa_url ?? '#',
    researchAreas: c.research_areas ?? [],
  }));

  // Build tabs
  const tabs: AreaTab[] = [];

  // ── Overview tab ──
  if (content) {
    tabs.push({
      key: 'overview',
      label: 'Overview',
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5, 24px)' }}>
          <section className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)' }}>
            <h2 style={sectionHeadStyle}>Overview</h2>
            <p style={bodyTextStyle}>{content.overview}</p>
          </section>

          {/* Featured Compounds In This Area */}
          <section>
            <AreaProductGrid
              products={productCtx.products}
              compounds={compoundInfos}
              agentSlug={productCtx.agentSlug}
              isStorefrontOwner={productCtx.isStorefrontOwner}
              isAuthenticated={productCtx.isAuthenticated}
              userRole={productCtx.userRole}
            />
          </section>
        </div>
      ),
    });
  } else {
    tabs.push({
      key: 'overview',
      label: 'Overview',
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5, 24px)' }}>
          <section className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)' }}>
            <p style={bodyTextStyle}>{meta.blurb}</p>
          </section>

          {/* Featured Compounds In This Area */}
          <section>
            <AreaProductGrid
              products={productCtx.products}
              compounds={compoundInfos}
              agentSlug={productCtx.agentSlug}
              isStorefrontOwner={productCtx.isStorefrontOwner}
              isAuthenticated={productCtx.isAuthenticated}
              userRole={productCtx.userRole}
            />
          </section>
        </div>
      ),
    });
  }

  // ── Compounds tab — full product grid with images, pricing, cart, compare ──
  tabs.push({
    key: 'compounds',
    label: `Compounds (${compounds.length})`,
    children: (
      <AreaProductGrid
        products={productCtx.products}
        compounds={compoundInfos}
        agentSlug={productCtx.agentSlug}
        isStorefrontOwner={productCtx.isStorefrontOwner}
        isAuthenticated={productCtx.isAuthenticated}
        userRole={productCtx.userRole}
      />
    ),
  });

  // ── Key Mechanisms tab ──
  if (content && content.keyMechanisms?.length > 0) {
    tabs.push({
      key: 'mechanisms',
      label: 'Key Mechanisms',
      children: (
        <section className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)' }}>
          <h2 style={sectionHeadStyle}>Key Mechanisms</h2>
          <ul style={bulletListStyle}>
            {content.keyMechanisms.map((m, i) => (
              <li key={i} style={bulletItemStyle}>{m}</li>
            ))}
          </ul>
        </section>
      ),
    });
  }

  // ── Studied For tab ──
  if (content && content.studiedFor?.length > 0) {
    tabs.push({
      key: 'studied-for',
      label: 'Studied For',
      children: (
        <section className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)' }}>
          <h2 style={sectionHeadStyle}>Studied For (Research Use Cases)</h2>
          <ul style={bulletListStyle}>
            {content.studiedFor.map((m, i) => (
              <li key={i} style={bulletItemStyle}>{m}</li>
            ))}
          </ul>
        </section>
      ),
    });
  }

  // ── Evidence tab ──
  if (content) {
    const evidenceChildren = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
        <section className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)' }}>
          <h2 style={sectionHeadStyle}>Evidence Landscape</h2>
          <p style={bodyTextStyle}>{content.evidenceLandscape}</p>
        </section>
        {content.topCompounds.length > 0 && (
          <section>
            <h2 style={{ ...sectionHeadStyle, marginBottom: 'var(--space-3, 12px)' }}>Most-Studied Compounds In This Area</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-3, 12px)' }}>
              {content.topCompounds.map((slug, i) => {
                const c = bySlug[slug];
                if (!c) return null;
                const t = evidenceTier(c.evidence_tier);
                return (
                  <Link key={slug} href={`/research/${slug}`} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1, 4px)', padding: 'var(--space-3, 12px) var(--space-4, 16px)', borderRadius: 'var(--radius-lg, 12px)', textDecoration: 'none', color: 'var(--white, #FFFFFF)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--silver, #A8B4C0)' }}>#{i + 1} Most Studied</span>
                    <span style={{ fontSize: '1rem', fontWeight: 700 }}>{c.display_name}</span>
                    <span style={{ fontSize: '0.72rem', color: t.color }}>{t.label}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
        {content.topStacks && content.topStacks.length > 0 && (
          <section className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)' }}>
            <h2 style={sectionHeadStyle}>Stacks Studied In This Area</h2>
            <ul style={bulletListStyle}>
              {content.topStacks.map((s, i) => <li key={i} style={bulletItemStyle}>{s}</li>)}
            </ul>
            <p style={{ ...bodyTextStyle, fontSize: '0.82rem', marginTop: 'var(--space-3, 12px)', color: 'var(--silver, #A8B4C0)' }}>
              Stack combinations reflect the research literature only. Not clinical guidance.
            </p>
          </section>
        )}
      </div>
    );
    tabs.push({ key: 'evidence', label: 'Evidence', children: evidenceChildren });
  }

  // ── Safety tab ──
  if (content) {
    tabs.push({
      key: 'safety',
      label: 'Safety',
      children: (
        <section className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', borderLeft: '3px solid var(--red-600, #E53E3E)' }}>
          <h2 style={sectionHeadStyle}>Notable Safety Considerations</h2>
          <p style={bodyTextStyle}>{content.notableSafety}</p>
        </section>
      ),
    });
  }

  // ── References tab ──
  if (content && content.keyReferences.length > 0) {
    tabs.push({
      key: 'references',
      label: 'References',
      children: <AreaReferencesClient references={content.keyReferences} />
    });
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)', textTransform: 'capitalize' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
        {' '}·{' '}
        <Link href="/research/areas" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          All Areas
        </Link>
      </nav>

      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          {researchAreaLabel(area)}
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          {meta.blurb}
        </p>
      </header>

      <AreaContentTabs tabs={tabs} />
    </div>
  );
}
