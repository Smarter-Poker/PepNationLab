'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Sub {
  id: string;
  researcher_id: string;
  status: 'active' | 'paused' | 'cancelled';
  cadence_days: number;
  next_run_at: string;
  last_run_at: string | null;
  items_snapshot: Array<{ quantity: number; unit_retail_price: number | string; product_name?: string }> | null;
  failure_count: number;
  last_failure_reason: string | null;
}

interface ResearcherProfile {
  id: string;
  full_name: string | null;
  email: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: '#68D391',
  paused: '#F6AD55',
  cancelled: 'var(--grey-400)',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  paused: 'Paused',
  cancelled: 'Cancelled',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '—';
  }
}

export default function AgentSubscriptions({ agentId }: { agentId: string }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [researchers, setResearchers] = useState<Record<string, ResearcherProfile>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('subscriptions')
        .select('id, researcher_id, status, cadence_days, next_run_at, last_run_at, items_snapshot, failure_count, last_failure_reason')
        .eq('agent_id', agentId)
        .order('next_run_at', { ascending: true });
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      const rows = (data ?? []) as Sub[];
      setSubs(rows);

      const ids = Array.from(new Set(rows.map((s) => s.researcher_id))).filter(Boolean);
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', ids);
        if (cancelled) return;
        const map: Record<string, ResearcherProfile> = {};
        for (const p of profs ?? []) {
          map[String(p.id)] = p as ResearcherProfile;
        }
        setResearchers(map);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [agentId, supabase]);

  if (loading) return <p style={{ color: 'var(--silver)' }}>Loading Subscriptions...</p>;
  if (error) return <p style={{ color: 'var(--red)' }}>Error: {error}</p>;

  if (subs.length === 0) {
    return (
      <div className="card-metal" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
        <h3 style={{ color: 'var(--silver)', marginBottom: 'var(--space-2)' }}>No Active Subscriptions</h3>
        <p style={{ color: 'var(--grey-400)', fontSize: '0.88rem' }}>
          Your Researchers Will See Auto-Replenish Subscriptions Here Once They Subscribe From An Order Detail Page.
        </p>
      </div>
    );
  }

  return (
    <div className="card-metal" style={{ padding: 'var(--space-5)' }}>
      <h2 style={{ color: 'var(--white)', fontSize: '1rem', marginBottom: 'var(--space-3)' }}>
        Downline Subscriptions
      </h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase', padding: 'var(--space-2)' }}>Researcher</th>
              <th style={{ textAlign: 'left', fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase', padding: 'var(--space-2)' }}>Items</th>
              <th style={{ textAlign: 'left', fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase', padding: 'var(--space-2)' }}>Cadence</th>
              <th style={{ textAlign: 'left', fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase', padding: 'var(--space-2)' }}>Next Run</th>
              <th style={{ textAlign: 'left', fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase', padding: 'var(--space-2)' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((s) => {
              const color = STATUS_COLORS[s.status] ?? 'var(--grey-400)';
              const r = researchers[s.researcher_id];
              const items = Array.isArray(s.items_snapshot) ? s.items_snapshot : [];
              const total = items.reduce(
                (sum, it) => sum + Number(it.unit_retail_price ?? 0) * Number(it.quantity ?? 0),
                0
              );
              return (
                <tr key={s.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: 'var(--space-2)', fontSize: '0.85rem', color: 'var(--silver)' }}>
                    {r?.full_name || r?.email || s.researcher_id.slice(0, 8)}
                  </td>
                  <td style={{ padding: 'var(--space-2)', fontSize: '0.85rem', color: 'var(--silver)' }}>
                    {items.length} · ${total.toFixed(2)}
                  </td>
                  <td style={{ padding: 'var(--space-2)', fontSize: '0.85rem', color: 'var(--silver)' }}>Every {s.cadence_days} Days</td>
                  <td style={{ padding: 'var(--space-2)', fontSize: '0.85rem', color: 'var(--silver)' }}>{formatDate(s.next_run_at)}</td>
                  <td style={{ padding: 'var(--space-2)' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color, background: `${color}18`, border: `1px solid ${color}40`, padding: '2px var(--space-2)', borderRadius: 'var(--radius-full)' }}>
                      {STATUS_LABELS[s.status] ?? s.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
