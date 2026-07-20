'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import DiscoveryHero, { type MatchedProduct } from './StorefrontDiscovery';
import { getProductImage } from '@/lib/categoryImage';
import { trackStorefrontEvent } from '@/lib/track';
import type { Compound } from '@/lib/compounds';
import GuestAuthModal from '@/components/GuestAuthModal';

interface ProductItem {
  id: string;
  product_id: string;
  custom_name: string | null;
  custom_description: string | null;
  custom_image_url: string | null;
  retail_price: number;
  products: {
    name: string;
    description: string;
    image_url: string | null;
    category: string;
    backorder_days: number;
    unit_size: string | null;
    unit_measure: string | null;
    weight_oz: number | null;
    inventory_count?: number | null;
    low_stock_threshold?: number | null;
    compound_slug?: string | null;
  };
}

interface Props {
  products: ProductItem[];
  agentSlug: string;
  primaryColor: string;
  compoundsBySlug: Record<string, Compound>;
  isStorefrontOwner: boolean;
  /** When true the user is not authenticated - hide pricing/cart, show sign-in nudge */
  isGuest?: boolean;
}

interface GroupedProduct {
  name: string;
  category: string;
  desc: string;
  imageUrl: string | null;
  variants: ProductItem[];
  lowestPrice: number;
  compoundSlug: string | null;
}

export default function FindAPeptideClient({
  products,
  agentSlug,
  primaryColor,
  compoundsBySlug,
  isStorefrontOwner,
  isGuest = false,
}: Props) {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<Record<string, number>>({});

  // Mirror of cartItems, read inside addToCart for the analytics decision only,
  // so addToCart's useCallback identity stays stable across cart mutations.
  const cartItemsRef = useRef<Record<string, number>>({});
  useEffect(() => { cartItemsRef.current = cartItems; }, [cartItems]);
  const firstCartSave = useRef(true);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [currentPath, setCurrentPath] = useState('');

  useEffect(() => {
    setCurrentPath(window.location.pathname + window.location.search);
  }, []);

  // Funnel step: pageview for the guided discovery surface (once per session
  // per path; dedupe lives in lib/track.ts).
  useEffect(() => {
    trackStorefrontEvent(agentSlug, 'pageview');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentSlug]);

  // Load cart on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`cart_${agentSlug}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          setCartItems(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, [agentSlug]);

  // Group products for resolving matches
  const grouped = useMemo(() => {
    const map = new Map<string, GroupedProduct>();
    products.forEach(item => {
      const name = item.products?.name ?? 'Research Compound';
      if (!map.has(name)) {
        map.set(name, {
          name,
          category: item.products?.category || 'Other',
          desc: item.custom_description ?? item.products?.description ?? '',
          imageUrl: getProductImage(
            item.custom_image_url ?? item.products?.image_url ?? null,
            item.products?.category || 'Other',
            name,
            !!item.custom_image_url,
            agentSlug
          ),
          variants: [],
          lowestPrice: item.retail_price || 0,
          compoundSlug: item.products?.compound_slug ?? null,
        });
      }
      const group = map.get(name)!;
      group.variants.push(item);
      if (item.retail_price < group.lowestPrice) {
        group.lowestPrice = item.retail_price;
      }
    });

    for (const group of map.values()) {
      group.variants.sort((a, b) => {
        const aSize = parseFloat(a.products?.unit_size || '0');
        const bSize = parseFloat(b.products?.unit_size || '0');
        return aSize - bSize;
      });
    }

    return Array.from(map.values());
  }, [products]);

  // Sync cart to localStorage and check out compatibility
  useEffect(() => {
    if (firstCartSave.current) {
      firstCartSave.current = false;
      return;
    }
    try {
      localStorage.setItem(`cart_${agentSlug}`, JSON.stringify(cartItems));

      const pnlCart = Object.entries(cartItems)
        .filter(([, qty]) => qty > 0)
        .map(([vId, qty]) => {
          const item = products.find(p => p.id === vId);
          if (!item) return null;
          const perVial = item.retail_price / 10;
          const costPerVial = isStorefrontOwner && (item as any).cost_price != null
            ? Number((item as any).cost_price) / 10
            : perVial;
          const sizeLabel = item.products?.unit_size
            ? `(${item.products.unit_size}${item.products.unit_measure || ''})`
            : '';
          return {
            id: item.product_id,
            name: `${item.products?.name || 'Product'} ${sizeLabel}`.trim(),
            sku: item.product_id,
            quantity: qty,
            retailPrice: perVial,
            costPrice: costPerVial,
            weightOz: Number(item.products?.weight_oz) || 0.5,
            agentSelfBuy: isStorefrontOwner,
          };
        }).filter(Boolean);

      localStorage.setItem(`pnl_storefront_cart_${agentSlug}`, JSON.stringify({
        items: pnlCart,
        _savedAt: Date.now(),
      }));
    } catch {
      // ignore
    }
  }, [cartItems, agentSlug, products, isStorefrontOwner]);

  const addToCart = useCallback((variantId: string) => {
    const item = products.find(p => p.id === variantId);
    if (!item) return;
    // Use ?? (not ||) so a genuine 0 (out of stock) blocks the add instead of
    // falling through to 999. Null/untracked inventory still means "unlimited".
    const maxQty = item.products?.inventory_count ?? 999;

    // Analytics decision only; the cap inside the updater stays authoritative.
    const wasCapped = (cartItemsRef.current[variantId] || 0) >= maxQty;

    setCartItems(prev => {
      const currentQty = prev[variantId] || 0;
      if (currentQty >= maxQty) {
        toast.error(`Maximum available stock (${maxQty}) reached.`);
        return prev;
      }
      toast.success(`${item.products?.name || 'Product'} Added To Cart`);
      return { ...prev, [variantId]: currentQty + 1 };
    });

    // Funnel step: the add_to_cart event the agent analytics view counts.
    if (!wasCapped) {
      trackStorefrontEvent(agentSlug, 'add_to_cart', {
        product_id: item.product_id,
        quantity: 1,
        amount_cents: Number.isFinite(Number(item.retail_price)) ? Math.round(Number(item.retail_price) * 100) : undefined,
      });
    }
  }, [products, agentSlug]);

  const resolveProducts = useCallback((slugs: string[]) => {
    const out: MatchedProduct[] = [];
    for (const slug of slugs) {
      const grp = grouped.find(g => g.compoundSlug === slug);
      if (!grp) {
        out.push({
          product_id: '',
          display_name: slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          compound_slug: slug,
          price_cents: 0,
          evidence_tier: null,
          rationale: '',
          image_url: null,
          in_stock: false,
        });
        continue;
      }
      const v0 = grp.variants[0];
      const priceDollars = grp.lowestPrice || 0;
      const evTier = compoundsBySlug?.[slug]?.evidence_tier ?? null;
      out.push({
        product_id: v0?.id || '',
        display_name: grp.name,
        compound_slug: slug,
        price_cents: Math.round(priceDollars * 100),
        evidence_tier: evTier,
        rationale: '',
        image_url: grp.imageUrl,
        // Derive from actual inventory so zero-stock products don't render a live
        // Add-To-Cart. Null/untracked inventory counts as available.
        in_stock: grp.variants.some(v => (v.products?.inventory_count ?? 1) > 0),
      });
    }
    return out;
  }, [grouped, compoundsBySlug]);

  const totalCartItems = useMemo(() => {
    return Object.values(cartItems).reduce((sum, qty) => sum + qty, 0);
  }, [cartItems]);

  return (
    <div style={{ position: 'relative', width: '100%', padding: '0 var(--space-4)', boxSizing: 'border-box' }}>
      <DiscoveryHero
        compoundsBySlug={compoundsBySlug}
        primaryColor={primaryColor}
        onSelectArea={(area) => {
          router.push(`/${agentSlug}?area=${encodeURIComponent(area)}`);
        }}
        onSearchStarted={(query) => {
          const q = (query || '').trim();
          if (q.length >= 2) trackStorefrontEvent(agentSlug, 'search', { search_term: q });
          router.push(`/${agentSlug}?q=${encodeURIComponent(q)}`);
        }}
        onAlreadyKnowClicked={() => {
          router.push(`/${agentSlug}`);
        }}
        onAddToCart={isGuest ? () => { setShowGuestModal(true); } : addToCart}
        onOpenProduct={(productId) => {
          router.push(`/${agentSlug}?product=${encodeURIComponent(productId)}`);
        }}
        resolveProducts={resolveProducts}
      />

      {/* Guest pricing nudge - shown below the discovery engine */}
      {isGuest && (
        <div
          style={{
            margin: '32px auto 80px',
            maxWidth: 600,
            background: 'linear-gradient(135deg, rgba(192,184,168,0.06) 0%, rgba(192,184,168,0.02) 100%)',
            border: '1px solid rgba(192,184,168,0.18)',
            borderRadius: 16,
            padding: '28px 24px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'rgba(192,184,168,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--teal,#C0B8A8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '1rem', color: '#FFFFFF' }}>
            Wholesale Pricing Is Exclusive To Members
          </p>
          <p style={{ margin: '0 0 20px', fontSize: '0.82rem', color: 'var(--silver,#A8B4C0)', lineHeight: 1.6 }}>
            Sign In Or Create An Account To See Wholesale Pricing, Add Items To Your Cart,
            And Checkout With Your Agent&apos;s Exclusive Rates.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href={`/login${currentPath ? `?redirect=${encodeURIComponent(currentPath)}` : ''}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '10px 24px',
                borderRadius: 8,
                background: 'var(--teal,#C0B8A8)',
                color: '#050A0F',
                fontWeight: 700,
                fontSize: '0.875rem',
                textDecoration: 'none',
              }}
            >
              Sign In
            </a>
            <a
              href={`/signup${currentPath ? `?redirect=${encodeURIComponent(currentPath)}` : ''}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '10px 20px',
                borderRadius: 8,
                background: 'transparent',
                border: '1px solid rgba(192,184,168,0.35)',
                color: 'var(--silver,#A8B4C0)',
                fontWeight: 600,
                fontSize: '0.875rem',
                textDecoration: 'none',
              }}
            >
              Create Account
            </a>
          </div>
        </div>
      )}
      {!isGuest && totalCartItems > 0 && (
        <Link
          href={`/checkout?agent=${encodeURIComponent(agentSlug)}`}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: '#C0C5CE',
            color: '#0A1018',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.1)',
            zIndex: 999,
            transition: 'transform 0.2s ease, background-color 0.2s ease',
            cursor: 'pointer',
          }}
          className="floating-cart-btn"
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.backgroundColor = '#DCD4C4';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.backgroundColor = '#C0C5CE';
          }}
        >
          <ShoppingCart size={24} />
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            background: '#00C4BC',
            color: '#000000',
            borderRadius: '50%',
            width: '22px',
            height: '22px',
            fontSize: '0.75rem',
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
          }}>
            {totalCartItems}
          </span>
        </Link>
      )}

      <GuestAuthModal
        open={showGuestModal}
        onClose={() => setShowGuestModal(false)}
        featureLabel="Purchasing"
      />
    </div>
  );
}
