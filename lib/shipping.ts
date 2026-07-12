/**
 * lib/shipping.ts - EasyPost platform integration
 *
 * Replaces the retired Shippo module. Every EasyPost call resolves a single
 * platform-account API key (from the `shipping_provider_credentials` active
 * row OR the EASYPOST_API_KEY / EASYPOST_TEST_KEY env var bootstrap fallback)
 * and writes an append-only audit row in `shipping_label_purchases`.
 *
 * The legacy weight-based checkout cost helpers that used to live in this file
 * moved to lib/shipping-cost.ts (pure, client-safe). This module is
 * server-only.
 *
 * Back-compat: `purchaseLabelForOrder(supabase, opts)` is preserved with the
 * same input/output shape so `app/api/admin/orders/bulk/route.ts` keeps
 * working without an edit. Internally it routes through `buyLabel` and writes
 * the bookkeeping columns on `orders`.
 *
 * Public surface:
 *   getActiveKey(agentId?)        - resolve {token, mode, source}
 *   validateAddress(addr)         - POST /addresses with verify:['delivery']
 *   quoteRates(input)             - POST /shipments, filtered/sorted rates
 *   buyLabel(input)               - POST /shipments/:id/buy, idempotent on order_id
 *   refundLabel(shipmentId)       - POST /shipments/:id/refund
 *   subscribeTracking(tracking, carrier) - POST /trackers
 *   getTracking(tracking, carrier)       - GET  /trackers?tracking_code=...
 *   purchaseLabelForOrder(...)    - back-compat shim used by admin bulk route
 *
 * Environment:
 *   EASYPOST_API_KEY          - production key (EZAK...)
 *   EASYPOST_TEST_KEY         - test key       (EZTK...)
 *   SHIPPING_ENCRYPTION_KEY   - base64 32-byte AES-256-GCM key (lib/shipping-crypto)
 *   NEXT_PUBLIC_SHIPPING_MODE - 'test' | 'live' (UI badge + env key selection)
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY - used for the lib-internal admin
 *     client that writes the audit ledger row.
 *
 * Notes:
 *   - The audit ledger row is written via a service-role Supabase client
 *     created inside this module. RLS forbids any other writer.
 *   - Address normalisation handles both legacy JSONB shapes
 *     (`street`/`zipCode` and `street1`/`zip`).
 *   - Cheapest-rate selection filters to allowlisted carriers; no regional
 *     sub-carriers.
 *   - EasyPost parcels take numeric inches and OUNCES; auth is HTTP Basic with
 *     the API key as username and an empty password.
 *   - The refund / reprint key is the EasyPost SHIPMENT id (shp_...), stored
 *     in shipping_label_purchases.provider_transaction_id.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { pickOne } from '@/lib/relations';
import { decryptSecret } from '@/lib/shipping-crypto';
import { canTransition, type OrderStatus } from '@/lib/order-states';
import { getSupabaseUrl } from '@/lib/supabase/url';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EASYPOST_BASE = 'https://api.easypost.com/v2';
const ALLOWED_CARRIERS = new Set([
  'usps',
  'ups',
  'upsdap',
  'fedex',
  'fedexdefault',
  'dhlexpress',
  'dhl_express',
]);
const SHIPPING_USER_AGENT = 'PepNationLab/1.0';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ShippingMode = 'test' | 'live';

export interface ActiveKey {
  /** Plaintext API key used as the HTTP Basic username. */
  token: string;
  /** 'test' or 'live' - inferred from the key prefix (EZTK vs EZAK). */
  mode: ShippingMode;
  /** Source of truth - admin DB row or env bootstrap. */
  source: 'platform_db' | 'env';
}

export interface AddressInput {
  name?: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
  phone?: string;
  email?: string;
  isResidential?: boolean;
}

export interface AddressValidationResult {
  isValid: boolean;
  isResidential?: boolean;
  messages: { code?: string; type?: string; text: string }[];
  /** Cleaned address suggested by the carrier verification. */
  suggestion?: AddressInput;
  providerAddressId?: string;
}

export interface ParcelInput {
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  weightOz: number;
  template?: string;
}

export interface RateOption {
  rateId: string;
  shipmentId: string;
  carrier: string;
  serviceLevelToken: string;
  serviceLevelName: string;
  amountCents: number;
  currency: string;
  estimatedDays?: number;
  arrivesBy?: string;
  attributes: string[];
}

export interface QuoteResult {
  rates: RateOption[];
  shipmentId: string;
  mode: ShippingMode;
}

export interface BuyLabelInput {
  orderId: string;
  agentId: string;
  /** Optional preferred carrier service level (e.g., `Priority`). */
  preferredServiceLevel?: string | null;
  /** Optional explicit origin override (admin path); else resolved from agent profile. */
  originId?: string | null;
  /** Optional label file type (`PDF`, `PDF_4x6`, `PNG`, `ZPL_203`). */
  labelFileType?: 'PDF' | 'PDF_4x6' | 'PNG' | 'ZPL_203';
  /** Optional label_jobs.id FK - set by the cron so webhook can update ledger row. */
  labelJobId?: string | null;
}

export interface BuyLabelOk {
  ok: true;
  trackingNumber: string;
  labelUrl: string;
  /** EasyPost shipment id (shp_...) - the refund / reprint key. */
  providerTransactionId: string;
  carrier: string;
  serviceLevel: string;
  labelCostCents: number;
  parcelWeightOz: number;
  mode: ShippingMode;
  /** True if this returns an existing label rather than a new purchase. */
  idempotent: boolean;
}

export interface BuyLabelErr {
  ok: false;
  error: string;
  status: number;
  /** Optional machine code so callers can branch (e.g. RATE_NONE, KEY_MISSING). */
  code?: string;
}

export type BuyLabelResult = BuyLabelOk | BuyLabelErr;

export interface RefundResult {
  ok: boolean;
  status?: 'QUEUED' | 'PENDING' | 'SUCCESS' | 'ERROR';
  providerRefundId?: string;
  error?: string;
}

export interface TrackingState {
  status: string;
  substatus?: string;
  statusDetails?: string;
  occurredAt: string;
  location?: Record<string, unknown>;
  carrier: string;
  trackingNumber: string;
}

// ---------------------------------------------------------------------------
// Lib-internal service-role client (writes the audit ledger)
// ---------------------------------------------------------------------------

let cachedAdmin: SupabaseClient | null = null;
function getAdminClient(): SupabaseClient {
  if (cachedAdmin) return cachedAdmin;
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Shipping audit writer requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.',
    );
  }
  cachedAdmin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedAdmin;
}

// ---------------------------------------------------------------------------
// Key resolver
// ---------------------------------------------------------------------------

/**
 * Resolve the active EasyPost API key in priority order:
 *   1. Active row in `shipping_provider_credentials` (admin-connected).
 *   2. Env bootstrap: NEXT_PUBLIC_SHIPPING_MODE picks EASYPOST_API_KEY (live)
 *      vs EASYPOST_TEST_KEY (test), falling back to whichever exists.
 *
 * Mode is inferred from the key prefix: `EZAK...` -> 'live', `EZTK...` -> 'test'.
 *
 * The `agentId` parameter is accepted for call-site compatibility but unused -
 * the legacy per-agent key path was removed with the provider swap.
 *
 * Throws if no key can be found at all (caller handles as 503).
 */
export async function getActiveKey(agentId?: string): Promise<ActiveKey> {
  void agentId; // per-agent keys no longer exist; parameter kept for API parity

  // 1) Active platform DB row
  try {
    const admin = getAdminClient();
    const { data: row } = await admin
      .from('shipping_provider_credentials')
      .select('mode, api_key_ciphertext, api_key_iv, api_key_tag')
      .eq('is_active', true)
      .maybeSingle();
    if (row && row.api_key_ciphertext && row.api_key_iv && row.api_key_tag) {
      const plaintext = decryptSecret({
        ciphertext: row.api_key_ciphertext as Buffer,
        iv: row.api_key_iv as Buffer,
        tag: row.api_key_tag as Buffer,
      });
      return {
        token: plaintext,
        mode: (row.mode as ShippingMode) ?? inferMode(plaintext),
        source: 'platform_db',
      };
    }
  } catch (err) {
    console.warn('[shipping] shipping_provider_credentials lookup failed; falling through:', err);
  }

  // 2) Env var bootstrap (covers the pre-admin-UI gap and dev)
  const envLive = process.env.EASYPOST_API_KEY?.trim();
  const envTest = process.env.EASYPOST_TEST_KEY?.trim();
  const envToken =
    process.env.NEXT_PUBLIC_SHIPPING_MODE === 'live'
      ? envLive || envTest
      : envTest || envLive;
  if (envToken) {
    return {
      token: envToken,
      mode: inferMode(envToken),
      source: 'env',
    };
  }

  throw new Error('No active EasyPost credentials. Connect EasyPost in the admin settings or set EASYPOST_API_KEY.');
}

export function inferMode(token: string): ShippingMode {
  return token.startsWith('EZAK') ? 'live' : 'test';
}

// ---------------------------------------------------------------------------
// HTTP layer
// ---------------------------------------------------------------------------

interface CallOpts {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  key: ActiveKey;
  query?: Record<string, string | undefined>;
}

async function callEasyPost<T = unknown>(opts: CallOpts): Promise<{
  ok: true;
  data: T;
} | { ok: false; status: number; error: string; raw?: unknown }> {
  const url = new URL(EASYPOST_BASE + opts.path);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    // EasyPost auth: HTTP Basic with the API key as username, empty password.
    Authorization: 'Basic ' + Buffer.from(`${opts.key.token}:`).toString('base64'),
    'User-Agent': SHIPPING_USER_AGENT,
    Accept: 'application/json',
  };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  // Non-idempotent money calls (label buy, refund) must not be blind-retried
  // on a NETWORK failure: the request may have been processed even though the
  // response was lost, and a retry can buy a second label. HTTP 429/5xx
  // retries are safe (the server told us it did not process the request... at
  // least for 429; 5xx on buy is accepted as EasyPost marks the shipment).
  const isMutation = opts.method !== 'GET';
  const maxAttempts = 3;

  let lastError = '';
  let lastStatus = 0;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const init: RequestInit = {
      method: opts.method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      // A hung EasyPost socket previously blocked the serverless function
      // until the platform timeout (and could then be retried up to 3x).
      signal: AbortSignal.timeout(10_000),
    };
    let resp: Response;
    try {
      resp = await fetch(url.toString(), init);
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'network error';
      lastStatus = 0;
      if (isMutation) {
        // Fail fast to the caller -- the outcome is unknown and retrying a
        // POST (e.g. /shipments/:id/buy) risks double-purchasing.
        return { ok: false, status: 0, error: `EasyPost network failure (not retried on ${opts.method}): ${lastError}` };
      }
      await sleep(backoffMs(attempt));
      continue;
    }
    lastStatus = resp.status;

    if (resp.status >= 200 && resp.status < 300) {
      const json = (await resp.json().catch(() => null)) as T | null;
      return { ok: true, data: (json as T) ?? ({} as T) };
    }

    if (resp.status === 429 || (resp.status >= 500 && resp.status < 600)) {
      const text = await resp.text().catch(() => '');
      lastError = `EasyPost ${resp.status}: ${text.slice(0, 200)}`;
      await sleep(backoffMs(attempt));
      continue;
    }

    let parsed: unknown = null;
    try {
      parsed = await resp.json();
    } catch {
      parsed = await resp.text().catch(() => '');
    }
    return {
      ok: false,
      status: resp.status,
      error: extractEasyPostMessage(parsed) || `EasyPost ${resp.status}`,
      raw: parsed,
    };
  }
  return { ok: false, status: lastStatus, error: lastError || 'EasyPost unreachable' };
}

function backoffMs(attempt: number): number {
  return Math.round(250 * Math.pow(2, attempt) + Math.random() * 100);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** EasyPost error body shape: {error: {code, message, errors: [...]}}. */
function extractEasyPostMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const p = payload as Record<string, unknown>;
  const err = p.error;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof e.message === 'string' && e.message) parts.push(e.message);
    if (Array.isArray(e.errors)) {
      for (const sub of e.errors) {
        if (sub && typeof sub === 'object') {
          const s = sub as Record<string, unknown>;
          const field = typeof s.field === 'string' ? s.field : '';
          const msg = typeof s.message === 'string' ? s.message : '';
          if (msg) parts.push(field ? `${field}: ${msg}` : msg);
        }
      }
    }
    if (parts.length > 0) return parts.join('; ');
  }
  return '';
}

// ---------------------------------------------------------------------------
// Address validation
// ---------------------------------------------------------------------------

export async function validateAddress(addr: AddressInput): Promise<AddressValidationResult> {
  const key = await getActiveKey();
  const body = {
    address: {
      name: addr.name,
      company: addr.company,
      street1: addr.street1,
      street2: addr.street2,
      city: addr.city,
      state: addr.state,
      zip: addr.zip,
      country: addr.country || 'US',
      phone: addr.phone,
      email: addr.email,
    },
    verify: ['delivery'],
  };
  const resp = await callEasyPost<{
    id?: string;
    residential?: boolean | null;
    verifications?: {
      delivery?: {
        success?: boolean;
        errors?: { code?: string; message?: string; field?: string }[];
      };
    };
    name?: string; company?: string; street1?: string; street2?: string;
    city?: string; state?: string; zip?: string; country?: string;
  }>({ method: 'POST', path: '/addresses', body, key });

  if (!resp.ok) {
    return {
      isValid: false,
      messages: [{ text: resp.error }],
    };
  }
  const delivery = resp.data.verifications?.delivery || {};
  const messages = (delivery.errors || []).map((m) => ({
    code: m.code,
    type: m.field,
    text: m.message || '',
  }));
  const result: AddressValidationResult = {
    isValid: !!delivery.success,
    isResidential: resp.data.residential ?? undefined,
    messages,
    providerAddressId: resp.data.id,
  };
  if (delivery.success && resp.data.street1) {
    result.suggestion = {
      name: resp.data.name,
      company: resp.data.company,
      street1: resp.data.street1,
      street2: resp.data.street2,
      city: resp.data.city || addr.city,
      state: resp.data.state || addr.state,
      zip: resp.data.zip || addr.zip,
      country: resp.data.country || addr.country || 'US',
    };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Rate quoting
// ---------------------------------------------------------------------------

interface EasyPostRate {
  id: string;
  carrier?: string;
  service?: string;
  rate?: string;
  currency?: string;
  delivery_days?: number | null;
  est_delivery_days?: number | null;
}

interface EasyPostShipment {
  id?: string;
  mode?: string;
  rates?: EasyPostRate[];
  messages?: Array<{ carrier?: string; type?: string; message?: string }>;
}

export async function quoteRates(input: {
  from: AddressInput;
  to: AddressInput;
  parcel: ParcelInput;
  /** Accepted for call-site compatibility; EasyPost shipment creation is synchronous. */
  async?: boolean;
  /** EasyPost label format set at shipment creation ('PDF' | 'PNG' | 'ZPL'). */
  labelFormat?: 'PDF' | 'PNG' | 'ZPL';
}): Promise<{ ok: true; result: QuoteResult } | { ok: false; status: number; error: string }> {
  const key = await getActiveKey();
  const resp = await callEasyPost<EasyPostShipment>({
    method: 'POST',
    path: '/shipments',
    body: {
      shipment: {
        from_address: toEasyPostAddress(input.from),
        to_address: toEasyPostAddress(input.to),
        parcel: toEasyPostParcel(input.parcel),
        options: { label_format: input.labelFormat || 'PDF' },
      },
    },
    key,
  });

  if (!resp.ok) {
    return { ok: false, status: resp.status, error: resp.error };
  }
  const shipmentId = resp.data.id || '';
  const rates = (resp.data.rates || [])
    .filter((r) => r.carrier && ALLOWED_CARRIERS.has(r.carrier.toLowerCase()))
    .map<RateOption>((r) => ({
      rateId: r.id,
      shipmentId,
      carrier: r.carrier || '',
      serviceLevelToken: r.service || '',
      serviceLevelName: [r.carrier, r.service].filter(Boolean).join(' '),
      amountCents: Math.round(parseFloat(r.rate || '0') * 100),
      currency: r.currency || 'USD',
      estimatedDays: r.delivery_days ?? r.est_delivery_days ?? undefined,
      arrivesBy: undefined,
      attributes: [],
    }))
    .filter((r) => r.amountCents > 0)
    .sort((a, b) => a.amountCents - b.amountCents);

  return {
    ok: true,
    result: {
      rates,
      shipmentId,
      mode: key.mode,
    },
  };
}

function toEasyPostAddress(a: AddressInput): Record<string, unknown> {
  return {
    name: a.name,
    company: a.company,
    street1: a.street1,
    street2: a.street2,
    city: a.city,
    state: a.state,
    zip: a.zip,
    country: a.country || 'US',
    phone: a.phone,
    email: a.email,
  };
}

function toEasyPostParcel(p: ParcelInput): Record<string, unknown> {
  // EasyPost parcels: numbers, dimensions in inches, weight in OUNCES.
  return {
    length: p.lengthIn,
    width: p.widthIn,
    height: p.heightIn,
    weight: p.weightOz,
  };
}

/** Map the app's requested label file type onto EasyPost's label_format option. */
function toEasyPostLabelFormat(t: BuyLabelInput['labelFileType']): 'PDF' | 'PNG' | 'ZPL' {
  if (t === 'PNG') return 'PNG';
  if (t === 'ZPL_203') return 'ZPL';
  return 'PDF'; // 'PDF' and 'PDF_4x6' both map to PDF
}

// ---------------------------------------------------------------------------
// Label purchase
// ---------------------------------------------------------------------------

interface ResolvedShipmentContext {
  origin: { id: string; address: AddressInput };
  to: AddressInput;
  parcel: ParcelInput;
  order: {
    id: string;
    agentId: string;
    status: OrderStatus;
  };
}

export async function buyLabel(input: BuyLabelInput): Promise<BuyLabelResult> {
  const admin = getAdminClient();

  // Idempotency: existing label?
  const { data: existing } = await admin
    .from('shipping_label_purchases')
    .select('provider_transaction_id, tracking_number, label_url, carrier, service_level, label_cost_cents, parcel_weight_oz, mode')
    .eq('order_id', input.orderId)
    .eq('refunded', false)
    .maybeSingle();
  if (existing) {
    return {
      ok: true,
      providerTransactionId: existing.provider_transaction_id,
      trackingNumber: existing.tracking_number,
      labelUrl: existing.label_url,
      carrier: existing.carrier,
      serviceLevel: existing.service_level,
      labelCostCents: existing.label_cost_cents,
      parcelWeightOz: Number(existing.parcel_weight_oz),
      mode: existing.mode as ShippingMode,
      idempotent: true,
    };
  }

  const ctx = await resolveShipmentContext(admin, input);
  if ('ok' in ctx && ctx.ok === false) return ctx;
  const resolved = ctx as ResolvedShipmentContext;

  const quote = await quoteRates({
    from: resolved.origin.address,
    to: resolved.to,
    parcel: resolved.parcel,
    labelFormat: toEasyPostLabelFormat(input.labelFileType),
  });
  if (!quote.ok) {
    return { ok: false, status: quote.status || 502, error: quote.error, code: 'RATE_QUOTE_FAILED' };
  }
  if (quote.result.rates.length === 0) {
    return { ok: false, status: 422, error: 'No carriers returned a rate for this address.', code: 'RATE_NONE' };
  }

  let chosen = quote.result.rates[0];
  if (input.preferredServiceLevel) {
    const preferred = quote.result.rates.find((r) => r.serviceLevelToken === input.preferredServiceLevel);
    if (preferred) chosen = preferred;
  }

  const key = await getActiveKey(input.agentId);
  const buyResp = await callEasyPost<{
    id?: string;
    tracking_code?: string;
    postage_label?: { label_url?: string; label_file_type?: string };
    tracker?: { id?: string; public_url?: string };
    selected_rate?: { rate?: string };
    refund_status?: string | null;
    messages?: Array<{ message?: string }>;
  }>({
    method: 'POST',
    path: `/shipments/${encodeURIComponent(chosen.shipmentId)}/buy`,
    body: { rate: { id: chosen.rateId } },
    key,
  });

  if (!buyResp.ok) {
    return { ok: false, status: buyResp.status, error: buyResp.error, code: 'TRANSACTION_FAILED' };
  }
  if (!buyResp.data.postage_label?.label_url || !buyResp.data.tracking_code || !buyResp.data.id) {
    const msg = extractEasyPostMessage(buyResp.data) || 'EasyPost label purchase failed';
    return { ok: false, status: 502, error: msg, code: 'TRANSACTION_ERROR' };
  }

  // The shipment id is the refund / reprint key - store it as the transaction id.
  const providerTransactionId = buyResp.data.id;
  const trackingNumber = buyResp.data.tracking_code;
  const labelUrl = buyResp.data.postage_label.label_url;
  const selectedRateStr = buyResp.data.selected_rate?.rate;
  const labelCostCents = selectedRateStr
    ? Math.round(parseFloat(selectedRateStr) * 100)
    : chosen.amountCents;

  const { error: ledgerErr } = await admin.from('shipping_label_purchases').insert({
    order_id: input.orderId,
    agent_id: input.agentId,
    origin_id: resolved.origin.id,
    provider: 'easypost',
    provider_transaction_id: providerTransactionId,
    provider_rate_id: chosen.rateId,
    provider_shipment_id: chosen.shipmentId,
    carrier: chosen.carrier,
    service_level: chosen.serviceLevelToken,
    tracking_number: trackingNumber,
    tracking_url_provider: buyResp.data.tracker?.public_url || null,
    label_url: labelUrl,
    label_file_type: input.labelFileType || 'PDF_4x6',
    label_cost_cents: labelCostCents,
    agent_charged_cents: labelCostCents,
    parcel_weight_oz: resolved.parcel.weightOz,
    parcel_template: resolved.parcel.template || null,
    paid_by: 'platform',
    mode: key.mode,
    label_job_id: input.labelJobId ?? null,
  });
  if (ledgerErr) {
    return {
      ok: false,
      status: 500,
      error: `Label purchased but ledger write failed: ${ledgerErr.message}`,
      code: 'LEDGER_WRITE_FAILED',
    };
  }

  const didTransition = canTransition(resolved.order.status, 'shipped', 'admin');
  const nextStatus: OrderStatus = didTransition ? 'shipped' : resolved.order.status;
  // Only stamp shipped_at when we actually moved the order to 'shipped'.
  // Otherwise we'd write a ship timestamp on an order still in
  // approved_ship / approved_pickup / cancelled, which contradicts the
  // state-machine and breaks reconciliation variance reports.
  const orderUpdate: Record<string, unknown> = {
    tracking_number: trackingNumber,
    label_url: labelUrl,
    carrier: chosen.carrier,
    service_level: chosen.serviceLevelToken,
    label_cost_cents: labelCostCents,
    agent_charged_cents: labelCostCents,
    shipping_paid_by: 'platform',
    shipping_origin_id: resolved.origin.id,
    status: nextStatus,
    updated_at: new Date().toISOString(),
  };
  if (didTransition) {
    orderUpdate.shipped_at = new Date().toISOString();
  }
  const { error: updErr } = await admin
    .from('orders')
    .update(orderUpdate)
    .eq('id', input.orderId);

  if (updErr) {
    return {
      ok: false,
      status: 500,
      error: `Label purchased and ledger written but order update failed: ${updErr.message}`,
      code: 'ORDER_UPDATE_FAILED',
    };
  }

  return {
    ok: true,
    providerTransactionId,
    trackingNumber,
    labelUrl,
    carrier: chosen.carrier,
    serviceLevel: chosen.serviceLevelToken,
    labelCostCents,
    parcelWeightOz: resolved.parcel.weightOz,
    mode: key.mode,
    idempotent: false,
  };
}

// ---------------------------------------------------------------------------
// Shipment context resolution
// ---------------------------------------------------------------------------

async function resolveShipmentContext(
  admin: SupabaseClient,
  input: BuyLabelInput,
): Promise<ResolvedShipmentContext | BuyLabelErr> {
  const { data: order, error: orderErr } = await admin
    .from('orders')
    .select('id, agent_id, status, shipping_address, profiles!orders_agent_id_fkey(parent_agent_id), buyer:profiles!orders_buyer_id_fkey(full_name, email)')
    .eq('id', input.orderId)
    .maybeSingle();
  if (orderErr || !order) {
    return { ok: false, status: 404, error: 'Order not found.', code: 'ORDER_NOT_FOUND' };
  }
  const orderAgent = pickOne<{ parent_agent_id: string | null }>(order.profiles);
  if (order.agent_id !== input.agentId && orderAgent?.parent_agent_id !== input.agentId) {
    return { ok: false, status: 403, error: 'Unauthorized to ship this order.', code: 'NOT_AGENT_OWNER' };
  }

  const to = normalizeShippingAddress(
    order.shipping_address,
    pickOne<{ full_name?: string | null; email?: string | null }>(order.buyer) ?? undefined,
  );
  if (!to) {
    return { ok: false, status: 422, error: 'Customer shipping address is incomplete.', code: 'TO_INCOMPLETE' };
  }

  const origin = await resolveOrigin(admin, input.agentId, input.originId ?? null);
  if (!origin) {
    return {
      ok: false,
      status: 422,
      error: 'No ship-from origin configured. Add a warehouse in admin -> Settings -> Shipping.',
      code: 'ORIGIN_MISSING',
    };
  }

  type WeightRow = { weight_oz?: number | null };
  type ItemRow = { quantity: number; products: WeightRow | WeightRow[] | null };
  const { data: items } = await admin
    .from('order_items')
    .select('quantity, products(weight_oz)')
    .eq('order_id', input.orderId);
  let totalWeightOz = 0;
  let totalQty = 0;
  for (const it of (items || []) as ItemRow[]) {
    const qty = Number(it.quantity) || 0;
    const prod = pickOne<WeightRow>(it.products);
    const w = Number(prod?.weight_oz) || 4;
    totalWeightOz += qty * w;
    totalQty += qty;
  }
  const weightOz = Math.max(1, Math.round(totalWeightOz));
  let lengthIn = 6, widthIn = 4, heightIn = 4, template: string | undefined = 'small';
  if (totalQty > 3 && totalQty <= 10) {
    lengthIn = 9; widthIn = 6; heightIn = 3; template = 'medium';
  } else if (totalQty > 10) {
    lengthIn = 12; widthIn = 9; heightIn = 4; template = 'large';
  }

  return {
    origin: { id: origin.id, address: origin.address },
    to,
    parcel: { lengthIn, widthIn, heightIn, weightOz, template },
    order: { id: order.id, agentId: order.agent_id, status: order.status as OrderStatus },
  };
}

interface ResolvedOrigin {
  id: string;
  address: AddressInput;
}

async function resolveOrigin(
  admin: SupabaseClient,
  agentId: string,
  override: string | null,
): Promise<ResolvedOrigin | null> {
  if (override) {
    const { data } = await admin
      .from('shipping_origins')
      .select('id, name, company, street1, street2, city, state, zip, country, phone, email')
      .eq('id', override)
      .eq('is_active', true)
      .maybeSingle();
    if (data) return { id: data.id, address: data as AddressInput };
  }

  const { data: agentProfile } = await admin
    .from('agent_profiles')
    .select('display_name, warehouse_origin_id, warehouse_address')
    .eq('id', agentId)
    .maybeSingle();
  if (agentProfile?.warehouse_origin_id) {
    const { data } = await admin
      .from('shipping_origins')
      .select('id, name, company, street1, street2, city, state, zip, country, phone, email')
      .eq('id', agentProfile.warehouse_origin_id)
      .eq('is_active', true)
      .maybeSingle();
    if (data) return { id: data.id, address: data as AddressInput };
  }

  const { data: def } = await admin
    .from('shipping_origins')
    .select('id, name, company, street1, street2, city, state, zip, country, phone, email')
    .eq('is_default', true)
    .eq('is_active', true)
    .maybeSingle();
  if (def) return { id: def.id, address: def as AddressInput };

  // Legacy JSONB warehouse - auto-migrate into a shipping_origins row so the FK is satisfied.
  const wh = (agentProfile?.warehouse_address || null) as Record<string, unknown> | null;
  if (wh && typeof wh === 'object') {
    const street1 = String(wh.street1 || wh.street || '').trim();
    const city = String(wh.city || '').trim();
    const state = String(wh.state || '').trim();
    const zip = String(wh.zip || wh.zipCode || '').trim();
    if (street1 && city && state && zip) {
      const insert = {
        label: `Agent ${agentId.slice(0, 8)} legacy`,
        name: String(wh.name || agentProfile?.display_name || 'Agent Warehouse'),
        company: (wh.company as string | undefined) || null,
        street1,
        street2: (wh.street2 as string | undefined) || null,
        city,
        state,
        zip,
        country: String(wh.country || 'US'),
        phone: String(wh.phone || '0000000000'),
        email: String(wh.email || 'support@pepnationlab.com'),
        is_default: false,
        is_active: true,
      };
      const { data: created } = await admin
        .from('shipping_origins')
        .insert(insert)
        .select('id, name, company, street1, street2, city, state, zip, country, phone, email')
        .maybeSingle();
      if (created) {
        await admin
          .from('agent_profiles')
          .update({ warehouse_origin_id: created.id })
          .eq('id', agentId);
        return { id: created.id, address: created as AddressInput };
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Address normalisation (handles legacy + current checkout shapes)
// ---------------------------------------------------------------------------

export function normalizeShippingAddress(
  raw: unknown,
  buyer?: { full_name?: string | null; email?: string | null },
): AddressInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  const street1 = String(a.street1 || a.street || '').trim();
  const city = String(a.city || '').trim();
  const state = String(a.state || '').trim();
  const zip = String(a.zip || a.zipCode || '').trim();
  if (!street1 || !city || !state || !zip) return null;
  return {
    name: String(a.fullName || a.name || buyer?.full_name || '') || undefined,
    company: (a.company as string | undefined) || undefined,
    street1,
    street2: (a.street2 as string | undefined) || undefined,
    city,
    state,
    zip,
    country: String(a.country || 'US'),
    phone: (a.phone as string | undefined) || undefined,
    email: (buyer?.email && buyer.email.includes('@')) ? buyer.email : undefined,
  };
}

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

/**
 * Request a refund for a purchased label. `providerTransactionId` is the
 * EasyPost shipment id (shp_...) stored at purchase time.
 *
 * EasyPost refund_status mapping keeps the existing status vocabulary:
 *   submitted -> QUEUED, refunded -> SUCCESS, rejected -> ERROR.
 */
export async function refundLabel(providerTransactionId: string): Promise<RefundResult> {
  if (!providerTransactionId) return { ok: false, error: 'Missing transaction id' };
  const key = await getActiveKey();
  const resp = await callEasyPost<{
    id?: string;
    refund_status?: string | null;
  }>({
    method: 'POST',
    path: `/shipments/${encodeURIComponent(providerTransactionId)}/refund`,
    key,
  });
  if (!resp.ok) return { ok: false, error: resp.error };
  return {
    ok: true,
    status: mapRefundStatus(resp.data.refund_status),
    providerRefundId: resp.data.id,
  };
}

function mapRefundStatus(s: string | null | undefined): RefundResult['status'] {
  switch ((s || '').toLowerCase()) {
    case 'refunded':
      return 'SUCCESS';
    case 'rejected':
      return 'ERROR';
    case 'submitted':
    default:
      return 'QUEUED';
  }
}

// ---------------------------------------------------------------------------
// Tracking
// ---------------------------------------------------------------------------

export async function subscribeTracking(trackingNumber: string, carrier: string): Promise<{ ok: boolean; error?: string }> {
  if (!trackingNumber || !carrier) return { ok: false, error: 'Missing tracking_number or carrier' };
  const key = await getActiveKey();
  const resp = await callEasyPost({
    method: 'POST',
    path: '/trackers',
    body: { tracker: { tracking_code: trackingNumber, carrier } },
    key,
  });
  if (!resp.ok) return { ok: false, error: resp.error };
  return { ok: true };
}

interface EasyPostTrackingDetail {
  status?: string;
  status_detail?: string;
  message?: string;
  datetime?: string;
  tracking_location?: Record<string, unknown>;
}

interface EasyPostTracker {
  id?: string;
  status?: string;
  status_detail?: string;
  est_delivery_date?: string | null;
  carrier?: string;
  tracking_code?: string;
  tracking_details?: EasyPostTrackingDetail[];
}

export async function getTracking(trackingNumber: string, carrier: string): Promise<TrackingState | null> {
  if (!trackingNumber || !carrier) return null;
  const key = await getActiveKey();
  const resp = await callEasyPost<{ trackers?: EasyPostTracker[] }>({
    method: 'GET',
    path: '/trackers',
    query: { tracking_code: trackingNumber, carrier },
    key,
  });
  if (!resp.ok) return null;
  const tracker = (resp.data.trackers || [])[0];
  if (!tracker || !tracker.status) return null;

  const details = tracker.tracking_details || [];
  let newest: EasyPostTrackingDetail | null = null;
  for (const d of details) {
    if (!newest || String(d.datetime || '') >= String(newest.datetime || '')) newest = d;
  }

  return {
    status: tracker.status.toUpperCase(),
    substatus: tracker.status_detail || undefined,
    statusDetails: newest?.message || undefined,
    occurredAt: newest?.datetime || new Date().toISOString(),
    location: newest?.tracking_location,
    carrier: tracker.carrier || carrier,
    trackingNumber: tracker.tracking_code || trackingNumber,
  };
}

// ---------------------------------------------------------------------------
// Checkout-time live rate helper
// ---------------------------------------------------------------------------

/**
 * Checkout-time live rate helper. Resolves the agent's ship-from origin (or the
 * platform default origin when no agent is given) and asks EasyPost for the
 * cheapest allowed carrier rate to `to`.
 *
 * Non-throwing by contract: returns null on missing origin, no rates, an
 * EasyPost error, or timeout, so the caller can fall back to the flat
 * estimate. Hard-bounded by `timeoutMs` (default 4.5s) via Promise.race so a
 * slow or hung carrier API can never stall the checkout request.
 */
export async function quoteCheapestForCheckout(input: {
  agentId?: string | null;
  to: AddressInput;
  weightOz: number;
  totalQty: number;
  timeoutMs?: number;
}): Promise<{ amountCents: number; carrier: string; serviceLevel: string; serviceLevelName: string } | null> {
  const timeoutMs = input.timeoutMs ?? 4500;
  const run = (async () => {
    try {
      const admin = getAdminClient();

      // Resolve the ship-from origin. With an agentId, use that agent's
      // warehouse (falling through to the platform default inside
      // resolveOrigin). Without one (house/no-agent checkout), read the
      // platform default origin directly so we never issue an `id = ''`
      // query against the uuid column.
      let origin: ResolvedOrigin | null = null;
      if (input.agentId) {
        origin = await resolveOrigin(admin, input.agentId, null);
      } else {
        const { data: def } = await admin
          .from('shipping_origins')
          .select('id, name, company, street1, street2, city, state, zip, country, phone, email')
          .eq('is_default', true)
          .eq('is_active', true)
          .maybeSingle();
        if (def) origin = { id: def.id, address: def as AddressInput };
      }
      if (!origin) return null;

      const weightOz = Math.max(1, Math.round(Number(input.weightOz) || 0));
      let lengthIn = 6, widthIn = 4, heightIn = 4, template: string | undefined = 'small';
      const qty = Number(input.totalQty) || 0;
      if (qty > 3 && qty <= 10) {
        lengthIn = 9; widthIn = 6; heightIn = 3; template = 'medium';
      } else if (qty > 10) {
        lengthIn = 12; widthIn = 9; heightIn = 4; template = 'large';
      }

      const quote = await quoteRates({
        from: origin.address,
        to: input.to,
        parcel: { lengthIn, widthIn, heightIn, weightOz, template },
      });
      if (!quote.ok || quote.result.rates.length === 0) return null;
      const cheapest = quote.result.rates[0];
      if (!cheapest || cheapest.amountCents <= 0) return null;
      return {
        amountCents: cheapest.amountCents,
        carrier: cheapest.carrier,
        serviceLevel: cheapest.serviceLevelToken,
        serviceLevelName: cheapest.serviceLevelName,
      };
    } catch {
      return null;
    }
  })();
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
  return Promise.race([run, timeout]);
}

// ---------------------------------------------------------------------------
// Back-compat shim: purchaseLabelForOrder
// ---------------------------------------------------------------------------

export interface PurchaseLabelOptions {
  orderId: string;
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

/**
 * Back-compat: existing admin bulk route imports this. Routes through
 * `buyLabel`, which writes the audit ledger and uses the platform key.
 *
 * The `_supabase` argument is accepted for compatibility but unused - the
 * admin client is created internally to ensure the audit row write is RLS-safe.
 */
export async function purchaseLabelForOrder(
  _supabase: SupabaseClient,
  opts: PurchaseLabelOptions,
): Promise<PurchaseLabelResult> {
  try {
    const r = await buyLabel({
      orderId: opts.orderId,
      agentId: opts.agentId,
      preferredServiceLevel: opts.preferredServiceLevel ?? null,
    });
    if (r.ok) {
      return { ok: true, trackingNumber: r.trackingNumber, labelUrl: r.labelUrl };
    }
    return { ok: false, error: r.error, status: r.status };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'EasyPost unavailable';
    return { ok: false, error: msg, status: 503 };
  }
}
