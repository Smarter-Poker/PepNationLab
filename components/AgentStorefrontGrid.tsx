'use client';

import React, { useState, useMemo, useCallback, useEffect, useDeferredValue } from 'react';
import { motion, Variants, AnimatePresence } from 'framer-motion';
import { Star, X, Heart, FileText } from 'lucide-react';

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
    inventory_count?: number | null;
    low_stock_threshold?: number | null;
  };
}

type StockState =
  | { kind: 'in_stock' }
  | { kind: 'low_stock'; count: number }
  | { kind: 'backorder'; days: number }
  | { kind: 'out_of_stock' };

function computeStockState(
  agentCount: number,
  masterInventory: number,
  threshold: number,
  backorderDays: number
): StockState {
  if (agentCount > threshold) return { kind: 'in_stock' };
  if (agentCount > 0) return { kind: 'low_stock', count: agentCount };
  // agentCount === 0 (or negative — clamp to 0 for display)
  if (masterInventory > 0) return { kind: 'in_stock' };
  if (backorderDays > 0) return { kind: 'backorder', days: backorderDays };
  return { kind: 'out_of_stock' };
}

function StockBadge({ state }: { state: StockState }) {
  let bg = 'rgba(192,184,168,0.15)';
  let fg = '#C0B8A8';
  let border = 'rgba(192,184,168,0.40)';
  let label = 'In Stock';
  if (state.kind === 'low_stock') {
    bg = 'rgba(246,173,85,0.15)';
    fg = '#F6AD55';
    border = 'rgba(246,173,85,0.40)';
    label = `Only ${state.count} Left`;
  } else if (state.kind === 'backorder') {
    bg = 'rgba(168,180,192,0.15)';
    fg = '#A8B4C0';
    border = 'rgba(168,180,192,0.40)';
    label = `Backordered: Ships In ${state.days} Days`;
  } else if (state.kind === 'out_of_stock') {
    bg = 'rgba(229,62,62,0.15)';
    fg = '#E53E3E';
    border = 'rgba(229,62,62,0.40)';
    label = 'Out Of Stock';
  }
  return (
    <span
      className="stock-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: '0.65rem',
        fontWeight: 800,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        padding: '4px 10px',
        borderRadius: 9999,
        background: bg,
        color: fg,
        border: `1px solid ${border}`,
        backdropFilter: 'blur(4px)',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

export interface BundleConfig {
  id: string;
  name: string;
  description?: string;
  product_ids: string[];
  price: number;
}

interface Props {
  products: ProductItem[];
  inventoryMap: Record<string, number>;
  primaryColor: string;
  agentSlug: string;
  bundles?: BundleConfig[];
  /** Set of product_ids the researcher already has in their wishlist. */
  initialWishlistIds?: string[];
  /** Agent profile id used when logging recently-viewed rows. */
  agentId?: string | null;
  /** product_id -> public URL of the most-recent active lot's COA document. */
  coaByProductId?: Record<string, string>;
  /** When false, volume tier markups are not applied — all quantities use the base per-vial price. */
  volumePricingEnabled?: boolean;
  /** True when the logged-in user IS the agent who owns this store (agent self-buy). */
  isStorefrontOwner?: boolean;
  /** The viewer's pricing tier — used to compute agent-direct cost for self-buy. */
  viewerTier?: string;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

interface GroupedProduct {
  name: string;
  category: string;
  desc: string;
  imageUrl: string | null;
  variants: ProductItem[];
  lowestPrice: number;
  popularity: number;
  defaultVariantId: string;
}

// Top 20 most popular peptides (definitive ranking by market demand)
const POPULAR_ORDER: string[] = [
  'Tirzepatide',                              // #1  - Mainstream Giant
  'Semaglutide',                              // #2  - Household Name
  'BPC 157',                                  // #3  - The Healing Standard
  'CJC-1295 without DAC 5mg + IPA 5mg',      // #4  - Premier Anti-Aging Combo
  'TB500 (Thymosin B4 Acetate)',              // #5  - Elite Recovery
  'BPC 10mg + TB 10mg',                       // #6  - The "Wolverine" Blend
  'GHK-CU',                                   // #7  - Cosmetics & Hair Leader
  'Retatrutide',                              // #8  - Next-Gen Triple Agonist
  'GLOW (TB10+BPC10+GHK50)',                  // #9  - Esthetic/Repair Stack
  'PT-141',                                   // #10 - Lifestyle Standard
  'MT-2 (Melanotan 2 Acetate)',               // #11 - Niche Tanning Favorite
  'Ipamorelin',                               // #12 - Core Growth Peptide
  'KLOW (TB10+BPC10+GHK50+KPV10)',            // #13 - Advanced Evolution Stack
  'Tesamorelin',                              // #14 - Visceral Fat Burner
  'AOD9604',                                  // #15 - Pure Lipolysis
  'Sermorelin Acetate',                       // #16 - Trusted Vintage Choice
  'HGH Fragment 176-191',                     // #17 - Bodybuilding Staple
  'KPV',                                      // #18 - GI & Autoimmune Specialist
  'Semax',                                    // #19 - Nootropic Focus
  'Selank',                                   // #20 - Nootropic Anxiety Relief
];

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

// Format price with two decimal places
function formatPrice(price: number): string {
  return price.toFixed(2);
}

// Split product names like "GLOW (TB10+BPC10+GHK50)" into main + subtitle
function splitProductName(name: string): { main: string; subtitle: string | null } {
  const match = name.match(/^([^(]+?)\s*\((.+)\)\s*$/);
  if (match) {
    return { main: match[1].trim(), subtitle: `(${match[2].trim()})` };
  }
  return { main: name, subtitle: null };
}

// Pick the best default variant: prefer 10mg, else closest above, else first
function pickDefaultVariant(variants: ProductItem[]): string {
  // Try to find exactly 10
  const ten = variants.find(v => parseFloat(v.products?.unit_size || '0') === 10);
  if (ten) return ten.id;
  // Try closest size >= 10
  const above = variants.filter(v => parseFloat(v.products?.unit_size || '0') >= 10)
    .sort((a, b) => parseFloat(a.products?.unit_size || '0') - parseFloat(b.products?.unit_size || '0'));
  if (above.length > 0) return above[0].id;
  // Fallback to largest available
  return variants[variants.length - 1]?.id || variants[0].id;
}

export default function AgentStorefrontGrid({ products, inventoryMap, primaryColor, agentSlug, bundles = [], initialWishlistIds = [], agentId = null, coaByProductId = {}, volumePricingEnabled = true, isStorefrontOwner = false, viewerTier = 'tier_3' }: Props) {
  const [wishlist, setWishlist] = useState<Set<string>>(() => new Set(initialWishlistIds));
  const toggleWishlist = useCallback(async (productId: string) => {
    if (!productId) return;
    const isAdding = !wishlist.has(productId);
    setWishlist(prev => {
      const next = new Set(prev);
      if (isAdding) next.add(productId);
      else next.delete(productId);
      return next;
    });
    try {
      const res = await fetch('/api/researcher/wishlist', {
        method: isAdding ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ productId }),
      });
      if (!res.ok) {
        // Revert optimistic state on failure
        setWishlist(prev => {
          const next = new Set(prev);
          if (isAdding) next.delete(productId);
          else next.add(productId);
          return next;
        });
      }
    } catch {
      setWishlist(prev => {
        const next = new Set(prev);
        if (isAdding) next.delete(productId);
        else next.add(productId);
        return next;
      });
    }
  }, [wishlist]);

  const logRecentlyViewed = useCallback((productId: string) => {
    if (!productId) return;
    try {
      void fetch('/api/researcher/recently-viewed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ productId, agentId }),
        keepalive: true,
      });
    } catch {
      // Best-effort — never block UI
    }
  }, [agentId]);

  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);
  const [sortBy, setSortBy] = useState<'popular' | 'name_asc' | 'name_desc' | 'price_low' | 'price_high'>('popular');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [detailProduct, setDetailProduct] = useState<GroupedProduct | null>(null);
  const [cartItems, setCartItems] = useState<Record<string, number>>({});
  const [showCartFloat, setShowCartFloat] = useState(false);
  const [cartToast, setCartToast] = useState(false);
  const [showBulkPricing, setShowBulkPricing] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`cart_${agentSlug}`);
      if (saved) setCartItems(JSON.parse(saved));
    } catch { /* ignore */ }
  }, [agentSlug]);

  // Save cart to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(`cart_${agentSlug}`, JSON.stringify(cartItems));
    } catch { /* ignore */ }
  }, [cartItems, agentSlug]);

  // Group products by name
  const grouped = useMemo(() => {
    const map = new Map<string, GroupedProduct>();
    products.forEach(item => {
      const name = item.products?.name ?? 'Research Compound';
      if (!map.has(name)) {
        map.set(name, {
          name,
          category: item.products?.category || 'Other',
          desc: item.custom_description ?? item.products?.description ?? '',
          imageUrl: item.custom_image_url ?? item.products?.image_url ?? null,
          variants: [],
          lowestPrice: Infinity,
          popularity: POPULAR_ORDER.indexOf(name),
          defaultVariantId: '',
        });
      }
      const group = map.get(name)!;
      group.variants.push(item);
      if (item.retail_price < group.lowestPrice) group.lowestPrice = item.retail_price;
    });
    for (const group of map.values()) {
      group.variants.sort((a, b) => {
        const aSize = parseFloat(a.products?.unit_size || '0');
        const bSize = parseFloat(b.products?.unit_size || '0');
        return aSize - bSize;
      });
      if (group.popularity === -1) group.popularity = 999;
      group.defaultVariantId = pickDefaultVariant(group.variants);
    }
    return Array.from(map.values());
  }, [products]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    grouped.forEach(g => cats.add(g.category));
    return Array.from(cats).sort();
  }, [grouped]);

  const filteredProducts = useMemo(() => {
    let result = grouped;
    if (filterCategory === 'on_sale') {
      result = result.filter(g => g.variants.some(v => (v as any).is_on_sale));
    } else if (filterCategory !== 'all') result = result.filter(g => g.category === filterCategory);
    if (deferredSearch.trim()) {
      const q = deferredSearch.trim().toLowerCase();
      result = result.filter(g => g.name.toLowerCase().includes(q));
    }
    switch (sortBy) {
      case 'popular': result = [...result].sort((a, b) => a.popularity - b.popularity); break;
      case 'name_asc': result = [...result].sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'name_desc': result = [...result].sort((a, b) => b.name.localeCompare(a.name)); break;
      case 'price_low': result = [...result].sort((a, b) => a.lowestPrice - b.lowestPrice); break;
      case 'price_high': result = [...result].sort((a, b) => b.lowestPrice - a.lowestPrice); break;
    }
    return result;
  }, [grouped, filterCategory, deferredSearch, sortBy]);

  const addToCart = useCallback((variantId: string) => {
    setCartItems(prev => ({ ...prev, [variantId]: (prev[variantId] || 0) + 1 }));
  }, []);

  const totalCartItems = Object.values(cartItems).reduce((sum, qty) => sum + qty, 0);

  if (!products || products.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>
        <p style={{ color: 'var(--grey-400)', marginBottom: 'var(--space-6)', fontSize: '1.1rem' }}>
          Research Compounds Are Coming Soon. Create An Account To Be Notified.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Search & Filter Bar */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center',
        padding: 'var(--space-4)', background: 'rgba(255,255,255,0.03)',
        borderRadius: 'var(--radius-lg)', border: '1px solid rgba(255,255,255,0.06)',
        marginBottom: 'var(--space-3)'
      }}>
        <div style={{ flex: '1 1 240px', position: 'relative' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--grey-400)" strokeWidth="2"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text" placeholder="Search Peptides..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px 10px 36px',
              background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 'var(--radius-md)', color: 'var(--white)', fontSize: '0.9rem', outline: 'none'
            }}
          />
        </div>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-md)', color: 'var(--white)', fontSize: '0.85rem', cursor: 'pointer', minWidth: 160 }}>
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
          <option value="on_sale">On Sale</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
          style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-md)', color: 'var(--white)', fontSize: '0.85rem', cursor: 'pointer', minWidth: 150 }}>
          <option value="popular">Most Popular</option>
          <option value="name_asc">A to Z</option>
          <option value="name_desc">Z to A</option>
          <option value="price_low">Price: Low to High</option>
          <option value="price_high">Price: High to Low</option>
        </select>
      </div>

      {/* Research Bundles */}
      {bundles && bundles.length > 0 && (
        <div style={{ marginTop: 0 }}>
          <h3 style={{ fontFamily: 'var(--font-brand)', fontSize: '1.05rem', color: 'var(--white)', marginBottom: 'var(--space-4)', letterSpacing: '0.03em' }}>
            Research Bundles
          </h3>
          <div className="grid-3" style={{ gap: 'var(--space-6)' }}>
            {bundles.map((bundle) => {
              const productNames = bundle.product_ids
                .map((pid) => {
                  const item = products.find((p) => p.id === pid || p.product_id === pid);
                  return item?.products?.name || item?.custom_name || null;
                })
                .filter(Boolean) as string[];
              return (
                <div
                  key={bundle.id}
                  className="card-metal"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 'var(--space-5)',
                    background: `linear-gradient(180deg, ${primaryColor}10 0%, var(--surface-2) 100%)`,
                    border: `1px solid ${primaryColor}30`,
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: `0 8px 32px rgba(0,0,0,0.4)`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                    <h4 style={{
                      fontFamily: 'var(--font-brand)',
                      fontSize: '1.1rem',
                      color: 'var(--white)',
                      letterSpacing: '0.02em',
                      lineHeight: 1.2,
                    }}>
                      {bundle.name}
                    </h4>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-full)',
                      background: `${primaryColor}20`,
                      border: `1px solid ${primaryColor}40`,
                      color: primaryColor,
                      whiteSpace: 'nowrap',
                    }}>
                      Bundle
                    </span>
                  </div>

                  {bundle.description && (
                    <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', lineHeight: 1.5, marginBottom: 'var(--space-3)' }}>
                      {bundle.description}
                    </p>
                  )}

                  {productNames.length > 0 && (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {productNames.map((n) => (
                        <li key={n} style={{ fontSize: '0.78rem', color: 'var(--silver)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: primaryColor }} />
                          {n}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 'auto',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    paddingTop: 'var(--space-4)',
                  }}>
                    <span style={{
                      fontSize: '1.3rem',
                      fontWeight: 800,
                      color: primaryColor,
                      fontFamily: 'var(--font-brand)',
                      textShadow: `0 0 10px ${primaryColor}40`,
                    }}>
                      ${formatPrice(bundle.price)}
                    </span>
                    <span style={{
                      fontSize: '0.72rem',
                      color: 'var(--grey-400)',
                      fontStyle: 'italic',
                    }}>
                      Bundle Pricing Available At Checkout
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Product Grid */}
      <motion.div
        className="grid-3" style={{ gap: 'var(--space-6)' }}
        variants={containerVariants} initial="hidden" animate="show"
        key={`${filterCategory}-${sortBy}-${searchQuery}`}
      >
        {filteredProducts.map((group) => {
          const selectedVariantId = selectedVariants[group.name] || group.defaultVariantId;
          const activeVariant = group.variants.find(v => v.id === selectedVariantId) || group.variants[0];

          // Stock state — based on the variant the storefront initially shows
          // (the picked default). Master inventory + backorder come from
          // the master products row, agent count from inventoryMap.
          const stockAgentCount = Math.max(0, Number(inventoryMap[activeVariant.product_id] ?? 0));
          const stockMasterInventory = Math.max(0, Number(activeVariant.products?.inventory_count ?? 0));
          const stockThreshold = Math.max(0, Number(activeVariant.products?.low_stock_threshold ?? 5));
          const stockBackorder = Math.max(0, Number(activeVariant.products?.backorder_days ?? 0));
          const stockState = computeStockState(stockAgentCount, stockMasterInventory, stockThreshold, stockBackorder);

          return (
            <motion.div
              key={group.name} className="card-metal message-card-hover" variants={itemVariants}
              style={{
                display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0,
                background: 'linear-gradient(180deg, var(--surface-2) 0%, rgba(10, 16, 24, 0.8) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.04)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                borderRadius: 'var(--radius-lg)', cursor: 'pointer'
              }}
              onClick={() => {
                setDetailProduct(group);
                logRecentlyViewed(activeVariant.product_id);
                // Auto-init cart to 10 vials when modal opens (if not already in cart)
                const defaultVId = group.defaultVariantId || group.variants[0]?.id;
                if (defaultVId && !cartItems[defaultVId]) {
                  setCartItems(prev => ({ ...prev, [defaultVId]: 10 }));
                }
              }}
            >
              {/* Product Image */}
              <div style={{
                height: 220,
                background: `radial-gradient(circle at 50% 50%, ${primaryColor}20 0%, var(--black) 100%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                borderBottom: '1px solid rgba(255,255,255,0.02)', position: 'relative'
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${primaryColor}50, transparent)` }} />

                {/* Wishlist Heart Button — top right of card image */}
                {(() => {
                  const wished = wishlist.has(activeVariant.product_id);
                  return (
                    <button
                      type="button"
                      aria-label={wished ? 'Remove From Wishlist' : 'Add To Wishlist'}
                      onClick={e => { e.stopPropagation(); void toggleWishlist(activeVariant.product_id); }}
                      style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        width: 34,
                        height: 34,
                        borderRadius: '50%',
                        background: wished ? 'rgba(229,62,62,0.20)' : 'rgba(0,0,0,0.55)',
                        border: `1px solid ${wished ? 'rgba(229,62,62,0.50)' : 'rgba(255,255,255,0.15)'}`,
                        color: wished ? '#FF5A6E' : 'var(--silver)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backdropFilter: 'blur(6px)',
                        cursor: 'pointer',
                        zIndex: 5,
                        transition: 'transform 0.15s ease',
                      }}
                    >
                      <Heart size={16} fill={wished ? '#FF5A6E' : 'none'} aria-hidden="true" />
                    </button>
                  );
                })()}

                {group.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={group.imageUrl} alt={group.name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', padding: '8px', transition: 'transform 0.4s ease' }}
                    className="store-image-hover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', opacity: 0.5 }}>
                    <svg width="64" height="64" viewBox="0 0 60 60" fill="none">
                      <circle cx="30" cy="30" r="12" fill="none" stroke={primaryColor} strokeWidth="2"/>
                      <path d="M30 18v-8M30 50v-8M18 30h-8M50 30h-8" stroke="var(--silver)" strokeWidth="2" strokeLinecap="round"/>
                      <circle cx="30" cy="30" r="24" fill="none" stroke="var(--silver)" strokeWidth="1" strokeDasharray="4 4"/>
                    </svg>
                    <span style={{ fontSize: '0.75rem', color: 'var(--silver)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Image Coming Soon</span>
                  </div>
                )}

                {/* Popular badge — teal */}
                {group.popularity < 20 && (
                  <div style={{
                    position: 'absolute', top: 12, left: 12,
                    fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                    padding: '4px 10px', borderRadius: 'var(--radius-full)',
                    background: 'rgba(192,184,168,0.15)', border: '1px solid rgba(192,184,168,0.4)',
                    color: 'var(--teal)', backdropFilter: 'blur(4px)'
                  }}>
                    <Star size={10} fill="currentColor" aria-hidden="true" style={{ marginRight: 4, verticalAlign: 'middle' }} />Popular
                  </div>
                )}

                {/* On Sale badge — red, right side */}
                {group.variants.some(v => (v as any).is_on_sale) && (
                  <div style={{
                    position: 'absolute', top: 12, right: 12,
                    fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                    padding: '4px 10px', borderRadius: 'var(--radius-full)',
                    background: 'rgba(245,101,101,0.15)', border: '1px solid rgba(245,101,101,0.4)',
                    color: '#F56565', backdropFilter: 'blur(4px)'
                  }}>
                    Sale
                  </div>
                )}

                {/* Stock badge — bottom left, hidden for default "In Stock" (cleaner look). */}
                {stockState.kind !== 'in_stock' && (
                  <div style={{ position: 'absolute', bottom: 12, left: 12 }}>
                    <StockBadge state={stockState} />
                  </div>
                )}
              </div>

              {/* Product Details */}
              <div style={{ padding: 'var(--space-5)', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                {(() => {
                  const { main, subtitle } = splitProductName(group.name);
                  return (
                    <div style={{ textAlign: 'center', marginBottom: 'var(--space-2)' }}>
                      <h4 style={{
                        fontFamily: 'var(--font-brand)',
                        fontSize: '1.15rem', color: 'var(--white)', letterSpacing: '0.02em', lineHeight: 1.2,
                        marginBottom: subtitle ? 2 : 0
                      }}>
                        {main}
                      </h4>
                      {subtitle && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--grey-400)', fontWeight: 500 }}>
                          {subtitle}
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* Summary Line — click card to open detail + add to cart */}
                <div style={{
                  marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 'var(--space-4)',
                  textAlign: 'center'
                }}>
                  {(() => {
                    const defaultV = group.variants.find(v => v.id === group.defaultVariantId) || group.variants[0];
                    const size = defaultV.products?.unit_size || '10';
                    const measure = defaultV.products?.unit_measure || 'mg';
                    // retail_price is the 10-pack price; divide by 10 for individual vial price
                    const perVialBase = defaultV.retail_price / 10;
                    const isOnSale = (defaultV as any).is_on_sale && (defaultV as any).sale_price;
                    const perVialDisplay = isOnSale ? (defaultV as any).sale_price / 10 : perVialBase;
                    const perVialOriginal = perVialBase;
                    return (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                          {isOnSale && (
                            <span style={{ fontSize: '0.95rem', color: 'var(--grey-500)', textDecoration: 'line-through', fontWeight: 600 }}>
                              ${perVialOriginal.toFixed(2)}
                            </span>
                          )}
                          <span style={{
                            fontSize: '1.2rem', fontWeight: 800, color: isOnSale ? '#F56565' : primaryColor,
                            fontFamily: 'var(--font-brand)', textShadow: `0 0 10px ${isOnSale ? 'rgba(245,101,101,0.4)' : primaryColor + '40'}`
                          }}>
                            {size}{measure} Vials &nbsp;${perVialDisplay.toFixed(2)}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
      {/* Floating Cart — Bottom Right Corner */}
      <div style={{ position: 'fixed', bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))', right: 24, zIndex: 900 }}>
        <button
          onClick={() => {
            if (totalCartItems === 0) {
              setCartToast(true);
              setTimeout(() => setCartToast(false), 2500);
            } else {
              setShowCartFloat(!showCartFloat);
            }
          }}
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: totalCartItems > 0 ? primaryColor : 'var(--surface-2)',
            border: totalCartItems > 0 ? 'none' : '1px solid rgba(255,255,255,0.15)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: totalCartItems > 0 ? `0 4px 20px ${primaryColor}60` : '0 4px 20px rgba(0,0,0,0.4)',
            position: 'relative', transition: 'transform 0.2s ease'
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--white)" strokeWidth="2.5">
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
          </svg>
          {totalCartItems > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4, width: 22, height: 22,
              borderRadius: '50%', background: 'var(--red)', color: 'var(--white)',
              fontSize: '0.7rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {totalCartItems}
            </span>
          )}
        </button>

          {/* Cart dropdown */}
          <AnimatePresence>
            {showCartFloat && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                style={{
                  position: 'absolute', bottom: 68, right: 0,
                  width: 'min(300px, 85vw)',
                  background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 'var(--radius-lg)', boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
                  overflow: 'hidden'
                }}
              >
                <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: 700, color: 'var(--white)', fontSize: '0.9rem' }}>
                  Cart ({totalCartItems} Items)
                </div>
                <div style={{ maxHeight: 240, overflowY: 'auto', padding: '8px 0' }}>
                  {Object.entries(cartItems).map(([variantId, qty]) => {
                    const item = products.find(p => p.id === variantId);
                    if (!item) return null;
                    const name = item.products?.name || 'Product';
                    const size = item.products?.unit_size ? `${item.products.unit_size}${item.products.unit_measure || ''}` : '';
                    return (
                      <div key={variantId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--white)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {name} {size && `(${size})`}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--grey-400)' }}>
                            ${formatPrice(item.retail_price)} x {qty}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button onClick={() => setCartItems(prev => {
                            const next = { ...prev };
                            if (next[variantId] <= 1) delete next[variantId];
                            else next[variantId]--;
                            return next;
                          })} style={{
                            width: 36, height: 36, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)',
                            background: 'transparent', color: 'var(--white)', cursor: 'pointer', fontSize: '0.85rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, touchAction: 'manipulation'
                          }}>-</button>
                          <span style={{ color: 'var(--white)', fontWeight: 700, fontSize: '0.8rem', minWidth: 20, textAlign: 'center' }}>{qty}</span>
                          <button onClick={() => addToCart(variantId)} style={{
                            width: 36, height: 36, borderRadius: '50%', border: 'none',
                            background: primaryColor, color: 'var(--white)', cursor: 'pointer', fontSize: '0.85rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800,
                            flexShrink: 0, touchAction: 'manipulation'
                          }}>+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--grey-400)', marginBottom: 4 }}>
                    <span>Total</span>
                    <span style={{ color: 'var(--white)', fontWeight: 700 }}>
                      ${Object.entries(cartItems).reduce((sum, [vId, qty]) => {
                        const item = products.find(p => p.id === vId);
                        return sum + (item ? (item.retail_price / 10) * qty : 0);
                      }, 0).toFixed(2)}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      // Translate storefront cartItems (Record<variantId, qty>) →
                      // CartItem[] format that CheckoutForm reads from
                      // localStorage[`pnl_storefront_cart_${agentSlug}`].
                      const pnlCart = Object.entries(cartItems)
                        .filter(([, qty]) => qty > 0)
                        .map(([vId, qty]) => {
                          const item = products.find(p => p.id === vId);
                          if (!item) return null;
                          const perVial = item.retail_price / 10;
                          const sizeLabel = item.products?.unit_size
                            ? `(${item.products.unit_size}${item.products.unit_measure || ''})`
                            : '';
                          return {
                            // IMPORTANT: orders API queries `products` table by id,
                            // so must use product_id (master catalog ID), NOT agent_product.id
                            id: item.product_id,
                            name: `${item.products?.name || 'Product'} ${sizeLabel}`.trim(),
                            sku: item.product_id,
                            quantity: qty,
                            // retailPrice = public markup price (shown as strikethrough for agent self-buy)
                            retailPrice: perVial,
                            // costPrice = same as retail here; server-side API computes the real tier price.
                            // For checkout display, agentSelfBuy flag tells CheckoutForm to show "Agent Direct Pricing".
                            costPrice: perVial,
                            weightOz: 0.5,
                            agentSelfBuy: isStorefrontOwner,
                          };
                        })
                        .filter(Boolean);

                      try {
                        // Write to a per-agent scoped cart key so Agent A's cart
                        // can NEVER contaminate Agent B's checkout. Closed-loop isolation.
                        localStorage.setItem(`pnl_storefront_cart_${agentSlug}`, JSON.stringify(pnlCart));
                        // Wipe any stale storefront carts from OTHER agents to prevent
                        // cross-contamination if user visited multiple storefronts.
                        Object.keys(localStorage)
                          .filter(k => k.startsWith('pnl_storefront_cart_') && k !== `pnl_storefront_cart_${agentSlug}`)
                          .forEach(k => localStorage.removeItem(k));
                        localStorage.removeItem('pnl_storefront_cart'); // legacy key cleanup
                        localStorage.removeItem(`cart_${agentSlug}`);
                        setCartItems({});
                      } catch (e) {
                        console.error('Failed to sync cart:', e);
                      }
                      setShowCartFloat(false);
                      // Pass agentSlug in URL so checkout page enforces this agent's catalog only.
                      window.location.href = `/checkout?agent=${encodeURIComponent(agentSlug)}`;
                    }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'center', padding: '10px',
                      background: primaryColor, color: 'var(--white)', borderRadius: 'var(--radius-md)',
                      fontWeight: 800, fontSize: '0.85rem', border: 'none', cursor: 'pointer'
                    }}
                  >
                    Checkout
                  </button>
                  <button
                    onClick={() => { setCartItems({}); setShowCartFloat(false); }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'center', padding: '8px',
                      background: 'transparent', color: 'var(--grey-400)', borderRadius: 'var(--radius-md)',
                      fontWeight: 500, fontSize: '0.78rem', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer'
                    }}
                  >
                    Clear Cart
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Empty cart toast */}
          {cartToast && (
            <div style={{
              position: 'absolute', bottom: 68, right: 0, width: 240,
              background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 'var(--radius-lg)', padding: '14px 18px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)', fontSize: '0.85rem',
              color: 'var(--grey-300)', fontWeight: 500, textAlign: 'center'
            }}>
              🛒 Your cart is empty
            </div>
          )}
        </div>


      {/* Product Detail Modal */}
      <AnimatePresence>
        {detailProduct && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
              zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 'var(--space-4)', overflowY: 'auto'
            }}
            onClick={() => setDetailProduct(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', maxWidth: 720, maxHeight: '90vh', overflowY: 'auto',
                background: 'linear-gradient(180deg, var(--surface-2) 0%, var(--black-2) 100%)',
                borderRadius: 'var(--radius-xl)', border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 24px 80px rgba(0,0,0,0.6)'
              }}
            >
              {/* Modal Header Image */}
              <div style={{
                height: 280, position: 'relative', overflow: 'hidden',
                background: `radial-gradient(circle at 50% 50%, ${primaryColor}20 0%, var(--black) 100%)`,
                borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0'
              }}>
                {detailProduct.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={detailProduct.imageUrl} alt={detailProduct.name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', padding: '16px' }} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.3 }}>
                    <svg width="80" height="80" viewBox="0 0 60 60" fill="none">
                      <circle cx="30" cy="30" r="12" fill="none" stroke={primaryColor} strokeWidth="2"/>
                      <circle cx="30" cy="30" r="24" fill="none" stroke="var(--silver)" strokeWidth="1" strokeDasharray="4 4"/>
                    </svg>
                  </div>
                )}
                <button
                  onClick={() => setDetailProduct(null)}
                  style={{
                    position: 'absolute', top: 16, right: 16, width: 36, height: 36,
                    borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)',
                    color: 'var(--white)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.2rem', fontWeight: 700, backdropFilter: 'blur(4px)'
                  }}
                  aria-label="Close"
                >
                  <X size={18} aria-hidden="true" />
                </button>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, background: 'linear-gradient(transparent, var(--surface-2))' }} />
              </div>

              {/* Modal Body */}
              <div style={{ padding: 'var(--space-6) var(--space-8) var(--space-8)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>
                  <div>
                    {(() => {
                      const { main, subtitle } = splitProductName(detailProduct.name);
                      return (
                        <>
                          <h2 style={{ fontFamily: 'var(--font-brand)', fontSize: '1.8rem', color: 'var(--white)', lineHeight: 1.2 }}>
                            {main}
                          </h2>
                          {subtitle && (
                            <span style={{ fontSize: '0.9rem', color: 'var(--grey-400)', fontWeight: 500 }}>
                              {subtitle}
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {detailProduct.variants.some(v => (v as any).is_on_sale) && (
                      <span style={{
                        fontSize: '0.7rem', padding: '4px 12px', borderRadius: 'var(--radius-full)',
                        background: 'rgba(245,101,101,0.15)', color: '#F56565', fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
                        border: '1px solid rgba(245,101,101,0.4)'
                      }}>
                        Sale
                      </span>
                    )}
                    <span style={{
                      fontSize: '0.7rem', padding: '4px 12px', borderRadius: 'var(--radius-full)',
                      background: `${primaryColor}20`, color: primaryColor, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
                      border: `1px solid ${primaryColor}40`
                    }}>
                      {detailProduct.category}
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: '0.95rem', color: 'var(--grey-300)', lineHeight: 1.7, marginBottom: 'var(--space-4)' }}>
                  {detailProduct.desc || 'Research compound available for academic and laboratory use.'}
                </p>

                {/* Certificate Of Analysis */}
                {(() => {
                  const firstVariant = detailProduct.variants[0];
                  const pid = firstVariant?.product_id;
                  const coaUrl = pid ? coaByProductId[pid] : undefined;
                  if (!coaUrl) return null;
                  return (
                    <div style={{ marginBottom: 'var(--space-6)' }}>
                      <a
                        href={coaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '8px 14px',
                          borderRadius: 'var(--radius-md)',
                          background: `${primaryColor}15`,
                          color: primaryColor,
                          border: `1px solid ${primaryColor}40`,
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          textDecoration: 'none',
                        }}
                      >
                        <FileText size={14} aria-hidden="true" />
                        View Certificate Of Analysis
                      </a>
                    </div>
                  );
                })()}

                {/* Size & Quantity Selector */}
                {(() => {
                  const selectedVId = selectedVariants[detailProduct.name] || detailProduct.defaultVariantId;
                  const activeV = detailProduct.variants.find(v => v.id === selectedVId) || detailProduct.variants[0];
                  const qty = cartItems[activeV.id] || 0;
                  // retail_price is the 10-pack price — divide by 10 for individual vial base price
                  const rawPrice = (activeV as any).is_on_sale && (activeV as any).sale_price
                    ? (activeV as any).sale_price
                    : activeV.retail_price;
                  const basePrice = rawPrice / 10;

                  // Dynamic pricing tiers (only when agent has volume pricing enabled)
                  const tiers = volumePricingEnabled
                    ? [
                        { label: '1–2 Vials', min: 1, max: 2, pct: 20 },
                        { label: '3–5 Vials', min: 3, max: 5, pct: 15 },
                        { label: '6–9 Vials', min: 6, max: 9, pct: 10 },
                        { label: '10+ Vials — Best Price', min: 10, max: Infinity, pct: 0 },
                      ]
                    : [
                        { label: 'All Quantities — Flat Price', min: 1, max: Infinity, pct: 0 },
                      ];

                  const getUnitPrice = (q: number) => {
                    const t = tiers.find(t => q >= t.min && q <= t.max);
                    return t ? parseFloat((basePrice * (1 + t.pct / 100)).toFixed(2)) : basePrice;
                  };

                  const displayQty = qty > 0 ? qty : 10;
                  const unitPrice = getUnitPrice(displayQty);
                  const lineTotal = unitPrice * displayQty;

                  return (
                    <div style={{ marginBottom: 'var(--space-6)' }}>
                      {/* Size Selector */}
                      {detailProduct.variants.length > 1 && (
                        <div style={{ marginBottom: 'var(--space-4)' }}>
                          <label style={{ fontSize: '0.8rem', color: 'var(--silver)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                            Size
                          </label>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {detailProduct.variants.map(v => {
                              const size = v.products?.unit_size ? `${v.products.unit_size}${v.products.unit_measure || ''}` : 'Standard';
                              const isSelected = v.id === activeV.id;
                              return (
                                <button
                                  key={v.id}
                                  onClick={() => setSelectedVariants(prev => ({ ...prev, [detailProduct.name]: v.id }))}
                                  style={{
                                    padding: '8px 16px', borderRadius: 'var(--radius-md)',
                                    border: isSelected ? `2px solid ${primaryColor}` : '1px solid rgba(255,255,255,0.15)',
                                    background: isSelected ? `${primaryColor}15` : 'transparent',
                                    color: isSelected ? primaryColor : 'var(--grey-300)',
                                    fontWeight: isSelected ? 700 : 500, fontSize: '0.85rem',
                                    cursor: 'pointer', transition: 'all 0.15s ease'
                                  }}
                                >
                                  {size}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Quantity Selector + Price */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: 'var(--silver)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                            Quantity (Vials)
                          </label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button onClick={() => setCartItems(prev => {
                              const next = { ...prev };
                              if ((next[activeV.id] || 0) <= 1) delete next[activeV.id];
                              else next[activeV.id]--;
                              return next;
                            })} style={{
                              width: 36, height: 36, borderRadius: 'var(--radius-md)',
                              border: '1px solid rgba(255,255,255,0.2)', background: 'transparent',
                              color: 'var(--white)', cursor: 'pointer', fontSize: '1.1rem',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>-</button>
                            <span style={{
                              minWidth: 44, textAlign: 'center', fontSize: '1.2rem', fontWeight: 800,
                              color: 'var(--white)', fontFamily: 'var(--font-brand)'
                            }}>{qty}</span>
                            <button onClick={() => addToCart(activeV.id)} style={{
                              width: 36, height: 36, borderRadius: 'var(--radius-md)',
                              border: 'none', background: primaryColor, color: 'var(--white)',
                              cursor: 'pointer', fontSize: '1.1rem', fontWeight: 800,
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>+</button>
                          </div>
                        </div>

                        {qty > 0 && (
                          <div style={{ flex: 1, textAlign: 'right' }}>
                            <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginBottom: 2 }}>
                              ${unitPrice.toFixed(2)}/vial x {qty}
                            </div>
                            <div style={{
                              fontSize: '1.5rem', fontWeight: 800, color: primaryColor,
                              fontFamily: 'var(--font-brand)', textShadow: `0 0 10px ${primaryColor}40`
                            }}>
                              ${lineTotal.toFixed(2)}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Dynamic Pricing Tiers \u2014 always visible when volume pricing is on */}
                      {volumePricingEnabled && (
                        <div style={{
                          marginTop: 'var(--space-5)', border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 'var(--radius-md)', overflow: 'hidden'
                        }}>
                          <div style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.04)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--silver)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Volume Pricing
                          </div>
                          {tiers.map((t, i) => {
                            const tierPrice = parseFloat((basePrice * (1 + t.pct / 100)).toFixed(2));
                            const isActive = displayQty >= t.min && displayQty <= t.max;
                            return (
                              <div key={i} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.04)',
                                background: isActive ? `${primaryColor}10` : 'transparent'
                              }}>
                                <span style={{ fontSize: '0.85rem', color: isActive ? 'var(--white)' : 'var(--grey-400)', fontWeight: isActive ? 600 : 400 }}>
                                  {t.label ?? (t.max === Infinity ? `${t.min}+ vials` : `${t.min}–${t.max} vials`)}
                                  {t.pct > 0 && <span style={{ color: '#F6AD55', marginLeft: 8, fontSize: '0.75rem' }}>+{t.pct}%</span>}
                                  {t.pct === 0 && <span style={{ color: 'var(--teal)', marginLeft: 8, fontSize: '0.75rem' }}>Best Price</span>}
                                </span>
                                <span style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-brand)', color: isActive ? primaryColor : 'var(--grey-300)' }}>
                                  ${tierPrice.toFixed(2)}/ea
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}


                {/* Footer: See Bulk Pricing on left, action buttons on right */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
                  {/* See Bulk Pricing toggle — bottom left */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowBulkPricing(prev => !prev)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        color: primaryColor, fontSize: '0.82rem', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 6,
                        textDecoration: 'underline', textUnderlineOffset: 3
                      }}
                    >
                      {showBulkPricing ? 'Hide Bulk Pricing ↑' : 'See Bulk Pricing ↓'}
                    </button>
                    {showBulkPricing && (
                      <div style={{
                        position: 'absolute', bottom: 80, left: 24, right: 24,
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 'var(--radius-md)', overflow: 'hidden',
                        background: 'var(--surface-2)', zIndex: 10,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                      }}>
                        <div style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.04)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--silver)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Bulk Volume Discounts
                        </div>
                        {(() => {
                          const selVId2 = selectedVariants[detailProduct.name] || detailProduct.defaultVariantId;
                          const activeV2 = detailProduct.variants.find(v => v.id === selVId2) || detailProduct.variants[0];
                          const rawP = (activeV2 as any).is_on_sale && (activeV2 as any).sale_price ? (activeV2 as any).sale_price : activeV2.retail_price;
                          const bp = rawP / 10;
                          return [{ min: 100, pct: 5 }, { min: 300, pct: 10 }, { min: 500, pct: 15 }].map((tier, i) => {
                            const dp = parseFloat((bp * (1 - tier.pct / 100)).toFixed(2));
                            return (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--grey-400)' }}>
                                  {tier.min}+ Vials <span style={{ color: '#68D391', marginLeft: 8, fontSize: '0.75rem' }}>{tier.pct}% off</span>
                                </span>
                                <span style={{ fontSize: '0.9rem', fontWeight: 700, fontFamily: 'var(--font-brand)', color: 'var(--grey-300)' }}>${dp.toFixed(2)}/ea</span>
                              </div>
                            );
                          });
                        })()}
                        <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: '0.72rem', color: 'var(--grey-500)' }}>
                          Contact your agent to place a bulk order of 100+ vials.
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Close + Add To Cart */}
                  <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <button
                      onClick={() => setDetailProduct(null)}
                      style={{
                        padding: '10px 20px', background: 'transparent',
                        border: '1px solid rgba(255,255,255,0.15)', borderRadius: 'var(--radius-md)',
                        color: 'var(--white)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem'
                      }}
                    >
                      Close
                    </button>
                    {(() => {
                      const selVId = selectedVariants[detailProduct.name] || detailProduct.defaultVariantId;
                      const qty = cartItems[selVId] || 10;
                      return (
                        <button
                          onClick={() => {
                            const vId = selectedVariants[detailProduct.name] || detailProduct.defaultVariantId;
                            const currentQty = cartItems[vId] || 10;
                            setCartItems(prev => ({ ...prev, [vId]: currentQty }));
                            setDetailProduct(null);
                            setShowCartFloat(true);
                          }}
                          style={{
                            padding: '10px 24px', background: primaryColor, color: 'var(--white)',
                            borderRadius: 'var(--radius-md)', fontWeight: 800, fontSize: '0.85rem',
                            border: 'none', cursor: 'pointer'
                          }}
                        >
                          Add To Cart ({qty})
                        </button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
