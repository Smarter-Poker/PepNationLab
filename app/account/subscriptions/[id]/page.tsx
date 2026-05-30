import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Subscription Detail | Pep Nation Lab',
  robots: { index: false, follow: false },
};

const STATUS_COLORS: Record<string, string> = {
  active: '#68D391',
  paused: '#F6AD55',
  cancelled: 'var(--grey-400)',
  succeeded: '#68D391',
  failed: 'var(--red)',
  skipped: 'var(--grey-400)',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  paused: 'Paused',
  cancelled: 'Cancelled',
  succeeded: 'Succeeded',
  failed: 'Failed',
  skipped: 'Skipped',
};

const PAYMENT_LABELS: Record<string, string> = {
  zelle: 'Zelle',
  cashapp: 'Cash App',
  venmo: 'Venmo',
  apple_pay: 'Apple Pay',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '—';
  }
}

interface SnapshotItem {
  agent_product_id: string;
  product_name: string;
  quantity: number;
  unit_retail_price: number | string;
}

export default async function SubscriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/account/subscriptions/${id}`);

  const { data: sub, error } = await supabase
    .from('subscriptions')
    .select('id, researcher_id, agent_id, status, cadence_days, payment_method, fulfillment_method, shipping_address, items_snapshot, next_run_at, last_run_at, last_order_id, failure_count, last_failure_reason, paused_at, cancelled_at, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();

  if (error || !sub) notFound();
  if (sub.researcher_id !== user.id) notFound();

  const { data: runs } = await supabase
    .from('subscription_runs')
    .select('id, run_at, status, order_id, failure_reason, notes')
    .eq('subscription_id', id)
    .order('run_at', { ascending: false })
    .limit(50);

  // Agent display name decoration.
  let agentName = 'Unknown';
  let agentSlug: string | null = null;
  if (sub.agent_id) {
    const service = await createServiceClient();
    const { data: agent } = await service
      .from('agent_profiles')
      .select('display_name, slug')
      .eq('id', sub.agent_id)
      .maybeSingle();
    if (agent) {
      agentName = agent.display_name ?? agentName;
      agentSlug = agent.slug ?? null;
    }
  }

  const items: SnapshotItem[] = Array.isArray(sub.items_snapshot) ? sub.items_snapshot as SnapshotItem[] : [];
  // unit_retail_price in the snapshot is stored as a per-10-vial-pack price
  // (ap.retail_price from the catalog). Divide by 10 for per-vial display,
  // matching the per-vial price the cron uses when creating order_items.
  const total = items.reduce((sum, it) => sum + (Number(it.unit_retail_price ?? 0) / 10) * Number(it.quantity ?? 0), 0);
  const statusColor = STATUS_COLORS[sub.status] ?? 'var(--grey-400)';
  const addr = (sub.shipping_address ?? {}) as Record<string, string | undefined>;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--black)', padding: 'var(--space-6) var(--space-4)', paddingTop: 'calc(60px + var(--space-6))' }}>
      <div className="container" style={{ maxWidth: 880 }}>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Link href="/account/subscriptions" style={{ fontSize: '0.85rem', color: 'var(--teal)', textDecoration: 'none' }}>
            Back To Subscriptions
          </Link>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', color: 'var(--white)', marginBottom: 'var(--space-2)' }}>
              Subscription <span style={{ color: 'var(--teal)', fontFamily: 'var(--font-brand)' }}>#{sub.id.slice(0, 8).toUpperCase()}</span>
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)' }}>
              Agent: <span style={{ color: 'var(--teal)' }}>{agentName}</span>
              {agentSlug ? ` · /${agentSlug}` : ''}
            </p>
          </div>
          <span style={{
            fontSize: '0.78rem',
            fontWeight: 700,
            color: statusColor,
            background: `${statusColor}18`,
            border: `1px solid ${statusColor}40`,
            padding: '6px var(--space-4)',
            borderRadius: 'var(--radius-full)',
          }}>
            {STATUS_LABELS[sub.status] ?? sub.status}
          </span>
        </div>

        <div className="card-metal" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: '0.95rem', color: 'var(--silver)', marginBottom: 'var(--space-3)' }}>Schedule</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--grey-500)', textTransform: 'uppercase', marginBottom: 2 }}>Cadence</div>
              <div style={{ fontSize: '0.88rem', color: 'var(--silver)' }}>Every {sub.cadence_days} Days</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--grey-500)', textTransform: 'uppercase', marginBottom: 2 }}>Next Run</div>
              <div style={{ fontSize: '0.88rem', color: 'var(--silver)' }}>{formatDate(sub.next_run_at)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--grey-500)', textTransform: 'uppercase', marginBottom: 2 }}>Last Run</div>
              <div style={{ fontSize: '0.88rem', color: 'var(--silver)' }}>{formatDate(sub.last_run_at)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--grey-500)', textTransform: 'uppercase', marginBottom: 2 }}>Payment</div>
              <div style={{ fontSize: '0.88rem', color: 'var(--silver)' }}>{PAYMENT_LABELS[sub.payment_method] ?? sub.payment_method}</div>
            </div>
          </div>
        </div>

        {sub.fulfillment_method === 'ship' && addr?.street && (
          <div className="card-metal" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
            <h2 style={{ fontSize: '0.95rem', color: 'var(--silver)', marginBottom: 'var(--space-3)' }}>Shipping Address</h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--silver)', lineHeight: 1.5 }}>
              {addr.fullName && <div>{addr.fullName}</div>}
              <div>{addr.street}</div>
              {addr.suite && <div>{addr.suite}</div>}
              <div>{addr.city}, {addr.state} {addr.zip}</div>
            </div>
          </div>
        )}

        <div className="card-metal" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: '0.95rem', color: 'var(--silver)', marginBottom: 'var(--space-3)' }}>Items</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {items.map((it, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <div style={{ fontSize: '0.88rem', color: 'var(--silver)', fontWeight: 600 }}>{it.product_name}</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--grey-400)' }}>
                    Quantity: <span style={{ color: 'var(--teal)' }}>{it.quantity}</span>
                    {' · '}Unit: ${(Number(it.unit_retail_price ?? 0) / 10).toFixed(2)}/vial
                  </div>
                </div>
                <div style={{ fontSize: '0.92rem', color: 'var(--silver)', fontWeight: 700, fontFamily: 'var(--font-brand)' }}>
                  ${((Number(it.unit_retail_price ?? 0) / 10) * Number(it.quantity ?? 0)).toFixed(2)}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: '0.88rem', color: 'var(--silver)' }}>Estimated Subtotal Per Run</span>
              <span style={{ fontSize: '0.92rem', color: 'var(--teal)', fontWeight: 700 }}>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="card-metal" style={{ padding: 'var(--space-5)' }}>
          <h2 style={{ fontSize: '0.95rem', color: 'var(--silver)', marginBottom: 'var(--space-3)' }}>Run History</h2>
          {!runs || runs.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)' }}>No Runs Yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase', padding: 'var(--space-2)' }}>Run At</th>
                    <th style={{ textAlign: 'left', fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase', padding: 'var(--space-2)' }}>Status</th>
                    <th style={{ textAlign: 'left', fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase', padding: 'var(--space-2)' }}>Order</th>
                    <th style={{ textAlign: 'left', fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase', padding: 'var(--space-2)' }}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => {
                    const rc = STATUS_COLORS[r.status] ?? 'var(--grey-400)';
                    return (
                      <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ fontSize: '0.82rem', color: 'var(--silver)', padding: 'var(--space-2)' }}>{formatDate(r.run_at)}</td>
                        <td style={{ padding: 'var(--space-2)' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: rc, background: `${rc}18`, border: `1px solid ${rc}40`, padding: '2px var(--space-2)', borderRadius: 'var(--radius-full)' }}>
                            {STATUS_LABELS[r.status] ?? r.status}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.82rem', padding: 'var(--space-2)' }}>
                          {r.order_id ? (
                            <Link href={`/orders/${r.order_id}`} style={{ color: 'var(--teal)', textDecoration: 'none', fontFamily: 'var(--font-brand)' }}>
                              #{String(r.order_id).slice(0, 8).toUpperCase()}
                            </Link>
                          ) : (
                            <span style={{ color: 'var(--grey-500)' }}>—</span>
                          )}
                        </td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--silver)', padding: 'var(--space-2)' }}>{r.failure_reason ?? r.notes ?? '—'}</td>
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
