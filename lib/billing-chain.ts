import type { createServiceClient } from '@/lib/supabase/server';
import { captureError } from '@/lib/sentry';
import { logError } from '@/lib/log';

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
 * Walks the billing chain and refuses the transaction if either
 *   (a) the transacting agent OR ANY ancestor in their chain is
 *       is_transactions_frozen - the freeze cascade rolls DOWN, so
 *       both the transacting account itself AND every upline must be
 *       clear, OR
 *   (b) any credit-line tier on the billed chain would exceed its
 *       credit_limit after adding additionalOwed dollars.
 *
 * `transactingAgentId` defaults to `billedAgentId`. For a sub-agent's
 * order, pass the sub-agent's id as transactingAgentId and the
 * super-agent's id as billedAgentId so freeze covers the sub-agent's
 * own state while credit covers the billed chain.
 */
export async function assertChainCanTransact(
  supabase: ServiceClient,
  billedAgentId: string,
  additionalOwed: number,
  transactingAgentId?: string,
): Promise<ChainCheckResult> {
  const freezeRoot = transactingAgentId ?? billedAgentId;

  // 1) Freeze check - starts at the transacting account so the
  //    sub-agent's own freeze state is included in the walk.
  const { data: frozenRows, error: frozenErr } = await supabase.rpc('is_chain_frozen', {
    p_agent_id: freezeRoot,
  });
  if (frozenErr) {
    logError('billing-chain.is_chain_frozen', { agentId: freezeRoot }, frozenErr);
    captureError(frozenErr, { context: 'billing-chain.is_chain_frozen', agentId: freezeRoot });
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

  // 2) Hierarchical credit-line check - bubbles up the BILLED chain
  //    (credit limits live on the billed tier, not the transacting one).
  const { data: chainRows, error: chainErr } = await supabase.rpc('check_credit_chain', {
    p_billed_agent_id: billedAgentId,
    p_additional_owed: additionalOwed,
  });
  if (chainErr) {
    logError('billing-chain.check_credit_chain', { billedAgentId, additionalOwed }, chainErr);
    captureError(chainErr, { context: 'billing-chain.check_credit_chain', billedAgentId, additionalOwed });
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
