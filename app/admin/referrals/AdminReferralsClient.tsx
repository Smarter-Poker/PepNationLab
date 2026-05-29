'use client';
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

        {settings && (
          <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            <h2 style={{ fontSize: '1rem', marginBottom: 'var(--space-2)' }}>Referral Settings</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', fontSize: '0.88rem' }}>
              <span>Referrer Reward: <strong>{formatMoney(settings.referrer_reward)}</strong></span>
              <span>Referee Reward: <strong>{formatMoney(settings.referee_reward)}</strong></span>
              <span>Min Order Total: <strong>{formatMoney(settings.min_order_total)}</strong></span>
              <span>Active: <strong>{settings.is_active ? 'Yes' : 'No'}</strong></span>
            </div>
          </div>
        )}

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
