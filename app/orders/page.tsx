import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PageShell from '@/components/PageShell';
import ReorderButton, { ViewLink } from './OrdersListClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'My Orders | Pep Nation Lab',
  description: 'View your research compound order history and fulfillment status.',
};

const STATUS_LABELS: Record<string, string> = {
  pending_customer_payment: 'Pending Payment',
  agent_approval_pending: 'Agent Approval Pending',
  approved_ship: 'Approved For Shipping',
  approved_pickup: 'Approved For Pickup',
  in_fulfillment: 'In Fulfillment',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  pending_customer_payment: 'var(--red)',
  agent_approval_pending: '#00E5FF',
  approved_ship: '#00E5FF',
  approved_pickup: '#00E5FF',
  in_fulfillment: 'var(--teal)',
  shipped: 'var(--teal)',
  delivered: '#68D391',
  cancelled: 'var(--grey-400)',
};

const PAYMENT_LABELS: Record<string, string> = {
  zelle: 'Zelle',
  cashapp: 'Cash App',
  venmo: 'Venmo',
  apple_pay: 'Apple Pay',
};

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_retail_price: number;
}

interface Order {
  id: string;
  status: string;
  created_at: string;
  payment_method: string;
  fulfillment_method: string | null;
  subtotal: number;
  discount_amount: number;
  coupon_code: string | null;
  shipping_cost: number;
  total: number;
  tracking_number: string | null;
  order_items: OrderItem[];
}

const ACTIVE_STATUSES = new Set([
  'pending_customer_payment',
  'agent_approval_pending',
  'approved_ship',
  'approved_pickup',
  'in_fulfillment',
  'shipped',
]);

const SORT_OPTIONS: { id: string; label: string }[] = [
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'total', label: 'Highest Total' },
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/orders');
  }

  const { sort: sortParam } = await searchParams;
  const sort = SORT_OPTIONS.some((o) => o.id === sortParam) ? sortParam! : 'newest';

  let query = supabase
    .from('orders')
    .select('id, status, created_at, payment_method, fulfillment_method, subtotal, discount_amount, coupon_code, shipping_cost, total, tracking_number, order_items(id, product_name, quantity, unit_retail_price)')
    .eq('buyer_id', user.id);

  if (sort === 'oldest') query = query.order('created_at', { ascending: true });
  else if (sort === 'total') query = query.order('total', { ascending: false });
  else query = query.order('created_at', { ascending: false });

  const { data: ordersData } = await query;

  const orders = (ordersData ?? []) as Order[];

  // Resolve the buyer's home storefront so the "Continue Shopping" CTA is a
  // live link (the legacy /products route now just redirects to /).
  let storefrontHref = '/dashboard';
  const { data: profile } = await supabase
    .from('profiles')
    .select('referring_agent_id')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.referring_agent_id) {
    const { data: agent } = await supabase
      .from('agent_profiles')
      .select('slug')
      .eq('id', profile.referring_agent_id)
      .maybeSingle();
    if (agent?.slug) storefrontHref = `/${agent.slug}`;
  }

  // Summary metrics across the buyer's lifetime.
  const activeCount = orders.filter((o) => ACTIVE_STATUSES.has(o.status)).length;
  const lifetimeSpend = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + Number(o.total || 0), 0);

  return (
    <PageShell>
      <section className="section">
        <div className="container-sm">
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
            <div>
              <h1 className="animated-gradient-text" style={{ fontSize: '1.8rem', marginBottom: 'var(--space-2)' }}>
                My <span style={{ color: 'var(--teal)' }}>Orders</span>
              </h1>
              <p style={{ fontSize: '0.9rem', color: 'var(--grey-400)' }}>
                Your Research Compound Order History And Fulfillment Status
              </p>
            </div>
            <Link href={storefrontHref} className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '8px 16px', whiteSpace: 'nowrap' }}>
              Continue Shopping
            </Link>
          </div>

          {orders.length === 0 ? (
            <div className="card-metal hover-lift stagger-fade-in" style={{ padding: 'var(--space-12)', textAlign: 'center', animationDelay: '0.1s' }}>
              <svg
                width="44"
                height="44"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--teal)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginBottom: 'var(--space-4)' }}
                aria-hidden="true"
              >
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              <h2 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-2)' }}>No Orders Yet</h2>
              <p style={{ fontSize: '0.88rem', color: 'var(--grey-400)', marginBottom: 'var(--space-6)' }}>
                You Have Not Placed Any Research Orders. Browse Your Storefront To Get Started.
              </p>
              <Link href={storefrontHref} className="btn btn-primary">
                Browse Research Catalog
              </Link>
            </div>
          ) : (
            <>
              {/* Summary strip */}
              <div className="stagger-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-6)', animationDelay: '0.05s' }}>
                {[
                  { label: 'Total Orders', value: String(orders.length) },
                  { label: 'In Progress', value: String(activeCount) },
                  { label: 'Lifetime Spend', value: `$${lifetimeSpend.toFixed(2)}` },
                ].map((stat) => (
                  <div key={stat.label} className="card-glass" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-brand)', color: 'var(--teal)', lineHeight: 1 }}>{stat.value}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--grey-400)', marginTop: 'var(--space-2)' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Sort control */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--grey-500)' }}>Sort By</span>
                {SORT_OPTIONS.map((opt) => {
                  const active = opt.id === sort;
                  return (
                    <Link
                      key={opt.id}
                      href={opt.id === 'newest' ? '/orders' : `/orders?sort=${opt.id}`}
                      aria-current={active ? 'true' : undefined}
                      style={{
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        padding: '5px 12px',
                        borderRadius: 'var(--radius-full)',
                        textDecoration: 'none',
                        color: active ? '#0A1018' : 'var(--grey-300)',
                        background: active ? 'linear-gradient(180deg, #DCD3C3 0%, #B3A992 100%)' : 'var(--surface-1)',
                        border: active ? '1px solid transparent' : '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      {opt.label}
                    </Link>
                  );
                })}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              {orders.map((order, index) => {
                const statusColor = STATUS_COLORS[order.status] ?? 'var(--grey-400)';
                return (
                  <div
                    key={order.id}
                    className="card-metal hover-lift stagger-fade-in"
                    style={{ padding: 'var(--space-6)', animationDelay: `${0.1 + index * 0.1}s` }}
                  >
                    {/* Order header */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        flexWrap: 'wrap',
                        gap: 'var(--space-3)',
                        marginBottom: 'var(--space-4)',
                        paddingBottom: 'var(--space-4)',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--grey-500)', fontFamily: 'var(--font-brand)' }}>
                          Order #{order.id.slice(0, 8).toUpperCase()}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--grey-400)', marginTop: 4 }}>
                          Placed {new Date(order.created_at).toLocaleDateString()} {' / '}
                          {PAYMENT_LABELS[order.payment_method] ?? order.payment_method}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: statusColor,
                          background: `${statusColor}15`,
                          border: `1px solid ${statusColor}40`,
                          padding: '4px var(--space-3)',
                          borderRadius: 'var(--radius-full)',
                        }}
                      >
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </div>

                    {/* Line items */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                      {order.order_items.map((item) => (
                        <div
                          key={item.id}
                          style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}
                        >
                          <span style={{ color: 'var(--silver)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            {item.product_name}{' '}
                            <span style={{ color: 'var(--teal)' }}>x{item.quantity}</span>
                          </span>
                          <span style={{ color: 'var(--grey-300)' }}>
                            ${(Number(item.unit_retail_price) * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Totals */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--grey-400)' }}>
                        <span>Subtotal</span>
                        <span>${Number(order.subtotal).toFixed(2)}</span>
                      </div>
                      {Number(order.discount_amount) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#68D391' }}>
                          <span>Coupon Discount{order.coupon_code ? ` (${order.coupon_code})` : ''}</span>
                          <span>-${Number(order.discount_amount).toFixed(2)}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--grey-400)' }}>
                        <span>Shipping</span>
                        <span>${Number(order.shipping_cost).toFixed(2)}</span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.95rem',
                          fontWeight: 700,
                          color: 'var(--teal)',
                          marginTop: 4,
                          paddingTop: 'var(--space-2)',
                          borderTop: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <span>Total</span>
                        <span style={{ fontFamily: 'var(--font-brand)' }}>${Number(order.total).toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Tracking */}
                    {order.tracking_number && (
                      <div
                        style={{
                          marginTop: 'var(--space-4)',
                          padding: 'var(--space-3)',
                          background: 'var(--surface-1)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.78rem',
                          color: 'var(--grey-400)',
                          wordBreak: 'break-all',
                        }}
                      >
                        Tracking Number:{' '}
                        <span style={{ color: 'var(--silver)', fontWeight: 600 }}>{order.tracking_number}</span>
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{
                      marginTop: 'var(--space-4)',
                      paddingTop: 'var(--space-4)',
                      borderTop: '1px solid rgba(255,255,255,0.06)',
                      display: 'flex',
                      gap: 'var(--space-2)',
                      justifyContent: 'flex-end',
                      flexWrap: 'wrap',
                    }}>
                      <ReorderButton orderId={order.id} />
                      <ViewLink href={`/orders/${order.id}`} />
                    </div>
                  </div>
                );
              })}
              </div>
            </>
          )}
        </div>
      </section>
    </PageShell>
  );
}
