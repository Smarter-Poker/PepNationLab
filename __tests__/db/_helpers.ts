/**
 * Shared fixtures for the DB integration test suite.
 *
 * These tests run against a real Supabase project and exercise the
 * SECURITY DEFINER RPCs that own platform money paths. They are
 * intentionally not part of the default `npm test` mental-model:
 *
 *   - If `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is not set in
 *     env, every test in the suite skips. This lets the unit test
 *     suite stay fast and CI-green without surprise data writes.
 *
 *   - When the env IS set, every row created is prefixed with the
 *     run id (`test_<runid>_*`) so a half-finished run still leaves
 *     an obvious trail to clean up by hand if needed.
 *
 *   - Pointing this at the production Supabase project is supported
 *     — the test data lives in its own namespace and is cleaned up
 *     in `afterAll`. For full isolation, point it at a Supabase
 *     branch database via `SUPABASE_URL=...` in env.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export const ENV_READY = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

/** Per-run id stamped into every email/code so test rows are obvious. */
export const RUN_ID = randomUUID().slice(0, 8);

let cachedClient: SupabaseClient | null = null;
export function getServiceClient(): SupabaseClient {
  if (!ENV_READY) {
    throw new Error('DB tests require SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  }
  if (!cachedClient) {
    cachedClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return cachedClient;
}

/** IDs of every row we created so afterAll can drop them. */
interface TrackedFixtures {
  authUserIds: string[];
  couponIds: string[];
  orderIds: string[];
}

export function makeTracker(): TrackedFixtures {
  return { authUserIds: [], couponIds: [], orderIds: [] };
}

/**
 * Create a real auth user + profile and stamp the role/account_type.
 * Cleaned up via `cleanupTracker` (which uses auth.admin.deleteUser ->
 * cascade onto profiles).
 */
export async function createTestAgent(
  supabase: SupabaseClient,
  tracker: TrackedFixtures,
  overrides: {
    accountType?: 'credit' | 'prepaid';
    prepaidBalance?: number;
    creditLimit?: number;
    role?: 'agent' | 'researcher' | 'super_agent' | 'sub_agent';
    parentAgentId?: string | null;
    commissionPct?: number | null;
    isSubAgent?: boolean;
  } = {}
): Promise<{ id: string; email: string }> {
  const email = `test_${RUN_ID}_${randomUUID().slice(0, 8)}@test.pepnationlab.local`;
  const password = `Test_${randomUUID()}`;

  const { data: user, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { test_run_id: RUN_ID },
  });
  if (error || !user.user) throw new Error(`createUser failed: ${error?.message ?? 'no user'}`);

  tracker.authUserIds.push(user.user.id);

  // Profile is auto-created by `on_auth_user_created` trigger. Patch the
  // fields we care about for the test.
  const patch: Record<string, unknown> = {
    full_name: `Test User ${RUN_ID}`,
    is_active: true,
  };
  if (overrides.role) patch.role = overrides.role;
  if (overrides.accountType) patch.account_type = overrides.accountType;
  if (overrides.prepaidBalance !== undefined) patch.prepaid_balance = overrides.prepaidBalance;
  if (overrides.creditLimit !== undefined) patch.credit_limit = overrides.creditLimit;
  if (overrides.parentAgentId !== undefined) patch.parent_agent_id = overrides.parentAgentId;
  if (overrides.commissionPct !== undefined) patch.commission_pct = overrides.commissionPct;
  if (overrides.isSubAgent !== undefined) patch.is_sub_agent = overrides.isSubAgent;

  const { error: patchErr } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.user.id);
  if (patchErr) throw new Error(`profile patch failed: ${patchErr.message}`);

  return { id: user.user.id, email };
}

export async function createTestCoupon(
  supabase: SupabaseClient,
  tracker: TrackedFixtures,
  args: {
    agentId: string;
    code?: string;
    discountType?: 'percent' | 'fixed';
    discountValue?: number;
    maxUses?: number | null;
    minOrderAmount?: number | null;
    expiresAt?: string | null;
    isActive?: boolean;
  }
): Promise<{ id: string; code: string }> {
  const code = args.code ?? `TEST_${RUN_ID}_${randomUUID().slice(0, 6).toUpperCase()}`;
  const { data, error } = await supabase
    .from('coupons')
    .insert({
      agent_id: args.agentId,
      code,
      discount_type: args.discountType ?? 'percent',
      discount_value: args.discountValue ?? 10,
      max_uses: args.maxUses ?? null,
      min_order_amount: args.minOrderAmount ?? null,
      expires_at: args.expiresAt ?? null,
      is_active: args.isActive ?? true,
      uses_count: 0,
    })
    .select('id, code')
    .single();
  if (error || !data) throw new Error(`createTestCoupon failed: ${error?.message}`);
  tracker.couponIds.push(data.id as string);
  return { id: data.id as string, code: data.code as string };
}

/**
 * Create a barebones order row. Skips the order_items pipeline; callers
 * who need items can add them manually after. Used for accrue/settle
 * commission tests that only read referring_sub_agent_id + subtotal.
 */
export async function createTestOrder(
  supabase: SupabaseClient,
  tracker: TrackedFixtures,
  args: {
    buyerId: string;
    agentId: string;
    subtotal: number;
    total?: number;
    referringSubAgentId?: string | null;
    status?: string;
  }
): Promise<string> {
  const { data, error } = await supabase
    .from('orders')
    .insert({
      buyer_id: args.buyerId,
      agent_id: args.agentId,
      subtotal: args.subtotal,
      total: args.total ?? args.subtotal,
      status: args.status ?? 'pending_customer_payment',
      payment_method: 'zelle',
      fulfillment_method: 'pickup',
      buyer_name: `Test ${RUN_ID}`,
      buyer_email: `test_${RUN_ID}@test.local`,
      referring_sub_agent_id: args.referringSubAgentId ?? null,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`createTestOrder failed: ${error?.message}`);
  tracker.orderIds.push(data.id as string);
  return data.id as string;
}

export async function cleanupTracker(
  supabase: SupabaseClient,
  tracker: TrackedFixtures,
): Promise<void> {
  // Order matters: deepest children first.
  for (const id of tracker.orderIds) {
    try {
      await supabase.from('orders').delete().eq('id', id);
    } catch {
      // ignore — afterAll best effort
    }
  }
  for (const id of tracker.couponIds) {
    try {
      await supabase.from('coupons').delete().eq('id', id);
    } catch {
      // ignore
    }
  }
  for (const id of tracker.authUserIds) {
    try {
      await supabase.auth.admin.deleteUser(id);
    } catch {
      // ignore
    }
  }
}
