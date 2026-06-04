import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { Heart, Bell, ShieldCheck, Gift } from 'lucide-react';
import LabJournalClient from './LabJournalClient';

export const dynamic = 'force-dynamic';

export default async function LabJournalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const service = await createServiceClient();

  const { data: profile } = await service
    .from('profiles')
    .select('role, referring_agent_id')
    .eq('id', user.id)
    .maybeSingle();
  const referringAgentId = profile?.referring_agent_id ?? null;
  const isResearcher = profile?.role === 'researcher';

  let storefrontSlug: string | null = null;
  if (referringAgentId) {
    const { data: agentRow } = await service
      .from('agent_profiles')
      .select('slug')
      .eq('id', referringAgentId)
      .maybeSingle();
    storefrontSlug = agentRow?.slug ?? null;
  }

  // --- Fetch Wishlist and Past Orders ---
  const { data: favRows } = await service
    .from('researcher_favorites')
    .select('product_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const { data: orderRows } = await service
    .from('orders')
    .select('created_at, order_items(product_id)')
    .eq('buyer_id', user.id)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false });

  const favProductIds = new Set<string>();
  for (const r of favRows ?? []) {
    if (r.product_id) favProductIds.add(r.product_id);
  }

  const pastOrderProducts = new Map<string, { date: string; count: number }>(); 
  for (const o of orderRows ?? []) {
    const items = o.order_items as { product_id: string }[];
    for (const item of items ?? []) {
      if (item.product_id) {
        const existing = pastOrderProducts.get(item.product_id);
        if (!existing) {
          pastOrderProducts.set(item.product_id, { date: o.created_at, count: 1 });
        } else {
          pastOrderProducts.set(item.product_id, { date: existing.date, count: existing.count + 1 });
        }
      }
    }
  }

  // --- Fetch Recently Viewed ---
  const { data: recentRows } = await service
    .from('researcher_recently_viewed')
    .select('product_id, agent_id, viewed_at')
    .eq('user_id', user.id)
    .order('viewed_at', { ascending: false })
    .limit(50);

  const recentlyViewedProducts = new Map<string, string>(); // product_id -> viewed_at
  for (const r of recentRows ?? []) {
    if (r.product_id && !recentlyViewedProducts.has(r.product_id)) {
      recentlyViewedProducts.set(r.product_id, r.viewed_at);
    }
  }

  // Collect ALL product IDs to fetch from master table
  const allProductIds = Array.from(new Set([
    ...favProductIds,
    ...pastOrderProducts.keys(),
    ...recentlyViewedProducts.keys()
  ]));

  const productsMap = new Map<string, any>();
  if (allProductIds.length > 0) {
    const { data: products } = await service
      .from('products')
      .select('id, name, image_url, category, base_cost, in_stock, unit_size, unit_measure, is_active, is_banned')
      .in('id', allProductIds);
    for (const p of products ?? []) {
      productsMap.set(p.id, p);
    }
  }

  const priceMap = new Map<string, { price: number; is_on_sale: boolean; agent_product_id: string }>();
  if (referringAgentId && allProductIds.length > 0) {
    const { data: agentProducts } = await service
      .from('agent_products')
      .select('id, product_id, retail_price, is_on_sale, sale_price')
      .eq('agent_id', referringAgentId)
      .in('product_id', allProductIds);
    for (const ap of agentProducts ?? []) {
      const rawPrice = ap.is_on_sale && ap.sale_price != null ? Number(ap.sale_price) : Number(ap.retail_price);
      const price = rawPrice / 10;
      if (Number.isFinite(price) && price > 0) {
        priceMap.set(ap.product_id, { 
          price, 
          is_on_sale: ap.is_on_sale === true,
          agent_product_id: ap.id
        });
      }
    }
  }

  const mapToItem = (p: any, additional?: any) => ({
    product_id: p.id,
    name: p.name,
    image_url: p.image_url,
    category: p.category,
    base_cost: p.base_cost,
    retail_price: priceMap.get(p.id)?.price ?? null,
    is_on_sale: priceMap.get(p.id)?.is_on_sale ?? false,
    agent_product_id: priceMap.get(p.id)?.agent_product_id ?? null,
    in_stock: p.in_stock,
    unit_size: p.unit_size,
    unit_measure: p.unit_measure,
    ...additional
  });

  const favorites = Array.from(favProductIds)
    .map(id => productsMap.get(id))
    .filter(p => p && p.is_active && !p.is_banned)
    .map(p => mapToItem(p));

  const pastOrders = Array.from(pastOrderProducts.entries())
    .map(([id, data]) => ({ p: productsMap.get(id), data }))
    .filter(({ p }) => p && p.is_active && !p.is_banned)
    .map(({ p, data }) => mapToItem(p, { last_purchased_date: data.date, purchase_count: data.count }));

  const recentlyViewed = Array.from(recentlyViewedProducts.entries())
    .map(([id, date]) => ({ p: productsMap.get(id), date }))
    .filter(({ p }) => p && p.is_active && !p.is_banned)
    .map(({ p, date }) => mapToItem(p, { viewed_at: date }));

  const categories = Array.from(new Set(
    [...favorites, ...pastOrders, ...recentlyViewed]
      .map(i => i.category)
      .filter(Boolean)
  )) as string[];

  // --- Trending Now ---
  const trending: any[] = [];
  try {
    const { data: pop } = await service
      .from('product_popular_60d')
      .select('product_id, units')
      .order('units', { ascending: false })
      .limit(24);
    const popIds = ((pop ?? []) as Array<{ product_id: string }>).map(r => r.product_id);
    if (popIds.length > 0) {
      const { data: prods } = await service
        .from('products')
        .select('id, name, image_url, category, is_active, is_banned')
        .in('id', popIds);
      const byId = new Map<string, any>();
      for (const p of prods ?? []) {
        if (p.is_active === false || p.is_banned === true) continue;
        byId.set(p.id, { id: p.id, name: p.name, image_url: p.image_url, category: p.category });
      }
      for (const pid of popIds) {
        if (trending.length >= 8) break;
        const row = byId.get(pid);
        if (row) trending.push(row);
      }
    }
  } catch {}

  // --- Bundles ---
  let bundles: any[] = [];
  try {
    const { data: bData } = await service
      .from('products')
      .select('id, name, image_url, category, base_cost, unit_size, unit_measure, in_stock')
      .eq('category', 'Peptide Stacks')
      .eq('is_active', true)
      .eq('is_banned', false);
      
    if (bData) {
      bundles = bData.map((p: any) => ({
        product_id: p.id,
        name: p.name,
        image_url: p.image_url,
        category: p.category,
        base_cost: p.base_cost,
        retail_price: null,
        in_stock: p.in_stock,
        unit_size: p.unit_size,
        unit_measure: p.unit_measure,
      }));
    }
  } catch {}

  
  // --- Catalog for Stack Builder ---
  let catalog: any[] = [];
  try {
    const { data: cData } = await service
      .from('products')
      .select('id, name, image_url, category, base_cost, unit_size, unit_measure, in_stock')
      .neq('category', 'Peptide Stacks')
      .eq('is_active', true)
      .eq('is_banned', false)
      .order('name');
      
    if (cData) {
      catalog = cData.map((p: any) => ({
        product_id: p.id,
        name: p.name,
        image_url: p.image_url,
        category: p.category,
        base_cost: p.base_cost,
        retail_price: null,
        in_stock: p.in_stock,
        unit_size: p.unit_size,
        unit_measure: p.unit_measure,
      }));
    }
  } catch {}

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--black)', padding: 'var(--space-6) var(--space-4)' }}>
      <div className="container" style={{ maxWidth: 1080 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
          <Heart size={22} aria-hidden="true" style={{ color: 'var(--teal)' }} />
          <h1 className="animated-gradient-text" style={{ color: 'var(--white)', fontSize: '1.6rem', fontFamily: 'var(--font-brand)' }}>
            Lab Journal
          </h1>
        </div>
        <p style={{ color: 'var(--silver)', fontSize: '0.92rem', marginBottom: 'var(--space-6)' }}>
          Your Saved Compounds, Browsing History, And Past Orders All In One Place.
        </p>



        <LabJournalClient 
          favorites={favorites} 
          pastOrders={pastOrders} 
          recentlyViewed={recentlyViewed} 
          trending={trending}
          bundles={bundles}
          catalog={catalog}
          categories={categories}
          storefrontSlug={storefrontSlug} 
        />
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Lab Journal | Pep Nation Lab',
  robots: { index: false, follow: false },
};
