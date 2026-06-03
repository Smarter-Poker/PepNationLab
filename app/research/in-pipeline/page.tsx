/**
 * Compounds in the development pipeline, grouped by phase.
 * Server component.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { evidenceTier, wadaLabel } from '@/lib/compounds';

export const metadata: Metadata = {
  title: 'In Development Pipeline | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface PipelineRow {
  slug: string;
  display_name: string;
  evidence_tier: string;
  wada_status: string;
  pipeline_status: string | null;
  pipeline_phase: string | null;
  pipeline_indication: string | null;
  plain_summary: string | null;
}

const PHASE_ORDER = ['Preclinical', 'Phase 1', 'Phase 2', 'Phase 3', 'FDA Review', 'Approved', 'Unspecified Phase'];

function normalizePhase(p: string | null): string {
  if (!p) return 'Unspecified Phase';
  const lower = p.toLowerCase().trim();
  if (lower.includes('preclinic')) return 'Preclinical';
  if (lower.includes('phase 1') || lower.includes('phase i') || lower === '1') return 'Phase 1';
  if (lower.includes('phase 2') || lower.includes('phase ii') || lower === '2') return 'Phase 2';
  if (lower.includes('phase 3') || lower.includes('phase iii') || lower === '3') return 'Phase 3';
  if (lower.includes('fda') || lower.includes('review') || lower.includes('nda') || lower.includes('bla')) return 'FDA Review';
  if (lower.includes('approved')) return 'Approved';
  return p;
}

export default async function ResearchInPipelinePage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('compounds')
    .select('slug, display_name, evidence_tier, wada_status, pipeline_status, pipeline_phase, pipeline_indication, plain_summary')
    .or('pipeline_status.not.is.null,pipeline_phase.not.is.null')
    .order('display_name', { ascending: true });

  const rows = (data ?? []) as PipelineRow[];

  const groups = new Map<string, PipelineRow[]>();
  for (const r of rows) {
    const phase = normalizePhase(r.pipeline_phase);
    if (!groups.has(phase)) groups.set(phase, []);
    groups.get(phase)!.push(r);
  }
  const phases = Array.from(groups.keys()).sort((a, b) => {
    const ai = PHASE_ORDER.indexOf(a);
    const bi = PHASE_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>
      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          In Development Pipeline
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          Compounds Currently Moving Through Preclinical, Clinical Trial, And Regulatory Review.
        </p>
      </header>

      {phases.length === 0 ? (
        <div className="card-glass" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', color: 'var(--silver, #A8B4C0)' }}>
          Pipeline Status Will Populate Once The FDA And EMA Sync Crons Run.
        </div>
      ) : (
        phases.map((phase) => (
          <section key={phase} style={{ marginBottom: 'var(--space-6, 32px)' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--teal, #00C4BC)', marginBottom: 'var(--space-3, 12px)' }}>
              {phase} ({groups.get(phase)!.length})
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-3, 12px)' }}>
              {groups.get(phase)!.map((c) => {
                const t = evidenceTier(c.evidence_tier);
                return (
                  <Link
                    key={c.slug}
                    href={`/research/${c.slug}`}
                    className="card-metal"
                    style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1, 4px)', padding: 'var(--space-3, 12px) var(--space-4, 16px)', borderRadius: 'var(--radius-lg, 12px)', textDecoration: 'none', color: 'var(--white, #FFFFFF)' }}
                  >
                    <span style={{ fontSize: '0.7rem', color: t.color, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>{t.label}</span>
                    <span style={{ fontSize: '1rem', fontWeight: 700 }}>{c.display_name}</span>
                    {c.pipeline_indication && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--teal, #00C4BC)' }}>{c.pipeline_indication}</span>
                    )}
                    {c.pipeline_status && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--silver, #A8B4C0)' }}>{c.pipeline_status}</span>
                    )}
                    {c.wada_status && c.wada_status !== 'not_listed' && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--silver, #A8B4C0)' }}>{wadaLabel(c.wada_status)}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
