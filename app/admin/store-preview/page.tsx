import React from 'react';
import { createClient } from '@/lib/supabase/server';
import AgentStorefrontGrid from '@/components/AgentStorefrontGrid';
import { requireAdmin } from '@/lib/admin-auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminStorePreviewPage() {
  const gate = await requireAdmin();
  if (!gate.ok) redirect('/login');

  const supabase = await createClient();

  // Fetch all products with inventory
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
      inventory ( count )
    `)
    .order('name');

  if (error || !productsData) {
    return (
      <div style={{ padding: 'var(--space-8)' }}>
        <h2 style={{ color: 'var(--red)' }}>Error loading catalog</h2>
      </div>
    );
  }

  // Map to ProductItem format expected by AgentStorefrontGrid
  const inventoryMap: Record<string, number> = {};

  const productItems = productsData.map(p => {
    const inv = Array.isArray(p.inventory) ? p.inventory[0] : p.inventory;
    const count = inv?.count || 0;
    inventoryMap[p.id] = count;

    return {
      id: `preview-${p.id}`,
      agent_id: 'admin-preview',
      product_id: p.id,
      custom_name: p.name,
      custom_description: p.description,
      custom_image_url: p.image_url,
      retail_price: Number(p.base_cost || 0),
      is_visible: true,
      products: {
        name: p.name,
        description: p.description || '',
        image_url: p.image_url,
        category: p.category || 'Other',
        backorder_days: p.backorder_days || 10,
        in_stock: count > 0,
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
