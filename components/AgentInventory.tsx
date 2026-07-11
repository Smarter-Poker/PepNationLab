'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Search, X } from 'lucide-react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import CreditWallAction from '@/components/wallet/CreditWallAction';

interface AgentInventoryItem {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  stock_count: number;
  image_url?: string;
  unit_size?: string;
  unit_measure?: string;
  agent_cost?: number;
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

type FilterMode = 'all' | 'in-stock' | 'out-of-stock';

export default function AgentInventory({ agentId }: { agentId: string }) {
  const [inventory, setInventory] = useState<AgentInventoryItem[]>([]);
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [suggestedCart, setSuggestedCart] = useState<SuggestedCartItem[]>([]);
  const [showWarningModal, setShowWarningModal] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [restockStatus, setRestockStatus] = useState('');

  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'flat' | 'category'>('flat');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStock, setEditStock] = useState<number>(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
        setError(json.error || 'Failed To Load Inventory');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
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
    } catch (err: unknown) {
      console.error('Failed to load reorder suggestions', err);
    }
  }

  async function updateStock(productId: string, newStock: number) {
    if (newStock < 0) return;
    setSavingId(productId);
    setError('');
    
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
        throw new Error(json.error || 'Failed To Update Stock');
      }
      toast.success('Inventory Stock Updated Successfully');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed To Update Stock';
      setError(msg);
      toast.error(msg);
      fetchInventory();
    } finally {
      setSavingId(null);
    }
  }

  async function handleSaveStock(e: React.FormEvent, productId: string) {
    e.preventDefault();
    await updateStock(productId, editStock);
    setEditingId(null);
  }

  async function handleOneClickRestock() {
    if (suggestedCart.length === 0) return;

    const supabase = createClient();
    const { data: profile, error: profileErr } = await supabase
      .from('agent_profiles')
      .select('warehouse_address, display_name')
      .eq('id', agentId)
      .maybeSingle();
    if (profileErr) {
      toast.error('Failed To Verify Warehouse Address');
      return;
    }
    const wh = (profile?.warehouse_address || {}) as Record<string, string>;
    const missing = !wh?.street1 || !wh?.city || !wh?.state || !wh?.zip;
    if (missing) {
      toast.error('Set Your Warehouse Address In Storefront Config Before Restocking');
      return;
    }

    setRestockStatus('Processing Wholesale Restock...');
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: suggestedCart.map(item => ({ id: item.id, quantity: item.quantity })),
          fulfillmentMethod: 'ship',
          paymentMethod: 'zelle',
          shippingAddress: {
            fullName: profile?.display_name || 'Agent Restock',
            street: wh.street1,
            suite: wh.street2 || '',
            city: wh.city,
            state: wh.state,
            zip: wh.zip,
            phone: ''
          },
          wholesale: true
        })
      });
      const json = await res.json();
      if (res.ok) {
        setRestockStatus('Wholesale Order Placed Successfully! Allow 10-15 Days For Shipping.');
        setAlerts([]);
        setSuggestedCart([]);
        setTimeout(() => fetchInventory(), 2000);
      } else {
        setRestockStatus(`Error: ${json.error}`);
      }
    } catch (err: unknown) {
      setRestockStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  const filtered = inventory.filter(p => {
    if (filter === 'in-stock') return p.stock_count > 0;
    if (filter === 'out-of-stock') return p.stock_count === 0;
    return true;
  });

  const effectiveViewMode = viewMode;
  const searchTerm = search.trim().toLowerCase();
  const rawSearchFiltered = !searchTerm ? filtered : filtered.filter(p => {
    return p.name.toLowerCase().includes(searchTerm);
  });

  const getSortWeight = (p: AgentInventoryItem) => {
    const n = p.name.toLowerCase();
    if (n.includes('klow')) return 1;
    if (n.includes('tirzepatide')) return 2;
    if (n.includes('semaglutide')) return 3;
    if (n.includes('glow')) return 4;
    if (n.includes('sermorelin') || n.includes('semorelin')) return 5;
    if (n.includes('bpc') && n.includes('157')) return 6;
    const cat = p.category?.toLowerCase() || '';
    if (cat.includes('popular')) return 10;
    return 20;
  };

  const searchFiltered = [...rawSearchFiltered].sort((a, b) => {
    const wA = getSortWeight(a);
    const wB = getSortWeight(b);
    if (wA !== wB) return wA - wB;
    return a.name.localeCompare(b.name);
  });

  const grouped = searchFiltered.reduce<Record<string, AgentInventoryItem[]>>((acc, p) => {
    const cat = p.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});
  const sortedCategories = Object.keys(grouped).sort();

  const inStockCount = inventory.filter(p => p.stock_count > 0).length;
  const outOfStockCount = inventory.filter(p => p.stock_count === 0).length;

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <p style={{ color: 'var(--teal)', fontSize: '1rem' }}>Loading Inventory...</p>
      </div>
    );
  }

  const renderProductRow = (item: AgentInventoryItem) => {
    const isEditing = editingId === item.id;
    const sizeLabel = item.unit_size && item.unit_measure
      ? `${item.unit_size}${item.unit_measure}`
      : '';
    
    return (
      <div
        key={item.id}
        className="glass-panel"
        style={{
          padding: 'var(--space-4) var(--space-5)',
          margin: 0,
          borderRadius: 0,
          borderLeft: 'none', borderRight: 'none',
          opacity: 1,
          transition: 'opacity 0.2s',
        }}
      >
        {isEditing ? (
          <form onSubmit={(e) => handleSaveStock(e, item.id)} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <Image
                src={item.image_url || '/images/peptide_clear.png'}
                alt={item.name}
                width={60}
                height={60}
                style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}
                onError={(e) => { const target = e.target as HTMLImageElement; if (!target.src.includes('/images/peptide_clear.png')) { target.srcset = ''; target.src = '/images/peptide_clear.png'; } }}
                unoptimized
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                  {item.name}
                  {sizeLabel && <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px', marginLeft: 8 }}>{sizeLabel}</span>}
                  <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', marginLeft: 8 }}>{item.category}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-3)' }}>
              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                <label className="form-label" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>Adjust Stock Count</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button 
                    type="button"
                    className="btn-silver"
                    style={{ padding: '0', width: '38px', height: '38px', flexShrink: 0 }}
                    onClick={() => setEditStock(Math.max(0, editStock - 1))}
                    disabled={editStock <= 0}
                  >
                    -
                  </button>
                  <input 
                    type="number"
                    value={editStock}
                    onChange={(e) => setEditStock(parseInt(e.target.value) || 0)}
                    style={{ 
                      flex: 1,
                      height: 38, 
                      textAlign: 'center', 
                      background: 'var(--bg-metal-dark)',
                      border: '1px solid rgba(0,0,0,0.8)',
                      boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.9)',
                      color: 'var(--white)',
                      borderRadius: 6,
                      fontWeight: 700,
                      fontSize: '1.1rem'
                    }}
                  />
                  <button 
                    type="button"
                    className="btn-silver"
                    style={{ padding: '0', width: '38px', height: '38px', flexShrink: 0 }}
                    onClick={() => setEditStock(editStock + 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 8 }}>
              <button type="submit" disabled={savingId === item.id} className="btn-neon-cyan" style={{ padding: '6px 16px', fontSize: '0.85rem' }}>
                {savingId === item.id ? 'Saving...' : 'Save Stock'}
              </button>
              <button type="button" onClick={() => setEditingId(null)} className="btn-silver" style={{ padding: '6px 16px', fontSize: '0.85rem' }}>Cancel</button>
            </div>
          </form>
        ) : (
          <div className="agentprod-card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <Image
              src={item.image_url || '/images/peptide_clear.png'}
              alt={item.name}
              width={80}
              height={80}
              style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}
              onError={(e) => { const target = e.target as HTMLImageElement; if (!target.src.includes('/images/peptide_clear.png')) { target.srcset = ''; target.src = '/images/peptide_clear.png'; } }}
              unoptimized
            />
            <div className="agentprod-info" style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>{item.name}</span>
                {sizeLabel && <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>{sizeLabel}</span>}
                <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>{item.category}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {item.agent_cost != null && item.agent_cost > 0 && (
                  <>
                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Your Cost:</span>
                    <span style={{ fontSize: '0.82rem', color: '#68D391', fontWeight: 700 }}>
                      ${(item.agent_cost / 10).toFixed(2)} / Vial
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)' }}>&rarr;</span>
                  </>
                )}
                <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', marginTop: 2, marginBottom: 0 }}>
                  Stock: <strong style={{ color: item.stock_count > 0 ? '#00E5FF' : '#FFAAAA' }}>{item.stock_count}</strong>
                </span>
              </div>
            </div>
            
            <div className="agentprod-actions" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button 
                onClick={() => { setEditingId(item.id); setEditStock(item.stock_count); }}
                className="btn-silver" 
                style={{ padding: '6px 16px', fontSize: '0.8rem', borderRadius: 20 }}
              >
                Edit
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {showWarningModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)'
        }}>
          <button 
            type="button" 
            onClick={() => setShowWarningModal(false)}
            style={{ 
              background: 'transparent', border: 'none', padding: 0, 
              cursor: 'pointer', maxWidth: 650, width: '100%',
              transition: 'transform 0.2s ease', 
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <Image 
              src="/images/inventory-warning.png" 
              alt="Important Warning: In-Stock Inventory Priority" 
              width={650}
              height={300}
              style={{ width: '100%', height: 'auto', display: 'block' }} 
              unoptimized
            />
          </button>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="glass-panel">
          <div className="" style={{ borderLeft: '4px solid var(--orange)' }}>
            <h3 className="metal-text" style={{ fontSize: '1.2rem', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={20} color="var(--orange)" aria-hidden="true" /> <span style={{ color: 'var(--orange)' }}>Low Stock Smart Alerts</span>
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--grey-300)', marginBottom: 'var(--space-4)' }}>
              Based On Your 30-Day Run Rate And Our 10-15 Day Shipping Transit Time From China, You Are At Risk Of Stocking Out Of The Following Items:
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
              {alerts.map(alert => (
                <div key={alert.product_id} className="glass-panel" style={{ padding: '12px 16px', fontSize: '0.85rem' }}>
                  <strong style={{ color: 'var(--white)' }}>{alert.name}</strong> - {alert.message} 
                  <span style={{ marginLeft: 12, color: '#00E5FF' }}>(Stock: {alert.current_stock} / Reorder Point: {alert.reorder_point})</span>
                </div>
              ))}
            </div>

            <div className="glass-panel" style={{ border: '1px solid rgba(0, 196, 188, 0.3)' }}>
              <h4 className="metal-text" style={{ marginBottom: 'var(--space-2)' }}>Weekly Suggested Reorder Cart</h4>
              <ul style={{ margin: '0 0 var(--space-4) 20px', fontSize: '0.85rem', color: 'var(--grey-200)' }}>
                {suggestedCart.map(item => (
                  <li key={item.id}>{item.quantity}x {item.name}</li>
                ))}
              </ul>
              
              <button className="btn-neon-cyan" onClick={handleOneClickRestock} disabled={restockStatus.includes('Processing')}>
                1-Click Checkout Wholesale Cart
              </button>
              {restockStatus && (
                <p style={{ marginTop: 'var(--space-3)', fontSize: '0.85rem', color: restockStatus.includes('Error') ? '#FFAAAA' : '#00E5FF' }}>
                  {restockStatus}
                </p>
              )}
              {restockStatus.includes('Credit Limit') && <CreditWallAction />}
            </div>
          </div>
        </div>
      )}

      <div className="glass-panel">
        <div className="" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
            <div>
              <h3 className="metal-text" style={{ fontSize: '1.25rem', margin: 0, fontFamily: 'var(--font-brand)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Local Inventory Stock
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', margin: '4px 0 0' }}>
                Manage Your On-Hand Stock. Decrements Automatically On Purchases.
              </p>
            </div>
            <div className="agentprod-header-controls" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="agentprod-view-toggle" style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.5)', borderRadius: '4px', padding: 3, border: '1px solid rgba(255,255,255,0.05)' }}>
                {( [['flat', 'All'], ['category', 'By Category']] as ['flat' | 'category', string][] ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setViewMode(key)}
                    style={{
                      padding: '5px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer',
                      fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.2s',
                      background: viewMode === key ? 'rgba(0,229,255,0.1)' : 'transparent',
                      color: viewMode === key ? '#00E5FF' : 'rgba(255,255,255,0.4)',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="agentprod-filter-chips" style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.5)', borderRadius: '4px', padding: 3, border: '1px solid rgba(255,255,255,0.05)' }}>
              {( [['all', `All (${inventory.length})`], ['in-stock', `In Stock (${inStockCount})`], ['out-of-stock', `Out (${outOfStockCount})`]] as [FilterMode, string][] ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  style={{
                    padding: '6px 14px', border: 'none', borderRadius: '4px', cursor: 'pointer',
                    fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.2s',
                    background: filter === key ? 'rgba(0,229,255,0.1)' : 'transparent',
                    color: filter === key ? '#00E5FF' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {label}
                </button>
              ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <input
        type="search"
        placeholder="Search Inventory By Name..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: '100%',
          padding: '12px 14px',
          fontSize: '0.95rem',
          background: 'var(--bg-metal-dark)',
          border: '1px solid rgba(0,0,0,0.8)',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
          color: '#fff',
          borderRadius: 8,
          marginBottom: 'var(--space-4)'
        }}
      />

      {error && (
        <div className="glass-panel" style={{ border: '1px solid rgba(229,62,62,0.3)', padding: 'var(--space-3)', fontSize: '0.85rem', color: '#FC8181' }}>
          {error}
        </div>
      )}

      {effectiveViewMode === 'flat' && (
        <div className="glass-panel">
          <div className="" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'rgba(255,255,255,0.05)' }}>
              {searchFiltered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
                  <p style={{ color: 'var(--grey-400)' }}>No Items Match Your Criteria.</p>
                </div>
              ) : (
                searchFiltered.map(renderProductRow)
              )}
            </div>
          </div>
        </div>
      )}

      {effectiveViewMode === 'category' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {sortedCategories.length === 0 && (
            <div className="glass-panel"><div className="" style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--grey-400)' }}>No Items Match Your Criteria.</div></div>
          )}
          {sortedCategories.map(cat => (
            <div key={cat} className="glass-panel">
              <div className="" style={{ padding: 0, overflow: 'hidden' }}>
                <h4 style={{ padding: '12px 20px', margin: 0, background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#00E5FF', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {cat} <span style={{ color: 'rgba(255,255,255,0.3)', marginLeft: 8 }}>({grouped[cat].length})</span>
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'rgba(255,255,255,0.05)' }}>
                  {grouped[cat].map(renderProductRow)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
