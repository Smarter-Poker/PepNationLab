import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Cart item ids in PepNationLab are NOT uniform.
 *
 * - The by-name / quick-add path (`/api/cart/resolve-name` -> CartContext) keys
 *   cart items by `agent_products.id`. This is the path that runs on MOBILE,
 *   where the desktop-only `AgentStorefrontGrid` (which keeps its own internal,
 *   product-id-keyed cart) is not mounted to intercept the add event.
 * - The storefront grid and reorder paths key items by `products.id`.
 *
 * Any endpoint that looks ids up against the `products` table (or
 * `agent_inventory.product_id`) must therefore first translate any
 * agent_product ids to their underlying product id, or it silently returns
 * nothing for mobile-added items (and, at checkout, hard-fails the order).
 *
 * This helper resolves a mixed list of cart ids to product ids and returns a
 * per-input mapping so callers can also remap quantity/price maps that were
 * keyed by the original (possibly agent_product) id.
 */
export async function resolveCartIdsToProductIds(
  supabase: SupabaseClient,
  inputIds: string[],
): Promise<{ productIds: string[]; inputToProduct: Map<string, string> }> {
  const inputToProduct = new Map<string, string>();
  const unique = Array.from(new Set((inputIds ?? []).filter((v): v is string => typeof v === 'string' && v.length > 0)));
  if (unique.length === 0) return { productIds: [], inputToProduct };

  // Any input that is an agent_product id resolves to its product_id.
  const { data: apRows } = await supabase
    .from('agent_products')
    .select('id, product_id')
    .in('id', unique);

  const agentProductIds = new Set<string>();
  for (const r of (apRows ?? []) as Array<{ id: string; product_id: string }>) {
    if (r?.id && r?.product_id) {
      inputToProduct.set(r.id, r.product_id);
      agentProductIds.add(r.id);
    }
  }
  // Inputs not matched as agent_product ids are treated as product ids directly.
  for (const id of unique) {
    if (!agentProductIds.has(id)) inputToProduct.set(id, id);
  }

  const productIds = Array.from(new Set(Array.from(inputToProduct.values())));
  return { productIds, inputToProduct };
}
