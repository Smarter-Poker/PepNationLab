/**
 * Per-line fulfillment split for checkout.
 *
 * A cart line's quantity is split between an agent's finite LOCAL inventory and
 * the infinite China/global supply. China always backfills whatever local stock
 * can't cover.
 *
 * IMPORTANT: this is a PER-LINE value. The order route keys splits by cart-line
 * index, never by product id, because the same product can legitimately appear
 * on two lines (e.g. added standalone and again as a bundle component). Keying
 * by product id collapses those lines onto one split and mis-charges/mis-ships
 * the duplicate.
 */
export interface ItemFulfillmentSplit {
  localQty: number;
  chinaQty: number;
}

/**
 * @param qty             quantity ordered on this line (>= 1)
 * @param localAgentStock the agent's on-hand local stock for this product
 * @param useLocal        whether local fulfillment applies at all (false for
 *                        agent self-buys, pickup, and any non-ship fulfillment —
 *                        everything then ships from China)
 */
export function computeLineSplit(
  qty: number,
  localAgentStock: number,
  useLocal: boolean,
): ItemFulfillmentSplit {
  const q = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 0;
  if (!useLocal) return { localQty: 0, chinaQty: q };

  const local = Number.isFinite(localAgentStock) && localAgentStock > 0 ? Math.floor(localAgentStock) : 0;
  if (local >= q) return { localQty: q, chinaQty: 0 };
  if (local > 0) return { localQty: local, chinaQty: q - local };
  return { localQty: 0, chinaQty: q };
}
