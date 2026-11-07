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
