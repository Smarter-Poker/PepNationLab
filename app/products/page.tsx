import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ProductsList from './ProductsList';

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/products');
  }

  // Get researcher profile details
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, tier, parent_agent_id')
    .eq('id', user.id)
    .single();

  // Redirect to login if user profile not found
  if (!profile) {
    redirect('/login');
  }

  // Get active, non-banned products
  const { data: products } = await supabase
    .from('products')
    .select('id, name, slug, description, category, base_cost, image_url, weight_oz, sku, unit_size, unit_measure, in_stock, inventory_count, low_stock_threshold, backorder_days, admin_bulk_price, admin_bulk_threshold')
    .eq('is_active', true)
    .eq('is_banned', false)
    .order('name');

  // Get pricing tiers
  const { data: tiers } = await supabase
    .from('pricing_tiers')
    .select('tier_name, multiplier')
    .order('tier_name');

  // Researchers always see Tier 3 retail; agent/super_agent see their stored
  // wholesale tier. This is enforced server-side so the price displayed
  // matches what the order-create endpoint will charge them.
  const userTier = profile.role === 'researcher'
    ? 'tier_3'
    : (profile.tier ?? 'tier_3');

  // Get custom multipliers override map for this specific user tier
  const { data: overrides } = await supabase
    .from('product_tier_overrides')
    .select('product_id, custom_multiplier')
    .eq('tier_name', userTier);

  // Parse multipliers and overrides into easy-to-use maps
  const tierMultipliers: Record<string, number> = {};
  tiers?.forEach(t => {
    tierMultipliers[t.tier_name] = Number(t.multiplier);
  });

  const overrideMultipliers: Record<string, number> = {};
  overrides?.forEach(o => {
    overrideMultipliers[o.product_id] = Number(o.custom_multiplier);
  });

  // Get super agent pricing if the user is a sub-agent
  const superAgentPricing: Record<string, any> = {};
  if (profile.parent_agent_id) {
    const { data: sap } = await supabase
      .from('super_agent_pricing')
      .select('product_id, baseline_cost, bulk_baseline_cost, bulk_threshold')
      .eq('super_agent_id', profile.parent_agent_id);
    
    sap?.forEach(s => {
      superAgentPricing[s.product_id] = s;
    });
  }

  return (
    <ProductsList
      userProfile={profile}
      products={products ?? []}
      userTier={userTier}
      tierMultipliers={tierMultipliers}
      overrideMultipliers={overrideMultipliers}
      superAgentPricing={superAgentPricing}
      userEmail={user.email ?? ''}
    />
  );
}
