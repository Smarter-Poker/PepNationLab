/**
 * lib/shippo.ts — Shippo Platform Account integration (M1 rewrite)
 *
 * This module replaces the original per-agent-key implementation. Every Shippo
 * call now resolves a single platform-account token (from the
 * `platform_shippo_credentials` active row OR the `SHIPPO_PLATFORM_TOKEN`
 * env var bootstrap fallback) and writes an append-only audit row in
 * `shipping_label_purchases`.
 *
 * Back-compat: `purchaseLabelForOrder(supabase, opts)` is preserved with the
 * same input/output shape so `app/api/admin/orders/bulk/route.ts` keeps
 * working without an edit. Internally it now routes through `buyLabel` and
 * writes the new bookkeeping columns on `orders`.
 *
 * Public surface:
 *   getActiveKey(agentId?)        — resolve {token, mode, accountScope?}
 *   validateAddress(addr)         — POST /addresses?validate=true
 *   quoteRates(input)             — POST /shipments, filtered/sorted rates
 *   buyLabel(input)               — POST /transactions, idempotent on order_id
 *   refundLabel(transactionId)    — POST /refunds
 *   subscribeTracking(tracking, carrier) — POST /tracks/{carrier}/{tracking}
 *   getTracking(tracking, carrier)       — GET  /tracks/{carrier}/{tracking}
 *   purchaseLabelForOrder(...)    — back-compat shim used by admin bulk route
 *
 * Environment:
 *   SHIPPO_PLATFORM_TOKEN  — production token (shippo_live_…)
 *   SHIPPO_TEST_TOKEN      — sandbox token   (shippo_test_…)
 *   SHIPPO_ENCRYPTION_KEY  — base64 32-byte AES-256-GCM key (lib/shippo-crypto)
 *   NEXT_PUBLIC_SHIPPO_MODE — 'test' | 'live' (UI badge only)
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — used for the lib-internal admin
 *     client that writes the audit ledger row.
 *
 * Notes:
 *   - The audit ledger row is written via a service-role Supabase client
 *     created inside this module. RLS forbids any other writer.
 *   - Address normalisation handles both legacy JSONB shapes
 *     (`street`/`zipCode` and `street1`/`zip`).
 *   - Cheapest-rate selection filters to allowlisted carriers; no regional
 *     sub-carriers like Hermes Lite or UDS.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { pickOne } from '@/lib/relations';
import { decryptSecret } from '@/lib/shippo-crypto';
import { canTransition, type OrderStatus } from '@/lib/order-states';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SHIPPO_BASE = 'https://api.goshippo.com';
const SHIPPO_API_VERSION = '2018-02-08';
const ALLOWED_CARRIERS = new Set(['usps', 'ups', 'fedex', 'dhl_express']);
const SHIPPO_USER_AGENT = 'PepNationLab/1.0';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ShippoMode = 'test' | 'live';

export interface ActiveKey {
  /** Plaintext bearer used in `Authorization: ShippoToken <token>`. */
  token: string;
  /** 'test' or 'live' — inferred from the token prefix. */
  mode: ShippoMode;
  /** Source of truth — admin DB row, env bootstrap, or legacy per-agent key. */
  source: 'platform_db' | 'env' | 'legacy_agent';
  /** Optional managed-account scope (Platform Account M2/M3). */
  accountScope?: string;
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
  /** Cleaned address suggested by USPS / carrier. */
  suggestion?: AddressInput;
  shippoAddressId?: string;
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
  mode: ShippoMode;
}

export interface BuyLabelInput {
  orderId: string;
  agentId: string;
  /** Optional preferred carrier service level (e.g., `usps_priority`). */
  preferredServiceLevel?: string | null;
  /** Optional explicit origin override (admin path); else resolved from agent profile. */
  originId?: string | null;
  /** Optional label file type (`PDF`, `PDF_4x6`, `PNG`, `ZPL_203`). */
  labelFileType?: 'PDF' | 'PDF_4x6' | 'PNG' | 'ZPL_203';
}

export interface BuyLabelOk {
  ok: true;
  trackingNumber: string;
  labelUrl: string;
  shippoTransactionId: string;
  carrier: string;
  serviceLevel: string;
  labelCostCents: number;
  parcelWeightOz: number;
  mode: ShippoMode;
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
  shippoRefundId?: string;
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Shippo audit writer requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.',
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
 * Resolve the active Shippo bearer token in priority order:
 *   1. Active row in `platform_shippo_credentials` (admin-connected).
 *   2. `SHIPPO_PLATFORM_TOKEN` env (live) or `SHIPPO_TEST_TOKEN` (test) bootstrap.
 *   3. Legacy per-agent `agent_profiles.shippo_api_key` (deprecated; warned).
 *
 * Mode is inferred from the token prefix: `shippo_live_*` -> 'live', else 'test'.
 *
 * Throws if no key can be found at all (caller handles as 503).
 */
export async function getActiveKey(agentId?: string): Promise<ActiveKey> {
  // 1) Active platform DB row
  try {
    const admin = getAdminClient();
    const { data: row } = await admin
      .from('platform_shippo_credentials')
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
        mode: (row.mode as ShippoMode) ?? inferMode(plaintext),
        source: 'platform_db',
      };
    }
  } catch (err) {
    console.warn('[shippo] platform_shippo_credentials lookup failed; falling through:', err);
  }

  // 2) Env var bootstrap (covers the M1 pre-admin-UI gap and dev)
  const envLive = process.env.SHIPPO_PLATFORM_TOKEN?.trim();
  const envTest = process.env.SHIPPO_TEST_TOKEN?.trim();
  const envToken =
    process.env.NEXT_PUBLIC_SHIPPO_MODE === 'live'
      ? envLive || envTest
      : envTest || envLive;
  if (envToken) {
    return {
      token: envToken,
      mode: inferMode(envToken),
      source: 'env',
    };
  }

  // 3) Legacy per-agent key (deprecated). Allowed during the M1 transition.
  if (agentId) {
    try {
      const admin = getAdminClient();
      const { data: agent } = await admin
        .from('agent_profiles')
        .select('shippo_api_key')
        .eq('id', agentId)
        .maybeSingle();
      if (agent?.shippo_api_key) {
        console.warn('[shippo] using deprecated per-agent shippo_api_key', { agentId });
        return {
          token: agent.shippo_api_key,
          mode: inferMode(agent.shippo_api_key),
          source: 'legacy_agent',
        };
      }
    } catch {
      /* fall through */
    }
  }

  throw new Error('No active Shippo credentials. Connect Shippo in the admin settings or set SHIPPO_PLATFORM_TOKEN.');
}

function inferMode(token: string): ShippoMode {
  return token.startsWith('shippo_live_') ? 'live' : 'test';
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

async function callShippo<T = unknown>(opts: CallOpts): Promise<{
  ok: true;
  data: T;
} | { ok: false; status: number; error: string; raw?: unknown }> {
  const url = new URL(opts.path, SHIPPO_BASE);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Authorization: `ShippoToken ${opts.key.token}`,
    'Shippo-API-Version': SHIPPO_API_VERSION,
    'User-Agent': SHIPPO_USER_AGENT,
    Accept: 'application/json',
  };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.key.accountScope) headers['SHIPPO-ACCOUNT-ID'] = opts.key.accountScope;

  const init: RequestInit = {
    method: opts.method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  };

  let lastError = '';
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let resp: Response;
    try {
      resp = await fetch(url.toString(), init);
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'network error';
      lastStatus = 0;
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
      lastError = `Shippo ${resp.status}: ${text.slice(0, 200)}`;
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
      error: extractShippoMessage(parsed) || `Shippo ${resp.status}`,
      raw: parsed,
    };
  }
  return { ok: false, status: lastStatus, error: lastError || 'Shippo unreachable' };
}

function backoffMs(attempt: number): number {
  return Math.round(250 * Math.pow(2, attempt) + Math.random() * 100);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractShippoMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const p = payload as Record<string, unknown>;
  if (Array.isArray(p.messages) && p.messages.length > 0) {
    return p.messages.map((m) => {
      if (m && typeof m === 'object' && 'text' in m) return String((m as Record<string, unknown>).text);
      return String(m);
    }).join('; ');
  }
  if (typeof p.detail === 'string') return p.detail;
  if (typeof p.error === 'string') return p.error;
  return '';
}

// ---------------------------------------------------------------------------
// Address validation
// ---------------------------------------------------------------------------

export async function validateAddress(addr: AddressInput): Promise<AddressValidationResult> {
  const key = await getActiveKey();
  const body = {
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
    validate: true,
  };
  const resp = await callShippo<{
    object_id?: string;
    validation_results?: {
      is_valid?: boolean;
      messages?: { code?: string; type?: string; text?: string }[];
    };
    is_residential?: boolean;
    name?: string; company?: string; street1?: string; street2?: string;
    city?: string; state?: string; zip?: string; country?: string;
  }>({ method: 'POST', path: '/addresses/', body, key });

  if (!resp.ok) {
    return {
      isValid: false,
      messages: [{ text: resp.error }],
    };
  }
  const v = resp.data.validation_results || {};
  const messages = (v.messages || []).map((m) => ({
    code: m.code,
    type: m.type,
    text: m.text || '',
  }));
  const result: AddressValidationResult = {
    isValid: !!v.is_valid,
    isResidential: resp.data.is_residential,
    messages,
    shippoAddressId: resp.data.object_id,
  };
  if (v.is_valid && resp.data.street1) {
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

export async function quoteRates(input: {
  from: AddressInput;
  to: AddressInput;
  parcel: ParcelInput;
  async?: boolean;
}): Promise<{ ok: true; result: QuoteResult } | { ok: false; status: number; error: string }> {
  const key = await getActiveKey();
  const resp = await callShippo<{
    object_id?: string;
    rates?: Array<{
      object_id: string;
      provider?: string;
      servicelevel?: { token?: string; name?: string };
      amount?: string;
      currency?: string;
      estimated_days?: number;
      arrives_by?: string;
      attributes?: string[];
    }>;
    messages?: Array<{ text?: string }>;
  }>({
    method: 'POST',
    path: '/shipments/',
    body: {
      address_from: toShippoAddress(input.from),
      address_to: toShippoAddress(input.to),
      parcels: [toShippoParcel(input.parcel)],
      async: input.async ?? false,
    },
    key,
  });

  if (!resp.ok) {
    return { ok: false, status: resp.status, error: resp.error };
  }
  const rates = (resp.data.rates || [])
    .filter((r) => r.provider && ALLOWED_CARRIERS.has(r.provider.toLowerCase().replace(/\s+/g, '_')))
    .map<RateOption>((r) => ({
      rateId: r.object_id,
      shipmentId: resp.data.object_id || '',
      carrier: r.provider || '',
      serviceLevelToken: r.servicelevel?.token || '',
      serviceLevelName: r.servicelevel?.name || '',
      amountCents: Math.round(parseFloat(r.amount || '0') * 100),
      currency: r.currency || 'USD',
      estimatedDays: r.estimated_days,
      arrivesBy: r.arrives_by,
      attributes: r.attributes || [],
    }))
    .filter((r) => r.amountCents > 0)
    .sort((a, b) => a.amountCents - b.amountCents);

  return {
    ok: true,
    result: {
      rates,
      shipmentId: resp.data.object_id || '',
      mode: key.mode,
    },
  };
}

function toShippoAddress(a: AddressInput): Record<string, unknown> {
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

function toShippoParcel(p: ParcelInput): Record<string, unknown> {
  return {
    length: String(p.lengthIn),
    width: String(p.widthIn),
    height: String(p.heightIn),
    distance_unit: 'in',
    weight: String(p.weightOz),
    mass_unit: 'oz',
  };
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
    .select('shippo_transaction_id, tracking_number, label_url, carrier, service_level, label_cost_cents, parcel_weight_oz, mode')
    .eq('order_id', input.orderId)
    .eq('refunded', false)
    .maybeSingle();
  if (existing) {
    return {
      ok: true,
      shippoTransactionId: existing.shippo_transaction_id,
      trackingNumber: existing.tracking_number,
      labelUrl: existing.label_url,
      carrier: existing.carrier,
      serviceLevel: existing.service_level,
      labelCostCents: existing.label_cost_cents,
      parcelWeightOz: Number(existing.parcel_weight_oz),
      mode: existing.mode as ShippoMode,
      idempotent: true,
    };
  }

  const ctx = await resolveShipmentContext(admin, input);
  if ('ok' in ctx && ctx.ok === false) return ctx;
  const resolved = ctx as ResolvedShipmentContext;

  const quote = await quoteRates({ from: resolved.origin.address, to: resolved.to, parcel: resolved.parcel });
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
  const txResp = await callShippo<{
    object_id?: string;
    status?: string;
    tracking_number?: string;
    label_url?: string;
    tracking_url_provider?: string;
    messages?: Array<{ text?: string }>;
  }>({
    method: 'POST',
    path: '/transactions/',
    body: {
      rate: chosen.rateId,
      label_file_type: input.labelFileType || 'PDF_4x6',
      async: false,
    },
    key,
  });

  if (!txResp.ok) {
    return { ok: false, status: txResp.status, error: txResp.error, code: 'TRANSACTION_FAILED' };
  }
  if (txResp.data.status === 'ERROR' || !txResp.data.label_url || !txResp.data.tracking_number || !txResp.data.object_id) {
    const msg = extractShippoMessage(txResp.data) || 'Shippo transaction failed';
    return { ok: false, status: 502, error: msg, code: 'TRANSACTION_ERROR' };
  }

  const shippoTxId = txResp.data.object_id;
  const trackingNumber = txResp.data.tracking_number;
  const labelUrl = txResp.data.label_url;
  const labelCostCents = chosen.amountCents;

  const { error: ledgerErr } = await admin.from('shipping_label_purchases').insert({
    order_id: input.orderId,
    agent_id: input.agentId,
    origin_id: resolved.origin.id,
    shippo_transaction_id: shippoTxId,
    shippo_rate_id: chosen.rateId,
    shippo_shipment_id: chosen.shipmentId,
    carrier: chosen.carrier,
    service_level: chosen.serviceLevelToken,
    tracking_number: trackingNumber,
    tracking_url_provider: txResp.data.tracking_url_provider || null,
    label_url: labelUrl,
    label_file_type: input.labelFileType || 'PDF_4x6',
    label_cost_cents: labelCostCents,
    agent_charged_cents: labelCostCents,
    parcel_weight_oz: resolved.parcel.weightOz,
    parcel_template: resolved.parcel.template || null,
    paid_by: 'platform',
    mode: key.mode,
  });
  if (ledgerErr) {
    return {
      ok: false,
      status: 500,
      error: `Label purchased but ledger write failed: ${ledgerErr.message}`,
      code: 'LEDGER_WRITE_FAILED',
    };
  }

  const nextStatus: OrderStatus = canTransition(resolved.order.status, 'shipped', 'admin')
    ? 'shipped'
    : resolved.order.status;
  const { error: updErr } = await admin
    .from('orders')
    .update({
      tracking_number: trackingNumber,
      label_url: labelUrl,
      carrier: chosen.carrier,
      service_level: chosen.serviceLevelToken,
      label_cost_cents: labelCostCents,
      agent_charged_cents: labelCostCents,
      shipping_paid_by: 'platform',
      shipping_origin_id: resolved.origin.id,
      shipped_at: new Date().toISOString(),
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
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
    shippoTransactionId: shippoTxId,
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
    .single();
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

  // Legacy JSONB warehouse — auto-migrate into a shipping_origins row so the FK is satisfied.
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
        email: String(wh.email || 'ops@pepnationlab.com'),
        is_default: false,
        is_active: true,
      };
      const { data: created } = await admin
        .from('shipping_origins')
        .insert(insert)
        .select('id, name, company, street1, street2, city, state, zip, country, phone, email')
        .single();
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

export async function refundLabel(shippoTransactionId: string): Promise<RefundResult> {
  if (!shippoTransactionId) return { ok: false, error: 'Missing transaction id' };
  const key = await getActiveKey();
  const resp = await callShippo<{
    object_id?: string;
    status?: string;
  }>({ method: 'POST', path: '/refunds/', body: { transaction: shippoTransactionId }, key });
  if (!resp.ok) return { ok: false, error: resp.error };
  return {
    ok: true,
    status: (resp.data.status as RefundResult['status']) || 'QUEUED',
    shippoRefundId: resp.data.object_id,
  };
}

// ---------------------------------------------------------------------------
// Tracking
// ---------------------------------------------------------------------------

export async function subscribeTracking(trackingNumber: string, carrier: string): Promise<{ ok: boolean; error?: string }> {
  if (!trackingNumber || !carrier) return { ok: false, error: 'Missing tracking_number or carrier' };
  const key = await getActiveKey();
  const slug = carrier.toLowerCase();
  const resp = await callShippo({
    method: 'POST',
    path: `/tracks/${encodeURIComponent(slug)}/`,
    body: { tracking_number: trackingNumber, carrier: slug },
    key,
  });
  if (!resp.ok) return { ok: false, error: resp.error };
  return { ok: true };
}

export async function getTracking(trackingNumber: string, carrier: string): Promise<TrackingState | null> {
  if (!trackingNumber || !carrier) return null;
  const key = await getActiveKey();
  const slug = carrier.toLowerCase();
  const resp = await callShippo<{
    tracking_status?: { status?: string; substatus?: { code?: string; text?: string }; status_details?: string; status_date?: string; location?: Record<string, unknown> };
    carrier?: string;
    tracking_number?: string;
  }>({ method: 'GET', path: `/tracks/${encodeURIComponent(slug)}/${encodeURIComponent(trackingNumber)}/`, key });
  if (!resp.ok || !resp.data?.tracking_status) return null;
  const s = resp.data.tracking_status;
  return {
    status: s.status || 'UNKNOWN',
    substatus: s.substatus?.code,
    statusDetails: s.status_details,
    occurredAt: s.status_date || new Date().toISOString(),
    location: s.location,
    carrier: resp.data.carrier || slug,
    trackingNumber: resp.data.tracking_number || trackingNumber,
  };
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
 * Back-compat: existing admin bulk route imports this. Now routes through
 * `buyLabel`, which writes the audit ledger and uses the platform key.
 *
 * The `_supabase` argument is accepted for compatibility but unused — the
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
    const msg = err instanceof Error ? err.message : 'Shippo unavailable';
    return { ok: false, error: msg, status: 503 };
  }
}
