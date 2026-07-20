'use client';

import React, { useEffect, useMemo, useState } from 'react';

interface Party { full_name: string | null; email: string | null; }
interface DownlineInvoice {
  id: string;
  super_agent_id: string;
  agent_id: string;
  week_start: string;
  week_end: string;
  total_cogs: number;
  total_shipping: number;
  total_owed: number;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  super_agent: Party | Party[] | null;
  downline: Party | Party[] | null;
}

const one = (p: Party | Party[] | null): Party | null => (Array.isArray(p) ? (p[0] ?? null) : p);
const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n || 0));

export default function DownlineInvoicesSection() {
  const [invoices, setInvoices] = useState<DownlineInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const qs = status !== 'all' ? `?status=${encodeURIComponent(status)}` : '';
    fetch(`/api/admin/sales/downline-invoices${qs}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string })?.error || 'Failed to load invoices');
        return r.json();
      })
      .then((d) => { if (!cancelled) { setInvoices(d.data || []); setError(''); } })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [status]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((inv) => {
      const sa = one(inv.super_agent);
      const dl = one(inv.downline);
      return [sa?.full_name, sa?.email, dl?.full_name, dl?.email].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [invoices, search]);

  const totalOpen = useMemo(
    () => filtered.filter((i) => i.status === 'open').reduce((s, i) => s + Number(i.total_owed || 0), 0),
    [filtered]
  );

  const statusStyle = (s: string): React.CSSProperties => {
    const map: Record<string, [string, string]> = {
      paid: ['rgba(46,213,115,0.2)', '#2ed573'],
      open: ['rgba(255,71,87,0.2)', '#ff4757'],
      disputed: ['rgba(246,173,85,0.2)', '#f6ad55'],
      cancelled: ['rgba(160,160,160,0.2)', '#a0a0a0'],
    };
    const [bg, color] = map[s] || ['rgba(160,160,160,0.2)', '#a0a0a0'];
    return { padding: '4px 8px', borderRadius: 'var(--radius-sm)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, backgroundColor: bg, color };
  };

  return (
    <div className="glass-panel" style={{ marginTop: 'var(--space-6)' }}>
      <div style={{ padding: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--white)', margin: 0, fontWeight: 700 }}>Downline Invoices</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', margin: '4px 0 0' }}>
              Weekly COGS &amp; shipping invoices super-agents bill their downline agents. Click any row to open the printable invoice.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
            <input className="form-input" placeholder="Search agent…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 160, fontSize: '0.85rem' }} />
            <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ cursor: 'pointer', fontSize: '0.85rem' }}>
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="paid">Paid</option>
              <option value="disputed">Disputed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {!loading && !error && (
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--grey-400)' }}>Showing <strong style={{ color: 'var(--white)' }}>{filtered.length}</strong> invoice(s)</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--grey-400)' }}>Open balance: <strong style={{ color: 'var(--teal)' }}>{usd(totalOpen)}</strong></div>
          </div>
        )}

        {loading ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--silver)' }}>Loading invoices…</div>
        ) : error ? (
          <div style={{ padding: 'var(--space-4)', color: '#ff4757' }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--silver)' }}>No downline invoices found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  {['Billing Period', 'Super Agent (Collects)', 'Downline Agent (Owes)', 'COGS', 'Shipping', 'Total Owed', 'Status'].map((h, i) => (
                    <th key={h} style={{ textAlign: i < 3 ? 'left' : 'center', padding: 'var(--space-3)', color: h === 'Total Owed' ? 'var(--teal)' : 'var(--silver)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const sa = one(inv.super_agent);
                  const dl = one(inv.downline);
                  return (
                    <tr key={inv.id} onClick={() => { window.location.href = `/wallet/print?type=agent_invoice&id=${inv.id}`; }} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}>
                      <td style={{ padding: 'var(--space-3)', color: 'var(--white)', whiteSpace: 'nowrap' }}>{inv.week_start} → {inv.week_end}</td>
                      <td style={{ padding: 'var(--space-3)', color: 'var(--silver)' }}>{sa?.full_name || 'Unknown'}<br /><span style={{ fontSize: '0.8em', opacity: 0.7 }}>{sa?.email}</span></td>
                      <td style={{ padding: 'var(--space-3)', color: 'var(--silver)' }}>{dl?.full_name || 'Unknown'}<br /><span style={{ fontSize: '0.8em', opacity: 0.7 }}>{dl?.email}</span></td>
                      <td style={{ padding: 'var(--space-3)', color: 'var(--white)', textAlign: 'center' }}>{usd(inv.total_cogs)}</td>
                      <td style={{ padding: 'var(--space-3)', color: 'var(--white)', textAlign: 'center' }}>{usd(inv.total_shipping)}</td>
                      <td style={{ padding: 'var(--space-3)', color: 'var(--teal)', textAlign: 'center', fontWeight: 700 }}>{usd(inv.total_owed)}</td>
                      <td style={{ padding: 'var(--space-3)', textAlign: 'center' }}><span style={statusStyle(inv.status)}>{inv.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
