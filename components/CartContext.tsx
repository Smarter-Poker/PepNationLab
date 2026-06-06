'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { getProductImage } from '@/lib/categoryImage';

export interface CartItem {
  id: string; // Product ID
  name: string;
  sku: string;
  quantity: number;
  retailPrice: number; // Retail price (Tier 3)
  costPrice: number;   // Price paid by current user (based on tier)
  bulkCostPrice?: number | null; // Price paid if threshold is met
  bulkThreshold?: number; // Quantity needed to trigger bulk discount
  weightOz: number;
  // True when this line item is an agent/super-agent buying on their own
  // storefront. Wholesale buyers always pay tier cost flat — bulk volume
  // discounts and retail markup never apply to them, matching the server-side
  // order-route pricing in app/api/orders/route.ts.
  agentSelfBuy?: boolean;
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
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartSubtotal: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  lastAddedProductId: string | null;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const DISCLAIMER_VERSION = process.env.NEXT_PUBLIC_DISCLAIMER_VERSION || 'v1.0';
const ADD_TO_CART_ACK_KEY = `pnl_addtocart_${DISCLAIMER_VERSION}`;

interface PendingAddition {
  product: Omit<CartItem, 'quantity'>;
  quantity: number;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [addToCartAcknowledged, setAddToCartAcknowledged] = useState(false);
  const [pendingAddition, setPendingAddition] = useState<PendingAddition | null>(null);
  const [lastAddedProductId, setLastAddedProductId] = useState<string | null>(null);
  const lastRefreshRef = useRef<number>(0);
  const refreshInflightRef = useRef<boolean>(false);

  // Re-resolve cart items against the live catalog. Drops banned / missing
  // items and updates retail / bulk pricing. Throttled to once per ~60s
  // unless `force` is set.
  const refreshCartPricing = useCallback(
    async (items: CartItem[], force = false): Promise<CartItem[]> => {
      if (items.length === 0) return items;
      if (refreshInflightRef.current) return items;
      const now = Date.now();
      if (!force && now - lastRefreshRef.current < 60_000) return items;
      refreshInflightRef.current = true;
      try {
        // CartContext.cart[].id is the master catalog product_id (UUID from products table).
        // The cart/refresh endpoint can query by product_id via the `productIds` key.
        const res = await fetch('/api/cart/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productIds: items.map(i => i.id) }),
        });
        if (!res.ok) return items;
        const data = (await res.json()) as {
          items: Array<{
            id: string;
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
          if (data.missing?.includes(item.id)) {
            removed.push(item.name);
            continue;
          }
          const fresh = data.items.find(d => d.id === item.id);
          if (!fresh) {
            removed.push(item.name);
            continue;
          }
          if (!fresh.available) {
            removed.push(fresh.name ?? item.name);
            continue;
          }
          next.push({
            ...item,
            costPrice: fresh.retailPrice,
            retailPrice: fresh.retailPrice,
            bulkCostPrice: fresh.bulkCostPrice,
            bulkThreshold:
              fresh.bulkThreshold != null ? fresh.bulkThreshold : item.bulkThreshold,
          });
        }
        for (const name of removed) {
          try {
            toast.error(`Item Removed: ${name} Is No Longer Available`);
          } catch {
            /* sonner Toaster may not be mounted in tests */
          }
        }
        return next;
      } finally {
        refreshInflightRef.current = false;
      }
    },
    []
  );

  // Load from local storage
  useEffect(() => {
    let initial: CartItem[] = [];
    try {
      const stored = localStorage.getItem('pnl_cart');
      if (stored) {
        initial = JSON.parse(stored);
      }
      setAddToCartAcknowledged(
        localStorage.getItem(ADD_TO_CART_ACK_KEY) === 'true'
      );
    } catch (e) {
      console.error('Failed To Load Cart From Local Storage:', e);
    }
    setCart(initial);
    setLoaded(true);

    // Validate hydrated items against the live catalog and drop any that
    // are banned, missing, or no longer visible.
    if (initial.length > 0) {
      refreshCartPricing(initial, true).then(next => {
        if (next.length !== initial.length || next.some((n, i) => n.id !== initial[i]?.id)) {
          setCart(next);
        }
      }).catch(() => { /* network errors leave cart untouched */ });
    }
  }, [refreshCartPricing]);

  // Re-validate every 60s while the app is open.
  useEffect(() => {
    if (!loaded) return;
    const id = setInterval(() => {
      setCart(prev => {
        if (prev.length === 0) return prev;
        refreshCartPricing(prev).then(next => {
          if (next.length !== prev.length || next.some((n, i) => n.id !== prev[i]?.id)) {
            setCart(next);
          }
        }).catch(() => { /* ignore */ });
        return prev;
      });
    }, 60_000);
    return () => clearInterval(id);
  }, [loaded, refreshCartPricing]);

  // Save to local storage
  useEffect(() => {
    if (loaded) {
      localStorage.setItem('pnl_cart', JSON.stringify(cart));

      // Background sync to database for Live Carts feature
      fetch('/api/cart/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart })
      }).catch(err => console.error('Cart Sync Failed:', err));
    }
  }, [cart, loaded]);

  const commitAddition = (product: Omit<CartItem, 'quantity'>, quantity: number) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      const next = existing
        ? prev.map(item =>
            item.id === product.id
              ? { ...item, quantity: item.quantity + quantity }
              : item
          )
        : [...prev, { ...product, quantity }];

      // Force a catalog re-check immediately so the newly added item starts
      // from current pricing rather than whatever was passed in.
      refreshCartPricing(next, true).then(updated => {
        if (updated.length !== next.length || updated.some((u, i) => u.id !== next[i]?.id)) {
          setCart(updated);
        }
      }).catch(() => { /* ignore */ });

      return next;
    });
    // Track the last added product for Smart Cart recommendations
    setLastAddedProductId(product.id);
    setIsCartOpen(true);
  };

  const addToCart = (product: Omit<CartItem, 'quantity'>, quantity = 1) => {
    if (!addToCartAcknowledged) {
      // Defer the addition until the user passes the Layer 3 (add_to_cart)
      // acknowledgment. We do NOT mutate the cart yet.
      setPendingAddition({ product, quantity });
      return;
    }
    commitAddition(product, quantity);
  };

  const acceptAddToCart = () => {
    try {
      localStorage.setItem(ADD_TO_CART_ACK_KEY, 'true');
    } catch (e) {
      console.error('Failed To Persist Add To Cart Acknowledgment:', e);
    }
    setAddToCartAcknowledged(true);

    // Best-effort compliance log; failure must not block the shopper.
    fetch('/api/disclaimer-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layer: 'add_to_cart' }),
    }).catch(() => { /* logging is non-blocking */ });

    if (pendingAddition) {
      commitAddition(pendingAddition.product, pendingAddition.quantity);
      setPendingAddition(null);
    }
  };

  const cancelAddToCart = () => {
    setPendingAddition(null);
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev =>
      prev.map(item => (item.id === productId ? { ...item, quantity } : item))
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const cartSubtotal = cart.reduce((acc, item) => {
    // Wholesale (agent self-buy) lines always pay tier costPrice flat. Volume
    // bulk pricing only applies to researcher/sub-agent-paying-retail flows.
    const bulkEligible = !item.agentSelfBuy && item.bulkCostPrice && item.bulkThreshold && item.quantity >= item.bulkThreshold;
    const activePrice = bulkEligible ? (item.bulkCostPrice as number) : item.costPrice;
    return acc + activePrice * item.quantity;
  }, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartCount,
        cartSubtotal,
        isCartOpen,
        setIsCartOpen,
        lastAddedProductId,
      }}
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(5, 10, 15, 0.85)',
        backdropFilter: 'blur(8px)',
        padding: 'var(--space-4)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-to-cart-ack-title"
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        className="glass-panel"
        style={{
          maxWidth: 520,
          width: '100%',
          padding: 'var(--space-6)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid rgba(192, 184, 168, 0.4)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(192, 184, 168, 0.2)',
        }}
      >
        <h2
          id="add-to-cart-ack-title"
          style={{
            fontFamily: 'var(--font-brand)',
            color: 'var(--teal)',
            margin: '0 0 var(--space-4) 0',
            fontSize: '1.25rem',
            letterSpacing: '0.04em',
          }}
        >
          Research Use Only Acknowledgment
        </h2>
        <p style={{ color: 'var(--silver)', margin: '0 0 var(--space-3) 0', fontSize: '0.95rem', lineHeight: 1.55 }}>
          You Are About To Add &quot;{productName}&quot; To Your Cart. All Compounds Sold On This Platform Are Strictly For Laboratory And Research Use.
        </p>
        <p style={{ color: 'var(--silver)', margin: '0 0 var(--space-5) 0', fontSize: '0.95rem', lineHeight: 1.55 }}>
          These Materials Are Not For Human Consumption, Diagnostic Use, Therapeutic Use, Or Veterinary Use. By Continuing, You Confirm You Are A Qualified Researcher Acting Within Your Jurisdiction.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary"
            style={{ minWidth: 120, justifyContent: 'center' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="btn btn-primary"
            style={{ minWidth: 220, justifyContent: 'center' }}
          >
            I Acknowledge And Add To Cart
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart Must Be Used Within A CartProvider');
  }
  return context;
}

// ─── Smart Cart Recommendation Strip ─────────────────────────────────────────

function SmartRecommendationStrip({
  seedProductId,
  cartIds,
  onQuickAdd,
}: {
  seedProductId: string;
  cartIds: Set<string>;
  onQuickAdd: (rec: SmartRec) => void;
}) {
  const [recs, setRecs] = useState<SmartRec[]>([]);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!seedProductId) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);

    fetch(
      `/api/storefront/recommendations?product_id=${encodeURIComponent(seedProductId)}&limit=8`,
      { signal: ctrl.signal }
    )
      .then(r => r.json())
      .then((data: { recommendations?: SmartRec[] }) => {
        // Filter out anything already in the cart
        const filtered = (data.recommendations ?? []).filter(r => !cartIds.has(r.id));
        setRecs(filtered.slice(0, 6));
        setLoading(false);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });

    return () => ctrl.abort();
  }, [seedProductId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!loading && recs.length === 0) return null;

  return (
    <div
      style={{
        marginTop: 'var(--space-4)',
        paddingTop: 'var(--space-4)',
        borderTop: '1px solid rgba(192,184,168,0.12)',
      }}
    >
      {/* Section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 'var(--space-3)',
        }}
      >
        {/* DNA / atom icon */}
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(0,229,255,0.18) 0%, rgba(192,184,168,0.12) 100%)',
            border: '1.5px solid rgba(0,229,255,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2">
            <path d="M2 2c0 0 4 4 10 4s10-4 10-4M2 22c0 0 4-4 10-4s10 4 10 4M12 6v12M6 9l-4 3M18 9l4 3M6 15l-4-3M18 15l4-3" />
          </svg>
        </div>
        <div>
          <div
            style={{
              fontSize: '0.78rem',
              fontWeight: 800,
              fontFamily: 'var(--font-brand)',
              color: 'var(--teal)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Other Researchers Also Stack
          </div>
          <div style={{ fontSize: '0.67rem', color: 'var(--grey-400)', marginTop: 1 }}>
            Compounds that pair well with your selection
          </div>
        </div>
      </div>

      {/* Horizontally scrollable cards */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          overscrollBehaviorX: 'none',
          touchAction: 'pan-x',
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
                  flex: '0 0 auto',
                  width: 130,
                  height: 178,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  animation: 'pulse 1.6s ease-in-out infinite',
                }}
                aria-hidden="true"
              />
            ))
          : recs.map(rec => (
              <SmartRecCard key={rec.id} rec={rec} onQuickAdd={onQuickAdd} />
            ))}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.5} 50%{opacity:1} }
        .smart-rec-card:hover { border-color: rgba(0,229,255,0.4) !important; transform: translateY(-2px); }
        .smart-rec-quickadd:hover { background: rgba(0,229,255,0.18) !important; }
      `}</style>
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
  const imgSrc = getProductImage(rec.image_url, rec.category || 'Other', rec.name);
  const displayName = rec.unit_size
    ? `${rec.name} ${rec.unit_size}${rec.unit_measure || ''}`
    : rec.name;

  return (
    <div
      className="smart-rec-card"
      style={{
        flex: '0 0 auto',
        width: 130,
        borderRadius: 10,
        background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
        border: '1.5px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'border-color 0.2s ease, transform 0.2s ease',
        cursor: 'default',
      }}
    >
      {/* Image */}
      <div
        style={{
          width: '100%',
          height: 90,
          background: 'radial-gradient(circle at 40% 40%, rgba(0,229,255,0.06) 0%, rgba(0,0,0,0.3) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {imgSrc ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imgSrc}
            alt={rec.name}
            style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 10 }}
            onError={(e) => {
              const t = e.target as HTMLImageElement;
              const fallback = getProductImage(null, rec.category || 'Other', rec.name);
              if (t.src !== fallback) t.src = fallback;
            }}
          />
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(0,229,255,0.3)" strokeWidth="1.5">
            <path d="M4.5 16.5c-1.5 1.25-2.5 3-2.5 4.5h20c0-1.5-1-3.25-2.5-4.5M12 2v14M8 5l4-3 4 3M6 10h12" />
          </svg>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '8px 8px 0 8px', flexGrow: 1 }}>
        <div
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            color: 'var(--white)',
            lineHeight: 1.25,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as React.CSSProperties['WebkitBoxOrient'],
            overflow: 'hidden',
            marginBottom: 4,
          }}
        >
          {displayName}
        </div>
        {rec.category && (
          <div
            style={{
              fontSize: '0.62rem',
              color: 'var(--teal)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
          >
            {rec.category}
          </div>
        )}
        {typeof rec.retail_price === 'number' && rec.retail_price > 0 && (
          <div
            style={{
              fontSize: '0.82rem',
              color: 'var(--teal)',
              fontWeight: 800,
              fontFamily: 'var(--font-brand)',
              marginTop: 2,
            }}
          >
            ${rec.retail_price.toFixed(2)}
          </div>
        )}
      </div>

      {/* Quick-add button */}
      <button
        type="button"
        onClick={() => onQuickAdd(rec)}
        className="smart-rec-quickadd"
        style={{
          margin: '8px 8px 8px 8px',
          borderRadius: 6,
          border: '1.5px solid rgba(0,229,255,0.3)',
          background: 'rgba(0,229,255,0.08)',
          color: 'var(--teal)',
          fontSize: '0.7rem',
          fontWeight: 700,
          fontFamily: 'var(--font-brand)',
          cursor: 'pointer',
          padding: '5px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          letterSpacing: '0.02em',
          transition: 'background 0.15s ease',
          flexShrink: 0,
        }}
        aria-label={`Add ${rec.name} to cart`}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add To Cart
      </button>
    </div>
  );
}

// ─── Cart Drawer ───────────────────────────────────────────────────────────────

function CartDrawer() {
  const {
    cart,
    removeFromCart,
    updateQuantity,
    clearCart,
    cartSubtotal,
    setIsCartOpen,
    lastAddedProductId,
    addToCart,
  } = useCart();

  // Track which quick-add was just added (for button feedback)
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const cartIds = new Set(cart.map(i => i.id));

  const handleQuickAdd = useCallback(async (rec: SmartRec) => {
    // We need to fetch the product price before adding — use the refresh API
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
        name: rec.name,
        sku: '',
        retailPrice: item.retailPrice ?? (rec.retail_price || 0),
        costPrice: item.retailPrice ?? (rec.retail_price || 0),
        bulkCostPrice: item.bulkCostPrice ?? null,
        bulkThreshold: item.bulkThreshold ?? undefined,
        weightOz: 0.5,
      });
      setJustAdded(rec.id);
      setTimeout(() => setJustAdded(null), 2000);
    } catch {
      toast.error(`Failed To Add ${rec.name}`);
    }
  }, [addToCart]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 100,
        display: 'flex',
        justifyContent: 'flex-end',
        background: 'rgba(5, 10, 15, 0.75)',
        backdropFilter: 'blur(6px)',
      }}
    >
      {/* Backdrop close area */}
      <div
        onClick={() => setIsCartOpen(false)}
        style={{ flexGrow: 1, cursor: 'pointer' }}
      />

      {/* Drawer Body */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: 440,
          height: '100%',
          borderRadius: 0,
          borderLeft: '2px solid rgba(192,184,168,0.25)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.5), -2px 0 0 rgba(192,184,168,0.08)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle gradient shimmer at the top */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: 'linear-gradient(90deg, transparent 0%, rgba(0,229,255,0.6) 40%, rgba(192,184,168,0.6) 60%, transparent 100%)',
            pointerEvents: 'none',
          }}
        />

        {/* ── Header ── */}
        <div
          style={{
            padding: 'var(--space-5) var(--space-6)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Smart cart icon */}
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(0,229,255,0.15) 0%, rgba(192,184,168,0.08) 100%)',
                border: '1.5px solid rgba(0,229,255,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2">
                <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
              </svg>
            </div>
            <div>
              <h3
                style={{
                  fontSize: '1rem',
                  fontFamily: 'var(--font-brand)',
                  color: 'var(--teal)',
                  margin: 0,
                  letterSpacing: '0.05em',
                  lineHeight: 1.2,
                }}
              >
                Smart Cart
              </h3>
              {cart.length > 0 && (
                <div style={{ fontSize: '0.67rem', color: 'var(--grey-400)', marginTop: 1 }}>
                  {cart.reduce((a, i) => a + i.quantity, 0)} item{cart.reduce((a, i) => a + i.quantity, 0) !== 1 ? 's' : ''} · ${cartSubtotal.toFixed(2)}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setIsCartOpen(false)}
            style={{
              width: 36, height: 36, minWidth: 36, minHeight: 36,
              borderRadius: '50%', padding: 0, boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.14)',
              color: 'var(--silver)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              transition: 'background 0.15s',
            }}
            aria-label="Close Cart"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Scrollable Content ── */}
        <div
          style={{
            flexGrow: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: 'var(--space-5) var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
          }}
        >
          {cart.length > 0 ? (
            <>
              {/* Cart Items */}
              {cart.map(item => {
                const bulkEligible = !item.agentSelfBuy && item.bulkCostPrice && item.bulkThreshold && item.quantity >= item.bulkThreshold;
                const activePrice = bulkEligible ? (item.bulkCostPrice as number) : item.costPrice;
                return (
                  <div
                    key={item.id}
                    style={{
                      background: 'var(--surface-2)',
                      border: '1.5px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-3) var(--space-4)',
                      display: 'flex',
                      gap: 'var(--space-3)',
                      position: 'relative',
                      transition: 'border-color 0.2s',
                    }}
                  >
                    <div style={{ flexGrow: 1, minWidth: 0 }}>
                      <h4
                        style={{
                          fontSize: '0.86rem',
                          margin: '0 0 3px 0',
                          fontFamily: 'var(--font-brand)',
                          color: 'var(--white)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.name}
                      </h4>
                      {item.sku && (
                        <div style={{ fontSize: '0.68rem', color: 'var(--grey-400)', marginBottom: 6 }}>
                          SKU: {item.sku}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                        {/* Quantity Selector */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: 'var(--surface-3)',
                            borderRadius: 6,
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                          }}
                        >
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            style={{
                              background: 'none', border: 'none', color: 'var(--silver)',
                              width: 26, height: 26, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '1rem',
                            }}
                          >
                            −
                          </button>
                          <span
                            style={{
                              fontSize: '0.82rem', width: 24, textAlign: 'center',
                              color: 'var(--teal)', fontFamily: 'var(--font-brand)', fontWeight: 700,
                            }}
                          >
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            style={{
                              background: 'none', border: 'none', color: 'var(--silver)',
                              width: 26, height: 26, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '1rem',
                            }}
                          >
                            +
                          </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                          <div
                            style={{
                              fontSize: '0.9rem', color: 'var(--white)',
                              fontWeight: 700, fontFamily: 'var(--font-brand)',
                            }}
                          >
                            ${(activePrice * item.quantity).toFixed(2)}
                          </div>
                          {bulkEligible && (
                            <div style={{ fontSize: '0.62rem', color: 'var(--teal)' }}>
                              Bulk rate applied ✓
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => removeFromCart(item.id)}
                      style={{
                        background: 'none', border: 'none', color: 'rgba(255,100,100,0.6)',
                        opacity: 0.8, cursor: 'pointer', padding: '4px 2px', height: 'fit-content',
                        transition: 'color 0.15s',
                      }}
                      aria-label="Remove Item"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  </div>
                );
              })}

              {/* ── Smart Recommendations ── */}
              {lastAddedProductId && (
                <SmartRecommendationStrip
                  seedProductId={lastAddedProductId}
                  cartIds={cartIds}
                  onQuickAdd={(rec) => {
                    if (justAdded === rec.id) return;
                    handleQuickAdd(rec);
                  }}
                />
              )}
            </>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: 'var(--space-3)',
                opacity: 0.65,
                paddingBottom: 60,
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(0,229,255,0.08) 0%, transparent 70%)',
                  border: '1.5px solid rgba(0,229,255,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.4">
                  <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
                </svg>
              </div>
              <div style={{ textAlign: 'center' }}>
                <h4 style={{ color: 'var(--silver)', margin: '0 0 4px 0', fontSize: '0.95rem' }}>Your Cart Is Empty</h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', margin: 0 }}>Add Compounds To Get Started</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer Actions ── */}
        {cart.length > 0 && (
          <div
            style={{
              borderTop: '1px solid rgba(255, 255, 255, 0.07)',
              padding: 'var(--space-4) var(--space-6) var(--space-5)',
              flexShrink: 0,
              background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.2) 100%)',
            }}
          >
            {/* Subtotal row */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-4)',
                padding: 'var(--space-3) var(--space-4)',
                background: 'rgba(0,229,255,0.04)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(0,229,255,0.12)',
              }}
            >
              <span style={{ fontSize: '0.88rem', color: 'var(--grey-400)', fontWeight: 600 }}>Subtotal</span>
              <strong
                style={{
                  color: 'var(--teal)',
                  fontFamily: 'var(--font-brand)',
                  fontSize: '1.2rem',
                  fontWeight: 800,
                  letterSpacing: '0.02em',
                }}
              >
                ${cartSubtotal.toFixed(2)}
              </strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <Link
                href="/checkout"
                onClick={() => setIsCartOpen(false)}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  fontSize: '0.9rem',
                  padding: '13px 0',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                }}
              >
                Proceed To Checkout →
              </Link>
              <button
                onClick={() => setIsCartOpen(false)}
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center', fontSize: '0.82rem', padding: '10px 0' }}
              >
                Keep Shopping
              </button>
              <button
                onClick={clearCart}
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center', fontSize: '0.75rem', padding: '8px 0', opacity: 0.55 }}
              >
                Clear Cart
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
