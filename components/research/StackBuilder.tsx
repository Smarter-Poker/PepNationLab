'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Layers, AlertTriangle, Info, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { analyzeCartWarnings, type Compound, type CartWarning } from '@/lib/compounds';

interface StackBuilderProps {
  compounds: Compound[];
}

const LEVEL_STYLE: Record<CartWarning['level'], { color: string; bg: string; border: string }> = {
  danger: { color: '#FF6B6B', bg: 'rgba(229,62,62,0.12)', border: 'rgba(229,62,62,0.4)' },
  warning: { color: '#F6AD55', bg: 'rgba(246,173,85,0.12)', border: 'rgba(246,173,85,0.4)' },
  info: { color: '#00C4BC', bg: 'rgba(0,196,188,0.10)', border: 'rgba(0,196,188,0.4)' },
};

function LevelIcon({ level }: { level: CartWarning['level'] }) {
  if (level === 'danger') return <ShieldAlert size={18} aria-hidden="true" />;
  if (level === 'warning') return <AlertTriangle size={18} aria-hidden="true" />;
  return <Info size={18} aria-hidden="true" />;
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((x) => setB.has(x));
}

export default function StackBuilder({ compounds }: StackBuilderProps) {
  const selectable = useMemo(
    () => compounds.filter((c) => !c.is_stack).sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [compounds]
  );
  const stacks = useMemo(() => compounds.filter((c) => c.is_stack), [compounds]);
  const bySlug = useMemo(() => new Map(compounds.map((c) => [c.slug, c])), [compounds]);

  const [selected, setSelected] = useState<string[]>([]);

  function toggle(slug: string) {
    setSelected((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  }

  const selectedCompounds = useMemo(
    () => selected.map((s) => bySlug.get(s)).filter((c): c is Compound => Boolean(c)),
    [selected, bySlug]
  );

  const warnings = useMemo(
    () => (selectedCompounds.length > 0 ? analyzeCartWarnings(selectedCompounds) : []),
    [selectedCompounds]
  );

  const documentedMatch = useMemo(() => {
    if (selected.length < 2) return null;
    return stacks.find((st) => sameSet(st.stack_components, selected)) ?? null;
  }, [selected, stacks]);

  return (
    <div className="card-metal" style={{ padding: 0 }}>
      <div className="metal-frame">
        <div className="metal-content" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
            <Layers size={22} color="#00C4BC" aria-hidden="true" />
            <h2 style={{ margin: 0, color: '#FFFFFF', fontSize: '1.35rem', fontWeight: 700 }}>Guided Stack Builder</h2>
          </div>
          <p style={{ margin: '0 0 var(--space-4)', color: '#A8B4C0', fontSize: '0.95rem', lineHeight: 1.55 }}>
            Select Two Or More Compounds To See Whether They Form A Documented Combination And To
            Review Research-Framed Handling Notes. Educational Reference Only, Not A Protocol.
          </p>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              marginBottom: 'var(--space-5)',
            }}
          >
            {selectable.map((c) => {
              const isOn = selected.includes(c.slug);
              return (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => toggle(c.slug)}
                  aria-pressed={isOn}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: '999px',
                    border: `1px solid ${isOn ? '#00C4BC' : '#1D2D3E'}`,
                    background: isOn ? 'rgba(0,196,188,0.14)' : '#0F1923',
                    color: isOn ? '#00C4BC' : '#D0DAE4',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    fontWeight: isOn ? 700 : 400,
                  }}
                >
                  {c.display_name}
                </button>
              );
            })}
          </div>

          {selected.length < 2 ? (
            <p style={{ color: '#A8B4C0', margin: 0 }}>Select At Least Two Compounds To Evaluate A Combination.</p>
          ) : (
            <>
              {documentedMatch ? (
                <div
                  style={{
                    display: 'flex',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(104,211,145,0.12)',
                    border: '1px solid rgba(104,211,145,0.4)',
                    marginBottom: 'var(--space-4)',
                  }}
                >
                  <div style={{ color: '#68D391', flexShrink: 0, marginTop: '0.1rem' }}>
                    <CheckCircle2 size={18} aria-hidden="true" />
                  </div>
                  <div>
                    <p style={{ margin: 0, color: '#68D391', fontWeight: 700 }}>
                      Documented Combination:{' '}
                      <Link href={`/research/${documentedMatch.slug}`} style={{ color: '#68D391' }}>
                        {documentedMatch.display_name}
                      </Link>
                    </p>
                    {documentedMatch.stack_rationale && (
                      <p style={{ margin: '0.35rem 0 0', color: '#D0DAE4', fontSize: '0.9rem', lineHeight: 1.5 }}>
                        {documentedMatch.stack_rationale}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: 'var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(0,196,188,0.10)',
                    border: '1px solid rgba(0,196,188,0.4)',
                    marginBottom: 'var(--space-4)',
                    color: '#D0DAE4',
                    fontSize: '0.9rem',
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ color: '#00C4BC' }}>Not A Studied Combination.</strong> This Exact
                  Set Does Not Match A Documented Stack In The Library. Review Each Compound
                  Individually Before Considering Any Combination.
                </div>
              )}

              {warnings.length > 0 && (
                <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                  {warnings.map((w, i) => {
                    const s = LEVEL_STYLE[w.level];
                    return (
                      <div
                        key={`${w.title}-${i}`}
                        role="note"
                        style={{
                          display: 'flex',
                          gap: 'var(--space-3)',
                          padding: 'var(--space-4)',
                          borderRadius: 'var(--radius-md)',
                          background: s.bg,
                          border: `1px solid ${s.border}`,
                        }}
                      >
                        <div style={{ color: s.color, flexShrink: 0, marginTop: '0.1rem' }}>
                          <LevelIcon level={w.level} />
                        </div>
                        <div>
                          <p style={{ margin: 0, color: s.color, fontWeight: 700 }}>{w.title}</p>
                          <p style={{ margin: '0.35rem 0 0', color: '#D0DAE4', fontSize: '0.9rem', lineHeight: 1.5 }}>
                            {w.detail}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
