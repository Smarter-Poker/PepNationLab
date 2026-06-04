'use client';

import { useState, useTransition, useEffect } from 'react';
import { Heart, Trash2, ExternalLink, PackageOpen, History, LayoutGrid, List as ListIcon, Search, X, Check, ShoppingCart, Info, TrendingUp, XCircle } from 'lucide-react';
import Link from 'next/link';
import { getProductImage } from '@/lib/categoryImage';

interface Item {
  product_id: string;
  name: string;
  image_url: string | null;
  category: string | null;
  base_cost: number | null;
  retail_price: number | null;
  in_stock: boolean | null;
  unit_size: string | null;
  unit_measure: string | null;
  last_purchased_date?: string;
  purchase_count?: number;
  viewed_at?: string;
  is_on_sale?: boolean;
  agent_product_id?: string | null;
}

interface Props {
  favorites: Item[];
  pastOrders: Item[];
  recentlyViewed: Item[];
  trending: { id: string; name: string; image_url: string | null; category: string | null; }[];
  categories: string[];
  storefrontSlug: string | null;
}

export default function LabJournalClient({ favorites: initialFavorites, pastOrders, recentlyViewed: initialRecentlyViewed, trending, categories, storefrontSlug }: Props) {
  const [favorites, setFavorites] = useState<Item[]>(initialFavorites);
  const [recentlyViewed, setRecentlyViewed] = useState<Item[]>(initialRecentlyViewed);
  const [, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  
  // UX Features State
  const [activeTab, setActiveTab] = useState<'favorites' | 'recentlyViewed' | 'pastOrders'>('favorites');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'recent' | 'priceAsc' | 'priceDesc' | 'alpha' | 'frequent'>('recent');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [quickViewItem, setQuickViewItem] = useState<Item | null>(null);
  const [localCartIds, setLocalCartIds] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(24);
  const [isComparing, setIsComparing] = useState(false);

  // Check cart status
  useEffect(() => {
    if (!storefrontSlug) return;
    const checkCart = () => {
      try {
        const raw = localStorage.getItem(`pnl_storefront_cart_${storefrontSlug}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          const ids = new Set<string>((parsed.items || []).map((i: any) => i.id));
          setLocalCartIds(ids);
        }
      } catch {}
    };
    checkCart();
    window.addEventListener('storage', checkCart);
    return () => window.removeEventListener('storage', checkCart);
  }, [storefrontSlug]);

  async function removeItem(productId: string) {
    setPendingId(productId);
    try {
      const res = await fetch('/api/researcher/wishlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ productId }),
      });
      if (res.ok) {
        startTransition(() => {
          setFavorites(prev => prev.filter(it => it.product_id !== productId));
          const nextSel = new Set(selectedItems);
          nextSel.delete(productId);
          setSelectedItems(nextSel);
        });
      }
    } finally {
      setPendingId(null);
    }
  }

  async function clearRecentlyViewed() {
    if (!confirm('Are you sure you want to clear your recently viewed history?')) return;
    try {
      const res = await fetch('/api/researcher/recently-viewed', { method: 'DELETE' });
      if (res.ok) {
        startTransition(() => {
          setRecentlyViewed([]);
        });
      }
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  }

  function handleQuickAdd(item: Item, qty = 1) {
    if (!storefrontSlug) return;
    try {
      const storageKey = `pnl_storefront_cart_${storefrontSlug}`;
      const rawCart = localStorage.getItem(storageKey);
      let pnlCart = { items: [] as any[], _savedAt: Date.now() };
      if (rawCart) {
        try { pnlCart = JSON.parse(rawCart); } catch {}
      }

      const existing = pnlCart.items.find((i: any) => i.id === item.product_id);
      if (existing) {
        existing.quantity += qty;
      } else {
        const perVial = item.retail_price ?? item.base_cost ?? 0;
        pnlCart.items.push({
          id: item.product_id,
          name: `${item.name} ${item.unit_size ? `(${item.unit_size}${item.unit_measure || ''})` : ''}`.trim(),
          sku: item.product_id,
          quantity: qty,
          retailPrice: perVial,
          costPrice: perVial,
          weightOz: 0.5,
          agentSelfBuy: false,
        });
      }

      pnlCart._savedAt = Date.now();
      localStorage.setItem(storageKey, JSON.stringify(pnlCart));

      if (item.agent_product_id) {
        const gridKey = `cart_${storefrontSlug}`;
        const rawGrid = localStorage.getItem(gridKey);
        let gridMap: Record<string, number> = {};
        if (rawGrid) {
          try { gridMap = JSON.parse(rawGrid) || {}; } catch {}
        }
        gridMap[item.agent_product_id] = (gridMap[item.agent_product_id] || 0) + qty;
        localStorage.setItem(gridKey, JSON.stringify(gridMap));
      }

      window.dispatchEvent(new Event('storage'));
      
      const nextIds = new Set(localCartIds);
      nextIds.add(item.product_id);
      setLocalCartIds(nextIds);
    } catch (err) {
      console.error('Failed to quick add:', err);
    }
  }

  function handleBulkAdd() {
    if (selectedItems.size === 0) return;
    const baseItems = activeTab === 'favorites' ? favorites : activeTab === 'pastOrders' ? pastOrders : recentlyViewed;
    const toAdd = baseItems.filter(i => selectedItems.has(i.product_id) && i.in_stock !== false);
    toAdd.forEach(i => handleQuickAdd(i, 1));
    setSelectedItems(new Set());
    alert(`Added ${toAdd.length} items to cart!`);
  }

  function toggleSelection(id: string) {
    const next = new Set(selectedItems);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedItems(next);
  }

  // Derived Data
  let currentItems = activeTab === 'favorites' ? favorites : activeTab === 'pastOrders' ? pastOrders : recentlyViewed;

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    currentItems = currentItems.filter(i => i.name.toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q));
  }
  if (filterCategory !== 'all') {
    currentItems = currentItems.filter(i => i.category === filterCategory);
  }

  currentItems = [...currentItems].sort((a, b) => {
    if (sortBy === 'priceAsc') return (a.retail_price || 0) - (b.retail_price || 0);
    if (sortBy === 'priceDesc') return (b.retail_price || 0) - (a.retail_price || 0);
    if (sortBy === 'alpha') return a.name.localeCompare(b.name);
    if (sortBy === 'frequent' && activeTab === 'pastOrders') return (b.purchase_count || 0) - (a.purchase_count || 0);
    return 0; // recent/default
  });

  const visibleItems = currentItems.slice(0, visibleCount);

  const shouldGroup = viewMode === 'grid' && filterCategory === 'all' && sortBy === 'recent' && !searchQuery;

  const groupedItems = shouldGroup ? visibleItems.reduce((acc, item) => {
    const cat = item.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, Item[]>) : { 'All': visibleItems };

  const renderEmptyState = () => (
    <div className="glass-panel hover-lift stagger-fade-in" style={{ padding: 'var(--space-8)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {activeTab === 'favorites' ? (
        <Heart size={48} style={{ color: 'var(--teal)', marginBottom: 'var(--space-4)', opacity: 0.8 }} />
      ) : activeTab === 'pastOrders' ? (
        <PackageOpen size={48} style={{ color: 'var(--teal)', marginBottom: 'var(--space-4)', opacity: 0.8 }} />
      ) : (
        <History size={48} style={{ color: 'var(--teal)', marginBottom: 'var(--space-4)', opacity: 0.8 }} />
      )}
      <h2 style={{ color: 'var(--white)', fontSize: '1.25rem', marginBottom: 'var(--space-2)' }}>
        {activeTab === 'favorites' ? 'Your Wishlist Is Empty' : activeTab === 'pastOrders' ? 'No Past Orders Found' : 'Nothing Here Yet'}
      </h2>
      <p style={{ color: 'var(--silver)', fontSize: '0.95rem', maxWidth: 400 }}>
        {activeTab === 'favorites' ? 'Tap the heart icon on any product to save it here for later.' : 
         activeTab === 'pastOrders' ? 'Items you purchase will appear here for easy re-ordering.' : 
         'Browse products on a storefront and they will magically appear here.'}
      </p>
      {storefrontSlug && (
        <Link href={`/${storefrontSlug}`} className="btn btn-primary" style={{ marginTop: 'var(--space-6)', padding: '12px 24px' }}>
          Explore The Catalog
        </Link>
      )}
    </div>
  );

  const renderItemCard = (item: Item, index: number) => {
    const displayPrice = item.retail_price ?? item.base_cost ?? 0;
    const inCart = localCartIds.has(item.product_id);
    const isSelected = selectedItems.has(item.product_id);

    return (
      <div
        key={item.product_id}
        className="glass-panel hover-lift stagger-fade-in"
        style={{
          display: 'flex',
          flexDirection: viewMode === 'grid' ? 'column' : 'row',
          overflow: 'hidden',
          padding: 0,
          borderRadius: 'var(--radius-lg)',
          animationDelay: `${Math.min(index * 0.05, 0.5)}s`,
          border: isSelected ? '1px solid var(--teal)' : undefined,
          boxShadow: isSelected ? '0 0 0 1px var(--teal)' : undefined,
          transition: 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
          cursor: 'pointer',
        }}
        onClick={(e) => {
          // If clicking a button, ignore
          if ((e.target as HTMLElement).closest('button, a')) return;
          setQuickViewItem(item);
        }}
      >
        <div
          style={{
            height: viewMode === 'grid' ? 160 : 100,
            width: viewMode === 'list' ? 100 : 'auto',
            background: 'radial-gradient(circle at 50% 50%, rgba(192,184,168,0.10) 0%, var(--black) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', flexShrink: 0, overflow: 'hidden'
          }}
        >
          <img
            src={item.image_url || getProductImage(null, item.category || 'Other', item.name)}
            alt={item.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s' }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              const fallback = getProductImage(null, item.category || 'Other', item.name);
              if (target.src !== fallback) target.src = fallback;
            }}
          />
          
          {/* Checkbox Overlay */}
          <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 10 }} onClick={e => { e.stopPropagation(); toggleSelection(item.product_id); }}>
            <div style={{ width: 22, height: 22, borderRadius: 4, border: isSelected ? 'none' : '2px solid rgba(255,255,255,0.4)', background: isSelected ? 'var(--teal)' : 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isSelected && <Check size={14} color="var(--black)" />}
            </div>
          </div>

          {/* Badges */}
          <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', zIndex: 2 }}>
            {inCart && (
              <div style={{ background: 'var(--teal)', color: 'var(--black)', padding: '2px 8px', borderRadius: 12, fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ShoppingCart size={10} /> In Cart
              </div>
            )}
            {item.is_on_sale && (
              <div style={{ background: 'rgba(245,101,101,0.2)', border: '1px solid rgba(245,101,101,0.5)', color: '#F56565', padding: '2px 8px', borderRadius: 12, fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', backdropFilter: 'blur(4px)', boxShadow: '0 0 10px rgba(245,101,101,0.2)' }}>
                Price Drop
              </div>
            )}
            {activeTab === 'pastOrders' && item.purchase_count && item.purchase_count > 1 && sortBy === 'frequent' && (
              <div style={{ background: 'rgba(234,179,8,0.2)', border: '1px solid rgba(234,179,8,0.5)', color: '#EAB308', padding: '2px 8px', borderRadius: 12, fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', backdropFilter: 'blur(4px)' }}>
                Ordered {item.purchase_count}x
              </div>
            )}
          </div>
          
          {item.in_stock === false && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'grayscale(100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3 }}>
              <span style={{ background: 'var(--black)', color: 'var(--silver)', padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', border: '1px solid rgba(255,255,255,0.1)' }}>Out of Stock</span>
            </div>
          )}
        </div>

        <div style={{ padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <div style={{ color: 'var(--white)', fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.3, whiteSpace: viewMode === 'list' ? 'nowrap' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.name}
          </div>
          <div style={{ color: 'var(--silver)', fontSize: '0.7rem', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 2 }}>
            {item.category || 'Compound'} {item.unit_size && `• ${item.unit_size}${item.unit_measure}`}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: viewMode === 'grid' ? 'auto' : 4, paddingTop: viewMode === 'grid' ? 'var(--space-3)' : 0 }}>
            {displayPrice > 0 ? (
              <div style={{ color: 'var(--teal)', fontWeight: 800, fontSize: '1.05rem', fontFamily: 'var(--font-brand)' }}>
                ${displayPrice.toFixed(2)}
              </div>
            ) : <div/>}
            {viewMode === 'list' && storefrontSlug && (
              <button onClick={(e) => { e.stopPropagation(); handleQuickAdd(item); }} disabled={item.in_stock === false} className="btn btn-primary btn-sm" style={{ padding: '4px 12px' }}>Add</button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ paddingBottom: '100px' }}>
      {/* Top Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', borderBottom: '1px solid rgba(255,255,255,0.1)', overflowX: 'auto', paddingBottom: 'var(--space-2)' }}>
        {[
          { id: 'favorites', label: 'Saved Compounds', icon: Heart },
          { id: 'pastOrders', label: 'Buy It Again', icon: PackageOpen },
          { id: 'recentlyViewed', label: 'Recently Viewed', icon: History }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => { setActiveTab(t.id as any); setSelectedItems(new Set()); }}
            style={{
              background: 'none', border: 'none',
              color: activeTab === t.id ? 'var(--teal)' : 'var(--silver)',
              fontWeight: activeTab === t.id ? 'bold' : 'normal',
              padding: 'var(--space-2) var(--space-4)',
              cursor: 'pointer', whiteSpace: 'nowrap',
              borderBottom: activeTab === t.id ? '2px solid var(--teal)' : '2px solid transparent',
              transition: 'all 0.2s ease', fontSize: '0.95rem',
              display: 'flex', alignItems: 'center', gap: 8
            }}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="glass-panel" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', padding: 'var(--space-3)', marginBottom: 'var(--space-6)', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--silver)' }} />
          <input 
            type="text" 
            placeholder="Search journal..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px 8px 34px', borderRadius: 8, color: 'var(--white)', fontSize: '0.9rem' }}
          />
          {searchQuery && <X size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--silver)', cursor: 'pointer' }} onClick={() => setSearchQuery('')} />}
        </div>
        
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--white)', padding: '8px 12px', borderRadius: 8, fontSize: '0.85rem' }}>
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--white)', padding: '8px 12px', borderRadius: 8, fontSize: '0.85rem' }}>
          <option value="recent">Recently Added</option>
          <option value="priceAsc">Price: Low to High</option>
          <option value="priceDesc">Price: High to Low</option>
          <option value="alpha">Alphabetical</option>
          {activeTab === 'pastOrders' && <option value="frequent">Most Frequently Ordered</option>}
        </select>

        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
          <button onClick={() => setViewMode('grid')} style={{ padding: '8px 12px', background: viewMode === 'grid' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: viewMode === 'grid' ? 'var(--white)' : 'var(--silver)', cursor: 'pointer' }}><LayoutGrid size={16} /></button>
          <button onClick={() => setViewMode('list')} style={{ padding: '8px 12px', background: viewMode === 'list' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: viewMode === 'list' ? 'var(--white)' : 'var(--silver)', cursor: 'pointer' }}><ListIcon size={16} /></button>
        </div>
      </div>

      {/* Main Content */}
      {currentItems.length === 0 ? renderEmptyState() : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {Object.entries(groupedItems).map(([category, items]) => (
            <div key={category}>
              {shouldGroup && <h3 style={{ color: 'var(--white)', fontSize: '1.1rem', marginBottom: 'var(--space-3)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 'var(--space-2)' }}>{category}</h3>}
              <div style={{
                display: 'grid',
                gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(200px, 1fr))' : '1fr',
                gap: 'var(--space-3)'
              }}>
                {items.map((item, idx) => renderItemCard(item, idx))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination: Load More */}
      {visibleCount < currentItems.length && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-6)', paddingBottom: 'var(--space-8)' }}>
          <button 
            onClick={() => setVisibleCount(v => v + 24)} 
            className="btn btn-secondary"
            style={{ padding: '12px 32px', borderRadius: 30, background: 'rgba(255,255,255,0.05)' }}
          >
            Load More ({currentItems.length - visibleCount} remaining)
          </button>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedItems.size > 0 && (
        <div style={{ position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)', background: 'rgba(20,20,20,0.9)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,196,188,0.3)', padding: '12px 24px', borderRadius: 40, zIndex: 100, display: 'flex', alignItems: 'center', gap: 24, boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
          <div style={{ color: 'var(--white)', fontWeight: 'bold', fontSize: '0.9rem' }}>{selectedItems.size} Selected</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(selectedItems.size >= 2 && selectedItems.size <= 4) && (
              <button onClick={() => setIsComparing(true)} className="btn btn-secondary" style={{ borderRadius: 20, padding: '8px 20px', background: 'rgba(0,196,188,0.1)', color: 'var(--teal)', border: '1px solid rgba(0,196,188,0.2)' }}>Compare</button>
            )}
            <button onClick={handleBulkAdd} className="btn btn-primary" style={{ borderRadius: 20, padding: '8px 20px' }}>Add to Cart</button>
            <button onClick={() => setSelectedItems(new Set())} className="btn btn-ghost" style={{ borderRadius: 20, color: 'var(--silver)' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Quick View Modal */}
      {quickViewItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }} onClick={() => setQuickViewItem(null)}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: 800, padding: 0, borderRadius: 'var(--radius-xl)', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setQuickViewItem(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.5)', border: 'none', color: 'var(--white)', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}><X size={16} /></button>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 300px', background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, var(--black) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)' }}>
                <img src={quickViewItem.image_url || getProductImage(null, quickViewItem.category || 'Other', quickViewItem.name)} style={{ width: '100%', maxWidth: 300, objectFit: 'contain' }} alt={quickViewItem.name} />
              </div>
              <div style={{ flex: '1 1 300px', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ color: 'var(--teal)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 'bold', marginBottom: 8 }}>{quickViewItem.category || 'Compound'}</div>
                <h2 style={{ color: 'var(--white)', fontSize: '1.8rem', lineHeight: 1.2, marginBottom: 16 }}>{quickViewItem.name}</h2>
                <div style={{ color: 'var(--silver)', fontSize: '0.95rem', marginBottom: 24, flex: 1 }}>
                  This item is saved in your Lab Journal. It is {quickViewItem.in_stock === false ? 'currently out of stock' : 'in stock and ready to ship'}.
                  {quickViewItem.unit_size && <div><br/><strong>Unit Size:</strong> {quickViewItem.unit_size}{quickViewItem.unit_measure}</div>}
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ color: 'var(--teal)', fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-brand)' }}>
                    ${(quickViewItem.retail_price ?? quickViewItem.base_cost ?? 0).toFixed(2)}
                  </div>
                  {storefrontSlug && (
                    <button 
                      onClick={() => { handleQuickAdd(quickViewItem); setQuickViewItem(null); }} 
                      disabled={quickViewItem.in_stock === false}
                      className="btn btn-primary"
                    >
                      Add to Cart
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compare Modal */}
      {isComparing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }} onClick={() => setIsComparing(false)}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: 1000, padding: 'var(--space-6)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setIsComparing(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: 'none', color: 'var(--white)', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}><X size={16} /></button>
            <h2 style={{ color: 'var(--white)', fontSize: '1.4rem', marginBottom: 'var(--space-6)' }}>Comparing {selectedItems.size} Compounds</h2>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${selectedItems.size}, 1fr)`, gap: 'var(--space-4)', overflowY: 'auto' }}>
              {Array.from(selectedItems).map(id => {
                const item = [...favorites, ...pastOrders, ...recentlyViewed].find(i => i.product_id === id);
                if (!item) return null;
                const displayPrice = item.retail_price ?? item.base_cost ?? 0;
                return (
                  <div key={id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', background: 'rgba(255,255,255,0.03)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ width: '100%', height: 120, background: 'var(--black-2)', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={item.image_url || getProductImage(null, item.category || 'Other', item.name)} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }} alt={item.name} />
                    </div>
                    <div style={{ color: 'var(--teal)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{item.category || 'N/A'}</div>
                    <div style={{ color: 'var(--white)', fontWeight: 700, fontSize: '1.1rem' }}>{item.name}</div>
                    <div style={{ color: 'var(--silver)', fontSize: '0.9rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12, marginTop: 'auto' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>Price:</span> <strong style={{ color: 'var(--teal)' }}>${displayPrice.toFixed(2)}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>Size:</span> <strong style={{ color: 'var(--white)' }}>{item.unit_size}{item.unit_measure}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Status:</span> <strong style={{ color: item.in_stock === false ? 'var(--red)' : 'var(--teal)' }}>{item.in_stock === false ? 'Out of Stock' : 'In Stock'}</strong></div>
                    </div>
                    {storefrontSlug && (
                      <button onClick={() => { handleQuickAdd(item); setSelectedItems(s => { const ns = new Set(s); ns.delete(item.product_id); return ns; }); if (selectedItems.size <= 2) setIsComparing(false); }} disabled={item.in_stock === false} className="btn btn-primary" style={{ marginTop: 12 }}>Add to Cart</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
