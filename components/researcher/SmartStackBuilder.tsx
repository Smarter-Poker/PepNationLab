'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
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

  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const filteredCatalog = useMemo(() => {
    if (!searchQuery) return catalog;
    const q = searchQuery.toLowerCase();
    return catalog.filter(c => c.name.toLowerCase().includes(q) || (c.category || '').toLowerCase().includes(q));
  }, [catalog, searchQuery]);

  // Convert to StackComponent format for engine
  const handleToggleItem = (item: Item) => {
    if (selectedItems.find(i => i.product_id === item.product_id)) {
      setSelectedItems(prev => prev.filter(i => i.product_id !== item.product_id));
    } else {
      setSelectedItems(prev => [...prev, item]);
    }
  };

  const runAiAnalysis = async () => {
    if (selectedItems.length < 2) return;
    setIsAnalyzing(true);
    setAiAnalysis(null);
    try {
      const res = await fetch('/api/researcher/ai-stack-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: selectedItems.map(item => item.name) })
      });
      const data = await res.json();
      if (res.ok && !data.error) setAiAnalysis(data);
      else console.error('Stack analysis failed:', data.error);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
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
              placeholder="Search Compounds To Add..."
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
                    <Image src={item.image_url || getProductImage(null, item.category || '', item.name)} alt={item.name} width={200} height={200} unoptimized style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} />
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
                <div style={{ padding: '12px 16px', background: aiAnalysis ? (aiAnalysis.synergyScore > 80 ? 'rgba(0,255,157,0.15)' : aiAnalysis.synergyScore < 50 ? 'rgba(245,101,101,0.2)' : 'rgba(255,255,255,0.05)') : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Zap size={18} color="#00FF9D" />
                    <span style={{ color: 'var(--white)', fontWeight: 600, fontSize: '0.95rem' }}>
                      {aiAnalysis ? aiAnalysis.verdict : 'Stack Analysis'}
                    </span>
                  </div>
                  {aiAnalysis && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--silver)' }}>
                      Synergy Score: <strong style={{ color: aiAnalysis.synergyScore < 50 ? '#F56565' : aiAnalysis.synergyScore > 80 ? '#00FF9D' : 'var(--white)' }}>{aiAnalysis.synergyScore}/100</strong>
                    </div>
                  )}
                </div>
                
                <div style={{ padding: 'var(--space-3)' }}>
                  {!aiAnalysis ? (
                    <button 
                      onClick={runAiAnalysis}
                      disabled={isAnalyzing || selectedItems.length < 2}
                      style={{ 
                        width: '100%', padding: '8px', background: 'rgba(0,229,255,0.1)', color: '#00E5FF', 
                        border: '1px solid rgba(0,229,255,0.3)', borderRadius: 6, cursor: (isAnalyzing || selectedItems.length < 2) ? 'not-allowed' : 'pointer',
                        opacity: (isAnalyzing || selectedItems.length < 2) ? 0.5 : 1
                      }}
                    >
                      {isAnalyzing ? 'Analyzing Synergy...' : selectedItems.length < 2 ? 'Add 2+ Items To Analyze' : 'Analyze With AI'}
                    </button>
                  ) : (
                    <>
                      <p style={{ color: 'var(--silver)', fontSize: '0.9rem', marginBottom: 12, lineHeight: 1.5 }}>
                        {aiAnalysis.analysis}
                      </p>

                      {aiAnalysis.warnings && aiAnalysis.warnings.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                          {aiAnalysis.warnings.map((w: string, i: number) => (
                            <div key={i} style={{ display: 'flex', gap: 8, color: '#F56565', fontSize: '0.85rem', alignItems: 'flex-start' }}>
                              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                              <span>{w}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <button 
                        onClick={() => setAiAnalysis(null)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--silver)', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                      >
                        Reset Analysis
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
            
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 'var(--space-4)', marginTop: 'auto' }}>
            <div>
              <div style={{ color: 'var(--silver)', fontSize: '0.85rem' }}>Total Stack Price</div>
              <div style={{ color: 'var(--white)', fontSize: '1.25rem', fontWeight: 600 }}>${totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <button 
              disabled={selectedItems.length < 2 || (aiAnalysis && aiAnalysis.synergyScore < 50)}
              onClick={() => {
                if (selectedItems.length >= 2) {
                  onAddStackToCart(selectedItems, stackName);
                  setSelectedItems([]);
                  setStackName('My Custom Stack');
                  setAiAnalysis(null);
                }
              }}
              style={{ background: 'none', border: 'none', padding: 0, cursor: (selectedItems.length < 2 || (aiAnalysis && aiAnalysis.synergyScore < 50)) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', filter: (selectedItems.length < 2 || (aiAnalysis && aiAnalysis.synergyScore < 50)) ? 'grayscale(100%) opacity(0.5)' : 'drop-shadow(0 4px 15px rgba(0,229,255,0.3))' }}
            >
              <Image src="/images/add_stack_to_cart_btn.png" alt="Add Stack to Cart" width={200} height={200} unoptimized style={{ height: 48, objectFit: 'contain' }} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
