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
    <div className="metal-frame">
      <div className="metal-content" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <h3 className="metal-text" style={{ fontSize: '1.25rem', margin: 0, fontFamily: 'var(--font-brand)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Create Manual Shipment Order
        </h3>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          
          {/* Customer Details */}
          <div className="metal-embossed-panel" style={{ padding: '24px' }}>
            <h4 style={{ fontSize: '1rem', color: '#00E5FF', marginBottom: '20px', fontFamily: 'var(--font-brand)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(0,229,255,0.2)', paddingBottom: '10px' }}>Customer & Shipping Details</h4>
            <div className="grid-2" style={{ gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label" style={{ color: 'rgba(255,255,255,0.6)' }}>Full Name</label>
                <input type="text" className="form-input" style={{ background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)', color: '#fff' }} required value={buyerName} onChange={e => setBuyerName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ color: 'rgba(255,255,255,0.6)' }}>Email (Optional)</label>
                <input type="email" className="form-input" style={{ background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)', color: '#fff' }} value={buyerEmail} onChange={e => setBuyerEmail(e.target.value)} />
              </div>
            </div>
            
            <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
              <label className="form-label" style={{ color: 'rgba(255,255,255,0.6)' }}>Street Address</label>
              <input type="text" className="form-input" style={{ background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)', color: '#fff' }} required value={street} onChange={e => setStreet(e.target.value)} />
            </div>
            
            <div className="grid-3" style={{ gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label" style={{ color: 'rgba(255,255,255,0.6)' }}>City</label>
                <input type="text" className="form-input" style={{ background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)', color: '#fff' }} required value={city} onChange={e => setCity(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ color: 'rgba(255,255,255,0.6)' }}>State</label>
                <input type="text" className="form-input" style={{ background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)', color: '#fff' }} required value={state} onChange={e => setState(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ color: 'rgba(255,255,255,0.6)' }}>ZIP Code</label>
                <input type="text" className="form-input" style={{ background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)', color: '#fff' }} required value={zip} onChange={e => setZip(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="metal-embossed-panel" style={{ padding: '24px' }}>
            <h4 style={{ fontSize: '1rem', color: '#00E5FF', marginBottom: '20px', fontFamily: 'var(--font-brand)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(0,229,255,0.2)', paddingBottom: '10px' }}>Order Items</h4>
            
            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', marginBottom: 'var(--space-6)' }}>
              <div className="form-group" style={{ flexGrow: 1, marginBottom: 0 }}>
                <label className="form-label" style={{ color: 'rgba(255,255,255,0.6)' }}>Select Product</label>
                <select className="form-input" style={{ background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)', color: '#fff' }} value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)}>
                  {products.map(p => {
                    const name = p.custom_name || p.products.name;
                    const size = p.products.unit_size ? ` (${p.products.unit_size}${p.products.unit_measure})` : '';
                    return (
                      <option key={p.product_id} value={p.product_id}>{name}{size} — ${p.retail_price}</option>
                    );
                  })}
                </select>
              </div>
              <button type="button" onClick={handleAddToCart} className="btn-silver" style={{ height: 42, padding: '0 24px', fontSize: '0.85rem' }}>
                Add To Cart
              </button>
            </div>

            {cart.length > 0 ? (
              <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '16px' }}>
                {cart.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <span style={{ color: '#fff', fontWeight: 600 }}>{item.quantity}x {item.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                      <span style={{ color: '#00E5FF', fontWeight: 700 }}>${(item.price * item.quantity).toFixed(2)}</span>
                      <button type="button" onClick={() => handleRemoveFromCart(item.product_id)} className="badge-metal" style={{ background: 'rgba(229,62,62,0.1)', color: '#FC8181', border: '1px solid rgba(229,62,62,0.3)', cursor: 'pointer', padding: '4px 8px', fontSize: '1rem', lineHeight: 1 }}>×</button>
                    </div>
                  </div>
                ))}
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <div style={{ width: 220 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
                      <span>Subtotal</span>
                      <span style={{ color: '#fff' }}>${subtotal.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
                      <span>Shipping</span>
                      <span style={{ color: '#fff' }}>${shippingCost.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px dashed rgba(255,255,255,0.15)', fontSize: '1.1rem', color: '#fff', fontWeight: 800 }}>
                      <span>Total</span>
                      <span style={{ color: '#00E5FF', textShadow: '0 0 10px rgba(0,229,255,0.3)' }}>${total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '32px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px' }}>
                <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.3)' }}>Cart Is Empty. Add products above.</p>
              </div>
            )}
          </div>

          {/* Payment & Submit */}
          <div className="metal-embossed-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '20px' }}>
            <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ width: 180, marginBottom: 0 }}>
                <label className="form-label" style={{ color: 'rgba(255,255,255,0.6)' }}>Payment Received Via</label>
                <select className="form-input" style={{ background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)', color: '#fff' }} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                  <option value="cashapp">Cash App</option>
                  <option value="venmo">Venmo</option>
                  <option value="apple_pay">Apple Pay</option>
                  <option value="zelle">Zelle</option>
                  <option value="crypto">Crypto</option>
                  <option value="cash">Cash / Offline</option>
                </select>
              </div>
              <div className="form-group" style={{ width: 120, marginBottom: 0 }}>
                <label className="form-label" style={{ color: 'rgba(255,255,255,0.6)' }}>Shipping Cost ($)</label>
                <input type="number" className="form-input" style={{ background: 'var(--bg-metal-dark)', border: '1px solid rgba(0,0,0,0.8)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)', color: '#fff' }} value={shippingCostInput} onChange={e => setShippingCostInput(e.target.value)} />
              </div>
            </div>
            
            <button type="submit" className="btn-neon-cyan" disabled={submitting || cart.length === 0} style={{ padding: '12px 32px', fontSize: '1rem', fontWeight: 800 }}>
              {submitting ? 'Creating Order...' : 'CREATE ORDER'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
