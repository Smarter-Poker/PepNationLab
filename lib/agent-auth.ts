import type { createServiceClient } from '@/lib/supabase/server';

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

/**
 * Single-hop ancestor check: is `possibleAncestorId` either the same profile
 * as `descendantId` or that profile's direct `parent_agent_id`?
 *
 * The current super_agent → sub_agent hierarchy is exactly one hop deep, so a
 * single-hop check is sufficient and safer than recursive traversal (no
 * infinite loops, predictable RLS surface, one query). If the hierarchy ever
 * grows deeper, switch this to a recursive CTE behind the same signature.
 */
export async function isAgentAncestorOf(
  supabase: ServiceClient,
  possibleAncestorId: string,
  descendantId: string,
): Promise<boolean> {
  if (possibleAncestorId === descendantId) return true;
  const { data } = await supabase
    .from('profiles')
    .select('parent_agent_id')
    .eq('id', descendantId)
    .maybeSingle();
  return !!(data?.parent_agent_id && data.parent_agent_id === possibleAncestorId);
}
