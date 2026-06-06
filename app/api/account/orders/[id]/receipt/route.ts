import { type NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function escape(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function money(cents: number | null | undefined): string {
  const n = typeof cents === 'number' ? cents : 0;
  return `$${n.toFixed(2)}`;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const service = await createServiceClient();
  const { data: order } = await service
    .from('orders')
    .select(`
      id, buyer_id, agent_id, status, payment_method, fulfillment_method,
      shipping_address, shipping_cost, subtotal, discount_amount, coupon_code,
      total, tracking_number, buyer_name, buyer_email,
      created_at, agent_approved_at
    `)
    .eq('id', id)
    .maybeSingle();

  if (!order) return new Response('Not Found', { status: 404 });

  const { data: viewer } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const isAdmin = viewer?.role === 'admin';
  if (!isAdmin && order.buyer_id !== user.id) {
    return new Response('Forbidden', { status: 403 });
  }

  const { data: items } = await service
    .from('order_items')
    .select('product_name, quantity, unit_retail_price')
    .eq('order_id', id);

  const { data: agentProfile } = await service
    .from('agent_profiles')
    .select('display_name, slug')
    .eq('id', order.agent_id)
    .maybeSingle();

  const shippingAddr = order.shipping_address as Record<string, string> | null;
  const issuedAt = new Date().toISOString();
  const orderShort = String(order.id).slice(0, 8).toUpperCase();

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Receipt ${escape(orderShort)} | Pep Nation Lab</title>
<style>
  :root { --teal: #00C4BC; --black: #050A0F; --silver: #A8B4C0; --line: rgba(0,0,0,0.1); }
  body { font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif; color: #050A0F; background: #FFFFFF; max-width: 760px; margin: 2rem auto; padding: 0 1.5rem; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid var(--teal); padding-bottom: 1rem; margin-bottom: 1.5rem; }
  h1 { margin: 0; font-size: 1.4rem; letter-spacing: 0.05em; }
  h2 { font-size: 1rem; margin: 1.5rem 0 0.5rem; }
  .muted { color: #6B7785; font-size: 0.85rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
  th, td { padding: 0.5rem 0.25rem; text-align: left; border-bottom: 1px solid var(--line); font-size: 0.9rem; }
  th { font-weight: 700; background: rgba(0,196,188,0.06); }
  td.right, th.right { text-align: right; }
  .totals { margin-top: 1rem; padding-top: 1rem; border-top: 2px solid var(--line); }
  .totals .row { display: flex; justify-content: space-between; padding: 0.25rem 0; font-size: 0.95rem; }
  .totals .grand { font-weight: 800; font-size: 1.1rem; border-top: 1px solid var(--line); padding-top: 0.5rem; margin-top: 0.5rem; }
  .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--line); font-size: 0.75rem; color: #6B7785; }
  .badge { display: inline-block; padding: 2px 8px; background: var(--teal); color: var(--black); border-radius: 999px; font-size: 0.7rem; font-weight: 700; text-transform: capitalize; }
  .actions { margin-top: 1rem; }
  .actions button, .actions a { background: var(--teal); color: var(--black); padding: 0.5rem 1rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 700; text-decoration: none; margin-right: 0.5rem; }
  @media print { body { margin: 0; padding: 0.5rem; max-width: none; } header { page-break-after: avoid; } .actions { display: none; } }
</style>
</head>
<body>
<header>
  <div>
    <h1>Pep Nation Lab</h1>
    <div class="muted">Research Use Only Receipt</div>
  </div>
  <div style="text-align: right;">
    <div><strong>Order #${escape(orderShort)}</strong></div>
    <div class="muted">${new Date(order.created_at).toLocaleString()}</div>
    <div class="muted">Status: <span class="badge">${escape(order.status.replace(/_/g, ' '))}</span></div>
  </div>
</header>

<div class="actions">
  <button onclick="window.print()">Print Receipt</button>
  <a href="/orders/${escape(order.id)}">View Order Detail</a>
</div>

<h2>Buyer</h2>
<div>${escape(order.buyer_name || '')}</div>
<div class="muted">${escape(order.buyer_email || '')}</div>

<h2>Agent</h2>
<div>${escape(agentProfile?.display_name || 'Pep Nation Lab')}</div>
${agentProfile?.slug ? `<div class="muted">pepnationlab.com/${escape(agentProfile.slug)}</div>` : ''}

<h2>Shipping</h2>
${shippingAddr ? `
  <div>${escape(shippingAddr.full_name)}</div>
  <div>${escape(shippingAddr.street1)}${shippingAddr.street2 ? ', ' + escape(shippingAddr.street2) : ''}</div>
  <div>${escape(shippingAddr.city)}, ${escape(shippingAddr.state)} ${escape(shippingAddr.zip)}</div>
  <div>${escape(shippingAddr.country || 'US')}</div>
` : '<div class="muted">No Shipping Address (Local Pickup).</div>'}
${order.tracking_number ? `<div class="muted">Tracking: ${escape(order.tracking_number)}</div>` : ''}

<h2>Line Items</h2>
<table>
  <thead>
    <tr>
      <th>Product</th>
      <th class="right">Quantity</th>
      <th class="right">Unit Price</th>
      <th class="right">Subtotal</th>
    </tr>
  </thead>
  <tbody>
    ${(items ?? []).map((it) => `
      <tr>
        <td>${escape(it.product_name)}</td>
        <td class="right">${it.quantity}</td>
        <td class="right">${money(Number(it.unit_retail_price))}</td>
        <td class="right">${money(Number(it.unit_retail_price) * Number(it.quantity))}</td>
      </tr>
    `).join('')}
  </tbody>
</table>

<div class="totals">
  <div class="row"><span>Subtotal</span><span>${money(Number(order.subtotal))}</span></div>
  ${Number(order.discount_amount) > 0 ? `<div class="row"><span>Discount${order.coupon_code ? ' (' + escape(order.coupon_code) + ')' : ''}</span><span>- ${money(Number(order.discount_amount))}</span></div>` : ''}
  <div class="row"><span>Shipping</span><span>${money(Number(order.shipping_cost))}</span></div>

  <div class="row grand"><span>Total</span><span>${money(Number(order.total))}</span></div>
  <div class="row muted"><span>Payment Method</span><span>${escape(order.payment_method.replace(/_/g, ' '))}</span></div>
  <div class="row muted"><span>Fulfillment</span><span>${escape((order.fulfillment_method || 'shipping').replace(/_/g, ' '))}</span></div>
</div>

<div class="footer">
  Pep Nation Lab - All Products For In Vitro Research Use Only.<br />
  Receipt Reference: <code>${escape(order.id)}</code><br />
  Retrieved: ${escape(issuedAt)}
</div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
