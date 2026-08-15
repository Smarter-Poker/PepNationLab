import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import IframeLink from '@/components/ui/IframeLink';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isSavageNetworkAgent } from '@/lib/brand-network';
import PageShell from '@/components/PageShell';
import PaymentProofUpload from '@/components/PaymentProofUpload';
import RecommendationStrip, { type RecommendationItem } from '@/components/RecommendationStrip';
import ReceiptButton from './ReceiptButton';
import OrderTrackingTimeline, { type TrackingEvent } from '@/components/OrderTrackingTimeline';
import OrderStageTimeline from '@/components/OrderStageTimeline';
import OrderActivityFeed, { type OrderActivityEvent } from '@/components/OrderActivityFeed';
import ReorderOrderButton from './ReorderOrderButton';
import CancelOrderButton from './CancelOrderButton';
import ReorderStackButton from './ReorderStackButton';
import ChangePaymentMethod from '@/components/ChangePaymentMethod';
import { paymentMethodLabel } from '@/lib/payment-method-labels';
import HelpHint from '@/components/help/HelpHint';
import { getPopularName } from '@/lib/peptide-popular-names';
import { carrierInfo } from '@/lib/carrier';
import { computeOwnOrderLedger, computeUplineLedger } from '@/lib/agent-ledger';

// R28: map order status → matching FAQ id so the contextual help pill lands
// the buyer on the exact answer for their state (not the FAQ root). Every id
// here is verified against the FAQ_ITEMS catalog in lib/help-faq.ts.
const STATUS_FAQ_ID: Record<string, string> = {
  pending_customer_payment: 'how-do-i-pay-for-an-order',
  agent_approval_pending: 'order-stuck-in-approval',
  admin_approval_pending: 'order-stuck-in-approval',
  approved_ship: 'order-statuses-explained',
  approved_pickup: 'ship-vs-pickup',
  in_fulfillment: 'when-will-my-order-ship',
  shipped: 'when-will-my-order-ship',
  delivered: 'order-wrong-or-missing',
  cancelled: 'cancelled-why',
};

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Order Detail | Pep Nation Lab',
};

const STATUS_LABELS: Record<string, string> = {
  pending_customer_payment: 'Pending Payment',
  agent_approval_pending: 'Agent Approval Pending',
  admin_approval_pending: 'Pending Approval',
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
  admin_approval_pending: '#00E5FF',
  approved_ship: '#00E5FF',
  approved_pickup: '#00E5FF',
  in_fulfillment: 'var(--teal)',
  shipped: 'var(--teal)',
  delivered: '#68D391',
  cancelled: 'var(--grey-400)',
};

interface OrderItem {
  id: string;
  agent_product_id: string | null;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_retail_price: number | string;
  unit_cost_price: number | string;
  unit_super_agent_cost: number | string | null;
  lot_number: string | null;
  coa_url: string | null;
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
  shipped_at: string | null;
  delivered_at: string | null;
  updated_at: string | null;
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

  // Determine viewer role to conditionally show admin/agent controls.
  const { data: viewerProfile } = await supabase
    .from('profiles')
    .select('role, is_sub_agent, is_super_agent')
    .eq('id', user.id)
    .maybeSingle();
  const viewerRole = viewerProfile?.role ?? 'researcher';
  const canCancelOrder = viewerRole === 'admin' || viewerRole === 'agent';

  // RLS enforces buyer_id = auth.uid() for researchers; admins/agents may also pass.
  const { data: orderData, error } = await supabase
    .from('orders')
    .select(`
      id, status, created_at, payment_method, fulfillment_method,
      subtotal, discount_amount, coupon_code, shipping_cost, total,
      tracking_number, label_url, shipped_at, delivered_at, updated_at, shipping_address, agent_id, buyer_id,
      order_items (id, agent_product_id, product_id, product_name, quantity, unit_retail_price, unit_cost_price, unit_super_agent_cost, lot_number, coa_url, products(compound_slug)),
      profiles:buyer_id (full_name, email)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error || !orderData) {
    return (
      <PageShell hideFooter>
        <section className="section">
          <div className="container-sm">
            <div className="glass-panel hover-lift stagger-fade-in" style={{ padding: 'var(--space-12)', textAlign: 'center', animationDelay: '0.1s' }}>
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
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <h1 style={{ fontSize: '1.3rem', marginBottom: 'var(--space-2)' }}>Order Not Found</h1>
              <p style={{ fontSize: '0.88rem', color: 'var(--grey-400)', marginBottom: 'var(--space-6)', maxWidth: 420, marginInline: 'auto', lineHeight: 1.6 }}>
                We Could Not Find This Order, Or It Is Not Associated With Your Account. If You Believe This Is An Error, Contact Your Agent For Help.
              </p>
              <Link href="/orders" className="btn btn-primary">
                Back To My Orders
              </Link>
            </div>
          </div>
        </section>
      </PageShell>
    );
  }

  const order = orderData as unknown as Order;

  // Carrier tracking history (EasyPost webhook -> shipping_tracking_events).
  // RLS-scoped to this buyer/agent/admin and fully best-effort: any failure
  // leaves the timeline empty and never breaks the order page.
  let trackingEvents: TrackingEvent[] = [];
  try {
    const { data: te } = await supabase
      .from('shipping_tracking_events')
      .select('status, substatus, status_details, location, occurred_at, carrier')
      .eq('order_id', order.id)
      .order('occurred_at', { ascending: false })
      .limit(50);
    if (Array.isArray(te)) trackingEvents = te as unknown as TrackingEvent[];
  } catch {
    trackingEvents = [];
  }

  // Order activity timeline (order_events). RLS grants the buyer (and the
  // order's agent / upline / admins) read access; best-effort so a failure
  // never breaks the order page. The component filters to buyer-safe events.
  let activityEvents: OrderActivityEvent[] = [];
  try {
    const { data: oe } = await supabase
      .from('order_events')
      .select('event, actor_role, payload, created_at')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true })
      .limit(100);
    if (Array.isArray(oe)) activityEvents = oe as unknown as OrderActivityEvent[];
  } catch {
    activityEvents = [];
  }

  // Resolve seller payment handles if order has an agent
  let paymentHandles: Record<string, string> = {};
  let sellerName = 'Pep Nation Lab';
  let agentSlug: string | null = null;
  let sellerLogoUrl: string | null = null;
  let brandNetworkIsSavage = false;
  if (order.agent_id) {
    try {
      const svcBrand = await createServiceClient();
      brandNetworkIsSavage = await isSavageNetworkAgent(svcBrand, order.agent_id);
    } catch { /* non-fatal: strip falls back to its heuristics */ }
    const { data: agentProfile } = await supabase
      .from('agent_profiles')
      .select('display_name, payment_handles, slug, logo_url')
      .eq('id', order.agent_id)
      .maybeSingle();
    if (agentProfile) {
      sellerName = agentProfile.display_name || sellerName;
      paymentHandles = (agentProfile.payment_handles as any) || {};
      agentSlug = (agentProfile.slug as string | null) ?? null;
      sellerLogoUrl = (agentProfile.logo_url as string | null) ?? null;
    }
  }

  // ─── Recommendations ("You May Also Like") ───────
  // Seed from the FIRST eligible order_item.product_id. Service client used
  // so the SECURITY DEFINER RPC + materialized view reads work regardless
  // of the researcher's row-level role. We intersect the candidate ids
  // with the order's agent's agent_products catalog so all "View" links go
  // to a real storefront listing the recommended product.
  let recommendations: RecommendationItem[] = [];
  try {
    const seedProductId = order.order_items.find((it) => it.product_id)?.product_id ?? null;
    if (seedProductId && order.agent_id) {
      const service = await createServiceClient();
      const { data: pairs } = await service.rpc('get_copurchase_recommendations', {
        p_product_id: seedProductId,
        p_limit: 16,
      });
      const candidates: string[] = Array.isArray(pairs)
        ? (pairs as Array<{ related_product_id: string }>)
            .map((r) => r.related_product_id)
            .filter((id) => !!id && id !== seedProductId)
        : [];
      // Fallback to popular if we don't have enough co-purchase data.
      if (candidates.length < 6) {
        const { data: pop } = await service
          .from('product_popular_60d')
          .select('product_id')
          .order('units', { ascending: false })
          .limit(16);
        for (const row of (pop ?? []) as Array<{ product_id: string }>) {
          if (row.product_id && row.product_id !== seedProductId && !candidates.includes(row.product_id)) {
            candidates.push(row.product_id);
          }
        }
      }
      if (candidates.length > 0) {
        const { data: prods } = await service
          .from('products')
          .select('id, name, slug, category, image_url, base_cost, is_active, is_banned')
          .in('id', candidates);
        const productMap = new Map<string, RecommendationItem & { is_active?: boolean | null; is_banned?: boolean | null }>();
        for (const p of (prods ?? []) as Array<{
          id: string; name: string; slug: string | null; category: string | null;
          image_url: string | null; base_cost: number | string | null;
          is_active: boolean | null; is_banned: boolean | null;
        }>) {
          if (!p?.id) continue;
          if (p.is_active === false) continue;
          if (p.is_banned === true) continue;
          productMap.set(p.id, {
            id: p.id,
            name: p.name,
            slug: p.slug,
            category: p.category,
            image_url: p.image_url,
            base_cost: Number(p.base_cost ?? 0),
          });
        }
        // Intersect with the order's agent's catalog so the storefront
        // actually carries each recommended product.
        const { data: aps } = await service
          .from('agent_products')
          .select('product_id, retail_price, is_visible, is_on_sale, sale_price')
          .eq('agent_id', order.agent_id)
          .in('product_id', Array.from(productMap.keys()));
        const agentPriceMap = new Map<string, number>();
        const agentVisible = new Set<string>();
        for (const ap of (aps ?? []) as Array<{
          product_id: string; retail_price: number | string | null;
          is_visible: boolean | null; is_on_sale?: boolean | null; sale_price?: number | string | null;
        }>) {
          if (ap.is_visible === false) continue;
          agentVisible.add(ap.product_id);
          const raw = ap.is_on_sale && ap.sale_price != null ? Number(ap.sale_price) : Number(ap.retail_price);
          const perVial = Number.isFinite(raw) && raw > 0 ? raw / 10 : 0;
          if (perVial > 0) agentPriceMap.set(ap.product_id, perVial);
        }
        for (const cid of candidates) {
          if (recommendations.length >= 6) break;
          const p = productMap.get(cid);
          if (!p) continue;
          if (!agentVisible.has(cid)) continue;
          recommendations.push({
            ...p,
            ...(agentPriceMap.has(cid) ? { retail_price: agentPriceMap.get(cid)! } : {}),
          });
        }
      }
    }
  } catch {
    // Recommendations are best-effort; never break the order detail page.
    recommendations = [];
  }

  // Pre-fetch stack metadata for order items
  const slugs = order.order_items.map((it: any) => it.products?.compound_slug).filter(Boolean);
  const stackInfoMap = new Map<string, { isPreBlended: boolean, components: string[] }>();
  if (slugs.length > 0) {
    const { data: stackCompounds } = await supabase
      .from('compounds')
      .select('slug, is_stack, stack_components')
      .in('slug', slugs)
      .eq('is_stack', true);

    if (stackCompounds) {
      const allComponentSlugs = stackCompounds.flatMap(c => c.stack_components || []);
      const { data: childCompounds } = await supabase
        .from('compounds')
        .select('slug, display_name')
        .in('slug', allComponentSlugs);
        
      for (const c of stackCompounds) {
        const isPreBlended = ['klow-stack', 'glow-stack', 'wolverine-stack'].some(s => c.slug.includes(s.replace('-stack', '')));
        const resolvedComponents = (c.stack_components || []).map((s: string) => {
          const child = childCompounds?.find(ch => ch.slug === s);
          return child?.display_name || s;
        });
        stackInfoMap.set(c.slug, {
          isPreBlended,
          components: resolvedComponents
        });
      }
    }
  }

  const statusColor = STATUS_COLORS[order.status] ?? 'var(--grey-400)';
  const num = (v: number | string | null | undefined) => Number(v ?? 0);

  const buyer = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;
  const addr = order.shipping_address || {};

  const handleForMethod = paymentHandles?.[order.payment_method] || null;

  // Customer Support v2: deep link into the messenger pre-chat picker
  // pre-filled with this order id. The /messenger page reads ?openSupport=1
  // and ?orderId=<uuid> via the SupportButton client component.
  const supportHref = `/messenger?openSupport=1&orderId=${encodeURIComponent(order.id)}`;

  return (
    <PageShell hideFooter>
      <section className="section">
        <div className="container-sm">
          <div
            style={{
              marginBottom: 'var(--space-4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-3)',
              flexWrap: 'wrap',
            }}
          >
            <Link href="/orders" style={{ fontSize: '0.85rem', color: 'var(--teal)', textDecoration: 'none' }}>
              Back To My Orders
            </Link>
            {order.buyer_id === user.id && (
              <Link
                href={supportHref}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: 'rgba(0,196,188,0.12)',
                  border: '1px solid rgba(0,196,188,0.45)',
                  color: 'var(--teal)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  letterSpacing: '0.02em',
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="4" />
                  <line x1="4.93" y1="4.93" x2="9.17" y2="9.17" />
                  <line x1="14.83" y1="14.83" x2="19.07" y2="19.07" />
                  <line x1="14.83" y1="9.17" x2="19.07" y2="4.93" />
                  <line x1="14.83" y1="9.17" x2="18.36" y2="5.64" />
                  <line x1="4.93" y1="19.07" x2="9.17" y2="14.83" />
                </svg>
                Contact Support About This Order
              </Link>
            )}
          </div>

          <div style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <div>
                <h1 className="animated-gradient-text" style={{ fontSize: '1.6rem', marginBottom: 'var(--space-2)' }}>
                  Order <span style={{ color: 'var(--teal)', fontFamily: 'var(--font-brand)' }}>#{order.id.slice(0, 8).toUpperCase()}</span>
                </h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)' }}>
                  Placed {new Date(order.created_at).toLocaleString()} / {paymentMethodLabel(order.payment_method)}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <ReorderOrderButton orderId={order.id} />
                {canCancelOrder && (
                  <CancelOrderButton
                    orderId={order.id}
                    currentStatus={order.status}
                    viewerRole={viewerRole === 'admin' ? 'admin' : 'agent'}
                  />
                )}
                <ReceiptButton
                  orderId={order.id}
                  createdAt={order.created_at}
                  buyerName={buyer?.full_name || 'Researcher'}
                  buyerEmail={buyer?.email || ''}
                  sellerName={sellerName}
                  sellerLogoUrl={sellerLogoUrl}
                  paymentMethodLabel={paymentMethodLabel(order.payment_method)}
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
                {STATUS_FAQ_ID[order.status] ? (
                  <HelpHint
                    faqId={STATUS_FAQ_ID[order.status]}
                    label="What Does This Mean?"
                    source="order-detail-status"
                  />
                ) : null}
              </div>
            </div>
          </div>

          {/* Order Progress Timeline (B3): status enum mapped to human stages */}
          <div className="glass-panel hover-lift stagger-fade-in" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-5)', animationDelay: '0.05s' }}>
            <h2 style={{ fontSize: '0.95rem', color: 'var(--silver)', marginBottom: 'var(--space-4)' }}>
              Order Progress
            </h2>
            <OrderStageTimeline
              status={order.status}
              fulfillmentMethod={order.fulfillment_method}
              trackingNumber={order.tracking_number}
              createdAt={order.created_at}
              shippedAt={order.shipped_at}
              deliveredAt={order.delivered_at}
              updatedAt={order.updated_at}
            />
          </div>

          {/* Buyer + Shipping */}
          <div className="glass-panel hover-lift stagger-fade-in" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-5)', animationDelay: '0.1s' }}>
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
          <div className="glass-panel hover-lift stagger-fade-in" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-5)', animationDelay: '0.2s' }}>
            <h2 style={{ fontSize: '0.95rem', color: 'var(--silver)', marginBottom: 'var(--space-4)' }}>
              Items
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {/* Group items by bundleName */}
              {(() => {
                const groupedCart: { isBundle: boolean, name: string, items: typeof order.order_items }[] = [];
                const processedIds = new Set<string>();

                order.order_items.forEach((item, idx) => {
                  if (processedIds.has(idx.toString())) return;
                  const match = item.product_name && typeof item.product_name === 'string' ? item.product_name.match(/^(.*?)\s+\[Part of:\s+(.*?)\]$/) : null;
                  
                  if (match) {
                    const bundleName = match[2];
                    const bundleItems = order.order_items.filter(i => {
                      const m = i.product_name && typeof i.product_name === 'string' ? i.product_name.match(/^(.*?)\s+\[Part of:\s+(.*?)\]$/) : null;
                      return m && m[2] === bundleName;
                    });
                    if (!groupedCart.find(g => g.isBundle && g.name === bundleName)) {
                      groupedCart.push({ isBundle: true, name: bundleName, items: bundleItems });
                    }
                    bundleItems.forEach((_, iIdx) => {
                      const originalIdx = order.order_items.findIndex(i => i === bundleItems[iIdx]);
                      processedIds.add(originalIdx.toString());
                    });
                  } else {
                    groupedCart.push({ isBundle: false, name: item.product_name, items: [item] });
                    processedIds.add(idx.toString());
                  }
                });

                return groupedCart.map((group, groupIndex) => {
                  if (group.isBundle) {
                    const bundleSubtotal = group.items.reduce((acc, item) => acc + (num(item.unit_retail_price) * item.quantity), 0);
                    return (
                      <div key={`bundle-${group.name}-${groupIndex}`} style={{
                        background: 'rgba(0, 229, 255, 0.03)',
                        border: '1px solid rgba(0, 229, 255, 0.2)',
                        borderRadius: 8,
                        padding: '12px',
                        display: 'flex', flexDirection: 'column', gap: 6,
                        marginBottom: 12
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0,229,255,0.1)', paddingBottom: 8, marginBottom: 4 }}>
                          <div>
                            <h4 style={{ fontSize: '0.95rem', margin: 0, fontFamily: 'var(--font-brand)', color: '#00E5FF', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {group.name}
                            </h4>
                            <div style={{ fontSize: '0.65rem', color: '#68D391', marginTop: 2, fontWeight: 700 }}>Stack Discount (10% Off) Included</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--grey-400)', marginTop: 4, fontStyle: 'italic', maxWidth: '90%' }}>
                              Note: This peptide stack is not all inside one vial, it is individually packaged as the vials listed below.
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ fontSize: '0.95rem', color: '#00E5FF', fontWeight: 800 }}>${bundleSubtotal.toFixed(2)}</div>
                            <ReorderStackButton orderId={order.id} bundleName={group.name} />
                          </div>
                        </div>
                        {group.items.map(item => {
                          const m = item.product_name && typeof item.product_name === 'string' ? item.product_name.match(/^(.*?)\s+\[Part of:\s+(.*?)\]$/) : null;
                          const cleanName = m ? m[1] : item.product_name;
                          return (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 8, paddingTop: 4 }}>
                              <div>
                                <div style={{ fontSize: '0.88rem', color: 'var(--silver-light)', fontWeight: 600 }}>↳ {cleanName}</div>
                                {getPopularName(cleanName) && (
                                  <div style={{ fontSize: '0.75rem', color: 'var(--teal)', fontStyle: 'italic', fontWeight: 500, marginTop: 2 }}>
                                    {getPopularName(cleanName)}
                                  </div>
                                )}
                                <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginTop: 2 }}>
                                  Quantity: <span style={{ color: 'var(--teal)' }}>{item.quantity}</span>
                                  {' / '}Unit: ${num(item.unit_retail_price).toFixed(2)}
                                </div>
                              </div>
                              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--silver-light)' }}>
                                ${(num(item.unit_retail_price) * item.quantity).toFixed(2)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }

                  // Standard individual item
                  return group.items.map(item => {
                    const slug = (item as any).products?.compound_slug;
                    const stackInfo = slug ? stackInfoMap.get(slug) : null;
                    
                    return (
                    <div
                      key={item.id}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 'var(--space-3)', }}
                    >
                      <div>
                        <div style={{ fontSize: '0.92rem', color: 'var(--silver)', fontWeight: 600 }}>{item.product_name}</div>
                        {getPopularName(item.product_name) && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--teal)', fontStyle: 'italic', fontWeight: 500, marginTop: 2 }}>
                            {getPopularName(item.product_name)}
                          </div>
                        )}
                        {stackInfo && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--silver)', marginTop: '4px' }}>
                            {stackInfo.isPreBlended ? (
                              <span style={{ color: 'var(--teal)' }}>(Pre-blended stack - one peptide vial)</span>
                            ) : (
                              <div>
                                <span style={{ color: 'var(--brand-yellow)', fontWeight: 600 }}>Includes Vials:</span> {stackInfo.components.join(', ')}
                              </div>
                            )}
                          </div>
                        )}
                        <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginTop: 2 }}>
                          Quantity: <span style={{ color: 'var(--teal)' }}>{item.quantity}</span>
                          {' / '}Unit: ${num(item.unit_retail_price).toFixed(2)}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--silver)', fontFamily: 'var(--font-brand)' }}>
                        ${(num(item.unit_retail_price) * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  )});
                });
              })()}

              {/* Totals */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'var(--space-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--grey-400)' }}>
                  <span>Subtotal</span>
                  <span style={{ whiteSpace: 'nowrap' }}>${num(order.subtotal).toFixed(2)}</span>
                </div>
                {num(order.discount_amount) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--red)' }}>
                    <span>Coupon Discount{order.coupon_code ? ` (${order.coupon_code})` : ''}</span>
                    <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>-${num(order.discount_amount).toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--grey-400)' }}>
                  <span>Shipping</span>
                  <span style={{ whiteSpace: 'nowrap' }}>${num(order.shipping_cost).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 700, color: 'var(--teal)', marginTop: 4, paddingTop: 'var(--space-2)', }}>
                  <span>Total</span>
                  <span style={{ fontFamily: 'var(--font-brand)', whiteSpace: 'nowrap' }}>${num(order.total).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Agent Settlement Ledger — visible to agents/super_agents/admins only.
              Uses the same math as lib/agent-ledger.ts / components/AgentOrders.tsx.
              unit_cost_price   = what this agent owes their upline (Savage Brands)
              unit_super_agent_cost = what upline owes Pep Nation (their COG) */}
          {(viewerRole === 'agent' || viewerRole === 'super_agent' || viewerRole === 'admin') && order.agent_id && (() => {
            const ownLedger = computeOwnOrderLedger(order, order.order_items);
            const uplineLedger = computeUplineLedger(order, order.order_items);
            
            const {
              grossCustomerPmt,
              netYouCollect,
              discount,
              shippingCost,
              ownProfit,
              hasSbCost,
              sbCostTotal,
              markupSpread
            } = ownLedger;

            const {
              dlOwesYou,
              youOwePepNation,
              uplProfit
            } = uplineLedger;

            const uplineName       = order.agent?.parent?.full_name;
            const agentOwesUpline  = dlOwesYou;
            const agentProfit      = ownProfit;
            const uplineOwesPN     = youOwePepNation;
            const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

            return (
              <div className="glass-panel hover-lift stagger-fade-in" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-5)', animationDelay: '0.25s' }}>
                <div style={{ padding: '16px 18px', borderRadius: 12, background: 'rgba(0,196,188,0.06)', border: '1px solid rgba(0,196,188,0.2)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800 }}>
                    {uplineName ? `Upline Ledger — ${uplineName}` : 'Settlement Ledger'}
                  </div>

                  {/* Order Summary */}
                  <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: '0.71rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Order Summary</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem', color: 'var(--silver)' }}>
                      <span>Gross (Before Discount)</span><span>{fmt(grossCustomerPmt)}</span>
                    </div>
                    {discount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem', color: 'var(--red)' }}>
                        <span>Discount{order.coupon_code ? ` (${order.coupon_code})` : ''}</span>
                        <span>-{fmt(discount)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem', color: discount > 0 ? '#22C55E' : 'var(--silver)', fontWeight: 600 }}>
                      <span>Customer Paid</span><span>{fmt(netYouCollect)}</span>
                    </div>
                  </div>

                  <div style={{ height: 1, background: 'rgba(0,196,188,0.12)' }} />

                  {/* Agent → Upline */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem' }}>
                    <span style={{ color: 'var(--silver)' }}>
                      {uplineName ? `You Owe ${uplineName}` : 'You Owe Upline'}
                      <span style={{ fontSize: '0.73rem', color: 'var(--grey-400)', marginLeft: 6 }}>(Cost + Markup + Shipping)</span>
                    </span>
                    <span style={{ color: 'var(--red)', fontWeight: 700 }}>-{fmt(agentOwesUpline)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem' }}>
                    <span style={{ color: 'var(--silver)' }}>Your Net Profit</span>
                    <span style={{ color: agentProfit >= 0 ? '#22C55E' : 'var(--red)', fontWeight: 700 }}>{fmt(agentProfit)}</span>
                  </div>

                  {uplineName && (
                    <>
                      <div style={{ height: 1, background: 'rgba(0,196,188,0.12)' }} />

                      {/* Upline → PN */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem' }}>
                        <span style={{ color: 'var(--silver)' }}>
                          {uplineName} Collects From You
                        </span>
                        <span style={{ color: '#22C55E', fontWeight: 700 }}>{fmt(agentOwesUpline)}</span>
                      </div>

                      {hasSbCost && markupSpread !== null && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 14, borderLeft: '2px solid rgba(252,129,129,0.2)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--grey-400)' }}>
                            <span>{"└ Cost of Goods "}<span style={{ opacity: 0.7, fontSize: '0.7rem' }}>(pays Pep Nation)</span></span>
                            <span>{fmt(sbCostTotal)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--grey-400)' }}>
                            <span>{"└ Markup "}<span style={{ opacity: 0.7, fontSize: '0.7rem' }}>(keeps)</span></span>
                            <span>{fmt(markupSpread)}</span>
                          </div>
                          {shippingCost > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--grey-400)' }}>
                              <span>{"└ Shipping"}</span><span>{fmt(shippingCost)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {hasSbCost && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem' }}>
                          <span style={{ color: 'var(--silver)' }}>
                            {uplineName} Owes Pep Nation
                            <span style={{ fontSize: '0.73rem', color: 'var(--grey-400)', marginLeft: 6 }}>(COG + Shipping)</span>
                          </span>
                          <span style={{ color: 'var(--red)', fontWeight: 700 }}>-{fmt(uplineOwesPN)}</span>
                        </div>
                      )}

                      <div style={{ height: 1, background: 'rgba(0,196,188,0.12)' }} />

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 800 }}>
                        <span style={{ color: 'var(--white)' }}>{uplineName} Net Profit</span>
                        <span style={{ color: uplineProfit >= 0 ? '#22C55E' : 'var(--red)' }}>{fmt(uplineProfit)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })()}
          {recommendations.length > 0 && (
            <div className="glass-panel hover-lift stagger-fade-in" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-5)', animationDelay: '0.3s' }}>
              <RecommendationStrip
                title="You May Also Like"
                /* Pre-resolve each item href server-side - passing a
                   `buildHref` function across the server-to-client
                   component boundary throws "Functions cannot be passed
                   directly to Client Components" under React 19 + Next 16. */
                recommendations={recommendations.map((r) => ({
                  ...r,
                  href: agentSlug ? `/${agentSlug}?product=${encodeURIComponent(r.id)}` : '/orders',
                }))}
                agentSlug={agentSlug ?? undefined}
                isSavageBrandsNetwork={brandNetworkIsSavage}
              />
            </div>
          )}

          {/* Payment Instructions */}
          {order.status === 'pending_customer_payment' && (
            <div className="glass-panel hover-lift stagger-fade-in" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-5)', animationDelay: '0.4s' }}>
              <h2 style={{ fontSize: '0.95rem', color: 'var(--white)', marginBottom: 'var(--space-3)' }}>
                Payment Instructions
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: 'var(--space-3)' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--silver)', lineHeight: 1.6, margin: 0 }}>
                  Send <strong style={{ color: 'var(--teal)' }}>${num(order.total).toFixed(2)}</strong> Via{' '}
                  <strong>{paymentMethodLabel(order.payment_method)}</strong> To {sellerName}.
                </p>
                <ChangePaymentMethod 
                  orderId={order.id} 
                  currentMethod={order.payment_method} 
                  availableMethods={Object.keys(paymentHandles).filter(k => paymentHandles[k] && paymentHandles[k].trim().length > 0)} 
                />
              </div>
              {handleForMethod ? (
                <div style={{ padding: 'var(--space-3)', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: 'var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase', marginBottom: 4 }}>
                    {paymentMethodLabel(order.payment_method)} Contact Info
                  </div>
                  <div style={{ fontSize: '0.95rem', color: 'var(--white)', fontWeight: 600, fontFamily: 'var(--font-brand)', wordBreak: 'break-all' }}>
                    {handleForMethod}
                  </div>
                </div>
              ) : (
                /* Primary method not set - show ALL enabled methods as alternatives */
                (() => {
                  const allEnabled = Object.entries(paymentHandles)
                    .filter(([, v]) => v && v.trim().length > 0);
                  return allEnabled.length > 0 ? (
                    <div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--grey-400)', marginBottom: 'var(--space-3)' }}>
                        Your Agent Also Accepts Payment Via:
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        {allEnabled.map(([key, handle]) => (
                          <div key={key} style={{ padding: 'var(--space-3)', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: 'var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.78rem', color: 'var(--grey-400)', textTransform: 'uppercase' }}>
                              {paymentMethodLabel(key)}
                            </span>
                            <span style={{ fontSize: '0.9rem', color: 'var(--white)', fontWeight: 600, fontFamily: 'var(--font-brand)', wordBreak: 'break-all' }}>
                              {handle}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)' }}>
                      Contact Your Agent For Payment Details.
                    </p>
                  );
                })()
              )}
              <p style={{ fontSize: '0.78rem', color: 'var(--grey-500)', marginTop: 'var(--space-3)' }}>
                Include Order #{order.id.slice(0, 8).toUpperCase()} In The Memo.
              </p>
            </div>
          )}

          {/* Payment Proof Upload (buyer only - the POST route rejects
              non-buyers and shipped/cancelled/delivered orders, so mirror
              both gates here instead of showing a button that can only 403).
              Agents/uplines still see the uploaded proofs listed above the
              (hidden) upload control. */}
          <PaymentProofUpload
            orderId={order.id}
            uploadDisabled={
              ['cancelled', 'delivered', 'shipped'].includes(order.status) ||
              order.buyer_id !== user.id
            }
          />

          {/* Tracking */}
          {(order.tracking_number || order.label_url) && (
            <div className="glass-panel hover-lift stagger-fade-in" style={{ padding: 'var(--space-6)', animationDelay: '0.5s' }}>
              <h2 style={{ fontSize: '0.95rem', color: 'var(--silver)', marginBottom: 'var(--space-3)' }}>
                Tracking
              </h2>
              {order.tracking_number && (
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase', marginBottom: 4 }}>Tracking Number</div>
                  <div style={{ fontSize: '0.92rem', color: 'var(--silver)', fontWeight: 600, fontFamily: 'var(--font-brand)', wordBreak: 'break-all' }}>
                    {order.tracking_number}
                  </div>
                  {(() => {
                    const ti = carrierInfo(order.tracking_number);
                    return ti.trackingUrl ? (
                      <IframeLink
                        href={ti.trackingUrl}
                        title={`Track With ${ti.carrier}`}
                        className="btn btn-secondary"
                        style={{ display: 'inline-flex', fontSize: '0.85rem', marginTop: 'var(--space-2)' }}
                      >
                        Track Package
                      </IframeLink>
                    ) : null;
                  })()}
                </div>
              )}
              {order.label_url && (
                <IframeLink
                  href={order.label_url}
                  className="btn btn-secondary"
                  style={{ display: 'inline-flex', fontSize: '0.85rem' }}
                >
                  View Shipping Label
                </IframeLink>
              )}
            </div>
          )}

          {/* Carrier tracking history from the EasyPost webhook. Renders nothing
              until tracking events arrive, so it is safe to mount always. */}
          <OrderTrackingTimeline events={trackingEvents} />

          {/* Order activity history from order_events - the authoritative
              timeline of everything that happened to this order. Renders
              nothing when no buyer-visible events exist. */}
          <OrderActivityFeed events={activityEvents} />

          {/* Lot Numbers & COA (R26 placeholder - wired to order_items.lot_number / coa_url;
              real values are stamped at fulfillment time. Until then, each line item
              shows "Pending" so buyers know the surface exists.) */}
          <div className="glass-panel hover-lift stagger-fade-in" style={{ padding: 'var(--space-6)', animationDelay: '0.55s' }}>
            <h2 style={{ fontSize: '0.95rem', color: 'var(--silver)', marginBottom: 'var(--space-2)' }}>
              Lot Numbers & COA
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--grey-500)', marginBottom: 'var(--space-4)' }}>
              Lot/Batch Number And Certificate Of Analysis For Each Compound In This Order. Stamped At Fulfillment.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {order.order_items.map((it) => (
                <li
                  key={it.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3)',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: 'var(--white)', fontWeight: 600, fontSize: '0.9rem' }}>
                      {it.product_name} <span style={{ color: 'var(--grey-500)', fontWeight: 400 }}>x{it.quantity}</span>
                    </div>
                    <div style={{ color: 'var(--silver)', fontSize: '0.78rem', marginTop: 2, wordBreak: 'break-all', textTransform: 'none' }}>
                      Lot: {it.lot_number ? <span style={{ color: 'var(--teal)', fontFamily: 'var(--font-brand)' }}>{it.lot_number}</span> : <span style={{ color: 'var(--grey-500)' }}>Pending</span>}
                    </div>
                  </div>
                  {it.coa_url ? (
                    <IframeLink
                      href={it.coa_url}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.78rem' }}
                    >
                      View COA
                    </IframeLink>
                  ) : (
                    <span style={{ color: 'var(--grey-500)', fontSize: '0.78rem' }}>COA Pending</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
