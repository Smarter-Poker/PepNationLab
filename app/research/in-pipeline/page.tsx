/**
 * Compounds in the development pipeline, grouped by phase.
 * Server component wraps BrowseFilterShell for progressive disclosure.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllCompounds } from '@/lib/compounds-server';
import { evidenceTier } from '@/lib/compounds';
import BrowseFilterShell from '@/components/research/BrowseFilterShell';

export const metadata: Metadata = {
  title: 'Peptides In Clinical Pipeline | Compounds In Development | Pep Nation Lab',
  description: 'Research peptides and compounds currently in clinical development pipeline — Phase 1, 2, and 3 trials. Track emerging peptide drug development. Research use only.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com/research/in-pipeline' },
  openGraph: {
    title: 'Peptides In Clinical Pipeline | Pep Nation Lab',
    description: 'Research peptides in Phase 1, 2, and 3 clinical development pipeline.',
    url: 'https://pepnationlab.com/research/in-pipeline',
    type: 'website',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'Peptides In Clinical Pipeline' }],
  },
};

export const dynamic = 'force-dynamic';

interface PipelineRow {
  slug: string;
  display_name: string;
  evidence_tier: string;
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

// Phase accent colors
const PHASE_COLORS: Record<string, string> = {
  Preclinical: '#A8B4C0',
  'Phase 1': '#00C4BC',
  'Phase 2': '#00E5FF',
  'Phase 3': '#BBA371',
  'FDA Review': '#F6AD55',
  Approved: '#68D391',
  'Unspecified Phase': '#718096',
};

export default async function ResearchInPipelinePage() {
  const all = await getAllCompounds();
  const rows = all.filter((c) => {
    const comp = (c as unknown) as { pipeline_status?: string; pipeline_phase?: string };
    return comp.pipeline_status != null || comp.pipeline_phase != null;
  }) as unknown as PipelineRow[];

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

  const shellGroups = phases.map((phase) => {
    const items = groups.get(phase)!;
    const accentColor = PHASE_COLORS[phase] ?? '#00C4BC';
    return {
      key: phase,
      label: phase,
      count: items.length,
      children: (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-3, 12px)' }}>
          {items.map((c) => {
            const t = evidenceTier(c.evidence_tier);
            return (
              <Link
                key={c.slug}
                href={`/research/${c.slug}`}
                className="glass-panel"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-1, 4px)',
                  padding: 'var(--space-3, 12px) var(--space-4, 16px)',
                  borderRadius: 'var(--radius-lg, 12px)',
                  textDecoration: 'none',
                  color: 'var(--white, #FFFFFF)',
                  borderLeft: `3px solid ${accentColor}`,
                }}
              >
                <span style={{ fontSize: '0.7rem', color: t.color, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                  {t.label}
                </span>
                <span style={{ fontSize: '1rem', fontWeight: 700 }}>{c.display_name}</span>
                {c.pipeline_indication && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--teal, #00C4BC)' }}>{c.pipeline_indication}</span>
                )}
                {c.pipeline_status && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--silver, #A8B4C0)' }}>{c.pipeline_status}</span>
                )}
              </Link>
            );
          })}
        </div>
      ),
    };
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
          Compounds Moving Through Preclinical, Clinical Trial, And Regulatory Review. Select A Phase Below.
        </p>
      </header>

      {shellGroups.length === 0 ? (
        <div className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', color: 'var(--silver, #A8B4C0)' }}>
          Pipeline Status Will Populate Once The FDA And EMA Sync Crons Run.
        </div>
      ) : (
        <BrowseFilterShell groups={shellGroups} emptyMessage="No Compounds In This Pipeline Phase Yet." />
      )}
    </div>
  );
}
