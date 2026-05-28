'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

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
        const res = await fetch('/api/cart/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentProductIds: items.map(i => i.id) }),
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
    const activePrice = (item.bulkCostPrice && item.bulkThreshold && item.quantity >= item.bulkThreshold)
      ? item.bulkCostPrice
      : item.costPrice;
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
        className="card-glass"
        style={{
          maxWidth: 520,
          width: '100%',
          padding: 'var(--space-6)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid rgba(0, 196, 188, 0.4)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(0, 196, 188, 0.2)',
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

function CartDrawer() {
  const { cart, removeFromCart, updateQuantity, clearCart, cartSubtotal, setIsCartOpen } = useCart();

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
        className="card-metal" 
        style={{
          width: '100%',
          maxWidth: 420,
          height: '100%',
          borderRadius: 0,
          borderLeft: 'var(--border-teal)',
          display: 'flex',
          flexDirection: 'column',
          padding: 'var(--space-6)',
          boxShadow: '-10px 0 30px rgba(0, 196, 188, 0.15)',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: 'var(--space-4)' }}>
          <h3 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-brand)', color: 'var(--teal)', margin: 0, letterSpacing: '0.05em' }}>
            Shopping Cart
          </h3>
          <button 
            onClick={() => setIsCartOpen(false)}
            style={{ background: 'none', border: 'none', color: 'var(--silver)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label="Close Cart"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Cart Items List */}
        <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', paddingRight: 4, marginBottom: 'var(--space-6)' }}>
          {cart.length > 0 ? (
            cart.map(item => (
              <div key={item.id} style={{
                background: 'var(--surface-2)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)',
                display: 'flex',
                gap: 'var(--space-3)',
                position: 'relative'
              }}>
                <div style={{ flexGrow: 1 }}>
                  <h4 style={{ fontSize: '0.88rem', margin: '0 0 4px 0', fontFamily: 'var(--font-brand)', color: 'var(--white)' }}>
                    {item.name}
                  </h4>
                  {item.sku && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--grey-400)', marginBottom: 8 }}>
                      SKU: {item.sku}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                    {/* Quantity Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-3)', borderRadius: 4, border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      <button 
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        style={{ background: 'none', border: 'none', color: 'var(--silver)', width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}
                      >
                        -
                      </button>
                      <span style={{ fontSize: '0.82rem', width: 24, textAlign: 'center', color: 'var(--teal)', fontFamily: 'var(--font-brand)' }}>
                        {item.quantity}
                      </span>
                      <button 
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        style={{ background: 'none', border: 'none', color: 'var(--silver)', width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}
                      >
                        +
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <div style={{ fontSize: '0.9rem', color: 'var(--white)', fontWeight: 600, fontFamily: 'var(--font-brand)' }}>
                        ${Math.ceil((item.bulkCostPrice && item.bulkThreshold && item.quantity >= item.bulkThreshold ? item.bulkCostPrice : item.costPrice) * item.quantity)}
                      </div>
                      {item.bulkCostPrice && item.bulkThreshold && item.quantity >= item.bulkThreshold && (
                        <div style={{ fontSize: '0.65rem', color: 'var(--teal)' }}>
                          Bulk Discount Applied! (${Math.ceil(item.bulkCostPrice)}/ea)
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Remove button */}
                <button 
                  onClick={() => removeFromCart(item.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--red)', opacity: 0.7, cursor: 'pointer', padding: 4, height: 'fit-content' }}
                  aria-label="Remove Item"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>
            ))
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.6 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.5" style={{ marginBottom: 'var(--space-4)' }}>
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
              </svg>
              <h4 style={{ color: 'var(--silver)', margin: '0 0 4px 0' }}>Your Cart Is Empty</h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', margin: 0 }}>Add Compounds To Get Started</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {cart.length > 0 && (
          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-4)', fontSize: '0.95rem' }}>
              <span style={{ color: 'var(--grey-400)' }}>Item Subtotal</span>
              <strong style={{ color: 'var(--teal)', fontFamily: 'var(--font-brand)', fontSize: '1.1rem' }}>
                ${Math.ceil(cartSubtotal)}
              </strong>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button 
                onClick={clearCart} 
                className="btn btn-secondary" 
                style={{ flexBasis: '35%', justifyContent: 'center', fontSize: '0.8rem', padding: '10px 0' }}
              >
                Clear Cart
              </button>
              <Link 
                href="/checkout" 
                onClick={() => setIsCartOpen(false)}
                className="btn btn-primary" 
                style={{ flexGrow: 1, justifyContent: 'center', fontSize: '0.82rem', padding: '10px 0' }}
              >
                Proceed To Checkout
              </Link>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
