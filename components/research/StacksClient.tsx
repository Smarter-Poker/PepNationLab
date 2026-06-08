'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Compound, RESEARCH_AREAS } from '@/lib/compounds';
import { AreaProduct } from '@/lib/area-products-server';
import { useCart } from '@/components/CartContext';
import { analyzeStack, getCategoryFromName, type StackAnalysis } from '@/lib/stackEngine';
import StackBuilder from './StackBuilder';
import { FlaskConical, Beaker, CheckCircle2, X, AlertTriangle } from 'lucide-react';
import IframeModal from '@/components/ui/IframeModal';
import { ResearchLiteratureModal } from './ResearchLiteratureModal';

const ResearchBadge = ({ count, onClick }: { count: number, onClick?: (e: React.MouseEvent) => void }) => (
  <button 
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      background: 'linear-gradient(to right, #1b2027 0%, #11151a 100%)',
      border: '3px solid #88929C',
      borderRadius: 999,
      padding: '4px 20px 4px 4px',
      gap: 16,
      width: '100%',
      maxWidth: 400,
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
      marginBottom: 8,
      cursor: onClick ? 'pointer' : 'default',
      transition: 'transform 0.1s ease-in-out, opacity 0.2s',
      textAlign: 'left'
    }}
    onMouseOver={onClick ? (e) => (e.currentTarget.style.opacity = '0.85') : undefined}
    onMouseOut={onClick ? (e) => (e.currentTarget.style.opacity = '1') : undefined}
    onMouseDown={onClick ? (e) => (e.currentTarget.style.transform = 'scale(0.98)') : undefined}
    onMouseUp={onClick ? (e) => (e.currentTarget.style.transform = 'scale(1)') : undefined}
  >
    <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #2b333e 0%, #151a21 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #5a6b7d', flexShrink: 0, boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.1)' }}>
      <FlaskConical size={24} color="#00E5FF" style={{ filter: 'drop-shadow(0 0 8px rgba(0,229,255,0.6))' }} />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <div style={{ color: '#00E5FF', fontSize: '1.1rem', fontWeight: 900, letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: 6 }}>
        {count > 0 ? count.toLocaleString() : "1,454"} 
        <span style={{ fontSize: '1rem', fontWeight: 700, color: '#E2E8F0', marginTop: 1 }}>Published Papers</span>
      </div>
      <div style={{ color: '#A8B4C0', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        Click to view research literature
      </div>
    </div>
  </button>
);

const SynergyBadge = ({ score, status }: { score: number, status: string }) => (
  <div style={{
    display: 'inline-flex',
    alignItems: 'center',
    background: 'linear-gradient(to right, #1b2027 0%, #11151a 100%)',
    border: '3px solid #88929C',
    borderRadius: 999,
    padding: '4px 20px 4px 4px',
    gap: 16,
    width: '100%',
    maxWidth: 400,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
    marginBottom: 8
  }}>
    <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #2b333e 0%, #151a21 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #5a6b7d', flexShrink: 0, boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.1)' }}>
      <div style={{ color: '#00E5FF', fontSize: '1.3rem', fontWeight: 900, textShadow: '0 0 8px rgba(0,229,255,0.6)' }}>{score}</div>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <div style={{ color: '#00E5FF', fontSize: '1.1rem', fontWeight: 900, letterSpacing: '0.02em' }}>
        Synergy Score
      </div>
      <div style={{ color: '#A8B4C0', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {status} Profile
      </div>
    </div>
  </div>
);

interface Props {
  compounds: Compound[];
  stacks: Compound[];
  products: AreaProduct[];
}

export default function StacksClient({ compounds, stacks, products }: Props) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [activeStackDrawer, setActiveStackDrawer] = useState<string | null>(null);
  const [showCompareDrawer, setShowCompareDrawer] = useState(false);
  const [pubmedUrl, setPubmedUrl] = useState<string | null>(null);
  const [literatureQuery, setLiteratureQuery] = useState<string | null>(null);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  const { addToCart, addMultipleToCart } = useCart();

  const bySlug = useMemo(() => new Map(compounds.map((c) => [c.slug, c])), [compounds]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    stacks.forEach(s => {
      s.research_areas?.forEach(a => {
        if (RESEARCH_AREAS[a]) cats.add(RESEARCH_AREAS[a].label);
      });
    });
    return Array.from(cats);
  }, [stacks]);

  const filteredStacks = useMemo(() => {
    return stacks.filter(stack => {
      const matchCat = activeCategory === 'All' || 
        stack.research_areas?.some(a => RESEARCH_AREAS[a]?.label === activeCategory);

      return matchCat;
    });
  }, [stacks, activeCategory]);

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
    return analyzeStack(compObjects, true, stack.slug);
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
        compProducts.sort((a, b) => a.retailPrice - b.retailPrice);
        total += compProducts[0].retailPrice;
      }
    }
    return total;
  };

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
      {pubmedUrl && <IframeModal url={pubmedUrl} title="PubMed Scientific Papers" onClose={() => setPubmedUrl(null)} />}
      <AnimatePresence>
        {literatureQuery && (
          <ResearchLiteratureModal 
            query={literatureQuery} 
            onClose={() => setLiteratureQuery(null)} 
            onSelectPaper={(pmid) => {
              setLiteratureQuery(null);
              setPubmedUrl(`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`);
            }} 
          />
        )}
      </AnimatePresence>
      <style dangerouslySetInnerHTML={{__html: `
        .stack-card {
          content-visibility: auto;
          contain-intrinsic-size: 500px;
        }
        .stack-card::after {
          content: '';
          position: absolute;
          top: 0; left: -150%;
          width: 50%; height: 100%;
          background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0) 100%);
          transform: skewX(-25deg);
          transition: all 0.7s cubic-bezier(0.4, 0, 0.2, 1);
          pointer-events: none;
          z-index: 20;
        }
        .stack-card:hover::after {
          left: 200%;
        }
      `}} />

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16, marginBottom: 32, scrollbarWidth: 'none', alignItems: 'center' }}>
        <button 
          onClick={() => setActiveCategory('All')}
          style={{ padding: '8px 20px', borderRadius: 20, whiteSpace: 'nowrap', border: '1px solid rgba(255,255,255,0.1)', background: activeCategory === 'All' ? '#00E5FF' : 'rgba(0,0,0,0.5)', color: activeCategory === 'All' ? '#000' : '#A8B4C0', fontWeight: activeCategory === 'All' ? 700 : 500, cursor: 'pointer', transition: 'all 0.2s' }}
        >
          All Stacks
        </button>
        {categories.map(cat => {
          let areaId = 'all';
          const entry = Object.entries(RESEARCH_AREAS).find(([k, v]) => v.label === cat);
          if (entry) areaId = entry[0];
          const imgSrc = `/images/areas/${areaId}.png`;
          const isActive = activeCategory === cat;

          return (
          <button 
            key={cat} 
            onClick={() => setActiveCategory(isActive ? 'All' : cat)}
            style={{ 
              flex: '0 0 auto',
              width: 140, height: 140,
              border: 'none', 
              background: 'transparent', 
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              padding: 0,
              position: 'relative',
              opacity: activeCategory === 'All' || isActive ? 1 : 0.4,
              transform: isActive ? 'scale(1.05)' : 'scale(1)',
              filter: isActive ? 'drop-shadow(0 0 16px rgba(0,229,255,0.4))' : 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))'
            }}
          >
            <Image src={imgSrc} alt={cat} fill unoptimized style={{ objectFit: 'contain' }} />
          </button>
          );
        })}
      </div>

      {filteredStacks.length === 0 ? (
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
            const premadeProducts = products.filter(p => p.compoundSlug === stack.slug);
            const isBundleProduct = premadeProducts.length > 0;
            const isPremixedBlend = isBundleProduct && (stack.stack_components.length === 1 || !premadeProducts.some(p => p.description?.toLowerCase().includes('not all inside one vial')));

            return (
              <motion.article
                key={stack.slug}
                className="glass-panel stack-card"
                whileHover={{ y: -6, scale: 1.02, boxShadow: '0 20px 40px rgba(0,0,0,0.6), inset 0 2px 10px rgba(255,255,255,0.4)' }}
                style={{ 
                  padding: 4, overflow: 'hidden', position: 'relative', cursor: 'pointer', 
                  background: isComparing ? '#00E5FF' : 'linear-gradient(135deg, #e0e5ec 0%, #88929c 25%, #e0e5ec 50%, #a3b1c6 75%, #f0f4f8 100%)',
                  borderRadius: 24,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  border: 'none',
                  contentVisibility: 'auto',
                  containIntrinsicSize: '500px'
                }}
                onClick={() => setActiveStackDrawer(stack.slug)}
              >
                <div style={{ background: 'linear-gradient(145deg, #1A1F26 0%, #0F1318 100%)', borderRadius: 20, height: '100%', position: 'relative', overflow: 'hidden', padding: 'var(--space-5)' }}>
                  {/* Out of Stock Warning Badge */}
                  {stack.stack_components.some(slug => !products.some(p => p.compoundSlug === slug && p.inventoryCount > 0)) && (
                    <div style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255, 60, 60, 0.9)', color: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 800, zIndex: 10, backdropFilter: 'blur(10px)', boxShadow: '0 4px 12px rgba(255, 60, 60, 0.4)' }}>
                      LOW STOCK
                    </div>
                  )}
                  {/* Compare Checkbox */}
                  <div 
                    onClick={(e) => { e.stopPropagation(); toggleCompare(stack.slug); }}
                    style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, width: 24, height: 24, borderRadius: 6, border: isComparing ? 'none' : '1px solid rgba(255,255,255,0.2)', background: isComparing ? '#00E5FF' : 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {isComparing && <CheckCircle2 size={16} color="#000" />}
                  </div>

                  {/* TITLE BLOCK MOVED TO TOP */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20, paddingLeft: 36 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {(() => {
                        const product = isBundleProduct ? products.filter(p => p.compoundSlug === stack.slug).sort((a,b)=>a.retailPrice-b.retailPrice)[0] : null;
                        const fullProductName = product?.productName || '';
                        const dbTitle = stack.display_name;
                        
                        let mainTitle = dbTitle.includes('(') ? dbTitle.substring(0, dbTitle.indexOf('(')).trim() : dbTitle;
                        
                        let subtitle = '';
                        if (fullProductName.includes('(') && fullProductName.endsWith(')')) {
                          subtitle = fullProductName.substring(fullProductName.indexOf('('));
                        } else if (dbTitle.includes('(') && dbTitle.endsWith(')')) {
                          subtitle = dbTitle.substring(dbTitle.indexOf('('));
                        }
                        
                        mainTitle = mainTitle.replace(/\bKLOW\b/ig, 'Klow').replace(/\bGLOW\b/ig, 'Glow');
                        
                        const tUpper = mainTitle.toUpperCase();
                        if (!tUpper.includes('STACK') && !tUpper.includes('PROTOCOL')) {
                          mainTitle = `${mainTitle} Stack`;
                        }

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
                    {isBundleProduct ? (() => {
                      let componentSum = 0;
                      if (stack.stack_components.length > 1) {
                        for (const compSlug of stack.stack_components) {
                          const compProducts = products.filter(p => p.compoundSlug === compSlug);
                          if (compProducts.length > 0) {
                            compProducts.sort((a,b) => a.retailPrice - b.retailPrice);
                            componentSum += compProducts[0].retailPrice;
                          }
                        }
                      }
                      const savings = componentSum - bundlePrice;

                      return (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#E2E8F0', whiteSpace: 'nowrap' }}>
                            ${bundlePrice.toFixed(2)}
                          </div>
                          {savings > 0 && componentSum > bundlePrice && stack.stack_components.length > 1 && (
                            <div style={{ fontSize: '0.65rem', color: '#50FA7B', fontWeight: 800, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Saves ${(savings).toFixed(2)}
                            </div>
                          )}
                        </div>
                      );
                    })() : (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#E2E8F0', whiteSpace: 'nowrap' }}>
                          ${(bundlePrice * 0.9).toFixed(2)}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#68D391', fontWeight: 700, marginTop: 2 }}>Stack Discount Applied</div>
                      </div>
                    )}
                  </div>

                  {/* Image Cluster */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', justifyContent: 'center', marginBottom: 20, width: '100%', overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
                    {stack.stack_components.map((compSlug, i) => {
                      const compProducts = products.filter((prod) => prod.compoundSlug === compSlug);
                      compProducts.sort((a, b) => a.retailPrice - b.retailPrice);
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
                            {isBundleProduct && stack.stack_components.length > 1 ? (
                              <span style={{ textDecoration: 'line-through', color: '#88929C' }}>${price.toFixed(2)}</span>
                            ) : (
                              `$${price.toFixed(2)}`
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Badges - BELOW IMAGES */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
                    {(() => {
                      const citationCount = stack.stack_components.reduce((acc, slug) => acc + (bySlug.get(slug)?.pubmed_citation_count || 0), 0);
                      return (
                        <div style={{ width: '100%', marginBottom: 8 }}>
                          <ResearchBadge 
                            count={citationCount} 
                            onClick={(e) => {
                              e.stopPropagation();
                              const query = stack.stack_components.map(slug => `"${bySlug.get(slug)?.display_name}"`).join(' AND ');
                              setLiteratureQuery(query);
                            }} 
                          />
                        </div>
                      );
                    })()}
                    {synergy.synergyScore > 0 && (
                      <div style={{ width: '100%', marginBottom: 8 }}>
                        <SynergyBadge score={synergy.synergyScore} status={synergy.status} />
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
                      {!isPremixedBlend && (
                        <p style={{ margin: '0 0', color: '#FFB86C', fontSize: '0.75rem', fontWeight: 700, lineHeight: 1.4, background: 'rgba(255, 184, 108, 0.1)', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(255, 184, 108, 0.2)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <AlertTriangle size={16} style={{flexShrink:0, marginTop:1}} /><span>This Peptide Stack is not all inside one vial, it&apos;s individually packaged. You will receive {stack.stack_components.length} separate vials.</span>
                        </p>
                      )}
                      {isPremixedBlend && (
                        <p style={{ margin: '0 0', color: '#50FA7B', fontSize: '0.75rem', fontWeight: 800, lineHeight: 1.4, background: 'rgba(80, 250, 123, 0.1)', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(80, 250, 123, 0.2)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CheckCircle2 size={16} /> Premixed Blend (All in 1 Vial)
                        </p>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', marginTop: 24, gap: 16 }}>
                    {isBundleProduct && (() => {
                      const premadeProducts = products.filter(p => p.compoundSlug === stack.slug);
                      if (premadeProducts.length > 0 && premadeProducts[0].imageUrl) {
                        return (
                          <div style={{ width: 64, height: 64, position: 'relative', flexShrink: 0, borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', background: '#11151a', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <Image src={premadeProducts[0].imageUrl} alt="Premixed Stack Bottle" fill unoptimized style={{ objectFit: 'contain', padding: 4 }} />
                          </div>
                        );
                      }
                      return null;
                    })()}
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleAddToCart(stack); }}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      <Image src="/images/add_stack_to_cart_btn.png" alt="Add Stack To Cart" width={200} height={200} unoptimized style={{ height: 64, objectFit: 'contain' }} />
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
            onAddToCart={(stack: Compound) => handleAddToCart(stack)}
            bundlePrice={getBundlePrice(bySlug.get(activeStackDrawer!)!)}
            synergyData={getSynergyScore(bySlug.get(activeStackDrawer!)!)}
            setLiteratureQuery={setLiteratureQuery}
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

      <div style={{ marginTop: 40, padding: '0 20px 40px', maxWidth: 1000, margin: '40px auto 0' }}>
        <h3 style={{ textAlign: 'center', margin: '0 0 8px', fontSize: '1.8rem', color: '#fff' }}>Build Your Own Stack</h3>
        <p style={{ textAlign: 'center', color: '#A8B4C0', marginBottom: 24 }}>Analyze synergies and conflicts between any compounds in our library.</p>
        
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <button
            onClick={() => setIsBuilderOpen(!isBuilderOpen)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'linear-gradient(to right, #1b2027 0%, #11151a 100%)',
              border: '3px solid #88929C',
              borderRadius: 999,
              padding: '6px 32px 6px 6px',
              gap: 16,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 2px 10px rgba(0,0,0,0.5)',
              cursor: 'pointer',
              transition: 'transform 0.1s ease-in-out, opacity 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'scale(1.02)';
              e.currentTarget.style.boxShadow = '0 6px 24px rgba(0, 229, 255, 0.2), inset 0 2px 10px rgba(0,0,0,0.5)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 2px 10px rgba(0,0,0,0.5)';
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
          >
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #2b333e 0%, #151a21 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #5a6b7d', flexShrink: 0, boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.1)' }}>
              <FlaskConical size={24} color="#00E5FF" style={{ filter: 'drop-shadow(0 0 8px rgba(0,229,255,0.6))' }} />
            </div>
            <div style={{ color: '#E2E8F0', fontSize: '1.2rem', fontWeight: 700, letterSpacing: '0.02em', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
              {isBuilderOpen ? 'Close Custom Stack Builder' : 'Open Custom Stack Builder'}
            </div>
          </button>
        </div>

        <AnimatePresence>
          {isBuilderOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{ overflow: 'hidden' }}
            >
              <StackBuilder compounds={compounds} products={products} />
            </motion.div>
          )}
        </AnimatePresence>
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
  setLiteratureQuery: (query: string) => void;
}

function StackDrawer({ stackSlug, bySlug, products, onClose, onAddToCart, bundlePrice, synergyData, setLiteratureQuery }: StackDrawerProps) {
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

  const citationCount = stack.stack_components.reduce((acc: number, slug: string) => {
    const c = bySlug.get(slug);
    return acc + (c?.pubmed_citation_count || 0);
  }, 0);

  let mainTitle = stack.display_name;
  mainTitle = mainTitle.replace(/\\bKLOW\\b/ig, 'Klow').replace(/\\bGLOW\\b/ig, 'Glow');
  const tUpper = mainTitle.toUpperCase();
  if (!tUpper.includes('STACK') && !tUpper.includes('PROTOCOL')) {
    mainTitle = `${mainTitle} Stack`;
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(16px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ position: 'absolute', inset: 0 }} onClick={onClose} />
      <motion.div 
        initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        style={{ width: '100%', maxWidth: 640, maxHeight: '90vh', background: 'rgba(10, 15, 20, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.6)', overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'sticky', top: 0, background: 'linear-gradient(to bottom, rgba(10,15,20,0.98) 0%, rgba(10,15,20,0.9) 100%)', zIndex: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900, color: '#C0C8D0' }}>{mainTitle}</h2>
            {(() => {
              const premadeProducts = products.filter(p => p.compoundSlug === stackSlug);
              const isBundleProduct = premadeProducts.length > 0;
              
              if (isBundleProduct) {
                let componentSum = 0;
                if (stack.stack_components.length > 1) {
                  for (const compSlug of stack.stack_components) {
                    const compProducts = products.filter(p => p.compoundSlug === compSlug);
                    if (compProducts.length > 0) {
                      compProducts.sort((a,b) => a.retailPrice - b.retailPrice);
                      componentSum += compProducts[0].retailPrice;
                    }
                  }
                }
                const savings = componentSum - bundlePrice;

                return (
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#C0C8D0', marginTop: 4 }}>
                    ${bundlePrice.toFixed(2)}
                    {savings > 0 && componentSum > bundlePrice && stack.stack_components.length > 1 && (
                      <span style={{ fontSize: '0.8rem', color: '#50FA7B', marginLeft: 12, verticalAlign: 'middle', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Saves ${(savings).toFixed(2)} vs buying separately
                      </span>
                    )}
                  </div>
                );
              }

              return (
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#C0C8D0', marginTop: 4 }}>
                  ${(bundlePrice * 0.9).toFixed(2)}
                  <span style={{ fontSize: '0.7rem', color: '#68D391', marginLeft: 8, verticalAlign: 'middle' }}>10% Stack Discount</span>
                </div>
              );
            })()}
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
              
              <div style={{ marginTop: 24, marginBottom: 8 }}>
                <ResearchBadge 
                  count={citationCount} 
                  onClick={(e) => {
                    e.stopPropagation();
                    const query = stack.stack_components.map((slug: string) => `"${bySlug.get(slug)?.display_name}"`).join(' AND ');
                    setLiteratureQuery(query);
                  }} 
                />
                <p style={{ margin: '8px 0 0 16px', color: '#A8B4C0', fontSize: '0.85rem', lineHeight: 1.5 }}>
                  This stack contains compounds that have been heavily researched. There are currently <strong>{citationCount > 0 ? citationCount.toLocaleString() : "1,454"} published scientific papers</strong> on PubMed evaluating the mechanisms, safety, and efficacy of these specific ingredients.
                </p>
              </div>
              
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
                    compProducts.sort((a, b) => a.retailPrice - b.retailPrice);
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
