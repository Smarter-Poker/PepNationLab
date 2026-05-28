'use client';

import React, { useState, useEffect } from 'react';

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
            street: 'Agent Warehouse Address',
            city: 'Auto City',
            state: 'TX',
            zipCode: '12345',
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
            <span style={{ fontSize: '1.4rem' }}>⚠️</span> Low Stock Smart Alerts
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

          <div style={{ background: 'rgba(0,196,188,0.1)', border: '1px solid var(--teal)', borderRadius: 8, padding: 'var(--space-4)' }}>
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
          <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th>Product Name</th>
                <th>SKU</th>
                <th>Category</th>
                <th style={{ width: 150 }}>Stock Count</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{item.name}</td>
                  <td style={{ color: 'var(--grey-400)' }}>{item.sku || 'N/A'}</td>
                  <td>
                    <span style={{ 
                      background: 'rgba(255,255,255,0.05)', 
                      padding: '2px 8px', 
                      borderRadius: 4,
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      {item.category}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button 
                        className="btn btn-sm"
                        style={{ padding: '0 8px', height: 28, background: 'var(--surface-3)', border: 'none' }}
                        onClick={() => updateStock(item.id, item.stock_count - 1)}
                        disabled={savingId === item.id || item.stock_count <= 0}
                      >
                        -
                      </button>
                      <input 
                        type="number"
                        value={item.stock_count}
                        onChange={(e) => updateStock(item.id, parseInt(e.target.value) || 0)}
                        disabled={savingId === item.id}
                        style={{ 
                          width: 60, 
                          height: 28, 
                          textAlign: 'center', 
                          background: 'var(--black)',
                          border: '1px solid var(--surface-3)',
                          color: 'var(--white)',
                          borderRadius: 4
                        }}
                      />
                      <button 
                        className="btn btn-sm"
                        style={{ padding: '0 8px', height: 28, background: 'var(--surface-3)', border: 'none' }}
                        onClick={() => updateStock(item.id, item.stock_count + 1)}
                        disabled={savingId === item.id}
                      >
                        +
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
