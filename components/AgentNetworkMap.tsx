'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import AgentAccountDetail from '@/components/AgentAccountDetail';

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface NetNode {
  id: string;
  full_name: string | null;
  username: string | null;
  slug: string | null;
  commission_pct: number;
  is_active: boolean;
  revenue: number;
  order_count: number;
  pending_commission: number;
  agent_count: number;
  researcher_count: number;
}

interface NetTotals {
  sub_agents: number;
  active_sub_agents: number;
  downline_revenue: number;
  downline_orders: number;
  pending_commission: number;
}

interface NetData {
  root: { id: string; full_name: string | null; username: string | null };
  nodes: NetNode[];
  totals: NetTotals;
}

function money(n: number): string {
  return `$${(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-panel" style={{ padding: 'var(--space-4)', flex: '1 1 150px', minWidth: 150 }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--white)', fontFamily: 'var(--font-brand)' }}>{value}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Sub-Agent Network Map
   ══════════════════════════════════════════════════════════════════════════ */
export default function AgentNetworkMap() {
  const [data, setData] = useState<NetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/agent/sub-agents/network', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed');
      setData(await res.json());
    } catch {
      setError(true);
      toast.error('Could Not Load Network Map');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--grey-400)', fontSize: '0.85rem', marginBottom: 'var(--space-6)' }}>
        Loading Network Map...
      </div>
    );
  }

  if (error || !data) return null;

  const rootName = data.root.full_name || (data.root.username ? `@${data.root.username}` : 'You');
  const topRevenue = data.nodes.length > 0 ? data.nodes[0].revenue : 0;

  return (
    <div className="glass-panel hover-lift" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-5)' }}>
        <h3 style={{ fontSize: '1.1rem', color: 'var(--white)', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
          Network Map
        </h3>
        <p style={{ color: 'var(--grey-400)', fontSize: '0.82rem', margin: 0 }}>
          Your Downline At A Glance - Revenue And Commission Per Sub-Agent
        </p>
      </div>

      {/* Totals */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <Kpi label="Sub-Agents" value={String(data.totals.sub_agents)} />
        <Kpi label="Active" value={String(data.totals.active_sub_agents)} />
        <Kpi label="Downline Revenue" value={money(data.totals.downline_revenue)} />
        <Kpi label="Downline Orders" value={String(data.totals.downline_orders)} />
        <Kpi label="Pending Commission" value={money(data.totals.pending_commission)} />
      </div>

      {data.nodes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8) 0', opacity: 0.6 }}>
          <h4 style={{ color: 'var(--silver)' }}>No Sub-Agents Yet</h4>
          <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', margin: 0 }}>
            Promote A Researcher To Sub-Agent To Start Building Your Downline.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Root node */}
          <div style={{
            background: 'linear-gradient(180deg, rgba(0,196,188,0.15), rgba(0,196,188,0.05))',
            border: '2px solid var(--teal)',
            borderRadius: 12,
            padding: '14px 28px',
            textAlign: 'center',
            boxShadow: '0 0 24px rgba(0,196,188,0.25)',
            minWidth: 200,
          }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Super Agent</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--white)', fontFamily: 'var(--font-brand)' }}>{rootName}</div>
          </div>

          {/* Vertical connector */}
          <div style={{ width: 2, height: 28, background: 'linear-gradient(var(--teal), rgba(192,184,168,0.25))' }} />

          {/* Horizontal bus + children */}
          <div style={{ width: '100%', height: 2, background: 'rgba(192,184,168,0.25)', maxWidth: 900 }} />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 'var(--space-4)',
            width: '100%',
            marginTop: 'var(--space-4)',
          }}>
            {data.nodes.map((n) => {
              const isTop = topRevenue > 0 && n.revenue === topRevenue;
              return (
                <div key={n.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {/* Stub connector up to the bus */}
                  <div style={{ width: 2, height: 16, background: 'rgba(192,184,168,0.25)', marginBottom: -1 }} />
                  <div
                    role="button"
                    tabIndex={0}
                    title={`Open ${n.full_name || 'agent'}'s account`}
                    onClick={() => setSelectedAgent({ id: n.id, name: n.full_name || n.username || 'Agent' })}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedAgent({ id: n.id, name: n.full_name || n.username || 'Agent' }); } }}
                    style={{
                    width: '100%',
                    background: 'var(--surface-2, #162230)',
                    border: isTop ? '1.5px solid var(--teal)' : '1px solid rgba(192,184,168,0.15)',
                    borderRadius: 12,
                    padding: 'var(--space-4)',
                    boxShadow: isTop ? '0 0 18px rgba(0,196,188,0.2)' : 'none',
                    position: 'relative',
                    cursor: 'pointer',
                  }}>
                    {isTop && (
                      <div style={{
                        position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                        background: 'var(--teal)', color: '#04221f', fontSize: '0.6rem', fontWeight: 800,
                        padding: '2px 8px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.05em',
                        whiteSpace: 'nowrap',
                      }}>
                        Top Performer
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: 'var(--white)', fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {n.full_name || 'Sub-Agent'}
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--teal)' }}>
                          @{n.username ?? n.slug ?? 'sub-agent'}
                        </div>
                      </div>
                      <span style={{
                        flexShrink: 0,
                        fontSize: '0.6rem', fontWeight: 800, padding: '2px 7px', borderRadius: 99,
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                        background: n.is_active ? 'rgba(0,196,188,0.15)' : 'rgba(229,62,62,0.15)',
                        color: n.is_active ? 'var(--teal)' : 'var(--red)',
                      }}>
                        {n.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--white)', fontFamily: 'var(--font-brand)' }}>
                      {money(n.revenue)}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                      Downline Revenue
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--silver-light)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                      <span>{n.order_count} Orders</span>
                      <span>{n.commission_pct}% Markup</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--silver-light)', marginTop: 4 }}>
                      <span style={{ color: 'var(--grey-400)' }}>Downline</span>
                      <span style={{ color: 'var(--silver-light)' }}>
                        {n.agent_count} Agent{n.agent_count === 1 ? '' : 's'} &middot; {n.researcher_count} Researcher{n.researcher_count === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--silver-light)', marginTop: 4 }}>
                      <span style={{ color: 'var(--grey-400)' }}>Pending</span>
                      <span style={{ color: n.pending_commission > 0 ? 'var(--teal)' : 'var(--silver-light)', fontWeight: 600 }}>
                        {money(n.pending_commission)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedAgent && (
        <AgentAccountDetail
          agentId={selectedAgent.id}
          agentName={selectedAgent.name}
          onClose={() => setSelectedAgent(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
