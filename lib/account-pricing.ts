import type { createServiceClient } from '@/lib/supabase/server';
type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

/** Contract costs are resolved by the same database function as price safeguards. */
export async function contractCosts(client: ServiceClient, agentId: string, productIds: string[], bundle: string | null = null): Promise<Map<string, number>> {
  if (!productIds.length) return new Map();
  const { data, error } = await client.rpc('fn_contract_costs', { p_agent: agentId, p_products: productIds, p_bundle: bundle });
  if (error) throw new Error('Account Pricing Configuration Unavailable');
  if (!Array.isArray(data)) throw new Error('Invalid Account Pricing Response');
  return new Map(data.map((row: { product_id: string; cost: number }) => {
    const cost = Number(row.cost);
    if (!Number.isFinite(cost) || cost <= 0) throw new Error('Invalid Account Contract Cost');
    return [row.product_id, cost];
  }));
}

/** Allocate the exact listed bundle cents without per-component penny drift. */
export function allocateBundlePrice(total: number, weights: Array<{ id: string; weight: number }>): Map<string, number> {
  const ordered = [...weights].sort((a,b) => a.id.localeCompare(b.id));
  const sum = ordered.reduce((n,r) => n+r.weight,0);
  if (!Number.isFinite(total) || total <= 0 || sum <= 0 || ordered.some(r => !Number.isFinite(r.weight) || r.weight <= 0)) throw new Error('Invalid Bundle Price');
  const cents = Math.round(total*100);
  let running=0, prior=0;
  return new Map(ordered.map(r => {running+=r.weight; const end=Math.round(cents*running/sum); const share=(end-prior)/100; prior=end; return [r.id,share];}));
}

/** Resolve the authoritative account permission; unavailable permission fails closed. */
export async function canEditStorePricing(client: ServiceClient, agentId: string): Promise<boolean> {
  const { data, error } = await client.rpc('can_edit_store_pricing', { p_agent: agentId });
  if (error || typeof data !== 'boolean') throw new Error('Pricing Permission Unavailable');
  return data;
}
