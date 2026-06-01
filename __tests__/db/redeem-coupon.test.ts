import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  ENV_READY,
  getServiceClient,
  makeTracker,
  createTestAgent,
  createTestCoupon,
  cleanupTracker,
} from './_helpers';

/**
 * Integration tests for redeem_coupon RPC.
 *
 * Covers:
 *  - Happy path: percent discount math + uses_count increments.
 *  - Happy path: fixed discount with subtotal cap.
 *  - Max-uses race: 100 parallel calls against a max_uses=10 coupon
 *    must succeed exactly 10 times — the atomic UPDATE makes this
 *    safe even under contention.
 *  - Expired coupon rejects.
 *  - Min-order-amount rejects.
 *  - Inactive coupon rejects.
 *  - Wrong agent rejects (coupon is owned by agent A; agent B tries).
 *
 * Skips entirely when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.
 */

const d = ENV_READY ? describe : describe.skip;

d('redeem_coupon RPC', () => {
  const supabase = ENV_READY ? getServiceClient() : (null as never);
  const tracker = makeTracker();
  let agentId: string;
  let otherAgentId: string;

  beforeAll(async () => {
    const a = await createTestAgent(supabase, tracker, { role: 'agent' });
    const b = await createTestAgent(supabase, tracker, { role: 'agent' });
    agentId = a.id;
    otherAgentId = b.id;
  }, 30_000);

  afterAll(async () => {
    if (ENV_READY) await cleanupTracker(supabase, tracker);
  }, 30_000);

  it('returns the right percent discount and increments uses_count', async () => {
    const c = await createTestCoupon(supabase, tracker, {
      agentId,
      discountType: 'percent',
      discountValue: 10,
    });
    const { data, error } = await supabase.rpc('redeem_coupon', {
      p_code: c.code,
      p_agent_id: agentId,
      p_order_subtotal: 100,
    });
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data[0].discount_amount).toBeCloseTo(10, 5);
    const { data: row } = await supabase.from('coupons').select('uses_count').eq('id', c.id).single();
    expect(row?.uses_count).toBe(1);
  }, 15_000);

  it('caps a fixed discount at the order subtotal so total never goes negative', async () => {
    const c = await createTestCoupon(supabase, tracker, {
      agentId,
      discountType: 'fixed',
      discountValue: 200,
    });
    const { data, error } = await supabase.rpc('redeem_coupon', {
      p_code: c.code,
      p_agent_id: agentId,
      p_order_subtotal: 50,
    });
    expect(error).toBeNull();
    expect(data[0].discount_amount).toBeCloseTo(50, 5);
  }, 15_000);

  it('atomically caps redemptions at max_uses under parallel contention', async () => {
    const c = await createTestCoupon(supabase, tracker, {
      agentId,
      discountType: 'percent',
      discountValue: 5,
      maxUses: 10,
    });
    const calls = Array.from({ length: 100 }, () =>
      supabase
        .rpc('redeem_coupon', { p_code: c.code, p_agent_id: agentId, p_order_subtotal: 100 })
        .then((res) => ({ ok: !res.error, msg: res.error?.message ?? null }))
    );
    const results = await Promise.all(calls);
    const success = results.filter((r) => r.ok).length;
    expect(success).toBe(10);

    const { data: row } = await supabase.from('coupons').select('uses_count').eq('id', c.id).single();
    expect(row?.uses_count).toBe(10);
  }, 60_000);

  it('rejects an expired coupon', async () => {
    const c = await createTestCoupon(supabase, tracker, {
      agentId,
      discountValue: 10,
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });
    const { error } = await supabase.rpc('redeem_coupon', {
      p_code: c.code,
      p_agent_id: agentId,
      p_order_subtotal: 100,
    });
    expect(error).toBeTruthy();
  }, 15_000);

  it('rejects when subtotal is below min_order_amount', async () => {
    const c = await createTestCoupon(supabase, tracker, {
      agentId,
      discountValue: 10,
      minOrderAmount: 200,
    });
    const { error } = await supabase.rpc('redeem_coupon', {
      p_code: c.code,
      p_agent_id: agentId,
      p_order_subtotal: 100,
    });
    expect(error).toBeTruthy();
  }, 15_000);

  it('rejects an inactive coupon', async () => {
    const c = await createTestCoupon(supabase, tracker, {
      agentId,
      isActive: false,
    });
    const { error } = await supabase.rpc('redeem_coupon', {
      p_code: c.code,
      p_agent_id: agentId,
      p_order_subtotal: 100,
    });
    expect(error).toBeTruthy();
  }, 15_000);

  it('rejects when a different agent tries the coupon (cross-agent scope)', async () => {
    const c = await createTestCoupon(supabase, tracker, { agentId });
    const { error } = await supabase.rpc('redeem_coupon', {
      p_code: c.code,
      p_agent_id: otherAgentId,
      p_order_subtotal: 100,
    });
    expect(error).toBeTruthy();
  }, 15_000);
});
