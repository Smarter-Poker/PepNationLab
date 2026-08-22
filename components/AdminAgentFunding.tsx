'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Wallet, RefreshCw, Download, AlertTriangle, ShieldCheck } from 'lucide-react';

interface FundingRow {
  agent_id: string;
  name: string;
  email: string;
  role: string;
  funded_referrals: number;
  funded_promos: number;
  funded_credits: number;
  funded_subagent_commission: number;
  funded_other: number;
  total_funded: number;
  credit_used: number;
  prepaid_balance: number;
  credit_limit: number;
  headroom: number;
  last_funded_at: string | null;
}

interface Totals {
  total_funded: number;
  funded_referrals: number;
  funded_promos: number;
  funded_credits: number;
  funded_subagent_commission: number;
  credit_used: number;
}

const WINDOWS: { label: string; value: number | 'all' }[] = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
  { label: '1y', value: 365 },
  { label: 'All', value: 'all' },
];

function money(n: number) {
  return '$' + (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toCsv(rows: FundingRow[]): string {
  const head = ['Agent', 'Email', 'Role', 'Referrals', 'Signup Promos', 'Agent Credits', 'Sub-Agent Commission', 'Other', 'Total Funded', 'Credit Used (Debt)', 'Prepaid Balance', 'Credit Limit', 'Headroom'];
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [head.join(',')];
  for (const r of rows) {
    lines.push([
      r.name || r.email, r.email, r.role,
      r.funded_referrals, r.funded_promos, r.funded_credits, r.funded_subagent_commission, r.funded_other,
      r.total_funded, r.credit_used, r.prepaid_balance, r.credit_limit, r.headroom,
    ].map(esc).join(','));
  }
  return lines.join('\n');
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'debt' | 'ok' }) {
  const color = tone === 'debt' ? '#ff6b6b' : tone === 'ok' ? '#2ed573' : 'var(--white)';
  return (
    <div style={{ flex: '1 1 150px', minWidth: 150, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ color: 'var(--grey-500, #8a8f98)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ color, fontSize: '1.3rem', fontWeight: 800 }}>{value}</div>
    </div>
  );
}

export default function AdminAgentFunding() {
  const [rows, setRows] = useState<FundingRow[] | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [days, setDays] = useState<number | 'all'>(90);
  const [err, setErr] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true); setErr(false);
    try {
      const res = await fetch(`/api/admin/agent-funding?days=${days}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setRows(Array.isArray(json.rows) ? json.rows : []);
      setTotals(json.totals || null);
    } catch {
      setErr(true); setRows([]);
    } finally {
      setRefreshing(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const inDebt = useMemo(() => (rows || []).filter((r) => Number(r.credit_used) > 0).length, [rows]);

  const exportCsv = useCallback(() => {
    if (!rows || !rows.length) return;
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-funding-${days === 'all' ? 'all' : days + 'd'}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [rows, days]);

  return (
    <section style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Wallet size={26} strokeWidth={1.5} />
          <h1 className="metal-text" style={{ margin: 0, fontFamily: 'var(--font-brand)', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '1.5rem', color: 'var(--white)' }}>
            Agent Funding &amp; Debt
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={exportCsv} disabled={!rows || !rows.length} className="btn-silver"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: '0.8rem', opacity: rows && rows.length ? 1 : 0.5 }}>
            <Download size={14} /> Export CSV
          </button>
          <button type="button" onClick={load} disabled={refreshing} className="btn-silver"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: '0.8rem', opacity: refreshing ? 0.6 : 1 }}>
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : undefined }} /> Refresh
          </button>
        </div>
      </div>
      <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', margin: '0 0 16px' }}>
        Every promo, coupon, referral bonus and sub-agent commission is funded by the responsible agent or super-agent — never the house. This is what each has funded, and what they currently owe on their credit line.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--grey-500, #8a8f98)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Period</span>
        {WINDOWS.map((w) => {
          const active = days === w.value;
          return (
            <button key={w.label} type="button" onClick={() => setDays(w.value)}
              style={{
                padding: '4px 11px', borderRadius: 8, fontSize: '0.76rem', cursor: 'pointer',
                border: `1px solid ${active ? 'var(--silver, #c9ccd1)' : 'rgba(255,255,255,0.12)'}`,
                background: active ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.03)',
                color: active ? 'var(--white)' : 'var(--grey-400)', fontWeight: active ? 700 : 500,
              }}>
              {w.label}
            </button>
          );
        })}
      </div>

      {totals && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
          <Tile label="Total Funded" value={money(totals.total_funded)} />
          <Tile label="Referral Bonuses" value={money(totals.funded_referrals)} />
          <Tile label="Signup Promos" value={money(totals.funded_promos)} />
          <Tile label="Agent Credits" value={money(totals.funded_credits)} />
          <Tile label="Sub-Agent Commission" value={money(totals.funded_subagent_commission)} />
          <Tile label="Total Credit-Line Debt" value={money(totals.credit_used)} tone={totals.credit_used > 0 ? 'debt' : 'ok'} />
        </div>
      )}

      {rows === null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ height: 52, borderRadius: 10, background: 'linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.07), rgba(255,255,255,0.04))', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
          ))}
        </div>
      ) : err ? (
        <div className="glass-panel" style={{ padding: 28, textAlign: 'center', borderRadius: 14, color: 'var(--grey-400)' }}>
          Could not load the funding summary. <button type="button" onClick={load} className="btn-silver" style={{ marginLeft: 8, padding: '4px 12px' }}>Try again</button>
        </div>
      ) : rows.length === 0 ? (
        <div className="glass-panel" style={{ padding: 40, textAlign: 'center', borderRadius: 14 }}>
          <ShieldCheck size={54} strokeWidth={1} style={{ color: '#2ed573', marginBottom: 12 }} />
          <h3 style={{ color: 'var(--white)', margin: '0 0 6px' }}>No agent-funded payouts in this period</h3>
          <p style={{ color: 'var(--grey-500, #8a8f98)', fontSize: '0.88rem', maxWidth: 440, margin: '0 auto' }}>
            When agents fund referral bonuses, signup promos, credits or sub-agent commissions, each agent&apos;s totals and credit-line debt will appear here. Nothing is funded by the house.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--grey-400)', textAlign: 'right' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 700 }}>Agent</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>Referrals</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>Promos</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>Credits</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>Sub-Comm.</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>Total Funded</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>Debt</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>Headroom</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const debt = Number(r.credit_used) || 0;
                return (
                  <tr key={r.agent_id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'right' }}>
                    <td style={{ textAlign: 'left', padding: '10px 12px' }}>
                      <div style={{ color: 'var(--white)', fontWeight: 600 }}>{r.name || r.email || 'Agent'}</div>
                      <div style={{ color: 'var(--grey-500, #8a8f98)', fontSize: '0.72rem' }}>
                        {r.role === 'super_agent' ? 'Super-agent' : 'Agent'}{r.email ? ` · ${r.email}` : ''}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--grey-300, #c9ccd1)' }}>{money(r.funded_referrals)}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--grey-300, #c9ccd1)' }}>{money(r.funded_promos)}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--grey-300, #c9ccd1)' }}>{money(r.funded_credits)}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--grey-300, #c9ccd1)' }}>{money(r.funded_subagent_commission)}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--white)', fontWeight: 800 }}>{money(r.total_funded)}</td>
                    <td style={{ padding: '10px 12px', color: debt > 0 ? '#ff6b6b' : 'var(--grey-500, #8a8f98)', fontWeight: debt > 0 ? 800 : 500 }}>
                      {debt > 0 && <AlertTriangle size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />}{money(debt)}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--grey-400)' }}>{money(r.headroom)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows && rows.length > 0 && (
        <p style={{ color: 'var(--grey-500, #8a8f98)', fontSize: '0.76rem', marginTop: 12 }}>
          {rows.length} agent{rows.length === 1 ? '' : 's'} with funding activity or debt · {inDebt} currently carrying credit-line debt.
        </p>
      )}

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
    </section>
  );
}
