import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  ENV_READY,
  getServiceClient,
  makeTracker,
  createTestAgent,
  cleanupTracker,
} from './_helpers';

/**
 * Integration tests for deduct_prepaid_balance RPC.
 *
 * The DB has two overloads:
 *   1. (agent_id UUID, amount NUMERIC) RETURNS BOOLEAN — legacy
 *      callers like /api/agent/orders/approve still use this and it
 *      MUST stay binary-compatible.
 *   2. (p_agent_id UUID, p_amount NUMERIC, p_order_id UUID,
 *       p_description TEXT) RETURNS NUMERIC — the canonical version
 *      that also inserts into balance_transactions.
 *
 * We exercise both shapes because regression here is a financial
 * audit-trail failure.
 *
 * Skips entirely when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.
 */

const d = ENV_READY ? describe : describe.skip;

d('deduct_prepaid_balance RPC', () => {
  const supabase = ENV_READY ? getServiceClient() : (null as never);
  const tracker = makeTracker();

  beforeAll(async () => {
    // no shared agent — each test creates fresh balance state
  });

  afterAll(async () => {
    if (ENV_READY) await cleanupTracker(supabase, tracker);
  }, 30_000);

  it('(legacy 2-arg) deducts when balance is sufficient and returns true', async () => {
    const a = await createTestAgent(supabase, tracker, {
      role: 'agent',
      accountType: 'prepaid',
      prepaidBalance: 100,
    });
    const { data, error } = await supabase.rpc('deduct_prepaid_balance', {
      agent_id: a.id,
      amount: 30,
    });
    expect(error).toBeNull();
    expect(data).toBe(true);
    const { data: p } = await supabase.from('profiles').select('prepaid_balance').eq('id', a.id).single();
    expect(Number(p?.prepaid_balance)).toBeCloseTo(70, 5);
  }, 15_000);

  it('(legacy 2-arg) returns false when balance is insufficient (no deduction)', async () => {
    const a = await createTestAgent(supabase, tracker, {
      role: 'agent',
      accountType: 'prepaid',
      prepaidBalance: 10,
    });
    const { data, error } = await supabase.rpc('deduct_prepaid_balance', {
      agent_id: a.id,
      amount: 50,
    });
    expect(error).toBeNull();
    expect(data).toBe(false);
    const { data: p } = await supabase.from('profiles').select('prepaid_balance').eq('id', a.id).single();
    expect(Number(p?.prepaid_balance)).toBeCloseTo(10, 5);
  }, 15_000);

  it('(4-arg) deducts, returns the new balance, and writes a balance_transactions ledger row', async () => {
    const a = await createTestAgent(supabase, tracker, {
      role: 'agent',
      accountType: 'prepaid',
      prepaidBalance: 200,
    });
    const { data, error } = await supabase.rpc('deduct_prepaid_balance', {
      p_agent_id: a.id,
      p_amount: 75,
      p_order_id: null,
      p_description: 'integration test charge',
    });
    expect(error).toBeNull();
    expect(Number(data)).toBeCloseTo(125, 5);

    const { data: ledger } = await supabase
      .from('balance_transactions')
      .select('amount, balance_before, balance_after, description, type')
      .eq('agent_id', a.id)
      .order('created_at', { ascending: false })
      .limit(1);
    expect(ledger?.length).toBe(1);
    expect(Number(ledger![0].amount)).toBeCloseTo(-75, 5);
    expect(Number(ledger![0].balance_before)).toBeCloseTo(200, 5);
    expect(Number(ledger![0].balance_after)).toBeCloseTo(125, 5);
    expect(ledger![0].type).toBe('order_charge');
  }, 15_000);

  it('(4-arg) raises on insufficient balance (check_violation, balance unchanged)', async () => {
    const a = await createTestAgent(supabase, tracker, {
      role: 'agent',
      accountType: 'prepaid',
      prepaidBalance: 10,
    });
    const { error } = await supabase.rpc('deduct_prepaid_balance', {
      p_agent_id: a.id,
      p_amount: 100,
      p_order_id: null,
      p_description: 'should-fail',
    });
    expect(error).toBeTruthy();
    const { data: p } = await supabase.from('profiles').select('prepaid_balance').eq('id', a.id).single();
    expect(Number(p?.prepaid_balance)).toBeCloseTo(10, 5);
  }, 15_000);

  it('(legacy 2-arg) parallel race: 50 concurrent $1 deductions against $25 balance lose no money', async () => {
    const a = await createTestAgent(supabase, tracker, {
      role: 'agent',
      accountType: 'prepaid',
      prepaidBalance: 25,
    });
    const calls = Array.from({ length: 50 }, () =>
      supabase
        .rpc('deduct_prepaid_balance', { agent_id: a.id, amount: 1 })
        .then((res) => res.data === true)
    );
    const results = await Promise.all(calls);
    const success = results.filter(Boolean).length;
    expect(success).toBe(25);
    const { data: p } = await supabase.from('profiles').select('prepaid_balance').eq('id', a.id).single();
    expect(Number(p?.prepaid_balance)).toBeCloseTo(0, 5);
  }, 60_000);
});
