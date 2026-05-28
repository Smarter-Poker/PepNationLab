'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Transaction {
  id: string;
  agent_id: string;
  type: string;
  // Postgres numeric serializes as string over PostgREST — keep loose typing
  // and coerce with Number(...) at render time.
  amount: number | string;
  balance_before: number | string;
  balance_after: number | string;
  description: string;
  reference_id: string | null;
  reference_type: string | null;
  created_at: string;
  profiles: {
    full_name: string | null;
    email: string;
  };
}

// Allowed values of `balance_transactions.type` (DB CHECK constraint):
// 'credit' | 'debit' | 'order_charge' | 'statement_payment'
// | 'initial_deposit' | 'adjustment'
const TYPE_META: Record<string, { label: string; badge: string }> = {
  credit:            { label: 'Credit',            badge: 'badge-teal' },
  debit:             { label: 'Debit',             badge: 'badge-red' },
  order_charge:      { label: 'Order Charge',      badge: 'badge-red' },
  statement_payment: { label: 'Statement Payment', badge: 'badge-teal' },
  initial_deposit:   { label: 'Initial Deposit',   badge: 'badge-teal' },
  adjustment:        { label: 'Adjustment',        badge: 'badge-silver' },
};

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const res = await fetch('/api/admin/transactions?limit=250');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load ledger');
      setTransactions(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getUsername = (email: string, fullName: string | null) => {
    if (fullName) return fullName;
    if (!email) return 'Unknown';
    return `@${email.split('@')[0]}`;
  };

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-8)' }}>
        <div>
          <h1 style={{ fontSize: '2rem', color: 'var(--white)', marginBottom: 'var(--space-2)' }}>
            Global Master Ledger
          </h1>
          <p style={{ color: 'var(--grey-400)', fontSize: '0.95rem', margin: 0 }}>
            Immutable Record Of All System Financial Transactions & Balance Modifications.
          </p>
        </div>
        <button onClick={fetchTransactions} className="btn btn-secondary btn-sm" disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh Ledger'}
        </button>
      </div>

      {error && (
        <div style={{ padding: 'var(--space-4)', background: 'var(--red-bg)', borderLeft: '3px solid var(--red)', borderRadius: '0 var(--radius-md) var(--radius-md) 0', marginBottom: 'var(--space-6)', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      <div className="card-metal" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <th style={{ padding: 'var(--space-4)', color: 'var(--grey-400)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
              <th style={{ padding: 'var(--space-4)', color: 'var(--grey-400)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agent Profile</th>
              <th style={{ padding: 'var(--space-4)', color: 'var(--grey-400)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Event Type</th>
              <th style={{ padding: 'var(--space-4)', color: 'var(--grey-400)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</th>
              <th style={{ padding: 'var(--space-4)', color: 'var(--grey-400)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Amount</th>
              <th style={{ padding: 'var(--space-4)', color: 'var(--grey-400)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Balance Post</th>
            </tr>
          </thead>
          <tbody>
            {loading && transactions.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--grey-400)' }}>
                  Syncing Ledger Data...
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--grey-400)' }}>
                  No Financial Transactions Recorded.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => {
                const meta = TYPE_META[tx.type] ?? {
                  label: tx.type.replace(/_/g, ' '),
                  badge: 'badge-silver',
                };
                const rawAmount = Number(tx.amount);
                const balanceAfter = Number(tx.balance_after);
                const safeAmount = Number.isFinite(rawAmount) ? rawAmount : 0;
                const safeBalance = Number.isFinite(balanceAfter) ? balanceAfter : 0;
                const isPositive = safeAmount >= 0;
                const sign = isPositive ? '+' : '-';
                const amountColor = isPositive ? 'var(--teal)' : 'var(--red)';
                return (
                  <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: 'var(--space-4)', color: 'var(--silver-light)', fontSize: '0.85rem' }}>
                      {new Date(tx.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: 'var(--space-4)', fontSize: '0.9rem', color: 'var(--white)' }}>
                      {getUsername(tx.profiles?.email, tx.profiles?.full_name)}
                    </td>
                    <td style={{ padding: 'var(--space-4)' }}>
                      <span className={`badge ${meta.badge}`} style={{ fontSize: '0.7rem' }}>
                        {meta.label}
                      </span>
                    </td>
                    <td style={{ padding: 'var(--space-4)', color: 'var(--silver)', fontSize: '0.85rem' }}>
                      {tx.description}
                    </td>
                    <td style={{ padding: 'var(--space-4)', color: amountColor, fontSize: '0.95rem', fontWeight: 600, textAlign: 'right', fontFamily: 'var(--font-brand)' }}>
                      {sign}${Math.abs(safeAmount).toFixed(2)}
                    </td>
                    <td style={{ padding: 'var(--space-4)', color: 'var(--white)', fontSize: '0.9rem', fontWeight: 500, textAlign: 'right' }}>
                      ${safeBalance.toFixed(2)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
