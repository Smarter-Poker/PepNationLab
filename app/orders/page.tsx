import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PageShell from '@/components/PageShell';

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
  agent_approval_pending: '#F6AD55',
  approved_ship: '#F6AD55',
  approved_pickup: '#F6AD55',
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
  unit_cost_price: number;
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

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/orders');
  }

  const { data: ordersData } = await supabase
    .from('orders')
    .select('id, status, created_at, payment_method, fulfillment_method, subtotal, discount_amount, coupon_code, shipping_cost, total, tracking_number, order_items(id, product_name, quantity, unit_cost_price)')
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false });

  const orders = (ordersData ?? []) as Order[];

  return (
    <PageShell>
      <section className="section">
        <div className="container-sm">
          {/* Header */}
          <div style={{ marginBottom: 'var(--space-8)' }}>
            <h1 style={{ fontSize: '1.8rem', marginBottom: 'var(--space-2)' }}>
              My <span style={{ color: 'var(--teal)' }}>Orders</span>
            </h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--grey-400)' }}>
              Your Research Compound Order History And Fulfillment Status
            </p>
          </div>

          {orders.length === 0 ? (
            <div className="card-metal" style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
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
              >
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              <h2 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-2)' }}>No Orders Yet</h2>
              <p style={{ fontSize: '0.88rem', color: 'var(--grey-400)', marginBottom: 'var(--space-6)' }}>
                You Have Not Placed Any Research Orders. Browse The Catalog To Get Started.
              </p>
              <Link href="/products" className="btn btn-primary">
                Browse Research Catalog
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              {orders.map((order) => {
                const statusColor = STATUS_COLORS[order.status] ?? 'var(--grey-400)';
                return (
                  <div key={order.id} className="card-metal" style={{ padding: 'var(--space-6)' }}>
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
                          <span style={{ color: 'var(--silver)' }}>
                            {item.product_name}{' '}
                            <span style={{ color: 'var(--teal)' }}>x{item.quantity}</span>
                          </span>
                          <span style={{ color: 'var(--grey-300)' }}>
                            ${(Number(item.unit_cost_price) * item.quantity).toFixed(2)}
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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </PageShell>
  );
}
