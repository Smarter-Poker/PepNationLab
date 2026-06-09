'use client';

import { useEffect, useState } from 'react';

interface Product {
  id: string;
  name: string;
  slug: string;
  category: string;
  base_cost: number;
  admin_price: number;
  weight_oz: number;
  inventory_count: number;
  sku: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

const PAYMENT_METHODS = [
  { value: 'zelle', label: 'Zelle' },
  { value: 'cashapp', label: 'Cash App' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'apple_pay', label: 'Apple Pay' },
];

export default function AdminStorePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('zelle');
  const [submitting, setSubmitting] = useState(false);
  const [successOrderId, setSuccessOrderId] = useState('');
  const [orderError, setOrderError] = useState('');

  useEffect(() => {
    fetch('/api/admin/admin-store')
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); } else { setProducts(d.products ?? []); }
      })
      .catch(() => setError('Failed To Load Products'))
      .finally(() => setLoading(false));
  }, []);

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category))).sort()];
  const filtered = selectedCategory === 'All' ? products : products.filter(p => p.category === selectedCategory);

  function addToCart(product: Product) {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function updateQty(productId: string, qty: number) {
    if (qty < 1) {
      setCart(prev => prev.filter(i => i.product.id !== productId));
    } else {
      setCart(prev => prev.map(i => i.product.id === productId ? { ...i, quantity: qty } : i));
    }
  }

  function removeFromCart(productId: string) {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  }

  const cartTotal = cart.reduce((sum, i) => sum + i.product.admin_price * i.quantity, 0);

  async function placeOrder() {
    if (cart.length === 0) return;
    setSubmitting(true);
    setOrderError('');
    try {
      const res = await fetch('/api/admin/admin-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(i => ({ product_id: i.product.id, quantity: i.quantity })),
          payment_method: paymentMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setOrderError(data.error || 'Order Failed');
      } else {
        setSuccessOrderId(data.orderId);
        setCart([]);
      }
    } catch {
      setOrderError('Network Error -- Please Try Again');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: '#A8B4C0' }}>
        Loading Products...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', color: '#E53E3E' }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '1.5rem', padding: '1.5rem', minHeight: '100vh', background: '#050A0F' }}>
      {/* Main product grid */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ color: '#FFFFFF', fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Admin Store
          </h1>
          <p style={{ color: '#A8B4C0', fontSize: '0.875rem' }}>
            All Products At Base Cost x 2 -- Direct Purchase
          </p>
        </div>

        {/* Category filter */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '0.375rem 0.875rem',
                borderRadius: '9999px',
                border: '1px solid',
                borderColor: selectedCategory === cat ? '#00C4BC' : '#1D2D3E',
                background: selectedCategory === cat ? 'rgba(0,196,188,0.12)' : 'transparent',
                color: selectedCategory === cat ? '#00C4BC' : '#A8B4C0',
                fontSize: '0.8125rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
          {filtered.map(product => {
            const inCart = cart.find(i => i.product.id === product.id);
            return (
              <div
                key={product.id}
                className="card"
                style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{
                    fontSize: '0.6875rem',
                    color: '#00C4BC',
                    background: 'rgba(0,196,188,0.1)',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    {product.category}
                  </span>
                  {product.inventory_count !== null && product.inventory_count < 10 && (
                    <span style={{ fontSize: '0.6875rem', color: '#FC8181' }}>
                      {product.inventory_count} Left
                    </span>
                  )}
                </div>
                <div style={{ color: '#FFFFFF', fontWeight: 600, fontSize: '0.9375rem', lineHeight: 1.3 }}>
                  {product.name}
                </div>
                {product.sku && (
                  <div style={{ color: '#A8B4C0', fontSize: '0.75rem' }}>SKU: {product.sku}</div>
                )}
                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ color: '#00C4BC', fontWeight: 700, fontSize: '1.0625rem' }}>
                      ${product.admin_price.toFixed(2)}
                    </div>
                    <div style={{ color: '#A8B4C0', fontSize: '0.75rem' }}>
                      Base: ${Number(product.base_cost).toFixed(2)}
                    </div>
                  </div>
                  {inCart ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        onClick={() => updateQty(product.id, inCart.quantity - 1)}
                        style={{
                          width: 28, height: 28, borderRadius: '50%', border: '1px solid #1D2D3E',
                          background: '#0F1923', color: '#FFFFFF', cursor: 'pointer', fontFamily: 'inherit',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
                        }}
                      >
                        -
                      </button>
                      <span style={{ color: '#FFFFFF', minWidth: 20, textAlign: 'center' }}>{inCart.quantity}</span>
                      <button
                        onClick={() => updateQty(product.id, inCart.quantity + 1)}
                        style={{
                          width: 28, height: 28, borderRadius: '50%', border: '1px solid #1D2D3E',
                          background: '#0F1923', color: '#FFFFFF', cursor: 'pointer', fontFamily: 'inherit',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
                        }}
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(product)}
                      className="btn-primary"
                      style={{ padding: '0.375rem 0.875rem', fontSize: '0.8125rem' }}
                    >
                      Add To Cart
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div style={{ color: '#A8B4C0', textAlign: 'center', paddingTop: '3rem' }}>
            No Products In This Category
          </div>
        )}
      </div>

      {/* Cart sidebar */}
      <div style={{
        width: 320,
        flexShrink: 0,
        background: '#0F1923',
        borderRadius: 12,
        border: '1px solid #1D2D3E',
        padding: '1.25rem',
        alignSelf: 'flex-start',
        position: 'sticky',
        top: '1.5rem',
      }}>
        <h2 style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '1.0625rem', marginBottom: '1rem' }}>
          Order Summary
        </h2>

        {successOrderId && (
          <div style={{
            background: 'rgba(0,196,188,0.1)',
            border: '1px solid rgba(0,196,188,0.3)',
            borderRadius: 8,
            padding: '0.875rem',
            marginBottom: '1rem',
            color: '#00C4BC',
            fontSize: '0.875rem',
          }}>
            Order Placed Successfully
            <div style={{ color: '#A8B4C0', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              Order ID: {successOrderId}
            </div>
          </div>
        )}

        {cart.length === 0 ? (
          <div style={{ color: '#A8B4C0', fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0' }}>
            Cart Is Empty
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1rem' }}>
              {cart.map(item => (
                <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#D0DAE4', fontSize: '0.8125rem', fontWeight: 500 }}>
                      {item.product.name}
                    </div>
                    <div style={{ color: '#A8B4C0', fontSize: '0.75rem' }}>
                      {item.quantity} x ${item.product.admin_price.toFixed(2)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: '#FFFFFF', fontWeight: 600, fontSize: '0.875rem' }}>
                      ${(item.product.admin_price * item.quantity).toFixed(2)}
                    </span>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      style={{
                        background: 'none', border: 'none', color: '#A8B4C0',
                        cursor: 'pointer', padding: '0 0.25rem', fontSize: '1rem', lineHeight: 1,
                        fontFamily: 'inherit',
                      }}
                      title="Remove"
                    >
                      x
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid #1D2D3E', paddingTop: '0.875rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#FFFFFF', fontWeight: 700 }}>
                <span>Total</span>
                <span>${cartTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment method */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#A8B4C0', fontSize: '0.8125rem', display: 'block', marginBottom: '0.375rem' }}>
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                style={{
                  width: '100%', padding: '0.5rem 0.75rem', borderRadius: 8,
                  border: '1px solid #1D2D3E', background: '#162230',
                  color: '#FFFFFF', fontSize: '0.875rem', fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                {PAYMENT_METHODS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {orderError && (
              <div style={{ color: '#E53E3E', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>
                {orderError}
              </div>
            )}

            <button
              onClick={placeOrder}
              disabled={submitting}
              className="btn-primary"
              style={{ width: '100%', padding: '0.625rem', fontSize: '0.9375rem', opacity: submitting ? 0.6 : 1 }}
            >
              {submitting ? 'Placing Order...' : 'Place Order'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
