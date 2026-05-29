/**
 * Return label purchase — used by the RMA workflow when an agent decides to
 * issue a pre-paid return shipping label to the buyer. Modeled after
 * lib/shippo.ts purchaseLabelForOrder but the addressFrom is the BUYER (the
 * person mailing the package back) and addressTo is the agent's warehouse.
 *
 * Writes back to rma_requests:
 *   return_tracking_number TEXT
 *   return_label_url TEXT
 *   return_label_purchased_at TIMESTAMPTZ (ISO 8601, e.g. 2026-05-29T18:30:00.000Z)
 *   status TEXT = 'label_sent'
 *   updated_at TIMESTAMPTZ
 */

import { Shippo } from 'shippo';
import { pickOne } from '@/lib/relations';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface PurchaseReturnLabelOptions {
  rmaId: string;
  /**
   * The agent whose Shippo API key + warehouse address should be used.
   * For super-agent triggered returns, pass the order's `agent_id`.
   */
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

  const { data: agentProfile, error: profileError } = await supabase
    .from('agent_profiles')
    .select('display_name, shippo_api_key, warehouse_address')
    .eq('id', agentId)
    .single();

  if (profileError || !agentProfile) {
    return { ok: false, error: 'Agent Profile Not Found.', status: 404 };
  }

  if (!agentProfile.shippo_api_key) {
    return {
      ok: false,
      error: 'Shippo API Key Missing. Add Your Shippo API Token In The Storefront Config Tab To Generate Return Labels.',
      status: 400,
    };
  }

  const wh = (agentProfile.warehouse_address || {}) as Record<string, any>;
  if (!wh.street1 || !wh.city || !wh.state || !wh.zip) {
    return { ok: false, error: 'Warehouse Return Address Not Configured.', status: 422 };
  }

  const addr = (order.shipping_address || {}) as Record<string, any>;
  const street = addr.street || addr.street1 || '';
  const city = addr.city || '';
  const state = addr.state || '';
  const zip = addr.zipCode || addr.zip || '';
  const country = addr.country || 'US';

  if (!street || !city || !state || !zip) {
    return { ok: false, error: 'Buyer Address Missing For Return Label.', status: 422 };
  }

  const { data: items } = await supabase
    .from('rma_items')
    .select('quantity, order_item_id, order_items(products(weight_oz))')
    .eq('rma_id', rmaId);

  let totalWeightOz = 0;
  let totalQty = 0;
  for (const it of (items || []) as any[]) {
    const qty = Number(it.quantity) || 0;
    const oi = Array.isArray(it.order_items) ? it.order_items[0] : it.order_items;
    const prod = oi && oi.products ? (Array.isArray(oi.products) ? oi.products[0] : oi.products) : null;
    const w = Number(prod?.weight_oz) || 0.5;
    totalWeightOz += qty * w;
    totalQty += qty;
  }
  const parcelWeight = Math.max(1, Math.ceil(totalWeightOz)).toString();

  let parcelDims: { length: string; width: string; height: string };
  if (totalQty <= 3) parcelDims = { length: '6', width: '4', height: '4' };
  else if (totalQty <= 10) parcelDims = { length: '9', width: '6', height: '3' };
  else parcelDims = { length: '12', width: '9', height: '4' };

  const shippo = new Shippo({ apiKeyHeader: agentProfile.shippo_api_key });

  const shipmentRequest: any = {
    addressFrom: {
      name: addr.fullName || (order as any).buyer?.full_name || 'Returning Customer',
      street1: street,
      city,
      state,
      zip,
      country,
      email: (order as any).buyer?.email || 'noreply@pepnationlab.com',
    },
    addressTo: {
      name: wh.name || agentProfile.display_name || 'Agent Warehouse',
      street1: wh.street1,
      street2: wh.street2 || undefined,
      city: wh.city,
      state: wh.state,
      zip: wh.zip,
      country: 'US',
      email: 'noreply@pepnationlab.com',
    },
    parcels: [{
      length: parcelDims.length,
      width: parcelDims.width,
      height: parcelDims.height,
      distanceUnit: 'in',
      weight: parcelWeight,
      massUnit: 'oz',
    }],
    extra: { isReturn: true },
    async: false,
  };

  let shipment: any;
  try {
    shipment = await shippo.shipments.create(shipmentRequest);
  } catch (err: any) {
    return { ok: false, error: `Shippo Error: Failed To Generate Return Shipment. ${err?.message || ''}`.trim(), status: 400 };
  }

  if (!shipment.rates || shipment.rates.length === 0) {
    return { ok: false, error: 'No Return Shipping Rates Returned From Shippo.', status: 400 };
  }

  const ratesSorted = [...shipment.rates].sort((a: any, b: any) => parseFloat(a.amount) - parseFloat(b.amount));
  const rate: any = ratesSorted[0];

  let transaction: any;
  try {
    transaction = await shippo.transactions.create({
      rate: rate.objectId,
      labelFileType: 'PDF',
      async: false,
    });
  } catch (err: any) {
    return { ok: false, error: `Shippo Error: Failed To Purchase Return Label. ${err?.message || ''}`.trim(), status: 400 };
  }

  if (transaction.status === 'ERROR' || !transaction.labelUrl) {
    const msgs = transaction.messages?.map((m: any) => m.text).join('; ') || 'Unknown Error';
    return { ok: false, error: `Shippo Transaction Failed: ${msgs}`, status: 400 };
  }

  const trackingNumber = transaction.trackingNumber as string;
  const labelUrl = transaction.labelUrl as string;

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
