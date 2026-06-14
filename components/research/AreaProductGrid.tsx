'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { toTitleCase } from '@/lib/categoryImage';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { FlaskConical, Dna, ArrowRight, X } from 'lucide-react';
import { prewarmProxy } from '@/lib/ArticleProxyUtils';
import DynamicAddToCartButton from '../storefront/DynamicAddToCartButton';
import IframeModal from '../ui/IframeModal';
import Image from 'next/image';
import QuickViewModal from './QuickViewModal';

/* ─── Interfaces ─── */

export interface AreaProduct {
  productId: string;
  agentProductId: string | null;
  productName: string;
  compoundSlug: string;
  category: string;
  imageUrl: string;
  unitSize: string | null;
  unitMeasure: string | null;
  retailPrice: number;
  costPrice: number | null;
  weightOz: number;
  sku: string | null;
  isOnSale: boolean;
  salePrice: number | null;
  inventoryCount: number;
}

export interface CompoundInfo {
  slug: string;
  displayName: string;
  aliases: string[];
  evidenceTier: string;
  category: string | null;
  mechanism: string | null;
  halfLife: string | null;
  molecularWeightDa: number | null;
  riskLevel: string;
  riskReasons: string[];
  studiedFor: string[];
  pubmedCitationCount: number | null;
  plainSummary: string | null;
  eli5Summary?: string | null;
  benefits: string | null;
  sideEffects: string | null;
  efficacyScores: Record<string, number>;
  bestStackedWith: string[];
  typicalFrequency: string;
  purityPercentage: number;
  coaUrl: string;
  researchAreas: string[];
}

export interface Props {
  products: AreaProduct[];
  compounds: CompoundInfo[];
  agentSlug: string | null;
  isStorefrontOwner: boolean;
  isAuthenticated: boolean;
  userRole: string | null;
}

/* ─── Helpers ─── */

type SortKey =
  | 'price_low'
  | 'price_high'
  | 'name_asc'
  | 'evidence'
  | 'risk'
  | 'citations';

function tierInfo(tier: string): { label: string; color: string; rank: number } {
  switch (tier) {
    case 'approved_drug':     return { label: 'Approved Drug',      color: '#38A169', rank: 1 };
    case 'investigational':   return { label: 'Investigational',    color: '#D69E2E', rank: 2 };
    case 'preclinical':       return { label: 'Preclinical',        color: '#3182CE', rank: 3 };
    case 'research_chemical': return { label: 'Research Compound',  color: '#718096', rank: 4 };
    case 'cosmetic':          return { label: 'Cosmetic',           color: '#9F7AEA', rank: 5 };
    default:                  return { label: tier.replace(/_/g, ' '), color: '#718096', rank: 6 };
  }
}

const RISK_RANK: Record<string, number> = { low: 1, moderate: 2, high: 3, critical: 4 };
function riskRank(r: string): number { return RISK_RANK[r] ?? 5; }

function formatPrice(n: number): string { return `$${n.toFixed(2)}`; }

/* ─── Cart item type for pnl_storefront_cart ─── */
interface PnlCartItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  retailPrice: number;
  costPrice: number;
  weightOz: number;
  agentSelfBuy: boolean;
}

/* ─── Component ─── */

export default function AreaProductGrid({
  products,
  compounds,
  agentSlug,
  isStorefrontOwner,
  isAuthenticated,
}: Props) {
  /* ── Sorting & Search ── */
  const [sortBy, setSortBy] = useState<SortKey>('evidence');

  const [filterHalfLife, setFilterHalfLife] = useState(false);
  const [filterPrice, setFilterPrice] = useState(false);
  const [filterTrials, setFilterTrials] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  const [isSwipeMode, setIsSwipeMode] = useState(false);
  const [stackItems, setStackItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [cartItems, setCartItems] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [modalUrl, setModalUrl] = useState<string | null>(null);
  const [quickViewCompound, setQuickViewCompound] = useState<any | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstCartSave = useRef(true);

  const [pinnedNames, setPinnedNames] = useState<Set<string>>(new Set());

  const syncPinned = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('pnl:compare') || '[]';
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        setPinnedNames(new Set(list.map((item: any) => item.productName)));
      }
    } catch {}
  }, []);

  useEffect(() => {
    syncPinned();
    window.addEventListener('pnl:compare-changed', syncPinned);
    window.addEventListener('storage', syncPinned);
    return () => {
      window.removeEventListener('pnl:compare-changed', syncPinned);
      window.removeEventListener('storage', syncPinned);
    };
  }, [syncPinned]);

  const pin = useCallback((product: AreaProduct) => {
    if (typeof window === 'undefined') return;
    const compound = compounds.find(c => c.slug === product.compoundSlug);
    const detail = {
      productName: product.productName,
      imageUrl: product.imageUrl ?? null,
      pricePerVialDollars: product.retailPrice ?? null,
      compoundSlug: product.compoundSlug ?? null,
      evidenceTierKey: compound?.evidenceTier ?? null,
      category: product.category || null,
      pinnedAt: Date.now(),
    };
    try {
      window.dispatchEvent(new CustomEvent('pnl:compare-add', { detail }));
    } catch {}
    try {
      const raw = window.localStorage.getItem('pnl:compare') || '[]';
      let list = JSON.parse(raw);
      if (!Array.isArray(list)) list = [];
      const filtered = list.filter((x: any) => x.productName !== product.productName);
      filtered.push(detail);
      const trimmed = filtered.slice(-4);
      window.localStorage.setItem('pnl:compare', JSON.stringify(trimmed));
      window.dispatchEvent(new CustomEvent('pnl:compare-changed'));
    } catch {}
  }, [compounds]);

  const unpin = useCallback((product: AreaProduct) => {
    if (typeof window === 'undefined') return;
    try {
      window.dispatchEvent(new CustomEvent('pnl:compare-remove', { detail: { productName: product.productName } }));
    } catch {}
    try {
      const raw = window.localStorage.getItem('pnl:compare') || '[]';
      let list = JSON.parse(raw);
      if (!Array.isArray(list)) list = [];
      const filtered = list.filter((x: any) => x.productName !== product.productName);
      window.localStorage.setItem('pnl:compare', JSON.stringify(filtered));
      window.dispatchEvent(new CustomEvent('pnl:compare-changed'));
    } catch {}
  }, []);

  /* ── Load cart from localStorage on mount ── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`cart_${agentSlug}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setCartItems(parsed);
        }
      }
    } catch { /* ignore */ }
  }, [agentSlug]);

  /* ── Persist cart to localStorage ── */
  useEffect(() => {
    if (firstCartSave.current) { firstCartSave.current = false; return; }
    try {
      localStorage.setItem(`cart_${agentSlug}`, JSON.stringify(cartItems));

      // Sync to pnl_storefront_cart format for checkout compatibility
      const pnlItems: PnlCartItem[] = Object.entries(cartItems)
        .filter(([, qty]) => qty > 0)
        .map(([variantId, qty]) => {
          const p = products.find(pr => pr.agentProductId === variantId);
          if (!p) return null;
          const sizeLabel = p.unitSize
            ? `(${p.unitSize}${p.unitMeasure || ''})`
            : '';
          return {
            id: p.productId,
            name: `${p.productName} ${sizeLabel}`.trim(),
            sku: p.sku || p.productId,
            quantity: qty,
            retailPrice: p.retailPrice,
            costPrice: p.costPrice ?? p.retailPrice,
            weightOz: p.weightOz,
            agentSelfBuy: isStorefrontOwner,
          };
        })
        .filter(Boolean) as PnlCartItem[];

      localStorage.setItem(`pnl_storefront_cart_${agentSlug}`, JSON.stringify({
        items: pnlItems,
        _savedAt: Date.now(),
      }));

      // Clean other agent carts
      Object.keys(localStorage)
        .filter(k => k.startsWith('pnl_storefront_cart_') && k !== `pnl_storefront_cart_${agentSlug}`)
        .forEach(k => localStorage.removeItem(k));
      localStorage.removeItem('pnl_storefront_cart');
    } catch { /* ignore */ }
  }, [cartItems, agentSlug, products, isStorefrontOwner]);

  /* ── Toast helper ── */
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  /* ── Add to cart ── */
  const addToCart = useCallback((product: AreaProduct) => {
    if (!product.agentProductId) return;
    const key = product.agentProductId;
    setCartItems(prev => {
      const current = prev[key] || 0;
      if (current >= product.inventoryCount && product.inventoryCount > 0) {
        showToast(`Maximum Stock (${product.inventoryCount}) Reached`);
        return prev;
      }
      return { ...prev, [key]: current + 1 };
    });
    showToast(`${toTitleCase(product.productName)} Added To Cart`);
  }, [showToast]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ name?: string; handled?: boolean }>).detail;
      const name = detail?.name;
      if (!name) return;
      if (detail) detail.handled = true;
      const matched = products.find(
        (p) => p.productName.toLowerCase() === name.toLowerCase() ||
               p.compoundSlug?.toLowerCase() === name.toLowerCase()
      );
      if (matched) {
        addToCart(matched);
      }
    };
    window.addEventListener('pnl:add-to-cart-by-name', handler as EventListener);
    return () => window.removeEventListener('pnl:add-to-cart-by-name', handler as EventListener);
  }, [products, addToCart]);

  /* ── Cart total ── */
  const totalCartItems = useMemo(
    () => Object.values(cartItems).reduce((s, q) => s + q, 0),
    [cartItems],
  );



  /* ── Stack toggle ── */
  const toggleStack = useCallback((slug: string) => {
    setStackItems(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  /* ── Enrich & sort ── */
  const productsByCompound = useMemo(() => {
    const map = new Map<string, AreaProduct[]>();
    products.forEach(p => {
      if (!p.compoundSlug) return;
      if (!map.has(p.compoundSlug)) map.set(p.compoundSlug, []);
      map.get(p.compoundSlug)!.push(p);
    });
    return map;
  }, [products]);

  const enriched = useMemo(() => {
    return compounds.map(c => {
      const agentProducts = productsByCompound.get(c.slug) || [];
      const primary = agentProducts[0]; // Just use the first variant if they carry it

      return {
        compound: c,
        compoundSlug: c.slug,
        productName: primary ? primary.productName : c.displayName,
        imageUrl: primary?.imageUrl || '/images/blank_card.png',
        productId: primary?.productId || c.slug,
        agentProductId: primary?.agentProductId || '',
        retailPrice: primary?.retailPrice || 0,
        costPrice: primary?.costPrice,
        isOnSale: primary?.isOnSale || false,
        salePrice: primary?.salePrice || null,
        unitSize: primary?.unitSize || null,
        unitMeasure: primary?.unitMeasure || null,
        inventoryCount: primary?.inventoryCount || 0,
        sku: primary?.sku || '',
        category: primary?.category || c.category || 'Peptides',
        weightOz: primary?.weightOz || 0,
      };
    });
  }, [productsByCompound, compounds]);

  const sorted = useMemo(() => {
    let arr = [...enriched];


    if (filterHalfLife) {
      arr = arr.filter(a => {
        if (!a.compound?.halfLife) return false;
        const hl = a.compound.halfLife.toLowerCase();
        return hl.includes('day') || hl.includes('week') || (parseInt(hl) > 24);
      });
    }
    if (filterPrice) {
      arr = arr.filter(a => a.retailPrice > 0 && a.retailPrice < 50);
    }
    if (filterTrials) {
      arr = arr.filter(a => a.compound?.evidenceTier === 'approved_drug' || a.compound?.evidenceTier === 'investigational');
    }

    switch (sortBy) {
      case 'price_low':
        arr.sort((a, b) => a.retailPrice - b.retailPrice);
        break;
      case 'price_high':
        arr.sort((a, b) => b.retailPrice - a.retailPrice);
        break;
      case 'name_asc':
        arr.sort((a, b) => a.productName.localeCompare(b.productName));
        break;
      case 'evidence':
        arr.sort((a, b) => {
          const aR = tierInfo(a.compound?.evidenceTier ?? '').rank;
          const bR = tierInfo(b.compound?.evidenceTier ?? '').rank;
          return aR - bR;
        });
        break;
      case 'risk':
        arr.sort((a, b) => {
          const aR = riskRank(a.compound?.riskLevel ?? '');
          const bR = riskRank(b.compound?.riskLevel ?? '');
          return aR - bR;
        });
        break;
      case 'citations':
        arr.sort((a, b) => {
          const aC = a.compound?.pubmedCitationCount ?? 0;
          const bC = b.compound?.pubmedCitationCount ?? 0;
          return bC - aC;
        });
        break;
    }
    return arr;
  }, [enriched, sortBy, filterHalfLife, filterPrice, filterTrials]);




  /* ─── Not authenticated gate ─── */
  if (!isAuthenticated) {
    return (
      <div style={{ padding: '0 16px' }}>
        {/* Blurred grid preview */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 20,
          filter: 'blur(6px)',
          pointerEvents: 'none',
          userSelect: 'none',
          opacity: 0.5,
          marginBottom: 32,
        }}>
          {enriched.slice(0, 6).map(p => {
            const ti = tierInfo(p.compound?.evidenceTier ?? '');
            return (
              <div key={p.productId} style={{
                background: 'rgba(10,16,24,0.85)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                padding: 20,
                minHeight: 220,
              }}>
                <span style={{
                  display: 'inline-block',
                  padding: '4px 10px',
                  borderRadius: 20,
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  background: `${ti.color}22`,
                  color: ti.color,
                  marginBottom: 12,
                }}>{ti.label}</span>
                <p style={{ color: '#D0DAE4', fontWeight: 700, fontSize: '1rem' }}>
                  {toTitleCase(p.productName)}
                </p>
                {p.compound?.aliases?.length ? (
                  <p style={{ color: '#A8B4C0', fontSize: '0.78rem', marginTop: 4 }}>
                    <strong style={{ color: '#C0C8D0' }}>Popular Name:</strong> {p.compound.aliases.slice(0, 3).join(', ')}
                  </p>
                ) : null}
                <p style={{ color: '#718096', fontSize: '0.85rem', marginTop: 12 }}>$XX.XX</p>
              </div>
            );
          })}
        </div>
        {/* Sign-in CTA */}
        <div style={{
          position: 'relative',
          marginTop: -180,
          textAlign: 'center',
          zIndex: 10,
          paddingBottom: 48,
        }}>
          <div style={{
            background: 'rgba(10,16,24,0.92)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 20,
            padding: '40px 32px',
            maxWidth: 480,
            margin: '0 auto',
            backdropFilter: 'blur(12px)',
          }}>
            <p style={{
              color: '#FFFFFF',
              fontSize: '1.25rem',
              fontWeight: 800,
              marginBottom: 8,
              lineHeight: 1.3,
            }}>
              Sign In To View Products And Pricing
            </p>
            <p style={{ color: '#A8B4C0', fontSize: '0.9rem', marginBottom: 24 }}>
              Create A Free Account To Access Research Compounds
            </p>
            <Link href="/login" style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 48,
              padding: '0 36px',
              background: '#00C4BC',
              color: '#000000',
              fontWeight: 800,
              fontSize: '0.95rem',
              borderRadius: 12,
              textDecoration: 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'opacity 0.15s',
            }}>
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <style dangerouslySetInnerHTML={{__html: `
        .stack-card {
          content-visibility: auto;
          contain-intrinsic-size: 500px;
        }
        .stack-card::after {
          content: '';
          position: absolute;
          top: 0; left: -150%;
          width: 50%; height: 100%;
          background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0) 100%);
          transform: skewX(-25deg);
          transition: all 0.7s cubic-bezier(0.4, 0, 0.2, 1);
          pointer-events: none;
          z-index: 20;
        }
        .stack-card:hover::after {
          left: 200%;
        }
      `}} />
      {modalUrl && (
        <IframeModal url={modalUrl} onClose={() => setModalUrl(null)} />
      )}

      {/* ─── Toast ─── */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: 'rgba(0,196,188,0.95)',
          color: '#000',
          fontWeight: 700,
          fontSize: '0.88rem',
          padding: '12px 24px',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)',
          animation: 'fadeInDown 0.25s ease',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeInDown {
          from { opacity: 0; transform: translate(-50%, -12px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}} />

      {/* ─── Sort Bar ─── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 24,
        padding: '14px 18px',
        background: 'rgba(10,16,24,0.7)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14,
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{
            color: '#A8B4C0',
            fontSize: '0.85rem',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}>
            Showing {sorted.length} Compound{sorted.length !== 1 ? 's' : ''}
          </span>
          <span style={{
            color: '#00C4BC',
            fontSize: '0.75rem',
            fontWeight: 500,
          }}>
            Click The Compare Box To See The Differences Between Multiple Peptides.
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Smart Filters */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => setFilterHalfLife(!filterHalfLife)} style={{
              padding: '6px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, border: `1px solid ${filterHalfLife ? '#00C4BC' : 'rgba(255,255,255,0.1)'}`, background: filterHalfLife ? 'rgba(0,196,188,0.15)' : 'transparent', color: filterHalfLife ? '#00C4BC' : '#A8B4C0', cursor: 'pointer', transition: 'all 0.15s'
            }}>Long Half-Life</button>
            <button onClick={() => setFilterPrice(!filterPrice)} style={{
              padding: '6px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, border: `1px solid ${filterPrice ? '#00C4BC' : 'rgba(255,255,255,0.1)'}`, background: filterPrice ? 'rgba(0,196,188,0.15)' : 'transparent', color: filterPrice ? '#00C4BC' : '#A8B4C0', cursor: 'pointer', transition: 'all 0.15s'
            }}>Under $50</button>
            <button onClick={() => setFilterTrials(!filterTrials)} style={{
              padding: '6px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, border: `1px solid ${filterTrials ? '#00C4BC' : 'rgba(255,255,255,0.1)'}`, background: filterTrials ? 'rgba(0,196,188,0.15)' : 'transparent', color: filterTrials ? '#00C4BC' : '#A8B4C0', cursor: 'pointer', transition: 'all 0.15s'
            }}>Human Trials</button>
          </div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortKey)}
            style={{
              appearance: 'none',
              WebkitAppearance: 'none',
              background: 'rgba(0,0,0,0.5)',
              color: '#D0DAE4',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              padding: '10px 36px 10px 14px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none',
              minHeight: 44,
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23A8B4C0'%3E%3Cpath d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 12px center',
            }}
          >
            <option value="evidence">Evidence Tier</option>
            <option value="price_low">Price: Low to High</option>
            <option value="price_high">Price: High to Low</option>
            <option value="name_asc">Name A-Z</option>
            <option value="risk">Risk Level</option>
            <option value="citations">Most Citations</option>
          </select>

          {/* Cart badge */}
          {totalCartItems > 0 && agentSlug && (
            <Link href={`/${agentSlug}?cart=1`} style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              background: 'rgba(0,196,188,0.12)',
              border: '1px solid rgba(0,196,188,0.3)',
              borderRadius: 10,
              color: '#00C4BC',
              fontWeight: 700,
              fontSize: '0.82rem',
              textDecoration: 'none',
              minHeight: 44,
              transition: 'background 0.15s',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
              </svg>
              {totalCartItems}
            </Link>
          )}
        </div>
      </div>

      {isMobile && (
        <AnimatePresence>
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsSwipeMode(!isSwipeMode)}
            style={{
              width: '100%',
              marginBottom: 24,
              padding: '16px',
              background: isSwipeMode ? 'rgba(0,196,188,0.1)' : 'linear-gradient(45deg, #00C4BC, #00827D)',
              color: isSwipeMode ? '#00C4BC' : '#FFF',
              border: isSwipeMode ? '1px solid #00C4BC' : 'none',
              borderRadius: 12,
              fontWeight: 800,
              fontSize: '1rem',
              cursor: 'pointer',
              boxShadow: isSwipeMode ? 'none' : '0 4px 14px rgba(0,196,188,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {isSwipeMode ? 'Exit Swipe Mode' : (
              <>
                <motion.span
                  animate={{ x: [0, 5, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                  style={{ display: 'inline-flex', alignItems: 'center' }}
                >
                  <ArrowRight size={16} />
                </motion.span>
                Start Swipe Mode
              </>
            )}
          </motion.button>
        </AnimatePresence>
      )}

      {/* ─── Product Grid ─── */}
      <div style={{
        ...(isSwipeMode ? {
          display: 'flex',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          gap: 16,
          paddingBottom: 20,
          WebkitOverflowScrolling: 'touch',
        } : {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 20,
        })
      }}>
        {sorted.map((p) => {
          const compound = p.compound;
          const ti = tierInfo(compound?.evidenceTier ?? '');
          const isComparing = pinnedNames.has(p.productName);
          const inCart = p.agentProductId ? (cartItems[p.agentProductId] || 0) : 0;
          const outOfStock = p.agentProductId ? p.inventoryCount <= 0 : false;
          const displayPrice = p.isOnSale && p.salePrice != null
            ? p.salePrice
            : p.retailPrice;

          return (
            <motion.article
              key={p.productId}
              className="glass-panel stack-card"
              whileHover={{ y: -6, scale: 1.02, boxShadow: '0 20px 40px rgba(0,0,0,0.6), inset 0 2px 10px rgba(255,255,255,0.4)' }}
              style={{
                minWidth: isSwipeMode ? '85vw' : 'auto',
                scrollSnapAlign: isSwipeMode ? 'center' : 'none',
                padding: 4,
                overflow: 'hidden',
                position: 'relative',
                cursor: 'pointer',
                background: isComparing ? '#00E5FF' : 'linear-gradient(135deg, #e0e5ec 0%, #88929c 25%, #e0e5ec 50%, #a3b1c6 75%, #f0f4f8 100%)',
                borderRadius: 24,
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                border: 'none',
                contentVisibility: 'auto',
                containIntrinsicSize: '500px'
              }}
              onClick={() => {
                if (compound) {
                  setQuickViewCompound({
                    ...compound,
                    display_name: compound.displayName,
                    evidence_tier: compound.evidenceTier,
                    plain_summary: compound.plainSummary,
                    eli5_summary: compound.eli5Summary,
                    typical_frequency: compound.typicalFrequency,
                    handling: { form: 'Vial' },
                    _imageUrl: p.imageUrl,
                    _price: p.agentProductId ? (p.isOnSale && p.salePrice != null ? p.salePrice : p.retailPrice) : null,
                  });
                }
              }}
            >
              <div style={{ background: 'linear-gradient(145deg, #1A1F26 0%, #0F1318 100%)', borderRadius: 20, height: '100%', position: 'relative', overflow: 'hidden', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column' }}>
                
                {/* Out Of Stock Badge */}
                {outOfStock && (
                  <div style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255, 60, 60, 0.9)', color: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 800, zIndex: 10, backdropFilter: 'blur(10px)', boxShadow: '0 4px 12px rgba(255, 60, 60, 0.4)' }}>
                    OUT OF STOCK
                  </div>
                )}

                {/* Compare Checkbox */}
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isComparing) unpin(p);
                    else {
                      if (pinnedNames.size >= 4) {
                        showToast('You can compare up to 4 compounds at a time.');
                        return;
                      }
                      try {
                        const raw = window.localStorage.getItem('pnl:compare') || '[]';
                        const list = JSON.parse(raw);
                        if (Array.isArray(list) && list.length > 0) {
                          const firstItem = list[0];
                          const firstCategory = firstItem.category;
                          if (firstCategory && firstCategory !== p.category) {
                            showToast(`You can only compare peptides within the same category ("${firstCategory}").`);
                            return;
                          }
                        }
                      } catch {}
                      pin(p);
                    }
                  }}
                  style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, width: 24, height: 24, borderRadius: 6, border: isComparing ? 'none' : '1px solid rgba(255,255,255,0.2)', background: isComparing ? '#00E5FF' : 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  {isComparing && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                </div>

                {/* Title Block */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20, paddingLeft: 36 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{ margin: 0, color: '#E2E8F0', fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.01em', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {toTitleCase(p.productName)}
                    </h2>
                    {compound?.aliases?.length ? (
                      <div style={{ fontSize: '0.75rem', color: '#A8B4C0', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <strong style={{ color: '#C0C8D0' }}>Popular Name:</strong> {compound.aliases.slice(0, 3).join(', ')}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#E2E8F0', whiteSpace: 'nowrap' }}>
                      {p.agentProductId ? formatPrice(displayPrice) : '-'}
                    </div>
                    {p.agentProductId && p.isOnSale && p.salePrice != null && (
                      <div style={{ fontSize: '0.8rem', color: '#718096', textDecoration: 'line-through', marginTop: 2 }}>
                        {formatPrice(p.retailPrice)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Image Cluster (Single Image) */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20, width: '100%' }}>
                  <div style={{ 
                    flex: '1 1 0', minWidth: 60, maxWidth: 140,
                    position: 'relative',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
                  }}>
                    <div style={{
                      width: '100%', aspectRatio: '1 / 1.2',
                      borderRadius: 16, 
                      background: '#0F1318',
                      border: '2px solid rgba(255,255,255,0.2)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden', padding: 0,
                      position: 'relative'
                    }}>
                      <Image src={p.imageUrl} alt={p.productName} width={200} height={200} unoptimized style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        padding: '32px 4px 4px',
                        background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.8) 50%, #000 100%)',
                        color: '#C0C8D0', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase',
                        textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>
                        {toTitleCase(p.productName)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description (ELI5) */}
                {(compound?.eli5Summary || compound?.plainSummary) && (
                  <p style={{ margin: 'var(--space-3) 0 0', color: '#D0DAE4', lineHeight: 1.55, fontSize: '0.9rem', flex: 1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {compound.eli5Summary || compound.plainSummary}
                  </p>
                )}

                {/* Cross-Over Discovery Tags */}
                {compound?.researchAreas && compound.researchAreas.length > 0 && (
                  <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                    {compound.researchAreas.map(ra => (
                      <span key={ra} style={{
                        padding: '3px 8px',
                        borderRadius: 12,
                        background: 'rgba(255,255,255,0.05)',
                        color: '#A8B4C0',
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        textTransform: 'capitalize',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <Dna size={10} /> {ra.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}

                {/* Add To Cart Button Centered */}
                <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
                  {outOfStock ? (
                    <button
                      disabled
                      style={{
                        height: 60,
                        width: '100%',
                        background: 'rgba(255,255,255,0.06)',
                        color: '#718096',
                        border: 'none',
                        borderRadius: 10,
                        fontWeight: 800,
                        fontSize: '0.88rem',
                        cursor: 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      Out Of Stock
                    </button>
                  ) : !p.agentProductId ? (
                    <button
                      disabled
                      style={{
                        height: 60,
                        width: '100%',
                        background: 'rgba(255,255,255,0.06)',
                        color: '#718096',
                        border: 'none',
                        borderRadius: 10,
                        fontWeight: 800,
                        fontSize: '0.88rem',
                        cursor: 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      Not Carried
                    </button>
                  ) : (
                    <div onClick={e => e.stopPropagation()} style={{ width: '100%' }}>
                      <DynamicAddToCartButton
                        onClick={() => addToCart(p)}
                        pendingQty={inCart}
                        style={{ height: 60, width: '100%' }}
                      />
                    </div>
                  )}
                </div>

              </div>
            </motion.article>
          );
        })}
      </div>

      {/* ─── Empty state ─── */}
      {sorted.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '64px 24px',
          color: '#A8B4C0',
        }}>
          <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 8 }}>
            No Products Found
          </p>
          <p style={{ fontSize: '0.88rem', color: '#718096' }}>
            Products For This Research Area Are Coming Soon
          </p>
        </div>
      )}

      {/* Comparison Drawer is rendered at the layout level via StorefrontCompareDrawer */}

      <QuickViewModal
        isOpen={!!quickViewCompound}
        compound={quickViewCompound}
        imageUrl={quickViewCompound?._imageUrl}
        price={quickViewCompound?._price}
        onClose={() => setQuickViewCompound(null)}
      />

      {/* Stack Builder Sticky Banner */}
      {stackItems.size > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: 'rgba(10,16,24,0.95)',
          border: '1px solid rgba(0,196,188,0.3)',
          borderRadius: 16,
          padding: 20,
          width: 320,
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(12px)',
          zIndex: 999
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, color: '#FFF', fontSize: '1.1rem', fontWeight: 800 }}>Stack Builder</h3>
            <button onClick={() => setStackItems(new Set())} style={{ background: 'none', border: 'none', color: '#A8B4C0', cursor: 'pointer', padding: 0, fontSize: '0.8rem', fontWeight: 600 }}>Clear</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16, maxHeight: 200, overflowY: 'auto' }}>
            {Array.from(stackItems).map(id => {
              const p = products.find(pr => pr.agentProductId === id);
              if (!p) return null;
              return (
                <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <span style={{ color: '#D0DAE4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>{toTitleCase(p.productName)}</span>
                  <span style={{ color: '#00C4BC', fontWeight: 700 }}>{formatPrice(p.retailPrice)}</span>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => {
              stackItems.forEach(id => {
                const p = products.find(pr => pr.agentProductId === id);
                if (p) addToCart(p);
              });
              showToast('Stack Bundle Added To Cart');
              setStackItems(new Set());
            }}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              filter: 'drop-shadow(0 4px 15px rgba(0,229,255,0.3))'
            }}
          >
            <Image src="/images/add_stack_to_cart_btn.png" alt="Add Stack to Cart" width={200} height={48} unoptimized style={{ height: 48, objectFit: 'contain' }} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Comparison table helpers ─── */

const compareTdStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '16px 14px',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
  borderLeft: '1px solid rgba(255,255,255,0.03)',
  color: '#D0DAE4',
  verticalAlign: 'middle',
  background: 'rgba(255,255,255,0.01)',
};

const compareLabelTdStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '16px 14px',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
  color: '#A8B4C0',
  fontWeight: 700,
  fontSize: '0.82rem',
  whiteSpace: 'nowrap',
  position: 'sticky' as const,
  left: 0,
  background: '#0F1923',
  zIndex: 1,
};

function CompareRow({
  label,
  children,
  diffableValues,
  showDiffsOnly,
}: {
  label: string;
  children: React.ReactNode;
  diffableValues?: unknown[];
  showDiffsOnly?: boolean;
}) {
  if (showDiffsOnly && diffableValues && diffableValues.length > 1) {
    const first = JSON.stringify(diffableValues[0]);
    const allSame = diffableValues.every(v => JSON.stringify(v) === first);
    if (allSame) return null;
  }
  return (
    <tr>
      <td style={compareLabelTdStyle}>{label}</td>
      {children}
    </tr>
  );
}
