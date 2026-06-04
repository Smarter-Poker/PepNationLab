'use client';

import React, { useState, useMemo } from 'react';
import { Search, Plus, X, Layers, AlertTriangle, CheckCircle, Zap, ShieldAlert, FlaskConical } from 'lucide-react';
import { analyzeStack, getCategoryFromName, StackComponent, StackAnalysis } from '@/lib/stackEngine';
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
}

interface Props {
  catalog: Item[];
  onAddStackToCart: (items: Item[], stackName: string) => void;
}

export default function SmartStackBuilder({ catalog, onAddStackToCart }: Props) {
  const [selectedItems, setSelectedItems] = useState<Item[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [stackName, setStackName] = useState('My Custom Stack');

  const filteredCatalog = useMemo(() => {
    if (!searchQuery) return catalog;
    const q = searchQuery.toLowerCase();
    return catalog.filter(c => c.name.toLowerCase().includes(q) || (c.category || '').toLowerCase().includes(q));
  }, [catalog, searchQuery]);

  // Convert to StackComponent format for engine
  const stackComponents: StackComponent[] = useMemo(() => {
    return selectedItems.map(item => ({
      id: item.product_id,
      name: item.name,
      category: getCategoryFromName(item.name)
    }));
  }, [selectedItems]);

  const analysis: StackAnalysis = useMemo(() => analyzeStack(stackComponents), [stackComponents]);

  const handleToggleItem = (item: Item) => {
    if (selectedItems.find(i => i.product_id === item.product_id)) {
      setSelectedItems(prev => prev.filter(i => i.product_id !== item.product_id));
    } else {
      setSelectedItems(prev => [...prev, item]);
    }
  };

  const totalPrice = selectedItems.reduce((sum, item) => sum + (item.retail_price ?? item.base_cost ?? 0), 0);

  return (
    <div className="glass-panel" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-lg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <div style={{ background: 'rgba(0, 229, 255, 0.1)', padding: 10, borderRadius: 12 }}>
          <FlaskConical size={24} color="#00E5FF" />
        </div>
        <div>
          <h3 style={{ margin: 0, color: 'var(--white)', fontSize: '1.25rem', fontFamily: 'var(--font-brand)' }}>Smart Stack Builder</h3>
          <p style={{ margin: 0, color: 'var(--silver)', fontSize: '0.85rem' }}>Experiment with peptide combinations. Our engine analyzes synergy and safety.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', minHeight: 400 }}>
        
        {/* LEFT PANEL: Catalog Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: 'var(--space-4)' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--silver)' }} />
            <input 
              type="text" 
              placeholder="Search compounds to add..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 12px 10px 34px', borderRadius: 8, color: 'var(--white)', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ overflowY: 'auto', flex: 1, maxHeight: 500, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {filteredCatalog.map(item => {
              const isSelected = selectedItems.some(i => i.product_id === item.product_id);
              return (
                <div 
                  key={item.product_id}
                  onClick={() => handleToggleItem(item)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                    background: isSelected ? 'rgba(0, 229, 255, 0.1)' : 'rgba(0,0,0,0.3)',
                    border: isSelected ? '1px solid rgba(0,229,255,0.4)' : '1px solid rgba(255,255,255,0.05)',
                    transition: 'all 0.2s'
                  }}
                  className="hover-lift"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <img src={item.image_url || getProductImage(null, item.category || '', item.name)} alt={item.name} style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} />
                    <div>
                      <div style={{ color: 'var(--white)', fontSize: '0.9rem', fontWeight: 600 }}>{item.name}</div>
                      <div style={{ color: 'var(--silver)', fontSize: '0.75rem' }}>{item.category || 'Compound'}</div>
                    </div>
                  </div>
                  {isSelected ? <X size={16} color="#00E5FF" /> : <Plus size={16} color="var(--silver)" />}
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT PANEL: The Flask / Analysis */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <input 
            type="text" 
            value={stackName}
            onChange={e => setStackName(e.target.value)}
            style={{ 
              background: 'transparent', border: 'none', borderBottom: '2px solid rgba(255,255,255,0.1)', 
              color: 'var(--white)', fontSize: '1.4rem', fontFamily: 'var(--font-brand)', padding: '4px 0',
              outline: 'none', width: '100%'
            }}
          />

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {selectedItems.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed rgba(255,255,255,0.1)', borderRadius: 12, padding: 'var(--space-6)' }}>
                <Layers size={32} color="var(--silver)" style={{ marginBottom: 12, opacity: 0.5 }} />
                <p style={{ color: 'var(--silver)', textAlign: 'center', fontSize: '0.9rem' }}>Select compounds from the catalog to build your custom stack.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {selectedItems.map(item => (
                  <div key={item.product_id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', padding: '6px 10px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--white)' }}>{item.name}</span>
                    <X size={12} color="var(--silver)" style={{ cursor: 'pointer' }} onClick={() => handleToggleItem(item)} />
                  </div>
                ))}
              </div>
            )}

            {/* Smart Analysis Readout */}
            {selectedItems.length > 0 && (
              <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', background: analysis.status === 'unsafe' ? 'rgba(245,101,101,0.2)' : analysis.status === 'excellent' ? 'rgba(0,255,157,0.15)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {analysis.status === 'unsafe' ? <ShieldAlert size={18} color="#F56565" /> : analysis.status === 'excellent' ? <Zap size={18} color="#00FF9D" /> : <CheckCircle size={18} color="var(--silver)" />}
                    <span style={{ color: 'var(--white)', fontWeight: 600, fontSize: '0.95rem' }}>
                      {analysis.status === 'unsafe' ? 'Compatibility Warning' : analysis.status === 'excellent' ? 'Highly Synergistic' : 'Stack Analysis'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--silver)' }}>
                    Synergy Score: <strong style={{ color: analysis.status === 'unsafe' ? '#F56565' : analysis.status === 'excellent' ? '#00FF9D' : 'var(--white)' }}>{analysis.synergyScore}/100</strong>
                  </div>
                </div>
                
                <div style={{ padding: 'var(--space-3)' }}>
                  {analysis.warnings.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                      {analysis.warnings.map((w, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, color: '#F56565', fontSize: '0.85rem', alignItems: 'flex-start' }}>
                          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {analysis.tips.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {analysis.tips.map((t, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, color: '#00FF9D', fontSize: '0.85rem', alignItems: 'flex-start' }}>
                          <Zap size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                          <span>{t}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4)', background: 'rgba(0,0,0,0.5)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--silver)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estimated Total</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--teal)' }}>${totalPrice.toFixed(2)}</div>
            </div>
            <button 
              className="btn-primary" 
              disabled={selectedItems.length < 2 || !analysis.isCompatible}
              onClick={() => {
                if (selectedItems.length >= 2 && analysis.isCompatible) {
                  onAddStackToCart(selectedItems, stackName);
                  setSelectedItems([]);
                  setStackName('My Custom Stack');
                }
              }}
              style={{ padding: '10px 24px', opacity: (selectedItems.length < 2 || !analysis.isCompatible) ? 0.5 : 1 }}
            >
              Add Stack To Cart
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
