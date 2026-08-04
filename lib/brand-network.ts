/**
 * Brand-network resolution (server-side).
 *
 * A storefront belongs to the Savage Brands network when the store itself is
 * the savagebrands store OR any ancestor in its profiles.parent_agent_id
 * chain is. Savage-network stores must NEVER render Pep Nation product
 * imagery — card art, vial images, recommendation thumbnails, or fallbacks.
 *
 * The walk is multi-hop on purpose: a downline of a downline (e.g. a
 * sub-agent Eddie Razz adds under /eddierazz) still resolves to the
 * savagebrands root even though its direct parent is not savagebrands.
 *
 * Call with a SERVICE-ROLE client: RLS hides profiles.parent_agent_id from
 * anonymous storefront visitors, which is exactly when this matters most.
 */

// Typed loosely so it accepts either supabase server client flavor.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MinimalClient = any;

export const SAVAGE_BRANDS_SLUG = 'savagebrands';

/** Max ancestor hops walked before giving up (cycle/depth safety). */
const MAX_HOPS = 6;

/**
 * True when `agentId` is the Savage Brands store or any of its descendants.
 * Fails closed (returns false) on query errors — callers treat the result as
 * a rendering hint, and client-side heuristics remain as a safety net.
 */
export async function isSavageNetworkAgent(
  client: MinimalClient,
  agentId: string | null | undefined,
): Promise<boolean> {
  if (!agentId) return false;
  const seen = new Set<string>();
  let currentId: string | null = agentId;

  for (let hop = 0; hop < MAX_HOPS && currentId && !seen.has(currentId); hop++) {
    seen.add(currentId);
    try {
      // Explicit annotations: the client is untyped (any), and the loop
      // variable feeding these queries otherwise creates a TS7022 circular
      // inference (query -> currentId -> query).
      const storeRes: { data: { slug?: string | null } | null } | null = await client
        .from('agent_profiles')
        .select('slug')
        .eq('id', currentId)
        .maybeSingle();
      if ((storeRes?.data?.slug ?? null) === SAVAGE_BRANDS_SLUG) {
        return true;
      }
      const profileRes: { data: { parent_agent_id?: string | null } | null } | null = await client
        .from('profiles')
        .select('parent_agent_id')
        .eq('id', currentId)
        .maybeSingle();
      currentId = profileRes?.data?.parent_agent_id ?? null;
    } catch {
      return false;
    }
  }
  return false;
}
