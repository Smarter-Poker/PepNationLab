import type { Metadata } from 'next';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * /admin/attention - Order Attention Board.
 *
 * Every order still awaiting action (pending customer payment, agent
 * approval, admin approval), oldest first, with its age, escalation level,
 * and reminder history. This is the operational companion to the
 * order-attention escalation cron: the cron pushes alerts at 24h/48h/72h,
 * and this board is where an admin lands to work the backlog.
 *
 * Auth: the /admin layout gates every page in this segment to admins.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Order Attention Board | Pep Nation Lab',
};

const STATUS_LABELS: Record<string, string> = {
  pending_customer_payment: 'Awaiting Customer Payment',
  agent_approval_pending: 'Awaiting Agent Approval',
  admin_approval_pending: 'Awaiting Admin Release',
};

const LEVEL_META: Record<number, { label: string; color: string }> = {
  0: { label: 'On Time', color: 'var(--grey-400)' },
  1: { label: 'Level 1 - Agent Alerted', color: '#F6AD55' },
  2: { label: 'Level 2 - Admins Alerted', color: '#FC8181' },
  3: { label: 'Level 3 - Escalated', color: '#E53E3E' },
};

interface AttentionRow {
  id: string;
  status: string;
  total: number | string | null;
  buyer_name: string | null;
  created_at: string;
  stale_escalation_level: number | null;
  payment_reminder_count: number | null;
  agent_id: string | null;
  profiles: { full_name: string | null } | { full_name: string | null }[] | null;
}

function agentName(row: AttentionRow): string {
  const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return p?.full_name || 'House Store';
}

export default async function OrderAttentionPage() {
  const service = await createServiceClient();
  const { requireAdmin } = await import('@/lib/admin-auth');
  const adminAuth = await requireAdmin();
  const currentAdminId = adminAuth.ok ? adminAuth.userId : null;

  const { data } = await service
    .from('orders')
    .select('id, status, total, buyer_name, created_at, stale_escalation_level, payment_reminder_count, agent_id, profiles!orders_agent_id_fkey(full_name)')
    .in('status', ['pending_customer_payment', 'agent_approval_pending', 'admin_approval_pending'])
    .order('created_at', { ascending: true })
    .limit(500);

  let rows = (data ?? []) as unknown as AttentionRow[];
  
  // Filter out pending downline agent orders so admins don't have to approve them
  rows = rows.filter(r => {
    if (r.status === 'pending_customer_payment' || r.status === 'agent_approval_pending') {
      if (r.agent_id && r.agent_id !== currentAdminId) return false;
    }
    return true;
  });

  const now = Date.now();
  const ageHours = (iso: string) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 3600_000));
  const money = (v: number | string | null) => `$${(Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const over24 = rows.filter((r) => ageHours(r.created_at) >= 24).length;
  const escalated = rows.filter((r) => (Number(r.stale_escalation_level) || 0) >= 2).length;

  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <h1 style={{ fontSize: '1.4rem', marginBottom: 'var(--space-2)' }}>Order Attention Board</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', maxWidth: 640, lineHeight: 1.6 }}>
          Every Order Still Waiting On Someone, Oldest First. Orders Are Never Cancelled Automatically -
          The Escalation Engine Alerts The Agent At 24 Hours, Their Upline And Admins At 48 Hours, And
          Escalates Hard At 72 Hours. This Board Is Where That Backlog Gets Worked.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-5)' }}>
        <div className="card" style={{ padding: 'var(--space-4)', minWidth: 160 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase' }}>Awaiting Action</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--teal)' }}>{rows.length}</div>
        </div>
        <div className="card" style={{ padding: 'var(--space-4)', minWidth: 160 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase' }}>Waiting Over 24h</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: over24 > 0 ? '#F6AD55' : 'var(--silver)' }}>{over24}</div>
        </div>
        <div className="card" style={{ padding: 'var(--space-4)', minWidth: 160 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase' }}>Escalated To Admins</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: escalated > 0 ? '#E53E3E' : 'var(--silver)' }}>{escalated}</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
          <p style={{ fontSize: '0.95rem', color: 'var(--silver)', marginBottom: 'var(--space-2)' }}>Nothing Needs Attention</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--grey-500)' }}>Every Order Is Either Approved, In Fulfillment, Shipped, Or Delivered.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {rows.map((r) => {
            const hrs = ageHours(r.created_at);
            const level = Math.min(3, Math.max(0, Number(r.stale_escalation_level) || 0));
            const meta = LEVEL_META[level];
            const reminders = Number(r.payment_reminder_count) || 0;
            return (
              <Link
                key={r.id}
                href={`/admin/orders?highlight=${r.id}`}
                className="card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-4)',
                  textDecoration: 'none',
                  borderLeft: `3px solid ${meta.color}`,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--white)', fontFamily: 'var(--font-brand)' }}>
                      #{r.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--teal)' }}>{money(r.total)}</span>
                    <span style={{ fontSize: '0.72rem', color: meta.color, fontWeight: 700, border: `1px solid ${meta.color}55`, background: `${meta.color}12`, padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                      {meta.label}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginTop: 4 }}>
                    {STATUS_LABELS[r.status] ?? r.status} / Store: {agentName(r)} / Buyer: {r.buyer_name || 'Researcher'}
                    {reminders > 0 ? ` / ${reminders} Payment Reminder${reminders === 1 ? '' : 's'} Sent` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: hrs >= 48 ? '#E53E3E' : hrs >= 24 ? '#F6AD55' : 'var(--silver)' }}>
                    {hrs}h
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--grey-500)' }}>
                    Placed {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
