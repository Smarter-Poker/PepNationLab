'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { toTitleCase } from '@/lib/categoryImage';

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
  wadaStatus: string;
  category: string | null;
  mechanism: string | null;
  halfLife: string | null;
  molecularWeightDa: number | null;
  riskLevel: string;
  riskReasons: string[];
  studiedFor: string[];
  pubmedCitationCount: number | null;
}

interface Props {
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
  userRole,
}: Props) {
  /* ── Compound lookup ── */
  const compoundMap = useMemo(() => {
    const m = new Map<string, CompoundInfo>();
    compounds.forEach(c => m.set(c.slug, c));
    return m;
  }, [compounds]);

  /* ── State ── */
  const [sortBy, setSortBy] = useState<SortKey>('evidence');
  const [compareSet, setCompareSet] = useState<Set<string>>(new Set());
  const [showCompare, setShowCompare] = useState(false);
  const [cartItems, setCartItems] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstCartSave = useRef(true);

  /* ── Load cart from localStorage on mount ── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`cart_${agentSlug}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') setCartItems(parsed);
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

  /* ── Cart total ── */
  const totalCartItems = useMemo(
    () => Object.values(cartItems).reduce((s, q) => s + q, 0),
    [cartItems],
  );

  /* ── Compare toggle ── */
  const toggleCompare = useCallback((slug: string) => {
    setCompareSet(prev => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else if (next.size < 4) {
        next.add(slug);
      }
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
        productName: primary ? primary.name : c.display_name,
        imageUrl: primary?.imageUrl || '/images/blank_card.png',
        productId: primary?.masterId || c.slug,
        agentProductId: primary?.agentProductId || '',
        retailPrice: primary?.retailPrice || 0,
        costPrice: primary?.costPrice,
        isOnSale: primary?.isOnSale || false,
        salePrice: primary?.salePrice || null,
        unitSize: primary?.unitSize || null,
        unitMeasure: primary?.unitMeasure || null,
        inventoryCount: primary?.inventoryCount || 0,
        sku: primary?.sku || '',
      };
    });
  }, [productsByCompound, compounds]);

  const sorted = useMemo(() => {
    const arr = [...enriched];
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
  }, [enriched, sortBy]);

  /* ── Comparison data ── */
  const compareItems = useMemo(() => {
    const selectedCompounds = sorted.filter(p => compareSet.has(p.compoundSlug));
    if (selectedCompounds.length === 0) return [];

    // The first item added to comparison dictates the target mg
    const referenceSlug = Array.from(compareSet)[0];
    const referenceItem = selectedCompounds.find(c => c.compoundSlug === referenceSlug);
    const targetMg = referenceItem?.unitSize || 10;

    return selectedCompounds.map(base => {
      const allVariants = productsByCompound.get(base.compoundSlug) || [];
      if (allVariants.length === 0) return base; // not carried

      let closestVariant = allVariants[0];
      let minDiff = Infinity;
      for (const v of allVariants) {
        if (v.unitSize != null) {
          const diff = Math.abs(v.unitSize - targetMg);
          if (diff < minDiff) {
            minDiff = diff;
            closestVariant = v;
          }
        }
      }

      return {
        ...base,
        productName: closestVariant.name,
        imageUrl: closestVariant.imageUrl || base.imageUrl,
        productId: closestVariant.masterId,
        agentProductId: closestVariant.agentProductId,
        retailPrice: closestVariant.retailPrice,
        costPrice: closestVariant.costPrice,
        isOnSale: closestVariant.isOnSale,
        salePrice: closestVariant.salePrice,
        unitSize: closestVariant.unitSize,
        unitMeasure: closestVariant.unitMeasure,
        inventoryCount: closestVariant.inventoryCount,
        sku: closestVariant.sku,
      };
    });
  }, [sorted, compareSet, productsByCompound]);

  const bestValueSlug = useMemo(() => {
    if (compareItems.length < 2) return null;
    let min = Infinity;
    let slug = '';
    compareItems.forEach(p => { if (p.retailPrice < min) { min = p.retailPrice; slug = p.compoundSlug; } });
    return slug;
  }, [compareItems]);

  const mostStudiedSlug = useMemo(() => {
    if (compareItems.length < 2) return null;
    let max = -1;
    let slug = '';
    compareItems.forEach(p => {
      const c = p.compound?.pubmedCitationCount ?? 0;
      if (c > max) { max = c; slug = p.compoundSlug; }
    });
    return max > 0 ? slug : null;
  }, [compareItems]);


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
                    {p.compound.aliases.slice(0, 2).join(', ')}
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
            <option value="price_low">Price: Low → High</option>
            <option value="price_high">Price: High → Low</option>
            <option value="name_asc">Name A–Z</option>
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

      {/* ─── Product Grid ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: 20,
      }}>
        {sorted.map((p) => {
          const compound = p.compound;
          const ti = tierInfo(compound?.evidenceTier ?? '');
          const isComparing = compareSet.has(p.compoundSlug);
          const inCart = p.agentProductId ? (cartItems[p.agentProductId] || 0) : 0;
          const outOfStock = p.agentProductId ? p.inventoryCount <= 0 : false;
          const displayPrice = isStorefrontOwner && p.costPrice != null
            ? p.costPrice
            : p.isOnSale && p.salePrice != null
              ? p.salePrice
              : p.retailPrice;

          return (
            <div
              key={p.productId}
              style={{
                background: 'rgba(10,16,24,0.85)',
                border: isComparing
                  ? '1px solid rgba(0,196,188,0.4)'
                  : '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                overflow: 'hidden',
                transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                cursor: 'default',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 40px rgba(0,0,0,0.4)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
              }}
            >
              {/* Image area */}
              <div style={{
                position: 'relative',
                height: 180,
                background: 'radial-gradient(ellipse at 50% 40%, rgba(20,30,50,0.9) 0%, rgba(5,7,10,1) 80%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.imageUrl}
                  alt={p.productName}
                  width={140}
                  height={140}
                  loading="lazy"
                  style={{
                    objectFit: 'contain',
                    maxHeight: 140,
                    maxWidth: 140,
                    filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.5))',
                  }}
                />

                {/* Evidence tier badge */}
                <span style={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '4px 10px',
                  borderRadius: 20,
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  background: `${ti.color}20`,
                  color: ti.color,
                  border: `1px solid ${ti.color}40`,
                  backdropFilter: 'blur(6px)',
                }}>
                  {ti.label}
                </span>

                {/* WADA badge */}
                {compound?.wadaStatus === 'prohibited' && (
                  <span style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '4px 8px',
                    borderRadius: 20,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    background: 'rgba(229,62,62,0.15)',
                    color: '#FC8181',
                    border: '1px solid rgba(229,62,62,0.3)',
                    backdropFilter: 'blur(6px)',
                  }}>
                    WADA
                  </span>
                )}

                {/* On sale badge */}
                {p.isOnSale && p.salePrice != null && (
                  <span style={{
                    position: 'absolute',
                    bottom: 12,
                    right: 12,
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '3px 8px',
                    borderRadius: 20,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    background: 'rgba(0,196,188,0.15)',
                    color: '#00C4BC',
                    border: '1px solid rgba(0,196,188,0.3)',
                  }}>
                    Sale
                  </span>
                )}
              </div>

              {/* Card body */}
              <div style={{
                padding: '16px 18px 10px',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
              }}>
                {/* Product name */}
                <h3 style={{
                  color: '#FFFFFF',
                  fontSize: '1rem',
                  fontWeight: 700,
                  margin: '0 0 4px',
                  lineHeight: 1.3,
                }}>
                  {toTitleCase(p.productName)}
                </h3>

                {/* Aliases */}
                {compound?.aliases?.length ? (
                  <p style={{
                    color: '#A8B4C0',
                    fontSize: '0.75rem',
                    margin: '0 0 10px',
                    lineHeight: 1.4,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}>
                    {compound.aliases.slice(0, 3).join(' · ')}
                  </p>
                ) : <div style={{ marginBottom: 10 }} />}

                {/* Unit size + price line */}
                <div style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 6,
                  marginBottom: 6,
                }}>
                  {p.unitSize && (
                    <span style={{
                      color: '#00C4BC',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                    }}>
                      {p.unitSize}{p.unitMeasure || ''}
                    </span>
                  )}
                  <span style={{
                    color: '#00C4BC',
                    fontSize: '1.05rem',
                    fontWeight: 800,
                  }}>
                    {p.agentProductId ? (isStorefrontOwner ? `Cost ${formatPrice(displayPrice)}` : formatPrice(displayPrice)) : '—'}
                  </span>
                  {p.agentProductId && p.isOnSale && p.salePrice != null && !isStorefrontOwner && (
                    <span style={{
                      color: '#718096',
                      fontSize: '0.8rem',
                      textDecoration: 'line-through',
                    }}>
                      {formatPrice(p.retailPrice)}
                    </span>
                  )}
                </div>

                {/* Risk + citations row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 12,
                  flexWrap: 'wrap',
                }}>
                  {compound?.riskLevel && (
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      color: compound.riskLevel === 'low' ? '#68D391'
                        : compound.riskLevel === 'moderate' ? '#F6E05E'
                        : compound.riskLevel === 'high' ? '#FC8181'
                        : '#FF6B6B',
                      textTransform: 'capitalize',
                    }}>
                      {compound.riskLevel} Risk
                    </span>
                  )}
                  {compound?.pubmedCitationCount != null && compound.pubmedCitationCount > 0 && (
                    <span style={{
                      fontSize: '0.7rem',
                      color: '#A8B4C0',
                      fontWeight: 500,
                    }}>
                      {compound.pubmedCitationCount.toLocaleString()} Citations
                    </span>
                  )}
                </div>

                {/* Stock indicator */}
                {outOfStock && (
                  <p style={{
                    color: '#FC8181',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    margin: '0 0 8px',
                  }}>
                    Out Of Stock
                  </p>
                )}

                <div style={{ flex: 1 }} />

                {/* Add to cart button */}
                <button
                  onClick={() => addToCart(p)}
                  disabled={outOfStock || !p.agentProductId}
                  style={{
                    width: '100%',
                    height: 44,
                    background: outOfStock || !p.agentProductId
                      ? 'rgba(255,255,255,0.06)'
                      : '#00C4BC',
                    color: outOfStock || !p.agentProductId
                      ? '#718096'
                      : '#000000',
                    border: 'none',
                    borderRadius: 10,
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    cursor: outOfStock || !p.agentProductId ? 'not-allowed' : 'pointer',
                    transition: 'opacity 0.15s, transform 0.1s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    marginBottom: 10,
                  }}
                  onMouseEnter={e => {
                    if (!outOfStock && p.agentProductId) {
                      (e.currentTarget as HTMLButtonElement).style.opacity = '0.88';
                    }
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.opacity = '1';
                  }}
                >
                  {outOfStock ? 'Out Of Stock' : !p.agentProductId ? 'Not Carried' : (
                    <>
                      Add To Cart
                      {inCart > 0 && (
                        <span style={{
                          background: 'rgba(0,0,0,0.2)',
                          borderRadius: 8,
                          padding: '2px 7px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                        }}>
                          {inCart}
                        </span>
                      )}
                    </>
                  )}
                </button>

                {/* Compare checkbox */}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    padding: '6px 0 4px',
                    minHeight: 44,
                    userSelect: 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isComparing}
                    onChange={() => toggleCompare(p.compoundSlug)}
                    disabled={!isComparing && compareSet.size >= 4}
                    style={{
                      width: 18,
                      height: 18,
                      accentColor: '#00C4BC',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{
                    color: isComparing ? '#00C4BC' : '#718096',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    transition: 'color 0.15s',
                  }}>
                    Compare
                  </span>
                </label>
              </div>
            </div>
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

      {/* ─── Sticky comparison bar ─── */}
      {compareSet.size >= 2 && !showCompare && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          padding: '0 16px',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
          background: 'linear-gradient(to top, rgba(5,7,10,0.98) 60%, transparent)',
          animation: 'fadeInUp 0.25s ease',
        }}>
          <div style={{
            maxWidth: 600,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 20px',
            background: 'rgba(10,16,24,0.95)',
            border: '1px solid rgba(0,196,188,0.3)',
            borderRadius: 16,
            backdropFilter: 'blur(12px)',
          }}>
            <span style={{
              color: '#D0DAE4',
              fontSize: '0.88rem',
              fontWeight: 600,
              flex: 1,
            }}>
              {compareSet.size} Selected
            </span>
            <button
              onClick={() => setShowCompare(true)}
              style={{
                height: 44,
                padding: '0 24px',
                background: '#00C4BC',
                color: '#000',
                border: 'none',
                borderRadius: 10,
                fontWeight: 800,
                fontSize: '0.88rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Compare {compareSet.size} Compounds
            </button>
            <button
              onClick={() => setCompareSet(new Set())}
              style={{
                height: 44,
                width: 44,
                minWidth: 44,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                color: '#A8B4C0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
                flexShrink: 0,
              }}
              aria-label="Clear comparison"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ─── Comparison Modal ─── */}
      {showCompare && compareItems.length >= 2 && (
        <div
          onClick={() => setShowCompare(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            background: 'rgba(0,0,0,0.88)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              height: '100dvh',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              background: 'linear-gradient(180deg, #0F1923 0%, #0A1018 100%)',
              animation: 'fadeIn 0.3s ease',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Modal header */}
            <div style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              position: 'sticky',
              top: 0,
              zIndex: 5,
              background: 'linear-gradient(180deg, #0F1923 0%, rgba(15,25,35,0.95) 100%)',
              backdropFilter: 'blur(8px)',
            }}>
              <h2 style={{
                color: '#FFFFFF',
                fontSize: '1.4rem',
                fontWeight: 800,
                margin: 0,
              }}>
                Compare Compounds
              </h2>
              <button
                onClick={() => setShowCompare(false)}
                style={{
                  width: 44,
                  height: 44,
                  minWidth: 44,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  color: '#A8B4C0',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem',
                  flexShrink: 0,
                }}
                aria-label="Close comparison"
              >
                ✕
              </button>
            </div>

            {/* Comparison table */}
            <div style={{ padding: '24px 12px 40px', overflowX: 'auto', flex: 1 }}>
              <table style={{
                width: '100%',
                borderCollapse: 'separate',
                borderSpacing: 0,
                fontSize: '0.82rem',
              }}>
                <thead>
                  <tr>
                    <th style={{
                      textAlign: 'left',
                      padding: '12px 14px',
                      color: '#718096',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      position: 'sticky',
                      left: 0,
                      background: '#0F1923',
                      zIndex: 2,
                      minWidth: 120,
                    }}>
                      Attribute
                    </th>
                    {compareItems.map(p => {
                      const isBestVal = bestValueSlug === p.compoundSlug;
                      const isMostStudied = mostStudiedSlug === p.compoundSlug;
                      return (
                        <th key={p.productId} style={{
                          textAlign: 'center',
                          padding: '16px 14px',
                          color: '#FFFFFF',
                          fontWeight: 700,
                          fontSize: '1rem',
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                          borderLeft: '1px solid rgba(255,255,255,0.06)',
                          minWidth: 200,
                          background: 'rgba(255,255,255,0.01)',
                        }}>
                          <div style={{ marginBottom: 12, fontSize: '1.1rem' }}>{toTitleCase(p.productName)}</div>
                          {p.imageUrl && (
                            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
                              <img src={p.imageUrl} alt={p.productName} style={{ width: 120, height: 120, objectFit: 'contain', borderRadius: 8, background: '#fff' }} />
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 8 }}>
                            {isBestVal && (
                              <span style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: 10,
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                background: 'rgba(0,196,188,0.15)',
                                color: '#00C4BC',
                                border: '1px solid rgba(0,196,188,0.3)',
                              }}>Best Value</span>
                            )}
                            {isMostStudied && (
                              <span style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: 10,
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                background: 'rgba(214,158,46,0.15)',
                                color: '#D69E2E',
                                border: '1px solid rgba(214,158,46,0.3)',
                              }}>Most Studied</span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {/* Price */}
                  <CompareRow label="Price">
                    {compareItems.map(p => {
                      const price = isStorefrontOwner && p.costPrice != null
                        ? p.costPrice : p.retailPrice;
                      const pricePerMg = p.unitSize && p.unitSize > 0 ? price / p.unitSize : null;
                      return (
                        <td key={p.productId} style={compareTdStyle}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <div>
                              <span style={{ color: '#00C4BC', fontWeight: 800, fontSize: '1.05rem' }}>
                                {formatPrice(price)}
                              </span>
                              {p.unitSize && (
                                <span style={{ color: '#718096', fontSize: '0.8rem', marginLeft: 4 }}>
                                  / {p.unitSize}{p.unitMeasure || ''}
                                </span>
                              )}
                            </div>
                            {pricePerMg != null && (
                              <span style={{ color: '#A8B4C0', fontSize: '0.75rem', fontWeight: 600 }}>
                                {formatPrice(pricePerMg)} / mg
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </CompareRow>

                  {/* Evidence Tier */}
                  <CompareRow label="Evidence Tier">
                    {compareItems.map(p => {
                      const ti = tierInfo(p.compound?.evidenceTier ?? '');
                      return (
                        <td key={p.productId} style={compareTdStyle}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 9px',
                            borderRadius: 16,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: `${ti.color}20`,
                            color: ti.color,
                          }}>
                            {ti.label}
                          </span>
                        </td>
                      );
                    })}
                  </CompareRow>

                  {/* Risk Level */}
                  <CompareRow label="Risk Level">
                    {compareItems.map(p => {
                      const risk = p.compound?.riskLevel ?? '—';
                      const color = risk === 'low' ? '#68D391'
                        : risk === 'moderate' ? '#F6E05E'
                        : risk === 'high' ? '#FC8181'
                        : risk === 'critical' ? '#FF6B6B'
                        : '#A8B4C0';
                      return (
                        <td key={p.productId} style={compareTdStyle}>
                          <button
                            onClick={() => alert(p.compound?.riskReasons?.length ? p.compound.riskReasons.join('\\n') : 'No additional risk data available.')}
                            title="Click to view risk reasons"
                            style={{ 
                              color, 
                              fontWeight: 700, 
                              textTransform: 'capitalize',
                              background: 'none',
                              border: 'none',
                              borderBottom: `1px dashed ${color}`,
                              cursor: 'pointer',
                              padding: 0,
                              fontSize: '0.95rem'
                            }}
                          >
                            {risk}
                          </button>
                        </td>
                      );
                    })}
                  </CompareRow>

                  {/* Half-Life */}
                  <CompareRow label="Half-Life">
                    {compareItems.map(p => (
                      <td key={p.productId} style={compareTdStyle}>
                        <span style={{ color: '#D0DAE4', fontWeight: 600 }}>
                          {p.compound?.halfLife || '—'}
                        </span>
                      </td>
                    ))}
                  </CompareRow>

                  {/* Molecular Weight */}
                  <CompareRow label="Molecular Weight">
                    {compareItems.map(p => (
                      <td key={p.productId} style={compareTdStyle}>
                        <span style={{ color: '#D0DAE4' }}>
                          {p.compound?.molecularWeightDa
                            ? `${p.compound.molecularWeightDa.toLocaleString()} Da`
                            : '—'}
                        </span>
                      </td>
                    ))}
                  </CompareRow>

                  {/* Category */}
                  <CompareRow label="Category">
                    {compareItems.map(p => (
                      <td key={p.productId} style={compareTdStyle}>
                        <span style={{ color: '#D0DAE4', textTransform: 'capitalize' }}>
                          {p.compound?.category ? p.compound.category.replace(/_/g, ' ') : '—'}
                        </span>
                      </td>
                    ))}
                  </CompareRow>

                  {/* Other Names */}
                  <CompareRow label="Other Names">
                    {compareItems.map(p => (
                      <td key={p.productId} style={compareTdStyle}>
                        <span style={{ color: '#D0DAE4', fontSize: '0.85rem' }}>
                          {p.compound?.aliases && p.compound.aliases.length > 0
                            ? p.compound.aliases.join(', ')
                            : '—'}
                        </span>
                      </td>
                    ))}
                  </CompareRow>

                  {/* Mechanism */}
                  <CompareRow label="Mechanism">
                    {compareItems.map(p => (
                      <td key={p.productId} style={{ ...compareTdStyle, maxWidth: 220 }}>
                        <span style={{
                          color: '#D0DAE4',
                          fontSize: '0.82rem',
                          lineHeight: 1.5,
                          display: 'block',
                        }}>
                          {p.compound?.mechanism || '—'}
                        </span>
                      </td>
                    ))}
                  </CompareRow>

                  {/* Key Research Uses */}
                  <CompareRow label="Key Research Uses">
                    {compareItems.map(p => (
                      <td key={p.productId} style={{ ...compareTdStyle, verticalAlign: 'top', textAlign: 'left' }}>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: 6,
                        }}>
                          {(p.compound?.studiedFor ?? []).length > 0
                            ? p.compound!.studiedFor.map((use, i) => (
                              <span key={i} style={{
                                display: 'inline-block',
                                padding: '3px 10px',
                                borderRadius: 8,
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                background: 'rgba(255,255,255,0.05)',
                                color: '#D0DAE4',
                                border: '1px solid rgba(255,255,255,0.08)',
                                textTransform: 'capitalize'
                              }}>
                                {use}
                              </span>
                            ))
                            : <span style={{ color: '#718096' }}>—</span>
                          }
                        </div>
                      </td>
                    ))}
                  </CompareRow>

                  {/* Citations */}
                  <CompareRow label="PubMed Citations">
                    {compareItems.map(p => (
                      <td key={p.productId} style={compareTdStyle}>
                        <span style={{ color: '#D0DAE4', fontWeight: 600 }}>
                          {p.compound?.pubmedCitationCount != null
                            ? p.compound.pubmedCitationCount.toLocaleString()
                            : '—'}
                        </span>
                      </td>
                    ))}
                  </CompareRow>

                  {/* Action row */}
                  <CompareRow label="">
                    {compareItems.map(p => {
                      const outOfStock = !p.agentProductId || p.inventoryCount === 0;
                      return (
                        <td key={p.productId} style={{ ...compareTdStyle, borderBottom: 'none', paddingTop: 24 }}>
                          <button
                            onClick={() => addToCart(p)}
                            disabled={outOfStock}
                            style={{
                              width: '100%',
                              maxWidth: 180,
                              height: 44,
                              background: outOfStock ? 'rgba(255,255,255,0.05)' : '#00C4BC',
                              color: outOfStock ? '#718096' : '#000',
                              border: 'none',
                              borderRadius: 10,
                              fontWeight: 800,
                              fontSize: '0.88rem',
                              cursor: outOfStock ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s',
                            }}
                          >
                            {outOfStock ? 'Out Of Stock' : !p.agentProductId ? 'Not Carried' : 'Add To Cart'}
                          </button>
                        </td>
                      );
                    })}
                  </CompareRow>
                </tbody>
              </table>
            </div>
          </div>
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
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td style={compareLabelTdStyle}>{label}</td>
      {children}
    </tr>
  );
}
