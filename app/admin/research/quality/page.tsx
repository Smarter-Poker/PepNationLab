/**
 * Compound quality backlog. Admin-only via middleware role gate.
 * Lists lowest-scoring compounds with per-field gap report so the enrichment
 * queue is always visible to the team.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

export const metadata: Metadata = {
  title: 'Compound Quality | Admin | Pep Nation Lab',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

function qualityBucket(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Rich', color: '#68D391' };
  if (score >= 60) return { label: 'Solid', color: '#00E5FF' };
  if (score >= 30) return { label: 'Developing', color: '#F6AD55' };
  return { label: 'Sparse', color: '#FF6B6B' };
}

function missingFields(c: Record<string, unknown>): string[] {
  const gaps: string[] = [];
  if (!c.plain_summary || (c.plain_summary as string).length < 50) gaps.push('plain_summary');
  if (!c.mechanism || (c.mechanism as string).length < 50) gaps.push('mechanism');
  if (!c.benefits || (c.benefits as string).length < 50) gaps.push('benefits');
  if (!c.side_effects || (c.side_effects as string).length < 50) gaps.push('side_effects');
  if (!c.warnings || (c.warnings as string).length < 50) gaps.push('warnings');
  if (!Array.isArray(c.studied_for) || (c.studied_for as unknown[]).length < 3) gaps.push('studied_for');
  if (!Array.isArray(c.research_areas) || (c.research_areas as unknown[]).length < 1) gaps.push('research_areas');
  if (!Array.isArray(c.sources) || (c.sources as unknown[]).length < 3) gaps.push('sources');
  if (!c.sequence_one_letter) gaps.push('sequence_one_letter');
  if (!c.molecular_weight_da) gaps.push('molecular_weight_da');
  if (!c.measured_half_life_hours && !c.predicted_half_life_hours) gaps.push('half_life');
  if (!c.uniprot_id && !c.chembl_id && !c.unii) gaps.push('external_id');
  if (!c.year_discovered) gaps.push('year_discovered');
  return gaps;
}

export default async function AdminCompoundQualityPage() {
  const gate = await requireAdmin();
  if (!gate.ok) redirect('/login');

  const supabase = await createServiceClient();
  const { data: rows } = await supabase
    .from('compounds')
    .select('slug, display_name, evidence_tier, category, quality_score, plain_summary, mechanism, benefits, side_effects, warnings, studied_for, research_areas, sources, sequence_one_letter, molecular_weight_da, measured_half_life_hours, predicted_half_life_hours, uniprot_id, chembl_id, unii, year_discovered')
    .order('quality_score', { ascending: true })
    .limit(40);

  const items = (rows ?? []) as Array<Record<string, unknown>>;

  const cellStyle: React.CSSProperties = { padding: '8px 14px', color: 'var(--silver-light, #D0DAE4)', fontSize: '0.88rem' };
  const thStyle: React.CSSProperties = { ...cellStyle, color: 'var(--silver, #A8B4C0)', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em', textAlign: 'left' };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 className="animated-gradient-text" style={{ fontSize: '2rem', margin: 0 }}>Compound Quality Backlog</h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1rem', marginTop: 'var(--space-2, 8px)' }}>Lowest-Scoring Compounds First. Score Is 0-100 Based On Field Coverage. Click Any Row To Open The Monograph And Enrich.</p>
      </header>

      <section className="glass-panel" style={{ padding: 'var(--space-4, 16px)', borderRadius: 'var(--radius-lg, 12px)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Compound</th>
              <th style={thStyle}>Score</th>
              <th style={thStyle}>Bucket</th>
              <th style={thStyle}>Missing Fields</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => {
              const score = (c.quality_score as number) ?? 0;
              const b = qualityBucket(score);
              const gaps = missingFields(c);
              return (
                <tr key={c.slug as string}>
                  <td style={cellStyle}>
                    <Link href={`/research/${c.slug}`} style={{ color: 'var(--teal, #00C4BC)', textDecoration: 'none', fontWeight: 700 }}>{c.display_name as string}</Link>
                    <div style={{ fontSize: '0.72rem', color: 'var(--silver, #A8B4C0)', marginTop: '2px' }}>{(c.category as string) ?? ''}</div>
                  </td>
                  <td style={cellStyle}><strong style={{ color: b.color }}>{score}</strong> / 100</td>
                  <td style={cellStyle}><span style={{ color: b.color, fontWeight: 700 }}>{b.label}</span></td>
                  <td style={cellStyle}>{gaps.length === 0 ? <span style={{ color: '#68D391' }}>All Fields Populated</span> : <span style={{ fontSize: '0.78rem' }}>{gaps.join(', ')}</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
