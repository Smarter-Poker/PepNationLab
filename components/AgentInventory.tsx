'use client';

import React, { useState, useEffect } from 'react';

interface AgentInventoryItem {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  stock_count: number;
}

export default function AgentInventory({ agentId }: { agentId: string }) {
  const [inventory, setInventory] = useState<AgentInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetchInventory();
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

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <p style={{ color: 'var(--teal)', fontSize: '1rem' }}>Loading Inventory...</p>
      </div>
    );
  }

  return (
    <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
        <h3 style={{ fontSize: '1.1rem', color: 'var(--white)', fontFamily: 'var(--font-brand)', textTransform: 'uppercase' }}>
          Local Inventory Stock
        </h3>
      </div>
      <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', marginBottom: 'var(--space-6)' }}>
        Manage your on-hand stock. When your researchers purchase from your storefront, this inventory will automatically decrement. Products with 0 stock will show as &quot;Out of Stock&quot;.
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
  );
}
