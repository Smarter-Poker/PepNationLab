'use client';

import React, { useState, useMemo, useCallback, useEffect, useDeferredValue, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { motion, Variants, AnimatePresence } from 'framer-motion';
import { Star, X, Heart, FileText, Search, SlidersHorizontal, RotateCcw, Check } from 'lucide-react';
import RecommendationStrip, { type RecommendationItem } from './RecommendationStrip';
import { getProductImage, toTitleCase } from '@/lib/categoryImage';
import PeptideVialCard from '@/components/PeptideVialCard';

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

// Wrap matching substrings in <mark> for highlight rendering.
// Returns plain text when query is empty so the React tree stays simple.
function highlightText(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q) return text;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${escaped})`, 'ig');
  const parts = text.split(re);
  return parts.map((part, i) =>
    re.test(part) ? (
      <mark
        key={i}
        style={{
          background: 'rgba(192,184,168,0.30)',
          color: 'inherit',
          padding: '0 2px',
          borderRadius: 2,
        }}
      >
        {part}
      </mark>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
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
  return variants[variants.length - 1]?.id ?? variants[0]?.id ?? '';
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

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ─── Faceted filter state ────────────────────────────────────────────────
  // Initial values come from URL on first mount; if none are present we try
  // localStorage so a researcher who reloads the page keeps their last view.
  const filterStorageKey = `pnl_storefront_filters_${agentSlug}`;
  const readStoredFilters = (): Record<string, string> | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(filterStorageKey);
      return raw ? (JSON.parse(raw) as Record<string, string>) : null;
    } catch {
      return null;
    }
  };
  const urlHasAnyFacet = (() => {
    if (!searchParams) return false;
    const keys = ['q', 'category', 'sort', 'min', 'max', 'inStock', 'bulk', 'wMin', 'wMax'];
    return keys.some(k => searchParams.get(k));
  })();
  const initFromStore = !urlHasAnyFacet ? readStoredFilters() : null;
  const getInit = (key: string): string => {
    const fromUrl = searchParams?.get(key);
    if (fromUrl !== null && fromUrl !== undefined) return fromUrl;
    if (initFromStore && typeof initFromStore[key] === 'string') return initFromStore[key];
    return '';
  };

  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState<string>(getInit('q'));
  const deferredSearch = useDeferredValue(searchQuery);
  const initialSort = (getInit('sort') || 'popular') as
    | 'popular' | 'name_asc' | 'name_desc' | 'price_low' | 'price_high' | 'newest';
  const [sortBy, setSortBy] = useState<typeof initialSort>(initialSort);
  const [filterCategory, setFilterCategory] = useState<string>(getInit('category') || 'all');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [inStockOnly, setInStockOnly] = useState<boolean>(getInit('inStock') === '1');
  const [bulkOnly, setBulkOnly] = useState<boolean>(getInit('bulk') === '1');

  // ─── Price + weight bounds (derived from the catalog) ───────────────────
  const priceBounds = useMemo(() => {
    const prices = products.map(p => Number(p.retail_price)).filter(n => Number.isFinite(n));
    if (prices.length === 0) return { min: 0, max: 0 };
    return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) };
  }, [products]);
  const weightBounds = useMemo(() => {
    const weights = products
      .map(p => Number(p.products?.weight_oz))
      .filter(n => Number.isFinite(n) && n > 0);
    if (weights.length === 0) return { min: 0, max: 0 };
    const lo = Math.min(...weights);
    const hi = Math.max(...weights);
    return { min: Math.floor(lo * 2) / 2, max: Math.ceil(hi * 2) / 2 };
  }, [products]);

  const clampNum = (v: string, fallback: number): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const [minPrice, setMinPrice] = useState<number>(clampNum(getInit('min'), priceBounds.min));
  const [maxPrice, setMaxPrice] = useState<number>(clampNum(getInit('max'), priceBounds.max));
  const [minWeight, setMinWeight] = useState<number>(clampNum(getInit('wMin'), weightBounds.min));
  const [maxWeight, setMaxWeight] = useState<number>(clampNum(getInit('wMax'), weightBounds.max));

  // If the catalog changes (e.g. SSR re-render), refresh price/weight defaults
  // — but only when the user has not explicitly chosen a value.
  const initialBoundsApplied = useRef(false);
  useEffect(() => {
    if (initialBoundsApplied.current) return;
    initialBoundsApplied.current = true;
    if (!getInit('min')) setMinPrice(priceBounds.min);
    if (!getInit('max')) setMaxPrice(priceBounds.max);
    if (!getInit('wMin')) setMinWeight(weightBounds.min);
    if (!getInit('wMax')) setMaxWeight(weightBounds.max);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceBounds.min, priceBounds.max, weightBounds.min, weightBounds.max]);

  // ─── URL sync (debounced, replace state to avoid history spam) ──────────
  const urlSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (urlSyncTimer.current) clearTimeout(urlSyncTimer.current);
    urlSyncTimer.current = setTimeout(() => {
      const params = new URLSearchParams();
      const trimmedQ = searchQuery.trim();
      if (trimmedQ) params.set('q', trimmedQ);
      if (filterCategory && filterCategory !== 'all') params.set('category', filterCategory);
      if (sortBy && sortBy !== 'popular') params.set('sort', sortBy);
      if (minPrice !== priceBounds.min) params.set('min', String(minPrice));
      if (maxPrice !== priceBounds.max) params.set('max', String(maxPrice));
      if (inStockOnly) params.set('inStock', '1');
      if (bulkOnly) params.set('bulk', '1');
      if (minWeight !== weightBounds.min) params.set('wMin', String(minWeight));
      if (maxWeight !== weightBounds.max) params.set('wMax', String(maxWeight));
      const qs = params.toString();
      const target = qs ? `${pathname}?${qs}` : pathname;
      try {
        router.replace(target, { scroll: false });
      } catch {
        // router can be unavailable in tests; ignore.
      }
      // Mirror to localStorage so reload restores the view.
      try {
        const toStore: Record<string, string> = {};
        params.forEach((v, k) => { toStore[k] = v; });
        if (Object.keys(toStore).length > 0) {
          window.localStorage.setItem(filterStorageKey, JSON.stringify(toStore));
        } else {
          window.localStorage.removeItem(filterStorageKey);
        }
      } catch {
        // ignore quota / privacy-mode errors
      }
    }, 220);
    return () => {
      if (urlSyncTimer.current) clearTimeout(urlSyncTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchQuery, filterCategory, sortBy,
    minPrice, maxPrice, inStockOnly, bulkOnly,
    minWeight, maxWeight,
  ]);

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setFilterCategory('all');
    setSortBy('popular');
    setInStockOnly(false);
    setBulkOnly(false);
    setMinPrice(priceBounds.min);
    setMaxPrice(priceBounds.max);
    setMinWeight(weightBounds.min);
    setMaxWeight(weightBounds.max);
  }, [priceBounds.min, priceBounds.max, weightBounds.min, weightBounds.max]);
  const [detailProduct, setDetailProduct] = useState<GroupedProduct | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [cartItems, setCartItems] = useState<Record<string, number>>({});
  const [showCartFloat, setShowCartFloat] = useState(false);
  const [cartToast, setCartToast] = useState(false);
  const [showBulkPricing, setShowBulkPricing] = useState(false);
  // Modal-only quantity input — does NOT touch cartItems until "Add To Cart" is pressed.
  // Agent self-buy: minimum 10 vials, increments of 10 (enforced here + server-side).
  const selfBuyStep = 1;   // agents can buy any quantity; tiered pricing applies below 10  // Enforce per-peptide minimum using min_order_qty (defaults to 1). Agent direct price unlocks at 10+
  const selfBuyMin  = agent.min_order_qty ?? 1;
  const overallMin  = agent.min_overall_qty ?? 1;

  // ─── Recommendations ("Researchers Also Bought") ────────────────────────
  // When the product detail modal opens, fetch a strip of related products
  // from the co-purchase matrix (falls back to the 60-day popular list when
  // co-purchase data is sparse). Public route — no auth needed.
  useEffect(() => {
    if (!detailProduct) {
      setRecommendations([]);
      return;
    }
    const seedProductId = detailProduct.variants[0]?.product_id;
    if (!seedProductId) {
      setRecommendations([]);
      return;
    }
    let cancelled = false;
    setRecommendationsLoading(true);
    const url = `/api/storefront/recommendations?product_id=${encodeURIComponent(seedProductId)}&agent_slug=${encodeURIComponent(agentSlug)}&limit=6`;
    fetch(url, { credentials: 'omit' })
      .then(r => r.ok ? r.json() : { recommendations: [] })
      .then((data: { recommendations?: RecommendationItem[] }) => {
        if (!cancelled) setRecommendations(Array.isArray(data?.recommendations) ? data.recommendations : []);
      })
      .catch(() => {
        if (!cancelled) setRecommendations([]);
      })
      .finally(() => {
        if (!cancelled) setRecommendationsLoading(false);
      });
    return () => { cancelled = true; };
  }, [detailProduct, agentSlug]);

  const [pendingQty, setPendingQty] = useState(isStorefrontOwner ? 10 : 1);

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
          imageUrl: getProductImage(
            item.custom_image_url ?? item.products?.image_url ?? null,
            item.products?.category || 'Other',
            name,
          ),
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

  // Build a lookup from any product_id (master) to the GroupedProduct that
  // contains it as a variant. Used by the recommendations strip to swap the
  // modal target without re-fetching catalog data.
  const groupByProductId = useMemo(() => {
    const m = new Map<string, GroupedProduct>();
    for (const g of grouped) {
      for (const v of g.variants) {
        if (v.product_id) m.set(v.product_id, g);
      }
    }
    return m;
  }, [grouped]);

  // Predicate factories so we can compute "matches except category" for the
  // category facet counts.
  const matchesSearch = useCallback(
    (g: GroupedProduct) => {
      const q = deferredSearch.trim().toLowerCase();
      if (!q) return true;
      return g.name.toLowerCase().includes(q);
    },
    [deferredSearch]
  );
  const matchesPrice = useCallback(
    (g: GroupedProduct) =>
      g.variants.some(v => {
        const p = Number(v.retail_price);
        return p >= minPrice && p <= maxPrice;
      }),
    [minPrice, maxPrice]
  );
  const matchesWeight = useCallback(
    (g: GroupedProduct) =>
      g.variants.some(v => {
        const w = Number(v.products?.weight_oz);
        if (!Number.isFinite(w) || w <= 0) return weightBounds.max === 0;
        return w >= minWeight && w <= maxWeight;
      }),
    [minWeight, maxWeight, weightBounds.max]
  );
  const matchesInStock = useCallback(
    (g: GroupedProduct) => {
      if (!inStockOnly) return true;
      return g.variants.some(v => {
        const agentCount = Number(inventoryMap[v.product_id] ?? 0);
        const masterCount = Number(v.products?.inventory_count ?? 0);
        return agentCount > 0 || masterCount > 0;
      });
    },
    [inStockOnly, inventoryMap]
  );
  const matchesBulk = useCallback(
    (g: GroupedProduct) => {
      if (!bulkOnly) return true;
      return g.variants.some(v => {
        const ap = (v as unknown as { products?: { admin_bulk_price?: number | null } }).products;
        return ap?.admin_bulk_price !== null && ap?.admin_bulk_price !== undefined;
      });
    },
    [bulkOnly]
  );
  const matchesCategory = useCallback(
    (g: GroupedProduct) => {
      if (filterCategory === 'all') return true;
      if (filterCategory === 'on_sale') return g.variants.some(v => (v as any).is_on_sale);
      return g.category === filterCategory;
    },
    [filterCategory]
  );

  const filteredProducts = useMemo(() => {
    let result = grouped.filter(g =>
      matchesCategory(g) &&
      matchesSearch(g) &&
      matchesPrice(g) &&
      matchesWeight(g) &&
      matchesInStock(g) &&
      matchesBulk(g)
    );
    switch (sortBy) {
      case 'popular': result = [...result].sort((a, b) => a.popularity - b.popularity); break;
      case 'name_asc': result = [...result].sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'name_desc': result = [...result].sort((a, b) => b.name.localeCompare(a.name)); break;
      case 'price_low': result = [...result].sort((a, b) => a.lowestPrice - b.lowestPrice); break;
      case 'price_high': result = [...result].sort((a, b) => b.lowestPrice - a.lowestPrice); break;
      case 'newest': result = [...result].sort((a, b) => a.popularity - b.popularity); break;
    }
    return result;
  }, [grouped, matchesCategory, matchesSearch, matchesPrice, matchesWeight, matchesInStock, matchesBulk, sortBy]);

  // Counts shown next to each category option — count products that match
  // every OTHER filter (search, price, weight, in-stock, bulk) but ignore
  // the category facet itself so picking a category doesn't zero out its
  // own count.
  const categoryCounts = useMemo<Record<string, number>>(() => {
    const base = grouped.filter(g =>
      matchesSearch(g) &&
      matchesPrice(g) &&
      matchesWeight(g) &&
      matchesInStock(g) &&
      matchesBulk(g)
    );
    const counts: Record<string, number> = { all: base.length };
    let saleCount = 0;
    for (const g of base) {
      counts[g.category] = (counts[g.category] || 0) + 1;
      if (g.variants.some(v => (v as any).is_on_sale)) saleCount += 1;
    }
    counts['on_sale'] = saleCount;
    return counts;
  }, [grouped, matchesSearch, matchesPrice, matchesWeight, matchesInStock, matchesBulk]);

  const totalProductsCount = grouped.length;
  const shownProductsCount = filteredProducts.length;
  const hasActiveFilters =
    !!deferredSearch.trim() ||
    filterCategory !== 'all' ||
    sortBy !== 'popular' ||
    minPrice !== priceBounds.min ||
    maxPrice !== priceBounds.max ||
    inStockOnly ||
    bulkOnly ||
    minWeight !== weightBounds.min ||
    maxWeight !== weightBounds.max;

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
      <style dangerouslySetInnerHTML={{__html: `
        .sf-toolbar {
          display: flex;
          gap: 12px;
          padding: 12px;
          background: linear-gradient(180deg, rgba(20,25,30,0.8) 0%, rgba(10,15,20,0.9) 100%);
          border-radius: 16px;
          border: 2px solid transparent;
          background-clip: padding-box;
          box-shadow: 0 0 0 1.5px #C0B8A8, inset 0 0 0 1px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.6);
          margin-bottom: 24px;
          flex-direction: column;
        }
        .sf-toolbar-search  { position: relative; flex: 1; }
        .sf-toolbar-cat     { flex: 0 0 auto; }
        .sf-toolbar select, .sf-toolbar .sf-filter-btn {
          width: 100%; padding: 10px 14px; font-size: 0.85rem;
          background: rgba(0,0,0,0.6); 
          border: 1px solid transparent;
          border-radius: 10px; color: var(--white); cursor: pointer;
          appearance: auto;
          box-shadow: 0 0 0 1.5px #C0B8A8, inset 0 2px 6px rgba(0,0,0,0.5);
          transition: box-shadow 0.2s, background 0.2s;
        }
        .sf-toolbar select:hover, .sf-toolbar-search input:hover {
          box-shadow: 0 0 0 2px #C0B8A8, inset 0 2px 6px rgba(0,0,0,0.3);
          background: rgba(0,0,0,0.8);
        }
        .sf-toolbar-search input {
          width: 100%; padding: 10px 14px 10px 38px;
          background: rgba(0,0,0,0.6); 
          border: 1px solid transparent;
          border-radius: 10px; color: var(--white); font-size: 0.9rem; outline: none;
          box-sizing: border-box;
          box-shadow: 0 0 0 1.5px #C0B8A8, inset 0 2px 6px rgba(0,0,0,0.5);
          transition: box-shadow 0.2s, background 0.2s;
        }
        .sf-toolbar-search .sf-search-icon {
          position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
          color: var(--grey-400); pointer-events: none; display: flex;
        }
        .sf-toolbar-search .sf-search-clear {
          position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
          width: 22px; height: 22px; min-width: 22px; min-height: 22px;
          aspect-ratio: 1; border-radius: 50%; padding: 0; box-sizing: border-box;
          background: rgba(255,255,255,0.10); border: 1px solid rgba(255,255,255,0.15);
          color: var(--silver); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }
        @media (min-width: 640px) {
          .sf-toolbar { flex-direction: row; flex-wrap: nowrap; padding: 14px; }
          .sf-toolbar-search  { flex: 1 1 240px; }
          .sf-toolbar-cat     { flex: 0 0 auto; }
          .sf-toolbar select  { width: auto; min-width: 160px; padding: 9px 12px; font-size: 0.85rem; }
        }

        /* ── Wishlist Heart Button — always a perfect circle ─────────── */
        .sf-wishlist-btn {
          position: absolute; top: 10px; right: 10px;
          width: 34px; height: 34px; min-width: 34px; min-height: 34px;
          max-width: 34px; max-height: 34px;
          aspect-ratio: 1; border-radius: 50%; padding: 0;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; z-index: 5; flex-shrink: 0;
          backdrop-filter: blur(6px); transition: transform 0.15s ease;
          box-sizing: border-box;
        }
        .sf-wishlist-btn:hover { transform: scale(1.12); }

        /* ── Product Detail Modal / Bottom Sheet ─────────────────────── */
        .sf-modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);
          z-index: 1000; display: flex; align-items: flex-end; justify-content: center;
          overflow: hidden;
        }
        /* Brushed-nickel border: 2px metallic silver gradient ring */
        .sf-modal-sheet {
          width: 100%; max-height: 95dvh; overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          background: linear-gradient(180deg, #131b24 0%, #0a0f14 100%);
          border-radius: 22px 22px 0 0;
          border: 2px solid transparent;
          background-clip: padding-box;
          box-shadow:
            0 0 0 2px #8a9099,
            0 0 0 2.5px rgba(255,255,255,0.18),
            inset 0 1px 0 rgba(255,255,255,0.08),
            0 -10px 50px rgba(0,0,0,0.8),
            0 4px 24px rgba(138,144,153,0.12);
          display: flex; flex-direction: column;
          position: relative;
        }
        .sf-modal-drag-bar {
          width: 40px; height: 4px; border-radius: 2px;
          background: rgba(255,255,255,0.18); margin: 12px auto 0;
          flex-shrink: 0;
        }
        .sf-modal-img {
          height: 160px; flex-shrink: 0; position: relative; overflow: hidden;
          border-radius: 20px 20px 0 0;
          margin: 0;
        }
        .sf-modal-body { padding: 20px 22px 8px; flex: 1; }
        .sf-modal-h2 { font-size: 1.2rem !important; }
        .sf-modal-actions {
          display: flex; gap: 10px;
          padding: 14px 22px calc(20px + env(safe-area-inset-bottom, 0px));
          position: sticky; bottom: 0; z-index: 5;
          background: linear-gradient(to top, #0a0f14 75%, transparent);
        }
        .sf-modal-actions .sf-close-btn {
          padding: 11px 20px; background: transparent;
          border: 1px solid rgba(255,255,255,0.18); border-radius: var(--radius-md);
          color: var(--white); cursor: pointer; font-weight: 600; font-size: 0.85rem;
          white-space: nowrap;
        }
        .sf-modal-actions .sf-add-btn {
          flex: 1; padding: 12px 20px; border-radius: var(--radius-md);
          font-weight: 800; font-size: 0.9rem; border: none; cursor: pointer;
          color: #fff; white-space: nowrap;
        }
        @media (min-width: 600px) {
          .sf-modal-overlay { align-items: center; padding: 20px; overflow-y: auto; }
          .sf-modal-sheet {
            border-radius: 20px; max-width: 560px; max-height: 90vh;
            box-shadow:
              0 0 0 2px #8a9099,
              0 0 0 2.5px rgba(255,255,255,0.18),
              inset 0 1px 0 rgba(255,255,255,0.08),
              0 24px 80px rgba(0,0,0,0.85),
              0 4px 24px rgba(138,144,153,0.12);
          }
          .sf-modal-drag-bar { display: none; }
          .sf-modal-img { height: 240px; border-radius: 18px 18px 0 0; }
          .sf-modal-body { padding: 24px 32px 12px; }
          .sf-modal-h2 { font-size: 1.75rem !important; }
          .sf-modal-actions {
            position: static; background: none; padding: 16px 32px 28px;
          }
          .sf-modal-actions .sf-add-btn { flex: none; padding: 10px 28px; }
        }
      `}} />

      {/* Faceted Search & Filter Toolbar */}
      <div className="sf-toolbar glass-header">
        {/* Search */}
        <div className="sf-toolbar-search">
          <span className="sf-search-icon">
            <Search size={14} aria-hidden="true" />
          </span>
          <input
            type="text"
            aria-label="Search Products"
            placeholder="Search Products"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear Search"
              className="sf-search-clear"
              onClick={() => setSearchQuery('')}
            >
              <X size={11} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Category */}
        <div className="sf-toolbar-cat">
          <select
            aria-label="Filter By Category"
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
          >
            <option value="all">All Categories ({categoryCounts['all'] ?? 0})</option>
            {categories.map(c => (
              <option key={c} value={c}>{c} ({categoryCounts[c] ?? 0})</option>
            ))}
            <option value="on_sale">On Sale ({categoryCounts['on_sale'] ?? 0})</option>
          </select>
        </div>

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

      {/* Empty State */}
      {filteredProducts.length === 0 && (
        <div className="metal-frame hover-lift stagger-fade-in">
          <div className="metal-content" style={{ textAlign: 'center', padding: 'var(--space-8) var(--space-6)' }}>
            <h3 style={{ color: 'var(--white)', fontSize: '1.05rem', marginBottom: 'var(--space-3)' }}>
              No Products Match Your Filters
            </h3>
          <p style={{ color: 'var(--grey-400)', fontSize: '0.9rem', marginBottom: 'var(--space-4)' }}>
            Try Widening Your Price Range, Clearing The Search, Or Resetting All Filters.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', background: primaryColor, color: 'var(--white)',
              border: 'none', borderRadius: 'var(--radius-md)',
              fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
            }}
          >
            <RotateCcw size={14} aria-hidden="true" />
            Reset Filters
          </button>
          </div>
        </div>
      )}

      {/* Product Grid */}
      <motion.div
        className="grid-3" style={{ gap: 'var(--space-6)', display: filteredProducts.length === 0 ? 'none' : undefined }}
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
              key={group.name} className="metal-frame hover-lift stagger-fade-in" variants={itemVariants}
              style={{
                cursor: 'pointer'
              }}
              onClick={() => {
                setDetailProduct(group);
                logRecentlyViewed(activeVariant.product_id);
                // Pre-fill pendingQty: start at 10 for agent self-buy (minimum),
                // or restore existing cart qty, or 1 for researchers.
                const defaultVId = group.defaultVariantId || group.variants[0]?.id;
                const existingQty = defaultVId ? cartItems[defaultVId] : undefined;
                setPendingQty(existingQty ?? (isStorefrontOwner ? 10 : 1));
              }}
            >
              <div className="metal-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: 0 }}>
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
                      className="sf-wishlist-btn"
                      style={{
                        background: wished ? 'rgba(229,62,62,0.20)' : 'rgba(0,0,0,0.55)',
                        border: `1px solid ${wished ? 'rgba(229,62,62,0.50)' : 'rgba(255,255,255,0.20)'}`,
                      }}
                    >
                      <Heart
                        size={17}
                        stroke={wished ? '#FF5A6E' : 'rgba(220,220,220,0.9)'}
                        fill={wished ? '#FF5A6E' : 'none'}
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                    </button>
                  );
                })()}

                {/* Photorealistic branded vial — product-specific image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={group.imageUrl ?? undefined}
                  alt={group.name}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', padding: '8px', transition: 'transform 0.4s ease' }}
                  className="store-image-hover"
                  onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                />

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
                  const { main, subtitle } = splitProductName(toTitleCase(group.name));
                  return (
                    <div style={{ textAlign: 'center', marginBottom: 'var(--space-2)' }}>
                      <h4 style={{
                        fontFamily: 'var(--font-brand)',
                        fontSize: '1.15rem', color: 'var(--white)', letterSpacing: '0.02em', lineHeight: 1.2,
                        marginBottom: subtitle ? 2 : 0
                      }}>
                        {highlightText(main, deferredSearch)}
                      </h4>
                      {subtitle && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--grey-400)', fontWeight: 500 }}>
                          {highlightText(subtitle, deferredSearch)}
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
              </div>
            </motion.div>
          );
        })}
      </motion.div>
      {/* Floating Cart — Bottom Right Corner */}
      <div style={{ position: 'fixed', bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))', right: 24, zIndex: 900 }}>
        {/* Floating Cart Button */}
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
            position: 'fixed',
            bottom: 'env(safe-area-inset-bottom, 0px)',
            right: '4px',
            width: 80,
            height: 80,
            background: 'transparent',
            border: 'none',
            overflow: 'visible',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            cursor: 'pointer',
            transition: 'transform 0.2s, filter 0.2s',
            filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.8))'
          }}
          onMouseEnter={e => { 
            e.currentTarget.style.transform = 'scale(1.05)'; 
            e.currentTarget.style.filter = 'drop-shadow(0 12px 24px rgba(0,0,0,0.9)) brightness(1.2)';
          }}
          onMouseLeave={e => { 
            e.currentTarget.style.transform = 'scale(1)'; 
            e.currentTarget.style.filter = 'drop-shadow(0 8px 16px rgba(0,0,0,0.8))';
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cart-icon.png" width={144} height={144} alt="Cart" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', maxWidth: 'none', objectFit: 'contain' }} />
          {totalCartItems > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4, width: 24, height: 24,
              borderRadius: '50%', background: '#14B8A6', color: '#FFFFFF',
              fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.5), 0 0 0 1.5px rgba(255,255,255,0.3)',
              zIndex: 10
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
                            ${formatPrice(item.retail_price / 10)} x {qty}
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
                          // For agent self-buy: use the tier cost per vial (cost_price / 10)
                          // so the checkout subtotal shows the correct tier price, not retail.
                          // cost_price is injected by the storefront page = base_cost × tier_mult.
                          const costPerVial = isStorefrontOwner && (item as any).cost_price != null
                            ? Number((item as any).cost_price) / 10
                            : perVial;
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
                            // costPrice = agent tier cost per vial for self-buy, else same as retail.
                            // CheckoutForm uses this for subtotal display and discount calculation.
                            costPrice: costPerVial,
                            // Use actual product weight; fall back to 0.5 oz if not set.
                            // weight_oz is fetched from products table via the storefront page query.
                            weightOz: Number(item.products?.weight_oz) || 0.5,
                            agentSelfBuy: isStorefrontOwner,
                          };
                        })
                        .filter(Boolean);

                      if (totalCartItems < overallMin) {
                        toast.error(`Order Minimum Not Met: This storefront requires an overall minimum order of ${overallMin} items. You currently have ${totalCartItems}.`);
                        return;
                      }
                      
                      try {
                        // Write to a per-agent scoped cart key so Agent A's cart
                        // can NEVER contaminate Agent B's checkout. Closed-loop isolation.
                        // Write cart with _savedAt timestamp so CheckoutForm can detect staleness.
                        localStorage.setItem(`pnl_storefront_cart_${agentSlug}`, JSON.stringify({
                          items: pnlCart,
                          _savedAt: Date.now(),
                        }));
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
                    onClick={() => setShowCartFloat(false)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'center', padding: '9px',
                      background: 'transparent', color: 'var(--silver)', borderRadius: 'var(--radius-md)',
                      fontWeight: 600, fontSize: '0.82rem', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer'
                    }}
                  >
                    Keep Shopping
                  </button>
                  <button onClick={() => { setCartItems({}); setShowCartFloat(false); }}
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
              Your Cart Is Empty
            </div>
          )}
        </div>


      {/* Product Detail Modal — bottom-sheet on mobile, centered on desktop */}
      <AnimatePresence>
        {detailProduct && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="sf-modal-overlay"
            onClick={() => setDetailProduct(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 80 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 80 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              onClick={e => e.stopPropagation()}
              className="sf-modal-sheet"
            >
              {/* Top bar: drag handle (centered) + close button (right) */}
              <div style={{
                display: 'flex', alignItems: 'center', padding: '14px 18px 8px', flexShrink: 0,
              }}>
                <div style={{ flex: 1 }} />
                <div style={{ width: 44, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.20)' }} aria-hidden="true" />
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setDetailProduct(null)}
                    aria-label="Close"
                    style={{
                      width: 32, height: 32, minWidth: 32, minHeight: 32,
                      borderRadius: '50%', padding: 0,
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.22)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', boxSizing: 'border-box', flexShrink: 0,
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.16)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                  >
                    <X size={14} stroke="#ffffff" strokeWidth={2.5} aria-hidden="true" />
                  </button>
                </div>
              </div>
              {/* Modal Header Image — no close button inside, border-radius won't clip anything */}
              <div
                className="sf-modal-img"
                style={{ background: `radial-gradient(circle at 50% 50%, ${primaryColor}20 0%, var(--black) 100%)` }}
              >
                {/* Photorealistic branded vial — product-specific image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={detailProduct.imageUrl ?? undefined}
                  alt={detailProduct.name}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', padding: '16px', transition: 'transform 0.4s ease' }}
                  onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, background: 'linear-gradient(transparent, var(--surface-2))' }} />
              </div>

              {/* Modal Body */}
              <div className="sf-modal-body">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                  <div>
                    {(() => {
                      const { main, subtitle } = splitProductName(toTitleCase(detailProduct.name));
                      return (
                        <>
                          <h2 className="sf-modal-h2" style={{ fontFamily: 'var(--font-brand)', color: 'var(--white)', lineHeight: 1.2 }}>
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

                <p style={{ fontSize: '0.9rem', color: 'var(--grey-300)', lineHeight: 1.7, marginBottom: 'var(--space-3)' }}>
                  {detailProduct.desc || 'Research compound available for academic and laboratory use.'}
                </p>

                {/* Agent Local Inventory Badge — show when agent has this product in their own stock */}
                {(() => {
                  const selVId0 = selectedVariants[detailProduct.name] || detailProduct.defaultVariantId;
                  const selV0 = detailProduct.variants.find(v => v.id === selVId0) || detailProduct.variants[0];
                  const localStock = Math.max(0, Number(inventoryMap[selV0?.product_id ?? ''] ?? 0));
                  if (localStock <= 0) return null;
                  return (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      padding: '7px 14px', borderRadius: 'var(--radius-md)',
                      background: 'rgba(72,187,120,0.10)',
                      border: '1px solid rgba(72,187,120,0.30)',
                      marginBottom: 'var(--space-4)'
                    }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: '#68D391', flexShrink: 0,
                        boxShadow: '0 0 6px #68D39180'
                      }} />
                      <span style={{ fontSize: '0.82rem', color: '#68D391', fontWeight: 700 }}>
                        {localStock} Vial{localStock !== 1 ? 's' : ''} In Agent Local Stock — Ships Immediately
                      </span>
                    </div>
                  );
                })()}

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
                  // Use pendingQty for display — only committed to cartItems on "Add To Cart"
                  const qty = pendingQty;
                  // retail_price is the 10-pack price — divide by 10 for individual vial base price
                  const rawPrice = (activeV as any).is_on_sale && (activeV as any).sale_price
                    ? (activeV as any).sale_price
                    : activeV.retail_price;
                  const basePrice = rawPrice / 10;   // retail per-vial price

                  // Agent cost price — admin-configured tier price (e.g. $52 for 10 vials).
                  // Falls back to retail base price when cost_price isn't set on this variant.
                  const agentCostPerVial = isStorefrontOwner && (activeV as any).cost_price != null
                    ? Number((activeV as any).cost_price) / 10
                    : basePrice;

                  // ── AGENT SELF-BUY PRICING RULE ─────────────────────────────────
                  // Agent direct (tier) pricing applies at 10+ vials using cost_price.
                  // Below 10 vials the standard retail dynamic pricing applies.
                  // This is enforced here (display) AND server-side (API).
                  const agentQualifiesForDiscount = isStorefrontOwner && qty >= 10;

                  // Dynamic pricing tiers:
                  // Agents see tiered pricing with 10+ labeled "Agent Direct Price".
                  // Below 10 vials, agents pay the same retail dynamic rate as researchers.
                  // Researchers see tiers only when volumePricingEnabled.
                  const tiers = isStorefrontOwner
                    ? [
                        { label: '1–2 Vials', min: 1, max: 2, pct: 20 },
                        { label: '3–5 Vials', min: 3, max: 5, pct: 15 },
                        { label: '6–9 Vials', min: 6, max: 9, pct: 10 },
                        { label: '10+ Vials — Agent Direct Price', min: 10, max: Infinity, pct: 0 },
                      ]
                    : volumePricingEnabled
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
                    // Agent self-buy at 10+ vials → use admin-configured cost price (tier price)
                    if (isStorefrontOwner && q >= 10) return agentCostPerVial;
                    // Below 10 (agent) or all quantities (researcher) → retail + tiered markup
                    const t = tiers.find(t => q >= t.min && q <= t.max);
                    return t ? parseFloat((basePrice * (1 + t.pct / 100)).toFixed(2)) : basePrice;
                  };

                  const displayQty = qty > 0 ? qty : (isStorefrontOwner ? 10 : 1);
                  // For agent self-buy: server computes actual tier cost. Show retail
                  // here as the "before discount" price; discount is applied at checkout.
                  // If qty < 10 (below minimum), retail pricing applies — no discount.
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
                          {/* Agent self-buy: default 10, can buy fewer at dynamic pricing */}
                          {isStorefrontOwner && (
                            <div style={{
                              fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em',
                              textTransform: 'uppercase', color: '#68D391',
                              background: 'rgba(104,211,145,0.10)', border: '1px solid rgba(104,211,145,0.30)',
                              borderRadius: 'var(--radius-full)', padding: '2px 10px',
                              display: 'inline-block', marginBottom: 8
                            }}>
                              Default 10 Vials · Fewer Vials = Dynamic Pricing
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                              onClick={() => setPendingQty(prev => Math.max(selfBuyMin, prev - selfBuyStep))}
                              disabled={qty <= selfBuyMin}
                              style={{
                                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                                border: '1px solid rgba(255,255,255,0.2)', background: 'transparent',
                                color: qty <= selfBuyMin ? 'var(--grey-600)' : 'var(--white)',
                                cursor: qty <= selfBuyMin ? 'not-allowed' : 'pointer',
                                fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}
                            >-</button>
                            <span style={{
                              minWidth: 44, textAlign: 'center', fontSize: '1.2rem', fontWeight: 800,
                              color: 'var(--white)', fontFamily: 'var(--font-brand)'
                            }}>{qty}</span>
                            <button
                              onClick={() => setPendingQty(prev => prev + selfBuyStep)}
                              style={{
                                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                                border: 'none', background: primaryColor, color: 'var(--white)',
                                cursor: 'pointer', fontSize: '1.1rem', fontWeight: 800,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}
                            >+</button>
                          </div>
                        </div>

                        {qty > 0 && (
                          <div style={{ flex: 1, textAlign: 'right' }}>
                            {isStorefrontOwner && agentQualifiesForDiscount && (
                              <div style={{ fontSize: '0.7rem', color: '#68D391', fontWeight: 700,
                                textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                                Agent Direct Price Applied
                              </div>
                            )}
                            {isStorefrontOwner && !agentQualifiesForDiscount && (
                              <div style={{ fontSize: '0.7rem', color: '#FC8181', fontWeight: 700,
                                textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                                Retail Pricing — Add {10 - qty} More For Agent Rate
                              </div>
                            )}
                            <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginBottom: 2 }}>
                              ${unitPrice.toFixed(2)}/vial x {qty}
                            </div>
                            <div style={{
                              fontSize: '1.5rem', fontWeight: 800,
                              color: isStorefrontOwner && !agentQualifiesForDiscount ? '#FC8181' : primaryColor,
                              fontFamily: 'var(--font-brand)',
                              textShadow: `0 0 10px ${isStorefrontOwner && !agentQualifiesForDiscount ? 'rgba(252,129,129,0.4)' : primaryColor + '40'}`
                            }}>
                              ${lineTotal.toFixed(2)}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Dynamic Pricing Tiers — visible for agents always, or when volume pricing on */}
                      {(volumePricingEnabled || isStorefrontOwner) && (
                        <div style={{
                          marginTop: 'var(--space-5)', border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 'var(--radius-md)', overflow: 'hidden'
                        }}>
                          <div style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.04)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--silver)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Volume Pricing
                          </div>
                          {tiers.map((t, i) => {
                            // For the 10+ agent-direct tier, show the actual cost price, not retail.
                            // For all other tiers, apply the surcharge % on top of base retail price.
                            const tierPrice = (isStorefrontOwner && t.pct === 0)
                              ? agentCostPerVial
                              : parseFloat((basePrice * (1 + t.pct / 100)).toFixed(2));
                            const isActive = displayQty >= t.min && displayQty <= t.max;
                            return (
                              <div key={i} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.04)',
                                background: isActive ? `${primaryColor}10` : 'transparent'
                              }}>
                                <span style={{ fontSize: '0.85rem', color: isActive ? 'var(--white)' : 'var(--grey-400)', fontWeight: isActive ? 600 : 400 }}>
                                  {t.label ?? (t.max === Infinity ? `${t.min}+ vials` : `${t.min}–${t.max} vials`)}
                                  {t.pct > 0 && <span style={{ color: '#68D391', marginLeft: 8, fontSize: '0.75rem' }}>+{t.pct}%</span>}
                                  {t.pct === 0 && !isStorefrontOwner && <span style={{ color: 'var(--teal)', marginLeft: 8, fontSize: '0.75rem' }}>Best Price</span>}
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
                      {showBulkPricing ? 'Hide Bulk Pricing' : 'See Bulk Pricing'}
                    </button>
                    {showBulkPricing && (
                      <div style={{
                        position: 'absolute', bottom: 80, left: 24, right: 24,
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 'var(--radius-md)', overflow: 'hidden',
                        background: 'var(--surface-2)', zIndex: 10,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                      }}>
                        <div style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.04)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--silver)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          Bulk Volume Discounts
                          <button
                            type="button"
                            onClick={() => setShowBulkPricing(false)}
                            aria-label="Close bulk pricing"
                            style={{
                              width: 26, height: 26, minWidth: 26, minHeight: 26,
                              borderRadius: '50%', padding: 0, boxSizing: 'border-box',
                              background: 'rgba(255,255,255,0.08)',
                              border: '1px solid rgba(255,255,255,0.18)',
                              color: 'var(--silver)', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
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
                                  {tier.min}+ Vials <span style={{ color: '#68D391', marginLeft: 8, fontSize: '0.75rem' }}>{tier.pct}% Off</span>
                                </span>
                                <span style={{ fontSize: '0.9rem', fontWeight: 700, fontFamily: 'var(--font-brand)', color: 'var(--grey-300)' }}>${dp.toFixed(2)}/ea</span>
                              </div>
                            );
                          });
                        })()}
                        <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: '0.72rem', color: 'var(--grey-500)' }}>
                          Contact Your Agent To Place A Bulk Order Of 100+ Vials.
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Researchers Also Bought */}
                  <RecommendationStrip
                    title="Researchers Also Bought"
                    recommendations={recommendations}
                    loading={recommendationsLoading}
                    primaryColor={primaryColor}
                    onSelect={(pid) => {
                      const nextGroup = groupByProductId.get(pid);
                      if (nextGroup) {
                        setDetailProduct(nextGroup);
                        setPendingQty(isStorefrontOwner ? 10 : 1);
                      }
                    }}
                  />

                  {/* Close + Add To Cart — sticky at bottom on mobile */}
                  <div className="sf-modal-actions">
                    <button
                      className="sf-close-btn"
                      onClick={() => setDetailProduct(null)}
                    >
                      Close
                    </button>
                    <button
                      className="sf-add-btn"
                      style={{ background: primaryColor }}
                      onClick={() => {
                        const vId = selectedVariants[detailProduct.name] || detailProduct.defaultVariantId;
                        // Commit pendingQty to cart — ADD so repeated opens accumulate correctly.
                        setCartItems(prev => ({
                          ...prev,
                          [vId]: (prev[vId] || 0) + pendingQty,
                        }));
                        setDetailProduct(null);
                        setShowBulkPricing(false); // close bulk pricing when item added
                        setPendingQty(isStorefrontOwner ? 10 : 1); // Reset to default for next open
                        setShowCartFloat(true);
                      }}
                    >
                      Add To Cart ({pendingQty})
                    </button>
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
