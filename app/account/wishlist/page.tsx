import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { Heart, ArrowLeft, Bookmark, History, Bell, ShieldCheck, CreditCard } from 'lucide-react';
import WishlistClient from './WishlistClient';

export const dynamic = 'force-dynamic';

export default async function WishlistPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const service = await createServiceClient();

  const { data: profile } = await service
    .from('profiles')
    .select('referring_agent_id')
    .eq('id', user.id)
    .maybeSingle();
  const referringAgentId = profile?.referring_agent_id ?? null;

  let storefrontSlug: string | null = null;
  if (referringAgentId) {
    const { data: agentRow } = await service
      .from('agent_profiles')
      .select('slug')
      .eq('id', referringAgentId)
      .maybeSingle();
    storefrontSlug = agentRow?.slug ?? null;
  }

  const { data: rows } = await service
    .from('researcher_favorites')
    .select('product_id, created_at, products:product_id(id, name, image_url, category, base_cost, in_stock, unit_size, unit_measure, is_active, is_banned)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  type Row = {
    product_id: string;
    created_at: string;
    products: {
      id: string;
      name: string;
      image_url: string | null;
      category: string | null;
      base_cost: number | null;
      in_stock: boolean | null;
      unit_size: string | null;
      unit_measure: string | null;
      is_active: boolean | null;
      is_banned: boolean | null;
    } | null;
  };

  const productIds: string[] = ((rows as unknown as Row[]) ?? []).map(r => r.product_id);
  const priceMap = new Map<string, number>();
  if (referringAgentId && productIds.length > 0) {
    const { data: agentProducts } = await service
      .from('agent_products')
      .select('product_id, retail_price, is_on_sale, sale_price')
      .eq('agent_id', referringAgentId)
      .in('product_id', productIds);
    for (const ap of agentProducts ?? []) {
      const price = ap.is_on_sale && ap.sale_price != null ? Number(ap.sale_price) : Number(ap.retail_price);
      if (Number.isFinite(price) && price > 0) priceMap.set(ap.product_id, price);
    }
  }

  const items = ((rows as unknown as Row[]) ?? [])
    .filter(r => r.products && r.products.is_active && !r.products.is_banned)
    .map(r => ({
      product_id: r.product_id,
      name: r.products!.name,
      image_url: r.products!.image_url,
      category: r.products!.category,
      base_cost: r.products!.base_cost,
      retail_price: priceMap.get(r.product_id) ?? null,
      in_stock: r.products!.in_stock,
      unit_size: r.products!.unit_size,
      unit_measure: r.products!.unit_measure,
    }));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--black)', padding: 'var(--space-6) var(--space-4)' }}>
      <div className="container" style={{ maxWidth: 1080 }}>
        <Link href="/account" className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 'var(--space-3)' }}>
          <ArrowLeft size={14} aria-hidden="true" />
          Back To Account
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
          <Heart size={22} aria-hidden="true" style={{ color: 'var(--teal)' }} />
          <h1 style={{ color: 'var(--white)', fontSize: '1.6rem', fontFamily: 'var(--font-brand)' }}>
            Your Wishlist
          </h1>
        </div>
        <p style={{ color: 'var(--silver)', fontSize: '0.92rem', marginBottom: 'var(--space-6)' }}>
          Products You Have Saved For Later.
        </p>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-6)',
          }}
        >
          <Link href="/account/wishlist" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Bookmark size={12} aria-hidden="true" />
            Wishlist
          </Link>
          <Link href="/account/recently-viewed" className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <History size={12} aria-hidden="true" />
            Recently Viewed
          </Link>
          <Link href="/account/notifications" className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Bell size={12} aria-hidden="true" />
            Notifications
          </Link>
          <Link href="/account/security" className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={12} aria-hidden="true" />
            Security
          </Link>
          <Link href="/account/credits" className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <CreditCard size={12} aria-hidden="true" />
            Credits
          </Link>
        </div>

        <WishlistClient initialItems={items} storefrontSlug={storefrontSlug} />
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Your Wishlist | Pep Nation Lab',
  robots: { index: false, follow: false },
};
