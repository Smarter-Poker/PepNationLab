/**
 * Shippo label purchase — extracted from app/api/agent/shipping/purchase/route.ts
 * so the bulk-admin endpoint can purchase labels for many orders in one call.
 */

import { Shippo } from 'shippo';
import { pickOne } from '@/lib/relations';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface PurchaseLabelOptions {
  orderId: string;
  /**
   * The user (agent) whose Shippo API key + warehouse address should be used.
   * For admin bulk usage, pass the order's `agent_id` here.
   */
  agentId: string;
  preferredServiceLevel?: string | null;
}

export interface PurchaseLabelOk {
  ok: true;
  trackingNumber: string;
  labelUrl: string;
}

export interface PurchaseLabelErr {
  ok: false;
  error: string;
  status: number;
}

export type PurchaseLabelResult = PurchaseLabelOk | PurchaseLabelErr;

export async function purchaseLabelForOrder(
  supabase: SupabaseClient,
  opts: PurchaseLabelOptions,
): Promise<PurchaseLabelResult> {
  const { orderId, agentId, preferredServiceLevel } = opts;

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*, profiles!orders_agent_id_fkey(parent_agent_id), buyer:profiles!orders_buyer_id_fkey(full_name, email)')
    .eq('id', orderId)
    .single();

  if (orderError || !order) return { ok: false, error: 'Order Not Found.', status: 404 };

  const orderAgentProfile = pickOne<{ parent_agent_id: string | null }>(order.profiles);
  if (order.agent_id !== agentId && orderAgentProfile?.parent_agent_id !== agentId) {
    return { ok: false, error: 'Unauthorized To Ship This Order.', status: 403 };
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
      error: 'Shippo API Key Missing. Add Your Shippo API Token In The Storefront Config Tab To Generate Shipping Labels.',
      status: 400,
    };
  }

  const wh = (agentProfile.warehouse_address || {}) as Record<string, any>;
  if (!wh.street1 || !wh.city || !wh.state || !wh.zip) {
    return { ok: false, error: 'Warehouse Address Not Configured.', status: 422 };
  }

  const addr = (order.shipping_address || {}) as Record<string, any>;
  const street = addr.street || addr.street1 || '';
  const city = addr.city || '';
  const state = addr.state || '';
  const zip = addr.zipCode || addr.zip || '';
  const country = addr.country || 'US';

  if (!street || !city || !state || !zip) {
    return { ok: false, error: 'Customer Shipping Address Is Incomplete.', status: 422 };
  }

  const { data: items } = await supabase
    .from('order_items')
    .select('quantity, product_id, products(weight_oz)')
    .eq('order_id', orderId);

  let totalWeightOz = 0;
  let totalQty = 0;
  for (const it of (items || []) as any[]) {
    const qty = Number(it.quantity) || 0;
    const prod = Array.isArray(it.products) ? it.products[0] : it.products;
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
      name: wh.name || agentProfile.display_name || 'Agent Warehouse',
      street1: wh.street1,
      street2: wh.street2 || undefined,
      city: wh.city,
      state: wh.state,
      zip: wh.zip,
      country: 'US',
      email: 'noreply@pepnationlab.com',
    },
    addressTo: {
      name: addr.fullName || (order as any).buyer?.full_name || 'Valued Customer',
      street1: street,
      city,
      state,
      zip,
      country,
      email: (order as any).buyer?.email || 'noreply@pepnationlab.com',
    },
    parcels: [{
      length: parcelDims.length,
      width: parcelDims.width,
      height: parcelDims.height,
      distanceUnit: 'in',
      weight: parcelWeight,
      massUnit: 'oz',
    }],
    async: false,
  };

  let shipment: any;
  try {
    shipment = await shippo.shipments.create(shipmentRequest);
  } catch (err: any) {
    return { ok: false, error: `Shippo Error: Failed To Generate Shipment. ${err?.message || ''}`.trim(), status: 400 };
  }

  if (!shipment.rates || shipment.rates.length === 0) {
    return { ok: false, error: 'No Shipping Rates Returned From Shippo. Verify The Customer Address.', status: 400 };
  }

  const ratesSorted = [...shipment.rates].sort((a: any, b: any) => parseFloat(a.amount) - parseFloat(b.amount));
  let rate: any = ratesSorted[0];
  if (preferredServiceLevel) {
    const preferred = ratesSorted.find((r: any) => r?.servicelevel?.token === preferredServiceLevel);
    if (preferred) rate = preferred;
  }

  let transaction: any;
  try {
    transaction = await shippo.transactions.create({
      rate: rate.objectId,
      labelFileType: 'PDF',
      async: false,
    });
  } catch (err: any) {
    return { ok: false, error: `Shippo Error: Failed To Purchase Label. ${err?.message || ''}`.trim(), status: 400 };
  }

  if (transaction.status === 'ERROR' || !transaction.labelUrl) {
    const msgs = transaction.messages?.map((m: any) => m.text).join('; ') || 'Unknown Error';
    return { ok: false, error: `Shippo Transaction Failed: ${msgs}`, status: 400 };
  }

  const trackingNumber = transaction.trackingNumber as string;
  const labelUrl = transaction.labelUrl as string;

  const { error: updateError } = await supabase
    .from('orders')
    .update({
      tracking_number: trackingNumber,
      label_url: labelUrl,
      status: 'shipped',
      agent_approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (updateError) {
    return { ok: false, error: 'Failed To Save Tracking Information To Order.', status: 500 };
  }

  return { ok: true, trackingNumber, labelUrl };
}
