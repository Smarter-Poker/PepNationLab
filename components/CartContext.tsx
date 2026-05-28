'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

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

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load from local storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('pnl_cart');
      if (stored) {
        setCart(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed To Load Cart From Local Storage:', e);
    }
    setLoaded(true);
  }, []);

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

  const addToCart = (product: Omit<CartItem, 'quantity'>, quantity = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { ...product, quantity }];
    });
    setIsCartOpen(true);
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
        {isCartOpen && <CartDrawer />}
      </AnimatePresence>
    </CartContext.Provider>
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
                        ${((item.bulkCostPrice && item.bulkThreshold && item.quantity >= item.bulkThreshold ? item.bulkCostPrice : item.costPrice) * item.quantity).toFixed(2)}
                      </div>
                      {item.bulkCostPrice && item.bulkThreshold && item.quantity >= item.bulkThreshold && (
                        <div style={{ fontSize: '0.65rem', color: 'var(--teal)' }}>
                          Bulk Discount Applied! (${item.bulkCostPrice.toFixed(2)}/ea)
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
                ${cartSubtotal.toFixed(2)}
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
