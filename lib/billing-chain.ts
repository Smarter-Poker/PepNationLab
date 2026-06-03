import type { createServiceClient } from '@/lib/supabase/server';

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

export type ChainCheckResult =
  | { ok: true }
  | {
      ok: false;
      status: number;
      error: string;
      detail?: {
        frozen_at_level?: number | null;
        frozen_at_id?: string | null;
        blocked_level?: number | null;
        blocked_profile_id?: string | null;
        projected_total?: number | null;
        available_credit?: number | null;
      };
    };

/**
 * Walks the billing chain rooted at p_agent_id and refuses the
 * transaction if (a) any tier in the chain is_transactions_frozen,
 * or (b) any credit-line tier would exceed its credit_limit after
 * adding p_additional_owed dollars. Used by order approval.
 */
export async function assertChainCanTransact(
  supabase: ServiceClient,
  agentId: string,
  additionalOwed: number,
): Promise<ChainCheckResult> {
  // 1) Freeze check — cascades down the chain.
  const { data: frozenRows, error: frozenErr } = await supabase.rpc('is_chain_frozen', {
    p_agent_id: agentId,
  });
  if (frozenErr) {
    return { ok: false, status: 500, error: 'Chain-freeze check failed.' };
  }
  const frozen = Array.isArray(frozenRows) ? frozenRows[0] : (frozenRows as any);
  if (frozen?.frozen === true) {
    return {
      ok: false,
      status: 423,
      error: 'Transactions Are Currently Frozen. Contact Your Upline To Resolve Before Placing Orders.',
      detail: {
        frozen_at_level: frozen.frozen_at_level ?? null,
        frozen_at_id: frozen.frozen_at_id ?? null,
      },
    };
  }

  // 2) Hierarchical credit-line check — bubbles up the chain.
  const { data: chainRows, error: chainErr } = await supabase.rpc('check_credit_chain', {
    p_billed_agent_id: agentId,
    p_additional_owed: additionalOwed,
  });
  if (chainErr) {
    return { ok: false, status: 500, error: 'Credit-chain check failed.' };
  }
  const chain = Array.isArray(chainRows) ? chainRows[0] : (chainRows as any);
  if (chain?.blocked === true) {
    return {
      ok: false,
      status: 402,
      error: chain.blocked_reason ?? 'Credit Limit Exceeded Upstream. Please Pay Outstanding Statements.',
      detail: {
        blocked_level: chain.blocked_level ?? null,
        blocked_profile_id: chain.blocked_profile_id ?? null,
        projected_total: chain.projected_total ?? null,
        available_credit: chain.available_credit ?? null,
      },
    };
  }

  return { ok: true };
}
