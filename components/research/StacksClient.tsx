'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Compound, EVIDENCE_TIER, RESEARCH_AREAS } from '@/lib/compounds';
import { AreaProduct } from '@/lib/area-products-server';
import { useCart } from '@/components/CartContext';
import { analyzeStack, getCategoryFromName } from '@/lib/stackEngine';
import StackBuilder from './StackBuilder';
import { Search, Info, FlaskConical, Beaker, Map as MapIcon, Grid as GridIcon, CheckCircle2, ChevronRight, X } from 'lucide-react';
import Image from 'next/image';

interface Props {
  compounds: Compound[];
  stacks: Compound[];
  products: AreaProduct[];
}

export default function StacksClient({ compounds, stacks, products }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [activeStackDrawer, setActiveStackDrawer] = useState<string | null>(null);

  const { addMultipleToCart } = useCart();

  const bySlug = useMemo(() => new Map(compounds.map((c) => [c.slug, c])), [compounds]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    stacks.forEach(s => {
      s.research_areas?.forEach(a => {
        if (RESEARCH_AREAS[a]) cats.add(RESEARCH_AREAS[a].label);
      });
    });
    return ['All', ...Array.from(cats)];
  }, [stacks]);

  const filteredStacks = useMemo(() => {
    return stacks.filter(stack => {
      const matchSearch = stack.display_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        stack.stack_components.some(c => {
          const compName = bySlug.get(c)?.display_name || c;
          return compName.toLowerCase().includes(searchQuery.toLowerCase()) || c.toLowerCase().includes(searchQuery.toLowerCase());
        });
      
      const matchCat = activeCategory === 'All' || 
        stack.research_areas?.some(a => RESEARCH_AREAS[a]?.label === activeCategory);

      return matchSearch && matchCat;
    });
  }, [stacks, searchQuery, activeCategory]);

  const toggleCompare = (slug: string) => {
    setSelectedForCompare(prev => {
      if (prev.includes(slug)) return prev.filter(s => s !== slug);
      if (prev.length >= 2) return [prev[1], slug];
      return [...prev, slug];
    });
  };

  const handleAddToCart = (stack: Compound) => {
    const itemsToAdd = [];
    for (const compSlug of stack.stack_components) {
      // Find the lowest price product for this compound
      const compProducts = products.filter(p => p.compoundSlug === compSlug);
      if (compProducts.length > 0) {
        compProducts.sort((a, b) => a.retailPrice - b.retailPrice);
        const p = compProducts[0];
        itemsToAdd.push({
          product: {
            id: p.productId,
            name: p.productName,
            sku: p.sku || '',
            retailPrice: p.retailPrice,
            costPrice: p.retailPrice, // Base fallback
            bulkCostPrice: null,
            bulkThreshold: undefined,
            weightOz: p.weightOz,
          },
          quantity: 1
        });
      }
    }
    if (itemsToAdd.length > 0) {
      addMultipleToCart(itemsToAdd, stack.display_name);
    }
  };

  // Stack Synergy Calculator
  const getSynergyScore = (stack: Compound) => {
    const compObjects = stack.stack_components.map(slug => {
      const c = bySlug.get(slug);
      return { id: slug, name: c?.display_name || slug, category: getCategoryFromName(c?.display_name || slug) };
    });
    return analyzeStack(compObjects);
  };

  const getCitationCount = (stack: Compound) => {
    return stack.stack_components.reduce((acc, slug) => {
      const c = bySlug.get(slug);
      return acc + (c?.pubmed_citation_count || 0);
    }, 0);
  };

  const getBundlePrice = (stack: Compound) => {
    let total = 0;
    for (const compSlug of stack.stack_components) {
      const compProducts = products.filter(p => p.compoundSlug === compSlug);
      if (compProducts.length > 0) {
        compProducts.sort((a, b) => a.retailPrice - b.retailPrice);
        total += compProducts[0].retailPrice;
      }
    }
    return total;
  };

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
      <header style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, color: '#FFFFFF', fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Stacks &amp; Combinations
            </h1>
            <p style={{ margin: 'var(--space-3) 0 0', color: '#A8B4C0', maxWidth: 720, lineHeight: 1.55 }}>
              Documented Compound Combinations Studied Together In The Research Literature. For Research
              Use Only. Educational Reference, Not A Protocol Or Medical Advice.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, background: 'rgba(255,255,255,0.05)', padding: 4, borderRadius: 12 }}>
            <button onClick={() => setViewMode('grid')} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: viewMode === 'grid' ? 'rgba(0,229,255,0.1)' : 'transparent', color: viewMode === 'grid' ? '#00E5FF' : '#A8B4C0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
              <GridIcon size={18} /> Grid
            </button>
            <button onClick={() => setViewMode('map')} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: viewMode === 'map' ? 'rgba(0,229,255,0.1)' : 'transparent', color: viewMode === 'map' ? '#00E5FF' : '#A8B4C0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
              <MapIcon size={18} /> Map
            </button>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 32, alignItems: 'center' }}>
        <div style={{ position: 'relative', flexGrow: 1, maxWidth: 400 }}>
          <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#A8B4C0' }} />
          <input 
            type="text" 
            placeholder="Search stacks or compounds..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '12px 14px 12px 42px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
          {categories.map(cat => (
            <button 
              key={cat} 
              onClick={() => setActiveCategory(cat)}
              style={{ whiteSpace: 'nowrap', padding: '8px 16px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', background: activeCategory === cat ? '#00E5FF' : 'transparent', color: activeCategory === cat ? '#000' : '#A8B4C0', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'map' ? (
        <NodeMapVisualizer stacks={filteredStacks} compounds={compounds} bySlug={bySlug} onStackClick={setActiveStackDrawer} />
      ) : filteredStacks.length === 0 ? (
        <div className="card" style={{ padding: 'var(--space-6)', color: '#A8B4C0', textAlign: 'center' }}>
          No Documented Combinations Match Your Filters.
        </div>
      ) : (
        <div className="grid-2" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
          {filteredStacks.map((stack) => {
            const synergy = getSynergyScore(stack);
            const citationCount = getCitationCount(stack);
            const bundlePrice = getBundlePrice(stack);
            const isComparing = selectedForCompare.includes(stack.slug);

            return (
              <motion.article
                key={stack.slug}
                className="glass-panel"
                whileHover={{ y: -4, boxShadow: '0 12px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)' }}
                style={{ padding: 0, overflow: 'hidden', position: 'relative', cursor: 'pointer', border: isComparing ? '1px solid #00E5FF' : undefined }}
                onClick={() => setActiveStackDrawer(stack.slug)}
              >
                {/* Compare Checkbox */}
                <div 
                  onClick={(e) => { e.stopPropagation(); toggleCompare(stack.slug); }}
                  style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, width: 24, height: 24, borderRadius: 6, border: isComparing ? 'none' : '1px solid rgba(255,255,255,0.2)', background: isComparing ? '#00E5FF' : 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {isComparing && <CheckCircle2 size={16} color="#000" />}
                </div>

                <div style={{ padding: 'var(--space-5)' }}>
                  {/* Badges */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    {citationCount > 0 && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(104, 211, 145, 0.1)', color: '#68D391', padding: '4px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>
                        <FlaskConical size={12} /> {citationCount} Papers
                      </div>
                    )}
                    {synergy.status === 'excellent' && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(0, 229, 255, 0.1)', color: '#00E5FF', padding: '4px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>
                        Synergy: {synergy.synergyScore}
                      </div>
                    )}
                  </div>

                  <h2 style={{ margin: 0, color: '#00C4BC', fontWeight: 800, fontSize: '1.3rem', letterSpacing: '-0.01em' }}>
                    {stack.display_name}
                  </h2>
                  
                  {stack.stack_rationale && (
                    <p style={{ margin: 'var(--space-2) 0 0', color: '#D0DAE4', lineHeight: 1.55, fontSize: '0.9rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {stack.stack_rationale}
                    </p>
                  )}
                  
                  {stack.stack_components.length > 0 && (
                    <div style={{ marginTop: 'var(--space-4)' }}>
                      <p style={{ margin: '0 0 var(--space-2)', color: '#A8B4C0', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Components
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {stack.stack_components.map((compSlug) => {
                          const comp = bySlug.get(compSlug);
                          const label = comp?.display_name ?? compSlug;
                          return (
                            <div
                              key={compSlug}
                              style={{
                                padding: '0.3rem 0.6rem',
                                borderRadius: '6px',
                                border: '1px solid rgba(255,255,255,0.05)',
                                background: 'rgba(0,0,0,0.4)',
                                color: '#D0DAE4',
                                fontSize: '0.75rem',
                                fontWeight: 500
                              }}
                            >
                              {label}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.7rem', color: '#A8B4C0', textTransform: 'uppercase', fontWeight: 700 }}>Est. Price</span>
                      <span style={{ fontSize: '1.1rem', color: '#fff', fontWeight: 800 }}>${bundlePrice.toFixed(2)}</span>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleAddToCart(stack); }}
                      style={{ padding: '8px 16px', borderRadius: 8, background: '#00E5FF', color: '#000', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
                    >
                      Add Stack To Cart
                    </button>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {activeStackDrawer && (
          <StackDrawer 
            stackSlug={activeStackDrawer} 
            bySlug={bySlug} 
            products={products}
            onClose={() => setActiveStackDrawer(null)} 
            onAddToCart={(stack) => handleAddToCart(stack)}
            bundlePrice={getBundlePrice(bySlug.get(activeStackDrawer!)!)}
            synergyData={getSynergyScore(bySlug.get(activeStackDrawer!)!)}
          />
        )}
      </AnimatePresence>

      {/* Compare Floating Action Bar */}
      <AnimatePresence>
        {selectedForCompare.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            style={{
              position: 'fixed',
              bottom: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(15, 25, 35, 0.95)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(0, 229, 255, 0.3)',
              borderRadius: 16,
              padding: '12px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
              zIndex: 100
            }}
          >
            <div style={{ display: 'flex', gap: 12 }}>
              {selectedForCompare.map(slug => (
                <div key={slug} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: 8 }}>
                  <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>{bySlug.get(slug)?.display_name}</span>
                  <button onClick={() => toggleCompare(slug)} style={{ background: 'none', border: 'none', color: '#A8B4C0', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={14} /></button>
                </div>
              ))}
            </div>
            
            <button 
              disabled={selectedForCompare.length !== 2}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                background: selectedForCompare.length === 2 ? '#00E5FF' : 'rgba(255,255,255,0.1)',
                color: selectedForCompare.length === 2 ? '#000' : '#A8B4C0',
                border: 'none',
                fontWeight: 700,
                cursor: selectedForCompare.length === 2 ? 'pointer' : 'not-allowed',
              }}
              onClick={() => setShowCompareDrawer(true)}
            >
              Compare {selectedForCompare.length}/2
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCompareDrawer && selectedForCompare.length === 2 && (
          <StacksCompareDrawer 
            stack1={bySlug.get(selectedForCompare[0])!}
            stack2={bySlug.get(selectedForCompare[1])!}
            bySlug={bySlug}
            onClose={() => setShowCompareDrawer(false)}
            synergy1={getSynergyScore(bySlug.get(selectedForCompare[0])!)}
            synergy2={getSynergyScore(bySlug.get(selectedForCompare[1])!)}
            bundlePrice1={getBundlePrice(bySlug.get(selectedForCompare[0])!)}
            bundlePrice2={getBundlePrice(bySlug.get(selectedForCompare[1])!)}
          />
        )}
      </AnimatePresence>

      <div style={{ padding: '40px', background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.05) 0%, rgba(0,0,0,0) 100%)', borderRadius: 24, border: '1px solid rgba(0, 229, 255, 0.1)', marginTop: 40 }}>
        <h3 style={{ textAlign: 'center', margin: '0 0 8px', fontSize: '1.8rem', color: '#fff' }}>Build Your Own Stack</h3>
        <p style={{ textAlign: 'center', color: '#A8B4C0', marginBottom: 32 }}>Analyze synergies and conflicts between any compounds in our library.</p>
        <StackBuilder compounds={compounds} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stacks Compare Drawer
// ─────────────────────────────────────────────────────────────────────────────
function StacksCompareDrawer({ stack1, stack2, bySlug, onClose, synergy1, synergy2, bundlePrice1, bundlePrice2 }: any) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ position: 'absolute', inset: 0 }} onClick={onClose} />
      <motion.div 
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        style={{ width: '100%', maxWidth: 700, height: '100%', background: '#0F1923', borderLeft: '1px solid rgba(255,255,255,0.1)', overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'rgba(15, 25, 35, 0.95)', backdropFilter: 'blur(10px)', zIndex: 10 }}>
          <h2 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ color: '#00E5FF' }}>Compare Stacks</span>
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#A8B4C0', cursor: 'pointer' }}><X /></button>
        </div>

        <div style={{ padding: 32, flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Headers */}
            <div style={{ padding: 20, background: 'rgba(255,255,255,0.03)', borderRadius: 16, borderTop: '2px solid #00E5FF' }}>
              <h3 style={{ margin: '0 0 8px', color: '#fff', fontSize: '1.2rem' }}>{stack1.display_name}</h3>
              <div style={{ fontSize: '1.4rem', color: '#fff', fontWeight: 800, marginBottom: 16 }}>${bundlePrice1.toFixed(2)}</div>
              <div style={{ color: '#A8B4C0', fontSize: '0.85rem' }}>{stack1.stack_components.length} components</div>
            </div>
            
            <div style={{ padding: 20, background: 'rgba(255,255,255,0.03)', borderRadius: 16, borderTop: '2px solid #68D391' }}>
              <h3 style={{ margin: '0 0 8px', color: '#fff', fontSize: '1.2rem' }}>{stack2.display_name}</h3>
              <div style={{ fontSize: '1.4rem', color: '#fff', fontWeight: 800, marginBottom: 16 }}>${bundlePrice2.toFixed(2)}</div>
              <div style={{ color: '#A8B4C0', fontSize: '0.85rem' }}>{stack2.stack_components.length} components</div>
            </div>

            {/* Synergy Comparison */}
            <div>
              <div style={{ marginBottom: 12, fontSize: '0.8rem', color: '#A8B4C0', textTransform: 'uppercase', fontWeight: 700 }}>Synergy Score</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#00E5FF' }}>{synergy1.synergyScore} <span style={{ fontSize: '0.9rem', color: '#A8B4C0', fontWeight: 500 }}>/ 100</span></div>
              <div style={{ color: '#00E5FF', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', marginTop: 4 }}>{synergy1.status}</div>
            </div>
            <div>
              <div style={{ marginBottom: 12, fontSize: '0.8rem', color: '#A8B4C0', textTransform: 'uppercase', fontWeight: 700 }}>Synergy Score</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#68D391' }}>{synergy2.synergyScore} <span style={{ fontSize: '0.9rem', color: '#A8B4C0', fontWeight: 500 }}>/ 100</span></div>
              <div style={{ color: '#68D391', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', marginTop: 4 }}>{synergy2.status}</div>
            </div>

            {/* Components list */}
            <div>
              <div style={{ marginBottom: 12, fontSize: '0.8rem', color: '#A8B4C0', textTransform: 'uppercase', fontWeight: 700 }}>Included Compounds</div>
              {stack1.stack_components.map((slug: string) => (
                <div key={slug} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', padding: '10px 14px', borderRadius: 8, marginBottom: 8, fontSize: '0.85rem', color: '#fff' }}>
                  {bySlug.get(slug)?.display_name || slug}
                </div>
              ))}
            </div>
            <div>
              <div style={{ marginBottom: 12, fontSize: '0.8rem', color: '#A8B4C0', textTransform: 'uppercase', fontWeight: 700 }}>Included Compounds</div>
              {stack2.stack_components.map((slug: string) => (
                <div key={slug} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', padding: '10px 14px', borderRadius: 8, marginBottom: 8, fontSize: '0.85rem', color: '#fff' }}>
                  {bySlug.get(slug)?.display_name || slug}
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Node Map Visualizer Component
// ─────────────────────────────────────────────────────────────────────────────
function NodeMapVisualizer({ stacks, compounds, bySlug, onStackClick }: { stacks: Compound[], compounds: Compound[], bySlug: Map<string, Compound>, onStackClick?: (slug: string) => void }) {
  const [centerSlug, setCenterSlug] = useState<string>('bpc-157');

  const { centerName, orbitStacks } = useMemo(() => {
    let topSlug = 'bpc-157';
    if (stacks.length > 0) {
      const compoundFreq = new Map<string, number>();
      stacks.forEach(s => s.stack_components.forEach(c => compoundFreq.set(c, (compoundFreq.get(c) || 0) + 1)));
      let maxFreq = 0;
      for (const [slug, freq] of compoundFreq.entries()) {
        if (freq > maxFreq) { maxFreq = freq; topSlug = slug; }
      }
    }
    const centerName = bySlug.get(topSlug)?.display_name || topSlug;
    const orbitStacks = stacks.filter(s => s.stack_components.includes(topSlug)).slice(0, 5);
    return { centerName, orbitStacks };
  }, [stacks, bySlug]);

  return (
    <div style={{ height: 600, width: '100%', background: '#0a0f14', borderRadius: 20, border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflowX: 'auto', overflowY: 'hidden' }}>
      <div style={{ position: 'absolute', top: 20, left: 20, color: '#A8B4C0', fontSize: '0.85rem' }}>
        Interactive Network Graph (Showing stacks for <strong>{centerName}</strong>)
      </div>
      
      <div style={{ position: 'relative', width: 400, height: 400 }}>
        {/* Center Node */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 80, height: 80, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,229,255,0.2) 0%, rgba(0,0,0,0.8) 100%)', border: '2px solid #00E5FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, zIndex: 10, textAlign: 'center', fontSize: '0.8rem' }}>
          {centerName}
        </div>

        {/* Orbit Nodes */}
        {orbitStacks.length === 0 ? (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', marginTop: 80, color: '#A8B4C0', fontSize: '0.85rem' }}>No stacks available for this compound.</div>
        ) : orbitStacks.map((orbitStack, i) => {
          const angle = (360 / orbitStacks.length) * i;
          const r = 140;
          const rad = angle * (Math.PI / 180);
          const x = 200 + r * Math.cos(rad) - 40;
          const y = 200 + r * Math.sin(rad) - 40;
          
          return (
            <motion.div 
              key={orbitStack.slug}
              onClick={() => onStackClick?.(orbitStack.slug)}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              style={{ position: 'absolute', left: x, top: y, width: 80, height: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 5, cursor: 'pointer' }}
            >
              <svg style={{ position: 'absolute', top: '50%', left: '50%', width: 200, height: 200, overflow: 'visible', pointerEvents: 'none', zIndex: -1 }}>
                <line x1={0} y1={0} x2={200 - x - 40} y2={200 - y - 40} stroke="rgba(0,229,255,0.2)" strokeWidth="2" strokeDasharray="4 4" />
              </svg>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#68D391', marginBottom: 8 }} />
              <span style={{ color: '#A8B4C0', fontSize: '0.7rem', textAlign: 'center', whiteSpace: 'nowrap' }}>{orbitStack.display_name}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stack Drawer / Modal (with Reconstitution Math)
// ─────────────────────────────────────────────────────────────────────────────
function StackDrawer({ stackSlug, bySlug, products, onClose, onAddToCart, bundlePrice, synergyData }: any) {
  const stack = bySlug.get(stackSlug);
  const [activeTab, setActiveTab] = useState<'overview' | 'calculator'>('overview');
  const [calcState, setCalcState] = useState<Record<string, { mass: number, diluent: number }>>({});

  if (!stack) return null;

  const missingComponents = stack.stack_components.filter((slug: string) => !products.some((p: AreaProduct) => p.compoundSlug === slug));

  const handleCalcChange = (slug: string, field: 'mass' | 'diluent', value: number) => {
    setCalcState(prev => ({
      ...prev,
      [slug]: {
        ...(prev[slug] || { mass: 5, diluent: 2 }),
        [field]: value
      }
    }));
  };

  const getConcentration = (slug: string) => {
    const s = calcState[slug] || { mass: 5, diluent: 2 };
    if (!s.diluent || !s.mass) return 0;
    return s.mass / s.diluent; // mg/mL
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0 }} onClick={onClose} />
      <motion.div 
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        style={{ width: '100%', maxWidth: 600, maxHeight: '90vh', background: '#0F1923', borderTopLeftRadius: 24, borderTopRightRadius: 24, border: '1px solid rgba(255,255,255,0.1)', overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'rgba(15, 25, 35, 0.95)', backdropFilter: 'blur(10px)', zIndex: 10 }}>
          <h2 style={{ margin: 0, color: '#fff', fontSize: '1.5rem' }}>{stack.display_name}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#A8B4C0', cursor: 'pointer' }}><X /></button>
        </div>

        <div style={{ padding: '0 32px', display: 'flex', gap: 24, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={() => setActiveTab('overview')} style={{ padding: '16px 0', background: 'none', border: 'none', borderBottom: activeTab === 'overview' ? '2px solid #00E5FF' : '2px solid transparent', color: activeTab === 'overview' ? '#00E5FF' : '#A8B4C0', fontWeight: 600, cursor: 'pointer' }}>Overview</button>
          <button onClick={() => setActiveTab('calculator')} style={{ padding: '16px 0', background: 'none', border: 'none', borderBottom: activeTab === 'calculator' ? '2px solid #00E5FF' : '2px solid transparent', color: activeTab === 'calculator' ? '#00E5FF' : '#A8B4C0', fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}><Beaker size={16} /> Reconstitution Math</button>
        </div>

        <div style={{ padding: 32, flex: 1 }}>
          {activeTab === 'overview' ? (
            <>
              <p style={{ color: '#D0DAE4', lineHeight: 1.6, fontSize: '0.95rem' }}>{stack.stack_rationale}</p>
              
              {missingComponents.length > 0 && (
                <div style={{ marginTop: 16, padding: 12, background: 'rgba(255, 107, 107, 0.1)', border: '1px solid rgba(255, 107, 107, 0.3)', borderRadius: 12, color: '#FF6B6B', fontSize: '0.85rem' }}>
                  <strong>Note:</strong> {missingComponents.length} component(s) ({missingComponents.map((s: string) => bySlug.get(s)?.display_name).join(', ')}) are currently out of stock and will be skipped when adding to cart.
                </div>
              )}

              <div style={{ marginTop: 24, background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 20 }}>
                <h4 style={{ margin: '0 0 16px', color: '#fff' }}>Synergy Profile</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                  <div style={{ width: 60, height: 60, borderRadius: '50%', background: `conic-gradient(#00E5FF 0%, #00E5FF ${synergyData.synergyScore}%, rgba(255,255,255,0.1) ${synergyData.synergyScore}%, rgba(255,255,255,0.1) 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#0F1923', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800 }}>{synergyData.synergyScore}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#00E5FF', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.8rem' }}>{synergyData.status}</div>
                    <div style={{ color: '#A8B4C0', fontSize: '0.85rem' }}>Calculated Synergy Score</div>
                  </div>
                </div>
                {synergyData.tips.map((t: string, i: number) => <div key={i} style={{ color: '#68D391', fontSize: '0.85rem', marginBottom: 8, display: 'flex', gap: 8 }}><CheckCircle2 size={16} /> {t}</div>)}
              </div>
            </>
          ) : (
            <div>
              <p style={{ color: '#A8B4C0', fontSize: '0.9rem', marginBottom: 24 }}>Calculate exactly how much Bacteriostatic Water to add to each component in this stack based on your target concentration.</p>
              {stack.stack_components.map((slug: string) => {
                const s = calcState[slug] || { mass: 5, diluent: 2 };
                const mgPerMl = getConcentration(slug);
                const mcgPerMl = mgPerMl * 1000;

                return (
                  <div key={slug} style={{ marginBottom: 16, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <h4 style={{ margin: '0 0 12px', color: '#fff' }}>{bySlug.get(slug)?.display_name}</h4>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#A8B4C0', marginBottom: 6 }}>Vial Mass (mg)</label>
                        <input type="number" value={s.mass || ''} onChange={e => handleCalcChange(slug, 'mass', parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#A8B4C0', marginBottom: 6 }}>Diluent added (mL)</label>
                        <input type="number" step="0.5" value={s.diluent || ''} onChange={e => handleCalcChange(slug, 'diluent', parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: 8, borderRadius: 6, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                      </div>
                    </div>
                    <div style={{ marginTop: 16, padding: 12, background: 'rgba(0,229,255,0.05)', borderRadius: 8, color: '#00E5FF', fontSize: '0.85rem', fontWeight: 600 }}>
                      Concentration: {mgPerMl.toFixed(2)} mg / mL ({mcgPerMl.toFixed(0)} mcg / mL)
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ padding: '20px 32px', background: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#A8B4C0', fontWeight: 700, textTransform: 'uppercase' }}>Stack Price</div>
            <div style={{ fontSize: '1.2rem', color: '#fff', fontWeight: 800 }}>${bundlePrice.toFixed(2)}</div>
          </div>
          <button onClick={() => { onAddToCart(stack); onClose(); }} style={{ padding: '12px 24px', borderRadius: 8, background: '#00E5FF', color: '#000', border: 'none', fontWeight: 800, cursor: 'pointer' }}>
            Add Bundle To Cart
          </button>
        </div>
      </motion.div>
    </div>
  );
}
