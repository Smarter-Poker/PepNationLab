/**
 * Dynamic per-receptor page. Lists every compound binding the given target
 * plus all ChEMBL binding rows for that target name (case-insensitive).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAllCompounds } from '@/lib/compounds-server';
import { evidenceTier } from '@/lib/compounds';
import ReceptorAffinityHeatmap from '@/components/research/ReceptorAffinityHeatmap';

type PageProps = { params: Promise<{ target: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { target } = await params;
  const decoded = decodeURIComponent(target);
  return {
    title: `${decoded} | Receptor Target | Research Library | Pep Nation Lab`,
    robots: { index: false, follow: false },
  };
}

export const dynamic = 'force-dynamic';

interface CompoundRow {
  slug: string;
  display_name: string;
  category: string | null;
  evidence_tier: string;
  plain_summary: string | null;
  receptors: string[] | null;
}

interface BindingRow {
  compound_slug: string;
  target_name: string;
  standard_type: string | null;
  standard_value: number | null;
  standard_units: string | null;
  pchembl_value: number | null;
}

export default async function ResearchTargetDetailPage({ params }: PageProps) {
  const { target } = await params;
  const decoded = decodeURIComponent(target);
  if (!decoded || decoded.length > 200) notFound();

  const supabase = await createClient();

  const allCompounds = await getAllCompounds();
  const compoundRows = allCompounds.filter((c) => ((c as unknown) as { receptors?: string[] }).receptors?.includes(decoded)) as unknown as CompoundRow[];

  const { data: bindings } = await supabase
    .from('compound_chembl_bindings')
    .select('compound_slug, target_name, standard_type, standard_value, standard_units, pchembl_value')
    .ilike('target_name', decoded);

  const bindingRows = (bindings ?? []) as BindingRow[];

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research/by-target" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To All Targets
        </Link>
      </nav>
      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          {decoded}
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          Compounds Annotated To Bind {decoded}, Plus Curated Binding Affinity Rows From ChEMBL.
        </p>
      </header>

      {bindingRows.length > 0 && (
        <section style={{ marginBottom: 'var(--space-5, 24px)' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--teal, #00C4BC)', marginBottom: 'var(--space-3, 12px)' }}>
            Binding Affinity (pChEMBL)
          </h2>
          <ReceptorAffinityHeatmap bindings={bindingRows.map((b) => ({
            target_name: b.compound_slug,
            standard_type: b.standard_type ?? '',
            standard_value: b.standard_value ?? 0,
            standard_units: b.standard_units ?? '',
            pchembl_value: b.pchembl_value ?? 0,
          }))} />
        </section>
      )}

      <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--teal, #00C4BC)', marginBottom: 'var(--space-3, 12px)' }}>
        Compounds Targeting {decoded} ({compoundRows.length})
      </h2>

      {compoundRows.length === 0 ? (
        <div className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', color: 'var(--silver, #A8B4C0)' }}>
          No Compounds Are Currently Annotated To Bind This Target.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-3, 12px)' }}>
          {compoundRows.map((c) => {
            const t = evidenceTier(c.evidence_tier);
            return (
              <Link
                key={c.slug}
                href={`/research/${c.slug}`}
                className="glass-panel"
                style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1, 4px)', padding: 'var(--space-3, 12px) var(--space-4, 16px)', borderRadius: 'var(--radius-lg, 12px)', textDecoration: 'none', color: 'var(--white, #FFFFFF)' }}
              >
                <span style={{ fontSize: '0.7rem', color: t.color, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>{t.label}</span>
                <span style={{ fontSize: '1rem', fontWeight: 700 }}>{c.display_name}</span>
                {c.plain_summary && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--silver, #A8B4C0)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.plain_summary}</span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
