'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface AgentInventoryItem {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  stock_count: number;
}

interface SmartAlert {
  product_id: string;
  name: string;
  current_stock: number;
  reorder_point: number;
  daily_run_rate: string;
  message: string;
}

interface SuggestedCartItem {
  id: string;
  name: string;
  quantity: number;
}

export default function AgentInventory({ agentId }: { agentId: string }) {
  const [inventory, setInventory] = useState<AgentInventoryItem[]>([]);
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [suggestedCart, setSuggestedCart] = useState<SuggestedCartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [restockStatus, setRestockStatus] = useState('');

  useEffect(() => {
    fetchInventory();
    fetchReorderSuggestions();
  }, [agentId]);

  async function fetchInventory() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/agent/inventory');
      const json = await res.json();
      if (res.ok) {
        setInventory(json.data || []);
      } else {
        setError(json.error || 'Failed to load inventory');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function fetchReorderSuggestions() {
    try {
      const res = await fetch('/api/agent/inventory/reorder');
      const json = await res.json();
      if (res.ok) {
        setAlerts(json.alerts || []);
        setSuggestedCart(json.suggestedCart || []);
      }
    } catch (err: any) {
      console.error('Failed to load reorder suggestions', err);
    }
  }

  async function updateStock(productId: string, newStock: number) {
    if (newStock < 0) return;
    setSavingId(productId);
    setError('');
    
    // Optimistic update
    setInventory(prev => prev.map(item => 
      item.id === productId ? { ...item, stock_count: newStock } : item
    ));

    try {
      const res = await fetch('/api/agent/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, stockCount: newStock })
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to update stock');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update stock');
      fetchInventory(); // Revert optimistic update
    } finally {
      setSavingId(null);
    }
  }

  async function handleOneClickRestock() {
    if (suggestedCart.length === 0) return;

    // Guard: require warehouse_address on agent_profiles before restocking.
    const supabase = createClient();
    const { data: profile, error: profileErr } = await supabase
      .from('agent_profiles')
      .select('warehouse_address')
      .eq('user_id', agentId)
      .maybeSingle();
    if (profileErr) {
      toast.error('Failed To Verify Warehouse Address');
      return;
    }
    const wh = (profile?.warehouse_address || {}) as Record<string, any>;
    const missing = !wh?.street1 || !wh?.city || !wh?.state || !wh?.zip;
    if (missing) {
      toast.error('Set Your Warehouse Address In Storefront Config Before Restocking');
      return;
    }

    setRestockStatus('Processing Wholesale Restock...');
    try {
      const res = await fetch('/api/agent/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: suggestedCart,
          fulfillmentMethod: 'ship',
          paymentMethod: 'zelle',
          shippingAddress: {
            street: wh.street1,
            city: wh.city,
            state: wh.state,
            zipCode: wh.zip,
            country: 'US'
          }
        })
      });
      const json = await res.json();
      if (res.ok) {
        setRestockStatus('Wholesale order placed successfully! Allow 10-15 days for shipping.');
        setAlerts([]);
        setSuggestedCart([]);
        setTimeout(() => fetchInventory(), 2000);
      } else {
        setRestockStatus(`Error: ${json.error}`);
      }
    } catch (err: any) {
      setRestockStatus(`Error: ${err.message}`);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <p style={{ color: 'var(--teal)', fontSize: '1rem' }}>Loading Inventory...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Smart Alerts Banner */}
      {alerts.length > 0 && (
        <div className="card-metal" style={{ borderLeft: '4px solid var(--orange)', padding: 'var(--space-6)' }}>
          <h3 style={{ fontSize: '1.2rem', color: 'var(--orange)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={20} aria-hidden="true" /> Low Stock Smart Alerts
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--grey-300)', marginBottom: 'var(--space-4)' }}>
            Based on your 30-day run rate and our 10-15 day shipping transit time from China, you are at risk of stocking out of the following items:
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
            {alerts.map(alert => (
              <div key={alert.product_id} style={{ background: 'rgba(255,255,255,0.03)', padding: 'var(--space-3)', borderRadius: 8, fontSize: '0.85rem' }}>
                <strong style={{ color: 'var(--white)' }}>{alert.name}</strong> — {alert.message} 
                <span style={{ marginLeft: 12, color: 'var(--teal)' }}>(Stock: {alert.current_stock} / Reorder Point: {alert.reorder_point})</span>
              </div>
            ))}
          </div>

          <div style={{ background: 'rgba(192,184,168,0.1)', border: '1px solid var(--teal)', borderRadius: 8, padding: 'var(--space-4)' }}>
            <h4 style={{ color: 'var(--teal)', marginBottom: 'var(--space-2)' }}>Weekly Suggested Reorder Cart</h4>
            <ul style={{ margin: '0 0 var(--space-4) 20px', fontSize: '0.85rem', color: 'var(--grey-200)' }}>
              {suggestedCart.map(item => (
                <li key={item.id}>{item.quantity}x {item.name}</li>
              ))}
            </ul>
            
            <button className="btn btn-primary" onClick={handleOneClickRestock} disabled={restockStatus.includes('Processing')}>
              1-Click Checkout Wholesale Cart
            </button>
            {restockStatus && (
              <p style={{ marginTop: 'var(--space-3)', fontSize: '0.85rem', color: restockStatus.includes('Error') ? 'var(--red)' : 'var(--teal)' }}>
                {restockStatus}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Main Inventory Table */}
      <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--white)', fontFamily: 'var(--font-brand)', textTransform: 'uppercase' }}>
            Local Inventory Stock
          </h3>
        </div>
        <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', marginBottom: 'var(--space-6)' }}>
          Manage your on-hand stock. When your researchers purchase from your storefront, this inventory will automatically decrement. Products with 0 stock will show as "Out of Stock".
        </p>

        {error && (
          <div style={{ background: 'rgba(229,62,62,0.1)', border: '1px solid rgba(229,62,62,0.3)', borderRadius: 8, padding: 'var(--space-3)', marginBottom: 'var(--space-4)', fontSize: '0.85rem', color: 'var(--red)' }}>
            {error}
          </div>
        )}

        {inventory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
            <p style={{ color: 'var(--grey-400)' }}>No active products available to track inventory for.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {inventory.map((item: any) => (
              <div 
                key={item.id} 
                style={{
                  background: 'linear-gradient(180deg, #0b0f16 0%, #121822 100%)',
                  borderTop: '1px solid rgba(0,0,0,0.8)',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  borderLeft: '1px solid rgba(0,0,0,0.5)',
                  borderRight: '1px solid rgba(255,255,255,0.03)',
                  boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.9)',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 200px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Product Name</span>
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--white)' }}>{item.name}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>SKU</span>
                  <span style={{ fontSize: '0.9rem', color: 'var(--silver)' }}>{item.sku || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Category</span>
                  <div>
                    <span className="badge badge-silver">{item.category}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '150px', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Stock Count</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button 
                      style={{ padding: '0 8px', height: 28, background: 'var(--surface-3)', border: 'none', borderRadius: '6px', color: 'var(--white)', cursor: 'pointer' }}
                      onClick={() => updateStock(item.id, item.stock_count - 1)}
                      disabled={savingId === item.id || item.stock_count <= 0}
                    >
                      -
                    </button>
                    <input 
                      type="number"
                      value={item.stock_count}
                      onChange={(e) => setInventory(prev => prev.map(i => i.id === item.id ? { ...i, stock_count: parseInt(e.target.value) || 0 } : i))}
                      onBlur={(e) => updateStock(item.id, parseInt(e.target.value) || 0)}
                      disabled={savingId === item.id}
                      style={{ 
                        width: 60, 
                        height: 28, 
                        textAlign: 'center', 
                        background: 'var(--black)',
                        border: '1px solid var(--surface-3)',
                        color: 'var(--white)',
                        borderRadius: 6,
                        fontWeight: 700
                      }}
                    />
                    <button 
                      style={{ padding: '0 8px', height: 28, background: 'var(--surface-3)', border: 'none', borderRadius: '6px', color: 'var(--white)', cursor: 'pointer' }}
                      onClick={() => updateStock(item.id, item.stock_count + 1)}
                      disabled={savingId === item.id}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
