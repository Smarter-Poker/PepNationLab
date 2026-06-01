import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  ENV_READY,
  getServiceClient,
  makeTracker,
  createTestAgent,
  createTestOrder,
  cleanupTracker,
} from './_helpers';

/**
 * Integration tests for the SACA commission RPCs.
 *
 * Validates:
 *  - accrue_sub_agent_commission(p_order_id) creates a single ledger
 *    row, computes commission = subtotal * commission_pct / 100,
 *    and is idempotent (a re-call on the same order does not double).
 *  - settle_sub_agent_week aggregates only `pending` ledger rows
 *    inside the window, only for orders in a delivered/shipped/etc
 *    state, and flips them to `settled`.
 *
 * Skips entirely when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.
 */

const d = ENV_READY ? describe : describe.skip;

d('SACA commission RPCs', () => {
  const supabase = ENV_READY ? getServiceClient() : (null as never);
  const tracker = makeTracker();
  let parentId: string;
  let subAgentId: string;
  let researcherId: string;

  beforeAll(async () => {
    const parent = await createTestAgent(supabase, tracker, { role: 'agent' });
    parentId = parent.id;
    const sub = await createTestAgent(supabase, tracker, {
      role: 'agent',
      isSubAgent: true,
      parentAgentId: parentId,
      commissionPct: 12.5,
      accountType: 'credit',
      creditLimit: 0,
    });
    subAgentId = sub.id;
    const researcher = await createTestAgent(supabase, tracker, { role: 'researcher' });
    researcherId = researcher.id;
  }, 30_000);

  afterAll(async () => {
    if (ENV_READY) await cleanupTracker(supabase, tracker);
  }, 30_000);

  it('accrues a single ledger row with commission = subtotal * pct/100', async () => {
    const orderId = await createTestOrder(supabase, tracker, {
      buyerId: researcherId,
      agentId: parentId,
      subtotal: 200,
      referringSubAgentId: subAgentId,
      status: 'approved_ship',
    });
    const { data: ledgerId, error } = await supabase.rpc('accrue_sub_agent_commission', {
      p_order_id: orderId,
    });
    expect(error).toBeNull();
    expect(ledgerId).toBeTruthy();

    const { data: rows } = await supabase
      .from('sub_agent_commission_ledger')
      .select('commission_amount, status, order_id, sub_agent_id')
      .eq('order_id', orderId);
    expect(rows?.length).toBe(1);
    // 200 * 12.5% = 25.00
    expect(Number(rows![0].commission_amount)).toBeCloseTo(25, 2);
    expect(rows![0].status).toBe('pending');
    expect(rows![0].sub_agent_id).toBe(subAgentId);
  }, 20_000);

  it('is idempotent — a second accrue on the same order does not double-credit', async () => {
    const orderId = await createTestOrder(supabase, tracker, {
      buyerId: researcherId,
      agentId: parentId,
      subtotal: 100,
      referringSubAgentId: subAgentId,
      status: 'approved_ship',
    });
    await supabase.rpc('accrue_sub_agent_commission', { p_order_id: orderId });
    await supabase.rpc('accrue_sub_agent_commission', { p_order_id: orderId });
    const { data: rows } = await supabase
      .from('sub_agent_commission_ledger')
      .select('id, commission_amount')
      .eq('order_id', orderId);
    expect(rows?.length).toBe(1);
    expect(Number(rows![0].commission_amount)).toBeCloseTo(12.5, 2);
  }, 20_000);

  it('settle aggregates pending rows in the window, flips them to settled, and skips orders in non-fulfilled state', async () => {
    // Two approved orders inside the window → settled.
    // One pending_customer_payment order inside the window → NOT settled.
    const o1 = await createTestOrder(supabase, tracker, {
      buyerId: researcherId,
      agentId: parentId,
      subtotal: 100,
      referringSubAgentId: subAgentId,
      status: 'approved_ship',
    });
    const o2 = await createTestOrder(supabase, tracker, {
      buyerId: researcherId,
      agentId: parentId,
      subtotal: 200,
      referringSubAgentId: subAgentId,
      status: 'shipped',
    });
    const oUnpaid = await createTestOrder(supabase, tracker, {
      buyerId: researcherId,
      agentId: parentId,
      subtotal: 50,
      referringSubAgentId: subAgentId,
      status: 'pending_customer_payment',
    });
    await supabase.rpc('accrue_sub_agent_commission', { p_order_id: o1 });
    await supabase.rpc('accrue_sub_agent_commission', { p_order_id: o2 });
    await supabase.rpc('accrue_sub_agent_commission', { p_order_id: oUnpaid });

    const weekStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const weekEnd = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { data: settlementId, error } = await supabase.rpc('settle_sub_agent_week', {
      p_sub_agent_id: subAgentId,
      p_week_start: weekStart,
      p_week_end: weekEnd,
    });
    expect(error).toBeNull();
    expect(settlementId).toBeTruthy();

    const { data: stmt } = await supabase
      .from('sub_agent_settlements')
      .select('total_commission, orders_count')
      .eq('id', settlementId as string)
      .single();
    // 100 * 12.5% = 12.50 ; 200 * 12.5% = 25.00 ; pending order excluded.
    expect(Number(stmt?.total_commission)).toBeCloseTo(37.5, 2);
    expect(Number(stmt?.orders_count)).toBe(2);

    const { data: ledgerRows } = await supabase
      .from('sub_agent_commission_ledger')
      .select('order_id, status')
      .in('order_id', [o1, o2, oUnpaid]);
    const byOrder = new Map(ledgerRows!.map((r) => [r.order_id as string, r.status as string]));
    expect(byOrder.get(o1)).toBe('settled');
    expect(byOrder.get(o2)).toBe('settled');
    expect(byOrder.get(oUnpaid)).toBe('pending');
  }, 30_000);

  it('settle returns NULL when no eligible commissions in the window', async () => {
    const futureStart = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const futureEnd = new Date(Date.now() + 37 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase.rpc('settle_sub_agent_week', {
      p_sub_agent_id: subAgentId,
      p_week_start: futureStart,
      p_week_end: futureEnd,
    });
    expect(error).toBeNull();
    expect(data).toBeNull();
  }, 15_000);
});
