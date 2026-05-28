'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface AgentProduct {
  product_id: string;
  custom_name: string | null;
  retail_price: number;
  products: {
    name: string;
    unit_size: string | null;
    unit_measure: string | null;
  };
}

export default function AgentManualOrder({ onOrderCreated }: { onOrderCreated: (order: any) => void }) {
  const [products, setProducts] = useState<AgentProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cashapp');
  const [shippingCostInput, setShippingCostInput] = useState('10');
  
  const [cart, setCart] = useState<Array<{ product_id: string; quantity: number; price: number; name: string }>>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/agent/products')
      .then(res => res.json())
      .then(data => {
        if (data.data) {
          const visibleProducts = data.data.filter((p: any) => p.is_visible);
          setProducts(visibleProducts);
          if (visibleProducts.length > 0) {
            setSelectedProductId(visibleProducts[0].product_id);
          }
        }
        setLoading(false);
      });
  }, []);

  const handleAddToCart = () => {
    const product = products.find(p => p.product_id === selectedProductId);
    if (!product) return;

    setCart(prev => {
      const existing = prev.find(item => item.product_id === selectedProductId);
      if (existing) {
        return prev.map(item => item.product_id === selectedProductId ? { ...item, quantity: item.quantity + 1 } : item);
      }
      const displayName = product.custom_name || product.products.name;
      const sizeStr = product.products.unit_size ? ` (${product.products.unit_size}${product.products.unit_measure || ''})` : '';
      return [...prev, {
        product_id: product.product_id,
        quantity: 1,
        price: product.retail_price,
        name: displayName + sizeStr
      }];
    });
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product_id !== productId));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shippingCost = Number(shippingCostInput) || 0;
  const total = subtotal + (cart.length > 0 ? shippingCost : 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      toast.error('Cart Is Empty.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/agent/orders/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerName, buyerEmail, street, city, state, zip,
          paymentMethod,
          items: cart,
          total,
          shippingCost
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed To Create Manual Order');

      toast.success('Manual Order Created Successfully');
      onOrderCreated(data.order); // Trigger parent refresh or view toggle
    } catch (err: any) {
      toast.error(err.message || 'An Error Occurred');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 'var(--space-4)', color: 'var(--grey-400)' }}>Loading Products...</div>;
  }

  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <h3 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-6)', fontFamily: 'var(--font-brand)' }}>Create Manual Shipment Order</h3>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        
        {/* Customer Details */}
        <div>
          <h4 style={{ fontSize: '0.9rem', color: 'var(--teal)', marginBottom: 'var(--space-3)' }}>Customer & Shipping Details</h4>
          <div className="grid-2" style={{ gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input type="text" className="form-input" required value={buyerName} onChange={e => setBuyerName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Email (Optional)</label>
              <input type="email" className="form-input" value={buyerEmail} onChange={e => setBuyerEmail(e.target.value)} />
            </div>
          </div>
          
          <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
            <label className="form-label">Street Address</label>
            <input type="text" className="form-input" required value={street} onChange={e => setStreet(e.target.value)} />
          </div>
          
          <div className="grid-3" style={{ gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">City</label>
              <input type="text" className="form-input" required value={city} onChange={e => setCity(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">State</label>
              <input type="text" className="form-input" required value={state} onChange={e => setState(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">ZIP Code</label>
              <input type="text" className="form-input" required value={zip} onChange={e => setZip(e.target.value)} />
            </div>
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)' }} />

        {/* Order Items */}
        <div>
          <h4 style={{ fontSize: '0.9rem', color: 'var(--teal)', marginBottom: 'var(--space-3)' }}>Order Items</h4>
          
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', marginBottom: 'var(--space-4)' }}>
            <div className="form-group" style={{ flexGrow: 1, marginBottom: 0 }}>
              <label className="form-label">Select Product</label>
              <select className="form-input" value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)}>
                {products.map(p => {
                  const name = p.custom_name || p.products.name;
                  const size = p.products.unit_size ? ` (${p.products.unit_size}${p.products.unit_measure})` : '';
                  return (
                    <option key={p.product_id} value={p.product_id}>{name}{size} — ${p.retail_price}</option>
                  );
                })}
              </select>
            </div>
            <button type="button" onClick={handleAddToCart} className="btn btn-secondary" style={{ height: 42 }}>
              Add To Cart
            </button>
          </div>

          {cart.length > 0 ? (
            <div style={{ background: 'var(--black)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
              {cart.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)', paddingBottom: 'var(--space-2)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div>
                    <span style={{ color: 'var(--white)' }}>{item.quantity}x {item.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
                    <span style={{ color: 'var(--teal)' }}>${(item.price * item.quantity).toFixed(2)}</span>
                    <button type="button" onClick={() => handleRemoveFromCart(item.product_id)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '1rem' }}>×</button>
                  </div>
                </div>
              ))}
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
                <div style={{ width: 200 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.85rem', color: 'var(--grey-400)' }}>
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.85rem', color: 'var(--grey-400)' }}>
                    <span>Shipping</span>
                    <span>${shippingCost.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '1rem', color: 'var(--white)', fontWeight: 'bold' }}>
                    <span>Total</span>
                    <span style={{ color: 'var(--teal)' }}>${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '0.85rem', color: 'var(--grey-500)', fontStyle: 'italic' }}>Cart Is Empty.</p>
          )}
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)' }} />

        {/* Payment & Submit */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
            <div className="form-group" style={{ width: 180, marginBottom: 0 }}>
              <label className="form-label">Payment Received Via</label>
              <select className="form-input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                <option value="cashapp">Cash App</option>
                <option value="venmo">Venmo</option>
                <option value="apple_pay">Apple Pay</option>
                <option value="zelle">Zelle</option>
                <option value="crypto">Crypto</option>
                <option value="cash">Cash / Offline</option>
              </select>
            </div>
            <div className="form-group" style={{ width: 120, marginBottom: 0 }}>
              <label className="form-label">Shipping Cost ($)</label>
              <input type="number" className="form-input" value={shippingCostInput} onChange={e => setShippingCostInput(e.target.value)} />
            </div>
          </div>
          
          <button type="submit" className="btn btn-primary" disabled={submitting || cart.length === 0}>
            {submitting ? 'Creating Order...' : 'Create Order'}
          </button>
        </div>

      </form>
    </div>
  );
}
