'use client';

import React, { useState, useMemo, useCallback, useEffect, useDeferredValue, useRef } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { motion, Variants, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Star, X, Heart, FileText, Search, SlidersHorizontal, RotateCcw, Check, ShoppingCart, ArrowRight, Sparkles, Flame, Zap, Brain, Shield, Hourglass, Moon, Activity, Syringe, Wind } from 'lucide-react';
import RecommendationStrip, { type RecommendationItem } from './RecommendationStrip';
import ProductMonograph from './research/ProductMonograph';
import IframeLink from '@/components/ui/IframeLink';
import DiscoveryHero, { type MatchedProduct } from './storefront/StorefrontDiscovery';
import type { ModalGroupedProductRef } from './storefront/ProductModalEnhancements';
import DynamicAddToCartButton from './storefront/DynamicAddToCartButton';
import DynamicCartButton from './storefront/DynamicCartButton';
import DynamicDetailButton from './storefront/DynamicDetailButton';
import { evidenceTier, EVIDENCE_TIER, RISK_META, intranasalDisplay, type Compound } from '@/lib/compounds';
import { getProductImage, toTitleCase } from '@/lib/categoryImage';
import PeptideVialCard from '@/components/PeptideVialCard';
import GuestAuthModal from '@/components/GuestAuthModal';
import { trackStorefrontEvent } from '@/lib/track';
import { toast } from 'sonner';
import { writeCatalogCache, isCatalogCacheFresh, readCatalogCache, CATALOG_TTL_MS, evictCatalogCache } from '@/lib/storefront-cache';
import { createClient } from '@/lib/supabase/client';
import { getPopularName } from '@/lib/peptide-popular-names';
import { quantityDiscountPct, discountedUnitPrice, isVolumeDiscountExcluded, QUANTITY_DISCOUNT_TIERS } from '@/lib/quantity-discount';
import TrustStrip from './storefront/TrustStrip';

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

import { StockBadge, computeStockState, type StockState } from './storefront/StockBadge';

// Heavy, interaction-only storefront UI (~3.2k lines combined) split into
// on-demand chunks so they no longer ship in the storefront's initial JS bundle.
// ProductModalEnhancements only mounts when a product-detail modal opens;
// StorefrontCompareDrawer stays hidden until the compare tray is engaged.
// ssr:false is safe - both are client-only interactive UI, not SEO/product content.
const ProductModalEnhancements = dynamic(() => import('./storefront/ProductModalEnhancements'), { ssr: false });
const StorefrontCompareDrawer = dynamic(() => import('./storefront/StorefrontCompareDrawer'), { ssr: false });
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
  initialWishlistIds?: string[];
  agentId?: string | null;
  coaByProductId?: Record<string, string>;
  volumePricingEnabled?: boolean;
  isStorefrontOwner?: boolean;
  viewerTier?: string;
  minOrderQty?: number;
  minOverallQty?: number;
  compoundsBySlug?: Record<string, Compound>;
  featuredProductIds?: string[];
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
  compoundSlug: string | null;
  /** Search-match metadata attached by the filtered/sorted projection. */
  _search?: { score: number; reason?: string; confidence?: 'high' | 'medium' | 'low' } | null;
}

const POPULAR_ORDER: string[] = [
  'The Appetite Crusher Stack (Cagrilintide 5mg + Semaglutide 5mg)',
  'GH Synergy Stack (CJC 5mg + IPA 5mg)',
  'The Wolverine Stack (BPC 10mg + TB 10mg)',
  'The Wolverine Stack (BPC 5mg + TB 5mg)',
  'Glow Stack (TB10 + BPC10 + GHK50)',
  'KLOW STACK (TB10+BPC10+GHK50+KPV10)',
  'The Furnace Stack (L-Carnitine Blend)',
  'The Lipolysis Stack (Lemon Bottle)',
  'Limitless Stack (Semax + Selank)',
  'Shred Stack (Tirzepatide + AOD9604)',
  'Semaglutide',
  'Tirzepatide',
  'Retatrutide',
  'BPC 157',
  'TB500 (Thymosin B4 Acetate)',
  'Sermorelin Acetate',
  'Ipamorelin',
  'GHK-CU',
  'NAD+',
  'AOD9604',
  'CJC-1295 Without DAC',
  'CJC-1295 With DAC',
  'KPV',
  'Semax',
  'Selank',
];

const CARD_MAPPINGS = [
  { index: 1, label: 'Top 10 Best Peptides', query: '' },
  { index: 2, label: 'Weight Loss & Metabolism', query: 'weight loss' },
  { index: 3, label: 'Muscle Growth & Performance', query: 'muscle growth' },
  { index: 4, label: 'Immunity & Wellness', query: 'immunity' },
  { index: 5, label: 'Anti-Aging & Longevity', query: 'anti-aging' },
  { index: 6, label: 'Healing & Recovery', query: 'healing' },
  { index: 7, label: 'Sexual Health & Hormones', query: 'sexual health' },
  { index: 8, label: 'Skin, Hair & Cosmetics', query: 'skin & hair' },
  { index: 9, label: 'Peptide Stacks', query: '' }
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

function formatPrice(price: number): string {
  return price.toFixed(2);
}

import { highlightText, splitProductName, getEditDistance } from '@/lib/storefront-helpers';

function pickDefaultVariant(variants: ProductItem[]): string {
  const ten = variants.find(v => parseFloat(v.products?.unit_size || '0') === 10);
  if (ten) return ten.id;
  const above = variants.filter(v => parseFloat(v.products?.unit_size || '0') >= 10)
    .sort((a, b) => parseFloat(a.products?.unit_size || '0') - parseFloat(b.products?.unit_size || '0'));
  if (above.length > 0) return above[0].id;
  return variants[variants.length - 1]?.id ?? variants[0]?.id ?? '';
}

/**
 * Background catalog cache refresher - stale-while-revalidate.
 *
 * 1. Fires on mount (checks TTL, skips if still fresh).
 * 2. Refreshes every CATALOG_TTL_MS / 2 to keep the cache warm.
 * 3. Subscribes to Supabase Realtime on the agent_products table so that
 *    any admin update (price change, visibility toggle, new product) evicts
 *    the cache and re-fetches within seconds - not the next TTL expiry.
 *
 * Does NOT update live React state - the SSR-hydrated props are always
 * authoritative for the current render. The cache only benefits future visits.
 */
function useCatalogRefresh(agentSlug: string) {
  const refreshIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const doRefresh = React.useCallback(async (force = false) => {
    try {
      // Skip if cache is still fresh and we're not forcing
      if (!force) {
        const cached = readCatalogCache(agentSlug);
        if (cached && isCatalogCacheFresh(cached)) return;
      }

      // The catalog URL is edge-cached (s-maxage=60). Forced refreshes come
      // from the Realtime listener reacting to a JUST-committed change, so a
      // cache-busting query param makes them bypass the CDN copy and hit the
      // origin (whose data cache was tag-purged by the mutation). Mount and
      // interval refreshes are warmers and deliberately keep the plain URL so
      // they can be served from the edge cache.
      const url = force
        ? `/api/storefront/catalog/${encodeURIComponent(agentSlug)}?fresh=${Date.now()}`
        : `/api/storefront/catalog/${encodeURIComponent(agentSlug)}`;
      const res = await fetch(url, {
        method: 'GET',
        credentials: 'omit', // public endpoint - no cookies needed
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.products && Array.isArray(data.products)) {
        writeCatalogCache(agentSlug, { ...data, fetchedAt: Date.now() });
      }
    } catch {
      // Best-effort - never throw
    }
  }, [agentSlug]);

  React.useEffect(() => {
    // Immediate refresh on mount (checks TTL internally)
    doRefresh(false);

    // Recurring refresh at half the TTL to keep the cache warm
    refreshIntervalRef.current = setInterval(
      () => doRefresh(false),
      CATALOG_TTL_MS / 2
    );

    // ── Realtime: evict + re-fetch the moment any product is updated ────────
    // Listens for INSERT/UPDATE/DELETE on agent_products (any agent) - the
    // server-side catalog API is what's actually scoped per agent_id. This
    // client-side listener just triggers a forced refresh when anything changes,
    // which is cheap (the API response is served from Vercel edge cache).
    let supabase: ReturnType<typeof createClient> | null = null;
    let realtimeChannel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null;
    try {
      supabase = createClient();
      realtimeChannel = supabase
        .channel(`catalog-invalidate-${agentSlug}`)
        .on(
          'postgres_changes',
          {
            event: '*', // INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'agent_products',
          },
          () => {
            // Evict stale cache and immediately fetch fresh data
            evictCatalogCache(agentSlug);
            doRefresh(true);
          }
        )
        .subscribe();
    } catch {
      // Realtime unavailable - gracefully degrade to interval-only refresh
    }

    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      if (supabase && realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, [doRefresh, agentSlug]);
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
  compoundsBySlug = {},
  featuredProductIds = [],
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [showStoreGrid, setShowStoreGrid] = useState(true);
  const [visibleCount, setVisibleCount] = useState(24);
  // When a logged-out visitor tries a member-only action (e.g. saving to their
  // wishlist), the API returns 401. Instead of silently failing, we surface the
  // sign-in / create-account modal so that guest interest converts to a signup.
  const [guestModalFeature, setGuestModalFeature] = useState<string | null>(null);

  // These three state declarations must live before any callbacks that reference
  // their setters (closeGrid calls setFilterArea, setFilterCategory, setSearchQuery).
  // They depend on getInit which is defined below, but that’s fine since
  // useState’s initializer only runs once on mount - it’s not re-evaluated on re-renders.
  // We forward-declare the helper inline.
  const _getSearchParam = (key: string): string => {
    if (typeof window === 'undefined') return '';
    try { return new URLSearchParams(window.location.search).get(key) ?? ''; } catch { return ''; }
  };
  const [searchQuery, setSearchQuery] = useState<string>(() => _getSearchParam('q'));
  const [filterCategory, setFilterCategory] = useState<string>(() => _getSearchParam('category') || 'all');
  const [filterArea, setFilterArea] = useState<string>(() => _getSearchParam('area') || '');

  // Keep the localStorage catalog cache warm - fires on mount and every 5 min.
  // Benefits: next navigation to this storefront renders instantly from cache.
  useCatalogRefresh(agentSlug);

  const openGrid = useCallback(() => {
    if (typeof window !== 'undefined') {
      setShowStoreGrid(true);
      try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch {}
    }
  }, []);

  const closeGrid = useCallback(() => {
    if (typeof window !== 'undefined') {
      setShowStoreGrid(false);
      setFilterArea('');
      setFilterCategory('all');
      setSearchQuery('');
      try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch {}
    }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);
  // Funnel analytics (best-effort, non-blocking): storefront pageview. Activates
  // the existing agent analytics dashboard (agent_storefront_analytics_30d).
  useEffect(() => {
    trackStorefrontEvent(agentSlug, 'pageview');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentSlug]);
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
        setWishlist(prev => {
          const next = new Set(prev);
          if (isAdding) next.delete(productId);
          else next.add(productId);
          return next;
        });
        // Guests get 401 here -- convert the intent into a signup prompt.
        if (res.status === 401) setGuestModalFeature('Save To Your Wishlist');
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
      // Best-effort - never block UI
    }
  }, [agentId]);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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
  // getInit reads from URL params only — search query is intentionally not restored on return.
  const getInit = (key: string): string => {
    const fromUrl = searchParams?.get(key);
    if (fromUrl !== null && fromUrl !== undefined) return fromUrl;
    return '';
  };

  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  // searchQuery is declared earlier (before closeGrid) to avoid TDZ error.
  const deferredSearch = useDeferredValue(searchQuery);

  // Funnel step: storefront search. Debounced so we record the query the researcher
  // settled on, not every keystroke. Queries that arrive via ?q= (DiscoveryHero /
  // FindAPeptide navigations) were already tracked by the originating surface, so
  // the first emit for that exact query is skipped to avoid double counting.
  const urlSeededSearchRef = useRef<string>(_getSearchParam('q').trim());
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) return;
    if (urlSeededSearchRef.current && q === urlSeededSearchRef.current) {
      urlSeededSearchRef.current = '';
      return;
    }
    const t = setTimeout(() => trackStorefrontEvent(agentSlug, 'search', { search_term: q }), 800);
    return () => clearTimeout(t);
  }, [searchQuery, agentSlug]);
  const [activeCardIndex, setActiveCardIndex] = useState<number | null>(1);
  const [aiSearchFallbackQuery, setAiSearchFallbackQuery] = useState<string>('');

  const didYouMeanSuggestion = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || q.length < 3) return null;

    const canonicals = [
      'BPC-157', 'TB-500', 'Tirzepatide', 'Semaglutide', 'Retatrutide',
      'AOD-9604', 'GHK-Cu', 'Ipamorelin', 'Sermorelin', 'CJC-1295',
      'KPV', 'Melanotan II', 'Epithalon', '5-Amino-1MQ', 'NAD+',
      'Weight Loss', 'Muscle Growth', 'Immunity', 'Anti-Aging',
      'Healing', 'Sexual Health', 'Skin & Hair'
    ];

    for (const term of canonicals) {
      const termLower = term.toLowerCase();
      if (q === termLower) return null;
      
      const cleanQ = q.replace(/[\s-_]+/g, '');
      const cleanTerm = termLower.replace(/[\s-_]+/g, '');
      if (cleanQ === cleanTerm) {
        return term;
      }
      
      if (Math.abs(cleanQ.length - cleanTerm.length) <= 2) {
        const dist = getEditDistance(cleanQ, cleanTerm);
        if (dist >= 1 && dist <= 2) {
          return term;
        }
      }
    }
    return null;
  }, [searchQuery]);

  const [pinnedNames, setPinnedNames] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = window.localStorage.getItem('pnl:compare') || '[]';
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        return new Set(list.map((x: { productName: string }) => x.productName));
      }
    } catch {}
    return new Set<string>();
  });

  useEffect(() => {
    const syncPinned = () => {
      try {
        const raw = window.localStorage.getItem('pnl:compare') || '[]';
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          setPinnedNames(new Set(list.map((x: { productName: string }) => x.productName)));
        }
      } catch {}
    };
    window.addEventListener('pnl:compare-changed', syncPinned);
    window.addEventListener('storage', syncPinned);
    return () => {
      window.removeEventListener('pnl:compare-changed', syncPinned);
      window.removeEventListener('storage', syncPinned);
    };
  }, []);

  const pin = useCallback((group: GroupedProduct, activeVariant: ProductItem) => {
    if (typeof window === 'undefined') return;
    const pricePerVialDollars = activeVariant ? Number(activeVariant.retail_price) / 10 : null;
    const detail = {
      productName: group.name,
      imageUrl: group.imageUrl,
      pricePerVialDollars,
      compoundSlug: group.compoundSlug,
      evidenceTierKey: group.compoundSlug && compoundsBySlug ? compoundsBySlug[group.compoundSlug]?.evidence_tier ?? null : null,
      category: group.category,
      pinnedAt: Date.now(),
    };
    try {
      window.dispatchEvent(new CustomEvent('pnl:compare-add', { detail }));
    } catch {}
    try {
      const raw = window.localStorage.getItem('pnl:compare') || '[]';
      const list = JSON.parse(raw) as Array<typeof detail>;
      const filtered = list.filter((x) => x.productName !== group.name);
      filtered.push(detail);
      const trimmed = filtered.slice(-4);
      window.localStorage.setItem('pnl:compare', JSON.stringify(trimmed));
      window.dispatchEvent(new CustomEvent('pnl:compare-changed'));
    } catch {}
  }, [compoundsBySlug]);

  const unpin = useCallback((group: GroupedProduct) => {
    if (typeof window === 'undefined') return;
    try {
      window.dispatchEvent(new CustomEvent('pnl:compare-remove', { detail: { productName: group.name } }));
    } catch {}
    try {
      const raw = window.localStorage.getItem('pnl:compare') || '[]';
      const list = JSON.parse(raw) as Array<any>;
      const filtered = list.filter((x) => x.productName !== group.name);
      window.localStorage.setItem('pnl:compare', JSON.stringify(filtered));
      window.dispatchEvent(new CustomEvent('pnl:compare-changed'));
    } catch {}
  }, []);

  useEffect(() => {
    // If URL has search query or category/area filters on mount, clear default Top 10 card selection
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('q') || params.get('category') || params.get('area')) {
        setActiveCardIndex(null);
      }
    }
  }, []);

  const [semanticMatches, setSemanticMatches] = useState<Record<string, { score: number, reason: string }>>({});

  useEffect(() => {
    const q = deferredSearch.trim();
    if (q.length < 3) {
      setSemanticMatches({});
      return;
    }
    const timer = setTimeout(() => {
      fetch('/api/storefront/semantic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q }),
        credentials: 'omit'
      })
      .then(r => r.ok ? r.json() : { matches: {} })
      .then(data => {
        if (data && data.matches) {
          setSemanticMatches(data.matches);
        }
      })
      .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [deferredSearch]);

  const initialSort = (getInit('sort') || 'popular') as
    | 'popular' | 'name_asc' | 'name_desc' | 'price_low' | 'price_high' | 'newest';
  const [sortBy, setSortBy] = useState<typeof initialSort>(initialSort);

  React.useEffect(() => {
    setVisibleCount(24);
  }, [deferredSearch, filterCategory, filterArea, sortBy, activeCardIndex]);

  // filterCategory, filterArea, and searchQuery are declared earlier (before closeGrid)
  // to avoid the TDZ error from referencing their setters in the useCallback.
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [inStockOnly, setInStockOnly] = useState<boolean>(getInit('inStock') === '1');
  const [bulkOnly, setBulkOnly] = useState<boolean>(getInit('bulk') === '1');

  const priceBounds = useMemo(() => {
    const prices = (products ?? []).map(p => Number(p.retail_price)).filter(n => Number.isFinite(n));
    if (prices.length === 0) return { min: 0, max: 0 };
    return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) };
  }, [products]);
  const weightBounds = useMemo(() => {
    const weights = (products ?? [])
      .map(p => Number(p.products?.weight_oz))
      .filter(n => Number.isFinite(n) && n > 0);
    if (weights.length === 0) return { min: 0, max: 0 };
    const lo = Math.min(...weights);
    const hi = Math.max(...weights);
    return { min: Math.floor(lo * 2) / 2, max: Math.ceil(hi * 2) / 2 };
  }, [products]);

  const clampNum = (v: string, fallback: number): number => {
    if (!v) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const [minPrice, setMinPrice] = useState<number>(clampNum(getInit('min'), priceBounds.min));
  const [maxPrice, setMaxPrice] = useState<number>(clampNum(getInit('max'), priceBounds.max));
  const [minWeight, setMinWeight] = useState<number>(clampNum(getInit('wMin'), weightBounds.min));
  const [maxWeight, setMaxWeight] = useState<number>(clampNum(getInit('wMax'), weightBounds.max));

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

  const filtersRestored = useRef(false);
  useEffect(() => {
    if (filtersRestored.current) return;
    filtersRestored.current = true;
    if (urlHasAnyFacet) return;
    const stored = readStoredFilters();
    if (!stored) return;
    // Do not restore search query so it is cleared on return
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

  const urlSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (urlSyncTimer.current) clearTimeout(urlSyncTimer.current);
    urlSyncTimer.current = setTimeout(() => {
      const params = new URLSearchParams();
      // Do not sync search query to URL so it clears on back navigation
      if (filterCategory && filterCategory !== 'all') params.set('category', filterCategory);
      if (filterArea) params.set('area', filterArea);
      if (sortBy && sortBy !== 'popular') params.set('sort', sortBy);
      if (minPrice !== priceBounds.min) params.set('min', String(minPrice));
      if (maxPrice !== priceBounds.max) params.set('max', String(maxPrice));
      if (inStockOnly) params.set('inStock', '1');
      if (bulkOnly) params.set('bulk', '1');
      if (minWeight !== weightBounds.min) params.set('wMin', String(minWeight));
      if (maxWeight !== weightBounds.max) params.set('wMax', String(maxWeight));
      const qs = params.toString();
      const currentPathname = pathname;
      const target = qs ? `${currentPathname}?${qs}` : currentPathname;
      try {
        router.replace(target, { scroll: false });
      } catch {
        // router can be unavailable in tests; ignore.
      }
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
    }, [
    searchQuery, filterCategory, filterArea, sortBy,
    minPrice, maxPrice, inStockOnly, bulkOnly,
    minWeight, maxWeight, pathname,
  ]);

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setFilterCategory('all');
    setFilterArea('');
    setSortBy('popular');
    setInStockOnly(false);
    setBulkOnly(false);
    setMinPrice(priceBounds.min);
    setMaxPrice(priceBounds.max);
    setMinWeight(weightBounds.min);
    setMaxWeight(weightBounds.max);
    setActiveCardIndex(1);
  }, [priceBounds.min, priceBounds.max, weightBounds.min, weightBounds.max]);
  const [detailHistory, setDetailHistory] = useState<GroupedProduct[]>([]);
  const detailProduct = detailHistory[detailHistory.length - 1] || null;
  const setDetailProduct = (p: GroupedProduct | null) => {
    if (p) setDetailHistory([p]);
    else setDetailHistory([]);
  };
  const [showEli5, setShowEli5] = useState(false);

  useEffect(() => {
    if (!detailProduct) {
      setShowEli5(false);
      return;
    }
    // Funnel step: a researcher opened a product detail view. Emitted from the
    // derived `detailProduct` so every path that opens the modal is covered.
    trackStorefrontEvent(agentSlug, 'product_view', {
      product_id: detailProduct.variants[0]?.product_id,
    });
  }, [detailProduct, agentSlug]);

  // Scroll to top when entering product detail view, back to previous position on close
  const scrollPosRef = useRef(0);
  useEffect(() => {
    if (detailProduct) {
      scrollPosRef.current = window.scrollY;
      window.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      if (scrollPosRef.current > 0) {
        window.scrollTo({ top: scrollPosRef.current, behavior: 'instant' });
        scrollPosRef.current = 0;
      }
    }
  }, [detailProduct]);

  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [cartItems, setCartItems] = useState<Record<string, number>>({});

  // Mirror of cartItems, read inside addToCart for the analytics decision only.
  // Using a ref keeps addToCart's useCallback identity stable (adding cartItems
  // to its deps would re-render the whole grid on every cart mutation), and the
  // authoritative stock cap still lives inside the setState updater below.
  const cartItemsRef = useRef<Record<string, number>>({});
  useEffect(() => { cartItemsRef.current = cartItems; }, [cartItems]);
  const [savedForLater, setSavedForLater] = useState<Record<string, number>>({});
  useEffect(() => {
    try {
      let base: Record<string, number> = {};
      const saved = localStorage.getItem(`cart_${agentSlug}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') base = { ...parsed };
      }
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

      const sfl = localStorage.getItem(`pnl_saved_${agentSlug}`);
      if (sfl) {
        const parsed = JSON.parse(sfl);
        if (parsed && typeof parsed === 'object') setSavedForLater(parsed);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentSlug]);
  const firstSavedSave = useRef(true);
  useEffect(() => {
    if (firstSavedSave.current) { firstSavedSave.current = false; return; }
    try { localStorage.setItem(`pnl_saved_${agentSlug}`, JSON.stringify(savedForLater)); } catch { /* ignore */ }
  }, [savedForLater, agentSlug]);
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
  const selfBuyStep = 1;
  const selfBuyMin  = minOrderQty ?? 1;
  const overallMin  = minOverallQty ?? 1;
  // Bac. water is sold only in 10-packs (increments of 10), storewide.
  const isBacWaterItem = (name: string | null | undefined, slug: string | null | undefined) => slug === 'bac-water' || /bac\.?\s*water/i.test(name || '');

  // Track the most recently viewed product for recommendations context
  const lastViewedProductId = useRef<string | null>(null);

  useEffect(() => {
    // When a product detail is open, seed from that product
    if (detailProduct) {
      const seedProductId = detailProduct.variants[0]?.product_id ?? null;
      if (seedProductId) lastViewedProductId.current = seedProductId;
    }
  }, [detailProduct]);

  useEffect(() => {
    // Seed recommendations from: (1) last viewed product, (2) first cart item, (3) nothing
    const seedFromCart = Object.keys(cartItems).find(vId => (cartItems[vId] ?? 0) > 0) ?? null;
    const cartSeedItem = seedFromCart ? products.find(p => p.id === seedFromCart) ?? null : null;
    const cartSeedProductId = cartSeedItem?.product_id ?? null;

    const seedProductId = lastViewedProductId.current ?? cartSeedProductId;
    if (!seedProductId) {
      setRecommendations([]);
      return;
    }
    let cancelled = false;
    setRecommendationsLoading(true);
    const url = `/api/storefront/recommendations?product_id=${encodeURIComponent(seedProductId)}&agent_slug=${encodeURIComponent(agentSlug)}&limit=8`;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailProduct, cartItems, agentSlug]);

  const [pendingQty, setPendingQty] = useState(selfBuyMin);

  const firstCartSave = useRef(true);
  const cartSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (firstCartSave.current) { firstCartSave.current = false; return; }
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

      Object.keys(localStorage)
        .filter(k => k.startsWith('pnl_storefront_cart_') && k !== `pnl_storefront_cart_${agentSlug}`)
        .forEach(k => localStorage.removeItem(k));
      localStorage.removeItem('pnl_storefront_cart');

      // CRO: mirror the grid cart to the signed-in researcher's server-side
      // cart_state so abandoned-cart recovery (cron) and cross-device restore
      // cover the primary storefront funnel. Previously only the CartContext
      // drawer synced, leaving grid-built carts invisible to recovery.
      // Guests receive a 401 which is silently ignored; localStorage remains
      // the local source of truth. Debounced so qty steppers do not spam the
      // endpoint.
      if (cartSyncTimer.current) clearTimeout(cartSyncTimer.current);
      // Agent self-restock carts are wholesale operations, not researcher
      // funnels - keep them out of abandoned-cart recovery.
      if (isStorefrontOwner) return;
      const syncPayload = (pnlCart as Array<Record<string, unknown>>).map(i => ({
        ...i,
        productId: (i as { id?: string }).id ?? null,
      }));
      cartSyncTimer.current = setTimeout(() => {
        fetch('/api/cart/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cart: syncPayload }),
        }).catch(() => { /* guest or offline - localStorage still holds the cart */ });
      }, 900);

    } catch { /* ignore */ }
  }, [cartItems, agentSlug, products, isStorefrontOwner]);

  // Clear any pending cart-sync debounce on unmount so the timer never fires
  // against an unmounted component or a stale storefront.
  useEffect(() => {
    return () => {
      if (cartSyncTimer.current) clearTimeout(cartSyncTimer.current);
    };
  }, []);

  // CRO: single shared handler for every Add-To-Cart control on the product
  // detail view (main CTA + sticky quick-add bar) so behavior stays identical.
  const addDetailProductToCart = () => {
    if (!detailProduct) return;
    const vId = selectedVariants[detailProduct.name] || detailProduct.defaultVariantId;
    const qty = Math.max(1, pendingQty);
    setCartItems(prevCart => ({
      ...prevCart,
      [vId]: (prevCart[vId] || 0) + qty,
    }));
    // Funnel step: highest-intent add-to-cart path (product detail view). The
    // grid-card addToCart emits its own event; without this the detail-view CTA
    // silently vanished from the funnel.
    const variant = detailProduct.variants.find(v => v.id === vId) ?? detailProduct.variants[0];
    if (variant?.product_id) {
      trackStorefrontEvent(agentSlug, 'add_to_cart', {
        product_id: variant.product_id,
        quantity: qty,
        amount_cents: Number.isFinite(Number(variant.retail_price)) ? Math.round(Number(variant.retail_price) * qty * 100) : undefined,
      });
    }
    setDetailProduct(null);
    setShowBulkPricing(false);
    setPendingQty(selfBuyMin);
    setShowCartFloat(true);
  };

  const grouped = useMemo(() => {
    const map = new Map<string, GroupedProduct>();
    (products ?? []).forEach(item => {
      let rawName = item.products?.name ?? 'Research Compound';
      // Strip out " Research Grade" suffix to normalize names and prevent duplicate groups
      rawName = rawName.replace(/\s*Research Grade$/i, '');
      // Normalize BPC-157 to match POPULAR_ORDER exactly if it happens to be hyphenated
      if (rawName.toUpperCase() === 'BPC-157') rawName = 'BPC 157';

      // Group by normalized name to ensure variants (like "Research Grade") merge perfectly
      const groupKey = rawName.toUpperCase();

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          name: rawName,
          category: item.products?.category || 'Other',
          desc: item.custom_description ?? item.products?.description ?? '',
          imageUrl: getProductImage(
            item.custom_image_url ?? item.products?.image_url ?? null,
            item.products?.category || 'Other',
            rawName,
          ),
          variants: [],
          lowestPrice: Infinity,
          popularity: POPULAR_ORDER.indexOf(rawName),
          defaultVariantId: '',
          compoundSlug: item.products?.compound_slug ?? null,
        });
      }
      const group = map.get(groupKey)!;
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

  const groupByProductId = useMemo(() => {
    const m = new Map<string, GroupedProduct>();
    for (const g of grouped) {
      for (const v of g.variants) {
        if (v.product_id) m.set(v.product_id, g);
      }
    }
    return m;
  }, [grouped]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const pid = urlParams.get('product');
    if (pid && grouped.length > 0) {
      const grp = grouped.find(g => g.variants.some(v => v.id === pid || v.product_id === pid));
      if (grp) {
        setDetailProduct(grp);
        const specificVariant = grp.variants.find(v => v.id === pid);
        if (specificVariant) {
          setSelectedVariants(prev => ({ ...prev, [grp.name]: specificVariant.id }));
        }
        // Clean up the URL so it doesn't reopen on refresh or after closing
        urlParams.delete('product');
        const qs = urlParams.toString();
        const newUrl = window.location.pathname + (qs ? `?${qs}` : '');
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [grouped]);

  const parsedSearchData = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return [];
    
    // ── Stop words ────────────────────────────────────────────────────────
    // These are filtered out BEFORE tokenization so they never get matched
    // against compound fields. Includes: articles, prepositions, common
    // auxiliary verbs, search-intent noise words, and generic action verbs
    // that add no signal (give, boost, help, increase, etc.).
    const STOP_WORDS = new Set([
      // Articles / prepositions / conjunctions
      'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'up', 'as', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
      'under', 'again', 'further', 'then', 'once', 'so', 'if', 'because',
      'while', 'although', 'since', 'until', 'unless', 'about', 'against',
      // Pronouns
      'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'it', 'its',
      'they', 'them', 'their', 'who', 'which', 'what', 'this', 'that', 'these',
      'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      // Common auxiliary / modal verbs
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'can', 'shall',
      // Generic search-intent verbs - no field match signal
      'want', 'need', 'looking', 'look', 'find', 'get', 'give', 'help', 'make',
      'use', 'using', 'used', 'try', 'trying', 'tried', 'know', 'show', 'work',
      'feel', 'feeling', 'like', 'take', 'taking', 'takes', 'increase',
      'increases', 'boost', 'boosts', 'boosting', 'improve', 'improves',
      'improving', 'support', 'supports', 'enhance', 'enhances', 'promote',
      'promotes', 'reduce', 'reduces', 'reducing', 'decrease', 'decreases',
      'increase', 'accelerate', 'optimize', 'maximise', 'maximize', 'target',
      'affects', 'affect', 'address', 'treat', 'treating', 'acts', 'act',
      'works', 'something', 'anything', 'everything', 'nothing', 'somewhere',
      // Adjectives / modifiers with no compound signal
      'best', 'good', 'great', 'top', 'well', 'really', 'very', 'more',
      'most', 'many', 'much', 'some', 'any', 'all', 'both', 'each', 'every',
      'other', 'same', 'only', 'also', 'just', 'even', 'still', 'yet',
      'already', 'always', 'often', 'usually', 'generally', 'mainly', 'mostly',
      'highly', 'extremely', 'really', 'quite', 'rather', 'fairly',
      // Quantifiers and degree words that add no compound signal
      'low', 'high', 'higher', 'lower', 'no', 'never', 'none', 'less', 'fewer', 'least',
      'fast', 'slow', 'quick', 'quickly', 'rapidly', 'slowly', 'better', 'worse',
      // Product-category noise (these are handled by concept groups, not raw tokens)
      'peptide', 'peptides', 'compound', 'compounds', 'supplement', 'supplements',
    ]);
    const CONCEPT_GROUPS: string[][] = [
      // Weight Loss / Fat
      ['fat', 'weightloss', 'weight', 'loss', 'lipolysis', 'obesity', 'adipose', 'slimming', 'lean', 'cut', 'cutting', 'slim', 'shed', 'trim', 'bodyfat', 'overweight', 'bmi', 'diet', 'calories', 'calorie', 'deficit', 'melt', 'burn', 'fat-loss', 'fatloss', 'visceral'],
      // Muscle / GH / Anabolic
      ['muscle', 'growthhormone', 'gh', 'hgh', 'hypertrophy', 'bodybuilding', 'mass', 'strength', 'growth', 'anabolic', 'gains', 'bulking', 'size', 'brawn', 'musclebuilding', 'musclegrowth', 'lean-muscle', 'leanmuscle', 'physique', 'pump', 'ripped', 'swole', 'protein', 'powerlifting', 'athletic', 'jacked', 'build', 'strong', 'stronger', 'power', 'lift', 'big', 'bigger'],
      // Sleep
      ['sleep', 'insomnia', 'circadian', 'rest', 'rem', 'tired', 'exhausted', 'yawn', 'sleepless', 'wakeup', 'waking', 'melatonin', 'napping', 'drowsy', 'fatigue', 'jet-lag', 'jetlag'],
      // Pain / Inflammation / Injury / Recovery
      ['pain', 'analgesic', 'inflammation', 'injury', 'healing', 'joint', 'tendon', 'nociception', 'soreness', 'headache', 'headaches', 'migraine', 'migraines', 'ache', 'sore', 'hurt', 'arthritis', 'back', 'knee', 'elbow', 'shoulder', 'torn', 'sprain', 'sprained', 'swelling', 'inflamed', 'anti-inflammatory', 'antiinflammatory', 'recover', 'recovery', 'repair', 'damage', 'neuropathy'],
      // Brain / Cognitive / Nootropic
      ['brain', 'cognitive', 'nootropic', 'memory', 'focus', 'neuro', 'alzheimers', 'dementia', 'learning', 'adhd', 'attention', 'clarity', 'smart', 'mental', 'mindsharpness', 'brain-fog', 'brainfog', 'concentration', 'neurodegeneration', 'neuroprotect', 'neuroplasticity', 'processing', 'recall', 'intelligence', 'cognition', 'stroke', 'tbi', 'concussion', 'productivity'],
      // Skin / Anti-Aging / Cosmetic
      ['skin', 'antiaging', 'collagen', 'wrinkle', 'elasticity', 'hair', 'nail', 'glow', 'complexion', 'youth', 'tanning', 'tan', 'melanin', 'sun', 'burn', 'brightening', 'dark-spots', 'spots', 'blemish', 'acne', 'pores', 'texture', 'dermis', 'anti-wrinkle', 'rejuvenate', 'rejuvenation', 'youthful', 'firming', 'hydration', 'hairloss', 'hair-loss', 'hairgrowth', 'balding', 'alopecia', 'scalp', 'pigment'],
      // Energy / Endurance / Performance
      // NOTE: 'cardio' deliberately excluded - it maps to Cardiovascular, not Energy.
      // fatigue/tired/exhausted/lethargic included: "I feel fatigued" is an energy
      // complaint, not always a sleep complaint. Both groups now share these terms
      // so searches like "chronic fatigue" surface both sleep AND energy compounds.
      ['energy', 'stamina', 'endurance', 'metabolism', 'mitochondrial', 'athletic',
       'performance', 'vitality', 'atp', 'cellular-energy', 'bioenergetics', 'nad',
       'nad+', 'ampk', 'exercise', 'exericse', 'sport', 'sports', 'workout', 'gym',
       'running', 'marathon', 'cycling', 'vo2', 'power-output', 'anaerobic', 'aerobic',
       // Energy-as-feeling synonyms (distinct from pure sleep context)
       'fatigue', 'tired', 'exhausted', 'lethargic', 'lethargy', 'energized',
       'energize', 'energise', 'low-energy', 'crash', 'burnout', 'sluggish',
       'dragging', 'wired', 'alertness', 'alert', 'energetic'],
      // Diabetes / Metabolic / Insulin
      ['sugar', 'diabetes', 'insulin', 'glucose', 'glycemic', 'metabolic', 'a1c', 'type2', 'prediabetes', 'blood-sugar', 'bloodsugar', 'pancreas', 'leptin', 'ghrelin', 'satiety', 'incretin', 'glp1'],
      // Heart / Cardiovascular
      ['heart', 'bloodpressure', 'cardiovascular', 'blood', 'vascular', 'angiogenesis', 'cardiac', 'pressure', 'cholesterol', 'artery', 'hypertension', 'atherosclerosis', 'coronary', 'circulation', 'flow', 'clot'],
      // Bone / Joint
      ['bone', 'osteoporosis', 'mineral', 'fracture', 'density', 'skeleton', 'ligament', 'cartilage', 'joint-health', 'jointhealth', 'connective-tissue', 'spine', 'hip', 'skeletal'],
      // Sexual Health / Libido
      ['sex', 'libido', 'erectile', 'aphrodisiac', 'testosterone', 'hormone', 'arousal', 'ed', 'dysfunction', 'intimacy', 'drive', 'desire', 'sexual', 'erection', 'orgasm', 'ejaculation', 'virility', 'fertility', 'reproductive'],
      // Gut / GI
      ['gut', 'digestion', 'ulcer', 'gastric', 'intestinal', 'microbiome', 'bowel', 'leaky', 'stomach', 'ibs', 'crohns', 'colitis', 'bloating', 'gi', 'gastrointestinal', 'leaky-gut', 'leakygut', 'gut-health', 'guthealth', 'digestion', 'digestive', 'diarrhea', 'constipation', 'mucosa', 'esophagus'],
      // Immune
      ['immune', 'immunesystem', 'immunity', 'infection', 'virus', 'bacteria', 'autoimmune', 'sick', 'illness', 'cold', 'flu', 'lymphocyte', 'tcell', 't-cell', 'cytokine', 'antibody', 'pathogen', 'antimicrobial', 'antiviral', 'antifungal', 'inflammation', 'innate', 'adaptive'],
      // Anxiety / Mood / Stress
      ['stress', 'anxiety', 'cortisol', 'calm', 'relax', 'mood', 'depression', 'panic', 'worry', 'nervous', 'gaba', 'serotonin', 'dopamine', 'neurotransmitter', 'ptsd', 'fear', 'phobia', 'ocd', 'wellbeing', 'mental-health', 'mentalhealth', 'anxious', 'depressed', 'low-mood'],
      // Aging / Longevity / Senescence
      ['aging', 'longevity', 'senescence', 'lifespan', 'youth', 'telomere', 'life', 'anti-age', 'antiage', 'healthspan', 'lifeextension', 'life-extension', 'immortality', 'senolytic', 'epigenetic', 'sirtuin', 'biohack', 'biohacking', 'age-reversal', 'reverseaging'],
      // Women's Health
      ['women', 'female', 'menopause', 'pcos', 'estrogen', 'progesterone', 'perimenopause', 'menstrual', 'hormones', 'ivf', 'fertility', 'ovulation'],
      // Men's Health / Hormonal
      ['men', 'male', 'trt', 'testosterone', 'prostate', 'hypogonadism', 'lowt', 'low-t', 'sperm', 'spermatogenesis', 'hcg', 'hmg', 'androgen'],
      // Eyes / Vision
      ['eyes', 'vision', 'sight', 'macular', 'retina', 'blindness', 'amd', 'optic', 'ocular'],
      // GLP-1 Specific
      ['glp1', 'glp-1', 'incretin', 'tirzepatide', 'semaglutide', 'retatrutide', 'ozempic', 'wegovy', 'mounjaro', 'appetite', 'craving', 'satiety', 'weightloss-drug', 'injection-diet', 'dual-agonist', 'triple-agonist'],
      // BPC-157 / Repair
      ['bpc157', 'bpc-157', 'wolverine', 'repair', 'gut', 'gastrointestinal'],
      // TB-500 / Healing
      ['tb500', 'tb-500', 'thymosin', 'thymosinbeta', 'actin'],
      // NAD+ / Cellular
      ['nad+', 'nad', 'nicotinamide', 'niacinamide', 'nac', 'nadh', 'nadplus', 'sirtuin', 'energy-boost', 'cellular-health'],
      // Detox / Liver
      ['detox', 'detoxification', 'liver', 'hepatic', 'fatty-liver', 'nafld', 'nash', 'lipid', 'glutathione', 'antioxidant'],
      // Peptide Stacks
      ['stack', 'combo', 'combination', 'protocol', 'cycle', 'regimen', 'bundle'],
      // Research / Lab
      ['research', 'study', 'lab', 'preclinical', 'clinical', 'trial', 'investigational', 'compound', 'molecule', 'drug'],
      // Wound Healing
      ['wound', 'scar', 'scarring', 'ulcer', 'lesion', 'abrasion', 'cut', 'laceration', 'wound-healing', 'woundhealing'],
      // Mitochondria
      ['mitochondria', 'mitochondrial', 'cristae', 'cardiolipin', 'atp', 'electron-transport', 'oxidative', 'ros', 'reactive-oxygen'],
      // Hair Specifically
      ['hair', 'hairloss', 'hair-loss', 'alopecia', 'balding', 'bald', 'thinning', 'hairgrowth', 'scalp', 'follicle', 'regrowth'],
      // Dosing / Frequency / Route
      ['daily', 'weekly', 'biweekly', 'twice-weekly', 'monthly', 'dose', 'dosing', 'frequency', 'protocol', 'schedule', 'timing', 'pulsed', 'pulsatile', 'subcutaneous', 'sc', 'im', 'intravenous', 'iv', 'intranasal', 'topical', 'injection', 'inject', 'syringe', 'reconstitute', 'reconstitution', 'lyophilized', 'freeze-dried', 'vial', 'powder', 'cycle', 'on-cycle', 'off-cycle', 'sublingual', 'oral', 'intramuscular', 'infusion', 'bolus', 'once-weekly', 'once-daily'],
      // Pharmacokinetics / Half-life
      ['halflife', 'half-life', 'pharmacokinetics', 'pk', 'absorption', 'bioavailability', 'clearance', 'plasma', 'serum', 'tissue', 'distribution', 'fast-acting', 'longacting', 'long-acting', 'shortacting', 'short-acting', 'immediate-release', 'sustained-release', 'prolonged', 'extended', 'peak', 'trough', 'steady-state', 'accumulation'],
      // Safety / Side Effects
      ['safe', 'safety', 'side-effect', 'sideeffect', 'adverse', 'risk', 'danger', 'reaction', 'tolerated', 'tolerance', 'wellbeing', 'benign', 'minimal-side-effects', 'no-side-effects', 'low-risk', 'nausea', 'headache', 'fatigue', 'irritation', 'allergy', 'contraindication', 'interaction'],
      // Discovery / Research Vintage
      ['novel', 'new', 'newest', 'cutting-edge', 'emerging', 'pioneering', 'recent', 'first-in-class', 'breakthrough', 'next-generation', 'nextgen', 'classic', 'established', 'decades', 'legacy', 'original'],
      // Mechanism of Action
      ['mechanism', 'moa', 'receptor', 'agonist', 'antagonist', 'inhibitor', 'activator', 'signaling', 'pathway', 'binding', 'target', 'kinase', 'enzyme', 'protein', 'peptide', 'amino-acid', 'chain', 'upstream', 'downstream', 'feedback', 'axis', 'cascade'],
      // Clinical Status
      ['fda-approved', 'fdaapproved', 'approved', 'phase3', 'phase-3', 'phase2', 'phase-2', 'clinical-trial', 'clinicaltrial', 'investigational', 'preclinical', 'compassionate', 'off-label', 'experimental', 'pipeline', 'registered', 'rx', 'prescription'],
      // Stacking / Synergy
      ['stack', 'combo', 'combination', 'stacks', 'synergy', 'synergistic', 'combined', 'pair', 'partner', 'protocol', 'bundle', 'regimen', 'alongside', 'together', 'dual', 'triple'],
    ];

    // Pre-process common multi-word concepts to keep them glued together
    let processedQ = q
      .replace(/weight\s+loss/g, 'weightloss')
      .replace(/anti[\s-]aging/g, 'antiaging')
      .replace(/growth\s+hormone/g, 'growthhormone')
      .replace(/blood\s+pressure/g, 'bloodpressure')
      .replace(/immune\s+system/g, 'immunesystem')
      .replace(/glp[\s-]1/g, 'glp1')
      .replace(/bpc[\s-]157/g, 'bpc157')
      .replace(/tb[\s-]500/g, 'tb500')
      .replace(/nad\+/g, 'nad+')
      .replace(/gut\s+health/g, 'guthealth')
      .replace(/brain\s+fog/g, 'brainfog')
      .replace(/fat\s+loss/g, 'fatloss')
      .replace(/hair\s+loss/g, 'hairloss')
      .replace(/lean\s+muscle/g, 'leanmuscle')
      .replace(/blood\s+sugar/g, 'bloodsugar')
      .replace(/type\s+2/g, 'type2')
      .replace(/low\s+t/g, 'lowt')
      .replace(/mental\s+health/g, 'mentalhealth')
      .replace(/life\s+extension/g, 'lifeextension')
      .replace(/anti[\s-]inflammatory/g, 'antiinflammatory')
      .replace(/anti[\s-]wrinkle/g, 'antiaging')
      .replace(/half[\s-]life/g, 'halflife')
      .replace(/long[\s-]acting/g, 'longacting')
      .replace(/short[\s-]acting/g, 'shortacting')
      .replace(/side[\s-]effect/g, 'sideeffect')
      .replace(/fast[\s-]acting/g, 'fast-acting')
      .replace(/clinical[\s-]trial/g, 'clinicaltrial')
      .replace(/fda[\s-]approved/g, 'fdaapproved')
      .replace(/anti[\s-]doping/g, 'antidoping')
      .replace(/weight\s+management/g, 'weightloss')
      .replace(/muscle\s+growth/g, 'musclegrowth')
      .replace(/muscle\s+building/g, 'musclebuilding')
      .replace(/zombie\s+cells/g, 'senolytic')
      .replace(/zombie\s+cell/g, 'senolytic')
      .replace(/master\s+antioxidant/g, 'glutathione')
      .replace(/love\s+hormone/g, 'oxytocin')
      .replace(/cardio\s+in\s+a\s+syringe/g, 'aicar')
      .replace(/bone\s+density/g, 'bone')
      .replace(/sexual\s+health/g, 'sexual')
      .replace(/gut\s+lining/g, 'leakygut')
      // ── Intent-phrase normalisers (#3 / #8) ──────────────────────────────
      // These collapse common natural-language goal phrases into the canonical
      // single token that the concept-group engine already understands.
      .replace(/chronic\s+fatigue/g, 'fatigue energy')
      .replace(/adrenal\s+fatigue/g, 'fatigue energy')
      .replace(/brain\s+energy/g, 'nad energy cognitive')
      .replace(/feel\s+more\s+energi[sz]ed?/g, 'energy')
      .replace(/more\s+energy/g, 'energy')
      .replace(/low\s+energy/g, 'energy')
      .replace(/no\s+energy/g, 'energy')
      .replace(/feel\s+energi[sz]ed?/g, 'energy')
      .replace(/tired\s+all\s+the\s+time/g, 'fatigue energy')
      .replace(/always\s+tired/g, 'fatigue energy')
      .replace(/run\s+out\s+of\s+energy/g, 'energy fatigue')
      .replace(/cellular\s+energy/g, 'cellular-energy nad atp')
      .replace(/mitochondrial\s+support/g, 'mitochondrial energy')
      .replace(/mental\s+energy/g, 'cognitive energy')
      .replace(/brain\s+fog/g, 'brainfog cognitive')
      .replace(/pre\s+workout/g, 'energy stamina workout')
      .replace(/post\s+workout/g, 'recovery stamina')
      .replace(/anti\s+aging/g, 'antiaging')
      .replace(/joint\s+pain/g, 'joint pain')
      .replace(/muscle\s+recovery/g, 'recovery muscle')
      .replace(/skin\s+health/g, 'skin antiaging collagen');

    // Dynamically build the set of specific compound names, slugs, and aliases to prevent broad synonym expansion
    const SPECIFIC_COMPOUNDS = new Set<string>();
    (products ?? []).forEach(p => {
      const name = p.products?.name?.toLowerCase().trim();
      if (name) {
        SPECIFIC_COMPOUNDS.add(name);
        SPECIFIC_COMPOUNDS.add(name.replace(/[\s-]+/g, ''));
        name.split(/[\s-]+/).forEach(part => {
          if (part && part.length > 2 && part !== 'water' && part !== 'stack' && part !== 'bundle') {
            SPECIFIC_COMPOUNDS.add(part);
          }
        });
      }
      const slug = p.products?.compound_slug?.toLowerCase().trim();
      if (slug) {
        SPECIFIC_COMPOUNDS.add(slug);
        SPECIFIC_COMPOUNDS.add(slug.replace(/[\s-]+/g, ''));
        slug.split(/[\s-]+/).forEach(part => {
          if (part && part.length > 2) SPECIFIC_COMPOUNDS.add(part);
        });
      }
    });

    // Add extra brand names / short forms / aliases manually to ensure coverage
    const brandNames = [
      'tirzepatide', 'semaglutide', 'retatrutide', 'ozempic', 'wegovy', 'mounjaro',
      'bpc157', 'bpc-157', 'tb500', 'tb-500', 'nad', 'nad+', 'epithalon', 'mots-c',
      'semax', 'selank', 'kpv', 'sermorelin', 'ipamorelin', 'cjc-1295', 'cjc1295',
      'aod9604', 'aod-9604', 'ghk-cu', 'ghk', 'dihexa', '5-amino-1mq', '5amino1mq',
      'cardarine', 'sr9009', 'ibutamoren', 'mk677', 'mk-677', 'wolverine',
      'sema', 'tirz', 'reta', 'bpc', 'tb', 'cjc', 'ipa'
    ];
    brandNames.forEach(name => {
      SPECIFIC_COMPOUNDS.add(name);
      SPECIFIC_COMPOUNDS.add(name.replace(/[\s-]+/g, ''));
    });

    // Make sure general/category terms are NEVER classified as specific compounds
    const GENERAL_TERMS = [
      'fat', 'weightloss', 'weight', 'loss', 'lipolysis', 'obesity', 'adipose', 'slimming',
      'lean', 'cut', 'cutting', 'slim', 'shed', 'trim', 'bodyfat', 'overweight', 'bmi', 'diet',
      'calories', 'calorie', 'deficit', 'melt', 'burn', 'fat-loss', 'fatloss', 'visceral',
      'muscle', 'growthhormone', 'gh', 'hgh', 'hypertrophy', 'bodybuilding', 'mass', 'strength',
      'growth', 'anabolic', 'gains', 'bulking', 'size', 'brawn', 'musclebuilding', 'musclegrowth',
      'lean-muscle', 'leanmuscle', 'physique', 'pump', 'ripped', 'swole', 'protein', 'powerlifting',
      'athletic', 'jacked', 'build', 'strong', 'stronger', 'power', 'lift', 'big', 'bigger',
      'sleep', 'insomnia', 'circadian', 'rest', 'rem', 'tired', 'exhausted', 'yawn', 'sleepless',
      'wakeup', 'waking', 'melatonin', 'napping', 'drowsy', 'fatigue', 'jet-lag', 'jetlag',
      'pain', 'analgesic', 'inflammation', 'injury', 'healing', 'joint', 'tendon', 'nociception',
      'soreness', 'headache', 'headaches', 'migraine', 'migraines', 'ache', 'sore', 'hurt',
      'arthritis', 'back', 'knee', 'elbow', 'shoulder', 'torn', 'sprain', 'sprained', 'swelling',
      'inflamed', 'anti-inflammatory', 'antiinflammatory', 'recover', 'recovery', 'repair',
      'damage', 'neuropathy', 'brain', 'cognitive', 'nootropic', 'memory', 'focus', 'neuro',
      'learning', 'attention', 'clarity', 'smart', 'mental', 'concentration', 'skin', 'antiaging',
      'collagen', 'wrinkle', 'elasticity', 'hair', 'nail', 'glow', 'complexion', 'youth', 'tanning',
      'tan', 'melanin', 'sun', 'burn', 'brightening', 'pores', 'texture', 'hairloss', 'hair-loss',
      'hairgrowth', 'balding', 'alopecia', 'scalp', 'energy', 'stamina', 'endurance', 'metabolism',
      'mitochondrial', 'cardio', 'vitality', 'atp', 'cellular-energy', 'sugar', 'diabetes', 'insulin',
      'glucose', 'glycemic', 'metabolic', 'bloodsugar', 'leptin', 'ghrelin', 'satiety', 'incretin',
      'glp1', 'glp-1', 'heart', 'bloodpressure', 'cardiovascular', 'blood', 'vascular', 'bone',
      'osteoporosis', 'skeleton', 'radius', 'ligament', 'cartilage', 'sex', 'libido', 'erectile', 'aphrodisiac',
      'testosterone', 'hormone', 'arousal', 'drive', 'desire', 'sexual', 'gut', 'digestion',
      'ulcer', 'gastric', 'intestinal', 'microbiome', 'bowel', 'leaky', 'stomach', 'ibs',
      'immune', 'immunity', 'infection', 'virus', 'bacteria', 'autoimmune', 'stress', 'anxiety',
      'cortisol', 'calm', 'relax', 'mood', 'depression', 'panic', 'worry', 'aging', 'longevity',
      'senescence', 'lifespan', 'telomere', 'mitochondria', 'mechanism', 'moa', 'receptor',
      'agonist', 'antagonist', 'inhibitor', 'activator', 'signaling', 'pathway', 'binding',
      'target', 'kinase', 'enzyme', 'protein', 'peptide', 'amino-acid', 'chain', 'stack',
      'combo', 'combination', 'protocol', 'cycle', 'regimen', 'bundle', 'synergy', 'synergistic'
    ];
    GENERAL_TERMS.forEach(term => {
      SPECIFIC_COMPOUNDS.delete(term);
    });

    // Filter out stop words and detect negative modifiers
    const qTokens = processedQ.split(/\s+/).filter(t => t);
    const rawTokens: { token: string, isNegative: boolean, variants: string[] }[] = [];
    let isNegContext = false;
    const NEG_MODIFIERS = new Set(['no', 'without', 'excluding', 'minus', 'non', 'zero', 'not', 'lack']);
    
    for (const t of qTokens) {
      if (NEG_MODIFIERS.has(t)) {
        isNegContext = true;
        continue;
      }
      if (!STOP_WORDS.has(t)) {
        // Generate singular/plural variants for basic stemming
        let variants = [t];
        if (t.endsWith('ies')) variants.push(t.slice(0, -3) + 'y');
        else if (t.endsWith('es')) variants.push(t.slice(0, -2));
        else if (t.endsWith('s')) variants.push(t.slice(0, -1));
        if (!t.endsWith('s')) variants.push(t + 's');
        
        // Add semantic synonyms to the variant list bidirectionally with typo tolerance
        const toAdd = new Set<string>();
        const isTokenSpecific = variants.some(v => SPECIFIC_COMPOUNDS.has(v) || SPECIFIC_COMPOUNDS.has(v.replace(/[\s-]+/g, '')));
        if (!isTokenSpecific) {
          for (const variant of variants) {
            for (const group of CONCEPT_GROUPS) {
              const matchesGroup = group.some(w => {
                 if (w === variant) return true;
                 // Allow 1 character typo for words longer than 4 characters
                 if (variant.length >= 4 && Math.abs(w.length - variant.length) <= 1) {
                    return getEditDistance(w, variant) <= 1;
                 }
                 return false;
              });
              if (matchesGroup) {
                group.forEach(w => toAdd.add(w));
              }
            }
          }
        }
        variants = Array.from(new Set([...variants, ...Array.from(toAdd)]));
        rawTokens.push({ token: t, isNegative: isNegContext, variants });
        
        // Reset negative context after attaching it to the immediate next token
        isNegContext = false;
      }
    }
    return rawTokens;
  }, [deferredSearch, products]);

  const matchesSearch = useCallback(
    (g: GroupedProduct) => {
      const q = deferredSearch.trim().toLowerCase();
      if (parsedSearchData.length === 0) return { matches: true, score: 0 };

      let totalScore = 0;
      let allTokensMatched = true;
      let primaryReason: string | undefined = undefined;

      for (const tokenData of parsedSearchData) {
        const rawToken = tokenData.token;
        const isNegative = tokenData.isNegative;
        const variants = tokenData.variants;

        let maxTokenScore = 0;
        let tokenReason: string | undefined = undefined;

        for (const token of variants) {
          let currentVariantScore = 0;
          let currentReason: string | undefined = undefined;

          const recordMatch = (score: number, reasonText: string) => {
            if (score > currentVariantScore) {
              currentVariantScore = score;
              currentReason = reasonText;
            }
          };

          const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const matchesRaw = (src: string | null | undefined) => {
            if (!src || !escapedToken) return false;
            try {
              const regex = new RegExp(`(?:^|\\s|\\b)${escapedToken}(?:$|\\s|\\b)`, 'i');
              return regex.test(src);
            } catch {
              return false;
            }
          };

          // Exact or strong matches
          if (g.name.toLowerCase() === token) recordMatch(500, `Matched Product Name`);
          else if (g.name.toLowerCase().includes(token)) recordMatch(100, `Matched in Product Name`);
          else if (matchesRaw(g.name)) recordMatch(50, `Matched in Product Name`);
          
          if (g.category.toLowerCase().includes(token)) recordMatch(50, `Category: ${g.category}`);
          if (g.desc.toLowerCase().includes(token)) recordMatch(10, `Found in Description`);
          else if (matchesRaw(g.desc)) recordMatch(5, `Found in Description`);

          if (compoundsBySlug && g.compoundSlug) {
            const c = compoundsBySlug[g.compoundSlug];
            if (c) {
              if (c.display_name.toLowerCase() === token) recordMatch(500, `Matched Compound Name`);
              else if (c.display_name.toLowerCase().includes(token)) recordMatch(100, `Matched Compound Name`);
              else if (matchesRaw(c.display_name)) recordMatch(50, `Matched Compound Name`);

              if (c.aliases?.some(a => a.toLowerCase() === token)) recordMatch(400, `Also Known As: ${c.aliases.find(a => a.toLowerCase() === token)}`);
              else if (c.aliases?.some(a => a.toLowerCase().includes(token))) recordMatch(80, `Matched Alias`);
              else if (c.aliases?.some(a => matchesRaw(a))) recordMatch(40, `Matched Alias`);

              if (c.studied_for?.some(s => s.toLowerCase().includes(token))) recordMatch(60, `Studied For: ${c.studied_for.find(s => s.toLowerCase().includes(token))}`);
              if (c.research_areas?.some(r => r.toLowerCase().includes(token))) recordMatch(55, `Research Area: ${c.research_areas.find(r => r.toLowerCase().includes(token))}`);
              if (c.benefits?.toLowerCase().includes(token)) recordMatch(50, `Associated Benefit`);
              
              if (c.compound_class?.toLowerCase().includes(token)) recordMatch(35, `Compound Class: ${c.compound_class}`);
              if (c.molecular_target?.toLowerCase().includes(token)) recordMatch(35, `Target: ${c.molecular_target}`);

              if (c.mechanism?.toLowerCase().includes(token)) recordMatch(20, `Matched Mechanism of Action`);
              if (c.plain_summary?.toLowerCase().includes(token)) recordMatch(20, `Matched Summary`);

              // ── Phase 2 fields ──────────────────────────────────────────
              // eli5_summary: rich plain-English description - great for phrase/concept searches
              if (c.eli5_summary?.toLowerCase().includes(token)) recordMatch(25, `Matched Description`);

              // best_stacked_with: helps discovery via "what stacks with X"
              if (c.best_stacked_with?.some(slug => slug.toLowerCase().includes(token))) {
                recordMatch(20, `Stacks Well With: ${c.best_stacked_with?.find(s => s.toLowerCase().includes(token))}`);
              }

              // side_effects + warnings: allow filtering by side effect terms
              if (c.side_effects?.toLowerCase().includes(token)) recordMatch(15, `Side Effect Profile Match`);
              if (c.warnings?.toLowerCase().includes(token)) recordMatch(10, `Warnings Matched`);

              // Half life search (e.g., "long acting", "short half life")
              if (c.half_life?.toLowerCase().includes(token)) recordMatch(12, `Half Life: ${c.half_life}`);

              // Typical frequency search (e.g., "daily", "weekly injection", "once weekly")
              if (c.typical_frequency?.toLowerCase().includes(token)) recordMatch(12, `Dosing: ${c.typical_frequency?.split(';')[0].trim()}`);

              // PK summary search (e.g., "albumin binding", "intranasal", "steady state", "bioavailability")
              if (c.pk_summary?.toLowerCase().includes(token)) recordMatch(10, `PK Profile Match`);

              // Year discovered search (e.g., "2022", "newest", "classic")
              if (c.year_discovered) {
                if (String(c.year_discovered).includes(token)) recordMatch(8, `Discovered: ${c.year_discovered}`);
              }


              // Efficacy scores: if searching for a goal keyword that matches a known efficacy key, boost ranking
              if (c.efficacy_scores) {
                const efficacyKeys = Object.keys(c.efficacy_scores);
                const matchedKey = efficacyKeys.find(k => k.toLowerCase().replace(/_/g, ' ').includes(token) || token.includes(k.toLowerCase().replace(/_/g, ' ')));
                if (matchedKey) {
                  const score = (c.efficacy_scores as Record<string, number>)[matchedKey];
                  if (score >= 80) recordMatch(score / 5, `High Efficacy For: ${matchedKey.replace(/_/g, ' ')}`);
                }
              }
            }
          }
          
          // Levenshtein Fallback for Typo Tolerance
          if (currentVariantScore === 0 && rawToken.length >= 4) {
            const checkLev = (str: string, scoreVal: number, reason: string) => {
               const words = str.toLowerCase().split(/\s+/);
               for (const w of words) {
                  if (Math.abs(w.length - rawToken.length) <= 2) {
                     if (getEditDistance(w, rawToken) <= 1) {
                        recordMatch(scoreVal, reason);
                     }
                  }
               }
            };
            checkLev(g.name, 40, `Did you mean ${g.name}?`);
            if (compoundsBySlug && g.compoundSlug) {
               const c = compoundsBySlug[g.compoundSlug];
               if (c) checkLev(c.display_name, 40, `Did you mean ${c.display_name}?`);
            }
          }

          if (currentVariantScore > maxTokenScore) {
            maxTokenScore = currentVariantScore;
            tokenReason = currentReason;
          }
        }

        if (maxTokenScore === 0 && !isNegative) {
          allTokensMatched = false;
          // ── #5 Did You Mean tracking ──────────────────────────────────
          // Even when the token didn't match, capture the Levenshtein reason
          // so we can display a "Did you mean X?" banner above the results.
        } else if (maxTokenScore > 0 && isNegative) {
          // Negative token matched -> heavily penalize or disqualify
          totalScore -= 2000;
          allTokensMatched = false;
        } else if (maxTokenScore > 0 && !isNegative) {
          totalScore += maxTokenScore;
          if (!primaryReason && tokenReason) {
            // ── #2 Smarter Matched label ───────────────────────────────────
            // Only surface a "Matched:" label when:
            //   a) the reason is a semantic/alias/typo match (not name/description)
            //   b) scored ≥40 (direct field hit, not expansion chain noise)
            //
            // Rewrite the reason text to show what the researcher TYPED, not
            // the raw DB field value. E.g. instead of:
            //   "Studied For: Mitochondrial Function And Energy Production"
            // show:
            //   "energy → Mitochondrial Function"
            const reasonStr = tokenReason as string;
            const isSemanticReason = (
              reasonStr.startsWith('Also Known As') ||
              reasonStr.startsWith('Studied For') ||
              reasonStr.startsWith('Research Area') ||
              reasonStr.startsWith('Compound Class') ||
              reasonStr.startsWith('Target:') ||
              reasonStr.startsWith('Did you mean')
            );
            if (isSemanticReason && maxTokenScore >= 40) {
              // Build a user-friendly label focusing on the extracted keyword
              if (reasonStr.startsWith('Did you mean')) {
                // Keep typo message as-is - it's already user-facing
                primaryReason = reasonStr;
              } else {
                // Instead of showing confusing DB field values like "Cardiovascular",
                // we explicitly show the user that our smart-search isolated their key intent.
                primaryReason = `Smart Match: "${rawToken}"`;
              }
            } else if (maxTokenScore >= 40) {
              primaryReason = tokenReason as string;
            }
          }
        }
      }

      // Add a bonus for exact full query match against name or alias
      if (g.name.toLowerCase() === q) { totalScore += 2000; primaryReason = undefined; }
      if (compoundsBySlug && g.compoundSlug) {
        const c = compoundsBySlug[g.compoundSlug];
        if (c?.display_name.toLowerCase() === q) { totalScore += 2000; primaryReason = undefined; }
        if (c?.aliases?.some(a => a.toLowerCase() === q)) {
           totalScore += 2000; 
           const matchAlias = c.aliases.find(a => a.toLowerCase() === q);
           if (matchAlias) primaryReason = `Also Known As: ${matchAlias}`;
        }
      }

      // Evidence-Weighted Sorting Tie-Breaker
      let isMatch = allTokensMatched || totalScore >= 400;
      
      // Override with Semantic AI Match if JS filtering missed it
      const matchingVariant = g.variants.find(v => semanticMatches[v.product_id]);
      if (matchingVariant) {
        isMatch = true;
        totalScore += 2000;
        primaryReason = semanticMatches[matchingVariant.product_id].reason;
      }

      if (isMatch && compoundsBySlug && g.compoundSlug) {
        const c = compoundsBySlug[g.compoundSlug];
        if (c) {
          // Evidence tier boost
          if (c.evidence_tier === 'approved_drug') totalScore += 100;
          else if (c.evidence_tier === 'investigational') totalScore += 50;
          else if (c.evidence_tier === 'preclinical') totalScore += 20;

          // Efficacy score boost: reward compounds that have high efficacy
          // for any goal matching the current search query
          const qLower = deferredSearch.trim().toLowerCase();
          if (c.efficacy_scores) {
            const efficacyMap = c.efficacy_scores as Record<string, number>;
            for (const [key, val] of Object.entries(efficacyMap)) {
              const keyReadable = key.replace(/_/g, ' ');
              if (qLower.includes(keyReadable) || keyReadable.includes(qLower.split(' ')[0])) {
                totalScore += Math.round(val * 0.5); // max +49.5 for a perfect 99-score compound
              }
            }
          }

          // Citation count as popularity / trust signal (if available)
          if (c.pubmed_citation_count && c.pubmed_citation_count > 0) {
            totalScore += Math.min(30, Math.log10(c.pubmed_citation_count + 1) * 10);
          }
        }
      }

      // ── #6 Confidence tier ─────────────────────────────────────────────
      // Attach a confidence level to each matched card based on score.
      // High ≥ 200, Medium ≥ 60, Low = anything above 0 that still matched.
      let confidenceTier: 'high' | 'medium' | 'low' | undefined;
      if (isMatch && deferredSearch.trim()) {
        if (totalScore >= 200) confidenceTier = 'high';
        else if (totalScore >= 60) confidenceTier = 'medium';
        else confidenceTier = 'low';
      }

      return { matches: isMatch, score: totalScore, reason: primaryReason, confidence: confidenceTier };
    },
    [deferredSearch, compoundsBySlug, semanticMatches]
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
    (g: GroupedProduct) => {
      if (minWeight === weightBounds.min && maxWeight === weightBounds.max) return true;
      return g.variants.some(v => {
        const w = Number(v.products?.weight_oz);
        if (!Number.isFinite(w) || w <= 0) return false;
        return w >= minWeight && w <= maxWeight;
      });
    },
    [minWeight, maxWeight, weightBounds.min, weightBounds.max]
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

  // R35: research-area filter using compoundsBySlug lookup.
  const matchesArea = useCallback(
    (g: GroupedProduct) => {
      if (!filterArea) return true;
      const slug = g.compoundSlug;
      if (!slug) return false;
      const c = compoundsBySlug?.[slug];
      if (!c) return false;
      return (c.research_areas || []).includes(filterArea);
    },
    [filterArea, compoundsBySlug]
  );

  const filteredProducts = useMemo(() => {
    const getProductRankScore = (g: GroupedProduct, searchScore: number) => {
      let score = 0;

      // 1. Stock Status (likelihood to sell): +50000 bonus if in stock
      const inStock = g.variants.some(v => {
        const agentCount = Math.max(0, Number(inventoryMap[v.product_id] ?? 0));
        const masterCount = Math.max(0, Number(v.products?.inventory_count ?? 0));
        return agentCount > 0 || masterCount > 0;
      });
      if (inStock) score += 50000;

      // 2. Core Relevance to the Category (1st priority inside results/category browsing)
      const compound = g.compoundSlug && compoundsBySlug ? compoundsBySlug[g.compoundSlug] : null;
      if (compound) {
        if (activeCardIndex !== null) {
          const card = CARD_MAPPINGS.find(m => m.index === activeCardIndex);
          if (card) {
            const scores = (compound.efficacy_scores as Record<string, number>) || {};
            if (activeCardIndex === 2) { // Weight Loss
              score += (scores.weight_loss || 0) * 100;
              score += (scores.metabolism || 0) * 100;
            } else if (activeCardIndex === 3) { // Muscle Growth
              score += (scores.muscle_growth || 0) * 100;
              score += (scores.athletic_performance || 0) * 100;
            } else if (activeCardIndex === 4) { // Immunity
              score += (scores.immunity || 0) * 100;
              score += (scores.wellbeing || 0) * 100;
            } else if (activeCardIndex === 5) { // Anti-Aging
              score += (scores.anti_aging || 0) * 100;
              score += (scores.longevity || 0) * 100;
            } else if (activeCardIndex === 6) { // Healing
              score += (scores.healing || 0) * 100;
              score += (scores.recovery || 0) * 100;
            } else if (activeCardIndex === 7) { // Sexual Health
              score += (scores.sexual_health || 0) * 100;
            } else if (activeCardIndex === 8) { // Skin & Hair
              score += (scores.skin_health || 0) * 100;
              score += (scores.hair_health || 0) * 100;
            }
          }
        }
      }

      // 3. Custom Stack Premium Bonus (stacks are premium and highly relevant)
      const isStack = g.category === 'Peptide Stacks' || 
                      g.name.toLowerCase().includes('stack') || 
                      g.name.toLowerCase().includes('bundle') ||
                      g.name.toLowerCase().includes('klow');
      if (isStack) score += 20000;

      // 4. Search relevance score (if query exists)
      if (searchScore > 0) {
        score += searchScore * 50;
      }

      // 5. Popularity ranking (2nd priority)
      score += (1000 - g.popularity);

      // 6. Likelihood to Sell to the Researcher:
      if (compound) {
        if (compound.evidence_tier === 'approved_drug') score += 2000;
        else if (compound.evidence_tier === 'investigational') score += 1000;
        else if (compound.evidence_tier === 'preclinical') score += 200;
        
        if (compound.pubmed_citation_count) {
          score += Math.min(500, Math.log10(compound.pubmed_citation_count + 1) * 100);
        }
      }

      return score;
    };

    const withScores = grouped.map(g => ({ g, search: matchesSearch(g) }));

    let result = withScores.filter(({ g, search }) =>
      matchesCategory(g) &&
      matchesArea(g) &&
      search.matches &&
      matchesPrice(g) &&
      matchesWeight(g) &&
      matchesInStock(g) &&
      matchesBulk(g)
    );

    // Apply activeCardIndex filters
    if (activeCardIndex === 1 && !deferredSearch.trim()) {
      result.sort((a, b) => getProductRankScore(b.g, b.search.score) - getProductRankScore(a.g, a.search.score));
      // Deduplicate by base name (strip trailing parenthetical) so the same peptide/stack
      // can't appear twice just because it has variants sold as separate named products
      // e.g. "The Wolverine Stack (BPC 10mg + TB 10mg)" and "The Wolverine Stack (BPC 5mg + TB 5mg)"
      const seenBaseNames = new Map<string, typeof result[0]>();
      for (const item of result) {
        const baseName = item.g.name.replace(/\s*\(.*\)\s*$/, '').trim().toUpperCase();
        if (!seenBaseNames.has(baseName)) {
          seenBaseNames.set(baseName, item);
        }
      }
      result = Array.from(seenBaseNames.values()).slice(0, 10);
    } else if (activeCardIndex !== null && activeCardIndex > 1 && !deferredSearch.trim()) {
      const activeCard = CARD_MAPPINGS.find(m => m.index === activeCardIndex);
      if (activeCard) {
        result = result.filter(({ g }) => g.category === activeCard.label);
      }
    }

    const q = deferredSearch.trim();

    if (q && sortBy === 'popular') {
      result.sort((a, b) => {
        return getProductRankScore(b.g, b.search.score) - getProductRankScore(a.g, a.search.score);
      });
    } else {
      switch (sortBy) {
        case 'popular': result.sort((a, b) => getProductRankScore(b.g, b.search.score) - getProductRankScore(a.g, a.search.score)); break;
        case 'name_asc': result.sort((a, b) => a.g.name.localeCompare(b.g.name)); break;
        case 'name_desc': result.sort((a, b) => b.g.name.localeCompare(a.g.name)); break;
        case 'price_low': result.sort((a, b) => a.g.lowestPrice - b.g.lowestPrice); break;
        case 'price_high': result.sort((a, b) => b.g.lowestPrice - a.g.lowestPrice); break;
        case 'newest': result.sort((a, b) => getProductRankScore(b.g, b.search.score) - getProductRankScore(a.g, a.search.score)); break;
      }
    }
    return result.map(r => ({ ...r.g, _search: r.search }));
  }, [grouped, matchesCategory, matchesArea, matchesSearch, matchesPrice, matchesWeight, matchesInStock, matchesBulk, sortBy, deferredSearch, activeCardIndex, inventoryMap, compoundsBySlug]);

  // Missed-search logging, deduped per query per mount so a zero-result query
  // does not re-post on every keystroke extension while still at zero results.
  const sentMissedSearchesRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const q = deferredSearch.trim().toLowerCase();
    if (filteredProducts.length === 0 && q.length > 2 && !sentMissedSearchesRef.current.has(q)) {
      sentMissedSearchesRef.current.add(q);
      fetch('/api/analytics/missed-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: deferredSearch.trim() })
      }).catch(() => {});
    }
  }, [filteredProducts.length, deferredSearch]);


  const categoryCounts = useMemo<Record<string, number>>(() => {
    const base = grouped.filter(g =>
      matchesSearch(g).matches &&
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

  const featuredGroups = useMemo(() => {
    if (!featuredProductIds || featuredProductIds.length === 0) return [];
    return grouped.filter(g => g.variants.some(v => featuredProductIds.includes(v.product_id)));
  }, [grouped, featuredProductIds]);

  const showFeatured = featuredGroups.length > 0 && !searchQuery && filterCategory === 'all' && !filterArea;
  const hasActiveFilters =
    !!deferredSearch.trim() ||
    filterCategory !== 'all' ||
    !!filterArea ||
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
    // Use the per-agent inventoryMap (not global inventory_count) for the cap.
    // inventory_count is the China-origin master stock; agents hold their own
    // local stock independently via agent_inventory. The inventoryMap RPC provides
    // the correct agent-specific figure.
    const agentStock = item.product_id ? (inventoryMap[item.product_id] ?? null) : null;
    const globalStock = item.products?.inventory_count ?? null;
    // Cap must mirror how the order route actually fulfills: it draws the agent's
    // local stock first, then dropships the remainder from China (global), which is
    // treated as effectively unlimited. So the only real hard limit is when China
    // stock is exhausted -- then the agent's local stock is the ceiling.
    //   - global unknown (null) or positive -> dropship available -> no cap.
    //   - global == 0 -> no China stock -> cap at the agent's local stock (0 => OOS).
    // Previously this capped at agentStock whenever it was set, so an item an agent
    // had sold down to 0 locally showed "In Stock" yet could not be added to cart.
    const maxQty = (globalStock === null || globalStock > 0)
      ? Infinity
      : (agentStock !== null ? agentStock : 0);

    // Analytics decision uses the ref (updaters run during render, so a flag set
    // inside the updater would not be readable here). The cap below remains the
    // single source of truth for whether the item is actually added.
    const wasCapped = maxQty !== Infinity && (cartItemsRef.current[variantId] || 0) >= maxQty;

    setCartItems(prev => {
      const currentQty = prev[variantId] || 0;
      if (maxQty !== Infinity && currentQty >= maxQty) {
        toast.error(`Maximum Available Stock (${maxQty}) Reached.`);
        return prev;
      }
      return { ...prev, [variantId]: currentQty + 1 };
    });

    // Funnel step: the add_to_cart event the agent analytics view counts. Before
    // this, `add_to_cart_30d` was permanently 0 because nothing ever emitted it.
    if (!wasCapped) {
      trackStorefrontEvent(agentSlug, 'add_to_cart', {
        product_id: item.product_id,
        quantity: 1,
        amount_cents: Number.isFinite(Number(item.retail_price)) ? Math.round(Number(item.retail_price) * 100) : undefined,
      });
    }
  }, [products, inventoryMap, agentSlug]);

  const totalCartItems = Object.values(cartItems).reduce((sum, qty) => sum + qty, 0);
  const totalSavedItems = Object.values(savedForLater).reduce((sum, qty) => sum + Number(qty || 0), 0);

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

  // Add a product to the cart by display name. Used by the Research Profile
  // diluent CTA to add Bacteriostatic Water without threading cart props through
  // deeply-nested children. Inert when no matching product is on this storefront.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ name?: string; handled?: boolean }>).detail;
      const name = detail?.name;
      if (!name) return;
      if (detail) detail.handled = true;
      const matches = products.filter(
        (p) => (p.products?.name || '').toLowerCase() === name.toLowerCase()
      );
      if (matches.length === 0) {
        toast.error(`${name} Is Not Available On This Storefront.`);
        return;
      }
      const pick =
        matches
          .slice()
          .sort(
            (a, b) =>
              parseFloat(a.products?.unit_size || '0') - parseFloat(b.products?.unit_size || '0')
          )[0] || matches[0];
      const addQty = isBacWaterItem(pick.products?.name, pick.products?.compound_slug) ? 10 : 1;
      setCartItems((prev) => ({ ...prev, [pick.id]: (prev[pick.id] || 0) + addQty }));
      setShowCartFloat(true);
      toast.success(`${pick.products?.name || name} Added To Cart.`);
    };
    window.addEventListener('pnl:add-to-cart-by-name', handler as EventListener);
    return () => window.removeEventListener('pnl:add-to-cart-by-name', handler as EventListener);
  }, [products]);

  if (!products || products.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>
        <p style={{ color: 'var(--grey-400)', marginBottom: 'var(--space-6)', fontSize: '1.1rem' }}>
          Research Compounds Are Coming Soon. Create An Account To Be Notified.
        </p>
        {/* CRO: the copy promised notification but offered no action. */}
        <a
          href={`/signup?redirect=${encodeURIComponent(`/${agentSlug}`)}`}
          className="btn btn-primary"
          style={{ minWidth: 220, display: 'inline-flex', justifyContent: 'center' }}
        >
          Create A Free Account
        </a>
      </div>
    );
  }

  const renderProductCard = (group: GroupedProduct) => {
          const selectedVariantId = selectedVariants[group.name] || group.defaultVariantId;
          const activeVariant = group.variants.find(v => v.id === selectedVariantId) || group.variants[0];

          const stockAgentCount = Math.max(0, Number(inventoryMap[activeVariant.product_id] ?? 0));
          const stockMasterInventory = Math.max(0, Number(activeVariant.products?.inventory_count ?? 0));
          const stockThreshold = Math.max(0, Number(activeVariant.products?.low_stock_threshold ?? 5));
          const stockBackorder = Math.max(0, Number(activeVariant.products?.backorder_days ?? 0));
          const stockState = computeStockState(stockAgentCount, stockMasterInventory, stockThreshold, stockBackorder);

          return (
            <motion.div
              key={group.name} className="sf-product-card-nickel hover-lift stagger-fade-in" variants={itemVariants}
              style={{
                cursor: 'pointer'
              }}
              onMouseEnter={() => {
                // Prefetch recommendations for this product on hover so data
                // is already cached by the time the user clicks to open the detail.
                const seedId = activeVariant.product_id;
                if (seedId) {
                  // Prefetch via standard fetch so it triggers the Service Worker cache
                  fetch(
                    `/api/storefront/recommendations?product_id=${encodeURIComponent(seedId)}&agent_slug=${encodeURIComponent(agentSlug)}&limit=8`
                  ).catch(() => {});
                }
              }}
              onClick={() => {
                setDetailProduct(group);
                logRecentlyViewed(activeVariant.product_id);
                const defaultVId = group.defaultVariantId || group.variants[0]?.id;
                const existingQty = defaultVId ? cartItems[defaultVId] : undefined;
                const bw = isBacWaterItem(group.name, group.compoundSlug);
                setPendingQty(existingQty ?? (bw ? 10 : (selfBuyMin)));
              }}
              role="button"
              tabIndex={0}
              aria-label={`View Details For ${group.name}`}
              onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  if (e.key === ' ') e.preventDefault();
                  e.currentTarget.click();
                }
              }}
            >
              <div className="" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: 0, position: 'relative' }}>

              <div style={{
                height: 220,
                background: `radial-gradient(circle at 50% 50%, ${primaryColor}20 0%, var(--black) 100%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                borderBottom: '1px solid rgba(255,255,255,0.02)', position: 'relative'
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${primaryColor}50, transparent)` }} />
                {group._search?.reason && (
                  <div style={{
                    position: 'absolute',
                    top: 52,
                    left: 10,
                    right: 10,
                    zIndex: 10,
                    display: 'flex',
                    justifyContent: 'center',
                    pointerEvents: 'none'
                  }}>
                    <div style={{
                      background: 'rgba(20, 25, 30, 0.75)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      padding: '4px 10px',
                      borderRadius: 20,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--white)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    }}>
                      <Sparkles size={11} style={{ marginRight: 4 }} /> Matched: {toTitleCase(group._search.reason)}
                    </div>
                  </div>
                )}

                {/* Compare Checkbox opposite of the heart (which is on top-right, so this is on top-left) */}
                <label
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: 12,
                    left: 12,
                    zIndex: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                    transition: 'transform 0.15s ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.10)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <input
                    type="checkbox"
                    checked={pinnedNames.has(group.name)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        if (pinnedNames.size >= 4) {
                          toast.error('You can compare up to 4 compounds at a time.');
                          return;
                        }
                        try {
                          const raw = window.localStorage.getItem('pnl:compare') || '[]';
                          const list = JSON.parse(raw);
                          if (Array.isArray(list) && list.length > 0) {
                            const firstItem = list[0];
                            const firstCategory = firstItem.category;
                            if (firstCategory && firstCategory !== group.category) {
                              toast.error(`You can only compare peptides within the same category ("${firstCategory}").`);
                              return;
                            }
                          }
                        } catch {}
                        pin(group, activeVariant);
                      } else {
                        unpin(group);
                      }
                    }}
                    disabled={!pinnedNames.has(group.name) && pinnedNames.size >= 4}
                    style={{
                      width: 17,
                      height: 17,
                      accentColor: primaryColor,
                      cursor: 'pointer',
                      margin: 0,
                    }}
                    title="Compare this peptide"
                    aria-label={`Compare ${group.name}`}
                  />
                  <span
                    style={{
                      fontSize: '0.55rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: pinnedNames.has(group.name) ? primaryColor : 'rgba(255,255,255,0.85)',
                      textShadow: '0 1px 3px rgba(0, 0, 0, 0.9), 0 0 1px rgba(0, 0, 0, 0.9)',
                      transition: 'color 0.15s',
                      pointerEvents: 'none',
                      marginTop: 4
                    }}
                  >
                    Compare
                  </span>
                </label>

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

                {/* eslint-disable-next-line @next/next/no-img-element */}
                <Image
                  src={group.imageUrl || '/images/peptide_clear.png'}
                  alt={group.name}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  style={{ objectFit: 'contain', objectPosition: 'center', padding: '8px', transition: 'transform 0.4s ease' }}
                  className="store-image-hover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    const fallback = getProductImage(null, group.category || 'Other', group.name);
                    if (target.src !== fallback && !target.src.includes(fallback)) {
                      target.srcset = '';
                      target.src = fallback;
                    } else {
                      target.srcset = '';
                      target.src = '/images/peptide_clear.png';
                      target.style.opacity = '0.9';
                    }
                  }}
                />

                {stockState.kind !== 'in_stock' && (
                  <div style={{ position: 'absolute', bottom: 12, left: 12 }}>
                    <StockBadge state={stockState} />
                  </div>
                )}
              </div>

              <div style={{ padding: 'var(--space-5)', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                {(() => {
                  const { main, subtitle } = splitProductName(toTitleCase(group.name));
                  const searchReason = (group as any)._search?.reason;
                  const confidence = (group as any)._search?.confidence as 'high' | 'medium' | 'low' | undefined;
                  // ── #6 Confidence tier colour map ─────────────────────────
                  const confidenceStyle: Record<'high' | 'medium' | 'low', { bg: string; border: string; color: string; label: string }> = {
                    high:   { bg: 'rgba(79,209,197,0.12)',  border: 'rgba(79,209,197,0.35)',  color: '#4FD1C5', label: 'Strong Match' },
                    medium: { bg: 'rgba(235,178,54,0.10)',  border: 'rgba(235,178,54,0.30)',  color: '#EBB236', label: 'Good Match'   },
                    low:    { bg: 'rgba(160,174,192,0.08)', border: 'rgba(160,174,192,0.22)', color: '#A0AEC0', label: 'Partial Match' },
                  };
                  const cs = confidence ? confidenceStyle[confidence] : null;
                  return (
                    <div style={{ textAlign: 'center', marginBottom: 'var(--space-2)' }}>
                      {searchReason && cs && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          background: cs.bg, border: `1px solid ${cs.border}`,
                          color: cs.color, fontSize: '0.63rem', fontWeight: 700,
                          padding: '3px 8px', borderRadius: 'var(--radius-full)',
                          textTransform: 'uppercase', marginBottom: 'var(--space-2)',
                          letterSpacing: '0.04em', maxWidth: '100%',
                        }}>
                          <Sparkles size={9} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                            {cs.label}: {searchReason}
                          </span>
                        </div>
                      )}
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
                      {(() => {
                        const _canonicalName = group.variants[0]?.products?.name || group.name;
                        const _nick = getPopularName(_canonicalName);
                        if (!_nick) return null;
                        return (
                          <span style={{ fontSize: '0.72rem', color: 'var(--teal)', fontStyle: 'italic', fontWeight: 500, display: 'block', marginTop: 2 }}>
                            {_nick}
                          </span>
                        );
                      })()}
                      {(() => {
  const _c = group.compoundSlug ? compoundsBySlug?.[group.compoundSlug] : undefined;
  const _nasal = intranasalDisplay(_c);
  if (!_nasal.nasal) return null;
  return (
    <span title={_nasal.caveat ?? undefined} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6,
      padding: '3px 9px', borderRadius: 'var(--radius-full)',
      background: _nasal.bg, border: `1px solid ${_nasal.border}`,
      color: _nasal.color, fontSize: '0.62rem', fontWeight: 800,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      <Wind size={9} aria-hidden="true" />{_nasal.badgeLabel}
    </span>
  );
})()}
                      {(() => {
                        // CRO: purity and third-party COAs are the strongest
                        // objection-handlers for research buyers, but they only
                        // appeared deep inside the detail modal. Surface a
                        // display-only trust chip at the browse stage using the
                        // same catalog data (click still opens the modal).
                        const _c2 = group.compoundSlug ? compoundsBySlug?.[group.compoundSlug] : undefined;
                        const _purity = Number((_c2 as any)?.purity_percentage) || 0;
                        const _hasCoa = group.variants.some(v => v.product_id && coaByProductId?.[v.product_id]);
                        if (!_hasCoa && _purity <= 0) return null;
                        return (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, marginLeft: 4,
                            padding: '3px 9px', borderRadius: 'var(--radius-full)',
                            background: 'rgba(0, 196, 188, 0.08)', border: '1px solid rgba(0, 196, 188, 0.30)',
                            color: 'var(--teal)', fontSize: '0.62rem', fontWeight: 800,
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                          }}>
                            <Shield size={9} aria-hidden="true" />
                            {_purity > 0 ? `${_purity}%+ Tested` : 'COA Available'}
                          </span>
                        );
                      })()}

                    </div>
                  );
                })()}

              <div style={{
                  marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 'var(--space-4)',
                  textAlign: 'center'
                }}>
                  {(() => {
                    const defaultV = group.variants.find(v => v.id === group.defaultVariantId) || group.variants[0];
                    const size = defaultV.products?.unit_size || '10';
                    const measure = defaultV.products?.unit_measure || 'mg';
                    const perVialBase = defaultV.retail_price / 10;
                    const isOnSale = (defaultV as any).is_on_sale && (defaultV as any).sale_price;
                    const perVialDisplay = isOnSale ? (defaultV as any).sale_price / 10 : perVialBase;
                    const perVialOriginal = perVialBase;
                    
                    const isBW = isBacWaterItem(group.name, defaultV.products?.compound_slug);
                    const displayPrice = isBW ? perVialDisplay * 10 : perVialDisplay;
                      const _marketAvgVial = Number((defaultV as any).products?.market_avg_price) || 0;
                      const _marketAvgDisplay = isBW ? _marketAvgVial * 10 : _marketAvgVial;
                      const _showMarketAvg = agentSlug === 'researchstore' && _marketAvgDisplay > displayPrice;
                    const displayOriginalPrice = isBW ? perVialOriginal * 10 : perVialOriginal;
                    const displaySizeText = isBW ? `10x ${size}${measure} Vials` : `${size}${measure} Vials`;

                    return (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                          {isOnSale && (
                            <span style={{ fontSize: '0.95rem', color: 'var(--grey-500)', textDecoration: 'line-through', fontWeight: 600 }}>
                              ${displayOriginalPrice.toFixed(2)}
                            </span>
                          )}
                          {_showMarketAvg && (
                            <span style={{ fontSize: '0.95rem', color: 'var(--grey-500)', textDecoration: 'line-through', fontWeight: 600 }}>
                              ${_marketAvgDisplay.toFixed(2)}
                            </span>
                          )}
                          <span className="sf-product-price-nickel" style={{
                            fontSize: '1.2rem', fontWeight: 800,
                            fontFamily: 'var(--font-brand)',
                          }}>
                            {displaySizeText} &nbsp;${displayPrice.toFixed(2)}
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

  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <style dangerouslySetInnerHTML={{__html: `
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
        /* ── Product detail: inline full-page view (no overlay) ── */
        .sf-modal-overlay {
          /* Not an overlay - just a wrapper so CSS class names are preserved */
          display: block;
          width: 100%;
          min-height: 100vh;
          background: linear-gradient(180deg, #131b24 0%, #0a0f14 100%);
        }
        .sf-modal-sheet {
          width: 100%; max-width: 860px; margin: 0 auto;
          display: flex; flex-direction: column;
          padding-bottom: calc(32px + env(safe-area-inset-bottom, 0px));
        }
        .sf-modal-drag-bar { display: none; }
        .sf-modal-img {
          height: 300px; flex-shrink: 0; position: relative; overflow: hidden;
          border-radius: 0;
          margin: 0;
        }
        .sf-modal-body { padding: 24px 22px 8px; }
        .sf-modal-h2 { font-size: 1.4rem !important; }
        /* Actions: normal in-flow block at bottom of content */
        .sf-modal-actions {
          display: flex; justify-content: center; gap: 16px;
          padding: 24px 20px 12px;
        }
        .sf-modal-actions .sf-close-btn {
          padding: 12px 20px;
          background: linear-gradient(180deg, #2b3744 0%, #1b242e 100%);
          border: 1px solid rgba(190,200,210,0.25);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.14), 0 3px 10px rgba(0,0,0,0.5);
          border-radius: var(--radius-md);
          color: var(--white); cursor: pointer; font-weight: 700; font-size: 0.85rem;
          white-space: nowrap;
          display: inline-flex; align-items: center; justify-content: center; text-align: center;
        }
        .sf-modal-actions .sf-add-btn {
          flex: 1; padding: 12px 20px; border-radius: var(--radius-md);
          font-weight: 800; font-size: 0.9rem; border: 1px solid var(--teal); cursor: pointer;
          color: #04221F; white-space: nowrap;
          display: inline-flex; align-items: center; justify-content: center; text-align: center;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 16px rgba(192,197,206,0.40);
        }
        @media (min-width: 600px) {
          .sf-modal-overlay { padding: 20px 0; }
          .sf-modal-sheet { border-radius: 20px; border: 5px solid transparent;
            background: linear-gradient(180deg, #131b24 0%, #0a0f14 100%) padding-box,
                        linear-gradient(135deg, #b0b5bc 0%, #5c626b 20%, #e2e6eb 50%, #5c626b 80%, #b0b5bc 100%) border-box;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.15), 0 24px 80px rgba(0,0,0,0.85);
          }
          .sf-modal-img { height: 320px; border-radius: 18px 18px 0 0; }
          .sf-modal-body { padding: 32px 40px 16px; }
          .sf-modal-h2 { font-size: 1.8rem !important; }
          .sf-modal-actions { padding: 16px 40px 32px; justify-content: center; gap: 20px; }
          .sf-modal-actions .sf-add-btn { flex: none; padding: 10px 28px; }
        }
        .sf-product-card-nickel {
          border: 4px solid #8E98A7 !important;
          background: #0F1923 !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
          border-radius: var(--radius-xl) !important;
          overflow: hidden !important;
          display: flex !important;
          flex-direction: column !important;
          height: 100% !important;
        }
        .sf-product-price-nickel {
          color: #A8B4C0 !important;
          text-shadow: none !important;
        }
      `}} />

      {!showStoreGrid && !detailProduct && (
        <>
          <div role="note" style={{
            display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
            margin: '0 0 12px', padding: '8px 12px',
            border: '1px solid rgba(229,62,62,0.35)', borderRadius: 10,
            background: 'rgba(229,62,62,0.06)', textAlign: 'center',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
              <path d="M9 3h6M10 3v6.5L4.5 19a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 9.5V3" />
            </svg>
            <span style={{ fontSize: '0.74rem', lineHeight: 1.3, color: 'var(--silver)' }}>
              <strong style={{ color: 'var(--red)' }}>Research Use Only.</strong>{' '}
              For In Vitro Laboratory Research. Not For Human Or Animal Use.
            </span>
          </div>
          <DiscoveryHero
            compoundsBySlug={compoundsBySlug || {}}
            primaryColor={primaryColor}
            onSelectArea={(area) => {
              setFilterArea(area);
              setFilterCategory('all');
              openGrid();
            }}
            onSearchStarted={(q?: string) => {
              setFilterArea('');
              setFilterCategory('all');
              setSearchQuery(q || '');
              openGrid();
            }}
            onAlreadyKnowClicked={() => {
              openGrid();
            }}
            onAddToCart={(variantId) => addToCart(variantId)}
            onOpenProduct={(variantId) => {
              const grp = grouped.find(g => g.variants.some(v => v.id === variantId));
              if (grp) setDetailProduct(grp);
            }}
            resolveProducts={(slugs) => {
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
                  in_stock: true,
                });
              }
              return out;
            }}
            autoSearchQuery={aiSearchFallbackQuery}
            onAutoSearchConsumed={() => setAiSearchFallbackQuery('')}
          />
        </>
      )}

      <StorefrontCompareDrawer primaryColor={primaryColor} compoundsBySlug={compoundsBySlug} />



      {showStoreGrid && (
        <>

      {filterArea && (
        <div style={{
          display: detailProduct ? 'none' : 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
          padding: '8px 12px', borderRadius: 10,
          background: 'rgba(192,197,206,0.08)',
          border: '1px solid rgba(192,197,206,0.32)',
        }}>
          <span style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.78rem', fontWeight: 700 }}>Filtered By Research Area</span>
          <button
            type="button"
            onClick={() => {
              setFilterArea('');
              setActiveCardIndex(1); // Default to Top 10 when cleared
            }}
            style={{
              marginLeft: 'auto',
              background: 'transparent', border: '1px solid rgba(255,255,255,0.18)',
              color: '#FFFFFF', borderRadius: 8, padding: '6px 10px',
              fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
              minHeight: 32,
            }}
          >Clear</button>
        </div>
      )}

      {/* ── Phase 3: Dynamic Image Hero ─────────────────────────────── */}
      <div
        style={{
          display: detailProduct ? 'none' : undefined,
          position: 'relative',
          width: '100%',
          maxWidth: 960,
          margin: '0 auto 24px',
          aspectRatio: '2 / 1',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* LCP element for the storefront. absolute fill behind content */}
        <Image 
          src="/images/store_discovery_hero_v3.png" 
          alt="Store Hero" 
          fill 
          priority 
          quality={45} 
          sizes="(max-width: 960px) 100vw, 960px" 
          style={{ objectFit: 'cover' }} 
        />
        {/* Search input mapped precisely over the search input bar in the image */}
        <input
          type="text"
          aria-label="Search compounds by name, goal, or mechanism"
          value={searchQuery}
          onChange={(e) => {
            const val = e.target.value;
            setSearchQuery(val);
            if (!val.trim()) {
              setActiveCardIndex(1); // Default to Top 10 when query is cleared/empty
            } else {
              setActiveCardIndex(null); // Clear card filter when user types
            }
          }}
          style={{
            position: 'absolute',
            left: '3.4%',
            top: '26.9%',
            width: '93.2%',
            height: '11.5%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#FFFFFF',
            fontSize: 'max(16px, 2.2vw)',
            fontWeight: 500,
            padding: '0 12% 0 calc(4.5% + 30px)',
          }}
        />

        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setActiveCardIndex(1); // Default to Top 10 when cleared
            }}
            style={{
              position: 'absolute',
              right: '8.2%',
              top: '32.65%',
              transform: 'translateY(-50%)',
              width: 'max(20px, 2.2vw)',
              height: 'max(20px, 2.2vw)',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 10,
              fontSize: 'max(10px, 1.1vw)',
              fontWeight: 800,
              padding: 0,
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.45)';
              e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
              e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
            }}
          >
            X
          </button>
        )}

        {/* Mapped overlay buttons for the 9 cards at the bottom */}
        {CARD_MAPPINGS.map((card) => {
          const CARD_LEFTS = [1.270, 12.207, 23.242, 34.180, 45.215, 56.152, 67.188, 78.125, 89.160];
          const left = CARD_LEFTS[card.index - 1];
          const width = 9.570;
          const isActive = activeCardIndex === card.index;

          return (
            <button
              key={card.index}
              type="button"
              onClick={() => {
                setActiveCardIndex(card.index);
                setSearchQuery(''); // Clear search query when card is clicked
                setFilterCategory('all');
                setFilterArea('');
              }}
              style={{
                position: 'absolute',
                left: `${left}%`,
                top: '55.9%',
                width: `${width}%`,
                height: '39.7%',
                cursor: 'pointer',
                background: 'transparent',
                border: isActive ? '2px solid rgba(255, 255, 255, 0.45)' : '2px solid transparent',
                borderRadius: 14,
                boxShadow: isActive ? '0 0 15px rgba(255,255,255,0.15), inset 0 0 10px rgba(255,255,255,0.05)' : 'none',
                backgroundColor: isActive ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                outline: 'none',
                boxSizing: 'border-box',
                margin: 0,
                padding: 0,
                transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = 'transparent';
                }
              }}
              title={card.label}
              aria-label={card.label}
            />
          );
        })}
      </div>

      {/* Grid section - hidden when product detail is shown */}
      <div style={{ display: detailProduct ? 'none' : undefined }}>

      {/* Did You Mean Banner */}
      {didYouMeanSuggestion && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 24,
          padding: '12px 18px',
          borderRadius: 14,
          background: 'rgba(235, 178, 54, 0.08)',
          border: '1px solid rgba(235, 178, 54, 0.25)',
          backdropFilter: 'blur(8px)',
        }}>
          <Sparkles size={16} color="#EBB236" style={{ flexShrink: 0 }} />
          <span style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.88rem', fontWeight: 500 }}>
            Did you mean:{' '}
            <button
              type="button"
              onClick={() => {
                setSearchQuery(didYouMeanSuggestion);
                setActiveCardIndex(null);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#EBB236',
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
                fontSize: '0.88rem',
              }}
            >
              {didYouMeanSuggestion}
            </button>
            ?
          </span>
        </div>
      )}

      {/* Active Filter Banner */}
      {activeCardIndex !== null && activeCardIndex !== 1 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 24,
          padding: '12px 18px',
          borderRadius: 14,
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(8px)',
        }}>
          <span style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.85rem', fontWeight: 700 }}>
            Active View: <span style={{ color: '#FFFFFF' }}>{CARD_MAPPINGS.find(m => m.index === activeCardIndex)?.label}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setActiveCardIndex(1);
              setSearchQuery('');
            }}
            style={{
              marginLeft: 'auto',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#FFFFFF',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Stacks Grid (displayed only under Peptide Stacks tab) */}
      {activeCardIndex === 9 && bundles && bundles.length > 0 && (
        <div style={{ marginTop: 0 }}>
          <h3 style={{ fontFamily: 'var(--font-brand)', fontSize: '1.05rem', color: 'var(--white)', marginBottom: 'var(--space-4)', letterSpacing: '0.03em' }}>
            Research Stacks &amp; Bundles
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
                  className="sf-product-card-nickel"
                  style={{
                    padding: 'var(--space-5)',
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
                    <span className="sf-product-price-nickel" style={{
                      fontSize: '1.3rem',
                      fontWeight: 800,
                      fontFamily: 'var(--font-brand)',
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

      {filteredProducts.length === 0 && (
        <div className="glass-panel hover-lift stagger-fade-in">
          <div style={{ textAlign: 'center', padding: 'var(--space-8) var(--space-6)' }}>
            {deferredSearch.trim() ? (
              <>
                <Search size={32} style={{ color: 'var(--grey-400)', marginBottom: 12 }} />
                <h3 style={{ color: 'var(--white)', fontSize: '1.1rem', marginBottom: '8px' }}>
                  No results for &ldquo;{deferredSearch.trim()}&rdquo;
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem', marginBottom: '20px', maxWidth: '440px', margin: '0 auto 20px' }}>
                  Try one of these common research goals, or check your spelling:
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '24px' }}>
                  {([
                    { label: 'Fat Loss', q: 'fatloss lipolysis visceral', icon: Flame },
                    { label: 'Muscle Growth', q: 'muscle anabolic growthhormone hypertrophy', icon: Zap },
                    { label: 'Brain / Nootropic', q: 'cognitive nootropic brain neuroprotect', icon: Brain },
                    { label: 'Tissue Healing', q: 'healing repair tendon wound', icon: Shield },
                    { label: 'Anti-Aging', q: 'antiaging longevity telomere senolytic', icon: Hourglass },
                    { label: 'GLP-1 / Weight', q: 'glp1 semaglutide weightloss', icon: Syringe },
                    { label: 'Immune Support', q: 'immune antimicrobial tcell thymosin', icon: Shield },
                    { label: 'Sexual Health', q: 'sexual libido erectile fertility', icon: Heart },
                  ] as { label: string; q: string; icon: any }[]).map(({ label, q, icon: Icon }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setSearchQuery(q)}
                      style={{
                        background: 'rgba(255,255,255,0.07)',
                        border: '1px solid rgba(255,255,255,0.18)',
                        borderRadius: '20px',
                        color: 'rgba(255,255,255,0.85)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '6px 14px',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(120,200,255,0.18)';
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(120,200,255,0.5)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)';
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.18)';
                      }}
                    >
                      <Icon size={12} />
                      {label}
                    </button>
                  ))}
                </div>

                {/* ── #1 Zero-Result AI Fallback ─────────────────────────────────────────
                    When the fast JS search finds nothing, offer to run the AI match engine
                    so the researcher always gets relevant results rather than a blank screen. */}
                <div style={{
                  margin: '0 auto 8px',
                  padding: '16px 20px',
                  background: 'rgba(192,197,206,0.06)',
                  border: '1px solid rgba(192,197,206,0.18)',
                  borderRadius: 16,
                  maxWidth: 480,
                }}>
                  <p style={{ color: '#C0C5CE', fontSize: '0.88rem', fontWeight: 600, marginBottom: 12, lineHeight: 1.4 }}>
                    Our AI Research Engine can scan the full catalog for compounds related to your goal.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      // Switch to the discovery view with the current query pre-loaded
                      // so DiscoveryHero's useEffect auto-submits the AI match.
                      setAiSearchFallbackQuery(deferredSearch.trim());
                      closeGrid();
                    }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      background: '#C0C5CE', color: '#0A1018',
                      border: 'none', borderRadius: 10,
                      padding: '10px 20px', fontWeight: 900, fontSize: '0.9rem',
                      cursor: 'pointer', boxShadow: '0 4px 16px rgba(192,197,206,0.25)',
                    }}
                  >
                    <Sparkles size={16} aria-hidden />
                    Search AI Research Library
                  </button>
                </div>

              </>
            ) : (
              <>
                <h3 style={{ color: 'var(--white)', fontSize: '1.05rem', marginBottom: 'var(--space-3)' }}>
                  No Products Match Your Filters
                </h3>
                <p style={{ color: 'var(--grey-400)', fontSize: '0.9rem', marginBottom: 'var(--space-4)' }}>
                  Try widening your price range or resetting all filters.
                </p>
              </>
            )}
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


      {filteredProducts.length > 0 && <TrustStrip />}

      {showFeatured && (
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 'var(--space-5)' }}>
            <div style={{ background: primaryColor, padding: '6px', borderRadius: '8px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            </div>
            <h2 style={{ fontSize: '1.4rem', color: 'var(--white)', margin: 0, fontWeight: 700 }}>Featured Products</h2>
          </div>
          <motion.div
            className="grid-3" style={{ gap: 'var(--space-6)' }}
            variants={containerVariants} initial="hidden" animate="show"
          >
            {featuredGroups.map(renderProductCard)}
          </motion.div>
        </div>
      )}

      {true && (
        <motion.div
          className="grid-3" style={{ gap: 'var(--space-6)', display: filteredProducts.length === 0 ? 'none' : undefined }}
          variants={containerVariants} initial="hidden" animate="show"
          key={`${filterCategory}-${sortBy}-${searchQuery}`}
        >
        {filteredProducts.slice(0, visibleCount).map(renderProductCard)}
        </motion.div>
      )}

      {filteredProducts.length > visibleCount && (
        <div style={{ textAlign: 'center', marginTop: 'var(--space-6)', marginBottom: 'var(--space-4)' }}>
          <button
            type="button"
            className="btn btn-outline hover-lift"
            onClick={() => setVisibleCount(v => v + 24)}
            style={{ minWidth: 200, color: 'var(--white)', borderColor: 'rgba(255,255,255,0.2)' }}
          >
            Load More Products
          </button>
        </div>
      )}
      </div>{/* END grid section */}
      </>
      )}

      <div style={{ position: 'fixed', bottom: 'env(safe-area-inset-bottom, 0px)', right: 0, zIndex: 9999, pointerEvents: 'none' }}>
        <div
          role="button"
          tabIndex={0}
          aria-label={totalCartItems > 0 ? `Open Cart, ${totalCartItems} Item${totalCartItems !== 1 ? 's' : ''}` : 'Open Cart'}
          className="floating-cart-wrapper hover-cart-float"
          onClick={() => {
            if (totalCartItems === 0 && totalSavedItems === 0) {
              setCartToast(true);
              setTimeout(() => setCartToast(false), 2500);
            } else {
              setShowCartFloat(!showCartFloat);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              if (e.key === ' ') e.preventDefault();
              e.currentTarget.click();
            }
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <Image src="/cart-icon.png" width={160} height={160} alt="Cart" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} unoptimized />
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
                  const perVial = item.retail_price / 10;
                  // Bac. water sells in fixed 10-packs; show it as packs (10x), not loose vials.
                  const isBW = isBacWaterItem(item.products?.name, item.products?.compound_slug);
                  const packSize = 10;
                  const lineName = isBW ? 'Bac. Water 10x 10ml Vials' : `${name}${size ? ` (${size})` : ''}`;
                  const unitPrice = isBW ? perVial * packSize : perVial;
                  const displayCount = isBW ? Math.round(qty / packSize) : qty;
                  return (
                    <div key={variantId} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: 10,
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12,
                    }}>
                      <Image
                        src={imgUrl || '/images/peptide_clear.png'}
                        alt={name}
                        width={64}
                        height={64}
                        style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', flexShrink: 0, background: '#0F1923' }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          const fallback = getProductImage(null, item.products?.category || 'Other', name);
                          if (target.src !== fallback && !target.src.includes(fallback)) {
                            target.srcset = '';
                            target.src = fallback;
                          }
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.9rem', color: 'var(--white)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {lineName}
                        </div>
                        {(() => {
                          // CRO: quantity discounts (3+ vials 10%, 5+ 15%, 7+ 20%)
                          // were applied silently at checkout but invisible here,
                          // so the cart over-quoted the price and never asked for
                          // the next tier. Mirror the server math per line.
                          const qdEligible = volumePricingEnabled !== false && !isBW && !isVolumeDiscountExcluded(item.products?.name) && !isStorefrontOwner;
                          const pct = qdEligible ? quantityDiscountPct(qty) : 0;
                          const discUnit = qdEligible ? discountedUnitPrice(perVial, qty) : perVial;
                          const nextTier = qdEligible
                            ? [...QUANTITY_DISCOUNT_TIERS].reverse().find(t => qty < t.minQty && t.pct > pct)
                            : undefined;
                          return (
                            <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginBottom: 6 }}>
                              {pct > 0 ? (
                                <>
                                  <span style={{ textDecoration: 'line-through', opacity: 0.55 }}>${formatPrice(unitPrice)}</span>{' '}
                                  <span style={{ color: '#68D391', fontWeight: 700 }}>${formatPrice(discUnit)} Each ({pct}% Off)</span>
                                  {' / '}${formatPrice(discUnit * qty)} Total
                                </>
                              ) : (
                                <>${formatPrice(unitPrice)} Each / ${formatPrice(perVial * qty)} Total</>
                              )}
                              {nextTier && (
                                <div style={{ color: 'var(--teal)', fontWeight: 700, marginTop: 2 }}>
                                  Add {nextTier.minQty - qty} More To Unlock {nextTier.pct}% Off This Peptide
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button onClick={() => setCartItems(prev => {
                          const next = { ...prev };
                          const dec = isBW ? packSize : 1;
                          const cur = next[variantId] || 0;
                          if (cur - dec <= 0) delete next[variantId];
                          else next[variantId] = cur - dec;
                          return next;
                        })} aria-label="Decrease quantity" style={{
                          width: 36, height: 36, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)',
                          background: 'transparent', color: 'var(--white)', cursor: 'pointer', fontSize: '0.85rem',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, touchAction: 'manipulation'
                        }}>-</button>
                        <input
                          type="number"
                          aria-label="Quantity"
                          min="0"
                          value={displayCount || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setCartItems(prev => {
                              const next = { ...prev };
                              if (isNaN(val)) {
                                return next;
                              }
                              const prodItem = products.find(p => p.id === variantId);
                              const maxQty = prodItem?.products?.inventory_count ?? Infinity;

                              let requested = isBW ? val * packSize : val;
                              if (requested > maxQty) {
                                toast.error(maxQty === Infinity ? 'An Error Occurred Adding To Cart.' : `Maximum Available Stock Is ${maxQty}.`);
                                requested = isBW ? Math.floor(maxQty / packSize) * packSize : maxQty;
                              }

                              if (requested <= 0) {
                                delete next[variantId];
                              } else {
                                next[variantId] = requested;
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
                            color: 'var(--white)', fontWeight: 700, fontSize: '16px', 
                            width: 60, textAlign: 'center', background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, padding: '2px',
                            appearance: 'textfield', outline: 'none'
                          }}
                        />
                        <button onClick={() => {
                          if (isBW) {
                            setCartItems(prev => ({ ...prev, [variantId]: (prev[variantId] || 0) + packSize }));
                          } else {
                            addToCart(variantId);
                          }
                        }} aria-label="Increase quantity" style={{
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
                      const perVial = item.retail_price / 10;
                      return (
                        <div key={variantId} style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: 10,
                          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12,
                        }}>
                          <Image
                            src={imgUrl || '/images/peptide_clear.png'}
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
                              ${formatPrice(perVial)} Each / Qty {Number(qty)}
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

                {/* Smart Cart: Researchers Also Order - filtered to only non-cart items */}
                {(recommendations.length > 0 || recommendationsLoading) && (
                  <div style={{ marginTop: 8, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <RecommendationStrip
                      title="Researchers Also Order"
                      recommendations={recommendations.filter(rec => {
                        // Hide items already in the cart
                        const inCart = products.some(
                          p => p.product_id === rec.id && cartItems[p.id] != null && (cartItems[p.id] ?? 0) > 0
                        );
                        return !inCart;
                      })}
                      loading={recommendationsLoading}
                      primaryColor={primaryColor}
                      onSelect={(productId) => {
                        // Find the grouped product and open its detail sheet
                        const product = products.find(p => p.product_id === productId);
                        if (!product) return;
                        const name = product.products?.name;
                        if (!name) return;
                        const grp = grouped.find(g => g.name === name);
                        if (grp) {
                          setShowCartFloat(false);
                          setTimeout(() => {
                            setDetailProduct(grp);
                            setPendingQty(selfBuyMin);
                          }, 200);
                        }
                      }}
                    />
                  </div>
                )}
              </div>
              <div style={{ padding: '16px 20px calc(18px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid rgba(255,255,255,0.10)', display: 'flex', flexDirection: 'column', gap: 10, background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.25))' }}>
                {(() => {
                  // CRO: the footer quoted flat retail while checkout applies
                  // per-peptide quantity discounts - the cart literally showed a
                  // HIGHER price than the user would pay. Quote the discounted
                  // total and celebrate the savings instead.
                  let flatTotal = 0;
                  let discTotal = 0;
                  for (const [vId, qty] of Object.entries(cartItems)) {
                    const item = products.find(p => p.id === vId);
                    if (!item) continue;
                    const per = item.retail_price / 10;
                    flatTotal += per * qty;
                    const eligible = volumePricingEnabled !== false
                      && !isStorefrontOwner
                      && !isBacWaterItem(item.products?.name, item.products?.compound_slug)
                      && !isVolumeDiscountExcluded(item.products?.name);
                    discTotal += (eligible ? discountedUnitPrice(per, qty) : per) * qty;
                  }
                  const saved = flatTotal - discTotal;
                  return (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.9rem', color: 'var(--grey-300)', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700 }}>Total</span>
                        <span style={{ color: 'var(--white)', fontWeight: 800, fontSize: '1.25rem', letterSpacing: '0.01em' }}>
                          {saved > 0.004 && (
                            <span style={{ textDecoration: 'line-through', color: 'var(--grey-400)', fontWeight: 600, fontSize: '0.9rem', marginRight: 8 }}>
                              ${flatTotal.toFixed(2)}
                            </span>
                          )}
                          ${discTotal.toFixed(2)}
                        </span>
                      </div>
                      {saved > 0.004 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#68D391', fontWeight: 700, marginBottom: 4 }}>
                          <span>Quantity Discounts Applied</span>
                          <span>You Save ${saved.toFixed(2)}</span>
                        </div>
                      )}
                      {totalCartItems > 0 && totalCartItems < overallMin && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--grey-300)', fontWeight: 700, textAlign: 'center', padding: '5px 10px', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 2 }}>
                          {totalCartItems} Of {overallMin} Minimum Items - Add {overallMin - totalCartItems} More To Check Out
                        </div>
                      )}
                    </>
                  );
                })()}
                {/* CRO: free-shipping progress. The house store ships $100+
                    orders free (enforced server-side in /api/orders) but the
                    cart never said so - the classic AOV nudge was missing. */}
                {agentSlug === 'researchstore' && (() => {
                  const cartSubtotal = Object.entries(cartItems).reduce((sum, [vId, qty]) => {
                    const item = products.find(p => p.id === vId);
                    if (!item) return sum;
                    return sum + (item.retail_price / 10) * qty;
                  }, 0);
                  const remaining = 100 - cartSubtotal;
                  return (
                    <div style={{
                      fontSize: '0.8rem', fontWeight: 700, textAlign: 'center',
                      color: remaining <= 0 ? '#68D391' : 'var(--grey-300)',
                      padding: '6px 10px', borderRadius: 'var(--radius-md)',
                      background: remaining <= 0 ? 'rgba(72,187,120,0.10)' : 'rgba(255,255,255,0.04)',
                      border: remaining <= 0 ? '1px solid rgba(72,187,120,0.30)' : '1px solid rgba(255,255,255,0.08)',
                    }}>
                      {remaining <= 0
                        ? 'Your Order Qualifies For Free Shipping'
                        : `Add $${remaining.toFixed(2)} More To Unlock Free Shipping On Orders $100+`}
                    </div>
                  );
                })()}
                {/* CRO: payment reassurance at the moment of commitment. */}
                <div style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textAlign: 'center', fontWeight: 600 }}>
                  No Card Required - Pay By Zelle, Venmo, Cash App Or Apple Pay After Checkout
                </div>
                <DynamicCartButton
                  type="checkout"
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
                      localStorage.setItem(`pnl_storefront_cart_${agentSlug}`, JSON.stringify({
                        items: pnlCart,
                        _savedAt: Date.now(),
                      }));
                      Object.keys(localStorage)
                        .filter(k => k.startsWith('pnl_storefront_cart_') && k !== `pnl_storefront_cart_${agentSlug}`)
                        .forEach(k => localStorage.removeItem(k));
                      localStorage.removeItem('pnl_storefront_cart');
                    } catch (e) {
                      console.error('Failed to sync cart:', e);
                    }
                    setShowCartFloat(false);
                    router.push(`/checkout?agent=${encodeURIComponent(agentSlug)}`);
                  }}
                />
                <DynamicCartButton
                  type="shopping"
                  onClick={() => setShowCartFloat(false)}
                />
                <DynamicCartButton
                  type="clear"
                  onClick={() => {
                    // CRO: clearing was one irreversible tap on a cart that can
                    // take minutes to build (order minimums, 10-pack diluents).
                    // Snapshot + Undo toast turns a rage-quit moment into a
                    // recoverable one.
                    const snapshot = { ...cartItems };
                    setCartItems({});
                    setShowCartFloat(false);
                    if (Object.keys(snapshot).length > 0) {
                      toast('Cart Cleared', {
                        action: {
                          label: 'Undo',
                          onClick: () => setCartItems(snapshot),
                        },
                        duration: 6000,
                      });
                    }
                  }}
                />
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

      {/* Product detail: inline in-page view - replaces the grid, no fixed overlay */}
      {detailProduct && (
        <div className="sf-modal-overlay">
          <div className="sf-modal-sheet">
            {/* Back / close bar */}
            <div style={{
              display: 'flex', alignItems: 'center', padding: '14px 18px 10px',
              background: 'linear-gradient(180deg, #131b24 78%, rgba(19,27,36,0))',
            }}>
              <button
                onClick={() => setDetailProduct(null)}
                aria-label="Back"
                style={{
                  width: 34, height: 34, minWidth: 34, minHeight: 34,
                  borderRadius: '50%', padding: 0,
                  background: 'linear-gradient(180deg, #2b3744 0%, #1b242e 100%)',
                  border: '1px solid rgba(190,200,210,0.30)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), 0 3px 9px rgba(0,0,0,0.5)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', boxSizing: 'border-box', flexShrink: 0,
                  transition: 'background 0.15s ease',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <div style={{ flex: 1 }} />
              <div style={{ width: 44, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.20)' }} aria-hidden="true" />
              <div style={{ flex: 1 }} />
            </div>

            {/* CRO: sticky quick-add bar. The main Add-To-Cart CTA sits far
                below the fold (after description, monograph, and size picker),
                so the purchase action stays visible from the first pixel and
                while scrolling. Uses the same shared handler as the main CTA. */}
            {(() => {
              const stickyVId = selectedVariants[detailProduct.name] || detailProduct.defaultVariantId;
              const stickyV = detailProduct.variants.find(v => v.id === stickyVId) || detailProduct.variants[0];
              if (!stickyV) return null;
              const stickyRaw = (stickyV as any).is_on_sale && (stickyV as any).sale_price
                ? (stickyV as any).sale_price
                : stickyV.retail_price;
              const stickyPer = stickyRaw / 10;
              const stickyQty = Math.max(1, pendingQty);
              return (
                <div style={{
                  position: 'sticky', top: 0, zIndex: 40,
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 18px',
                  background: 'rgba(15,25,35,0.96)',
                  backdropFilter: 'blur(8px)',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.85rem', fontWeight: 700, color: 'var(--white)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {toTitleCase(detailProduct.name)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: primaryColor, fontWeight: 800, fontFamily: 'var(--font-brand)' }}>
                      ${stickyPer.toFixed(2)} Per Vial{stickyQty > 1 ? ` - ${stickyQty} Selected` : ''}
                    </div>
                  </div>
                  <DynamicAddToCartButton
                    onClick={addDetailProductToCart}
                    style={{ width: 122, height: 38, fontSize: '0.8rem', flexShrink: 0 }}
                  />
                </div>
              );
            })()}
            <div
                className="sf-modal-img"
                style={{ background: `radial-gradient(circle at 50% 50%, ${primaryColor}20 0%, var(--black) 100%)` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <Image
                  src={detailProduct.imageUrl || '/images/peptide_clear.png'}
                  alt={detailProduct.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  style={{ objectFit: 'contain', objectPosition: 'center', padding: '16px', transition: 'transform 0.4s ease' }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    const fallback = getProductImage(null, detailProduct.category || 'Other', detailProduct.name);
                    if (target.src !== fallback && !target.src.includes(fallback)) {
                      target.srcset = '';
                      target.src = fallback;
                    } else {
                      target.srcset = '';
                      target.src = '/images/peptide_clear.png';
                      target.style.opacity = '0.9';
                    }
                  }}
                />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, background: 'linear-gradient(transparent, var(--surface-2))' }} />
              </div>

              <div className="sf-modal-body">
                {detailHistory.length > 1 && (
                  <button
                    onClick={() => setDetailHistory(prev => prev.slice(0, prev.length - 1))}
                    style={{ background: 'none', border: 'none', color: primaryColor, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '0 0 16px 0', fontSize: '0.9rem', fontWeight: 700 }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    Back To {detailHistory[detailHistory.length - 2].name}
                  </button>
                )}
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-3)' }}>
                  {(() => {
                    const { main, subtitle } = splitProductName(toTitleCase(detailProduct.name));
                    return (
                      <>
                        <h2 className="sf-modal-h2" style={{ fontFamily: 'var(--font-brand)', color: 'var(--white)', lineHeight: 1.2, margin: 0 }}>
                          {main}
                        </h2>
                        {subtitle && (
                          <div style={{ fontSize: '0.9rem', color: 'var(--grey-400)', fontWeight: 500, marginTop: 2 }}>
                            {subtitle}
                          </div>
                        )}
                        {(() => {
                          const _canonicalName = detailProduct.variants[0]?.products?.name || detailProduct.name;
                          const _nick = getPopularName(_canonicalName);
                          if (!_nick) return null;
                          return (
                            <div style={{ fontSize: '0.85rem', color: 'var(--teal)', fontStyle: 'italic', fontWeight: 500, marginTop: 4 }}>
                              {_nick}
                            </div>
                          );
                        })()}
                      </>
                    );
                  })()}

                  {(() => {
                    const c = detailProduct.compoundSlug ? compoundsBySlug[detailProduct.compoundSlug] : undefined;
                    const aliases = c?.aliases || [];
                    const shortAliases = aliases.slice(0, 4);
                    
                    if (shortAliases.length === 0) return null;
                    return (
                      <p style={{ fontSize: '0.82rem', color: 'var(--silver)', margin: '8px 0 0' }}>
                        Also Known As: <span style={{ color: 'var(--white)' }}>{shortAliases.join(', ')}</span>
                      </p>
                    );
                  })()}

                  <p style={{ fontSize: '0.9rem', color: 'var(--grey-300)', lineHeight: 1.7, marginTop: '20px', marginBottom: 0 }}>
                    {(() => {
                      const desc = detailProduct.desc || 'Research Compound Available For Academic And Laboratory Use.';
                      const c = detailProduct.compoundSlug ? compoundsBySlug[detailProduct.compoundSlug] : undefined;
                      const aliases = c?.aliases || [];
                      const descriptiveAliases = aliases.slice(4);
                      
                      if (descriptiveAliases.length > 0) {
                        return `- ${desc} & ${descriptiveAliases.join(', ')}.`;
                      }
                      return `- ${desc}`;
                    })()}
                  </p>

                  {(() => {
                    const c = detailProduct.compoundSlug ? compoundsBySlug[detailProduct.compoundSlug] : undefined;
                    if (!c) return null;
                    return (
                      <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setShowEli5(true)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            transition: 'transform 0.2s ease, filter 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.04)';
                            e.currentTarget.style.filter = 'brightness(1.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.filter = 'brightness(1)';
                          }}
                        >
                          <Image
                            src="/images/simple-explanation-btn.png"
                            alt="Simple Explanation"
                            width={200}
                            height={72}
                            style={{ height: '72px', width: 'auto', display: 'block' }}
                            unoptimized
                          />
                        </button>
                      </div>
                    );
                  })()}
                </div>

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
                        {localStock} Vial{localStock !== 1 ? 's' : ''} In Agent Local Stock - Ships Immediately
                      </span>
                    </div>
                  );
                })()}

                {/* CRO: verified purity chip. purity_percentage is real catalog
                    data that previously only surfaced deep inside the monograph
                    portal - now it sits on the decision surface next to price. */}
                {(() => {
                  const compound = detailProduct.compoundSlug
                    ? compoundsBySlug[detailProduct.compoundSlug]
                    : undefined;
                  const purity = compound?.purity_percentage;
                  if (!purity || purity <= 0) return null;
                  return (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      padding: '7px 14px', borderRadius: 'var(--radius-md)',
                      background: `${primaryColor}12`,
                      border: `1px solid ${primaryColor}40`,
                      marginBottom: 'var(--space-4)', marginLeft: 8,
                    }}>
                      <Shield size={13} aria-hidden="true" style={{ color: primaryColor, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.82rem', color: primaryColor, fontWeight: 700 }}>
                        Third-Party Tested - {purity}%+ Purity
                      </span>
                    </div>
                  );
                })()}

                {(() => {
                  const firstVariant = detailProduct.variants[0];
                  const pid = firstVariant?.product_id;
                  const coaUrl = pid ? coaByProductId?.[pid] : undefined;
                  if (!coaUrl) return null;
                  return (
                    <div style={{ marginBottom: 'var(--space-6)' }}>
                      <IframeLink
                        href={coaUrl}
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
                      </IframeLink>
                    </div>
                  );
                })()}

                {(() => {
                  const compound = detailProduct.compoundSlug
                    ? compoundsBySlug[detailProduct.compoundSlug]
                    : undefined;
                  if (!compound) return null;
                  const coaPid = detailProduct.variants[0]?.product_id;
                  const coaUrl = coaPid ? (coaByProductId?.[coaPid] ?? null) : null;
                  return <ProductMonograph compound={compound} primaryColor={primaryColor} coaUrl={coaUrl} />;
                })()}

                {(() => {
                  const selectedVId = selectedVariants[detailProduct.name] || detailProduct.defaultVariantId;
                  const activeV = detailProduct.variants.find(v => v.id === selectedVId) || detailProduct.variants[0];
                  const qty = pendingQty;
                  const isBW = isBacWaterItem(detailProduct.name, detailProduct.compoundSlug);
                  const step = isBW ? 10 : selfBuyStep;
                  const minQ = isBW ? 10 : selfBuyMin;
                  const rawPrice = (activeV as any).is_on_sale && (activeV as any).sale_price
                    ? (activeV as any).sale_price
                    : activeV.retail_price;
                  const basePrice = rawPrice / 10;

                  const agentCostPerVial = (activeV as any).cost_price != null ? Number((activeV as any).cost_price) / 10 : basePrice;

                  // Quantity Discounts: Buying More Of The SAME Peptide Saves
                  // 10/15/20%. Diluents (BAC Water) And Owner Restocks Stay Flat.
                  const tiers = (volumePricingEnabled && !isBW && !isStorefrontOwner)
                      ? [
                          { label: '1-2 Vials', min: 1, max: 2, pct: 0 },
                          { label: '3-4 Vials', min: 3, max: 4, pct: -10 },
                          { label: '5-6 Vials', min: 5, max: 6, pct: -15 },
                          { label: '7+ Vials - Best Price', min: 7, max: Infinity, pct: -20 },
                        ]
                      : [
                          { label: 'All Quantities - Flat Price', min: 1, max: Infinity, pct: 0 },
                        ];

                  const getUnitPrice = (q: number) => {

                    const t = tiers.find(t => q >= t.min && q <= t.max);
                    return t ? parseFloat((basePrice * (1 + t.pct / 100)).toFixed(2)) : basePrice;
                  };

                  const displayQty = qty > 0 ? qty : 1;
                  const unitPrice = getUnitPrice(displayQty);
                  const lineTotal = unitPrice * displayQty;

                  return (
                    <div style={{ marginBottom: 'var(--space-6)' }}>
                      {!detailProduct.compoundSlug && (
                        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 0 var(--space-5)' }} />
                      )}
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
                                    flex: '1 1 calc(16.666% - 8px)', minWidth: 60,
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                                    padding: '10px 6px', borderRadius: 10,
                                    border: isSelected ? `1px solid ${primaryColor}` : '1px solid rgba(190,200,210,0.22)',
                                    background: isSelected
                                      ? `linear-gradient(180deg, ${primaryColor}26 0%, ${primaryColor}10 100%)`
                                      : 'linear-gradient(180deg, #2b3744 0%, #1b242e 100%)',
                                    boxShadow: isSelected
                                      ? `inset 0 1px 0 rgba(255,255,255,0.18), 0 0 0 1px ${primaryColor}55, 0 0 12px ${primaryColor}40`
                                      : 'inset 0 1px 0 rgba(255,255,255,0.10), 0 2px 6px rgba(0,0,0,0.4)',
                                    color: isSelected ? primaryColor : 'var(--grey-200)',
                                    fontWeight: isSelected ? 800 : 600, fontSize: '0.85rem',
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

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: 'var(--silver)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                            Quantity (Vials)
                          </label>
                          {isBW && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--silver)', marginBottom: 6 }}>
                              Sold In 10-Packs (Increments Of 10)
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                              onClick={() => setPendingQty(prev => Math.max(minQ, prev - step))}
                              disabled={qty <= minQ}
                              style={{
                                width: 38, height: 38, borderRadius: 10,
                                border: '1px solid rgba(190,200,210,0.25)',
                                background: 'linear-gradient(180deg, #2b3744 0%, #1b242e 100%)',
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14), 0 2px 6px rgba(0,0,0,0.45)',
                                color: qty <= minQ ? 'var(--grey-600)' : 'var(--white)',
                                cursor: qty <= minQ ? 'not-allowed' : 'pointer',
                                fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}
                            >-</button>
                            <input
                              type="number"
                              aria-label="Quantity"
                              value={qty || ''}
                              onChange={e => {
                                const val = parseInt(e.target.value, 10);
                                if (!isNaN(val)) {
                                  setPendingQty(Math.max(minQ, val));
                                } else if (e.target.value === '') {
                                  setPendingQty(0);
                                }
                              }}
                              onBlur={() => {
                                if (qty < minQ) setPendingQty(minQ);
                                else if (isBW) setPendingQty(Math.max(10, Math.round(qty / 10) * 10));
                              }}
                              style={{
                                width: 54, textAlign: 'center', fontSize: '1.2rem', fontWeight: 800,
                                color: 'var(--white)', fontFamily: 'var(--font-brand)',
                                background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '4px', outline: 'none', appearance: 'textfield'
                              }}
                            />
                            <button
                              onClick={() => setPendingQty(prev => prev + step)}
                              style={{
                                width: 38, height: 38, borderRadius: 10,
                                border: `1px solid ${primaryColor}`,
                                background: `linear-gradient(180deg, ${primaryColor} 0%, ${primaryColor}cc 100%)`,
                                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), 0 4px 12px ${primaryColor}55`,
                                color: '#04221F', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 800,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}
                            >+</button>
                          </div>
                        </div>

                        {qty > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ textAlign: 'right' }}>
                              {isStorefrontOwner && (
                                <div style={{ fontSize: '0.65rem', color: '#68D391', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                                  Agent Direct Price
                                </div>
                              )}
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--grey-400)' }}>${unitPrice.toFixed(2)} × {qty} =</span>
                                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: primaryColor, fontFamily: 'var(--font-brand)' }}>${lineTotal.toFixed(2)}</span>
                              </div>
                            </div>
                            <DynamicAddToCartButton
                              onClick={addDetailProductToCart}
                              style={{ width: 140, height: 44, fontSize: '0.9rem' }}
                            />
                          </div>
                        )}
                      </div>

                      {(volumePricingEnabled) && (
                        <>
                          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: 'var(--space-5) 0' }} />
                          <div style={{
                            border: '6px solid #E2E8F0',
                            borderRadius: 'var(--radius-md)', overflow: 'hidden'
                          }}>
                          <div style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.04)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--silver)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Volume Discounts
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
                                  {t.label ?? (t.max === Infinity ? `${t.min}+ vials` : `${t.min}-${t.max} vials`)}
                                  {t.pct < 0 && <span style={{ color: '#68D391', marginLeft: 8, fontSize: '0.75rem' }}>Save {-t.pct}%</span>}
                                  {t.pct === 0 && tiers.length > 1 && <span style={{ color: 'var(--grey-400)', marginLeft: 8, fontSize: '0.75rem' }}>Standard</span>}
                                </span>
                                <span style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-brand)', color: isActive ? primaryColor : 'var(--grey-300)' }}>
                                  ${tierPrice.toFixed(2)}/ea
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                    </div>
                  );
                })()}

                <ProductModalEnhancements
                  currentCompound={detailProduct.compoundSlug ? (compoundsBySlug?.[detailProduct.compoundSlug] ?? null) : null}
                  currentCompoundSlug={detailProduct.compoundSlug ?? null}
                  currentProductName={detailProduct.name}
                  currentBundlePriceDollars={detailProduct.lowestPrice ?? null}
                  currentDefaultVariantId={detailProduct.defaultVariantId ?? null}
                  currentImageUrl={detailProduct.imageUrl ?? null}
                  currentVialMassMg={(() => {
                    const v = detailProduct.variants.find(x => x.id === detailProduct.defaultVariantId) || detailProduct.variants[0];
                    const n = Number(v?.products?.unit_size);
                    return Number.isFinite(n) && n > 0 ? n : null;
                  })()}
                  grouped={grouped.map<ModalGroupedProductRef>((g) => ({
                    name: g.name,
                    category: g.category,
                    imageUrl: g.imageUrl,
                    lowestPrice: g.lowestPrice,
                    defaultVariantId: g.defaultVariantId,
                    compoundSlug: g.compoundSlug,
                  }))}
                  compoundsBySlug={compoundsBySlug || {}}
                  primaryColor={primaryColor}
                  showBulkPricing={showBulkPricing}
                  onToggleBulkPricing={() => setShowBulkPricing(prev => !prev)}
                  onOpenProductBySlug={(slug) => {
                    const grp = grouped.find((g) => g.compoundSlug === slug);
                    if (grp) {
                      setDetailHistory(prev => [...prev, grp]);
                      setPendingQty(selfBuyMin);
                    }
                  }}
                  onOpenProductByName={(name) => {
                    const grp = grouped.find((g) => g.name === name);
                    if (grp) {
                      setDetailHistory(prev => [...prev, grp]);
                      setPendingQty(selfBuyMin);
                    }
                  }}
                  onAddVariantToCart={(variantId, qty) => {
                    setCartItems((prev) => ({ ...prev, [variantId]: (prev[variantId] || 0) + qty }));
                    setShowCartFloat(true);
                  }}
                >
                  {showBulkPricing && (
                      <div style={{
                        marginTop: 10,
                        border: '3px solid #8E98A7',
                        borderRadius: 14,
                        overflow: 'hidden',
                        background: 'linear-gradient(180deg, rgba(30,36,44,0.95) 0%, rgba(15,20,26,0.95) 100%)',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15)',
                        marginBottom: 10,
                      }}>
                        <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.2)', borderBottom: '2px solid rgba(142,152,167,0.2)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--white)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: i === 0 ? 'none' : '2px solid rgba(142,152,167,0.2)' }}>
                                <span style={{ fontSize: '0.9rem', color: 'var(--grey-400)', fontWeight: 600 }}>
                                  {tier.min}+ Vials <span style={{ color: '#68D391', marginLeft: 8, fontSize: '0.9rem', fontWeight: 700 }}>{tier.pct}% Off</span>
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <span style={{ fontSize: '0.9rem', fontWeight: 700, fontFamily: 'var(--font-brand)', color: 'var(--grey-300)' }}>${dp.toFixed(2)} / Vial</span>
                                  <button
                                    type="button"
                                    aria-label={`Add ${tier.min} Vials To Cart`}
                                    onClick={() => {
                                      setCartItems(prev => ({ ...prev, [selVId2]: (prev[selVId2] || 0) + tier.min }));
                                      setShowBulkPricing(false);
                                      setShowCartFloat(true);
                                    }}
                                    style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: primaryColor, color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                  >+</button>
                                </div>
                              </div>
                            );
                          });
                        })()}
                        <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.1)', borderTop: '2px solid rgba(142,152,167,0.2)', fontSize: '0.9rem', fontWeight: 600, color: 'var(--silver)' }}>
                          Contact Your Agent To Place A Bulk Order Of 500+ Vials.
                        </div>
                      </div>
                    )}
                </ProductModalEnhancements>
              </div>{/* END sf-modal-body */}


            </div>{/* END sf-modal-sheet */}
          </div>
      )}

      <AnimatePresence>
        {detailProduct && showEli5 && (() => {
          const c = detailProduct.compoundSlug ? compoundsBySlug[detailProduct.compoundSlug] : undefined;
          if (!c) return null;

          const sanitize = (text: string | null | undefined): string => {
            if (!text) return '';
            return text.replace(/-/g, '-');
          };

          const rawText = c.eli5_summary || c.plain_summary || `This compound is studied for: ${c.studied_for?.join(', ') || 'various biological effects'}. It targets: ${c.molecular_target || 'specific cellular mechanisms'}.`;
          const eli5Text = sanitize(rawText);
          const tierInfo = EVIDENCE_TIER[c.evidence_tier] ?? { label: 'Research Chemical', color: '#A8B4C0' };
          const riskInfo = RISK_META[c.risk_level] ?? { label: 'Unknown Risk', color: '#A8B4C0', bg: 'rgba(255,255,255,0.05)' };

          return (
            <motion.div
              key="eli5-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0, 0, 0, 0.85)',
                backdropFilter: 'blur(10px)',
                zIndex: 1100,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
              }}
              onClick={() => setShowEli5(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  maxWidth: '520px',
                  background: '#0F1923',
                  border: '4px solid #8E98A7',
                  borderRadius: '16px',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.05)',
                  padding: '24px',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                }}
              >
                <button
                  onClick={() => setShowEli5(false)}
                  aria-label="Close explanation"
                  style={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'linear-gradient(180deg, #2b3744 0%, #1b242e 100%)',
                    border: '1px solid rgba(190,200,210,0.30)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), 0 2px 6px rgba(0,0,0,0.4)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                  }}
                >
                  <X size={14} stroke="#ffffff" strokeWidth={2.5} aria-hidden="true" />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '4px' }}>
                  <div>
                    <h3 style={{
                      fontFamily: 'var(--font-brand)',
                      fontSize: '1.45rem',
                      color: 'var(--white)',
                      margin: 0,
                      lineHeight: 1.1,
                    }}>
                      Simple Explanation
                    </h3>
                    <p style={{
                      fontSize: '0.75rem',
                      color: 'var(--grey-400)',
                      margin: '2px 0 0',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontWeight: 600,
                    }}>
                      ELI5 Summary • {sanitize(c.display_name)}
                    </p>
                  </div>
                </div>

                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

                {/* Main Summary Callout Box */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderLeft: `3px solid ${primaryColor}`,
                  borderRadius: '0 8px 8px 0',
                  padding: '14px 16px',
                  fontSize: '0.95rem',
                  lineHeight: '1.65',
                  color: '#D2D7DF',
                  fontWeight: 400,
                }}>
                  {eli5Text}
                </div>

                {/* Key Research Parameters Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px',
                  background: 'rgba(255,255,255,0.01)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '10px',
                  padding: '14px',
                }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '2px', letterSpacing: '0.02em' }}>
                      Clinical Status
                    </span>
                    <span style={{ fontSize: '0.88rem', color: tierInfo.color, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: tierInfo.color }} />
                      {sanitize(tierInfo.label)}
                    </span>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '2px', letterSpacing: '0.02em' }}>
                      Safety Profile
                    </span>
                    <span style={{ fontSize: '0.88rem', color: riskInfo.color, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: riskInfo.color }} />
                      {sanitize(riskInfo.label)}
                    </span>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '2px', letterSpacing: '0.02em' }}>
                      Research Schedule (How Often)
                    </span>
                    <span style={{ fontSize: '0.88rem', color: 'var(--white)', fontWeight: 600 }}>
                      {sanitize(c.typical_frequency || 'N/A')}
                    </span>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '2px', letterSpacing: '0.02em' }}>
                      How Long It Stays Active
                    </span>
                    <span style={{ fontSize: '0.88rem', color: 'var(--white)', fontWeight: 600 }}>
                      {sanitize(c.half_life || 'N/A')}
                    </span>
                  </div>
                </div>

                {/* Studied Focus / Targets Section */}
                {c.studied_for && c.studied_for.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <h4 style={{
                      fontSize: '0.75rem',
                      color: 'var(--grey-400)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontWeight: 700,
                      margin: 0,
                    }}>
                      Primary Research Focus
                    </h4>
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                    }}>
                      {c.studied_for.map((area, idx) => (
                        <span key={idx} style={{
                          fontSize: '0.75rem',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          color: 'var(--grey-200)',
                          fontWeight: 500,
                        }}>
                          {sanitize(area)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* What It Actually Does Section */}
                {c.mechanism && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <h4 style={{
                      fontSize: '0.75rem',
                      color: 'var(--grey-400)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontWeight: 700,
                      margin: 0,
                    }}>
                      What It Actually Does (How It Works)
                    </h4>
                    <p style={{
                      fontSize: '0.85rem',
                      lineHeight: '1.5',
                      color: 'var(--grey-300)',
                      margin: 0,
                    }}>
                      {sanitize(c.mechanism)}
                    </p>
                  </div>
                )}

                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

                <button
                  type="button"
                  onClick={() => setShowEli5(false)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'linear-gradient(180deg, #2b3744 0%, #1b242e 100%)',
                    border: '1px solid #8E98A7',
                    borderRadius: '8px',
                    color: 'var(--white)',
                    fontFamily: 'var(--font-brand)',
                    fontSize: '1.05rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease, border-color 0.15s ease',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 10px rgba(0,0,0,0.3)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#ffffff';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#8E98A7';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  Understood
                </button>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Guest conversion: shown when a logged-out visitor tries a member-only
          action (e.g. saving to wishlist). Prompts sign in / create account. */}
      <GuestAuthModal
        open={guestModalFeature !== null}
        onClose={() => setGuestModalFeature(null)}
        featureLabel={guestModalFeature ?? 'This Feature'}
      />
    </div>
  );
}
