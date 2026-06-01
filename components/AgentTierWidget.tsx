'use client';

import { useEffect, useState } from 'react';

/* ── Types ─────────────────────────────────────────────────────────────── */
interface TierState {
  enabled: boolean;
  locked?: boolean;
  level?: number;
  levelName?: string;
  volume30?: number;
  progress?: number;
  next?: { level: number; name: string; dollarsToNext: number } | null;
  ladder?: { level: number; name: string; min_volume: number; max_volume: number | null }[];
}

interface CommissionState {
  enabled: boolean;
  applicable?: boolean;
  base_pct?: number;
  cap_pct?: number | null;
  effective_pct?: number;
  month_retail?: number;
  next?: { min_volume: number; bonus_pct: number; dollarsToNext: number } | null;
}

function money(n: number): string {
  return `$${(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/* ── Teal/Metal progress ring ──────────────────────────────────────────── */
function ProgressRing({ progress, label, sub }: { progress: number; label: string; sub: string }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(1, Math.max(0, progress)));
  return (
    <div style={{ position: 'relative', width: 140, height: 140, flexShrink: 0 }}>
      <svg width={140} height={140} viewBox="0 0 140 140">
        <defs>
          <linearGradient id="tierRing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#00E5FF" />
            <stop offset="100%" stopColor="#00C4BC" />
          </linearGradient>
        </defs>
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(192,184,168,0.15)" strokeWidth="10" />
        <circle
          cx="70" cy="70" r={r} fill="none" stroke="url(#tierRing)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 70 70)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--white)', fontFamily: 'var(--font-brand)', lineHeight: 1.1 }}>{label}</div>
        <div style={{ fontSize: '0.62rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Agent Tier Widget — house tier ladder (Super/standalone) OR sub-agent
   commission mini-ladder. Renders nothing when the v2 flag is off.
   ══════════════════════════════════════════════════════════════════════════ */
export default function AgentTierWidget() {
  const [tier, setTier] = useState<TierState | null>(null);
  const [comm, setComm] = useState<CommissionState | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tRes, cRes] = await Promise.all([
          fetch('/api/agent/tier', { cache: 'no-store' }),
          fetch('/api/agent/commission', { cache: 'no-store' }),
        ]);
        const t = tRes.ok ? await tRes.json() : { enabled: false };
        const c = cRes.ok ? await cRes.json() : { enabled: false };
        if (!cancelled) { setTier(t); setComm(c); setLoaded(true); }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Flag off (or not loaded) → render nothing so production is unchanged.
  if (!loaded || !tier?.enabled) return null;

  const isSub = comm?.enabled && comm.applicable;

  return (
    <div className="metal-frame" style={{ marginBottom: 'var(--space-6)' }}>
      <div className="metal-content" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', padding: 'var(--space-6)' }}>
      {isSub ? (
          <ProgressRing
            progress={comm!.cap_pct && comm!.cap_pct > 0 ? (comm!.effective_pct ?? 0) / comm!.cap_pct : 1}
            label={`${comm!.effective_pct ?? 0}%`}
            sub="Commission"
          />
          <div style={{ flex: 1, minWidth: 220 }}>
            <h3 style={{ fontSize: '1.05rem', color: 'var(--white)', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em', textTransform: 'uppercase', margin: '0 0 6px' }}>
              Your Commission Tier
            </h3>
            <p style={{ color: 'var(--grey-400)', fontSize: '0.82rem', margin: '0 0 12px' }}>
              Base {comm!.base_pct ?? 0}%{comm!.cap_pct != null ? ` / Up To ${comm!.cap_pct}%` : ''} — {money(comm!.month_retail ?? 0)} Sold This Month
            </p>
            {comm!.next ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--silver-light)' }}>
                Sell <span style={{ color: 'var(--teal)', fontWeight: 700 }}>{money(comm!.next.dollarsToNext)}</span> more to unlock a
                {' '}<span style={{ color: '#00FF9D', fontWeight: 700 }}>+{comm!.next.bonus_pct}% Performance Bonus</span>.
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: '#00FF9D', fontWeight: 600 }}>You&apos;ve unlocked every performance bonus this month.</div>
            )}
          </div>
        </div>
      ) : (
        /* ── House tier ladder (Super / standalone agent) ── */
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-6)' }}>
          <ProgressRing progress={tier.progress ?? 0} label={tier.levelName ?? 'Rookie'} sub={`Level ${tier.level ?? 1}`} />
          <div style={{ flex: 1, minWidth: 220 }}>
            <h3 style={{ fontSize: '1.05rem', color: 'var(--white)', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em', textTransform: 'uppercase', margin: '0 0 6px' }}>
              Your Tier{tier.locked ? ' (Locked)' : ''}
            </h3>
            <p style={{ color: 'var(--grey-400)', fontSize: '0.82rem', margin: '0 0 12px' }}>
              {money(tier.volume30 ?? 0)} In Volume Over The Last 30 Days
            </p>
            {tier.next ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--silver-light)' }}>
                <span style={{ color: 'var(--teal)', fontWeight: 700 }}>{money(tier.next.dollarsToNext)}</span> more to reach
                {' '}<span style={{ color: '#00FF9D', fontWeight: 700 }}>{tier.next.name}</span> and lower your Agent Cost.
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--teal)', fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                You&apos;re At The Top Tier And Have The Best Agent Cost Unlocked.
              </div>
            )}
            {tier.ladder && tier.ladder.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                {tier.ladder.map((l) => (
                  <span key={l.level} style={{
                    fontSize: '0.6rem', fontWeight: 800, padding: '3px 8px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.04em',
                    background: l.level === tier.level ? 'var(--teal)' : 'rgba(192,184,168,0.1)',
                    color: l.level === tier.level ? '#04221f' : 'var(--grey-400)',
                  }}>{l.name}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
