'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * SACA Phase 8: Parent landing page for sub-agent management.
 * Fetches GET /api/agent/sub-agents (Phase 2 endpoint) and renders a
 * read-only table. Promote-new and edit links route to dedicated pages.
 */

type Row = {
  id: string;
  full_name?: string | null;
  username?: string | null;
  email?: string | null;
  commission_pct: number | null;
  commission_active_since: string | null;
  account_type: 'credit' | 'prepaid' | string | null;
  credit_limit: number | null;
  prepaid_balance: number | null;
  pending_commission: number;
  is_active: boolean | null;
  created_at: string | null;
};

function fmtMoney(v: number | null | undefined): string {
  if (v == null) return '$0.00';
  return `$${Number(v).toFixed(2)}`;
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString();
  } catch {
    return s;
  }
}

export default function SubAgentsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/agent/sub-agents', { credentials: 'include' });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
        if (!cancelled) setRows(Array.isArray(json?.data) ? json.data : []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed To Load.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '28px', margin: 0 }}>Your Sub-Agents</h1>
        <Link href="/dashboard/agent/sub-agents/promote" className="btn-primary" style={{ padding: '8px 16px' }}>
          Promote New Sub-Agent
        </Link>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div style={{ color: '#E53E3E' }}>{error}</div>
      ) : rows.length === 0 ? (
        <div className="card-glass" style={{ padding: '20px' }}>
          <p style={{ margin: 0 }}>You Have No Sub-Agents Yet.</p>
          <p style={{ marginTop: '8px', opacity: 0.8 }}>
            Promote A Researcher From Your Downline To Get Started. Sub-Agents Sell On Your
            Storefront At Your Prices And Earn A Commission Percentage Of Each Sale, Settled As
            Digital Credits Every Sunday Night.
          </p>
        </div>
      ) : (
        <div className="card-glass" style={{ padding: '12px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Name</th>
                <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Commission %</th>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Payment</th>
                <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Credit Cap</th>
                <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Prepaid Balance</th>
                <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Pending Commission</th>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Joined</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ padding: '8px' }}>
                    <div style={{ fontWeight: 600 }}>{r.full_name || r.username || 'Unnamed'}</div>
                    <div style={{ fontSize: '12px', opacity: 0.7 }}>{r.email || r.username || r.id.slice(0, 8)}</div>
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{r.commission_pct == null ? '—' : `${Number(r.commission_pct)}%`}</td>
                  <td style={{ padding: '8px', textTransform: 'capitalize' }}>{r.account_type || '—'}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{fmtMoney(r.credit_limit)}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{fmtMoney(r.prepaid_balance)}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{fmtMoney(r.pending_commission)}</td>
                  <td style={{ padding: '8px' }}>{fmtDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
