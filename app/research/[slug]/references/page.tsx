/**
 * Per-compound bibliography page. Lists every compound_references row for
 * the compound with CitationExportButton for each.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { unstable_cache } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { getCompound, supabaseEnvReady } from '@/lib/compounds-server';

import CompoundReferencesClient from '@/components/research/CompoundReferencesClient';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const compound = await getCompound(slug);
  const name = compound?.display_name ?? 'Compound';
  const description = `Complete bibliography for ${name} — curated peer-reviewed references, PubMed citations, regulatory sources, and clinical literature. Research Use Only.`;
  return {
    title: `Bibliography For ${name} | Research Library | Pep Nation Lab`,
    description,
    robots: { index: true, follow: true },
    alternates: { canonical: `https://pepnationlab.com/research/${slug}/references` },
  };
}

// ISR: this bibliography reads only the public compound_references table, which
// is refreshed by the weekly sync crons - no per-request/cookie data - so it is
// safe to statically cache and revalidate hourly instead of rendering dynamically.
export const revalidate = 3600;
export const dynamicParams = true;

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

// Cached fetcher: the service client is constructed INSIDE unstable_cache so
// the query runs in the Data Cache scope (the proven ISR pattern from
// lib/compounds-server.ts) - a raw createServerClient call at render time
// breaks static prerendering. Keyed by slug (args are part of the cache key).
const getCompoundReferences = unstable_cache(
  async (slug: string) => {
    // Env-less builds (e.g. Vercel Preview without the service key) prerender
    // to an empty list instead of crashing - same guard as compounds-server.
    if (!supabaseEnvReady()) return [];
    const supabase = await createServiceClient();
    const { data } = await supabase
      .from('compound_references')
      .select('id, compound_slug, ref_type, authors, title, journal, year, pmid, doi, url, volume, pages, is_pivotal')
      .eq('compound_slug', slug)
      .order('year', { ascending: false, nullsFirst: false });
    return data ?? [];
  },
  ['research-compound-references'],
  { revalidate: 3600, tags: ['compounds'] }
);

export default async function CompoundReferencesPage({ params }: PageProps) {
  const { slug } = await params;
  const compound = await getCompound(slug);
  if (!compound) notFound();

  const refs = (await getCompoundReferences(slug)) as ReferenceRow[];
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
          No References Are Currently Indexed For This Compound. Citations Are Added Periodically As New Research Is Published.
        </div>
      ) : (
        <CompoundReferencesClient references={refs} slug={slug} />
      )}
    </div>
  );
}
