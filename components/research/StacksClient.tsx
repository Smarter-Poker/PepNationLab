'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Compound, RESEARCH_AREAS } from '@/lib/compounds';
import { AreaProduct } from '@/lib/area-products-server';
import { useCart } from '@/components/CartContext';
import { analyzeStack, getCategoryFromName, type StackAnalysis } from '@/lib/stackEngine';
import StackBuilder from './StackBuilder';
import { FlaskConical, Beaker, CheckCircle2, X, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import IframeModal from '@/components/ui/IframeModal';
import { toast } from 'sonner';

function sortStackProducts(a: AreaProduct, b: AreaProduct) {
  const a10 = (a.productName || '').includes('10mg') || (a.unitSize || '').includes('10mg');
  const b10 = (b.productName || '').includes('10mg') || (b.unitSize || '').includes('10mg');
  if (a10 && !b10) return -1;
  if (!a10 && b10) return 1;
  return b.retailPrice - a.retailPrice;
}

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

  const POPULARITY_ORDER = [
    'the-appetite-crusher-stack',
    'appetite-crusher',
    'cagrilintide-semaglutide',
    'gh-synergy-stack',
    'gh-synergy',
    'cjc-1295-ipamorelin',
    'the-wolverine-stack',
    'wolverine-stack',
    'bpc-157-tb-500',
    'glow-stack',
    'glow',
    'klow-stack',
    'klow',
    'the-furnace-stack',
    'furnace-stack',
    'the-lipolysis-stack',
    'lipolysis-stack',
    'limitless-stack',
    'shred-stack',
    'semaglutide',
  ];

  const filteredStacks = useMemo(() => {
    const arr = stacks.filter(stack => {
      const matchCat = activeCategory === 'All' || 
        stack.research_areas?.some(a => RESEARCH_AREAS[a]?.label === activeCategory);

      return matchCat;
    });

    arr.sort((a, b) => {
      let idxA = POPULARITY_ORDER.indexOf(a.slug);
      let idxB = POPULARITY_ORDER.indexOf(b.slug);
      
      if (idxA === -1) idxA = 999;
      if (idxB === -1) idxB = 999;

      if (idxA !== idxB) return idxA - idxB;
      return a.display_name.localeCompare(b.display_name);
    });

    return arr;
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

    // Only purchasable products (those carried on this storefront, i.e. with a
    // real agent_product id) may be added. Falling back to the compound slug as
    // the cart id injects a non-UUID third id type that resolves to neither a
    // product nor an agent_product, so the item is rejected/removed downstream.
    // Check if there is a premixed blend product for this stack
    const premadeProducts = products.filter(p => p.compoundSlug === stack.slug && p.agentProductId);
    if (premadeProducts.length > 0) {
      premadeProducts.sort(sortStackProducts);
      const p = premadeProducts[0];
      addToCart({
        id: p.agentProductId as string,
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
      const compProducts = products.filter(p => p.compoundSlug === compSlug && p.agentProductId);
      if (compProducts.length > 0) {
        compProducts.sort(sortStackProducts);
        const p = compProducts[0];
        itemsToAdd.push({
          product: {
            id: p.agentProductId as string,
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
    } else {
      toast.error('This Stack Is Not Available On This Storefront.');
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
      premadeProducts.sort(sortStackProducts);
      return premadeProducts[0].retailPrice;
    }

    let total = 0;
    for (const compSlug of stack.stack_components) {
      const compProducts = products.filter(p => p.compoundSlug === compSlug);
      if (compProducts.length > 0) {
        // Sort descending to get the largest/most expensive standard vials for the stack
        compProducts.sort(sortStackProducts);
        total += compProducts[0].retailPrice;
      }
    }
    return total;
  };

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
      {pubmedUrl && <IframeModal url={pubmedUrl} title="PubMed Scientific Papers" onClose={() => setPubmedUrl(null)} />}
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
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16, scrollbarWidth: 'none', alignItems: 'center' }}>
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
        <div style={{ textAlign: 'left', color: '#A8B4C0', fontSize: '0.9rem', marginTop: 8, paddingLeft: 4 }}>
          {activeCategory === 'All' 
            ? 'Displaying All Stacks Currently, Click A Category To See Specific Stacks' 
            : `Displaying ${activeCategory} Stacks, Click Again To Show All`}
        </div>
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
                        const product = isBundleProduct ? products.filter(p => p.compoundSlug === stack.slug).sort(sortStackProducts)[0] : null;
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
                            compProducts.sort(sortStackProducts);
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
                          ${(!isBundleProduct && stack.stack_components.length > 1 ? (bundlePrice * 0.9) : bundlePrice).toFixed(2)}
                        </div>
                        {(!isBundleProduct && stack.stack_components.length > 1) && (
                          <div style={{ fontSize: '0.65rem', color: '#68D391', fontWeight: 700, marginTop: 2 }}>Stack Discount Applied</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Image Cluster */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20, width: '100%', overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
                    {stack.stack_components.map((compSlug: string, i: number) => {
                      const compProducts = products.filter((prod) => prod.compoundSlug === compSlug);
                      compProducts.sort(sortStackProducts);
                      const p = compProducts.length > 0 ? compProducts[0] : undefined;
                      const imageUrl = p?.imageUrl || '/images/placeholder_vial.png';
                      const comp = bySlug.get(compSlug);
                      const label = comp?.display_name ?? compSlug;
                      const price = p ? p.retailPrice : 0;
                      
                      return (
                        <div key={compSlug} style={{ 
                          flex: '1 1 0', minWidth: 60, maxWidth: 140,
                          position: 'relative',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
                        }}>
                          <div style={{
                            width: '100%', height: 150,
                            borderRadius: 16, 
                            background: '#0F1318',
                            border: '2px solid rgba(255,255,255,0.2)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            overflow: 'hidden', padding: 0,
                            position: 'relative'
                          }}>
                            <Image src={imageUrl} alt={label} width={200} height={200} unoptimized style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
                            <div style={{
                              position: 'absolute', bottom: 0, left: 0, right: 0,
                              padding: '32px 4px 4px',
                              background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.8) 50%, #000 100%)',
                              color: '#C0C8D0', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase',
                              textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                            }}>
                              {label}
                            </div>
                          </div>

                          {/* Slashed Pricing for Non-Premixed Bundles */}
                          {!isPremixedBlend && stack.stack_components.length > 1 && (
                            <div style={{ marginTop: 8, fontSize: '0.85rem', fontWeight: 700, textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 6 }}>
                              <span style={{ textDecoration: 'line-through', color: '#88929C' }}>${price.toFixed(2)}</span>
                              <span style={{ color: '#C0C8D0' }}>${(price * 0.9).toFixed(2)}</span>
                            </div>
                          )}

                        </div>
                      );
                    })}
                  </div>

                  {/* Description (Simplified) */}
                  {(stack.eli5_summary || stack.plain_summary || stack.stack_rationale) && (
                    <p style={{ margin: 'var(--space-3) 0 0', color: '#D0DAE4', lineHeight: 1.55, fontSize: '0.9rem' }}>
                      {stack.eli5_summary || stack.plain_summary || stack.stack_rationale}
                    </p>
                  )}

                  {/* Synergy Score (Moved under description) */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', marginTop: 16, marginBottom: 16 }}>
                    {synergy.synergyScore > 0 && (
                      <div style={{ width: '100%', marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
                        <div style={{ maxWidth: 500, width: '100%', display: 'flex', justifyContent: 'center' }}>
                          <SynergyBadge score={synergy.synergyScore} status={synergy.status} />
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 24 }}>
                    {/* Bottom thumbnails row */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', justifyContent: 'center', overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none', maxWidth: '100%' }}>
                      {isPremixedBlend ? (() => {
                        const premadeProducts = products.filter(p => p.compoundSlug === stack.slug);
                        if (premadeProducts.length > 0 && premadeProducts[0].imageUrl) {
                          const tUpper = stack.display_name.toUpperCase();
                          const bottomTitle = (!tUpper.includes('STACK') && !tUpper.includes('PROTOCOL')) ? stack.display_name + ' Stack' : stack.display_name;
                          return (
                            <div style={{
                              width: '100%', maxWidth: 300, aspectRatio: '1.2 / 1',
                              borderRadius: 16, 
                              background: '#0F1318',
                              border: '2px solid rgba(255,255,255,0.2)',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              overflow: 'hidden', padding: 0,
                              position: 'relative', flexShrink: 0
                            }}>
                              <Image src={premadeProducts[0].imageUrl} alt={stack.display_name} fill unoptimized style={{ objectFit: 'cover', objectPosition: 'center' }} />
                              <div style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                padding: '32px 4px 4px',
                                background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.8) 50%, #000 100%)',
                                color: '#C0C8D0', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase',
                                textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                              }}>
                                {bottomTitle}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })() : (!isPremixedBlend && ['limitless-stack', 'shred-stack', 'bpc-tb', 'cagrisema', 'cjc-ipamorelin', 'glow', 'klow'].includes(stack.slug)) ? (
                        <div style={{
                          width: '100%', maxWidth: 300, aspectRatio: '1.2 / 1',
                          borderRadius: 16, 
                          background: '#0F1318',
                          border: '2px solid rgba(255,255,255,0.2)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          overflow: 'hidden', padding: 0,
                          position: 'relative', flexShrink: 0
                        }}>
                          <Image 
                            src={`/images/products/${stack.slug === 'glow' || stack.slug === 'klow' ? stack.slug + '-blend.png' : stack.slug + '-combo.png'}`} 
                            alt={stack.display_name} 
                            fill 
                            unoptimized 
                            style={{ objectFit: 'cover', objectPosition: 'center' }} 
                          />
                          <div style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0,
                            padding: '32px 4px 4px',
                            background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.8) 50%, #000 100%)',
                            color: '#C0C8D0', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase',
                            textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                          }}>
                            {stack.display_name.includes('(') ? stack.display_name.substring(0, stack.display_name.indexOf('(')).trim() : stack.display_name}
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', justifyContent: 'center', overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
                          {stack.stack_components.map((compSlug: string, i: number) => {
                            const compProducts = products.filter((prod) => prod.compoundSlug === compSlug);
                            compProducts.sort(sortStackProducts);
                            const p = compProducts.length > 0 ? compProducts[0] : undefined;
                            const imageUrl = p?.imageUrl || '/images/placeholder_vial.png';
                            const comp = bySlug.get(compSlug);
                            const label = comp?.display_name ?? compSlug;

                            return (
                              <div key={compSlug} style={{
                                flex: '1 1 0', minWidth: 60, maxWidth: 140, height: 150,
                                borderRadius: 12, 
                                background: '#0F1318',
                                border: '2px solid rgba(255,255,255,0.2)',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                overflow: 'hidden', padding: 0,
                                position: 'relative',
                              }}>
                                <Image src={imageUrl} alt={label} fill unoptimized style={{ objectFit: 'cover', objectPosition: 'center' }} />
                                <div style={{
                                  position: 'absolute', bottom: 0, left: 0, right: 0,
                                  padding: '24px 4px 4px',
                                  background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.8) 50%, #000 100%)',
                                  color: '#C0C8D0', fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase',
                                  textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                }}>
                                  {label}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Add To Cart Button Centered */}
                  <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleAddToCart(stack); }}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', outline: 'none' }}
                    >
                      <Image src="/images/add_stack_to_cart_btn.png" alt="Add Stack To Cart" width={200} height={200} unoptimized style={{ height: 60, objectFit: 'contain' }} />
                    </button>
                  </div>

                  {/* Badges moved to the very bottom */}
                  {stack.stack_components.length > 0 && (
                    <div style={{ marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'center' }}>
                      {!isPremixedBlend && (
                        <div style={{ width: '100%', maxWidth: 500 }}>
                          <Image src="/images/badge_not_premixed.png" alt="Not Premixed Warning" width={800} height={120} style={{ width: '100%', height: 'auto', display: 'block' }} unoptimized />
                        </div>
                      )}
                      {isPremixedBlend && (
                        <div style={{ width: '100%', maxWidth: 500 }}>
                          <Image src="/images/badge_premixed.png" alt="Premixed Blend" width={800} height={120} style={{ width: '100%', height: 'auto', display: 'block' }} unoptimized />
                        </div>
                      )}
                    </div>
                  )}
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
}

function StackDrawer({ stackSlug, bySlug, products, onClose, onAddToCart, bundlePrice, synergyData }: StackDrawerProps) {
  const stack = bySlug.get(stackSlug);
  const [isSynergyExpanded, setIsSynergyExpanded] = useState(false);

  if (!stack) return null;

  let mainTitle = stack.display_name;
  mainTitle = mainTitle.replace(/\bKLOW\b/g, 'Klow').replace(/\bGLOW\b/g, 'Glow');
  const tUpper = mainTitle.toUpperCase();
  if (!tUpper.includes('STACK') && !tUpper.includes('PROTOCOL')) {
    mainTitle = `${mainTitle} Stack`;
  }

  const missingComponents = stack.stack_components.filter((slug: string) => !products.some((p: AreaProduct) => p.compoundSlug === slug));

  const premadeProducts = products.filter(p => p.compoundSlug === stackSlug);
  const isBundleProduct = premadeProducts.length > 0;
  const bundleImageUrl = isBundleProduct ? premadeProducts[0].imageUrl : null;

  const citationCount = stack.stack_components.reduce((acc: number, slug: string) => {
    const c = bySlug.get(slug);
    return acc + (c?.pubmed_citation_count || 0);
  }, 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(16px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ position: 'absolute', inset: 0 }} onClick={onClose} />
      <motion.div 
        initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        style={{ width: '100%', maxWidth: 640, maxHeight: '90vh', background: 'rgba(10, 15, 20, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.6)', overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'sticky', top: 0, background: 'linear-gradient(to bottom, rgba(10,15,20,0.98) 0%, rgba(10,15,20,0.9) 100%)', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900, color: '#C0C8D0' }}>{mainTitle}</h2>
            {(() => {
              const premadeProducts = products.filter(p => p.compoundSlug === stackSlug);
              const isBundleProduct = premadeProducts.length > 0;
              
              if (isBundleProduct) {
                return (
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#C0C8D0' }}>
                    ${bundlePrice.toFixed(2)}
                  </div>
                );
              }

              return (
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#C0C8D0' }}>
                  ${(stack.stack_components.length > 1 ? (bundlePrice * 0.9) : bundlePrice).toFixed(2)}
                  {stack.stack_components.length > 1 && <span style={{ fontSize: '0.7rem', color: '#68D391', marginLeft: 8, verticalAlign: 'middle' }}>10% Stack Discount</span>}
                </div>
              );
            })()}
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#FFF', borderRadius: '50%', padding: 8, cursor: 'pointer', display: 'flex', transition: 'all 0.2s ease-in-out' }}><X size={20} /></button>
        </div>

        <div style={{ padding: '24px 32px 0 32px' }}>
          <p style={{ color: '#D0DAE4', lineHeight: 1.6, fontSize: '0.95rem', margin: '0 0 24px 0', textAlign: 'center' }}>
            {stack.eli5_summary || stack.plain_summary || stack.stack_rationale}
          </p>

          {/* Banner Image */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
            <div style={{ background: '#0F1318', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16, padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 200, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
              {isBundleProduct && bundleImageUrl ? (
                <Image src={bundleImageUrl} alt={mainTitle} width={180} height={180} style={{ objectFit: 'contain', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.5))' }} unoptimized />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {stack.stack_components.map((slug: string, i: number) => {
                    const p = products.find((pr: AreaProduct) => pr.compoundSlug === slug);
                    return (
                      <div key={slug} style={{ position: 'relative', zIndex: 10 - i, marginLeft: i > 0 ? -40 : 0 }}>
                        <Image src={p?.imageUrl || '/images/placeholder_vial.png'} alt={slug} width={120} height={120} style={{ objectFit: 'contain', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.5))' }} unoptimized />
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ marginTop: 16, color: '#C0C8D0', fontSize: '1.1rem', fontWeight: 800, textAlign: 'center' }}>{mainTitle}</div>
            </div>
          </div>
          
        </div>

        <div style={{ padding: '0 32px 32px 32px', flex: 1 }}>
            <>
              <div style={{ height: 16 }} />              
              {missingComponents.length > 0 && (
                <div style={{ marginTop: 16, padding: 12, background: 'rgba(255, 107, 107, 0.1)', border: '1px solid rgba(255, 107, 107, 0.3)', borderRadius: 12, color: '#FF6B6B', fontSize: '0.85rem' }}>
                  <strong>Note:</strong> {missingComponents.length} component(s) ({missingComponents.map((s: string) => bySlug.get(s)?.display_name).join(', ')}) are currently out of stock and will be skipped when adding to cart.
                </div>
              )}

              <div style={{ marginTop: 24 }}>
                <h4 style={{ margin: '0 0 16px', color: '#fff', fontSize: '1.1rem' }}>Component Breakdown</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {stack.stack_components.map((slug: string) => {
                    const compProducts = products.filter((prod) => prod.compoundSlug === slug);
                    compProducts.sort(sortStackProducts);
                    const p = compProducts.length > 0 ? compProducts[0] : undefined;
                    const imageUrl = p?.imageUrl || '/images/placeholder_vial.png';
                    const comp = bySlug.get(slug);
                    const label = comp?.display_name ?? slug;
                    
                    return (
                      <div key={slug} style={{
                        background: '#0F1318', border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 20
                      }}>
                        <div style={{ width: 80, height: 80, flexShrink: 0, background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Image src={imageUrl} alt={label} width={80} height={80} unoptimized style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: '#C0C8D0', fontSize: '1.1rem', fontWeight: 800 }}>{label}</div>
                          <div style={{ color: '#A8B4C0', fontSize: '0.85rem', marginTop: 8, lineHeight: 1.5 }}>
                            {comp?.eli5_summary || comp?.plain_summary || 'Component formulation for optimal research efficacy.'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div 
                style={{ marginTop: 24, background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 20, cursor: 'pointer', transition: 'all 0.2s', border: '3px solid #88929C', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)' }}
                onClick={() => setIsSynergyExpanded(!isSynergyExpanded)}
                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = '#A0AAB4'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = '#88929C'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h4 style={{ margin: 0, color: '#fff' }}>Synergy Profile</h4>
                  {isSynergyExpanded ? <ChevronUp size={20} color="#A8B4C0" /> : <ChevronDown size={20} color="#A8B4C0" />}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                  <div style={{ width: 60, height: 60, borderRadius: '50%', background: `conic-gradient(#00E5FF 0%, #00E5FF ${synergyData.synergyScore}%, rgba(255,255,255,0.1) ${synergyData.synergyScore}%, rgba(255,255,255,0.1) 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#0F1923', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800 }}>{synergyData.synergyScore}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#00E5FF', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.8rem' }}>{synergyData.status}</div>
                    <div style={{ color: '#A8B4C0', fontSize: '0.85rem' }}>Calculated Synergy Score</div>
                  </div>
                </div>
                
                {synergyData.tips.length > 0 && !isSynergyExpanded && (
                  <div style={{ color: '#68D391', fontSize: '0.85rem', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 2 }} /> 
                    <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{synergyData.tips[0]}</span>
                  </div>
                )}
                
                <AnimatePresence>
                  {isSynergyExpanded && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }} 
                      animate={{ opacity: 1, height: 'auto' }} 
                      exit={{ opacity: 0, height: 0 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ marginBottom: 16 }}>
                          <h5 style={{ color: '#00E5FF', fontSize: '0.85rem', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Score Breakdown</h5>
                          {synergyData.breakdown?.map((b: any, i: number) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '2px solid #5A6B7D' }}>
                              <span style={{ color: '#E2E8F0', fontSize: '0.85rem' }}>{b.label}</span>
                              <span style={{ color: b.value > 0 ? '#68D391' : b.value < 0 ? '#FF6B6B' : '#A8B4C0', fontWeight: 700, fontSize: '0.9rem' }}>
                                {b.value > 0 ? '+' : ''}{b.value}
                              </span>
                            </div>
                          ))}
                        </div>
                        {synergyData.warnings.length > 0 && (
                          <div style={{ marginBottom: 16 }}>
                            <h5 style={{ color: '#FF6B6B', fontSize: '0.85rem', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Warnings</h5>
                            {synergyData.warnings.map((w: string, i: number) => <div key={i} style={{ color: '#FFB86C', fontSize: '0.85rem', marginBottom: 8, display: 'flex', gap: 8, alignItems: 'flex-start' }}><AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} /> <span>{w}</span></div>)}
                          </div>
                        )}
                        <div>
                          <h5 style={{ color: '#68D391', fontSize: '0.85rem', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Synergy Analysis</h5>
                          {synergyData.tips.length > 0 ? (
                            synergyData.tips.map((t: string, i: number) => <div key={i} style={{ color: '#A8B4C0', fontSize: '0.85rem', marginBottom: 8, display: 'flex', gap: 8, alignItems: 'flex-start' }}><CheckCircle2 size={16} color="#68D391" style={{ flexShrink: 0, marginTop: 2 }} /> <span>{t}</span></div>)
                          ) : (
                            <div style={{ color: '#A8B4C0', fontSize: '0.85rem' }}>No specific synergy documented for this combination.</div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
        </div>

        <div style={{ padding: '20px 32px', background: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#A8B4C0', fontWeight: 700, textTransform: 'uppercase' }}>
              {!isBundleProduct && stack.stack_components.length > 1 ? 'Bundle Price (-10%)' : 'Price'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {!isBundleProduct && stack.stack_components.length > 1 && (
                <span style={{ fontSize: '1rem', color: '#64748b', textDecoration: 'line-through' }}>${bundlePrice.toFixed(2)}</span>
              )}
              <span style={{ fontSize: '1.4rem', color: '#00E5FF', fontWeight: 800 }}>
                ${(!isBundleProduct && stack.stack_components.length > 1 ? bundlePrice * 0.9 : bundlePrice).toFixed(2)}
              </span>
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
