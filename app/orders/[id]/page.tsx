import type { Metadata } from 'next';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PageShell from '@/components/PageShell';
import PaymentProofUpload from '@/components/PaymentProofUpload';
import ReceiptButton from './ReceiptButton';
import SubscribeReplenishButton from './SubscribeReplenishButton';
import RequestReturnButton from './RequestReturnButton';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Order Detail | Pep Nation Lab',
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
  agent_product_id: string | null;
  product_name: string;
  quantity: number;
  unit_retail_price: number | string;
  unit_cost_price: number | string;
}

interface Order {
  id: string;
  status: string;
  created_at: string;
  payment_method: string;
  fulfillment_method: string | null;
  subtotal: number | string;
  discount_amount: number | string | null;
  coupon_code: string | null;
  shipping_cost: number | string;
  total: number | string;
  tracking_number: string | null;
  label_url: string | null;
  shipping_address: any;
  agent_id: string | null;
  buyer_id: string;
  order_items: OrderItem[];
  profiles: { full_name: string | null; email: string } | null;
}

export default async function OrderDetailPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/orders/${id}`);
  }

  // RLS enforces buyer_id = auth.uid() for researchers; admins/agents may also pass.
  const { data: orderData, error } = await supabase
    .from('orders')
    .select(`
      id, status, created_at, payment_method, fulfillment_method,
      subtotal, discount_amount, coupon_code, shipping_cost, total,
      tracking_number, label_url, shipping_address, agent_id, buyer_id,
      order_items (id, agent_product_id, product_name, quantity, unit_retail_price, unit_cost_price),
      profiles:buyer_id (full_name, email)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error || !orderData) {
    notFound();
  }

  const order = orderData as unknown as Order;

  // Resolve seller payment handles if order has an agent
  let paymentHandles: Record<string, string> = {};
  let sellerName = 'Pep Nation Lab';
  if (order.agent_id) {
    const { data: agentProfile } = await supabase
      .from('agent_profiles')
      .select('display_name, payment_handles')
      .eq('id', order.agent_id)
      .maybeSingle();
    if (agentProfile) {
      sellerName = agentProfile.display_name || sellerName;
      paymentHandles = (agentProfile.payment_handles as any) || {};
    }
  }

  const statusColor = STATUS_COLORS[order.status] ?? 'var(--grey-400)';
  const num = (v: number | string | null | undefined) => Number(v ?? 0);

  const buyer = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;
  const addr = order.shipping_address || {};

  const handleForMethod = paymentHandles?.[order.payment_method] || null;

  return (
    <PageShell>
      <section className="section">
        <div className="container-sm">
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <Link href="/orders" style={{ fontSize: '0.85rem', color: 'var(--teal)', textDecoration: 'none' }}>
              Back To My Orders
            </Link>
          </div>

          <div style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <div>
                <h1 style={{ fontSize: '1.6rem', marginBottom: 'var(--space-2)' }}>
                  Order <span style={{ color: 'var(--teal)', fontFamily: 'var(--font-brand)' }}>#{order.id.slice(0, 8).toUpperCase()}</span>
                </h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)' }}>
                  Placed {new Date(order.created_at).toLocaleString()} / {PAYMENT_LABELS[order.payment_method] ?? order.payment_method}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                {order.buyer_id === user.id && order.status !== 'cancelled' && (
                  <SubscribeReplenishButton
                    agentId={order.agent_id}
                    paymentMethod={order.payment_method}
                    fulfillmentMethod={order.fulfillment_method}
                    shippingAddress={
                      order.fulfillment_method === 'ship' && addr?.street
                        ? {
                            fullName: addr.fullName,
                            street: addr.street,
                            suite: addr.suite,
                            city: addr.city,
                            state: addr.state,
                            zip: addr.zip,
                          }
                        : null
                    }
                    items={order.order_items.map((it) => ({
                      agent_product_id: it.agent_product_id,
                      quantity: it.quantity,
                    }))}
                  />
                )}
                <ReceiptButton
                  orderId={order.id}
                  createdAt={order.created_at}
                  buyerName={buyer?.full_name || 'Researcher'}
                  buyerEmail={buyer?.email || ''}
                  sellerName={sellerName}
                  paymentMethodLabel={PAYMENT_LABELS[order.payment_method] ?? order.payment_method}
                  paymentHandle={handleForMethod}
                  trackingNumber={order.tracking_number}
                  shippingAddress={
                    order.fulfillment_method === 'ship' && addr?.street
                      ? {
                          fullName: addr.fullName,
                          street: addr.street,
                          suite: addr.suite,
                          city: addr.city,
                          state: addr.state,
                          zip: addr.zip,
                        }
                      : null
                  }
                  items={order.order_items.map((it) => ({
                    product_name: it.product_name,
                    quantity: it.quantity,
                    unit_retail_price: num(it.unit_retail_price),
                  }))}
                  subtotal={num(order.subtotal)}
                  discount={num(order.discount_amount)}
                  couponCode={order.coupon_code}
                  shipping={num(order.shipping_cost)}
                  total={num(order.total)}
                />
                {order.buyer_id === user.id && (
                  <RequestReturnButton
                    orderId={order.id}
                    orderStatus={order.status}
                    items={order.order_items.map((it) => ({
                      order_item_id: it.id,
                      product_name: it.product_name,
                      quantity: Number(it.quantity),
                      unit_retail_price: num(it.unit_retail_price),
                    }))}
                  />
                )}
                <span style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: statusColor,
                  background: `${statusColor}15`,
                  border: `1px solid ${statusColor}40`,
                  padding: '6px var(--space-4)',
                  borderRadius: 'var(--radius-full)',
                }}>
                  {STATUS_LABELS[order.status] ?? order.status}
                </span>
              </div>
            </div>
          </div>

          {/* Buyer + Shipping */}
          <div className="card-metal" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-5)' }}>
            <h2 style={{ fontSize: '0.95rem', color: 'var(--silver)', marginBottom: 'var(--space-3)' }}>
              Buyer & Shipping
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase', marginBottom: 4 }}>Buyer</div>
                <div style={{ fontSize: '0.88rem', color: 'var(--silver)' }}>{buyer?.full_name || 'Researcher'}</div>
              </div>
              {order.fulfillment_method === 'ship' && addr.street ? (
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase', marginBottom: 4 }}>Shipping Address</div>
                  <div style={{ fontSize: '0.84rem', color: 'var(--silver)', lineHeight: 1.5 }}>
                    {addr.fullName && <div>{addr.fullName}</div>}
                    <div>{addr.street}</div>
                    {addr.suite && <div>{addr.suite}</div>}
                    <div>{addr.city}, {addr.state} {addr.zip}</div>
                  </div>
                </div>
              ) : order.fulfillment_method === 'agent_pickup' ? (
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase', marginBottom: 4 }}>Fulfillment</div>
                  <div style={{ fontSize: '0.84rem', color: 'var(--silver)' }}>Agent Pickup</div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Items */}
          <div className="card-metal" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-5)' }}>
            <h2 style={{ fontSize: '0.95rem', color: 'var(--silver)', marginBottom: 'var(--space-4)' }}>
              Items
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {order.order_items.map((item) => (
                <div
                  key={item.id}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 'var(--space-3)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <div>
                    <div style={{ fontSize: '0.92rem', color: 'var(--silver)', fontWeight: 600 }}>{item.product_name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginTop: 2 }}>
                      Quantity: <span style={{ color: 'var(--teal)' }}>{item.quantity}</span>
                      {' / '}Unit: ${num(item.unit_retail_price).toFixed(2)}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--silver)', fontFamily: 'var(--font-brand)' }}>
                    ${(num(item.unit_retail_price) * item.quantity).toFixed(2)}
                  </div>
                </div>
              ))}

              {/* Totals */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'var(--space-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--grey-400)' }}>
                  <span>Subtotal</span>
                  <span>${num(order.subtotal).toFixed(2)}</span>
                </div>
                {num(order.discount_amount) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#68D391' }}>
                    <span>Coupon Discount{order.coupon_code ? ` (${order.coupon_code})` : ''}</span>
                    <span>-${num(order.discount_amount).toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--grey-400)' }}>
                  <span>Shipping</span>
                  <span>${num(order.shipping_cost).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 700, color: 'var(--teal)', marginTop: 4, paddingTop: 'var(--space-2)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <span>Total</span>
                  <span style={{ fontFamily: 'var(--font-brand)' }}>${num(order.total).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Instructions */}
          {order.status === 'pending_customer_payment' && (
            <div className="card-metal" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-5)', borderColor: 'rgba(246,173,85,0.3)' }}>
              <h2 style={{ fontSize: '0.95rem', color: '#F6AD55', marginBottom: 'var(--space-3)' }}>
                Payment Instructions
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--silver)', lineHeight: 1.6, marginBottom: 'var(--space-3)' }}>
                Send <strong style={{ color: 'var(--teal)' }}>${num(order.total).toFixed(2)}</strong> Via{' '}
                <strong>{PAYMENT_LABELS[order.payment_method] ?? order.payment_method}</strong> To {sellerName}.
              </p>
              {handleForMethod ? (
                <div style={{ padding: 'var(--space-3)', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: 'var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase', marginBottom: 4 }}>
                    {PAYMENT_LABELS[order.payment_method] ?? order.payment_method} Handle
                  </div>
                  <div style={{ fontSize: '0.95rem', color: 'var(--white)', fontWeight: 600, fontFamily: 'var(--font-brand)', wordBreak: 'break-all' }}>
                    {handleForMethod}
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)' }}>
                  Contact Your Agent For Payment Details.
                </p>
              )}
              <p style={{ fontSize: '0.78rem', color: 'var(--grey-500)', marginTop: 'var(--space-3)' }}>
                Include Order #{order.id.slice(0, 8).toUpperCase()} In The Memo.
              </p>
            </div>
          )}

          {/* Payment Proof Upload (buyer only — RLS enforces) */}
          <PaymentProofUpload
            orderId={order.id}
            uploadDisabled={order.status === 'cancelled' || order.status === 'delivered'}
          />

          {/* Tracking */}
          {(order.tracking_number || order.label_url) && (
            <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
              <h2 style={{ fontSize: '0.95rem', color: 'var(--silver)', marginBottom: 'var(--space-3)' }}>
                Tracking
              </h2>
              {order.tracking_number && (
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase', marginBottom: 4 }}>Tracking Number</div>
                  <div style={{ fontSize: '0.92rem', color: 'var(--silver)', fontWeight: 600, fontFamily: 'var(--font-brand)', wordBreak: 'break-all' }}>
                    {order.tracking_number}
                  </div>
                </div>
              )}
              {order.label_url && (
                <a
                  href={order.label_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{ display: 'inline-flex', fontSize: '0.85rem' }}
                >
                  View Shipping Label
                </a>
              )}
            </div>
          )}
        </div>
      </section>
    </PageShell>
  );
}
