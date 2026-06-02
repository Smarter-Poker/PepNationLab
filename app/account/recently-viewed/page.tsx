import type React from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { History, ArrowLeft, Bookmark, Bell, ShieldCheck, Gift } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface ItemRow {
  product_id: string;
  agent_id: string | null;
  viewed_at: string;
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
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just Now';
  if (mins < 60) return `${mins} Minute${mins === 1 ? '' : 's'} Ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} Hour${hrs === 1 ? '' : 's'} Ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} Day${days === 1 ? '' : 's'} Ago`;
  return new Date(iso).toLocaleDateString();
}

export default async function RecentlyViewedPage() {
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

  const { data: rows } = await service
    .from('researcher_recently_viewed')
    .select('product_id, agent_id, viewed_at, products:product_id(id, name, image_url, category, base_cost, in_stock, unit_size, unit_measure, is_active, is_banned)')
    .eq('user_id', user.id)
    .order('viewed_at', { ascending: false })
    .limit(50);

  const productIds: string[] = ((rows as unknown as ItemRow[]) ?? []).map(r => r.product_id);
  const priceMap = new Map<string, number>();
  if (referringAgentId && productIds.length > 0) {
    const { data: agentProducts } = await service
      .from('agent_products')
      .select('product_id, retail_price, is_on_sale, sale_price')
      .eq('agent_id', referringAgentId)
      .in('product_id', productIds);
    for (const ap of agentProducts ?? []) {
      // retail_price is stored as a 10-pack price. Divide by 10 for per-vial display.
      const rawPrice = ap.is_on_sale && ap.sale_price != null ? Number(ap.sale_price) : Number(ap.retail_price);
      const price = rawPrice / 10;
      if (Number.isFinite(price) && price > 0) priceMap.set(ap.product_id, price);
    }
  }

  const items = ((rows as unknown as ItemRow[]) ?? []).filter(r => r.products && r.products.is_active && !r.products.is_banned);

  // ─── Trending Now ─────────────────────────────────────────
  // Top products by units sold in the last 60 days. Joined to the master
  // products table for image + category. Visible to everyone — the link
  // routes back to the researcher's referring agent storefront when known.
  interface TrendingRow {
    id: string;
    name: string;
    image_url: string | null;
    category: string | null;
  }
  const trending: TrendingRow[] = [];
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
      const byId = new Map<string, TrendingRow>();
      for (const p of (prods ?? []) as Array<{ id: string; name: string; image_url: string | null; category: string | null; is_active: boolean | null; is_banned: boolean | null }>) {
        if (p.is_active === false || p.is_banned === true) continue;
        byId.set(p.id, { id: p.id, name: p.name, image_url: p.image_url, category: p.category });
      }
      for (const pid of popIds) {
        if (trending.length >= 8) break;
        const row = byId.get(pid);
        if (row) trending.push(row);
      }
    }
  } catch {
    // Best-effort — render an empty section.
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--black)', padding: 'var(--space-6) var(--space-4)' }}>
      <div className="container" style={{ maxWidth: 880 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
          <History size={22} aria-hidden="true" style={{ color: 'var(--teal)' }} />
          <h1 className="animated-gradient-text" style={{ color: 'var(--white)', fontSize: '1.6rem', fontFamily: 'var(--font-brand)' }}>
            Recently Viewed
          </h1>
        </div>
        <p style={{ color: 'var(--silver)', fontSize: '0.92rem', marginBottom: 'var(--space-6)' }}>
          The Last 50 Products You Browsed.
        </p>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-6)',
          }}
        >
          <Link href="/account/wishlist" className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Bookmark size={12} aria-hidden="true" />
            Wishlist
          </Link>
          <Link href="/account/recently-viewed" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
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
          {isResearcher && (
            <Link href="/account/referrals" className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Gift size={12} aria-hidden="true" />
              Referrals
            </Link>
          )}
        </div>

        {items.length === 0 ? (
          <div className="card-metal hover-lift stagger-fade-in" style={{ padding: 'var(--space-8)', textAlign: 'center', animationDelay: '0.1s' }}>
            <History size={32} aria-hidden="true" style={{ marginBottom: 'var(--space-3)', color: 'var(--silver)' }} />
            <h2 style={{ color: 'var(--white)', fontSize: '1.1rem', marginBottom: 'var(--space-2)' }}>
              Nothing Here Yet
            </h2>
            <p style={{ color: 'var(--silver)', fontSize: '0.9rem' }}>
              Browse Products On A Storefront And They Will Appear Here For Quick Access.
            </p>
            {storefrontSlug && (
              <Link href={`/${storefrontSlug}`} className="btn btn-primary btn-sm" style={{ marginTop: 'var(--space-4)' }}>
                Browse The Catalog
              </Link>
            )}
          </div>
        ) : (
          <div className="card-metal hover-lift stagger-fade-in" style={{ padding: 0, overflow: 'hidden', animationDelay: '0.1s' }}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {items.map((item, idx) => {
                const price = priceMap.get(item.product_id) ?? item.products!.base_cost ?? 0;
                return (
                  <li
                    key={item.product_id}
                    className="table-row-hover"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-3) var(--space-4)',
                      borderTop: idx === 0 ? 'none' : '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        flexShrink: 0,
                        borderRadius: 8,
                        background: 'var(--surface-2)',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {item.products!.image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={item.products!.image_url}
                          alt={item.products!.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <span style={{ color: 'var(--grey-600)', fontSize: '0.6rem' }}>No Image</span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'var(--white)', fontWeight: 700, fontSize: '0.92rem' }}>
                        {item.products!.name}
                      </div>
                      <div style={{ color: 'var(--silver)', fontSize: '0.78rem' }}>
                        {item.products!.category ?? 'Research Compound'} - Viewed {timeAgo(item.viewed_at)}
                      </div>
                    </div>
                    {price > 0 && (
                      <div style={{ color: 'var(--teal)', fontWeight: 800, fontFamily: 'var(--font-brand)', fontSize: '1rem' }}>
                        ${price.toFixed(2)}
                      </div>
                    )}
                    {storefrontSlug && (
                      <Link href={`/${storefrontSlug}`} className="btn btn-secondary btn-sm">
                        View
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {trending.length > 0 && (
          <div className="card-metal hover-lift stagger-fade-in" style={{ marginTop: 'var(--space-6)', padding: 'var(--space-5) var(--space-5) var(--space-6)', animationDelay: '0.2s' }}>
            <h2 style={{ color: 'var(--white)', fontSize: '1.05rem', fontFamily: 'var(--font-brand)', marginBottom: 'var(--space-2)' }}>
              Trending Now
            </h2>
            <p style={{ color: 'var(--silver)', fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
              The Top Eight Products Researchers Have Ordered In The Last Sixty Days.
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 'var(--space-3)',
              }}
            >
              {trending.map((t) => {
                const inner = (
                  <>
                    <div
                      style={{
                        width: '100%',
                        aspectRatio: '1 / 1',
                        background: 'var(--black-2)',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 8,
                      }}
                    >
                      {t.image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={t.image_url}
                          alt={t.name}
                          style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }}
                        />
                      ) : (
                        <span style={{ color: 'var(--grey-600)', fontSize: '0.65rem' }}>No Image</span>
                      )}
                    </div>
                    <div
                      style={{
                        color: 'var(--white)',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        lineHeight: 1.25,
                        marginBottom: 4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {t.name}
                    </div>
                    {t.category && (
                      <div style={{ color: 'var(--grey-500)', fontSize: '0.7rem' }}>
                        {t.category}
                      </div>
                    )}
                  </>
                );
                const baseStyle: React.CSSProperties = {
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 10,
                  background: 'var(--surface-2)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 'var(--radius-lg)',
                  textDecoration: 'none',
                  color: 'var(--white)',
                };
                if (storefrontSlug) {
                  return (
                    <Link
                      key={t.id}
                      href={`/${storefrontSlug}?product=${encodeURIComponent(t.id)}`}
                      style={baseStyle}
                    >
                      {inner}
                    </Link>
                  );
                }
                return (
                  <div key={t.id} style={baseStyle}>
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Recently Viewed | Pep Nation Lab',
  robots: { index: false, follow: false },
};
