import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Subscriptions | Admin | Pep Nation Lab',
  robots: { index: false, follow: false },
};

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

const STATUSES = ['active', 'paused', 'cancelled'] as const;

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '—';
  }
}

export default async function AdminSubscriptionsPage(
  { searchParams }: { searchParams: Promise<{ status?: string; agent_id?: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/admin/subscriptions');
  const service = await createServiceClient();
  const { data: me } = await service.from('profiles').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') redirect('/dashboard');

  const params = await searchParams;
  const status = params.status && (STATUSES as readonly string[]).includes(params.status) ? params.status : null;
  const agentFilter = params.agent_id ? String(params.agent_id) : null;

  let query = service
    .from('subscriptions')
    .select('id, researcher_id, agent_id, status, cadence_days, payment_method, next_run_at, last_run_at, items_snapshot, failure_count, last_failure_reason, created_at')
    .order('next_run_at', { ascending: true })
    .limit(200);

  if (status) query = query.eq('status', status);
  if (agentFilter) query = query.eq('agent_id', agentFilter);

  const { data: subs } = await query;
  const rows = subs ?? [];

  const allIds = new Set<string>();
  for (const r of rows) {
    if (r.researcher_id) allIds.add(r.researcher_id);
    if (r.agent_id) allIds.add(r.agent_id);
  }
  const idArr = Array.from(allIds);

  const profileMap: Record<string, { full_name: string | null; email: string }> = {};
  if (idArr.length > 0) {
    const { data: profs } = await service.from('profiles').select('id, full_name, email').in('id', idArr);
    for (const p of profs ?? []) {
      profileMap[String(p.id)] = { full_name: p.full_name ?? null, email: p.email };
    }
  }

  // Build the agent filter dropdown options.
  const { data: agents } = await service
    .from('profiles')
    .select('id, full_name, email')
    .in('role', ['agent', 'super_agent'])
    .eq('is_active', true)
    .order('full_name', { ascending: true })
    .limit(500);

  return (
    <div style={{ padding: 'var(--space-6) var(--space-4)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <h1 style={{ color: 'var(--white)', fontSize: '1.6rem', marginBottom: 'var(--space-2)' }}>
          Subscriptions
        </h1>
        <p style={{ color: 'var(--silver)', fontSize: '0.92rem', marginBottom: 'var(--space-5)' }}>
          All Auto-Replenish Subscriptions Across The Platform.
        </p>

        <form method="GET" style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
          <div>
            <label htmlFor="status-filter" style={{ fontSize: '0.78rem', color: 'var(--grey-400)', display: 'block', marginBottom: 4 }}>Status</label>
            <select
              id="status-filter"
              name="status"
              defaultValue={status ?? ''}
              style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--surface-2)', color: 'var(--white)', border: 'var(--border-subtle)', borderRadius: 'var(--radius-md)' }}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label htmlFor="agent-filter" style={{ fontSize: '0.78rem', color: 'var(--grey-400)', display: 'block', marginBottom: 4 }}>Agent</label>
            <select
              id="agent-filter"
              name="agent_id"
              defaultValue={agentFilter ?? ''}
              style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--surface-2)', color: 'var(--white)', border: 'var(--border-subtle)', borderRadius: 'var(--radius-md)', minWidth: 220 }}
            >
              <option value="">All Agents</option>
              {(agents ?? []).map((a) => (
                <option key={a.id} value={a.id}>{a.full_name || a.email}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-2)' }}>
            <button type="submit" className="btn btn-primary" style={{ fontSize: '0.85rem' }}>Filter</button>
            <Link href="/admin/subscriptions" className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>Reset</Link>
          </div>
        </form>

        <div className="card-metal" style={{ padding: 'var(--space-5)' }}>
          {rows.length === 0 ? (
            <p style={{ color: 'var(--silver)', textAlign: 'center', padding: 'var(--space-6)' }}>
              No Subscriptions Match The Filters.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase', padding: 'var(--space-2)' }}>Researcher</th>
                    <th style={{ textAlign: 'left', fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase', padding: 'var(--space-2)' }}>Agent</th>
                    <th style={{ textAlign: 'left', fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase', padding: 'var(--space-2)' }}>Items</th>
                    <th style={{ textAlign: 'left', fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase', padding: 'var(--space-2)' }}>Cadence</th>
                    <th style={{ textAlign: 'left', fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase', padding: 'var(--space-2)' }}>Next Run</th>
                    <th style={{ textAlign: 'left', fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase', padding: 'var(--space-2)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => {
                    const color = STATUS_COLORS[s.status] ?? 'var(--grey-400)';
                    const r = profileMap[String(s.researcher_id)];
                    const a = profileMap[String(s.agent_id)];
                    const items = Array.isArray(s.items_snapshot) ? s.items_snapshot as Array<{ quantity: number; unit_retail_price: number | string }> : [];
                    const total = items.reduce((sum, it) => sum + (Number(it.unit_retail_price ?? 0) / 10) * Number(it.quantity ?? 0), 0);
                    return (
                      <tr key={s.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: 'var(--space-2)', fontSize: '0.85rem', color: 'var(--silver)' }}>
                          {r?.full_name || r?.email || String(s.researcher_id).slice(0, 8)}
                        </td>
                        <td style={{ padding: 'var(--space-2)', fontSize: '0.85rem', color: 'var(--silver)' }}>
                          {a?.full_name || a?.email || String(s.agent_id).slice(0, 8)}
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
          )}
        </div>
      </div>
    </div>
  );
}
