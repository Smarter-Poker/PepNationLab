/**
 * Per-compound bibliography page. Lists every compound_references row for
 * the compound with CitationExportButton for each.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCompound } from '@/lib/compounds-server';

import CompoundReferencesClient from '@/components/research/CompoundReferencesClient';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const compound = await getCompound(slug);
  const name = compound?.display_name ?? 'Compound';
  return {
    title: `Bibliography For ${name} | Research Library | Pep Nation Lab`,
    robots: { index: false, follow: true },
  };
}

export const dynamic = 'force-dynamic';

interface ReferenceRow {
  id: string;
  compound_slug: string;
  ref_type: string | null;
  authors: string | string[] | null;
  title: string | null;
  journal: string | null;
  year: number | string | null;
  pmid: string | null;
  doi: string | null;
  url: string | null;
  volume: string | null;
  pages: string | null;
  is_pivotal?: boolean | null;
}

export default async function CompoundReferencesPage({ params }: PageProps) {
  const { slug } = await params;
  const compound = await getCompound(slug);
  if (!compound) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from('compound_references')
    .select('id, compound_slug, ref_type, authors, title, journal, year, pmid, doi, url, volume, pages, is_pivotal')
    .eq('compound_slug', slug)
    .order('year', { ascending: false, nullsFirst: false });

  const refs = (data ?? []) as ReferenceRow[];
  const types = Array.from(new Set(refs.map((r) => r.ref_type).filter(Boolean) as string[])).sort();

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href={`/research/${slug}`} style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To {compound.display_name} Monograph
        </Link>
      </nav>
      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          Bibliography For {compound.display_name}
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          Every Curated Peer-Reviewed Reference Indexed For This Compound. Each Citation Can Be Exported In BibTeX, RIS, EndNote, Or Plain Text.
        </p>
      </header>

      {types.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: 'var(--space-4, 16px)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)', marginRight: 6 }}>Indexed Types:</span>
          {types.map((t) => (
            <span key={t} className="glass-panel" style={{ padding: '4px 10px', borderRadius: 999, color: 'var(--teal, #00C4BC)', fontSize: '0.8rem', textTransform: 'capitalize' }}>
              {t}
            </span>
          ))}
        </div>
      )}

      {refs.length === 0 ? (
        <div className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', color: 'var(--silver, #A8B4C0)' }}>
          No References Currently Indexed For This Compound. The PubMed Sync Cron Will Populate Citations Weekly.
        </div>
      ) : (
        <CompoundReferencesClient references={refs} slug={slug} />
      )}
    </div>
  );
}
