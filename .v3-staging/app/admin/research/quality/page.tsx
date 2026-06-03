/**
 * /admin/research/quality -- lowest-scoring compounds backlog. Lists the 30
 * compounds with the smallest quality_score and reports which canonical fields
 * are missing per compound so the editorial team can fill the gaps.
 *
 * Admin-only via middleware role check.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import { computeQualityBucket, qualityLabel, qualityColor } from '@/lib/research/quality-score';

export const metadata: Metadata = {
  title: 'Compound Quality Backlog | Admin | Pep Nation Lab',
  robots: { index: false, follow: false },
};

interface CompoundRow {
  slug: string;
  display_name: string;
  quality_score: number | null;
  plain_summary: string | null;
  mechanism: string | null;
  half_life: string | null;
  pk_summary: string | null;
  side_effects: string | null;
  warnings: string | null;
  research_areas: string[] | null;
  studied_for: string[] | null;
  aliases: string[] | null;
  sources: string[] | null;
  category: string | null;
  evidence_tier: string;
  compound_class: string | null;
  pubmed_citation_count: number | null;
}

function missingFieldsFor(row: CompoundRow): string[] {
  const out: string[] = [];
  if (!row.plain_summary) out.push('Plain Summary');
  if (!row.mechanism) out.push('Mechanism');
  if (!row.half_life) out.push('Half-Life');
  if (!row.pk_summary) out.push('PK Summary');
  if (!row.side_effects) out.push('Side Effects');
  if (!row.warnings) out.push('Warnings');
  if (!row.research_areas || row.research_areas.length === 0) out.push('Research Areas');
  if (!row.studied_for || row.studied_for.length === 0) out.push('Studied For');
  if (!row.aliases || row.aliases.length === 0) out.push('Aliases');
  if (!row.sources || row.sources.length === 0) out.push('Sources');
  if (!row.category) out.push('Category');
  if (!row.compound_class) out.push('Compound Class');
  if (!row.pubmed_citation_count || row.pubmed_citation_count === 0) out.push('PubMed Count');
  return out;
}

export default async function ResearchQualityPage() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('compounds')
    .select(
      'slug, display_name, quality_score, plain_summary, mechanism, half_life, pk_summary, side_effects, warnings, research_areas, studied_for, aliases, sources, category, evidence_tier, compound_class, pubmed_citation_count',
    )
    .order('quality_score', { ascending: true, nullsFirst: true })
    .limit(30);
  const rows = (data ?? []) as CompoundRow[];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 16px 64px' }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
          Compound Quality Backlog
        </h1>
        <p style={{ color: '#A8B4C0', marginTop: 8, fontSize: 14 }}>
          The Thirty Lowest-Scoring Compounds. Click Through To Edit, Or Triage By Missing Fields.
        </p>
      </header>

      <div style={{
        borderRadius: 12,
        border: '1px solid rgba(168,180,192,0.18)',
        background: 'rgba(15,25,35,0.55)',
        overflowX: 'auto',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Compound</th>
              <th style={{ ...th, textAlign: 'right' }}>Score</th>
              <th style={th}>Bucket</th>
              <th style={th}>Missing Fields</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td style={td} colSpan={4}>No Compounds Found.</td></tr>
            ) : rows.map((r) => {
              const missing = missingFieldsFor(r);
              const bucket = computeQualityBucket(r.quality_score);
              return (
                <tr key={r.slug}>
                  <td style={td}>
                    <Link href={`/research/${r.slug}`} style={{ color: '#00C4BC', textDecoration: 'none' }}>
                      {r.display_name}
                    </Link>
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>
                    {r.quality_score ?? 0}
                  </td>
                  <td style={td}>
                    <span style={{
                      display: 'inline-block',
                      fontSize: 10, fontWeight: 700,
                      color: qualityColor(bucket),
                      border: `1px solid ${qualityColor(bucket)}`,
                      padding: '2px 8px', borderRadius: 999,
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>
                      {qualityLabel(bucket)}
                    </span>
                  </td>
                  <td style={td}>
                    {missing.length === 0
                      ? <span style={{ color: '#68D391' }}>None</span>
                      : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {missing.map((m) => (
                            <span key={m} style={{
                              fontSize: 11,
                              color: '#F6AD55',
                              background: 'rgba(246,173,85,0.10)',
                              border: '1px solid rgba(246,173,85,0.35)',
                              padding: '2px 8px',
                              borderRadius: 999,
                            }}>{m}</span>
                          ))}
                        </div>
                      )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  fontSize: 11,
  color: '#A8B4C0',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: '1px solid rgba(168,180,192,0.2)',
};

const td: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 13,
  color: '#FFFFFF',
  borderBottom: '1px solid rgba(168,180,192,0.08)',
  verticalAlign: 'top',
};
