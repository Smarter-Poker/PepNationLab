'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import LazyAdminOverviewSparkline from '@/components/LazyAdminOverviewSparkline';
import { exportCSV, downloadCSV } from '@/lib/export';
import { Megaphone, Send, Users, Check } from 'lucide-react';

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

const TEAL = 'var(--teal, #C0B8A8)';
const SILVER = 'var(--silver, #A8B4C0)';
const GREEN = '#89C79C';

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

interface Props {
  initialName: string;
  initialAgents: NetworkAgent[];
  initialOrderCount: number | null;
  initialQr: string | null;
  sparkline: { date: string; revenue: number }[];
}

type SortKey = 'name' | 'role' | 'tier' | 'commission' | 'gmv' | 'status';

export default function NetworkDashboardClient({
  initialName,
  initialAgents,
  initialOrderCount,
  initialQr,
  sparkline,
}: Props) {
  const [agents, setAgents] = useState<NetworkAgent[]>(initialAgents);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  
  // Sorting and Filtering
  const [filterText, setFilterText] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('gmv');
  const [sortAsc, setSortAsc] = useState(false);

  // Broadcast state
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastUrl, setBroadcastUrl] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);

  const totalAgents = agents.length;
  const activeAgents = agents.filter(a => a.isActive).length;
  const superAgents = agents.filter(a => a.isSuperAgent).length;
  const gmv30 = agents.reduce((s, a) => s + (Number(a.gmv30d) || 0), 0);

  const kpis = [
    { label: 'Total Agents', value: String(totalAgents), accent: TEAL },
    { label: 'Active', value: String(activeAgents), accent: GREEN },
    { label: 'Super Agents', value: String(superAgents), accent: TEAL },
    { label: 'Network Orders', value: initialOrderCount == null ? '—' : String(initialOrderCount), accent: TEAL },
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

  async function updateAgent(a: NetworkAgent, updates: { tier?: string; commission_pct?: number | null }) {
    setBusy(s => ({ ...s, [a.id]: true }));
    try {
      const res = await fetch(`/api/manufacturer/agents/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        setAgents(prev => prev.map(x => x.id === a.id ? { ...x, ...updates } : x));
      }
    } finally {
      setBusy(s => ({ ...s, [a.id]: false }));
    }
  }

  async function impersonate(targetUserId: string) {
    if (!window.confirm('Impersonate this agent? You will be redirected to their dashboard.')) return;
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_user_id: targetUserId }),
      });
      const data = await res.json();
      if (data.ok && data.redirect_to) {
        window.location.href = data.redirect_to;
      } else {
        alert(data.error || 'Failed to start impersonation');
      }
    } catch {
      alert('An error occurred while trying to impersonate');
    }
  }

  const handleExportCSV = () => {
    const columns = [
      { key: 'name', label: 'Agent Name' },
      { key: 'username', label: 'Username' },
      { key: 'role', label: 'Role' },
      { key: 'tier', label: 'Tier' },
      { key: 'commission', label: 'Commission (%)' },
      { key: 'gmv', label: '30-Day GMV ($)' },
      { key: 'status', label: 'Status' },
      { key: 'store', label: 'Store URL' },
    ];
    const rows = filteredAgents.map(a => ({
      name: a.fullName || a.username || '',
      username: a.username || '',
      role: a.isSuperAgent ? 'Super Agent' : 'Agent',
      tier: a.tier || '',
      commission: String(a.commissionPct ?? ''),
      gmv: String(a.gmv30d),
      status: a.isActive ? 'Active' : 'Inactive',
      store: a.slug ? `https://pepnationlab.com/${a.slug}` : '',
    }));
    const csvData = exportCSV(rows, columns);
    downloadCSV(`network_agents_${new Date().toISOString().split('T')[0]}.csv`, csvData);
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sendingBroadcast) return;
    setSendingBroadcast(true);
    setBroadcastResult(null);
    try {
      const res = await fetch('/api/manufacturer/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: broadcastTitle, message: broadcastMessage, url: broadcastUrl || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { alert(json?.error || 'Failed to send broadcast'); return; }
      setBroadcastResult(`Sent to ${json.sent} agents.`);
      setBroadcastTitle(''); setBroadcastMessage(''); setBroadcastUrl('');
    } catch {
      alert('Something went wrong. Please try again.');
    } finally {
      setSendingBroadcast(false);
    }
  };

  const filteredAgents = useMemo(() => {
    let result = [...agents];
    if (filterText) {
      const lower = filterText.toLowerCase();
      result = result.filter(a => 
        a.fullName?.toLowerCase().includes(lower) || 
        a.username?.toLowerCase().includes(lower) || 
        a.slug?.toLowerCase().includes(lower)
      );
    }
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = (a.fullName || a.username || '').localeCompare(b.fullName || b.username || '');
          break;
        case 'role':
          cmp = (a.isSuperAgent === b.isSuperAgent) ? 0 : a.isSuperAgent ? -1 : 1;
          break;
        case 'tier':
          cmp = (a.tier || '').localeCompare(b.tier || '');
          break;
        case 'commission':
          cmp = (a.commissionPct || 0) - (b.commissionPct || 0);
          break;
        case 'gmv':
          cmp = a.gmv30d - b.gmv30d;
          break;
        case 'status':
          cmp = (a.isActive === b.isActive) ? 0 : a.isActive ? -1 : 1;
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return result;
  }, [agents, filterText, sortKey, sortAsc]);

  const setSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#050A0F', color: '#FFFFFF', paddingBottom: 60 }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 16px' }}>

        {/* Header */}
        <header style={{
          marginTop: 20, marginBottom: 22, padding: '24px 26px', borderRadius: 18,
          background: 'linear-gradient(135deg, rgba(192,184,168,0.14), rgba(192,184,168,0.05) 60%, rgba(15,25,35,0.2))',
          border: '1px solid rgba(192,184,168,0.22)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14,
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: TEAL }}>Command Center</div>
            <h1 style={{ margin: '4px 0 0', fontSize: '1.7rem', fontWeight: 900, lineHeight: 1.1 }}>{initialName}</h1>
            <div style={{ marginTop: 4, fontSize: '0.85rem', color: SILVER }}>Manage your network, agents, and the full platform.</div>
          </div>
          <Link href="/admin" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none',
            background: TEAL, color: '#050A0F', fontWeight: 800, fontSize: '0.85rem',
            padding: '10px 18px', borderRadius: 10, whiteSpace: 'nowrap',
          }}>
            <span style={{ display: 'inline-flex' }}>{ICONS.admin}</span> Full Admin Panel
          </Link>
        </header>

        {/* Sparkline & KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: 12, marginBottom: 24, alignItems: 'stretch' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, gridAutoRows: '1fr' }}>
            {kpis.map(k => (
              <div key={k.label} style={{ ...card, padding: '16px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: '1.7rem', fontWeight: 900, color: k.accent, fontFamily: 'ui-monospace, monospace', letterSpacing: '-0.02em' }}>{k.value}</div>
                <div style={{ fontSize: '0.72rem', color: SILVER, marginTop: 4, fontWeight: 600 }}>{k.label}</div>
              </div>
            ))}
          </div>
          <div style={{ ...card, padding: '16px 20px', minHeight: 180 }}>
            <LazyAdminOverviewSparkline data={sparkline} />
          </div>
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
                background: 'rgba(192,184,168,0.12)', color: TEAL,
              }}>{ICONS[tool.key]}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 800, fontSize: '0.92rem' }}>{tool.label}</span>
                <span style={{ display: 'block', fontSize: '0.75rem', color: SILVER, marginTop: 2, lineHeight: 1.35 }}>{tool.desc}</span>
              </span>
            </Link>
          ))}
        </div>

        {/* Broadcast Form */}
        <div style={{ ...card, marginBottom: 24 }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Megaphone size={20} color={TEAL} /> Broadcast To Network
          </h2>
          <p style={{ color: SILVER, fontSize: '0.85rem', margin: '0 0 1rem' }}>
            Send an in-app and push notification to all {activeAgents} active agents in your downline.
          </p>
          <form onSubmit={handleBroadcast} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
            <input type="text" required maxLength={80} value={broadcastTitle} onChange={e => setBroadcastTitle(e.target.value)} placeholder="Title (e.g. New Peptides Dropped)" style={{ flex: 1, minWidth: 200, padding: '8px 12px', background: '#050A0F', border: '1px solid #1D2D3E', borderRadius: 8, color: '#FFF' }} />
            <input type="text" required maxLength={500} value={broadcastMessage} onChange={e => setBroadcastMessage(e.target.value)} placeholder="Message body..." style={{ flex: 2, minWidth: 250, padding: '8px 12px', background: '#050A0F', border: '1px solid #1D2D3E', borderRadius: 8, color: '#FFF' }} />
            <input type="text" value={broadcastUrl} onChange={e => setBroadcastUrl(e.target.value)} placeholder="URL (e.g. /dashboard)" style={{ flex: 1, minWidth: 150, padding: '8px 12px', background: '#050A0F', border: '1px solid #1D2D3E', borderRadius: 8, color: '#FFF' }} />
            <button type="submit" disabled={sendingBroadcast} style={{ background: TEAL, color: '#050A0F', border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 700, cursor: sendingBroadcast ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Send size={16} /> {sendingBroadcast ? 'Sending...' : 'Send'}
            </button>
          </form>
          {broadcastResult && <p style={{ margin: '10px 0 0', fontSize: '0.85rem', color: GREEN, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={14} /> {broadcastResult}</p>}
        </div>

        {/* My Agents */}
        <div style={{ ...card, padding: 0, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>My Agents</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="text"
                placeholder="Search agents..."
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                style={{ background: '#050A0F', border: '1px solid rgba(255,255,255,0.1)', color: '#FFF', padding: '6px 12px', borderRadius: 6, fontSize: '0.8rem', width: 200 }}
              />
              <button onClick={handleExportCSV} style={btnGhost}>Export CSV</button>
              <Link href="/admin/agents" style={{ color: TEAL, fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none' }}>Create new &rarr;</Link>
            </div>
          </div>
          {agents.length === 0 ? (
            <div style={{ padding: 24, color: SILVER, fontSize: '0.85rem' }}>
              No agents yet. <Link href="/admin/agents" style={{ color: TEAL, textDecoration: 'none' }}>Create your first agent &rarr;</Link>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {[
                      { key: 'name', label: 'Agent' },
                      { key: 'role', label: 'Role' },
                      { key: 'tier', label: 'Tier' },
                      { key: 'commission', label: 'Commission' },
                      { key: 'gmv', label: 'GMV (30d)' },
                      { key: null, label: 'Store' },
                      { key: 'status', label: 'Status' },
                      { key: null, label: '' }
                    ].map(h => (
                      <th key={h.label} 
                          onClick={() => h.key && setSort(h.key as SortKey)}
                          style={{ textAlign: 'left', padding: '10px 14px', color: SILVER, fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', cursor: h.key ? 'pointer' : 'default', userSelect: 'none' }}>
                        {h.label} {sortKey === h.key && (sortAsc ? '↑' : '↓')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredAgents.map(a => (
                    <tr key={a.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: a.isActive ? 1 : 0.55 }}>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {a.fullName || a.username}
                          <button onClick={() => impersonate(a.id)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#FFF', fontSize: '0.65rem', padding: '2px 6px', borderRadius: 4, cursor: 'pointer' }} title="View As this Agent">View As</button>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: SILVER }}>@{a.username}</div>
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontSize: '0.66rem', padding: '2px 8px', borderRadius: 999, border: `1px solid ${a.isSuperAgent ? TEAL : 'rgba(168,180,192,0.3)'}`, color: a.isSuperAgent ? TEAL : SILVER, fontWeight: 700 }}>
                          {a.isSuperAgent ? 'Super Agent' : 'Agent'}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', color: SILVER }}>
                        <select 
                          value={a.tier || ''} 
                          onChange={(e) => updateAgent(a, { tier: e.target.value })}
                          disabled={busy[a.id]}
                          style={{ background: 'transparent', color: SILVER, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '2px', fontSize: '0.75rem' }}
                        >
                          <option value="tier_1">Tier 1</option>
                          <option value="tier_2">Tier 2</option>
                          <option value="tier_3">Tier 3</option>
                          <option value="tier_4">Tier 4</option>
                        </select>
                      </td>
                      <td style={{ padding: '11px 14px', color: TEAL, fontWeight: 700 }}>
                        <input 
                          type="number" 
                          value={a.commissionPct ?? ''} 
                          onChange={(e) => {
                             const val = e.target.value ? Number(e.target.value) : null;
                             updateAgent(a, { commission_pct: val });
                          }}
                          disabled={busy[a.id]}
                          style={{ width: 50, background: 'transparent', color: TEAL, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '2px 4px', fontSize: '0.75rem', fontWeight: 700 }}
                        /> %
                      </td>
                      <td style={{ padding: '11px 14px', fontWeight: 700, fontFamily: 'ui-monospace, monospace' }}>{money(Number(a.gmv30d) || 0)}</td>
                      <td style={{ padding: '11px 14px' }}>
                        {a.slug ? <a href={`/${a.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: TEAL, fontSize: '0.75rem', textDecoration: 'none' }}>/{a.slug}</a> : '—'}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontSize: '0.66rem', padding: '2px 8px', borderRadius: 999, background: a.isActive ? 'rgba(192,184,168,0.12)' : 'rgba(168,180,192,0.1)', color: a.isActive ? TEAL : SILVER, fontWeight: 700 }}>
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
                            style={{ ...btnGhost, opacity: busy[a.id] ? 0.5 : 1, color: a.isActive ? '#F87171' : TEAL, borderColor: a.isActive ? 'rgba(248,113,113,0.4)' : 'rgba(192,184,168,0.4)' }}>
                            {a.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredAgents.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ padding: 20, textAlign: 'center', color: SILVER }}>No agents match your search.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recruit */}
        <div style={{ ...card, display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flexShrink: 0, width: 132, height: 132, borderRadius: 12, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {initialQr ? <img src={initialQr} alt="Referral QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ color: '#0F1923', fontSize: '0.75rem' }}>QR…</span>}
          </div>
          <div style={{ minWidth: 200, flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Recruit Agents</h2>
            <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: SILVER, lineHeight: 1.5 }}>
              Share your referral QR or link so new agents join directly under your network. Manage everyone from the Agents tool above.
            </p>
          </div>
        </div>

      </div>

      <style>{`.cc-tool:hover{transform:translateY(-2px);border-color:rgba(192,184,168,0.5)!important;background:#12202c!important;}`}</style>
    </div>
  );
}
