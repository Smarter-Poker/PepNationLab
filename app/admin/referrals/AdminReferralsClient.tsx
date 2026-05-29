'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Settings as SettingsIcon } from 'lucide-react';

interface Row {
  id: string;
  referrer_id: string;
  referee_id: string | null;
  referee_email: string | null;
  code: string;
  status: string;
  referrer_reward_amount: number | null;
  referee_reward_amount: number | null;
  qualifying_order_id: string | null;
  applied_at: string | null;
  rewarded_at: string | null;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
  referrer_label: string;
  referee_label: string;
}

interface Summary {
  total: number;
  qualifying: number;
  rewarded: number;
  expired: number;
  revoked: number;
  total_rewarded_amount: number;
}

interface Settings {
  referrer_reward: number;
  referee_reward: number;
  min_order_total: number;
  is_active: boolean;
}

interface Props {
  rows: Row[];
  summary: Summary;
  settings: Settings | null;
  currentStatus: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'var(--grey-400)',
  applied: '#60A5FA',
  qualifying: '#F6AD55',
  rewarded: '#68D391',
  expired: 'var(--grey-500)',
  revoked: '#E53E3E',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  applied: 'Applied',
  qualifying: 'Qualifying',
  rewarded: 'Rewarded',
  expired: 'Expired',
  revoked: 'Revoked',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '—';
  }
}

export default function AdminReferralsClient({ rows, summary, settings, currentStatus }: Props) {
  const router = useRouter();
  const [showSettings, setShowSettings] = useState(false);
  const [form, setForm] = useState<Settings>({
    referrer_reward: Number(settings?.referrer_reward ?? 25),
    referee_reward: Number(settings?.referee_reward ?? 25),
    min_order_total: Number(settings?.min_order_total ?? 100),
    is_active: settings?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/referral-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || 'Failed To Save');
        setSaving(false);
        return;
      }
      toast.success('Settings Saved');
      setShowSettings(false);
      router.refresh();
    } catch {
      toast.error('Network Error');
    }
    setSaving(false);
  }

  async function revoke(id: string) {
    if (!confirm('Revoke This Referral? The Reward Will Not Be Issued.')) return;
    try {
      const res = await fetch('/api/admin/referrals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'revoked' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || 'Failed To Revoke');
        return;
      }
      toast.success('Referral Revoked');
      router.refresh();
    } catch {
      toast.error('Network Error');
    }
  }

  return (
    <div style={{ padding: 'var(--space-6) var(--space-4)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
          <div>
            <h1 style={{ color: 'var(--white)', fontSize: '1.6rem', marginBottom: 'var(--space-2)' }}>
              Referrals
            </h1>
            <p style={{ color: 'var(--silver)', fontSize: '0.92rem' }}>
              Researcher-To-Researcher Referrals And Reward Issuance.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
          >
            <SettingsIcon size={14} aria-hidden /> Adjust Reward Amounts
          </button>
        </div>

        {/* Settings modal-ish panel */}
        {showSettings && (
          <div className="card-metal" style={{ padding: 'var(--space-5)', margin: 'var(--space-4) 0' }}>
            <form onSubmit={saveSettings} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
              <div>
                <label htmlFor="rr" style={lblStyle}>Referrer Reward ($)</label>
                <input id="rr" type="number" step="0.01" min="0" max="10000" value={form.referrer_reward}
                  onChange={(e) => setForm({ ...form, referrer_reward: Number(e.target.value) })}
                  className="input" required />
              </div>
              <div>
                <label htmlFor="re" style={lblStyle}>Referee Reward ($)</label>
                <input id="re" type="number" step="0.01" min="0" max="10000" value={form.referee_reward}
                  onChange={(e) => setForm({ ...form, referee_reward: Number(e.target.value) })}
                  className="input" required />
              </div>
              <div>
                <label htmlFor="min" style={lblStyle}>Min Qualifying Order ($)</label>
                <input id="min" type="number" step="0.01" min="0" max="100000" value={form.min_order_total}
                  onChange={(e) => setForm({ ...form, min_order_total: Number(e.target.value) })}
                  className="input" required />
              </div>
              <div>
                <label htmlFor="active" style={lblStyle}>Program Active</label>
                <select id="active" value={form.is_active ? 'yes' : 'no'}
                  onChange={(e) => setForm({ ...form, is_active: e.target.value === 'yes' })}
                  className="input">
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-2)', gridColumn: '1 / -1' }}>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ fontSize: '0.85rem' }}>
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowSettings(false)} style={{ fontSize: '0.85rem' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)', margin: 'var(--space-4) 0' }}>
          <StatCard label="Total" value={String(summary.total)} />
          <StatCard label="Qualifying" value={String(summary.qualifying)} />
          <StatCard label="Rewarded" value={String(summary.rewarded)} />
          <StatCard label="Expired" value={String(summary.expired)} />
          <StatCard label="Revoked" value={String(summary.revoked)} />
          <StatCard label="$ Issued" value={`$${summary.total_rewarded_amount.toFixed(2)}`} />
        </div>

        {/* Status filter */}
        <form method="GET" style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <select
            name="status"
            defaultValue={currentStatus ?? ''}
            className="input"
            style={{ maxWidth: 220 }}
          >
            <option value="">All Statuses</option>
            <option value="qualifying">Qualifying</option>
            <option value="rewarded">Rewarded</option>
            <option value="expired">Expired</option>
            <option value="revoked">Revoked</option>
            <option value="pending">Pending</option>
            <option value="applied">Applied</option>
          </select>
          <button type="submit" className="btn btn-primary" style={{ fontSize: '0.85rem' }}>Filter</button>
          <Link href="/admin/referrals" className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>Reset</Link>
        </form>

        <div className="card-metal" style={{ padding: 'var(--space-5)' }}>
          {rows.length === 0 ? (
            <p style={{ color: 'var(--silver)', textAlign: 'center', padding: 'var(--space-6)' }}>
              No Referrals Match The Current Filters.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Created</th>
                    <th style={thStyle}>Referrer</th>
                    <th style={thStyle}>Referee</th>
                    <th style={thStyle}>Code</th>
                    <th style={thStyle}>Reward</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Applied</th>
                    <th style={thStyle}>Rewarded</th>
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const color = STATUS_COLORS[r.status] ?? 'var(--grey-400)';
                    const canRevoke = r.status === 'qualifying' || r.status === 'pending' || r.status === 'applied';
                    const totalReward =
                      Number(r.referrer_reward_amount ?? 0) + Number(r.referee_reward_amount ?? 0);
                    return (
                      <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={tdStyle}>{formatDate(r.created_at)}</td>
                        <td style={tdStyle}>{r.referrer_label}</td>
                        <td style={tdStyle}>{r.referee_label}</td>
                        <td style={{ ...tdStyle, fontFamily: 'var(--font-brand)', letterSpacing: '0.08em' }}>{r.code}</td>
                        <td style={tdStyle}>${totalReward.toFixed(2)}</td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              fontSize: '0.72rem', fontWeight: 700, color,
                              background: `${color}18`, border: `1px solid ${color}40`,
                              padding: '2px var(--space-2)', borderRadius: 'var(--radius-full)',
                            }}
                          >
                            {STATUS_LABELS[r.status] ?? r.status}
                          </span>
                        </td>
                        <td style={tdStyle}>{formatDate(r.applied_at)}</td>
                        <td style={tdStyle}>{formatDate(r.rewarded_at)}</td>
                        <td style={tdStyle}>
                          {canRevoke ? (
                            <button
                              type="button"
                              onClick={() => revoke(r.id)}
                              className="btn btn-danger"
                              style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                            >
                              Revoke
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-metal" style={{ padding: 'var(--space-4)' }}>
      <div style={{ color: 'var(--grey-500)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ color: 'var(--white)', fontSize: '1.3rem', fontWeight: 700 }}>{value}</div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  fontSize: '0.72rem',
  color: 'var(--grey-500)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  padding: 'var(--space-2)',
  fontWeight: 600,
};
const tdStyle: React.CSSProperties = {
  padding: 'var(--space-2)',
  fontSize: '0.85rem',
  color: 'var(--silver)',
};
const lblStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.78rem',
  color: 'var(--grey-400)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 4,
};
