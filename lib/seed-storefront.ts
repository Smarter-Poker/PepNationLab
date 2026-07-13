// Seeds a newly provisioned agent storefront's product catalog with the HOUSE
// (admin) store's retail prices as the default "set price". Every new
// super-agent / agent / promoted-agent storefront therefore mirrors the admin
// store (slug 'researchstore') at creation. The agent can change any price
// afterward. Falls back to the rookie house-tier (level 3) markup for any active
// product the house store has not priced. Client is the admin/service Supabase
// client; typed loosely to work with either.
type SeedClient = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function seedStorefrontFromHousePrices(client: SeedClient, agentId: string): Promise<number> {
  const { data: products } = await client
    .from('products')
    .select('id, base_cost')
    .eq('is_active', true);
  if (!products || products.length === 0) return 0;

  // House store = the single admin account (its storefront slug is 'researchstore').
  const { data: houseProfile } = await client
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  const houseId: string | null = houseProfile?.id ?? null;

  const houseMap = new Map<string, number>();
  if (houseId) {
    const { data: housePrices } = await client
      .from('agent_products')
      .select('product_id, retail_price')
      .eq('agent_id', houseId);
    for (const h of (housePrices ?? [])) {
      const pid = (h as { product_id?: string | null }).product_id;
      const rp = (h as { retail_price?: number | null }).retail_price;
      if (pid && rp != null && Number(rp) > 0) houseMap.set(pid, Number(rp));
    }
  }

  // Fallback for any active product the house store has not priced.
  const { data: rookieTier } = await client
    .from('house_tiers')
    .select('markup')
    .eq('level', 3)
    .maybeSingle();
  const rookieMultiplier = rookieTier?.markup != null ? 1 + Number(rookieTier.markup) : 3.5;

  const rows = products.map((p: { id: string; base_cost: number | null }) => {
    const housePrice = houseMap.get(p.id);
    const retail = housePrice != null
      ? housePrice
      : Math.round(Number(p.base_cost) * rookieMultiplier * 100) / 100;
    return {
      agent_id: agentId,
      product_id: p.id,
      retail_price: retail,
      margin_percent: 50,
      is_visible: true,
      sort_order: 0,
    };
  });

  const { error } = await client.from('agent_products').insert(rows);
  if (error) throw error;
  return rows.length;
}
