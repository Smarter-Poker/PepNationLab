'use client';

/**
 * EvidenceSafetyTabs - splits the Evidence & Safety hub into three categories
 * the reader taps between (Evidence At A Glance / Safety
 * Flags) so only one block shows at a time instead of one long scroll. All data
 * is computed server-side and passed in as serializable props. Research-Use-Only.
 */

import { useState } from 'react';
import Link from 'next/link';
import { FlaskConical, ShieldAlert } from 'lucide-react';

export interface EvidenceGroup {
  tier: string;
  label: string;
  color: string;
  blurb: string;
  items: { slug: string; name: string }[];
}
export interface FlaggedRow {
  slug: string;
  name: string;
  riskLevel: string;
  riskLabel: string | null;
  riskColor: string | null;
  riskBg: string | null;
  flags: string[];
  reasons: string[];
}

type TabKey = 'evidence' | 'flags';

export default function EvidenceSafetyTabs({
  groups,
  flagged,
}: {
  groups: EvidenceGroup[];
  flagged: FlaggedRow[];
}) {
  const [active, setActive] = useState<TabKey>('evidence');

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; color: string; count: number }[] = [
    { key: 'evidence', label: 'Evidence At A Glance', icon: <FlaskConical size={16} aria-hidden="true" />, color: '#00C4BC', count: groups.reduce((n, g) => n + g.items.length, 0) },
    { key: 'flags', label: 'Safety Flags', icon: <ShieldAlert size={16} aria-hidden="true" />, color: '#FF6B6B', count: flagged.length },
  ];

  return (
    <div>
      {/* Category buttons */}
      <div role="tablist" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-5, 24px)' }}>
        {tabs.map((t) => {
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`evidence-safety-tab-${t.key}`}
              aria-selected={isActive}
              aria-controls="evidence-safety-tabpanel"
              onClick={() => setActive(t.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                minHeight: '44px',
                padding: '8px 16px',
                borderRadius: '9999px',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: isActive ? `${t.color}1A` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isActive ? t.color : 'rgba(255,255,255,0.14)'}`,
                color: isActive ? t.color : 'var(--silver, #D0DAE4)',
                transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
              }}
            >
              <span style={{ display: 'flex', color: isActive ? t.color : 'var(--silver, #A8B4C0)' }}>{t.icon}</span>
              {t.label}
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: isActive ? t.color : 'var(--silver, #A8B4C0)', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', padding: '1px 8px' }}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Evidence At A Glance */}
      {active === 'evidence' && (
        <section role="tabpanel" id="evidence-safety-tabpanel" aria-labelledby="evidence-safety-tab-evidence">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
            {groups.map((g) => {
              return (
                <div key={g.tier} className="glass-panel" style={{ padding: 'var(--space-4, 16px)', borderRadius: 'var(--radius-lg, 12px)', borderLeft: `3px solid ${g.color}` }}>
                  {g.blurb && <p style={{ fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)', margin: '0 0 var(--space-3, 12px)' }}>{g.blurb}</p>}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {g.items.map((c) => (
                      <Link
                        key={c.slug}
                        href={`/research/${c.slug}`}
                        style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)', color: 'var(--white, #FFFFFF)', fontSize: '0.82rem', textDecoration: 'none', whiteSpace: 'nowrap' }}
                      >
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--grey-500, #6B7785)', marginTop: 'var(--space-3, 12px)' }}>
            Evidence Tiers Describe What Researchers Have Published, Not What A Compound Will Do For Any Individual.
          </p>
        </section>
      )}

      {/* Safety Flags */}
      {active === 'flags' && (
        <section role="tabpanel" id="evidence-safety-tabpanel" aria-labelledby="evidence-safety-tab-flags">
          <p style={{ fontSize: '0.9rem', color: 'var(--silver, #A8B4C0)', marginTop: 0, marginBottom: 'var(--space-4, 16px)', maxWidth: '760px' }}>
            Compounds Carrying A Notable Handling Or Safety Consideration. Surfacing These Plainly Is Part Of The
            Research-Use-Only Posture. Read Each Compound Page For The Full Warnings Section.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
            {flagged.map((c) => (
              <div key={c.slug} className="glass-panel" style={{ padding: 'var(--space-4, 16px)', borderRadius: 'var(--radius-lg, 12px)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Link href={`/research/${c.slug}`} style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--white, #FFFFFF)', textDecoration: 'none' }}>
                    {c.name}
                  </Link>
                </div>
                {c.reasons.length > 0 && (
                  <ul style={{ margin: '4px 0 0', paddingLeft: '18px', color: 'var(--silver, #A8B4C0)', fontSize: '0.85rem' }}>
                    {c.reasons.map((r, i) => (
                      <li key={i} style={{ marginBottom: '2px' }}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
