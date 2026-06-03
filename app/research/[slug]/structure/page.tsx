/**
 * Per-compound dedicated 3D structure page. Wraps StructureViewer3D and
 * surfaces all PDB / AlphaFold metadata for the compound.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCompound } from '@/lib/compounds-server';
import StructureViewer3D from '@/components/research/StructureViewer3D';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const compound = await getCompound(slug);
  const name = compound?.display_name ?? 'Compound';
  return {
    title: `3D Structure Of ${name} | Research Library | Pep Nation Lab`,
    robots: { index: false, follow: false },
  };
}

export const dynamic = 'force-dynamic';

interface PdbRow {
  id: string;
  compound_slug: string;
  source: string | null;
  identifier: string | null;
  resolution_angstroms: number | null;
  experimental_method: string | null;
  title: string | null;
  release_year: number | null;
  url: string | null;
}

interface CompoundStructureMeta {
  pdb_ids: string[] | null;
  alphafold_id: string | null;
}

export default async function CompoundStructurePage({ params }: PageProps) {
  const { slug } = await params;
  const compound = await getCompound(slug);
  if (!compound) notFound();

  const supabase = await createClient();
  const m = (compound ?? {}) as unknown as CompoundStructureMeta;

  const { data: pdbRows } = await supabase
    .from('compound_pdb_structures')
    .select('id, compound_slug, source, identifier, resolution_angstroms, experimental_method, title, release_year, url')
    .eq('compound_slug', slug)
    .order('release_year', { ascending: false, nullsFirst: false });

  const pdbs = (pdbRows ?? []) as PdbRow[];

  const primaryPdb = (m.pdb_ids && m.pdb_ids[0]) || pdbs.find((p) => p.source?.toLowerCase().includes('rcsb'))?.identifier || null;
  const primaryAf = m.alphafold_id ?? pdbs.find((p) => p.source?.toLowerCase().includes('alpha'))?.identifier ?? null;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href={`/research/${slug}`} style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To {compound.display_name} Monograph
        </Link>
      </nav>
      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          3D Structure Of {compound.display_name}
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          Interactive Three-Dimensional Render. Sourced From The Protein Data Bank Or AlphaFold Predicted Structures.
        </p>
      </header>

      <section style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <StructureViewer3D
          pdbId={primaryPdb}
          alphafoldId={primaryAf}
          sequence={compound.identity?.sequence ?? null}
          height={520}
        />
      </section>

      {pdbs.length > 0 && (
        <section>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--teal, #00C4BC)', marginBottom: 'var(--space-3, 12px)' }}>
            All Indexed Structures
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-3, 12px)' }}>
            {pdbs.map((p) => (
              <article key={p.id} className="glass-panel" style={{ padding: 'var(--space-4, 16px)', borderRadius: 'var(--radius-lg, 12px)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--silver, #A8B4C0)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                  {p.source ?? 'Source'}
                </span>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--white, #FFFFFF)' }}>{p.identifier ?? '-'}</span>
                {p.title && <span style={{ fontSize: '0.82rem', color: 'var(--silver-light, #D0DAE4)', lineHeight: 1.5 }}>{p.title}</span>}
                <div style={{ display: 'flex', gap: 'var(--space-3, 12px)', fontSize: '0.78rem', color: 'var(--silver, #A8B4C0)', marginTop: 4 }}>
                  {p.experimental_method && <span>{p.experimental_method}</span>}
                  {p.resolution_angstroms !== null && p.resolution_angstroms !== undefined && (
                    <span>{p.resolution_angstroms.toFixed(2)} Angstroms</span>
                  )}
                  {p.release_year && <span>{p.release_year}</span>}
                </div>
                {p.url && (
                  <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ marginTop: 4, color: 'var(--teal, #00C4BC)', fontSize: '0.78rem', textDecoration: 'none' }}>
                    View Source Record
                  </a>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {!primaryPdb && !primaryAf && (
        <div className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', color: 'var(--silver, #A8B4C0)', marginTop: 'var(--space-4, 16px)' }}>
          No PDB Or AlphaFold Identifier Is Currently Indexed For This Compound. The Structure Sync Cron Will Populate Available Records.
        </div>
      )}

      <p style={{ marginTop: 'var(--space-6, 32px)', fontSize: '0.78rem', color: 'var(--silver, #A8B4C0)', fontStyle: 'italic' }}>
        Research Use Only. Structural Data Provided By RCSB Protein Data Bank And EBI AlphaFold.
      </p>
    </div>
  );
}
