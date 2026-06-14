'use client';
import { useEffect, useState } from 'react';

interface TierRow {
  level: number;
  name: string;
  min_volume: number;
  max_volume: number | null;
}

interface TierData {
  enabled: boolean;
  locked?: boolean;
  level?: number;
  levelName?: string;
  volume30?: number;
  progress?: number;
  next?: { level: number; name: string; dollarsToNext: number } | null;
  ladder?: TierRow[];
}

export default function AgentTierLadder({ agentId }: { agentId: string }) {
  const [data, setData] = useState<TierData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/agent/tier', { signal: ctrl.signal })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(setData)
      .catch(() => { if (!ctrl.signal.aborted) setData({ enabled: false }); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [agentId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
        <div className="spinner" />
      </div>
    );
  }

  // FLAG OFF - coming-soon placeholder
  if (!data || !data.enabled) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', paddingTop: 'var(--space-4)' }}>
        <div className="card-glass" style={{ padding: 'var(--space-8)', textAlign: 'center', borderTop: '2px solid var(--teal)' }}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--teal)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ display: 'block', margin: '0 auto var(--space-4)' }}
          >
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <h2 style={{ color: 'var(--white)', fontSize: '1.4rem', marginBottom: 'var(--space-2)' }}>
            Tier Rewards Program
          </h2>
          <p style={{ color: 'var(--silver)', fontSize: '0.95rem', maxWidth: 420, margin: '0 auto var(--space-4)' }}>
            Unlock Exclusive Pricing Tiers Based On Your Monthly Sales Volume. Higher Tiers Earn Better Margins And Priority Support.
          </p>
          <div style={{
            display: 'inline-block',
            padding: 'var(--space-2) var(--space-4)',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(0,196,188,0.12)',
            border: '1px solid rgba(0,196,188,0.35)',
            color: 'var(--teal)',
            fontSize: '0.8rem',
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}>
            Coming Soon
          </div>
        </div>
      </div>
    );
  }

  // FLAG ON - full tier ladder
  const {
    locked = false,
    level = 1,
    levelName = 'Rookie',
    volume30 = 0,
    progress = 0,
    next,
    ladder = [],
  } = data;

  const progressPct = Math.round(progress * 100);
  const maxVolumeLabel = (t: TierRow) =>
    t.max_volume == null ? 'No Limit' : `$${t.max_volume.toLocaleString()}`;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', paddingTop: 'var(--space-4)' }}>
      {/* Current Tier Card */}
      <div
        className="card-glass"
        style={{
          padding: 'var(--space-6)',
          borderTop: '2px solid var(--teal)',
          marginBottom: 'var(--space-6)',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 'var(--space-4)',
          alignItems: 'center',
        }}
      >
        <div>
          <p style={{
            color: 'var(--silver)',
            fontSize: '0.78rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            margin: '0 0 var(--space-1)',
          }}>
            Current Tier
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <h2 style={{ color: 'var(--teal)', margin: 0, fontSize: '1.6rem', fontWeight: 700 }}>
              {levelName}
            </h2>
            {locked && (
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '2px 8px',
                borderRadius: 4,
                background: 'rgba(255,200,60,0.15)',
                border: '1px solid rgba(255,200,60,0.4)',
                color: '#FFC83C',
              }}>
                Locked
              </span>
            )}
          </div>
          <p style={{ color: 'var(--silver-light)', fontSize: '0.85rem', margin: 'var(--space-2) 0 0' }}>
            30-Day Volume:{' '}
            <strong style={{ color: 'var(--white)' }}>
              ${volume30.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
          </p>
        </div>
        <div style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--teal-dark), var(--teal))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 0 20px rgba(0,196,188,0.35)',
          fontSize: '1.6rem',
          fontWeight: 800,
          color: '#050A0F',
        }}>
          {level}
        </div>
      </div>

      {/* Progress Bar */}
      {next ? (
        <div className="card-glass" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 'var(--space-2)',
          }}>
            <p style={{ color: 'var(--silver)', fontSize: '0.82rem', margin: 0 }}>
              Progress To <strong style={{ color: 'var(--teal)' }}>{next.name}</strong>
            </p>
            <span style={{ color: 'var(--white)', fontWeight: 700, fontSize: '0.9rem' }}>
              {progressPct}%
            </span>
          </div>
          <div style={{
            height: 8,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.08)',
            overflow: 'hidden',
            marginBottom: 'var(--space-2)',
          }}>
            <div style={{
              height: '100%',
              width: `${progressPct}%`,
              borderRadius: 999,
              background: 'linear-gradient(90deg, var(--teal-dark), var(--teal))',
              transition: 'width 0.6s ease',
            }} />
          </div>
          <p style={{ color: 'var(--silver)', fontSize: '0.8rem', margin: 0 }}>
            Sell{' '}
            <strong style={{ color: 'var(--white)' }}>
              ${next.dollarsToNext.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>{' '}
            More In The Next 30 Days To Advance
          </p>
        </div>
      ) : (
        <div className="card-glass" style={{
          padding: 'var(--space-5)',
          marginBottom: 'var(--space-6)',
          textAlign: 'center',
          borderTop: '2px solid var(--teal)',
        }}>
          <p style={{ color: 'var(--teal)', fontWeight: 600, margin: 0, fontSize: '0.95rem' }}>
            You Have Reached The Top Tier - Maximum Pricing Advantage Active
          </p>
        </div>
      )}

      {/* Tier Ladder Table */}
      {ladder.length > 0 && (
        <div className="card-glass" style={{ padding: 'var(--space-5)' }}>
          <h3 style={{ color: 'var(--white)', fontSize: '1rem', marginTop: 0, marginBottom: 'var(--space-4)' }}>
            Tier Ladder
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr>
                  {['Tier', 'Name', 'Min Volume', 'Max Volume'].map(h => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        padding: 'var(--space-2) var(--space-3)',
                        color: 'var(--silver)',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ladder.map(t => {
                  const isActive = t.level === level;
                  return (
                    <tr
                      key={t.level}
                      style={{
                        background: isActive ? 'rgba(0,196,188,0.08)' : 'transparent',
                        borderLeft: isActive ? '3px solid var(--teal)' : '3px solid transparent',
                      }}
                    >
                      <td style={{
                        padding: 'var(--space-3)',
                        color: isActive ? 'var(--teal)' : 'var(--silver)',
                        fontWeight: isActive ? 700 : 400,
                      }}>
                        {t.level}
                      </td>
                      <td style={{
                        padding: 'var(--space-3)',
                        color: isActive ? 'var(--white)' : 'var(--silver-light)',
                        fontWeight: isActive ? 600 : 400,
                      }}>
                        {t.name}
                        {isActive && (
                          <span style={{
                            marginLeft: 8,
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: 3,
                            background: 'rgba(0,196,188,0.2)',
                            color: 'var(--teal)',
                            verticalAlign: 'middle',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}>
                            You
                          </span>
                        )}
                      </td>
                      <td style={{ padding: 'var(--space-3)', color: 'var(--silver-light)' }}>
                        ${t.min_volume.toLocaleString()}
                      </td>
                      <td style={{ padding: 'var(--space-3)', color: 'var(--silver-light)' }}>
                        {maxVolumeLabel(t)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
