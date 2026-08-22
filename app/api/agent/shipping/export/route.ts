/**
 * GET /api/agent/shipping/export
 *
 * Downloads a Pirate Ship import-ready CSV of the caller's unshipped
 * ship-method orders (status approved_ship or in_fulfillment, no tracking
 * number yet). Scope matches the agent dashboard order list: the caller's own
 * orders plus their DIRECT sub-agents' orders (profiles.parent_agent_id =
 * caller), so a super-agent can batch-ship the downline they already see.
 *
 * Column headers are chosen so Pirate Ship's spreadsheet import auto-maps
 * them. "Order Number" carries the full order UUID; Pirate Ship echoes it
 * back in its shipment export so /api/agent/shipping/import-tracking can
 * match tracking numbers to orders exactly.
 *
 * Guards: requireAgent (GET - no same-origin assertion needed).
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { normalizeShippingAddress } from '@/lib/shipping';

const CSV_HEADERS = [
  'Order Number',
  'Name',
  'Company',
  'Address Line 1',
  'Address Line 2',
  'City',
  'State',
  'Zip',
  'Country',
  'Email Address',
  'Phone Number',
  'Weight (oz)',
];

const DEFAULT_ITEM_WEIGHT_OZ = 4;

/**
 * CSV-escape a single field: neutralise formula injection (leading =, +, -, @
 * gets a single-quote prefix) and quote any field containing a comma, quote,
 * or newline (doubling embedded quotes).
 */
function csvField(value: unknown): string {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

interface ExportItemRow {
  quantity: number | null;
  products: { weight_oz: number | null } | Array<{ weight_oz: number | null }> | null;
}

function itemWeightOz(item: ExportItemRow): number {
  const rel = item.products;
  const prod = Array.isArray(rel) ? rel[0] : rel;
  const w = Number(prod?.weight_oz);
  return Number.isFinite(w) && w > 0 ? w : DEFAULT_ITEM_WEIGHT_OZ;
}

export async function GET() {
  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const supabase = await createServiceClient();
    const callerId = gate.user.id;

    // Same scoping as the agent dashboard order list: self + direct children.
    const { data: subAgents } = await supabase
      .from('profiles')
      .select('id')
      .eq('parent_agent_id', callerId);
    const agentIds = [callerId, ...(subAgents ?? []).map((a) => a.id as string)];

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, buyer_name, buyer_email, shipping_address, order_items(quantity, products(weight_oz))')
      .in('agent_id', agentIds)
      .eq('fulfillment_method', 'ship')
      .in('status', ['approved_ship', 'in_fulfillment'])
      .is('tracking_number', null)
      .order('created_at', { ascending: true });

    if (ordersError) {
      return NextResponse.json({ error: 'Failed To Load Orders For Export.' }, { status: 500 });
    }

    const lines: string[] = [CSV_HEADERS.map(csvField).join(',')];

    for (const order of orders ?? []) {
      const addr = normalizeShippingAddress(order.shipping_address, {
        full_name: (order.buyer_name as string | null) ?? null,
        email: (order.buyer_email as string | null) ?? null,
      });
      // Skip rows whose address cannot be parsed - Pirate Ship would reject
      // them anyway; the agent handles those orders one-off from the panel.
      if (!addr) continue;

      const items = ((order.order_items as unknown) as ExportItemRow[]) ?? [];
      let weight = 0;
      for (const item of items) {
        const qty = Number(item.quantity) || 0;
        if (qty <= 0) continue;
        weight += qty * itemWeightOz(item);
      }
      weight = Math.max(1, Math.round(weight));

      lines.push([
        order.id,
        addr.name ?? order.buyer_name ?? '',
        addr.company ?? '',
        addr.street1,
        addr.street2 ?? '',
        addr.city,
        addr.state,
        addr.zip,
        addr.country ?? 'US',
        addr.email ?? order.buyer_email ?? '',
        addr.phone ?? '',
        weight,
      ].map(csvField).join(','));
    }

    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return new NextResponse(lines.join('\r\n') + '\r\n', {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="pirateship-orders-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Agent Shipping Export API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
