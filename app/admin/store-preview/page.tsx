import React from 'react';
import { createServiceClient } from '@/lib/supabase/server';
import AgentStorefrontGrid from '@/components/AgentStorefrontGrid';
import { requireAdmin } from '@/lib/admin-auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminStorePreviewPage() {
  const gate = await requireAdmin();
  if (!gate.ok) redirect('/login');

  const supabase = await createServiceClient();

  // Fetch all products — inventory_count and in_stock live directly on the products table
  // (migration 20260521000002_product_inventory added them as columns, not a separate table)
  const { data: productsData, error } = await supabase
    .from('products')
    .select(`
      id,
      name,
      description,
      image_url,
      category,
      base_cost,
      unit_size,
      unit_measure,
      backorder_days,
      inventory_count,
      in_stock,
      low_stock_threshold
    `)
    .order('name');

  // Default tier-3 retail multiplier + per-product overrides so the preview
  // shows what a researcher would actually pay, not the admin's wholesale
  // base_cost.
  const { data: tiers } = await supabase
    .from('pricing_tiers')
    .select('tier_name, multiplier');
  const defaultMultiplier =
    Number(tiers?.find(t => t.tier_name === 'tier_3')?.multiplier ?? 7);

  const { data: overrideRows } = await supabase
    .from('product_tier_overrides')
    .select('product_id, custom_multiplier')
    .eq('tier_name', 'tier_3');
  const overrides = new Map<string, number>();
  overrideRows?.forEach(o => {
    overrides.set(o.product_id, Number(o.custom_multiplier));
  });

  if (error || !productsData) {
    console.error('[store-preview] Supabase query error:', error?.message, error?.details, error?.hint);
    return (
      <div style={{ padding: 'var(--space-8)' }}>
        <h2 style={{ color: 'var(--red)' }}>Error loading catalog</h2>
        <p style={{ color: 'var(--silver)', marginTop: 'var(--space-2)', fontSize: '0.85rem', fontFamily: 'monospace' }}>
          {error?.message || 'No data returned from query'}
        </p>
        {error?.hint && (
          <p style={{ color: 'var(--grey-400)', marginTop: 'var(--space-1)', fontSize: '0.8rem', fontFamily: 'monospace' }}>
            Hint: {error.hint}
          </p>
        )}
      </div>
    );
  }

  // Map to ProductItem format expected by AgentStorefrontGrid
  const inventoryMap: Record<string, number> = {};

  const productItems = productsData.map(p => {
    const count = p.inventory_count ?? 0;
    inventoryMap[p.id] = count;
    const multiplier = overrides.get(p.id) ?? defaultMultiplier;
    const retail = Math.round(Number(p.base_cost || 0) * multiplier * 100) / 100;

    return {
      id: `preview-${p.id}`,
      agent_id: 'admin-preview',
      product_id: p.id,
      custom_name: p.name,
      custom_description: p.description,
      custom_image_url: p.image_url,
      retail_price: retail,
      is_visible: true,
      products: {
        name: p.name,
        description: p.description || '',
        image_url: p.image_url,
        category: p.category || 'Other',
        backorder_days: p.backorder_days || 10,
        in_stock: p.in_stock ?? count > 0,
        inventory_count: count,
        unit_size: p.unit_size,
        unit_measure: p.unit_measure
      }
    };
  });

  return (
    <div style={{ padding: 'var(--space-6)', minHeight: '100vh', background: 'var(--black)' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: '1.5rem', color: 'var(--white)', fontFamily: 'var(--font-brand)', textTransform: 'uppercase' }}>
          Storefront Preview
        </h1>
        <p style={{ color: 'var(--silver)', fontSize: '0.9rem', marginTop: 'var(--space-2)' }}>
          This is a live preview of how the catalog appears to customers, using the Master Catalog base prices.
        </p>
      </div>

      <div style={{
        border: '1px dashed rgba(255,255,255,0.2)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-6)',
        background: 'var(--black-2)'
      }}>
        {/* Render the actual AgentStorefrontGrid component exactly as agents see it */}
        <AgentStorefrontGrid 
          products={productItems} 
          agentSlug="admin-preview" 
          inventoryMap={inventoryMap}
          primaryColor="#00C4BC"
        />
      </div>
    </div>
  );
}
