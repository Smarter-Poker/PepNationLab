'use client';
import { useState } from 'react';
import Link from 'next/link';

interface DecoratedRow {
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
  referrer_reward: number | null;
  referee_reward: number | null;
  min_order_total: number | null;
  is_active: boolean | null;
}

interface Props {
  rows: DecoratedRow[];
  summary: Summary;
  settings: Settings | null;
  currentStatus: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  applied: 'Applied',
  qualifying: 'Qualifying',
  rewarded: 'Rewarded',
  expired: 'Expired',
  revoked: 'Revoked',
};

const STATUS_TABS: Array<{ value: string | null; label: string }> = [
  { value: null, label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'applied', label: 'Applied' },
  { value: 'qualifying', label: 'Qualifying' },
  { value: 'rewarded', label: 'Rewarded' },
  { value: 'expired', label: 'Expired' },
  { value: 'revoked', label: 'Revoked' },
];

function formatMoney(n: number | null | undefined): string {
  if (n == null) return '-';
  return `$${Number(n).toFixed(2)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  try { return new Date(iso).toLocaleDateString(); } catch { return '-'; }
}

export default function AdminReferralsClient({ rows, summary, settings, currentStatus }: Props) {
  return (
    <section className="section">
      <div className="container">
        <h1 style={{ marginBottom: 'var(--space-4)' }}>Referrals</h1>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-6)',
          }}
        >
          <SummaryCard label="Total" value={summary.total} />
          <SummaryCard label="Qualifying" value={summary.qualifying} />
          <SummaryCard label="Rewarded" value={summary.rewarded} />
          <SummaryCard label="Expired" value={summary.expired} />
          <SummaryCard label="Revoked" value={summary.revoked} />
          <SummaryCard label="Total Rewarded" value={formatMoney(summary.total_rewarded_amount)} />
        </div>

        <ReferralSettingsCard initial={settings} />

        <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 'var(--space-4)' }} aria-label="Status Filter">
          {STATUS_TABS.map((t) => {
            const active = (t.value ?? null) === (currentStatus ?? null);
            const href = t.value ? `/admin/referrals?status=${t.value}` : '/admin/referrals';
            return (
              <Link
                key={t.label}
                href={href}
                className={active ? 'btn btn-primary' : 'btn btn-ghost'}
                style={{ padding: '6px 12px', fontSize: '0.84rem' }}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--surface-3, #1D2D3E)' }}>
                <Th>Code</Th>
                <Th>Referrer</Th>
                <Th>Referee</Th>
                <Th>Status</Th>
                <Th>Referrer Reward</Th>
                <Th>Referee Reward</Th>
                <Th>Applied</Th>
                <Th>Rewarded</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--grey-400, #A8B4C0)' }}>
                    No Referrals Found
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--surface-3, #1D2D3E)' }}>
                    <Td><code>{r.code}</code></Td>
                    <Td>{r.referrer_label}</Td>
                    <Td>{r.referee_label}</Td>
                    <Td>{STATUS_LABELS[r.status] ?? r.status}</Td>
                    <Td>{formatMoney(r.referrer_reward_amount)}</Td>
                    <Td>{formatMoney(r.referee_reward_amount)}</Td>
                    <Td>{formatDate(r.applied_at)}</Td>
                    <Td>{formatDate(r.rewarded_at)}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function ReferralSettingsCard({ initial }: { initial: Settings | null }) {
  const [settings, setSettings] = useState<Settings>(
    initial ?? { referrer_reward: 0, referee_reward: 0, min_order_total: 0, is_active: false },
  );
  const [editing, setEditing] = useState(false);
  const [referrer, setReferrer] = useState(String(initial?.referrer_reward ?? 0));
  const [referee, setReferee] = useState(String(initial?.referee_reward ?? 0));
  const [minOrder, setMinOrder] = useState(String(initial?.min_order_total ?? 0));
  const [active, setActive] = useState<boolean>(!!initial?.is_active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function startEdit() {
    setReferrer(String(settings.referrer_reward ?? 0));
    setReferee(String(settings.referee_reward ?? 0));
    setMinOrder(String(settings.min_order_total ?? 0));
    setActive(!!settings.is_active);
    setError(null);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const referrerVal = Number(referrer);
      const refereeVal = Number(referee);
      const minVal = Number(minOrder);
      if (![referrerVal, refereeVal, minVal].every((n) => Number.isFinite(n) && n >= 0)) {
        setError('All Amounts Must Be Zero Or Greater.');
        return;
      }
      const res = await fetch('/api/admin/referral-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referrer_reward: referrerVal,
          referee_reward: refereeVal,
          min_order_total: minVal,
          is_active: active,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Could Not Save Settings.');
        return;
      }
      setSettings({
        referrer_reward: referrerVal,
        referee_reward: refereeVal,
        min_order_total: minVal,
        is_active: active,
      });
      setEditing(false);
      setSavedAt(Date.now());
    } catch {
      setError('Could Not Save Settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
        <h2 style={{ fontSize: '1rem', margin: 0 }}>Referral Settings</h2>
        {!editing && (
          <button className="btn btn-secondary btn-sm" onClick={startEdit} style={{ padding: '5px 12px', fontSize: '0.8rem' }}>
            Edit Settings
          </button>
        )}
      </div>

      {!editing ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', fontSize: '0.88rem', alignItems: 'center' }}>
          <span>Referrer Reward: <strong>{formatMoney(settings.referrer_reward)}</strong></span>
          <span>Referee Reward: <strong>{formatMoney(settings.referee_reward)}</strong></span>
          <span>Min Order Total: <strong>{formatMoney(settings.min_order_total)}</strong></span>
          <span>Active: <strong style={{ color: settings.is_active ? 'var(--teal, #00C4BC)' : 'var(--grey-400, #A8B4C0)' }}>{settings.is_active ? 'Yes' : 'No'}</strong></span>
          {savedAt && <span style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.82rem' }}>Saved</span>}
        </div>
      ) : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <Field label="Referrer Reward ($)">
              <input type="number" min="0" step="0.01" className="form-input" value={referrer} onChange={(e) => setReferrer(e.target.value)} />
            </Field>
            <Field label="Referee Reward ($)">
              <input type="number" min="0" step="0.01" className="form-input" value={referee} onChange={(e) => setReferee(e.target.value)} />
            </Field>
            <Field label="Min Order Total ($)">
              <input type="number" min="0" step="0.01" className="form-input" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
            </Field>
            <Field label="Program Active">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer', paddingTop: 6 }}>
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                {active ? 'Yes' : 'No'}
              </label>
            </Field>
          </div>
          {error && <div style={{ color: 'var(--red, #E53E3E)', fontSize: '0.82rem', marginBottom: 'var(--space-2)' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving} style={{ padding: '6px 16px', fontSize: '0.82rem' }}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(false); setError(null); }} disabled={saving} style={{ padding: '6px 16px', fontSize: '0.82rem' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="form-label" style={{ display: 'block', fontSize: '0.76rem', color: 'var(--grey-400, #A8B4C0)', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card" style={{ padding: 'var(--space-3)' }}>
      <div style={{ fontSize: '0.78rem', color: 'var(--grey-400, #A8B4C0)' }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: '1.4rem', marginTop: 4 }}>{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--grey-400, #A8B4C0)' }}>
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: '10px 12px' }}>{children}</td>;
}
