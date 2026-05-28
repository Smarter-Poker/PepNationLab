import { createServiceClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import ProductCatalogClient from './ProductCatalogClient';
import type { RawProduct } from './ProductCatalogClient';

export default async function AdminProductsPage() {
  const supabase = await createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  
  if (!profile || (profile.role !== 'admin' && profile.role !== 'shipping')) {
    return redirect('/dashboard');
  }

  if (profile.role === 'shipping') {
    return redirect('/admin/orders');
  }

  const { data: products } = await supabase
    .from('products')
    .select('id, name, category, base_cost, is_active, created_at, sku')
    .order('created_at', { ascending: false });

  const { data: tiers } = await supabase
    .from('pricing_tiers')
    .select('tier_name, multiplier')
    .order('tier_name');

  const multipliers: Record<string, number> = {};
  tiers?.forEach(t => { multipliers[t.tier_name] = t.multiplier; });

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-8)' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', marginBottom: 'var(--space-2)' }}>
            Product Catalog
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)' }}>
            {products?.length ?? 0} SKUs • Manage Research Compound Listings
          </p>
        </div>
        <Link href="/admin/products/new" className="btn btn-primary">
          + Add Product
        </Link>
      </div>

      {/* Interactive catalog (client component) */}
      <ProductCatalogClient
        products={(products ?? []) as RawProduct[]}
        multipliers={multipliers}
      />
    </div>
  );
}
