/**
 * lib/forge.ts - EasyPost Forge (ReferralCustomer white-label) agent accounts.
 *
 * Each agent gets their own white-label EasyPost sub-account created under the
 * platform's PARTNER production key. The agent puts THEIR card on file at
 * EasyPost (tokenized client-side with Stripe.js against EasyPost's Stripe
 * publishable key - the raw card number never touches our servers) and every
 * label they buy in the portal is charged to their own EasyPost wallet. The
 * platform never touches shipping money.
 *
 * EasyPost endpoints used (mirrors the official easypost-node library):
 *   POST /v2/referral_customers          (PARTNER production key)
 *     body {user: {name, email, phone_number}}
 *     -> {id: 'user_...', api_keys: [{mode: 'production'|'test', key}]}
 *     The referral API keys are returned ONLY at creation time.
 *   GET  /v2/partners/stripe_public_key  (PARTNER key)
 *     -> {public_key} - EasyPost's Stripe publishable key for client-side
 *     card tokenization. Env fallback: EASYPOST_STRIPE_PUBLISHABLE_KEY.
 *   POST /v2/credit_cards                (the AGENT's referral key)
 *     body {credit_card: {payment_method_id, priority}}
 *     -> CreditCard payment method {id, brand, last4, ...}
 *     (= ReferralCustomerService.addCreditCardFromStripe in easypost-node)
 *   POST /beta/referral_customers/payment_method (the AGENT's referral key)
 *     body {payment_method: {stripe_customer_id, payment_method_reference,
 *     priority}} - used instead when the caller has a Stripe customer id
 *     (the SetupIntent flow; BetaReferralCustomerService.addPaymentMethod).
 *   POST /v2/webhooks                    (the AGENT's referral key)
 *     body {webhook: {url, webhook_secret}} - registers the platform's
 *     receiver on the sub-account so tracker/refund events flow back in.
 *
 * Everything here is gated by shipping_provider_credentials.forge_enabled
 * (admin toggle, OFF until EasyPost partner approval lands). Secrets live in
 * agent_shipping_accounts (RLS deny-all); only service-role callers may use
 * this module, and no function here ever returns a decrypted key to a client.
 *
 * This module is server-only. It follows lib/shipping.ts conventions: typed
 * {ok} results, no throws across route boundaries where avoidable.
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { encryptSecret, decryptSecret, lastFour } from '@/lib/shipping-crypto';
import { coerceBytea, resolveWebhookSecret } from '@/lib/shipping-webhook';
import { getActiveKey } from '@/lib/shipping';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EASYPOST_ORIGIN = 'https://api.easypost.com';
const FORGE_USER_AGENT = 'PepNationLab/1.0';
const WEBHOOK_RECEIVER_URL = 'https://pepnationlab.com/api/webhooks/easypost';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ForgeBillingStatus = 'pending_card' | 'active' | 'disabled';

/** Safe, client-shareable snapshot of an agent's Forge account. No secrets. */
export interface ForgeAccountStatus {
  provisioned: boolean;
  easypostUserId: string | null;
  billingStatus: ForgeBillingStatus | null;
  cardBrand: string | null;
  cardLast4: string | null;
  keyLast4: string | null;
}

export interface ForgeErr {
  ok: false;
  status: number;
  error: string;
}

export type ForgeResult<T> = ({ ok: true } & T) | ForgeErr;

// ---------------------------------------------------------------------------
// Minimal EasyPost HTTP helper (Basic auth: key as username, empty password)
// ---------------------------------------------------------------------------

async function callForge<T = unknown>(opts: {
  method: 'GET' | 'POST';
  /** Full path including version prefix, e.g. '/v2/referral_customers'. */
  path: string;
  token: string;
  body?: unknown;
}): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const headers: Record<string, string> = {
    Authorization: 'Basic ' + Buffer.from(`${opts.token}:`).toString('base64'),
    'User-Agent': FORGE_USER_AGENT,
    Accept: 'application/json',
  };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  let resp: Response;
  try {
    resp = await fetch(EASYPOST_ORIGIN + opts.path, {
      method: opts.method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'network error';
    return { ok: false, status: 0, error: `EasyPost Unreachable: ${msg}` };
  }

  let parsed: unknown = null;
  try {
    parsed = await resp.json();
  } catch {
    parsed = null;
  }

  if (resp.status >= 200 && resp.status < 300) {
    return { ok: true, data: (parsed as T) ?? ({} as T) };
  }
  return {
    ok: false,
    status: resp.status,
    error: extractForgeMessage(parsed) || `EasyPost ${resp.status}`,
  };
}

/** EasyPost error body shape: {error: {code, message, errors: [...]}}. */
function extractForgeMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const err = (payload as Record<string, unknown>).error;
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
// Feature gate
// ---------------------------------------------------------------------------

/**
 * Forge is available when the admin has flipped forge_enabled on the active
 * platform credential row AND a platform EasyPost key resolves (getActiveKey
 * throws when nothing is connected). Everything user-visible hides behind
 * this check, so with the flag off nothing changes.
 */
export async function isForgeEnabled(admin: SupabaseClient): Promise<boolean> {
  try {
    const { data: row } = await admin
      .from('shipping_provider_credentials')
      .select('forge_enabled')
      .eq('is_active', true)
      .maybeSingle();
    if (!row?.forge_enabled) return false;
    await getActiveKey(); // throws when no platform credentials exist
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Account status (safe fields only)
// ---------------------------------------------------------------------------

export async function getAgentForgeStatus(
  admin: SupabaseClient,
  agentId: string,
): Promise<ForgeAccountStatus> {
  const { data: row } = await admin
    .from('agent_shipping_accounts')
    .select('easypost_user_id, billing_status, card_brand, card_last4, key_last4, is_active')
    .eq('agent_id', agentId)
    .eq('provider', 'easypost')
    .maybeSingle();

  if (!row || !row.is_active) {
    return {
      provisioned: false,
      easypostUserId: null,
      billingStatus: null,
      cardBrand: null,
      cardLast4: null,
      keyLast4: null,
    };
  }
  return {
    provisioned: true,
    easypostUserId: (row.easypost_user_id as string | null) ?? null,
    billingStatus: (row.billing_status as ForgeBillingStatus) ?? null,
    cardBrand: (row.card_brand as string | null) ?? null,
    cardLast4: (row.card_last4 as string | null) ?? null,
    keyLast4: (row.key_last4 as string | null) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Referral key access (server-side only - NEVER return this to a client)
// ---------------------------------------------------------------------------

export interface AgentForgeKey {
  /** Decrypted referral customer PRODUCTION API key. Server-side use only. */
  token: string;
  billingStatus: ForgeBillingStatus;
  easypostUserId: string | null;
}

export async function getAgentForgeKey(
  admin: SupabaseClient,
  agentId: string,
): Promise<AgentForgeKey | null> {
  const { data: row } = await admin
    .from('agent_shipping_accounts')
    .select('easypost_user_id, billing_status, api_key_ciphertext, api_key_iv, api_key_tag, is_active')
    .eq('agent_id', agentId)
    .eq('provider', 'easypost')
    .eq('is_active', true)
    .maybeSingle();
  if (!row) return null;

  const ciphertext = coerceBytea(row.api_key_ciphertext);
  const iv = coerceBytea(row.api_key_iv);
  const tag = coerceBytea(row.api_key_tag);
  if (!ciphertext || !iv || !tag) return null;

  try {
    const token = decryptSecret({ ciphertext, iv, tag });
    return {
      token,
      billingStatus: (row.billing_status as ForgeBillingStatus) ?? 'pending_card',
      easypostUserId: (row.easypost_user_id as string | null) ?? null,
    };
  } catch (err) {
    console.error('[forge] referral key decrypt failed:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Provisioning
// ---------------------------------------------------------------------------

interface ReferralCustomerResponse {
  id?: string;
  api_keys?: Array<{ object?: string; mode?: string; key?: string }>;
}

/**
 * Create the agent's white-label EasyPost sub-account. Idempotent: an
 * existing active row short-circuits and is returned as-is.
 *
 * Requires the platform key to be a LIVE (EZAK) production key - EasyPost
 * only creates referral customers under a partner production key.
 */
export async function provisionAgentAccount(
  admin: SupabaseClient,
  input: { agentId: string; name: string; email: string; phone: string },
): Promise<ForgeResult<{ account: ForgeAccountStatus }>> {
  // Idempotency: existing active account -> return it.
  const existing = await getAgentForgeStatus(admin, input.agentId);
  if (existing.provisioned) {
    return { ok: true, account: existing };
  }

  let platformKey;
  try {
    platformKey = await getActiveKey();
  } catch {
    return { ok: false, status: 503, error: 'No Platform EasyPost Credentials Are Connected.' };
  }
  if (platformKey.mode !== 'live') {
    return {
      ok: false,
      status: 409,
      error: 'Shipping Account Provisioning Requires The Platform EasyPost Account To Be Connected With A Live Production Key.',
    };
  }

  const createResp = await callForge<ReferralCustomerResponse>({
    method: 'POST',
    path: '/v2/referral_customers',
    token: platformKey.token,
    body: {
      user: {
        name: input.name,
        email: input.email,
        phone_number: input.phone,
      },
    },
  });
  if (!createResp.ok) {
    return { ok: false, status: createResp.status || 502, error: createResp.error };
  }

  const easypostUserId = createResp.data.id || '';
  const productionKey = (createResp.data.api_keys || []).find(
    (k) => (k.mode || '').toLowerCase() === 'production' && k.key,
  )?.key;

  if (!easypostUserId || !productionKey) {
    return {
      ok: false,
      status: 502,
      error: 'EasyPost Created The Account But Did Not Return A Production API Key.',
    };
  }

  let encrypted: ReturnType<typeof encryptSecret>;
  try {
    encrypted = encryptSecret(productionKey);
  } catch (err) {
    console.error('[forge] referral key encryption failed:', err);
    return { ok: false, status: 500, error: 'Failed To Encrypt The New Account Credentials.' };
  }

  // Best-effort: register the platform webhook receiver on the referral
  // account so its tracker / refund events flow into the shared receiver.
  // Uses the same HMAC secret the receiver already verifies against.
  let webhookId: string | null = null;
  try {
    const { secret } = await resolveWebhookSecret(admin);
    if (secret) {
      const hookResp = await callForge<{ id?: string }>({
        method: 'POST',
        path: '/v2/webhooks',
        token: productionKey,
        body: { webhook: { url: WEBHOOK_RECEIVER_URL, webhook_secret: secret } },
      });
      if (hookResp.ok && hookResp.data.id) webhookId = hookResp.data.id;
      else if (!hookResp.ok) console.warn('[forge] webhook registration failed:', hookResp.error);
    }
  } catch (err) {
    console.warn('[forge] webhook registration errored (non-fatal):', err);
  }

  const { error: insertErr } = await admin.from('agent_shipping_accounts').insert({
    agent_id: input.agentId,
    provider: 'easypost',
    easypost_user_id: easypostUserId,
    api_key_ciphertext: encrypted.ciphertext,
    api_key_iv: encrypted.iv,
    api_key_tag: encrypted.tag,
    key_last4: lastFour(productionKey),
    webhook_id: webhookId,
    billing_status: 'pending_card',
    is_active: true,
  });
  if (insertErr) {
    // A concurrent provision may have won the unique(agent_id) race - re-read.
    if ((insertErr as { code?: string }).code === '23505') {
      const raced = await getAgentForgeStatus(admin, input.agentId);
      if (raced.provisioned) return { ok: true, account: raced };
    }
    console.error('[forge] agent_shipping_accounts insert failed:', insertErr.message);
    return {
      ok: false,
      status: 500,
      error: 'The EasyPost Account Was Created But Saving It Failed. Contact Support Before Retrying.',
    };
  }

  const account = await getAgentForgeStatus(admin, input.agentId);
  return { ok: true, account };
}

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

/** Record a successful card add: brand + last4, billing_status -> active. */
export async function markBillingActive(
  admin: SupabaseClient,
  agentId: string,
  card: { brand: string | null; last4: string | null },
): Promise<void> {
  const { error } = await admin
    .from('agent_shipping_accounts')
    .update({
      billing_status: 'active',
      card_brand: card.brand,
      card_last4: card.last4,
      billing_added_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('agent_id', agentId)
    .eq('provider', 'easypost');
  if (error) {
    console.error('[forge] markBillingActive update failed:', error.message);
    throw new Error('Failed To Record The Billing Update.');
  }
}

interface EasyPostPaymentMethodResponse {
  id?: string;
  object?: string;
  brand?: string;
  last4?: string;
}

/**
 * Attach a Stripe payment method to the agent's EasyPost sub-account, billed
 * from then on for their label purchases. Called WITH THE AGENT'S referral
 * key. Two shapes, both from the official lib:
 *   - paymentMethodReference only  -> POST /v2/credit_cards
 *     (addCreditCardFromStripe: {credit_card: {payment_method_id, priority}})
 *   - plus stripeCustomerId        -> POST /beta/referral_customers/payment_method
 *     (Beta addPaymentMethod: {payment_method: {stripe_customer_id,
 *      payment_method_reference, priority}})
 */
export async function addAgentCard(
  admin: SupabaseClient,
  agentId: string,
  input: {
    paymentMethodReference: string;
    stripeCustomerId?: string | null;
    priority?: 'primary' | 'secondary';
  },
): Promise<ForgeResult<{ brand: string | null; last4: string | null }>> {
  const key = await getAgentForgeKey(admin, agentId);
  if (!key) {
    return { ok: false, status: 404, error: 'No Shipping Account Found. Set Up Your Shipping Account First.' };
  }

  const priority = input.priority ?? 'primary';
  let resp;
  if (input.stripeCustomerId) {
    resp = await callForge<EasyPostPaymentMethodResponse>({
      method: 'POST',
      path: '/beta/referral_customers/payment_method',
      token: key.token,
      body: {
        payment_method: {
          stripe_customer_id: input.stripeCustomerId,
          payment_method_reference: input.paymentMethodReference,
          priority,
        },
      },
    });
  } else {
    resp = await callForge<EasyPostPaymentMethodResponse>({
      method: 'POST',
      path: '/v2/credit_cards',
      token: key.token,
      body: {
        credit_card: {
          payment_method_id: input.paymentMethodReference,
          priority,
        },
      },
    });
  }

  if (!resp.ok) {
    return { ok: false, status: resp.status || 502, error: resp.error };
  }

  const brand = resp.data.brand ?? null;
  const last4 = resp.data.last4 ?? null;
  try {
    await markBillingActive(admin, agentId, { brand, last4 });
  } catch {
    return {
      ok: false,
      status: 500,
      error: 'Your Card Was Added At EasyPost But Recording It Here Failed. Contact Support.',
    };
  }
  return { ok: true, brand, last4 };
}

// ---------------------------------------------------------------------------
// Stripe publishable key (for client-side tokenization)
// ---------------------------------------------------------------------------

let cachedStripeKey: { value: string; expires: number } | null = null;

/**
 * EasyPost's Stripe publishable key, used by the browser to create the
 * payment method before it is attached to the referral account. Resolved
 * from GET /v2/partners/stripe_public_key with the platform key (the flow
 * the official lib uses), falling back to EASYPOST_STRIPE_PUBLISHABLE_KEY.
 */
export async function getEasyPostStripeKey(): Promise<string | null> {
  if (cachedStripeKey && Date.now() < cachedStripeKey.expires) return cachedStripeKey.value;

  try {
    const platformKey = await getActiveKey();
    const resp = await callForge<{ public_key?: string }>({
      method: 'GET',
      path: '/v2/partners/stripe_public_key',
      token: platformKey.token,
    });
    if (resp.ok && resp.data.public_key) {
      cachedStripeKey = { value: resp.data.public_key, expires: Date.now() + 10 * 60_000 };
      return resp.data.public_key;
    }
    if (!resp.ok) console.warn('[forge] stripe_public_key lookup failed:', resp.error);
  } catch (err) {
    console.warn('[forge] stripe_public_key lookup errored:', err);
  }

  const env = process.env.EASYPOST_STRIPE_PUBLISHABLE_KEY?.trim();
  return env || null;
}
