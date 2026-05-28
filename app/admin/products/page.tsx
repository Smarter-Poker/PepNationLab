import { createServiceClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

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

  const tierPrice = (cost: number, tier: string) =>
    `$${(cost * (multipliers[tier] ?? 1)).toFixed(2)}`;

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-8)' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', marginBottom: 'var(--space-2)' }}>
            Product Catalog
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)' }}>
            {products?.length ?? 0} Products • Manage Research Compound Listings
          </p>
        </div>
        <Link href="/admin/products/new" className="btn btn-primary">
          + Add Product
        </Link>
      </div>

      {/* Products Table */}
      <div className="card-metal" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['Product Name', 'Category', 'Base Cost', 'Tier 1 Price', 'Tier 2 Price', 'Tier 3 Price', 'Status', 'Actions'].map(h => (
                <th key={h} style={{
                  padding: 'var(--space-4)',
                  textAlign: 'left',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--grey-400)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  background: 'var(--surface-2)'
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products && products.length > 0 ? products.map((p, i) => (
              <tr key={p.id} style={{
                borderBottom: i < products.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                transition: 'background 0.15s',
              }}>
                <td style={{ padding: 'var(--space-4)' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--white)' }}>{p.name}</div>
                  {p.sku && <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', marginTop: 2 }}>SKU: {p.sku}</div>}
                </td>
                <td style={{ padding: 'var(--space-4)' }}>
                  <span className="badge badge-silver" style={{ fontSize: '0.65rem' }}>{p.category}</span>
                </td>
                <td style={{ padding: 'var(--space-4)', fontSize: '0.88rem', fontFamily: 'var(--font-brand)', color: 'var(--grey-400)' }}>
                  ${Number(p.base_cost).toFixed(2)}
                </td>
                <td style={{ padding: 'var(--space-4)', fontSize: '0.88rem', fontFamily: 'var(--font-brand)', color: 'var(--teal)' }}>
                  {tierPrice(Number(p.base_cost), 'tier_1')}
                </td>
                <td style={{ padding: 'var(--space-4)', fontSize: '0.88rem', fontFamily: 'var(--font-brand)', color: 'var(--silver)' }}>
                  {tierPrice(Number(p.base_cost), 'tier_2')}
                </td>
                <td style={{ padding: 'var(--space-4)', fontSize: '0.88rem', fontFamily: 'var(--font-brand)', color: 'var(--grey-400)' }}>
                  {tierPrice(Number(p.base_cost), 'tier_3')}
                </td>
                <td style={{ padding: 'var(--space-4)' }}>
                  <span className={`badge ${p.is_active ? 'badge-teal' : 'badge-red'}`} style={{ fontSize: '0.65rem' }}>
                    {p.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: 'var(--space-4)' }}>
                  <Link href={`/admin/products/${p.id}`} style={{ fontSize: '0.8rem', color: 'var(--teal)' }}>
                    Edit
                  </Link>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={8} style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
                  <p style={{ color: 'var(--grey-400)', marginBottom: 'var(--space-4)' }}>
                    No Products Added Yet
                  </p>
                  <Link href="/admin/products/new" className="btn btn-primary btn-sm">
                    Add Your First Product
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
