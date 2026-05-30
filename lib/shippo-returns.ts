/**
 * Return label purchase — used by the RMA workflow when an agent decides to
 * issue a pre-paid return shipping label to the buyer. Migrated to the M1
 * platform-account model: uses lib/shippo.getActiveKey() instead of the
 * deprecated agent_profiles.shippo_api_key column. From-address is the
 * BUYER (mailing the package back); to-address is the warehouse origin
 * (resolved from agent_profiles.warehouse_origin_id, falling back to the
 * default shipping_origin, finally falling back to the legacy
 * agent_profiles.warehouse_address JSONB if neither is set).
 *
 * Writes back to rma_requests:
 *   return_tracking_number TEXT
 *   return_label_url TEXT
 *   return_label_purchased_at TIMESTAMPTZ (ISO 8601, e.g. 2026-05-30T05:30:00.000Z)
 *   status TEXT = 'label_sent'
 *   updated_at TIMESTAMPTZ
 */

import { pickOne } from '@/lib/relations';
import { getActiveKey } from '@/lib/shippo';
import type { SupabaseClient } from '@supabase/supabase-js';

const SHIPPO_BASE = 'https://api.goshippo.com';
const SHIPPO_API_VERSION = '2018-02-08';
const ALLOWED_CARRIERS = new Set(['usps', 'ups', 'fedex', 'dhl_express']);

export interface PurchaseReturnLabelOptions {
  rmaId: string;
  agentId: string;
}

export interface PurchaseReturnLabelOk {
  ok: true;
  trackingNumber: string;
  labelUrl: string;
}

export interface PurchaseReturnLabelErr {
  ok: false;
  error: string;
  status: number;
}

export type PurchaseReturnLabelResult = PurchaseReturnLabelOk | PurchaseReturnLabelErr;

interface ShipFromTo {
  name?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  email?: string;
}

export async function purchaseReturnLabel(
  supabase: SupabaseClient,
  opts: PurchaseReturnLabelOptions,
): Promise<PurchaseReturnLabelResult> {
  const { rmaId, agentId } = opts;

  const { data: rma, error: rmaErr } = await supabase
    .from('rma_requests')
    .select('id, order_id, status, return_label_url')
    .eq('id', rmaId)
    .single();

  if (rmaErr || !rma) return { ok: false, error: 'Return Request Not Found.', status: 404 };

  if (rma.return_label_url) {
    return { ok: false, error: 'Return Label Already Purchased For This Request.', status: 409 };
  }

  if (rma.status !== 'approved') {
    return {
      ok: false,
      error: 'Return Request Must Be Approved Before Purchasing A Return Label.',
      status: 422,
    };
  }

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, agent_id, shipping_address, profiles:profiles!orders_agent_id_fkey(parent_agent_id), buyer:profiles!orders_buyer_id_fkey(full_name, email)')
    .eq('id', rma.order_id)
    .single();

  if (orderErr || !order) return { ok: false, error: 'Order Not Found.', status: 404 };

  const orderAgentProfile = pickOne<{ parent_agent_id: string | null }>(order.profiles);
  if (order.agent_id !== agentId && orderAgentProfile?.parent_agent_id !== agentId) {
    return { ok: false, error: 'Unauthorized To Manage This Return.', status: 403 };
  }

  // ---------------------------------------------------------------------------
  // Resolve from-address (the buyer who is mailing the package back).
  // Handles both legacy JSONB shapes (street/zipCode vs street1/zip).
  // ---------------------------------------------------------------------------
  const addr = (order.shipping_address || {}) as Record<string, unknown>;
  const street = String(addr.street1 ?? addr.street ?? '').trim();
  const city = String(addr.city ?? '').trim();
  const state = String(addr.state ?? '').trim();
  const zip = String(addr.zip ?? addr.zipCode ?? '').trim();
  const country = String(addr.country ?? 'US').trim() || 'US';

  if (!street || !city || !state || !zip) {
    return { ok: false, error: 'Buyer Address Missing For Return Label.', status: 422 };
  }

  const buyer = pickOne<{ full_name?: string | null; email?: string | null }>(order.buyer);
  const from: ShipFromTo = {
    name: String(addr.fullName ?? addr.name ?? buyer?.full_name ?? 'Returning Customer'),
    street1: street,
    street2: typeof addr.street2 === 'string' ? addr.street2 : undefined,
    city,
    state,
    zip,
    country,
    email: buyer?.email && buyer.email.includes('@') ? buyer.email : undefined,
  };

  // ---------------------------------------------------------------------------
  // Resolve to-address (the warehouse). Cascade matches lib/shippo.resolveOrigin:
  // agent.warehouse_origin_id -> default shipping_origins row -> legacy JSONB.
  // ---------------------------------------------------------------------------
  const to = await resolveAgentOrigin(supabase, agentId);
  if (!to) {
    return {
      ok: false,
      error: 'No Warehouse Origin Configured. Add A Warehouse In Admin -> Settings -> Shipping.',
      status: 422,
    };
  }

  // ---------------------------------------------------------------------------
  // Compute parcel from rma_items weights (with 4 oz vial fallback).
  // ---------------------------------------------------------------------------
  type WeightRow = { weight_oz?: number | null };
  type OrderItemRow = { products: WeightRow | WeightRow[] | null };
  type RmaItemRow = { quantity: number; order_items: OrderItemRow | OrderItemRow[] | null };
  const { data: items } = await supabase
    .from('rma_items')
    .select('quantity, order_item_id, order_items(products(weight_oz))')
    .eq('rma_id', rmaId);

  let totalWeightOz = 0;
  let totalQty = 0;
  for (const it of (items ?? []) as RmaItemRow[]) {
    const qty = Number(it.quantity) || 0;
    const oi = pickOne<OrderItemRow>(it.order_items);
    const prod = oi ? pickOne<WeightRow>(oi.products) : null;
    const w = Number(prod?.weight_oz) || 4;
    totalWeightOz += qty * w;
    totalQty += qty;
  }
  const weightOz = Math.max(1, Math.round(totalWeightOz));
  let lengthIn = 6;
  let widthIn = 4;
  let heightIn = 4;
  if (totalQty > 3 && totalQty <= 10) { lengthIn = 9; widthIn = 6; heightIn = 3; }
  else if (totalQty > 10) { lengthIn = 12; widthIn = 9; heightIn = 4; }

  // ---------------------------------------------------------------------------
  // Resolve platform key (no more per-agent SDK).
  // ---------------------------------------------------------------------------
  let key;
  try {
    key = await getActiveKey(agentId);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'No Active Shippo Credentials.',
      status: 503,
    };
  }

  const headers: Record<string, string> = {
    Authorization: `ShippoToken ${key.token}`,
    'Shippo-API-Version': SHIPPO_API_VERSION,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (key.accountScope) headers['SHIPPO-ACCOUNT-ID'] = key.accountScope;

  // ---------------------------------------------------------------------------
  // POST /shipments/
  // ---------------------------------------------------------------------------
  const shipmentBody = {
    address_from: toShippoAddress(from),
    address_to: toShippoAddress(to),
    parcels: [{
      length: String(lengthIn),
      width: String(widthIn),
      height: String(heightIn),
      distance_unit: 'in',
      weight: String(weightOz),
      mass_unit: 'oz',
    }],
    extra: { is_return: true },
    async: false,
  };

  let shipmentJson: {
    rates?: Array<{
      object_id: string;
      provider?: string;
      amount?: string;
      attributes?: string[];
    }>;
    messages?: Array<{ text?: string }>;
  };
  try {
    const resp = await fetch(`${SHIPPO_BASE}/shipments/`, {
      method: 'POST',
      headers,
      body: JSON.stringify(shipmentBody),
    });
    if (!resp.ok) {
      console.error('[shippo-returns] shipments.create failed', resp.status);
      return { ok: false, error: 'Failed To Generate Return Shipment.', status: 502 };
    }
    shipmentJson = await resp.json();
  } catch (err) {
    console.error('[shippo-returns] shipments.create network err', err);
    return { ok: false, error: 'Shippo Unreachable.', status: 502 };
  }

  const rates = (shipmentJson.rates ?? [])
    .filter((r) => r.provider && ALLOWED_CARRIERS.has(r.provider.toLowerCase().replace(/\s+/g, '_')))
    .filter((r) => parseFloat(r.amount || '0') > 0)
    .sort((a, b) => parseFloat(a.amount || '0') - parseFloat(b.amount || '0'));

  if (rates.length === 0) {
    return { ok: false, error: 'No Return Shipping Rates Returned For This Address.', status: 422 };
  }
  const rate = rates[0];

  // ---------------------------------------------------------------------------
  // POST /transactions/
  // ---------------------------------------------------------------------------
  let transactionJson: {
    object_id?: string;
    status?: string;
    tracking_number?: string;
    label_url?: string;
    messages?: Array<{ text?: string }>;
  };
  try {
    const resp = await fetch(`${SHIPPO_BASE}/transactions/`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        rate: rate.object_id,
        label_file_type: 'PDF',
        async: false,
      }),
    });
    if (!resp.ok) {
      console.error('[shippo-returns] transactions.create failed', resp.status);
      return { ok: false, error: 'Failed To Purchase Return Label.', status: 502 };
    }
    transactionJson = await resp.json();
  } catch (err) {
    console.error('[shippo-returns] transactions.create network err', err);
    return { ok: false, error: 'Shippo Unreachable.', status: 502 };
  }

  if (transactionJson.status === 'ERROR' || !transactionJson.label_url || !transactionJson.tracking_number) {
    console.error('[shippo-returns] transaction not SUCCESS', transactionJson.status);
    return { ok: false, error: 'Shippo Return Transaction Failed.', status: 502 };
  }

  const trackingNumber = transactionJson.tracking_number;
  const labelUrl = transactionJson.label_url;

  const nowIso = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('rma_requests')
    .update({
      return_tracking_number: trackingNumber,
      return_label_url: labelUrl,
      return_label_purchased_at: nowIso,
      status: 'label_sent',
      updated_at: nowIso,
    })
    .eq('id', rmaId);

  if (updateError) {
    return { ok: false, error: 'Failed To Save Return Label To Request.', status: 500 };
  }

  return { ok: true, trackingNumber, labelUrl };
}

// ---------------------------------------------------------------------------
// Origin resolver — match lib/shippo.resolveOrigin behavior.
// ---------------------------------------------------------------------------

async function resolveAgentOrigin(supabase: SupabaseClient, agentId: string): Promise<ShipFromTo | null> {
  // 1) agent_profiles.warehouse_origin_id (canonical post-M1 path)
  const { data: agentProfile } = await supabase
    .from('agent_profiles')
    .select('display_name, warehouse_origin_id, warehouse_address')
    .eq('id', agentId)
    .maybeSingle();

  if (agentProfile?.warehouse_origin_id) {
    const { data: origin } = await supabase
      .from('shipping_origins')
      .select('name, street1, street2, city, state, zip, country, email')
      .eq('id', agentProfile.warehouse_origin_id)
      .eq('is_active', true)
      .maybeSingle();
    if (origin) {
      return originRowToShipFromTo(origin);
    }
  }

  // 2) Default shipping_origins row
  const { data: def } = await supabase
    .from('shipping_origins')
    .select('name, street1, street2, city, state, zip, country, email')
    .eq('is_default', true)
    .eq('is_active', true)
    .maybeSingle();
  if (def) return originRowToShipFromTo(def);

  // 3) Legacy agent_profiles.warehouse_address JSONB
  const wh = (agentProfile?.warehouse_address ?? null) as Record<string, unknown> | null;
  if (wh && typeof wh === 'object') {
    const street1 = String(wh.street1 ?? wh.street ?? '').trim();
    const city = String(wh.city ?? '').trim();
    const state = String(wh.state ?? '').trim();
    const zip = String(wh.zip ?? wh.zipCode ?? '').trim();
    if (street1 && city && state && zip) {
      return {
        name: String(wh.name ?? agentProfile?.display_name ?? 'Agent Warehouse'),
        street1,
        street2: typeof wh.street2 === 'string' ? wh.street2 : undefined,
        city,
        state,
        zip,
        country: String(wh.country ?? 'US') || 'US',
        email: typeof wh.email === 'string' && wh.email.includes('@') ? wh.email : undefined,
      };
    }
  }

  return null;
}

function originRowToShipFromTo(row: Record<string, unknown>): ShipFromTo {
  return {
    name: typeof row.name === 'string' ? row.name : 'Warehouse',
    street1: String(row.street1 ?? ''),
    street2: typeof row.street2 === 'string' ? row.street2 : undefined,
    city: String(row.city ?? ''),
    state: String(row.state ?? ''),
    zip: String(row.zip ?? ''),
    country: String(row.country ?? 'US') || 'US',
    email: typeof row.email === 'string' && row.email.includes('@') ? row.email : undefined,
  };
}

function toShippoAddress(a: ShipFromTo): Record<string, unknown> {
  return {
    name: a.name,
    street1: a.street1,
    street2: a.street2,
    city: a.city,
    state: a.state,
    zip: a.zip,
    country: a.country,
    email: a.email,
  };
}
