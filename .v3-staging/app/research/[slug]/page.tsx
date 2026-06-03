/**
 * Compound monograph -- the full Research-Use-Only detail page for one compound.
 *
 * v3 (2026-06-03):
 *   - Adds JSON-LD MedicalSubstance schema for search engines.
 *   - Adds a right-rail <CompoundKnowledgePanel> on desktop.
 *   - Adds a <BrowseSurfaceNav> strip at the bottom.
 *
 * Server component: fetches the compound by slug, then hands off to the client
 * MonographTabs component, which presents the data in tabbed, short-paragraph
 * sections (Overview, Mechanism, Studied For, Handling, Safety, Sources) with a
 * sticky Back control. No human dosing -- research use only.
 */
import { notFound } from 'next/navigation';
import { getCompound, getAllCompounds } from '@/lib/compounds-server';
import { relatedCompounds } from '@/lib/compounds';
import MonographTabs from '@/components/research/MonographTabs';
import CompoundKnowledgePanel from '@/components/research/CompoundKnowledgePanel';
import BrowseSurfaceNav from '@/components/research/BrowseSurfaceNav';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const compound = await getCompound(slug);
  const name = compound?.display_name ?? 'Compound';
  return {
    title: `${name} | Research | Pep Nation Lab`,
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const compound = await getCompound(slug);
  if (!compound) notFound();

  const all = await getAllCompounds();
  const related = relatedCompounds(compound, all);

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'MedicalSubstance',
    name: compound.display_name,
    description: compound.plain_summary ?? undefined,
    alternateName: compound.aliases && compound.aliases.length > 0 ? compound.aliases : undefined,
    mechanismOfAction: compound.mechanism ?? undefined,
  };
  const chemblId = (compound as unknown as { chembl_id?: string | null }).chembl_id;
  if (chemblId) {
    jsonLd.drug = { '@type': 'Drug', code: { '@type': 'MedicalCode', codeValue: chemblId, codingSystem: 'ChEMBL' } };
  }
  // Strip undefined keys.
  for (const k of Object.keys(jsonLd)) {
    if (jsonLd[k] === undefined) delete jsonLd[k];
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--black)' }}>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="monograph-grid">
        <div className="monograph-main">
          <MonographTabs compound={compound} related={related} />
        </div>
        <aside className="monograph-rail" aria-label="Compound Knowledge Panel">
          <CompoundKnowledgePanel compound={compound} />
        </aside>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '8px 16px 48px' }}>
        <h2 style={{
          fontSize: 16,
          color: '#FFFFFF',
          margin: '0 0 4px',
          fontWeight: 800,
        }}>
          Explore More Of The Research Library
        </h2>
        <BrowseSurfaceNav compact />
      </div>

      <style>{`
        .monograph-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          max-width: 1240px;
          margin: 0 auto;
          padding: 0 16px;
        }
        .monograph-main { min-width: 0; }
        .monograph-rail { display: none; }
        @media (min-width: 1024px) {
          .monograph-grid {
            grid-template-columns: minmax(0, 1fr) 320px;
          }
          .monograph-rail {
            display: block;
            padding-top: 24px;
          }
        }
      `}</style>
    </div>
  );
}
