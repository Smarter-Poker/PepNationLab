'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, Variants, AnimatePresence } from 'framer-motion';
import { Star, X, Package } from 'lucide-react';

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
  };
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

// Always round up to whole dollars — no cents ever
function roundUp(price: number): number {
  return Math.ceil(price);
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

export default function AgentStorefrontGrid({ products, inventoryMap, primaryColor, agentSlug, bundles = [] }: Props) {
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'popular' | 'name_asc' | 'name_desc' | 'price_low' | 'price_high'>('popular');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [detailProduct, setDetailProduct] = useState<GroupedProduct | null>(null);
  const [cartItems, setCartItems] = useState<Record<string, number>>({});
  const [showCartFloat, setShowCartFloat] = useState(false);

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
    if (filterCategory !== 'all') result = result.filter(g => g.category === filterCategory);
    if (searchQuery.trim()) {
      result = result.filter(g =>
        fuzzyMatch(searchQuery, g.name) || fuzzyMatch(searchQuery, g.category) || fuzzyMatch(searchQuery, g.desc)
      );
    }
    switch (sortBy) {
      case 'popular': result = [...result].sort((a, b) => a.popularity - b.popularity); break;
      case 'name_asc': result = [...result].sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'name_desc': result = [...result].sort((a, b) => b.name.localeCompare(a.name)); break;
      case 'price_low': result = [...result].sort((a, b) => a.lowestPrice - b.lowestPrice); break;
      case 'price_high': result = [...result].sort((a, b) => b.lowestPrice - a.lowestPrice); break;
    }
    return result;
  }, [grouped, filterCategory, searchQuery, sortBy]);

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Search & Filter Bar */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center',
        padding: 'var(--space-4)', background: 'rgba(255,255,255,0.03)',
        borderRadius: 'var(--radius-lg)', border: '1px solid rgba(255,255,255,0.06)'
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
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
          style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-md)', color: 'var(--white)', fontSize: '0.85rem', cursor: 'pointer', minWidth: 150 }}>
          <option value="popular">Most Popular</option>
          <option value="name_asc">A → Z</option>
          <option value="name_desc">Z → A</option>
          <option value="price_low">Price: Low → High</option>
          <option value="price_high">Price: High → Low</option>
        </select>
      </div>

      <div style={{ fontSize: '0.8rem', color: 'var(--grey-400)', paddingLeft: 'var(--space-1)' }}>
        {filteredProducts.length} {filteredProducts.length === 1 ? 'Product' : 'Products'} Found
      </div>

      {/* Research Bundles */}
      {bundles && bundles.length > 0 && (
        <div style={{ marginTop: 'var(--space-2)' }}>
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
                      ${roundUp(bundle.price)}
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
              onClick={() => setDetailProduct(group)}
            >
              {/* Product Image */}
              <div style={{
                height: 220,
                background: `radial-gradient(circle at 50% 50%, ${primaryColor}20 0%, var(--black) 100%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                borderBottom: '1px solid rgba(255,255,255,0.02)', position: 'relative'
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${primaryColor}50, transparent)` }} />

                {group.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={group.imageUrl} alt={group.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s ease' }}
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
                    background: 'rgba(0,196,188,0.15)', border: '1px solid rgba(0,196,188,0.4)',
                    color: 'var(--teal)', backdropFilter: 'blur(4px)'
                  }}>
                    <Star size={10} fill="currentColor" aria-hidden="true" style={{ marginRight: 4, verticalAlign: 'middle' }} />Popular
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

                {group.desc && (
                  <p style={{
                    fontSize: '0.82rem', color: 'var(--grey-400)', marginBottom: 'var(--space-4)',
                    lineHeight: 1.5, flexGrow: 1, textAlign: 'center',
                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                    overflow: 'hidden', textOverflow: 'ellipsis'
                  }}>
                    {group.desc}
                  </p>
                )}

                {/* Variant Selector — no em dash */}
                {group.variants.length > 1 && (
                  <div style={{ marginBottom: 'var(--space-3)' }} onClick={e => e.stopPropagation()}>
                    <select
                      className="form-input"
                      style={{ background: 'rgba(0,0,0,0.5)', borderColor: 'rgba(255,255,255,0.1)', fontSize: '0.85rem' }}
                      value={activeVariant.id}
                      onChange={(e) => setSelectedVariants(prev => ({ ...prev, [group.name]: e.target.value }))}
                    >
                      {group.variants.map(v => {
                        const size = v.products?.unit_size ? `${v.products.unit_size}${v.products.unit_measure || ''}` : 'Standard';
                        return (
                          <option key={v.id} value={v.id}>
                            {size}  ${roundUp(v.retail_price)}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                {/* Price & Action Row — vertically centered */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 'var(--space-4)'
                }}>
                  <span style={{ fontSize: '1.3rem', fontWeight: 800, color: primaryColor, fontFamily: 'var(--font-brand)', textShadow: `0 0 10px ${primaryColor}40` }}>
                    ${roundUp(activeVariant.retail_price)}
                  </span>

                  <button
                    onClick={(e) => { e.stopPropagation(); addToCart(activeVariant.id); }}
                    style={{
                      fontSize: '0.75rem', color: 'var(--black)', background: primaryColor,
                      padding: '6px 14px', borderRadius: 'var(--radius-md)', fontWeight: 800,
                      border: 'none', cursor: 'pointer',
                      boxShadow: `0 2px 8px ${primaryColor}40`,
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      whiteSpace: 'nowrap', lineHeight: 1.3
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = `0 4px 12px ${primaryColor}60`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = `0 2px 8px ${primaryColor}40`;
                    }}
                  >
                    Add To Cart
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Floating Cart — Bottom Right Corner */}
      {totalCartItems > 0 && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 900 }}>
          <button
            onClick={() => setShowCartFloat(!showCartFloat)}
            style={{
              width: 56, height: 56, borderRadius: '50%',
              background: primaryColor, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 20px ${primaryColor}60`,
              position: 'relative', transition: 'transform 0.2s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--black)" strokeWidth="2.5">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            <span style={{
              position: 'absolute', top: -4, right: -4, width: 22, height: 22,
              borderRadius: '50%', background: 'var(--red)', color: 'var(--white)',
              fontSize: '0.7rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {totalCartItems}
            </span>
          </button>

          {/* Cart dropdown */}
          <AnimatePresence>
            {showCartFloat && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                style={{
                  position: 'absolute', bottom: 68, right: 0, width: 300,
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
                            ${roundUp(item.retail_price)} × {qty}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button onClick={() => setCartItems(prev => {
                            const next = { ...prev };
                            if (next[variantId] <= 1) delete next[variantId];
                            else next[variantId]--;
                            return next;
                          })} style={{
                            width: 22, height: 22, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)',
                            background: 'transparent', color: 'var(--white)', cursor: 'pointer', fontSize: '0.85rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>−</button>
                          <span style={{ color: 'var(--white)', fontWeight: 700, fontSize: '0.8rem', minWidth: 16, textAlign: 'center' }}>{qty}</span>
                          <button onClick={() => addToCart(variantId)} style={{
                            width: 22, height: 22, borderRadius: '50%', border: 'none',
                            background: primaryColor, color: 'var(--black)', cursor: 'pointer', fontSize: '0.85rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800
                          }}>+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <a
                    href={`/checkout?agent=${agentSlug}&cart=${encodeURIComponent(JSON.stringify(cartItems))}`}
                    style={{
                      display: 'block', textAlign: 'center', padding: '10px',
                      background: primaryColor, color: 'var(--black)', borderRadius: 'var(--radius-md)',
                      fontWeight: 800, fontSize: '0.85rem', textDecoration: 'none'
                    }}
                  >
                    Checkout
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

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
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                  <span style={{
                    fontSize: '0.7rem', padding: '4px 12px', borderRadius: 'var(--radius-full)',
                    background: `${primaryColor}20`, color: primaryColor, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
                    border: `1px solid ${primaryColor}40`
                  }}>
                    {detailProduct.category}
                  </span>
                </div>

                <p style={{ fontSize: '0.95rem', color: 'var(--grey-300)', lineHeight: 1.7, marginBottom: 'var(--space-6)' }}>
                  {detailProduct.desc || 'Research compound available for academic and laboratory use.'}
                </p>

                {/* All Sizes & Pricing Table */}
                <div style={{ marginBottom: 'var(--space-6)' }}>
                  <h3 style={{ fontSize: '1rem', fontFamily: 'var(--font-brand)', color: 'var(--white)', marginBottom: 'var(--space-3)', letterSpacing: '0.03em' }}>
                    Available Sizes & Pricing
                  </h3>
                  <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                          <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--silver)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Size</th>
                          <th style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--silver)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Price</th>
                          <th style={{ padding: '10px 16px', textAlign: 'center', color: 'var(--silver)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: 120 }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailProduct.variants.map((v, i) => {
                          const size = v.products?.unit_size ? `${v.products.unit_size}${v.products.unit_measure || ''}` : 'Standard';
                          const qty = cartItems[v.id] || 0;
                          return (
                            <tr key={v.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                              <td style={{ padding: '12px 16px', color: 'var(--white)', fontWeight: 600 }}>{size}</td>
                              <td style={{ padding: '12px 16px', textAlign: 'right', color: primaryColor, fontWeight: 800, fontFamily: 'var(--font-brand)', fontSize: '1.05rem' }}>
                                ${roundUp(v.retail_price)}
                              </td>
                              <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                  {qty > 0 && (
                                    <>
                                      <button onClick={() => setCartItems(prev => {
                                        const next = { ...prev };
                                        if (next[v.id] <= 1) delete next[v.id];
                                        else next[v.id]--;
                                        return next;
                                      })} style={{
                                        width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)',
                                        background: 'transparent', color: 'var(--white)', cursor: 'pointer', fontSize: '1rem',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                      }}>−</button>
                                      <span style={{ color: 'var(--white)', fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{qty}</span>
                                    </>
                                  )}
                                  <button onClick={() => addToCart(v.id)} style={{
                                    width: 28, height: 28, borderRadius: '50%', border: 'none',
                                    background: primaryColor, color: 'var(--black)', cursor: 'pointer', fontSize: '1rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800
                                  }}>+</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {detailProduct.variants.length > 1 && (
                  <div style={{
                    padding: 'var(--space-4)', borderRadius: 'var(--radius-md)',
                    background: `${primaryColor}08`, border: `1px solid ${primaryColor}20`,
                    marginBottom: 'var(--space-6)'
                  }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--grey-300)', lineHeight: 1.5 }}>
                      <strong style={{ color: primaryColor }}>Bulk Savings:</strong> Larger sizes offer better value per mg. The {detailProduct.variants[detailProduct.variants.length - 1].products?.unit_size}{detailProduct.variants[0].products?.unit_measure || 'mg'} size provides the best per-unit pricing.
                    </p>
                  </div>
                )}

                {detailProduct.variants[0]?.products?.backorder_days > 0 && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--grey-400)', marginBottom: 'var(--space-4)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Package size={14} aria-hidden="true" /> Estimated Shipping: {detailProduct.variants[0].products.backorder_days} Business Days
                  </p>
                )}

                <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
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
                  {totalCartItems > 0 && (
                    <a
                      href={`/checkout?agent=${agentSlug}&cart=${encodeURIComponent(JSON.stringify(cartItems))}`}
                      style={{
                        padding: '10px 20px', background: primaryColor, color: 'var(--black)',
                        borderRadius: 'var(--radius-md)', fontWeight: 800, fontSize: '0.85rem',
                        textDecoration: 'none'
                      }}
                    >
                      Checkout ({totalCartItems})
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
