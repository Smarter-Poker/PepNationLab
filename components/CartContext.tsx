'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { getProductImage } from '@/lib/categoryImage';
import DynamicAddToCartButton from '@/components/storefront/DynamicAddToCartButton';
import DynamicCartButton from '@/components/storefront/DynamicCartButton';

// Types

export interface CartItem {
  id: string;
  /**
   * The underlying products.id, when known. `id` itself may be an agent_product
   * id (by-name / mobile path) OR a product id (storefront / reorder), so this
   * is the stable cross-path key used for dedup and line merging.
   */
  productId?: string | null;
  name: string;
  sku: string;
  quantity: number;
  retailPrice: number;
  costPrice: number;
  bulkCostPrice?: number | null;
  bulkThreshold?: number;
  weightOz: number;
  agentSelfBuy?: boolean;
  bundleName?: string;
}

export interface SmartRec {
  id: string;
  name: string;
  slug: string | null;
  category: string | null;
  image_url: string | null;
  retail_price?: number;
  unit_size: string | null;
  unit_measure: string | null;
  reason?: string;
}

interface BacWaterResult {
  vialsNeeded: number;
  totalMlNeeded: number;
  peptideCount: number;
  totalPeptideVials: number;
  bacWaterProduct: SmartRec | null;
  alreadyInCart: boolean;
  alreadyInCartQty: number;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  addMultipleToCart: (items: { product: Omit<CartItem, 'quantity'>, quantity: number }[], bundleName?: string) => void;
  removeFromCart: (productId: string, bundleName?: string) => void;
  updateQuantity: (productId: string, quantity: number, bundleName?: string) => void;
  clearCart: () => void;
  cartCount: number;
  cartSubtotal: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const DISCLAIMER_VERSION = process.env.NEXT_PUBLIC_DISCLAIMER_VERSION || 'v1.0';
const ADD_TO_CART_ACK_KEY = `pnl_addtocart_${DISCLAIMER_VERSION}`;

interface PendingAddition {
  product: Omit<CartItem, 'quantity'>;
  quantity: number;
}

// CartProvider

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [addToCartAcknowledged, setAddToCartAcknowledged] = useState(false);
  const [pendingAddition, setPendingAddition] = useState<PendingAddition | null>(null);
  const lastRefreshRef = useRef<number>(0);
  const refreshInflightRef = useRef<boolean>(false);

  const refreshCartPricing = useCallback(
    async (items: CartItem[], force = false): Promise<CartItem[]> => {
      if (items.length === 0) return items;
      if (refreshInflightRef.current) return items;
      const now = Date.now();
      if (!force && now - lastRefreshRef.current < 60_000) return items;
      refreshInflightRef.current = true;
      try {
        const res = await fetch('/api/cart/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productIds: items.map(i => i.id) }),
        });
        if (!res.ok) return items;
        const data = (await res.json()) as {
          items: Array<{
            id: string;
            productId?: string | null;
            name: string | null;
            retailPrice: number;
            bulkCostPrice: number | null;
            bulkThreshold: number | null;
            available: boolean;
          }>;
          missing: string[];
        };
        lastRefreshRef.current = now;
        const next: CartItem[] = [];
        const removed: string[] = [];
        for (const item of items) {
          // Cart items may be keyed by agent_product id (by-name / quick-add)
          // or product_id (reorder / research catalog). The refresh API resolves
          // both, so match on either identifier to avoid false "Item Removed".
          const fresh = data.items.find(d => d.id === item.id || d.productId === item.id);
          if (!fresh) { if (data.missing?.includes(item.id)) removed.push(item.name); continue; }
          if (!fresh.available) { removed.push(fresh.name ?? item.name); continue; }
          next.push({
            ...item,
            productId: fresh.productId ?? item.productId,
            costPrice: fresh.retailPrice,
            retailPrice: fresh.retailPrice,
            bulkCostPrice: fresh.bulkCostPrice,
            bulkThreshold: fresh.bulkThreshold != null ? fresh.bulkThreshold : item.bulkThreshold,
          });
        }
        for (const name of removed) {
          try { toast.error(`Item Removed: ${name} Is No Longer Available`); } catch { /* ignore */ }
        }
        return next;
      } finally {
        refreshInflightRef.current = false;
      }
    },
    []
  );

  // Hydrate from localStorage
  useEffect(() => {
    let initial: CartItem[] = [];
    try {
      const stored = localStorage.getItem('pnl_cart');
      if (stored) initial = JSON.parse(stored);
      setAddToCartAcknowledged(localStorage.getItem(ADD_TO_CART_ACK_KEY) === 'true');
    } catch (e) { console.error('Failed To Load Cart:', e); }
    setCart(initial);
    setLoaded(true);
    if (initial.length > 0) {
      refreshCartPricing(initial, true).then(next => {
        if (next.length !== initial.length || next.some((n, i) => n.id !== initial[i]?.id)) setCart(next);
      }).catch(() => { /* ignore */ });
    }
  }, [refreshCartPricing]);

  // Periodic price refresh
  useEffect(() => {
    if (!loaded) return;
    const id = setInterval(() => {
      setCart(prev => {
        if (prev.length === 0) return prev;
        refreshCartPricing(prev).then(next => {
          if (next.length !== prev.length || next.some((n, i) => n.id !== prev[i]?.id)) setCart(next);
        }).catch(() => { /* ignore */ });
        return prev;
      });
    }, 60_000);
    return () => clearInterval(id);
  }, [loaded, refreshCartPricing]);

  // Persist to localStorage + sync to DB
  useEffect(() => {
    if (loaded) {
      localStorage.setItem('pnl_cart', JSON.stringify(cart));
      fetch('/api/cart/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart }),
      }).catch(err => console.error('Cart Sync Failed:', err));
    }
  }, [cart, loaded]);

  // Global listener for pnl:add-to-cart-by-name
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ name?: string; handled?: boolean }>).detail;
      if (!detail || !detail.name) return;

      // Allow local storefront grids to handle it first (they run in the same event tick)
      setTimeout(async () => {
        if (detail.handled) return;
        detail.handled = true;

        try {
          const res = await fetch('/api/cart/resolve-name', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: detail.name }),
          });

          const data = await res.json();
          if (!res.ok) {
            toast.error(data.error || `${detail.name} Is Not Available On This Storefront.`);
            return;
          }

          if (data.item) {
            addMultipleToCart([{ product: data.item, quantity: data.quantity || 1 }], detail.name);
            toast.success(`${data.item.name} Added To Cart.`);
          } else {
            toast.error(`${detail.name} Is Not Available.`);
          }
        } catch (err) {
          toast.error('Failed to add item to cart.');
        }
      }, 50);
    };

    window.addEventListener('pnl:add-to-cart-by-name', handler as EventListener);
    return () => window.removeEventListener('pnl:add-to-cart-by-name', handler as EventListener);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Two cart entries are the same line when they share a bundle and resolve to
  // the same product - either the same raw id, or the same underlying productId
  // (so an item added by-name [agent_product id] merges with the same product
  // added via product id instead of forming a duplicate split line).
  const sameLine = (
    item: CartItem,
    id: string,
    productId: string | null | undefined,
    bundleName: string | undefined,
  ) =>
    item.bundleName === bundleName &&
    (item.id === id || (!!productId && !!item.productId && item.productId === productId));

  const commitAddition = (product: Omit<CartItem, 'quantity'>, quantity: number) => {
    setCart(prev => {
      const existing = prev.find(item => sameLine(item, product.id, product.productId, product.bundleName));
      const next = existing
        ? prev.map(item => sameLine(item, product.id, product.productId, product.bundleName) ? { ...item, quantity: item.quantity + quantity } : item)
        : [...prev, { ...product, quantity }];
      refreshCartPricing(next, true).then(updated => {
        if (updated.length !== next.length || updated.some((u, i) => u.id !== next[i]?.id)) setCart(updated);
      }).catch(() => { /* ignore */ });
      return next;
    });
    setIsCartOpen(true);
  };
  const commitMultipleAdditions = (items: { product: Omit<CartItem, 'quantity'>, quantity: number }[], bundleName?: string) => {
    setCart(prev => {
      let next = [...prev];
      for (const { product, quantity } of items) {
        const itemBundleName = product.bundleName || bundleName;
        const existingIndex = next.findIndex(item => sameLine(item, product.id, product.productId, itemBundleName));
        if (existingIndex >= 0) {
          next[existingIndex] = { ...next[existingIndex], quantity: next[existingIndex].quantity + quantity };
        } else {
          next.push({ ...product, quantity, bundleName: product.bundleName || bundleName });
        }
      }
      refreshCartPricing(next, true).then(updated => {
        if (updated.length !== next.length || updated.some((u, i) => u.id !== next[i]?.id)) setCart(updated);
      }).catch(() => { /* ignore */ });
      return next;
    });
    setIsCartOpen(true);
  };

  const addToCart = (product: Omit<CartItem, 'quantity'>, quantity = 1) => {
    if (!addToCartAcknowledged) {
      setPendingAddition({ product, quantity });
      return;
    }
    commitAddition(product, quantity);
  };

  const addMultipleToCart = (items: { product: Omit<CartItem, 'quantity'>, quantity: number }[], bundleName?: string) => {
    if (items.length === 0) return;
    if (!addToCartAcknowledged) {
      setPendingAddition({
        product: { ...items[0].product, name: bundleName || `${items.length} items` },
        quantity: 1,
        _isBundle: items,
      } as any);
      return;
    }
    commitMultipleAdditions(items, bundleName);
  };

  const acceptAddToCart = () => {
    try { localStorage.setItem(ADD_TO_CART_ACK_KEY, 'true'); } catch { /* ignore */ }
    setAddToCartAcknowledged(true);
    fetch('/api/disclaimer-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layer: 'add_to_cart' }),
    }).catch(() => { /* non-blocking */ });
    if (pendingAddition) {
      const isBundle = (pendingAddition as any)._isBundle;
      if (isBundle) {
        commitMultipleAdditions(isBundle, pendingAddition.product.bundleName);
      } else {
        commitAddition(pendingAddition.product, pendingAddition.quantity);
      }
      setPendingAddition(null);
    }
  };

  const cancelAddToCart = () => setPendingAddition(null);
  const removeFromCart = (productId: string, bundleName?: string) => {
    setCart(prev => prev.filter(item => !(item.id === productId && item.bundleName === bundleName)));
  };

  const updateQuantity = (productId: string, quantity: number, bundleName?: string) => {
    if (quantity <= 0) { removeFromCart(productId, bundleName); return; }
    setCart(prev => prev.map(item => (item.id === productId && item.bundleName === bundleName) ? { ...item, quantity } : item));
  };

  const clearCart = () => setCart([]);

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const cartSubtotal = cart.reduce((acc, item) => {
    const bulkEligible = !item.agentSelfBuy && item.bulkCostPrice && item.bulkThreshold && item.quantity >= item.bulkThreshold;
    let basePrice = bulkEligible ? (item.bulkCostPrice as number) : item.costPrice;
    if (item.bundleName) {
      basePrice = basePrice * 0.9;
    }
    return acc + basePrice * item.quantity;
  }, 0);

  return (
    <CartContext.Provider
      value={{ cart, addToCart, addMultipleToCart, removeFromCart, updateQuantity, clearCart, cartCount, cartSubtotal, isCartOpen, setIsCartOpen }}
    >
      {children}
      <AnimatePresence>
        {pendingAddition && (
          <AddToCartAcknowledgment
            productName={pendingAddition.product.name}
            onAccept={acceptAddToCart}
            onCancel={cancelAddToCart}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isCartOpen && <CartDrawer />}
      </AnimatePresence>
    </CartContext.Provider>
  );
}

// Acknowledgment Modal

function AddToCartAcknowledgment({
  productName,
  onAccept,
  onCancel,
}: {
  productName: string;
  onAccept: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(5, 10, 15, 0.85)', backdropFilter: 'blur(8px)', padding: 'var(--space-4)' }}
      role="dialog" aria-modal="true" aria-labelledby="add-to-cart-ack-title"
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
        className="glass-panel"
        style={{ maxWidth: 520, width: '100%', padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(192, 184, 168, 0.4)', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(192, 184, 168, 0.2)' }}
      >
        <h2 id="add-to-cart-ack-title" style={{ fontFamily: 'var(--font-brand)', color: 'var(--teal)', margin: '0 0 var(--space-4) 0', fontSize: '1.25rem', letterSpacing: '0.04em' }}>
          Research Use Only Acknowledgment
        </h2>
        <p style={{ color: 'var(--silver)', margin: '0 0 var(--space-3) 0', fontSize: '0.95rem', lineHeight: 1.55 }}>
          You Are About To Add &quot;{productName}&quot; To Your Cart. All Compounds Sold On This Platform Are Strictly For Laboratory And Research Use.
        </p>
        <p style={{ color: 'var(--silver)', margin: '0 0 var(--space-5) 0', fontSize: '0.95rem', lineHeight: 1.55 }}>
          These Materials Are Not For Human Consumption, Diagnostic Use, Therapeutic Use, Or Veterinary Use. By Continuing, You Confirm You Are A Qualified Researcher Acting Within Your Jurisdiction.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" onClick={onCancel} className="btn btn-secondary" style={{ minWidth: 120, justifyContent: 'center' }}>Cancel</button>
          <button type="button" onClick={onAccept} className="btn btn-primary" style={{ minWidth: 220, justifyContent: 'center' }}>I Acknowledge And Add To Cart</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// useCart hook

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart Must Be Used Within A CartProvider');
  return context;
}

// BAC Water Calculator

function BacWaterCalculator({
  cart,
  onAddBacWater,
}: {
  cart: CartItem[];
  onAddBacWater: (product: SmartRec, qty: number) => void;
}) {
  const [result, setResult] = useState<BacWaterResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const prevKeyRef = useRef<string>('');

  const cartKey = cart
    .map(i => `${i.id}:${i.quantity}`)
    .sort()
    .join(',');

  useEffect(() => {
    if (cartKey === prevKeyRef.current) return;
    prevKeyRef.current = cartKey;

    if (cart.length === 0) {
      setResult(null);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);

    const quantities: Record<string, number> = {};
    for (const item of cart) quantities[item.id] = item.quantity;

    fetch('/api/cart/bac-water', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        productIds: cart.map(i => i.id),
        quantities,
      }),
    })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((data: BacWaterResult) => {
        setResult(data);
        setLoading(false);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });

    return () => ctrl.abort();
  }, [cartKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return null;
  if (!result) return null;
  if (result.peptideCount === 0) return null;

  const { vialsNeeded, alreadyInCart, alreadyInCartQty, bacWaterProduct, totalPeptideVials, totalMlNeeded } = result;

  if (alreadyInCart && alreadyInCartQty >= vialsNeeded) {
    return (
      <div
        style={{
          marginTop: 'var(--space-3)',
          padding: '10px 14px',
          borderRadius: 10,
          background: 'rgba(104,211,145,0.06)',
          border: '1.5px solid rgba(104,211,145,0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#68D391" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span style={{ fontSize: '0.78rem', color: '#68D391', fontWeight: 700 }}>
          BAC Water covered - {alreadyInCartQty} vial{alreadyInCartQty !== 1 ? 's' : ''} in cart for {totalPeptideVials} peptide vial{totalPeptideVials !== 1 ? 's' : ''}
        </span>
      </div>
    );
  }

  const stillNeeded = alreadyInCart ? Math.max(0, vialsNeeded - alreadyInCartQty) : vialsNeeded;
  if (stillNeeded === 0) return null;

  return (
    <div
      style={{
        marginTop: 'var(--space-3)',
        borderRadius: 12,
        overflow: 'hidden',
        border: '1.5px solid rgba(0,229,255,0.25)',
        background: 'linear-gradient(135deg, rgba(0,229,255,0.04) 0%, rgba(192,184,168,0.03) 100%)',
      }}
    >
      <div
        style={{
          padding: '10px 14px',
          background: 'rgba(0,229,255,0.07)',
          borderBottom: '1px solid rgba(0,229,255,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2">
          <path d="M9 3h6M9 3v8L4.5 17a2 2 0 001.8 3h11.4a2 2 0 001.8-3L15 11V3" />
          <line x1="8" y1="14" x2="16" y2="14" />
        </svg>
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 800,
            fontFamily: 'var(--font-brand)',
            color: 'var(--teal)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          BAC Water Calculator
        </span>
      </div>

      <div style={{ padding: '10px 14px' }}>
        <div
          style={{
            fontSize: '0.78rem',
            color: 'rgba(255,255,255,0.85)',
            marginBottom: 8,
            lineHeight: 1.5,
          }}
        >
          Your {totalPeptideVials} peptide vial{totalPeptideVials !== 1 ? 's' : ''} need{totalPeptideVials === 1 ? 's' : ''}{' '}
          <strong style={{ color: 'var(--teal)' }}>~{totalMlNeeded} mL</strong> of BAC water for reconstitution.
          {alreadyInCart && alreadyInCartQty > 0 && (
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>
              {' '}({alreadyInCartQty} vial{alreadyInCartQty !== 1 ? 's' : ''} already in cart.)
            </span>
          )}
        </div>

        <div
          style={{
            fontSize: '0.68rem',
            color: 'rgba(255,255,255,0.4)',
            marginBottom: 10,
            display: 'flex',
            gap: 4,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <span>{totalPeptideVials} vials x 2 mL/vial</span>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
          <span>10 mL/bottle</span>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>=</span>
          <span style={{ color: 'var(--teal)', fontWeight: 700 }}>
            {stillNeeded} bottle{stillNeeded !== 1 ? 's' : ''} needed (rounded up)
          </span>
        </div>

        {bacWaterProduct ? (
          <button
            type="button"
            disabled={adding}
            onClick={async () => {
              setAdding(true);
              await onAddBacWater(bacWaterProduct, stillNeeded);
              setTimeout(() => setAdding(false), 1500);
            }}
            style={{
              width: '100%',
              padding: '9px 14px',
              borderRadius: 8,
              border: '1.5px solid rgba(0,229,255,0.4)',
              background: adding ? 'rgba(104,211,145,0.12)' : 'rgba(0,229,255,0.1)',
              color: adding ? '#68D391' : 'var(--teal)',
              fontSize: '0.78rem',
              fontWeight: 800,
              fontFamily: 'var(--font-brand)',
              cursor: adding ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.2s ease',
              letterSpacing: '0.02em',
            }}
          >
            {adding ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Added!
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add {stillNeeded} Vial{stillNeeded !== 1 ? 's' : ''} of BAC Water to Cart
              </>
            )}
          </button>
        ) : (
          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
            BAC Water not available in current catalog
          </div>
        )}
      </div>
    </div>
  );
}

// Smart Recommendation Strip

function SmartRecommendationStrip({
  cart,
  onQuickAdd,
}: {
  cart: CartItem[];
  onQuickAdd: (rec: SmartRec) => void;
}) {
  const [recs, setRecs] = useState<SmartRec[]>([]);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const prevKeyRef = useRef<string>('');

  const cartIds = cart.map(i => i.id).sort().join(',');

  useEffect(() => {
    if (cartIds === prevKeyRef.current) return;
    prevKeyRef.current = cartIds;

    if (cart.length === 0) {
      setRecs([]);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);

    // Recommendations are keyed by product id; cart items may be keyed by
    // agent_product id, so compare against both id and productId to avoid
    // re-recommending something already in the cart.
    const cartIdSet = new Set(cart.flatMap(i => [i.id, i.productId].filter(Boolean) as string[]));

    fetch('/api/cart/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({ productIds: cart.map(i => i.id) }),
    })
      .then(r => r.json())
      .then((data: { recommendations?: SmartRec[] }) => {
        const filtered = (data.recommendations ?? []).filter(r => !cartIdSet.has(r.id));
        setRecs(filtered.slice(0, 6));
        setLoading(false);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });

    return () => ctrl.abort();
  }, [cartIds]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!loading && recs.length === 0) return null;

  return (
    <div
      style={{
        marginTop: 'var(--space-4)',
        paddingTop: 'var(--space-4)',
        borderTop: '1px solid rgba(192,184,168,0.1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-3)' }}>
        <div
          style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(0,229,255,0.16) 0%, rgba(192,184,168,0.1) 100%)',
            border: '1.5px solid rgba(0,229,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: '0.74rem', fontWeight: 800, fontFamily: 'var(--font-brand)', color: 'var(--teal)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Other Researchers Also Stack
          </div>
          <div style={{ fontSize: '0.63rem', color: 'var(--grey-400)', marginTop: 1 }}>
            Based on compound compatibility &amp; order history
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex', gap: 8, overflowX: 'auto',
          overscrollBehaviorX: 'none', touchAction: 'pan-x',
          WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
          paddingBottom: 6,
          scrollbarWidth: 'none' as React.CSSProperties['scrollbarWidth'],
        }}
      >
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`sk-${i}`}
                style={{
                  flex: '0 0 auto', width: 128, height: 180,
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  animation: 'cartPulse 1.6s ease-in-out infinite',
                  animationDelay: `${i * 0.15}s`,
                }}
                aria-hidden="true"
              />
            ))
          : recs.map(rec => (
              <SmartRecCard key={rec.id} rec={rec} onQuickAdd={onQuickAdd} />
            ))}
      </div>
    </div>
  );
}

function SmartRecCard({
  rec,
  onQuickAdd,
}: {
  rec: SmartRec;
  onQuickAdd: (rec: SmartRec) => void;
}) {
  const [added, setAdded] = useState(false);
  const imgSrc = getProductImage(rec.image_url, rec.category || 'Other', rec.name);
  const displayName = rec.unit_size
    ? `${rec.name} ${rec.unit_size}${rec.unit_measure || ''}`
    : rec.name;

  const handleAdd = () => {
    if (added) return;
    onQuickAdd(rec);
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  };

  return (
    <div
      style={{
        flex: '0 0 auto', width: 128,
        borderRadius: 10,
        background: 'linear-gradient(145deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.02) 100%)',
        border: added ? '1.5px solid rgba(104,211,145,0.5)' : '1.5px solid rgba(255,255,255,0.07)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        transition: 'border-color 0.25s ease, transform 0.2s ease',
      }}
    >
      {rec.reason && (
        <div
          style={{
            fontSize: '0.6rem', fontWeight: 700, color: 'var(--teal)',
            background: 'rgba(0,229,255,0.08)', padding: '3px 6px',
            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
            borderBottom: '1px solid rgba(0,229,255,0.1)',
          }}
          title={rec.reason}
        >
          {rec.reason}
        </div>
      )}

      <div
        style={{
          width: '100%', height: 82, flexShrink: 0,
          background: 'radial-gradient(circle at 40% 40%, rgba(0,229,255,0.05) 0%, rgba(0,0,0,0.25) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }}
      >
        {imgSrc ? (
          <Image
            src={imgSrc} alt={rec.name}
            width={120}
            height={82}
            style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }}
            unoptimized
            onError={(e) => {
              const t = e.target as HTMLImageElement;
              const fallback = getProductImage(null, rec.category || 'Other', rec.name);
              if (t.src !== fallback) t.src = fallback;
            }}
          />
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(0,229,255,0.25)" strokeWidth="1.5">
            <path d="M4.5 16.5c-1.5 1.25-2.5 3-2.5 4.5h20c0-1.5-1-3.25-2.5-4.5M12 2v14M8 5l4-3 4 3M6 10h12" />
          </svg>
        )}
      </div>

      <div style={{ padding: '6px 8px 0', flexGrow: 1 }}>
        <div
          style={{
            fontSize: '0.9rem', fontWeight: 700, color: 'var(--white)', lineHeight: 1.25,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as React.CSSProperties['WebkitBoxOrient'],
            overflow: 'hidden', marginBottom: 3,
          }}
        >
          {displayName}
        </div>
        {rec.category && (
          <div style={{ fontSize: '0.6rem', color: 'var(--teal)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {rec.category}
          </div>
        )}
        {typeof rec.retail_price === 'number' && rec.retail_price > 0 && (
          <div style={{ fontSize: '1.1rem', color: 'var(--teal)', fontWeight: 800, fontFamily: 'var(--font-brand)', marginTop: 2 }}>
            ${rec.retail_price.toFixed(2)}
          </div>
        )}
      </div>

      <DynamicAddToCartButton
        onClick={handleAdd}
        isSmall={true}
        justAdded={added}
        style={{ margin: '7px 8px 8px', width: 'auto', flex: 'none' }}
      />
    </div>
  );
}

// Cart Drawer

function CartDrawer() {
  const router = useRouter();
  const {
    cart,
    removeFromCart,
    updateQuantity,
    clearCart,
    cartSubtotal,
    setIsCartOpen,
    addToCart,
  } = useCart();

  const cartIds = new Set(cart.flatMap(i => [i.id, i.productId].filter(Boolean) as string[]));

  const handleQuickAdd = useCallback(async (rec: SmartRec) => {
    try {
      const res = await fetch('/api/cart/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: [rec.id] }),
      });
      const data = await res.json();
      const item = data?.items?.[0];
      if (!item || !item.available) {
        toast.error(`${rec.name} Is Not Currently Available`);
        return;
      }
      addToCart({
        id: rec.id,
        productId: item.productId ?? rec.id,
        name: rec.name,
        sku: '',
        retailPrice: item.retailPrice ?? (rec.retail_price || 0),
        costPrice: item.retailPrice ?? (rec.retail_price || 0),
        bulkCostPrice: item.bulkCostPrice ?? null,
        bulkThreshold: item.bulkThreshold ?? undefined,
        weightOz: 0.5,
      });
    } catch {
      toast.error(`Failed To Add ${rec.name}`);
    }
  }, [addToCart]);

  const handleAddBacWater = useCallback(async (product: SmartRec, qty: number) => {
    try {
      const res = await fetch('/api/cart/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: [product.id] }),
      });
      const data = await res.json();
      const item = data?.items?.[0];
      if (!item || !item.available) {
        toast.error(`BAC Water Is Not Currently Available`);
        return;
      }
      addToCart(
        {
          id: product.id,
          productId: item.productId ?? product.id,
          name: product.name,
          sku: '',
          retailPrice: item.retailPrice ?? (product.retail_price || 0),
          costPrice: item.retailPrice ?? (product.retail_price || 0),
          bulkCostPrice: item.bulkCostPrice ?? null,
          bulkThreshold: item.bulkThreshold ?? undefined,
          weightOz: 0.5,
        },
        qty
      );
      toast.success(`${qty} vial${qty !== 1 ? 's' : ''} of BAC Water Added`);
    } catch {
      toast.error('Failed To Add BAC Water');
    }
  }, [addToCart]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, zIndex: 9999,
        display: 'flex', justifyContent: 'flex-end',
        background: 'rgba(5, 10, 15, 0.75)', backdropFilter: 'blur(6px)',
      }}
    >
      <div onClick={() => setIsCartOpen(false)} style={{ flexGrow: 1, cursor: 'pointer' }} />

      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={(e, info) => {
          if (info.offset.x > 100) setIsCartOpen(false);
        }}
        className="glass-panel"
        style={{
          width: '100%', maxWidth: 440, height: '100%',
          borderRadius: 0,
          borderLeft: '2px solid rgba(192,184,168,0.2)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-12px 0 40px rgba(0, 0, 0, 0.5)',
          position: 'relative', overflow: 'hidden',
        }}
      >
        <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, transparent 0%, rgba(0,229,255,0.7) 40%, rgba(192,184,168,0.5) 60%, transparent 100%)', pointerEvents: 'none', zIndex: 1 }} />

        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(0,229,255,0.15) 0%, rgba(192,184,168,0.08) 100%)', border: '1.5px solid rgba(0,229,255,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2">
                <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
              </svg>
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontFamily: 'var(--font-brand)', color: 'var(--teal)', margin: 0, letterSpacing: '0.05em', lineHeight: 1.2 }}>
                Smart Cart
              </h3>
              {cart.length > 0 && (
                <div style={{ fontSize: '0.66rem', color: 'var(--grey-400)', marginTop: 1 }}>
                  {cart.reduce((a, i) => a + i.quantity, 0)} item{cart.reduce((a, i) => a + i.quantity, 0) !== 1 ? 's' : ''} - ${cartSubtotal.toFixed(2)}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setIsCartOpen(false)}
            style={{ width: 34, height: 34, minWidth: 34, minHeight: 34, borderRadius: '50%', padding: 0, boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--silver)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }}
            aria-label="Close Cart"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ flexGrow: 1, overflowY: 'auto', overflowX: 'hidden', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cart.length > 0 ? (
            <>
              {(() => {
                const groupedCart: { isBundle: boolean, name: string, items: typeof cart }[] = [];
                const processedIds = new Set<string>();

                cart.forEach(item => {
                  const key = item.id + '-' + (item.bundleName || '');
                  if (processedIds.has(key)) return;
                  
                  if (item.bundleName) {
                    const bundleItems = cart.filter(i => i.bundleName === item.bundleName);
                    if (!groupedCart.find(g => g.isBundle && g.name === item.bundleName)) {
                      groupedCart.push({ isBundle: true, name: item.bundleName, items: bundleItems });
                    }
                    bundleItems.forEach(i => processedIds.add(i.id + '-' + i.bundleName));
                  } else {
                    groupedCart.push({ isBundle: false, name: item.name, items: [item] });
                    processedIds.add(key);
                  }
                });

                return groupedCart.map((group, groupIndex) => {
                  if (group.isBundle) {
                    const bundleSubtotal = group.items.reduce((acc, item) => {
                      const bulkEligible = !item.agentSelfBuy && item.bulkCostPrice && item.bulkThreshold && item.quantity >= item.bulkThreshold;
                      const activePrice = bulkEligible ? (item.bulkCostPrice as number) : item.costPrice;
                      return acc + (activePrice * 0.9) * item.quantity;
                    }, 0);

                    return (
                      <div key={`bundle-${group.name}-${groupIndex}`} style={{
                        background: 'rgba(0, 229, 255, 0.03)',
                        border: '1.5px solid rgba(0, 229, 255, 0.2)',
                        borderRadius: 12,
                        padding: '12px',
                        display: 'flex', flexDirection: 'column', gap: 8,
                        marginBottom: 4
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0,229,255,0.1)', paddingBottom: 8, marginBottom: 4 }}>
                          <div>
                            <h4 style={{ fontSize: '0.9rem', margin: 0, fontFamily: 'var(--font-brand)', color: '#00E5FF', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {group.name}
                            </h4>
                            <div style={{ fontSize: '0.65rem', color: '#68D391', marginTop: 2, fontWeight: 700 }}>Stack Discount (10% Off) Applied</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--grey-400)', marginTop: 4, fontStyle: 'italic', maxWidth: '90%' }}>
                              Note: This peptide stack is not all inside one vial, it is individually packaged as the vials listed below.
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ fontSize: '0.9rem', color: '#00E5FF', fontWeight: 800 }}>${bundleSubtotal.toFixed(2)}</div>
                            <button onClick={() => group.items.forEach(i => removeFromCart(i.id, i.bundleName))} style={{ background: 'none', border: 'none', color: 'rgba(255,90,90,0.7)', cursor: 'pointer', padding: '3px', transition: 'color 0.15s' }} aria-label="Remove Stack">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        {group.items.map(item => {
                          const bulkEligible = !item.agentSelfBuy && item.bulkCostPrice && item.bulkThreshold && item.quantity >= item.bulkThreshold;
                          const activePrice = bulkEligible ? (item.bulkCostPrice as number) : item.costPrice;
                          return (
                            <div key={item.id} style={{ display: 'flex', gap: 10, position: 'relative', paddingLeft: 8 }}>
                              <div style={{ flexGrow: 1, minWidth: 0 }}>
                                <h4 style={{ fontSize: '0.8rem', margin: '0 0 3px', color: 'var(--silver-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {item.name}
                                </h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.09)' }}>
                                    <button onClick={() => updateQuantity(item.id, item.quantity - 1, item.bundleName)} style={{ background: 'none', border: 'none', color: 'var(--silver)', width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>-</button>
                                    <span style={{ fontSize: '0.75rem', width: 20, textAlign: 'center', color: 'var(--teal)', fontWeight: 700 }}>{item.quantity}</span>
                                    <button onClick={() => updateQuantity(item.id, item.quantity + 1, item.bundleName)} style={{ background: 'none', border: 'none', color: 'var(--silver)', width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>+</button>
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--grey-400)' }}>
                                    <span style={{ textDecoration: 'line-through', marginRight: 6 }}>${(activePrice * item.quantity).toFixed(2)}</span>
                                    <span style={{ color: '#00E5FF' }}>${((activePrice * 0.9) * item.quantity).toFixed(2)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }

                  return group.items.map(item => {
                    const bulkEligible = !item.agentSelfBuy && item.bulkCostPrice && item.bulkThreshold && item.quantity >= item.bulkThreshold;
                    const activePrice = bulkEligible ? (item.bulkCostPrice as number) : item.costPrice;
                    return (
                      <div key={item.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '11px 13px', display: 'flex', gap: 10, position: 'relative' }}>
                        <div style={{ flexGrow: 1, minWidth: 0 }}>
                          <h4 style={{ fontSize: '0.84rem', margin: '0 0 3px', fontFamily: 'var(--font-brand)', color: 'var(--white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.name}
                          </h4>
                          {item.sku && <div style={{ fontSize: '0.67rem', color: 'var(--grey-400)', marginBottom: 6 }}>SKU: {item.sku}</div>}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.09)' }}>
                              <button onClick={() => updateQuantity(item.id, item.quantity - 1, item.bundleName)} style={{ background: 'none', border: 'none', color: 'var(--silver)', width: 25, height: 25, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>-</button>
                              <span style={{ fontSize: '0.82rem', width: 22, textAlign: 'center', color: 'var(--teal)', fontFamily: 'var(--font-brand)', fontWeight: 700 }}>{item.quantity}</span>
                              <button onClick={() => updateQuantity(item.id, item.quantity + 1, item.bundleName)} style={{ background: 'none', border: 'none', color: 'var(--silver)', width: 25, height: 25, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>+</button>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.88rem', color: 'var(--white)', fontWeight: 700, fontFamily: 'var(--font-brand)' }}>
                                ${(activePrice * item.quantity).toFixed(2)}
                              </div>
                              {bulkEligible && <div style={{ fontSize: '0.61rem', color: 'var(--teal)' }}>Bulk Rate (Active)</div>}
                            </div>
                          </div>
                        </div>
                        <button onClick={() => removeFromCart(item.id, item.bundleName)} style={{ background: 'none', border: 'none', color: 'rgba(255,90,90,0.55)', cursor: 'pointer', padding: '3px 2px', height: 'fit-content', transition: 'color 0.15s' }} aria-label="Remove Item">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          </svg>
                        </button>
                      </div>
                    );
                  });
                });
              })()}

              <BacWaterCalculator cart={cart} onAddBacWater={handleAddBacWater} />

              <SmartRecommendationStrip
                cart={cart}
                onQuickAdd={(rec) => {
                  if (cartIds.has(rec.id)) return;
                  handleQuickAdd(rec);
                }}
              />
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 'var(--space-3)', opacity: 0.6, paddingBottom: 60 }}>
              <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,229,255,0.07) 0%, transparent 70%)', border: '1.5px solid rgba(0,229,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.4">
                  <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
                </svg>
              </div>
              <div style={{ textAlign: 'center' }}>
                <h4 style={{ color: 'var(--silver)', margin: '0 0 4px', fontSize: '0.92rem' }}>Your Cart Is Empty</h4>
                <p style={{ fontSize: '0.76rem', color: 'var(--grey-400)', margin: 0 }}>Add Compounds To Get Started</p>
              </div>
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '14px 20px', paddingBottom: 'calc(18px + var(--safe-bottom, 0px))', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '10px 14px', background: 'rgba(0,229,255,0.04)', borderRadius: 8, border: '1px solid rgba(0,229,255,0.1)' }}>
              <span style={{ fontSize: '0.86rem', color: 'var(--grey-400)', fontWeight: 600 }}>Subtotal</span>
              <strong style={{ color: 'var(--teal)', fontFamily: 'var(--font-brand)', fontSize: '1.15rem', fontWeight: 800, letterSpacing: '0.02em' }}>
                ${cartSubtotal.toFixed(2)}
              </strong>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <DynamicCartButton
                type="checkout"
                onClick={() => {
                  setIsCartOpen(false);
                  router.push('/checkout');
                }}
              />
              <DynamicCartButton
                type="shopping"
                onClick={() => setIsCartOpen(false)}
              />
              <DynamicCartButton
                type="clear"
                onClick={clearCart}
              />
            </div>
          </div>
        )}
      </motion.div>

      <style>{`
        @keyframes cartPulse { 0%,100%{opacity:0.35} 50%{opacity:0.7} }
        .smart-rec-add:hover { background: rgba(0,229,255,0.14) !important; }
      `}</style>
    </motion.div>
  );
}
