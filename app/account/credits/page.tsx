import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface LedgerRow {
  id: string;
  amount: number | string;
  balance_before: number | string;
  balance_after: number | string;
  type: 'issue' | 'redeem' | 'expire' | 'adjustment';
  source_refund_id: string | null;
  source_order_id: string | null;
  expires_at: string | null;
  description: string | null;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  issue: 'Credit Issued',
  redeem: 'Credit Redeemed',
  expire: 'Credit Expired',
  adjustment: 'Adjustment',
};

const TYPE_COLORS: Record<string, string> = {
  issue: '#68D391',
  redeem: 'var(--red)',
  expire: 'var(--grey-400)',
  adjustment: 'var(--silver)',
};

export default async function AccountCreditsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const service = await createServiceClient();

  const [{ data: balanceRow }, { data: ledger }] = await Promise.all([
    service.from('store_credit_balances').select('balance').eq('user_id', user.id).maybeSingle(),
    service
      .from('store_credits')
      .select('id, amount, balance_before, balance_after, type, source_refund_id, source_order_id, expires_at, description, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const balance = Number(balanceRow?.balance ?? 0);
  const rows: LedgerRow[] = (ledger ?? []) as LedgerRow[];

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 'var(--space-6)' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>Store Credit</h1>
      <p style={{ color: 'var(--grey-400)', fontSize: '0.9rem', marginBottom: 'var(--space-5)' }}>
        Use Store Credit Toward Future Orders At Checkout.
      </p>

      <div className="card-metal" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--grey-400)', marginBottom: 6 }}>Current Balance</div>
        <div style={{ fontSize: '2.4rem', fontWeight: 700, color: 'var(--teal)' }}>
          ${balance.toFixed(2)}
        </div>
      </div>

      <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-4)' }}>Recent Activity</h2>

      {rows.length === 0 ? (
        <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--grey-400)' }}>
          No Credit Activity Yet.
        </div>
      ) : (
        <div className="card-metal" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--silver)' }}>Date</th>
                <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--silver)' }}>Type</th>
                <th style={{ padding: 'var(--space-3)', textAlign: 'right', color: 'var(--silver)' }}>Amount</th>
                <th style={{ padding: 'var(--space-3)', textAlign: 'right', color: 'var(--silver)' }}>Balance</th>
                <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--silver)' }}>Description</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const amt = Number(r.amount);
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: 'var(--space-3)', color: 'var(--grey-400)' }}>
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: 'var(--space-3)', color: TYPE_COLORS[r.type] ?? 'var(--grey-400)', fontWeight: 600 }}>
                      {TYPE_LABELS[r.type] ?? r.type}
                    </td>
                    <td style={{ padding: 'var(--space-3)', textAlign: 'right', color: amt >= 0 ? '#68D391' : 'var(--red)', fontWeight: 600 }}>
                      {amt >= 0 ? '+' : ''}${amt.toFixed(2)}
                    </td>
                    <td style={{ padding: 'var(--space-3)', textAlign: 'right', color: 'var(--teal)', fontWeight: 600 }}>
                      ${Number(r.balance_after).toFixed(2)}
                    </td>
                    <td style={{ padding: 'var(--space-3)', color: 'var(--grey-300)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.description || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
