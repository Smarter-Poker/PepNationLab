'use client';

/**
 * Admin-account "Command Center" dashboard.
 *
 * This is the dedicated landing dashboard for is_admin_account accounts (e.g.
 * Savage Brands) -- the "super-agent admin" experience. It is DELIBERATELY
 * separate from the manufacturer dashboard (/dashboard/manufacturer): no
 * trilingual language toggle, no manufacturer commission card, no factory
 * pricing/earnings. Instead it surfaces network stats, agent management, and
 * one-tap access to the full admin toolset (these accounts hold admin-panel
 * access, so every /admin/* link resolves).
 *
 * Data reuses the endpoints that already back admin accounts:
 *   GET /api/manufacturer/overview      -> display name
 *   GET /api/manufacturer/agents        -> downline agents + 30d GMV
 *   GET /api/manufacturer/network-orders-> network order count
 *   GET /api/agent/my-qr                -> recruit QR
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface NetworkAgent {
  id: string;
  username: string | null;
  fullName: string | null;
  role: string;
  isSuperAgent: boolean;
  isActive: boolean;
  commissionPct: number | null;
  tier: string | null;
  slug: string | null;
  gmv30d: number;
}

const TEAL = 'var(--teal, #00C4BC)';
const SILVER = 'var(--silver, #A8B4C0)';

const card: React.CSSProperties = {
  background: '#0F1923',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 14,
  padding: 20,
};
const btnGhost: React.CSSProperties = {
  background: 'transparent',
  color: SILVER,
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 8,
  padding: '4px 10px',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: '0.7rem',
};

const money = (n: number) => `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;

// Icon set — small inline SVGs so the grid reads as one system.
const ip = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const ICONS: Record<string, React.ReactNode> = {
  agents: <svg {...ip}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  orders: <svg {...ip}><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>,
  pricing: <svg {...ip}><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  products: <svg {...ip}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>,
  sales: <svg {...ip}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>,
  coupons: <svg {...ip}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>,
  statements: <svg {...ip}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
  network: <svg {...ip}><circle cx="12" cy="5" r="3" /><circle cx="5" cy="19" r="3" /><circle cx="19" cy="19" r="3" /><line x1="12" y1="8" x2="5" y2="16" /><line x1="12" y1="8" x2="19" y2="16" /></svg>,
  flash: <svg {...ip}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>,
  admin: <svg {...ip}><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></svg>,
};

const TOOLS: { href: string; key: string; label: string; desc: string }[] = [
  { href: '/admin/agents', key: 'agents', label: 'Agents', desc: 'Create, promote & manage your downline' },
  { href: '/admin/orders', key: 'orders', label: 'Orders & Fulfillment', desc: 'Approve, ship & track every order' },
  { href: '/admin/pricing', key: 'pricing', label: 'Pricing', desc: 'Set catalog & tier pricing' },
  { href: '/admin/products', key: 'products', label: 'Products', desc: 'Manage the product catalog' },
  { href: '/admin/sales', key: 'sales', label: 'Sales & Revenue', desc: 'KPIs, top products & leaderboard' },
  { href: '/admin/coupons', key: 'coupons', label: 'Coupons', desc: 'Promo codes & discounts' },
  { href: '/admin/statements', key: 'statements', label: 'Statements', desc: 'Weekly agent settlements' },
  { href: '/admin/network', key: 'network', label: 'Network', desc: 'Full downline tree & reparenting' },
  { href: '/admin/flash-sales', key: 'flash', label: 'Flash Sales', desc: 'Time-boxed store-wide deals' },
  { href: '/admin', key: 'admin', label: 'Full Admin Panel', desc: 'Every platform control' },
];

export default function NetworkDashboardClient() {
  const [name, setName] = useState<string>('');
  const [agents, setAgents] = useState<NetworkAgent[]>([]);
  const [orderCount, setOrderCount] = useState<number | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [ov, ag] = await Promise.all([
          fetch('/api/manufacturer/overview', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('/api/manufacturer/agents', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
        ]);
        if (!alive) return;
        const p = ov?.profile;
        setName(p?.displayName || p?.fullName || p?.username || 'Admin');
        setAgents(Array.isArray(ag?.agents) ? ag.agents : Array.isArray(ag) ? ag : []);
      } finally {
        if (alive) setLoading(false);
      }
      fetch('/api/manufacturer/network-orders', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null).then(j => { if (alive && j) setOrderCount(Array.isArray(j.orders) ? j.orders.length : null); }).catch(() => {});
      fetch('/api/agent/my-qr', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null).then(j => { if (alive && j) setQr(j.qrDataUrl ?? null); }).catch(() => {});
    })();
    return () => { alive = false; };
  }, []);

  const totalAgents = agents.length;
  const activeAgents = agents.filter(a => a.isActive).length;
  const superAgents = agents.filter(a => a.isSuperAgent).length;
  const gmv30 = agents.reduce((s, a) => s + (Number(a.gmv30d) || 0), 0);

  const kpis = [
    { label: 'Total Agents', value: String(totalAgents), accent: TEAL },
    { label: 'Active', value: String(activeAgents), accent: '#4ADE80' },
    { label: 'Super Agents', value: String(superAgents), accent: TEAL },
    { label: 'Network GMV (30d)', value: money(gmv30), accent: '#4ADE80' },
    { label: 'Network Orders', value: orderCount == null ? '—' : String(orderCount), accent: TEAL },
  ];

  async function agentAction(a: NetworkAgent, kind: 'super' | 'active') {
    setBusy(s => ({ ...s, [a.id]: true }));
    try {
      if (kind === 'super') {
        const res = await fetch(`/api/manufacturer/agents/${a.id}/super-upgrade`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_super_agent: !a.isSuperAgent }),
        });
        if (res.ok) setAgents(prev => prev.map(x => x.id === a.id ? { ...x, isSuperAgent: !x.isSuperAgent, role: !x.isSuperAgent ? 'super_agent' : 'agent' } : x));
      } else {
        const res = await fetch(`/api/manufacturer/agents/${a.id}/toggle-active`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: !a.isActive }),
        });
        if (res.ok) setAgents(prev => prev.map(x => x.id === a.id ? { ...x, isActive: !x.isActive } : x));
      }
    } finally {
      setBusy(s => ({ ...s, [a.id]: false }));
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050A0F', color: '#FFFFFF', paddingBottom: 60 }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 16px' }}>

        {/* Header */}
        <header style={{
          marginTop: 20, marginBottom: 22, padding: '24px 26px', borderRadius: 18,
          background: 'linear-gradient(135deg, rgba(0,196,188,0.14), rgba(74,222,128,0.06) 60%, rgba(15,25,35,0.2))',
          border: '1px solid rgba(0,196,188,0.22)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14,
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: TEAL }}>Command Center</div>
            <h1 style={{ margin: '4px 0 0', fontSize: '1.7rem', fontWeight: 900, lineHeight: 1.1 }}>{loading ? '…' : name}</h1>
            <div style={{ marginTop: 4, fontSize: '0.85rem', color: SILVER }}>Manage your network, agents, and the full platform.</div>
          </div>
          <Link href="/admin" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none',
            background: TEAL, color: '#04221F', fontWeight: 800, fontSize: '0.85rem',
            padding: '10px 18px', borderRadius: 10, whiteSpace: 'nowrap',
          }}>
            <span style={{ display: 'inline-flex' }}>{ICONS.admin}</span> Full Admin Panel
          </Link>
        </header>

        {/* KPI tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ ...card, padding: '16px 18px' }}>
              <div style={{ fontSize: '1.7rem', fontWeight: 900, color: k.accent, fontFamily: 'ui-monospace, monospace', letterSpacing: '-0.02em' }}>{loading ? '—' : k.value}</div>
              <div style={{ fontSize: '0.72rem', color: SILVER, marginTop: 4, fontWeight: 600 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Tool grid */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 2px 12px' }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Admin Tools</h2>
          <span style={{ fontSize: '0.75rem', color: SILVER }}>Everything, one tap away</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 28 }}>
          {TOOLS.map(tool => (
            <Link key={tool.href} href={tool.href} className="cc-tool" style={{
              ...card, display: 'flex', gap: 13, alignItems: 'flex-start', textDecoration: 'none', color: '#FFFFFF',
              transition: 'transform 0.14s ease, border-color 0.14s ease, background 0.14s ease',
            }}>
              <span style={{
                flexShrink: 0, width: 40, height: 40, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,196,188,0.12)', color: TEAL,
              }}>{ICONS[tool.key]}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 800, fontSize: '0.92rem' }}>{tool.label}</span>
                <span style={{ display: 'block', fontSize: '0.75rem', color: SILVER, marginTop: 2, lineHeight: 1.35 }}>{tool.desc}</span>
              </span>
            </Link>
          ))}
        </div>

        {/* My Agents */}
        <div style={{ ...card, padding: 0, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>My Agents</h2>
            <Link href="/admin/agents" style={{ color: TEAL, fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none' }}>Create &amp; manage &rarr;</Link>
          </div>
          {loading ? (
            <div style={{ padding: 24, color: SILVER, fontSize: '0.85rem' }}>Loading agents…</div>
          ) : agents.length === 0 ? (
            <div style={{ padding: 24, color: SILVER, fontSize: '0.85rem' }}>
              No agents yet. <Link href="/admin/agents" style={{ color: TEAL, textDecoration: 'none' }}>Create your first agent &rarr;</Link>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {['Agent', 'Role', 'Tier', 'Commission', 'GMV (30d)', 'Store', 'Status', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: SILVER, fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {agents.map(a => (
                    <tr key={a.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: a.isActive ? 1 : 0.55 }}>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ fontWeight: 700 }}>{a.fullName || a.username}</div>
                        <div style={{ fontSize: '0.7rem', color: SILVER }}>@{a.username}</div>
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontSize: '0.66rem', padding: '2px 8px', borderRadius: 999, border: `1px solid ${a.isSuperAgent ? TEAL : 'rgba(168,180,192,0.3)'}`, color: a.isSuperAgent ? TEAL : SILVER, fontWeight: 700 }}>
                          {a.isSuperAgent ? 'Super Agent' : 'Agent'}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', color: SILVER }}>{a.tier ? a.tier.replace('_', ' ').toUpperCase() : '—'}</td>
                      <td style={{ padding: '11px 14px', color: TEAL, fontWeight: 700 }}>{a.commissionPct != null ? `${a.commissionPct}%` : '—'}</td>
                      <td style={{ padding: '11px 14px', fontWeight: 700, fontFamily: 'ui-monospace, monospace' }}>{money(Number(a.gmv30d) || 0)}</td>
                      <td style={{ padding: '11px 14px' }}>
                        {a.slug ? <a href={`/${a.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: TEAL, fontSize: '0.75rem', textDecoration: 'none' }}>/{a.slug}</a> : '—'}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontSize: '0.66rem', padding: '2px 8px', borderRadius: 999, background: a.isActive ? 'rgba(0,196,188,0.12)' : 'rgba(168,180,192,0.1)', color: a.isActive ? TEAL : SILVER, fontWeight: 700 }}>
                          {a.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button type="button" disabled={busy[a.id]} onClick={() => agentAction(a, 'super')}
                            style={{ ...btnGhost, opacity: busy[a.id] ? 0.5 : 1 }}>
                            {a.isSuperAgent ? '↓ Demote' : '↑ Super'}
                          </button>
                          <button type="button" disabled={busy[a.id]} onClick={() => agentAction(a, 'active')}
                            style={{ ...btnGhost, opacity: busy[a.id] ? 0.5 : 1, color: a.isActive ? '#F87171' : TEAL, borderColor: a.isActive ? 'rgba(248,113,113,0.4)' : 'rgba(0,196,188,0.4)' }}>
                            {a.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recruit */}
        <div style={{ ...card, display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flexShrink: 0, width: 132, height: 132, borderRadius: 12, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {qr ? <img src={qr} alt="Referral QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ color: '#0F1923', fontSize: '0.75rem' }}>QR…</span>}
          </div>
          <div style={{ minWidth: 200, flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Recruit Agents</h2>
            <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: SILVER, lineHeight: 1.5 }}>
              Share your referral QR or link so new agents join directly under your network. Manage everyone from the Agents tool above.
            </p>
          </div>
        </div>

      </div>

      <style>{`.cc-tool:hover{transform:translateY(-2px);border-color:rgba(0,196,188,0.5)!important;background:#12202c!important;}`}</style>
    </div>
  );
}
