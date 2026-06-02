'use client';

import React, { useState, useMemo, useCallback, useEffect, useDeferredValue, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { motion, Variants, AnimatePresence } from 'framer-motion';
import { Star, X, Heart, FileText, Search, SlidersHorizontal, RotateCcw, Check } from 'lucide-react';
import RecommendationStrip, { type RecommendationItem } from './RecommendationStrip';
import { getProductImage, toTitleCase } from '@/lib/categoryImage';
import PeptideVialCard from '@/components/PeptideVialCard';
import { toast } from 'sonner';

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
    fg = '#00E5FF';
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
  minOrderQty?: number;
  minOverallQty?: number;
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

export default function AgentStorefrontGrid({
  products,
  inventoryMap,
  primaryColor,
  agentSlug,
  bundles = [],
  initialWishlistIds = [],
  agentId = null,
  coaByProductId,
  volumePricingEnabled,
  isStorefrontOwner,
  viewerTier,
  minOrderQty = 1,
  minOverallQty = 1,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
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
  // Hydration-safe: do NOT read localStorage during the initial render. The
  // server has no localStorage, so reading it here desyncs the SSR vs client
  // first render and throws React #418. The stored view is restored in an
  // effect after mount (see the restore effect below).
  const initFromStore: Record<string, string> | null = null;
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

  // Restore the researcher's last saved view from localStorage AFTER mount so
  // the first client render matches the server (URL-only) render and avoids a
  // React #418 hydration mismatch. Skips when the URL already carries facets.
  const filtersRestored = useRef(false);
  useEffect(() => {
    if (filtersRestored.current) return;
    filtersRestored.current = true;
    if (urlHasAnyFacet) return;
    const stored = readStoredFilters();
    if (!stored) return;
    if (typeof stored.q === 'string') setSearchQuery(stored.q);
    if (typeof stored.sort === 'string') setSortBy(stored.sort as typeof initialSort);
    if (typeof stored.category === 'string') setFilterCategory(stored.category);
    if (stored.inStock !== undefined) setInStockOnly(stored.inStock === '1');
    if (stored.bulk !== undefined) setBulkOnly(stored.bulk === '1');
    if (typeof stored.min === 'string') setMinPrice(clampNum(stored.min, priceBounds.min));
    if (typeof stored.max === 'string') setMaxPrice(clampNum(stored.max, priceBounds.max));
    if (typeof stored.wMin === 'string') setMinWeight(clampNum(stored.wMin, weightBounds.min));
    if (typeof stored.wMax === 'string') setMaxWeight(clampNum(stored.wMax, weightBounds.max));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // Start empty so SSR and the first client render agree (no localStorage on
  // the server) — the saved cart is hydrated in the mount effect below. This
  // prevents a React #418 hydration mismatch on the cart badge / float.
  const [cartItems, setCartItems] = useState<Record<string, number>>({});
  // Saved For Later — items the buyer parked out of the active cart. Persisted
  // per-storefront so it survives navigation. Keyed by variant id like cartItems.
  const [savedForLater, setSavedForLater] = useState<Record<string, number>>({});
  useEffect(() => {
    try {
      // Existing cart for this storefront is ALWAYS the source of truth.
      let base: Record<string, number> = {};
      const saved = localStorage.getItem(`cart_${agentSlug}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') base = { ...parsed };
      }
      // Additively merge any pending reorder payload on TOP of the existing cart.
      // This guarantees a reorder can never empty or replace what is already here.
      const addRaw = localStorage.getItem(`pnl_reorder_add_${agentSlug}`);
      if (addRaw) {
        try {
          const add = JSON.parse(addRaw);
          if (add && typeof add === 'object') {
            for (const [k, v] of Object.entries(add)) {
              base[k] = (Number(base[k]) || 0) + Number(v || 0);
            }
          }
        } catch { /* ignore malformed payload */ }
        localStorage.removeItem(`pnl_reorder_add_${agentSlug}`);
      }
      if (Object.keys(base).length) setCartItems(base);

      // Hydrate Saved For Later.
      const sfl = localStorage.getItem(`pnl_saved_${agentSlug}`);
      if (sfl) {
        const parsed = JSON.parse(sfl);
        if (parsed && typeof parsed === 'object') setSavedForLater(parsed);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentSlug]);
  // Persist Saved For Later on change (skip first run so mount cannot wipe storage).
  const firstSavedSave = useRef(true);
  useEffect(() => {
    if (firstSavedSave.current) { firstSavedSave.current = false; return; }
    try { localStorage.setItem(`pnl_saved_${agentSlug}`, JSON.stringify(savedForLater)); } catch { /* ignore */ }
  }, [savedForLater, agentSlug]);
  // Move a cart line into Saved For Later (additive on the saved side).
  const saveItemForLater = (variantId: string) => {
    setCartItems(prev => {
      const qty = Number(prev[variantId]) || 0;
      if (qty <= 0) return prev;
      setSavedForLater(s => ({ ...s, [variantId]: (Number(s[variantId]) || 0) + qty }));
      const next = { ...prev };
      delete next[variantId];
      return next;
    });
  };
  // Move a saved line back into the active cart (additive on the cart side).
  const moveSavedToCart = (variantId: string) => {
    setSavedForLater(prev => {
      const qty = Number(prev[variantId]) || 0;
      if (qty <= 0) return prev;
      setCartItems(c => ({ ...c, [variantId]: (Number(c[variantId]) || 0) + qty }));
      const next = { ...prev };
      delete next[variantId];
      return next;
    });
  };
  const removeSavedItem = (variantId: string) => {
    setSavedForLater(prev => {
      const next = { ...prev };
      delete next[variantId];
      return next;
    });
  };
  const [showCartFloat, setShowCartFloat] = useState(false);
  const [cartToast, setCartToast] = useState(false);
  const [showBulkPricing, setShowBulkPricing] = useState(false);
  // Modal-only quantity input — does NOT touch cartItems until "Add To Cart" is pressed.
  // Agent self-buy: minimum 10 vials, increments of 10 (enforced here + server-side).
  const selfBuyStep = 1;   // agents can buy any quantity; tiered pricing applies below 10  // Enforce per-peptide minimum using min_order_qty (defaults to 1). Agent direct price unlocks at 10+
  const selfBuyMin  = minOrderQty ?? 1;
  const overallMin  = minOverallQty ?? 1;

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

  const [pendingQty, setPendingQty] = useState(isStorefrontOwner ? Math.max(10, selfBuyMin) : selfBuyMin);

  // Save cart to localStorage on change. Skip the very first run so the mount
  // pass (before the saved cart is hydrated above) cannot overwrite a stored
  // cart with the empty initial state.
  const firstCartSave = useRef(true);
  useEffect(() => {
    if (firstCartSave.current) { firstCartSave.current = false; return; }
    try {
      localStorage.setItem(`cart_${agentSlug}`, JSON.stringify(cartItems));

      // Continuously sync to the checkout format so the top-header checkout button works
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

      // Wipe any stale storefront carts from OTHER agents to prevent cross-contamination
      Object.keys(localStorage)
        .filter(k => k.startsWith('pnl_storefront_cart_') && k !== `pnl_storefront_cart_${agentSlug}`)
        .forEach(k => localStorage.removeItem(k));
      localStorage.removeItem('pnl_storefront_cart');

    } catch { /* ignore */ }
  }, [cartItems, agentSlug, products, isStorefrontOwner]);

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
    const item = products.find(p => p.id === variantId);
    if (!item) return;
    const maxQty = item.products?.inventory_count || 0;
    
    setCartItems(prev => {
      const currentQty = prev[variantId] || 0;
      if (currentQty >= maxQty) {
        toast.error(`Maximum available stock (${maxQty}) reached.`);
        return prev;
      }
      return { ...prev, [variantId]: currentQty + 1 };
    });
  }, [products]);

  const totalCartItems = Object.values(cartItems).reduce((sum, qty) => sum + qty, 0);
  const totalSavedItems = Object.values(savedForLater).reduce((sum, qty) => sum + Number(qty || 0), 0);

  // Reorder flow (and any deep link) can request the cart be opened on arrival via
  // ?cart=1. Open it once the cart has hydrated with items, then never re-open.
  const autoOpenCart = useRef(
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('cart') === '1'
  );
  const autoOpenedCart = useRef(false);
  useEffect(() => {
    if (autoOpenCart.current && !autoOpenedCart.current && totalCartItems > 0) {
      autoOpenedCart.current = true;
      setShowCartFloat(true);
    }
  }, [totalCartItems]);

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
        /* Outer metallic frame — same 3px brushed-metal ring as the peptide cards */
        .sf-toolbar {
          padding: 3px;
          border-radius: 18px;
          background: linear-gradient(145deg, #c8c2b8 0%, #a09890 30%, #8a847c 50%, #a09890 70%, #c8c2b8 100%);
          box-shadow: 0 8px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.4);
          margin-bottom: 24px;
          position: sticky;
          top: max(16px, var(--safe-top, 16px));
          z-index: 20;
        }
        /* Inner panel — even 16px padding on every side so the inputs never touch the frame */
        .sf-toolbar-inner {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px;
          background: linear-gradient(180deg, var(--surface-1, #0F1923) 0%, var(--surface-2, #162230) 100%);
          border-radius: 15px;
          box-shadow: inset 0 2px 10px rgba(0,0,0,0.6);
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
          .sf-toolbar-inner { flex-direction: row; flex-wrap: nowrap; align-items: center; padding: 16px; }
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
        /* Premium thick brushed-nickel frame */
        .sf-modal-sheet {
          width: 100%; max-height: 95dvh; overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          background: linear-gradient(180deg, #131b24 0%, #0a0f14 100%) padding-box,
                      linear-gradient(135deg, #b0b5bc 0%, #5c626b 20%, #e2e6eb 50%, #5c626b 80%, #b0b5bc 100%) border-box;
          border-radius: 22px 22px 0 0;
          border: 5px solid transparent;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.15),
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
              inset 0 1px 0 rgba(255,255,255,0.15),
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

      {/* Faceted Search & Filter Toolbar — outer metal frame matches the peptide cards */}
      <div className="sf-toolbar">
        <div className="sf-toolbar-inner">
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
                setPendingQty(existingQty ?? (isStorefrontOwner ? Math.max(10, selfBuyMin) : selfBuyMin));
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
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    const fallback = getProductImage(null, group.category || 'Other', group.name);
                    if (target.src !== fallback && target.src !== window.location.origin + fallback) {
                      target.src = fallback;
                    } else {
                      target.src = '/images/peptide_clear.png';
                      target.style.opacity = '0.9';
                    }
                  }}
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
                    // retail_price is the 10-pack price; divide by 10 for individual vial price.
                    // Storefront owner (agent self-buy) sees their admin-configured tier cost
                    // — wholesale buyers always pay tier flat, never retail or sale markup.
                    const perVialBase = isStorefrontOwner && (defaultV as any).cost_price != null
                      ? Number((defaultV as any).cost_price) / 10
                      : defaultV.retail_price / 10;
                    const isOnSale = !isStorefrontOwner && (defaultV as any).is_on_sale && (defaultV as any).sale_price;
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
      <div style={{ position: 'fixed', bottom: 'env(safe-area-inset-bottom, 0px)', right: 0, zIndex: 9999, pointerEvents: 'none' }}>
        {/* Floating Cart Button */}
        <div
          role="button"
          tabIndex={0}
          className="floating-cart-wrapper hover-cart-float"
          onClick={() => {
            if (totalCartItems === 0 && totalSavedItems === 0) {
              setCartToast(true);
              setTimeout(() => setCartToast(false), 2500);
            } else {
              setShowCartFloat(!showCartFloat);
            }
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cart-icon.png" width={160} height={160} alt="Cart" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
          {totalCartItems > 0 && (
            <span style={{
              position: 'absolute', top: '38%', left: '47%', transform: 'translate(-50%, -50%)', width: 24, height: 24,
              borderRadius: '50%', background: '#14B8A6', color: '#FFFFFF',
              fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.5), 0 0 0 1.5px rgba(255,255,255,0.3)',
              zIndex: 10
            }}>
              {totalCartItems}
            </span>
          )}
        </div>

        {/* Cart dropdown */}
        <AnimatePresence>
          {showCartFloat && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCartFloat(false)}
              style={{
                position: 'fixed', inset: 0, zIndex: 100000,
                background: 'rgba(5,10,15,0.92)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: 'max(16px, env(safe-area-inset-top)) 12px calc(16px + env(safe-area-inset-bottom, 0px)) 12px',
                pointerEvents: 'auto', overflowY: 'auto'
              }}
            >
              <div onClick={(e) => e.stopPropagation()} style={{
                width: '100%', maxWidth: 680, margin: 'auto 0', display: 'flex', flexDirection: 'column',
                background: 'linear-gradient(180deg, #131b24 0%, #0a0f14 100%)',
                border: '3px solid transparent', backgroundClip: 'padding-box',
                borderRadius: 24,
                // Thick brushed-nickel frame (matches the premium product detail modal):
                // dark/light/dark beveled metal ring + deep ambient shadow.
                boxShadow: '0 0 0 2px #5d6166, 0 0 0 4px #b9bdc2, 0 0 0 6px #6c7075, inset 0 1px 0 rgba(255,255,255,0.10), 0 30px 90px rgba(0,0,0,0.85), 0 6px 28px rgba(160,168,176,0.14)',
                overflow: 'hidden', maxHeight: '92dvh'
              }}>
              <div style={{ padding: '20px 22px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(180deg, rgba(255,255,255,0.05), transparent)' }}>
                <span style={{ fontWeight: 800, color: 'var(--white)', fontSize: '1.2rem', letterSpacing: '0.01em' }}>
                  Your Cart ({totalCartItems} {totalCartItems === 1 ? 'Item' : 'Items'})
                </span>
                <button onClick={() => setShowCartFloat(false)} aria-label="Close Cart" style={{
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', color: 'var(--white)',
                  width: 38, height: 38, borderRadius: '50%', cursor: 'pointer', fontSize: '1rem', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>X</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(cartItems).map(([variantId, qty]) => {
                  const item = products.find(p => p.id === variantId);
                  if (!item) return null;
                  const name = item.products?.name || 'Product';
                  const size = item.products?.unit_size ? `${item.products.unit_size}${item.products.unit_measure || ''}` : '';
                  const imgUrl = getProductImage(
                    item.custom_image_url ?? item.products?.image_url ?? null,
                    item.products?.category || 'Other',
                    name,
                  );
                  const perVial = isStorefrontOwner && (item as any).cost_price != null
                    ? Number((item as any).cost_price) / 10
                    : item.retail_price / 10;
                  return (
                    <div key={variantId} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: 10,
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12,
                    }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imgUrl ?? undefined}
                        alt={name}
                        width={64}
                        height={64}
                        style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', flexShrink: 0, background: '#0F1923' }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          const fallback = getProductImage(null, item.products?.category || 'Other', name);
                          if (target.src !== fallback && target.src !== window.location.origin + fallback) {
                            target.src = fallback;
                          } else {
                            target.src = '/images/peptide_clear.png';
                          }
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.9rem', color: 'var(--white)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {name} {size && `(${size})`}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginBottom: 6 }}>
                          ${formatPrice(perVial)} Each · ${formatPrice(perVial * qty)} Total
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
                        <input
                          type="number"
                          min="0"
                          value={qty || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setCartItems(prev => {
                              const next = { ...prev };
                              if (isNaN(val)) {
                                return next;
                              }
                              const prodItem = products.find(p => p.id === variantId);
                              const maxQty = prodItem?.products?.inventory_count || 0;
                              
                              let boundedVal = val;
                              if (val > maxQty) {
                                toast.error(`Maximum available stock is ${maxQty}.`);
                                boundedVal = maxQty;
                              }

                              if (boundedVal <= 0) {
                                delete next[variantId];
                              } else {
                                next[variantId] = boundedVal;
                              }
                              return next;
                            });
                          }}
                          onBlur={(e) => {
                            if (e.target.value === '' || parseInt(e.target.value, 10) <= 0) {
                              setCartItems(prev => {
                                const next = { ...prev };
                                delete next[variantId];
                                return next;
                              });
                            }
                          }}
                          style={{ 
                            color: 'var(--white)', fontWeight: 700, fontSize: '0.8rem', 
                            width: 40, textAlign: 'center', background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, padding: '2px',
                            appearance: 'textfield', outline: 'none'
                          }}
                        />
                        <button onClick={() => addToCart(variantId)} style={{
                          width: 36, height: 36, borderRadius: '50%', border: 'none',
                          background: primaryColor, color: 'var(--white)', cursor: 'pointer', fontSize: '0.85rem',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800,
                          flexShrink: 0, touchAction: 'manipulation'
                        }}>+</button>
                      </div>
                        <button
                          type="button"
                          onClick={() => saveItemForLater(variantId)}
                          style={{
                            marginTop: 8, alignSelf: 'flex-start', background: 'none', border: 'none',
                            color: 'var(--silver)', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer',
                            padding: 0, textDecoration: 'underline', textUnderlineOffset: 2,
                          }}
                        >
                          Save For Later
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Saved For Later */}
                {Object.keys(savedForLater).length > 0 && (
                  <div style={{ marginTop: 6, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--white)', fontWeight: 800 }}>
                      Saved For Later ({totalSavedItems} {totalSavedItems === 1 ? 'Item' : 'Items'})
                    </div>
                    {Object.entries(savedForLater).map(([variantId, qty]) => {
                      const item = products.find(p => p.id === variantId);
                      if (!item) return null;
                      const name = item.products?.name || 'Product';
                      const size = item.products?.unit_size ? `${item.products.unit_size}${item.products.unit_measure || ''}` : '';
                      const imgUrl = getProductImage(
                        item.custom_image_url ?? item.products?.image_url ?? null,
                        item.products?.category || 'Other',
                        name,
                      );
                      const perVial = isStorefrontOwner && (item as any).cost_price != null
                        ? Number((item as any).cost_price) / 10
                        : item.retail_price / 10;
                      return (
                        <div key={variantId} style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: 10,
                          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12,
                        }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imgUrl ?? undefined}
                            alt={name}
                            width={56}
                            height={56}
                            style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', flexShrink: 0, background: '#0F1923', opacity: 0.9 }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              const fallback = getProductImage(null, item.products?.category || 'Other', name);
                              if (target.src !== fallback) {
                                target.src = fallback;
                              } else {
                                target.src = '/images/peptide_clear.png';
                              }
                            }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.86rem', color: 'var(--white)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {name} {size && `(${size})`}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--grey-400)', marginBottom: 6 }}>
                              ${formatPrice(perVial)} Each · Qty {Number(qty)}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <button
                                type="button"
                                onClick={() => moveSavedToCart(variantId)}
                                style={{
                                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                                  color: 'var(--white)', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer',
                                  padding: '6px 12px', borderRadius: 8,
                                }}
                              >
                                Move To Cart
                              </button>
                              <button
                                type="button"
                                onClick={() => removeSavedItem(variantId)}
                                style={{
                                  background: 'none', border: 'none', color: 'var(--grey-400)',
                                  fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', padding: 0,
                                  textDecoration: 'underline', textUnderlineOffset: 2,
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div style={{ padding: '16px 20px calc(18px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid rgba(255,255,255,0.10)', display: 'flex', flexDirection: 'column', gap: 10, background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.25))' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.9rem', color: 'var(--grey-300)', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700 }}>Total</span>
                  <span style={{ color: 'var(--white)', fontWeight: 800, fontSize: '1.25rem', letterSpacing: '0.01em' }}>
                    ${Object.entries(cartItems).reduce((sum, [vId, qty]) => {
                      const item = products.find(p => p.id === vId);
                      if (!item) return sum;
                      // Storefront owner sees tier cost in their cart total — must
                      // match what the order route will actually charge them.
                      const per = isStorefrontOwner && (item as any).cost_price != null
                        ? Number((item as any).cost_price) / 10
                        : item.retail_price / 10;
                      return sum + per * qty;
                    }, 0).toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={() => {
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
                      } catch (e) {
                        console.error('Failed to sync cart:', e);
                      }
                      setShowCartFloat(false);
                      // Pass agentSlug in URL so checkout page enforces this agent's catalog only.
                      window.location.href = `/checkout?agent=${encodeURIComponent(agentSlug)}`;
                    }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'center', padding: '16px',
                      background: primaryColor, color: 'var(--white)', borderRadius: 14,
                      fontWeight: 800, fontSize: '1.02rem', letterSpacing: '0.02em',
                      border: '1px solid rgba(255,255,255,0.25)', cursor: 'pointer', minHeight: 56,
                      boxShadow: `0 8px 22px ${primaryColor}55, inset 0 1px 0 rgba(255,255,255,0.30)`
                    }}
                  >
                    Go To Checkout
                  </button>
                  <button
                    onClick={() => setShowCartFloat(false)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'center', padding: '13px',
                      background: 'rgba(255,255,255,0.07)', color: 'var(--white)', borderRadius: 12,
                      fontWeight: 700, fontSize: '0.9rem', border: '1.5px solid rgba(255,255,255,0.22)',
                      cursor: 'pointer', minHeight: 48
                    }}
                  >
                    Keep Shopping
                  </button>
                  <button onClick={() => { setCartItems({}); setShowCartFloat(false); }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'center', padding: '11px',
                      background: 'rgba(229,62,62,0.08)', color: '#F08A8A', borderRadius: 12,
                      fontWeight: 700, fontSize: '0.82rem', border: '1.5px solid rgba(229,62,62,0.32)', cursor: 'pointer'
                    }}
                  >
                    Clear Cart
                  </button>
                </div>
              </div>
              </motion.div>
            )}
          </AnimatePresence>
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

      {/* Full-Screen Certificate Modal */}


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
                    className="hover-bg-glass"
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
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    const fallback = getProductImage(null, detailProduct.category || 'Other', detailProduct.name);
                    if (target.src !== fallback && target.src !== window.location.origin + fallback) {
                      target.src = fallback;
                    } else {
                      target.src = '/images/peptide_clear.png';
                      target.style.opacity = '0.9';
                    }
                  }}
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
                  const coaUrl = pid ? coaByProductId?.[pid] : undefined;
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
                  const agentQualifiesForDiscount = isStorefrontOwner;

                  // Dynamic pricing tiers:
                  // Agents see tiered pricing with 10+ labeled "Agent Direct Price".
                  // Below 10 vials, agents pay the same retail dynamic rate as researchers.
                  // Researchers see tiers only when volumePricingEnabled.
                  const tiers = isStorefrontOwner
                    ? [
                        // Agents and storefront owners always pay tier cost on every
                        // quantity — dynamic/bulk pricing is for researchers only.
                        { label: 'All Quantities — Agent Direct Price', min: 1, max: Infinity, pct: 0 },
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
                    // Storefront owner (agent) always pays admin-configured tier cost,
                    // regardless of quantity. No retail markup, no volume bracket switch.
                    if (isStorefrontOwner) return agentCostPerVial;
                    // Researcher: retail + tiered markup (or flat when volume pricing off).
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
                                    flex: '1 1 calc(16.666% - 8px)', minWidth: 60, textAlign: 'center',
                                    padding: '8px 4px', borderRadius: 'var(--radius-md)',
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
                              Agent Direct Price · All Quantities
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
                            <input
                              type="number"
                              value={qty || ''}
                              onChange={e => {
                                const val = parseInt(e.target.value, 10);
                                if (!isNaN(val)) {
                                  setPendingQty(Math.max(selfBuyMin, val));
                                } else if (e.target.value === '') {
                                  setPendingQty(0); // Temporary state while typing
                                }
                              }}
                              onBlur={() => {
                                if (qty < selfBuyMin) setPendingQty(selfBuyMin);
                              }}
                              style={{
                                width: 54, textAlign: 'center', fontSize: '1.2rem', fontWeight: 800,
                                color: 'var(--white)', fontFamily: 'var(--font-brand)',
                                background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '4px', outline: 'none', appearance: 'textfield'
                              }}
                            />
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
                            {isStorefrontOwner && (
                              <div style={{ fontSize: '0.7rem', color: '#68D391', fontWeight: 700,
                                textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                                Agent Direct Price Applied
                              </div>
                            )}
                            <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginBottom: 2 }}>
                              ${unitPrice.toFixed(2)}/vial x {qty}
                            </div>
                            <div style={{
                              fontSize: '1.5rem', fontWeight: 800,
                              color: primaryColor,
                              fontFamily: 'var(--font-brand)',
                              textShadow: `0 0 10px ${primaryColor}40`
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
                        setPendingQty(isStorefrontOwner ? Math.max(10, selfBuyMin) : selfBuyMin);
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
                        setPendingQty(isStorefrontOwner ? Math.max(10, selfBuyMin) : selfBuyMin); // Reset to default for next open
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
