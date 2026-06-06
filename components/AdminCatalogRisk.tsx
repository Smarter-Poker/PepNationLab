'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';

interface RiskRow {
  slug: string;
  display_name: string;
  category: string | null;
  evidence_tier: string;
  wada_status: string;
  risk_level: 'critical' | 'high' | 'moderate' | 'low';
  risk_reasons: string[];
  recommended_action: 'keep' | 'review' | 'restrict' | 'remove';
  active_skus: number;
  banned_skus: number;
  total_skus: number;
}

interface Summary { critical: number; high: number; moderate: number; low: number; }

const RISK_META: Record<RiskRow['risk_level'], { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: '#FF6B6B', bg: 'rgba(229,62,62,0.16)' },
  high: { label: 'High', color: '#F6AD55', bg: 'rgba(246,173,85,0.14)' },
  moderate: { label: 'Moderate', color: '#00E5FF', bg: 'rgba(0,229,255,0.12)' },
  low: { label: 'Low', color: '#68D391', bg: 'rgba(104,211,145,0.12)' },
};

const TIER_LABEL: Record<string, string> = {
  approved_drug: 'Approved Drug',
  investigational: 'Investigational',
  preclinical: 'Preclinical',
  research_chemical: 'Research Compound',
  cosmetic: 'Cosmetic',
  supply: 'Supply',
};


const ACTION_LABEL: Record<string, string> = {
  keep: 'Keep',
  review: 'Review',
  restrict: 'Restrict',
  remove: 'Remove',
};

export default function AdminCatalogRisk() {
  const [rows, setRows] = useState<RiskRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [showLow, setShowLow] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/catalog-risk', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setRows(Array.isArray(json.rows) ? json.rows : []);
      setSummary(json.summary ?? null);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function applyAction(row: RiskRow, action: 'restrict' | 'remove' | 'reactivate') {
    const verb = action === 'remove' ? 'Remove' : action === 'restrict' ? 'Restrict' : 'Reactivate';
    const detail =
      action === 'remove'
        ? 'Block It From Sale Across Every Storefront'
        : action === 'restrict'
        ? 'Hide It From Every Storefront'
        : 'Make It Available Again';
    if (!window.confirm(`${verb} ${row.display_name}? This Will ${detail} (${row.total_skus} SKUs).`)) return;

    setBusy(row.slug);
    try {
      const res = await fetch('/api/admin/catalog-risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ slug: row.slug, action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Action Failed.');
      toast.success(`${verb} Applied To ${row.display_name} (${json.affected_skus} SKUs).`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action Failed.');
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p style={{ color: 'var(--grey-400)' }}>Loading Risk Audit...</p>;
  if (error) {
    return (
      <div className="glass-panel"><div className="" style={{ padding: 'var(--space-5)' }}>
        <p style={{ color: 'var(--white)', margin: 0 }}>Could Not Load The Risk Audit. Please Refresh.</p>
      </div></div>
    );
  }

  const visible = rows.filter((r) => showLow || r.risk_level !== 'low');
  const groups: RiskRow['risk_level'][] = ['critical', 'high', 'moderate', ...(showLow ? ['low' as const] : [])];

  return (
    <div>
      {summary && (
        <div className="grid-4" style={{ marginBottom: 'var(--space-6)' }}>
          {(['critical', 'high', 'moderate', 'low'] as const).map((k) => (
            <div key={k} className="glass-panel">
              <div className="" style={{ padding: 'var(--space-5)' }}>
                <div style={{ fontSize: '1.7rem', fontWeight: 800, color: RISK_META[k].color, lineHeight: 1.1 }}>
                  {summary[k]}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--silver)', marginTop: 'var(--space-2)', fontWeight: 600 }}>
                  {RISK_META[k].label} Risk
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-4)' }}>
        <button
          type="button"
          onClick={() => setShowLow((v) => !v)}
          style={{
            background: 'transparent', border: '1px solid rgba(192,184,168,0.25)', color: 'var(--silver)',
            borderRadius: 8, padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600,
          }}
        >
          {showLow ? 'Hide Low-Risk Compounds' : 'Show Low-Risk Compounds'}
        </button>
      </div>

      {groups.map((level) => {
        const groupRows = visible.filter((r) => r.risk_level === level);
        if (groupRows.length === 0) return null;
        return (
          <div key={level} style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              <span style={{
                fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                color: RISK_META[level].color, background: RISK_META[level].bg, padding: '4px 10px', borderRadius: 6,
              }}>
                {RISK_META[level].label} Risk
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--grey-400)' }}>{groupRows.length} Compounds</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {groupRows.map((row) => {
                const isBusy = busy === row.slug;
                const allBlocked = row.total_skus > 0 && row.active_skus === 0;
                return (
                  <div key={row.slug} className="glass-panel">
                    <div className="" style={{ padding: 'var(--space-4) var(--space-5)' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div style={{ minWidth: 0, flex: '1 1 360px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ color: 'var(--white)', fontWeight: 700, fontSize: '1rem' }}>{row.display_name}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--grey-400)' }}>{row.category}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0' }}>
                            <Badge text={TIER_LABEL[row.evidence_tier] ?? row.evidence_tier} />
                            <Badge text={`Recommended: ${ACTION_LABEL[row.recommended_action]}`} />
                          </div>
                          <ul style={{ margin: '4px 0 0', paddingLeft: 18, color: 'var(--silver)', fontSize: '0.82rem', lineHeight: 1.5 }}>
                            {row.risk_reasons.map((r, i) => <li key={i}>{r}</li>)}
                          </ul>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
                          <div style={{ fontSize: '0.74rem', color: 'var(--grey-400)', textAlign: 'right' }}>
                            <span style={{ color: allBlocked ? 'var(--red)' : '#68D391', fontWeight: 700 }}>{row.active_skus}</span> Active
                            {row.banned_skus > 0 && <> / <span style={{ color: 'var(--red)', fontWeight: 700 }}>{row.banned_skus}</span> Blocked</>}
                            {' '}Of {row.total_skus} SKUs
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <ActionButton label="Restrict" onClick={() => applyAction(row, 'restrict')} disabled={isBusy} />
                            <ActionButton label="Remove" danger onClick={() => applyAction(row, 'remove')} disabled={isBusy} />
                            {allBlocked && <ActionButton label="Reactivate" subtle onClick={() => applyAction(row, 'reactivate')} disabled={isBusy} />}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Badge({ text, danger }: { text: string; danger?: boolean }) {
  return (
    <span style={{
      fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6,
      color: danger ? '#FF6B6B' : 'var(--silver)',
      background: danger ? 'rgba(229,62,62,0.14)' : 'rgba(168,180,192,0.12)',
    }}>
      {text}
    </span>
  );
}

function ActionButton({ label, onClick, disabled, danger, subtle }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; subtle?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        fontSize: '0.78rem', fontWeight: 700, padding: '6px 12px', borderRadius: 8, cursor: disabled ? 'default' : 'pointer',
        border: '1px solid ' + (danger ? 'rgba(229,62,62,0.5)' : subtle ? 'rgba(104,211,145,0.5)' : 'rgba(192,184,168,0.3)'),
        background: danger ? 'rgba(229,62,62,0.12)' : subtle ? 'rgba(104,211,145,0.1)' : 'transparent',
        color: danger ? '#FF6B6B' : subtle ? '#68D391' : 'var(--silver)',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}
