'use client';

/**
 * Brand-network flag persistence (client-side).
 *
 * The storefront page resolves Savage-network membership server-side
 * (lib/brand-network.ts) and the grid records the verdict here. Client
 * components that render product imagery OUTSIDE the storefront page tree —
 * the cart drawer, checkout, lab journal — read it back so they never fall
 * back to Pep Nation vials for a Savage-network store.
 *
 * localStorage is a rendering hint only; every reader ORs it with its own
 * heuristics, so a cleared cache degrades gracefully.
 */

const KEY_PREFIX = 'pnl_brand_network_';

export function setBrandNetworkFlag(agentSlug: string | null | undefined, isSavage: boolean): void {
  if (typeof window === 'undefined' || !agentSlug) return;
  try {
    window.localStorage.setItem(`${KEY_PREFIX}${agentSlug.toLowerCase()}`, isSavage ? 'savage' : 'pepnation');
  } catch { /* storage unavailable — heuristics still apply */ }
}

export function getBrandNetworkIsSavage(agentSlug: string | null | undefined): boolean {
  if (typeof window === 'undefined' || !agentSlug) return false;
  try {
    return window.localStorage.getItem(`${KEY_PREFIX}${agentSlug.toLowerCase()}`) === 'savage';
  } catch {
    return false;
  }
}
