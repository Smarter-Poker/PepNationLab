'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Compound, RESEARCH_AREAS } from '@/lib/compounds';
import { AreaProduct } from '@/lib/area-products-server';
import { useCart } from '@/components/CartContext';
import { analyzeStack, getCategoryFromName, type StackAnalysis } from '@/lib/stackEngine';
import StackBuilder from './StackBuilder';
import { Search, FlaskConical, Beaker, Map as MapIcon, Grid as GridIcon, CheckCircle2, X } from 'lucide-react';
import AutocompleteDropdown from '@/components/research/AutocompleteDropdown';
import TrendingSearchesDropdown from '@/components/research/TrendingSearchesDropdown';
import { useSearchHistory } from '@/components/research/useSearchHistory';

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
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [showCompareDrawer, setShowCompareDrawer] = useState(false);
  const [fridgeMode, setFridgeMode] = useState(false);
  const [fridgeInventory, setFridgeInventory] = useState<string[]>([]);

  const { addToCart, addMultipleToCart } = useCart();
  const { recent, addHistory } = useSearchHistory();

  const bySlug = useMemo(() => new Map(compounds.map((c) => [c.slug, c])), [compounds]);

  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const lower = searchQuery.toLowerCase();
    const matches = new Set<string>();
    
    compounds.forEach(c => {
      if (c.display_name.toLowerCase().includes(lower)) matches.add(c.display_name);
    });
    
    stacks.forEach(s => {
      if (s.display_name.toLowerCase().includes(lower)) matches.add(s.display_name);
    });
    
    return Array.from(matches).slice(0, 5).map(text => ({ text, slug: text, display_name: text, kind: 'compound' as const }));
  }, [searchQuery, compounds, stacks]);

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

      const matchFridge = !fridgeMode || fridgeInventory.length === 0 || 
        stack.stack_components.some(c => fridgeInventory.includes(c));

      return matchSearch && matchCat && matchFridge;
    });
  }, [stacks, searchQuery, activeCategory, bySlug, fridgeMode, fridgeInventory]);

  const toggleCompare = (slug: string) => {
    setSelectedForCompare(prev => {
      if (prev.includes(slug)) return prev.filter(s => s !== slug);
      if (prev.length >= 2) return [prev[1], slug];
      return [...prev, slug];
    });
  };

  const handleAddToCart = (stack: Compound) => {
    const itemsToAdd = [];
    
    // Check if there is a premixed blend product for this stack
    const premadeProducts = products.filter(p => p.compoundSlug === stack.slug);
    if (premadeProducts.length > 0) {
      premadeProducts.sort((a, b) => a.retailPrice - b.retailPrice);
      const p = premadeProducts[0];
      addToCart({
        id: p.agentProductId || p.compoundSlug,
        name: p.productName,
        sku: p.productName,
        retailPrice: p.retailPrice,
        costPrice: p.retailPrice,
        bulkCostPrice: p.retailPrice,
        bulkThreshold: 1,
        weightOz: p.weightOz,
      });
      return;
    }

    // Otherwise, add individual components
    for (const compSlug of stack.stack_components) {
      // Find the lowest price product for this compound
      const compProducts = products.filter(p => p.compoundSlug === compSlug);
      if (compProducts.length > 0) {
        compProducts.sort((a, b) => a.retailPrice - b.retailPrice);
        const p = compProducts[0];
        itemsToAdd.push({
          product: {
            id: p.agentProductId || p.compoundSlug,
            name: p.productName,
            sku: p.productName,
            retailPrice: p.retailPrice,
            costPrice: p.retailPrice,
            bulkCostPrice: p.retailPrice,
            bulkThreshold: 1,
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
    // Check if there is a premixed blend product for this stack
    const premadeProducts = products.filter(p => p.compoundSlug === stack.slug);
    if (premadeProducts.length > 0) {
      premadeProducts.sort((a, b) => a.retailPrice - b.retailPrice);
      return premadeProducts[0].retailPrice;
    }

    let total = 0;
    for (const compSlug of stack.stack_components) {
      const compProducts = products.filter(p => p.compoundSlug === compSlug);
      if (compProducts.length > 0) {
        // Sort descending to get the largest/most expensive standard vials for the stack
        compProducts.sort((a, b) => b.retailPrice - a.retailPrice);
        total += compProducts[0].retailPrice;
      }
    }
    return total;
  };

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
      <header style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', flex: 1 }}>
            {/* Redundant header removed; handled by parent page.tsx */}
          </div>
          <div style={{ display: 'flex', gap: 8, background: 'rgba(255,255,255,0.05)', padding: 4, borderRadius: 12 }}>
            <button onClick={() => setFridgeMode(!fridgeMode)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: fridgeMode ? 'rgba(104, 211, 145, 0.15)' : 'transparent', color: fridgeMode ? '#68D391' : '#A8B4C0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, borderLeft: '1px solid rgba(255,255,255,0.1)', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
              <Beaker size={18} /> My Fridge
            </button>
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
        <div style={{ position: 'relative', flexGrow: 1, maxWidth: 400, zIndex: 40 }}>
          <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#A8B4C0' }} />
          <input 
            type="text" 
            placeholder="Search stacks or compounds..." 
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setSuggestOpen(true); }}
            onFocus={() => setSuggestOpen(true)}
            onBlur={() => setTimeout(() => setSuggestOpen(false), 200)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                e.preventDefault();
                addHistory(searchQuery.trim());
                setSuggestOpen(false);
              }
            }}
            style={{ width: '100%', padding: '12px 14px 12px 42px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', outline: 'none' }}
          />
          {suggestOpen && (searchQuery.trim().length > 0 || recent.length > 0) && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px' }}>
              <AutocompleteDropdown
                id="stacks-search-autocomplete"
                suggestions={suggestions}
                recent={recent}
                onSelect={(s: { display_name: string }) => { addHistory(s.display_name); setSearchQuery(s.display_name); setSuggestOpen(false); }}
                onSelectRecent={(t: string) => { addHistory(t); setSearchQuery(t); setSuggestOpen(false); }}
              />
            </div>
          )}
          {suggestOpen && searchQuery.trim().length === 0 && recent.length === 0 && (
             <TrendingSearchesDropdown 
               onSelect={(term: string) => {
                 addHistory(term);
                 setSearchQuery(term);
                 setSuggestOpen(false);
               }}
             />
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16, scrollbarWidth: 'none' }}>
          {categories.map(cat => {
            let areaId = 'all';
            if (cat !== 'All') {
              const entry = Object.entries(RESEARCH_AREAS).find(([k, v]) => v.label === cat);
              if (entry) areaId = entry[0];
            }
            const imgSrc = cat === 'All' ? '/nav-icons/research-v2.png' : `/images/areas/${areaId}.png`;

            return (
            <button 
              key={cat} 
              onClick={() => setActiveCategory(cat)}
              style={{ 
                flex: '0 0 auto',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                width: 110, height: 110, borderRadius: 16, 
                border: activeCategory === cat ? '3px solid #C0C8D0' : '2px solid #88929C', 
                background: activeCategory === cat ? 'linear-gradient(145deg, rgba(192,200,208,0.2) 0%, rgba(136,146,156,0.05) 100%)' : 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.2) 100%)', 
                color: activeCategory === cat ? '#E2E8F0' : '#A8B4C0', 
                cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem',
                boxShadow: activeCategory === cat ? '0 0 20px rgba(192,200,208,0.3), inset 0 2px 10px rgba(255,255,255,0.2)' : 'inset 0 1px 0 rgba(255,255,255,0.1)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                padding: '12px 8px',
                textAlign: 'center',
                lineHeight: 1.2
              }}
            >
              <div style={{ width: 48, height: 48, marginBottom: 8, position: 'relative' }}>
                <Image src={imgSrc} alt={cat} fill unoptimized style={{ objectFit: 'contain', filter: activeCategory === cat ? 'brightness(1.2)' : 'grayscale(0.4) brightness(0.8)', transition: 'all 0.3s' }} />
              </div>
              {cat}
            </button>
            );
          })}
        </div>
      </div>

      {viewMode === 'map' ? (
        <NodeMapVisualizer stacks={filteredStacks} bySlug={bySlug} onStackClick={setActiveStackDrawer} />
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
            const isPremade = products.some(p => p.compoundSlug === stack.slug);

            return (
              <motion.article
                key={stack.slug}
                className="glass-panel"
                whileHover={{ y: -4, boxShadow: '0 12px 30px rgba(0,0,0,0.5), inset 0 2px 10px rgba(255,255,255,0.3)' }}
                style={{ 
                  padding: 0, overflow: 'hidden', position: 'relative', cursor: 'pointer', 
                  border: isComparing ? '3px solid #00E5FF' : '3px solid #A8B4C0',
                  background: 'linear-gradient(145deg, rgba(30,35,40,0.9) 0%, rgba(15,20,25,0.95) 100%)',
                  borderRadius: 24
                }}
                onClick={() => setActiveStackDrawer(stack.slug)}
              >
                {/* Out of Stock Warning Badge */}
                {stack.stack_components.some(slug => !products.some(p => p.compoundSlug === slug && p.inventoryCount > 0)) && (
                  <div style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(255, 60, 60, 0.9)', color: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 800, zIndex: 10, backdropFilter: 'blur(10px)', boxShadow: '0 4px 12px rgba(255, 60, 60, 0.4)' }}>
                    LOW STOCK
                  </div>
                )}
                {/* Compare Checkbox */}
                <div 
                  onClick={(e) => { e.stopPropagation(); toggleCompare(stack.slug); }}
                  style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, width: 24, height: 24, borderRadius: 6, border: isComparing ? 'none' : '1px solid rgba(255,255,255,0.2)', background: isComparing ? '#00E5FF' : 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {isComparing && <CheckCircle2 size={16} color="#000" />}
                </div>

                <div style={{ padding: 'var(--space-5)' }}>
                  {/* Image Cluster - AT VERY TOP */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', justifyContent: 'center', marginBottom: 20, width: '100%', overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
                    {stack.stack_components.map((compSlug, i) => {
                      const compProducts = products.filter((prod) => prod.compoundSlug === compSlug);
                      compProducts.sort((a, b) => b.retailPrice - a.retailPrice);
                      const p = compProducts.length > 0 ? compProducts[0] : undefined;
                      const imageUrl = p?.imageUrl || '/images/placeholder_vial.png';
                      const comp = bySlug.get(compSlug);
                      const label = comp?.display_name ?? compSlug;
                      const price = p ? p.retailPrice : 0;
                      
                      return (
                        <div key={compSlug} style={{ 
                          flex: '1 1 0', minWidth: 0, maxWidth: 160,
                          position: 'relative',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
                        }}>
                          <div style={{
                            width: '100%', aspectRatio: '1 / 1.2',
                            borderRadius: 16, 
                            background: 'radial-gradient(circle at center, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0.3) 100%)',
                            border: '2px solid #88929C',
                            boxShadow: 'inset 0 2px 8px rgba(255,255,255,0.2), 0 4px 12px rgba(0,0,0,0.4)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            overflow: 'hidden', padding: 8,
                            position: 'relative'
                          }}>
                            <Image src={imageUrl} alt={label} width={200} height={200} unoptimized style={{ width: '90%', height: '90%', objectFit: 'contain' }} />
                            <div style={{
                              position: 'absolute', bottom: 0, left: 0, right: 0,
                              padding: '16px 4px 6px',
                              background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.9) 100%)',
                              color: '#C0C8D0', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase',
                              textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                            }}>
                              {label}
                            </div>
                          </div>
                          <div style={{ marginTop: 6, fontSize: '0.85rem', fontWeight: 700, color: '#C0C8D0' }}>
                            ${price.toFixed(2)}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Badges - BELOW IMAGES */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
                    {citationCount > 0 && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'linear-gradient(90deg, rgba(192, 200, 208, 0.15) 0%, rgba(192, 200, 208, 0.05) 100%)', color: '#C0C8D0', padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(192, 200, 208, 0.2)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <FlaskConical size={12} /> {citationCount} Research Studies
                      </div>
                    )}
                    {synergy.status === 'excellent' && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'linear-gradient(90deg, rgba(168, 180, 192, 0.2) 0%, rgba(168, 180, 192, 0.05) 100%)', color: '#A8B4C0', padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(168, 180, 192, 0.3)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', boxShadow: '0 0 12px rgba(168, 180, 192, 0.1)' }}>
                        Synergy: {synergy.synergyScore}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {(() => {
                        const fullTitle = isPremade ? products.filter(p => p.compoundSlug === stack.slug).sort((a,b)=>a.retailPrice-b.retailPrice)[0].productName : stack.display_name;
                        const hasSubtitle = fullTitle.includes('(') && fullTitle.endsWith(')');
                        const mainTitle = hasSubtitle ? fullTitle.substring(0, fullTitle.indexOf('(')).trim() : fullTitle;
                        const subtitle = hasSubtitle ? fullTitle.substring(fullTitle.indexOf('(')) : '';
                        
                        let titleFontSize = '1.4rem';
                        if (mainTitle.length > 25) titleFontSize = '1.05rem';
                        else if (mainTitle.length > 20) titleFontSize = '1.15rem';
                        else if (mainTitle.length > 15) titleFontSize = '1.25rem';

                        return (
                          <>
                            <h2 style={{ margin: 0, color: '#E2E8F0', fontWeight: 800, fontSize: titleFontSize, letterSpacing: '-0.01em', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {mainTitle}
                            </h2>
                            {subtitle && (
                              <div style={{ fontSize: '0.75rem', color: '#A8B4C0', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {subtitle}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    {isPremade ? (
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#E2E8F0', whiteSpace: 'nowrap' }}>
                        ${bundlePrice.toFixed(2)}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#E2E8F0', whiteSpace: 'nowrap' }}>
                          ${(bundlePrice * 0.9).toFixed(2)}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#68D391', fontWeight: 700, marginTop: 2 }}>Stack Discount Applied</div>
                      </div>
                    )}
                  </div>
                  
                  {stack.stack_rationale && (
                    <p style={{ margin: 'var(--space-2) 0 0', color: '#D0DAE4', lineHeight: 1.55, fontSize: '0.9rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {stack.stack_rationale}
                    </p>
                  )}
                  
                  {stack.stack_components.length > 0 && (
                    <div style={{ marginTop: 'var(--space-4)' }}>
                      {!isPremade && (
                        <p style={{ margin: '0 0 var(--space-4)', color: '#FFB86C', fontSize: '0.75rem', fontWeight: 700, lineHeight: 1.4, background: 'rgba(255, 184, 108, 0.1)', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(255, 184, 108, 0.2)' }}>
                          ⚠️ This Peptide Stack is not all inside one vial, it's individually packaged. You will receive {stack.stack_components.length} separate vials.
                        </p>
                      )}
                      {isPremade && (
                        <p style={{ margin: '0 0 var(--space-4)', color: '#50FA7B', fontSize: '0.75rem', fontWeight: 800, lineHeight: 1.4, background: 'rgba(80, 250, 123, 0.1)', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(80, 250, 123, 0.2)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CheckCircle2 size={16} /> Premixed Blend (All in 1 Vial)
                        </p>
                      )}
                      <p style={{ margin: '0 0 var(--space-2)', color: '#A8B4C0', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Components
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {stack.stack_components.map((compSlug) => {
                          const compProducts = products.filter((prod) => prod.compoundSlug === compSlug);
                          compProducts.sort((a, b) => b.retailPrice - a.retailPrice);
                          const p = compProducts.length > 0 ? compProducts[0] : undefined;
                          const imageUrl = p?.imageUrl || '/images/placeholder_vial.png';
                          const comp = bySlug.get(compSlug);
                          const label = comp?.display_name ?? compSlug;
                          const priceText = p ? `$${p.retailPrice.toFixed(2)}` : '';
                          return (
                            <div
                              key={compSlug}
                              style={{
                                padding: '0.4rem 0.8rem',
                                borderRadius: '8px',
                                border: '2px solid #88929C',
                                background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.2) 100%)',
                                color: '#D0DAE4',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                              <Image src={imageUrl} alt={label} width={200} height={200} unoptimized style={{ width: 16, height: 16, objectFit: 'contain' }} />
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span>{label}</span>
                                {priceText && <span style={{ color: '#A8B4C0', fontSize: '0.65rem' }}>{priceText}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                    {/* Removed redundant Est Price display since it's now in the header */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleAddToCart(stack); }}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', marginTop: 24 }}
                    >
                      <Image src="/images/add_stack_to_cart_btn.png" alt="Add Stack To Cart" width={200} height={200} unoptimized style={{ height: 64, objectFit: 'contain' }} />
                    </button>
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
            onAddToCart={(stack: Compound) => handleAddToCart(stack)}
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
            products={products}
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
        <StackBuilder compounds={compounds} products={products} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stacks Compare Drawer
// ─────────────────────────────────────────────────────────────────────────────
interface StacksCompareDrawerProps {
  stack1: Compound;
  stack2: Compound;
  bySlug: Map<string, Compound>;
  products: AreaProduct[];
  onClose: () => void;
  synergy1: StackAnalysis;
  synergy2: StackAnalysis;
  bundlePrice1: number;
  bundlePrice2: number;
}

function StacksCompareDrawer({ stack1, stack2, bySlug, products, onClose, synergy1, synergy2, bundlePrice1, bundlePrice2 }: StacksCompareDrawerProps) {
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
              {stack1.stack_components.map((slug: string) => {
                const p = products.find((pr) => pr.compoundSlug === slug);
                const imageUrl = p?.imageUrl || '/images/placeholder_vial.png';
                return (
                  <div key={slug} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', padding: '10px 14px', borderRadius: 8, marginBottom: 8, fontSize: '0.85rem', color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Image src={imageUrl} alt={slug} width={200} height={200} unoptimized style={{ width: 20, height: 20, objectFit: 'contain' }} />
                    {bySlug.get(slug)?.display_name || slug}
                  </div>
                );
              })}
            </div>
            <div>
              <div style={{ marginBottom: 12, fontSize: '0.8rem', color: '#A8B4C0', textTransform: 'uppercase', fontWeight: 700 }}>Included Compounds</div>
              {stack2.stack_components.map((slug: string) => {
                const p = products.find((pr) => pr.compoundSlug === slug);
                const imageUrl = p?.imageUrl || '/images/placeholder_vial.png';
                return (
                  <div key={slug} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', padding: '10px 14px', borderRadius: 8, marginBottom: 8, fontSize: '0.85rem', color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Image src={imageUrl} alt={slug} width={200} height={200} unoptimized style={{ width: 20, height: 20, objectFit: 'contain' }} />
                    {bySlug.get(slug)?.display_name || slug}
                  </div>
                );
              })}
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
function NodeMapVisualizer({ stacks, bySlug, onStackClick }: { stacks: Compound[], bySlug: Map<string, Compound>, onStackClick?: (slug: string) => void }) {
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
      
      <div style={{ position: 'relative', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,229,255,0.02) 0%, transparent 70%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Animated Radar Ring */}
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 20, ease: 'linear' }} style={{ position: 'absolute', inset: 20, borderRadius: '50%', border: '1px dashed rgba(0, 229, 255, 0.2)', pointerEvents: 'none' }} />
        <motion.div animate={{ rotate: -360 }} transition={{ repeat: Infinity, duration: 30, ease: 'linear' }} style={{ position: 'absolute', inset: 60, borderRadius: '50%', border: '1px dotted rgba(104, 211, 145, 0.2)', pointerEvents: 'none' }} />
        
        {/* Center Node */}
        <motion.div 
          animate={{ boxShadow: ['0 0 20px rgba(0,229,255,0.2)', '0 0 40px rgba(0,229,255,0.5)', '0 0 20px rgba(0,229,255,0.2)'] }}
          transition={{ repeat: Infinity, duration: 3 }}
          style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 90, height: 90, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,229,255,0.15) 0%, rgba(0,0,0,0.9) 100%)', border: '2px solid #00E5FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, zIndex: 10, textAlign: 'center', fontSize: '0.8rem', boxShadow: 'inset 0 0 20px rgba(0,229,255,0.2)' }}
        >
          {centerName}
        </motion.div>

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
interface StackDrawerProps {
  stackSlug: string;
  bySlug: Map<string, Compound>;
  products: AreaProduct[];
  onClose: () => void;
  onAddToCart: (stack: Compound) => void;
  bundlePrice: number;
  synergyData: StackAnalysis;
}

function StackDrawer({ stackSlug, bySlug, products, onClose, onAddToCart, bundlePrice, synergyData }: StackDrawerProps) {
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(16px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ position: 'absolute', inset: 0 }} onClick={onClose} />
      <motion.div 
        initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        style={{ width: '100%', maxWidth: 640, maxHeight: '90vh', background: 'rgba(10, 15, 20, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.6)', overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'sticky', top: 0, background: 'linear-gradient(to bottom, rgba(10,15,20,0.98) 0%, rgba(10,15,20,0.9) 100%)', zIndex: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900, color: '#C0C8D0' }}>{stack.display_name}</h2>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#C0C8D0', marginTop: 4 }}>
              ${(bundlePrice * 0.9).toFixed(2)}
              <span style={{ fontSize: '0.7rem', color: '#68D391', marginLeft: 8, verticalAlign: 'middle' }}>10% Stack Discount</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#FFF', borderRadius: '50%', padding: 8, cursor: 'pointer', display: 'flex', transition: 'all 0.2s ease-in-out' }}><X size={20} /></button>
        </div>

        <div style={{ padding: '0 32px', display: 'flex', gap: 24, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={() => setActiveTab('overview')} style={{ padding: '16px 0', background: 'none', border: 'none', borderBottom: activeTab === 'overview' ? '2px solid #C0C8D0' : '2px solid transparent', color: activeTab === 'overview' ? '#C0C8D0' : '#A8B4C0', fontWeight: 600, cursor: 'pointer' }}>Overview</button>
          <button onClick={() => setActiveTab('calculator')} style={{ padding: '16px 0', background: 'none', border: 'none', borderBottom: activeTab === 'calculator' ? '2px solid #C0C8D0' : '2px solid transparent', color: activeTab === 'calculator' ? '#C0C8D0' : '#A8B4C0', fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}><Beaker size={16} /> Reconstitution Math</button>
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

              <div style={{ marginTop: 24 }}>
                <h4 style={{ margin: '0 0 16px', color: '#fff', fontSize: '1.1rem' }}>Component Breakdown</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
                  {stack.stack_components.map((slug: string) => {
                    const compProducts = products.filter((prod) => prod.compoundSlug === slug);
                    compProducts.sort((a, b) => b.retailPrice - a.retailPrice);
                    const p = compProducts.length > 0 ? compProducts[0] : undefined;
                    const imageUrl = p?.imageUrl || '/images/placeholder_vial.png';
                    const comp = bySlug.get(slug);
                    const label = comp?.display_name ?? slug;
                    const price = p ? p.retailPrice : 0;
                    
                    return (
                      <div key={slug} style={{
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center'
                      }}>
                        <Image src={imageUrl} alt={label} width={200} height={200} unoptimized style={{ width: 80, height: 80, objectFit: 'contain', marginBottom: 12 }} />
                        <div style={{ color: '#C0C8D0', fontSize: '0.85rem', fontWeight: 800, textAlign: 'center' }}>{label}</div>
                        <div style={{ color: '#00E5FF', fontSize: '1rem', fontWeight: 700, marginTop: 4 }}>${price.toFixed(2)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

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
                const p = products.find((pr: AreaProduct) => pr.compoundSlug === slug);
                const imageUrl = p?.imageUrl || '/images/placeholder_vial.png';

                return (
                  <div key={slug} style={{ marginBottom: 16, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <h4 style={{ margin: '0 0 12px', color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Image src={imageUrl} alt={slug} width={200} height={200} unoptimized style={{ width: 20, height: 20, objectFit: 'contain' }} />
                      {bySlug.get(slug)?.display_name}
                    </h4>
                    <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', color: '#A8B4C0', marginBottom: 6 }}>Vial Mass: {s.mass}mg</label>
                          <input type="range" min="1" max="30" step="1" value={s.mass} onChange={e => handleCalcChange(slug, 'mass', parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#00E5FF' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', color: '#A8B4C0', marginBottom: 6 }}>BAC Water Added: {s.diluent}mL</label>
                          <input type="range" min="0.5" max="5" step="0.1" value={s.diluent} onChange={e => handleCalcChange(slug, 'diluent', parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#00E5FF' }} />
                        </div>
                      </div>
                      <div style={{ width: 80, height: 160, position: 'relative' }}>
                        {/* SVG Syringe Visualizer */}
                        <svg viewBox="0 0 40 130" style={{ width: '100%', height: '100%' }}>
                          {/* Tip (pointing UP) */}
                          <path d="M 17 20 L 19 5 L 21 5 L 23 20 Z" fill="rgba(255,255,255,0.1)" />
                          {/* Barrel */}
                          <rect x="10" y="20" width="20" height="90" rx="2" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                          
                          {/* Liquid */}
                          <rect x="11" y="21" width="18" height={Math.max(0, (20 + (s.diluent / 5) * 85) - 21)} fill="rgba(0,229,255,0.4)" />
                          
                          {/* Plunger Top (Rubber stopper) */}
                          <rect x="11" y={20 + (s.diluent / 5) * 85} width="18" height="5" fill="#1e293b" />
                          
                          {/* Plunger Rod */}
                          <rect x="16" y={(20 + (s.diluent / 5) * 85) + 5} width="8" height={130 - ((20 + (s.diluent / 5) * 85) + 5)} fill="#334155" />
                          
                          {/* Tick marks */}
                          {[1, 2, 3, 4, 5].map(mL => {
                            const tickY = 20 + (mL / 5) * 85;
                            return <line key={mL} x1="10" y1={tickY} x2="16" y2={tickY} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />;
                          })}
                        </svg>
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
            <div style={{ fontSize: '0.75rem', color: '#A8B4C0', fontWeight: 700, textTransform: 'uppercase' }}>Bundle Price (-10%)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1rem', color: '#64748b', textDecoration: 'line-through' }}>${bundlePrice.toFixed(2)}</span>
              <span style={{ fontSize: '1.4rem', color: '#00E5FF', fontWeight: 800 }}>${(bundlePrice * 0.9).toFixed(2)}</span>
            </div>
          </div>
          <button 
            onClick={() => { onAddToCart(stack); onClose(); }} 
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', filter: 'drop-shadow(0 4px 15px rgba(0,229,255,0.3))' }}
          >
            <Image src="/images/add_stack_to_cart_btn.png" alt="Add Bundle To Cart" width={200} height={200} unoptimized style={{ height: 56, objectFit: 'contain' }} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
