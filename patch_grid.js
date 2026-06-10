const fs = require('fs');

const p = '/Users/smarter.poker/Documents/pepnationlab/components/research/AreaProductGrid.tsx';
let content = fs.readFileSync(p, 'utf8');

// 1. imports
content = content.replace(
  "import Image from 'next/image';",
  "import Image from 'next/image';\nimport QuickViewModal from './QuickViewModal';"
);

// 2. state
content = content.replace(
  "const [modalUrl, setModalUrl] = useState<string | null>(null);",
  "const [modalUrl, setModalUrl] = useState<string | null>(null);\n  const [quickViewCompound, setQuickViewCompound] = useState<any | null>(null);"
);

// 3. CSS block
content = content.replace(
  "<div style={{ position: 'relative' }}>",
  `<div style={{ position: 'relative' }}>
      <style dangerouslySetInnerHTML={{__html: \`
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
      \`}} />`
);

// 4. Modal
content = content.replace(
  "{/* Comparison Drawer is rendered at the layout level via StorefrontCompareDrawer */}",
  `{/* Comparison Drawer is rendered at the layout level via StorefrontCompareDrawer */}

      <QuickViewModal
        isOpen={!!quickViewCompound}
        compound={quickViewCompound}
        onClose={() => setQuickViewCompound(null)}
      />`
);

// 5. Replace the render item block
const startStr = `          return (
            <div
              key={p.productId}
              style={{`;

const endStr = `                )}
              </div>
            </div>
          );`;

const replacement = `          return (
            <motion.article
              key={p.productId}
              className="glass-panel stack-card"
              whileHover={{ y: -6, scale: 1.02, boxShadow: '0 20px 40px rgba(0,0,0,0.6), inset 0 2px 10px rgba(255,255,255,0.4)' }}
              style={{
                minWidth: isSwipeMode ? '85vw' : 'auto',
                scrollSnapAlign: isSwipeMode ? 'center' : 'none',
                padding: 4,
                overflow: 'hidden',
                position: 'relative',
                cursor: 'pointer',
                background: isComparing ? '#00E5FF' : 'linear-gradient(135deg, #e0e5ec 0%, #88929c 25%, #e0e5ec 50%, #a3b1c6 75%, #f0f4f8 100%)',
                borderRadius: 24,
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                border: 'none',
                contentVisibility: 'auto',
                containIntrinsicSize: '500px'
              }}
              onClick={() => {
                if (compound) {
                  setQuickViewCompound({
                    ...compound,
                    display_name: compound.displayName,
                    evidence_tier: compound.evidenceTier,
                    plain_summary: compound.plainSummary,
                    eli5_summary: compound.eli5Summary,
                    typical_frequency: compound.typicalFrequency,
                    handling: { form: 'Vial' },
                  });
                }
              }}
            >
              <div style={{ background: 'linear-gradient(145deg, #1A1F26 0%, #0F1318 100%)', borderRadius: 20, height: '100%', position: 'relative', overflow: 'hidden', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column' }}>
                
                {/* Out Of Stock Badge */}
                {outOfStock && (
                  <div style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255, 60, 60, 0.9)', color: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 800, zIndex: 10, backdropFilter: 'blur(10px)', boxShadow: '0 4px 12px rgba(255, 60, 60, 0.4)' }}>
                    OUT OF STOCK
                  </div>
                )}

                {/* Compare Checkbox */}
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isComparing) unpin(p);
                    else {
                      if (pinnedNames.size >= 4) {
                        showToast('You can compare up to 4 compounds at a time.');
                        return;
                      }
                      try {
                        const raw = window.localStorage.getItem('pnl:compare') || '[]';
                        const list = JSON.parse(raw);
                        if (Array.isArray(list) && list.length > 0) {
                          const firstItem = list[0];
                          const firstCategory = firstItem.category;
                          if (firstCategory && firstCategory !== p.category) {
                            showToast(\`You can only compare peptides within the same category ("\${firstCategory}").\`);
                            return;
                          }
                        }
                      } catch {}
                      pin(p);
                    }
                  }}
                  style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, width: 24, height: 24, borderRadius: 6, border: isComparing ? 'none' : '1px solid rgba(255,255,255,0.2)', background: isComparing ? '#00E5FF' : 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  {isComparing && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                </div>

                {/* Title Block */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20, paddingLeft: 36 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{ margin: 0, color: '#E2E8F0', fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.01em', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {toTitleCase(p.productName)}
                    </h2>
                    {compound?.aliases?.length ? (
                      <div style={{ fontSize: '0.75rem', color: '#A8B4C0', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {compound.aliases.slice(0, 3).join(' · ')}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#E2E8F0', whiteSpace: 'nowrap' }}>
                      {p.agentProductId ? formatPrice(displayPrice) : '-'}
                    </div>
                    {p.agentProductId && p.isOnSale && p.salePrice != null && (
                      <div style={{ fontSize: '0.8rem', color: '#718096', textDecoration: 'line-through', marginTop: 2 }}>
                        {formatPrice(p.retailPrice)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Image Cluster (Single Image) */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20, width: '100%' }}>
                  <div style={{ 
                    flex: '1 1 0', minWidth: 60, maxWidth: 140,
                    position: 'relative',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
                  }}>
                    <div style={{
                      width: '100%', aspectRatio: '1 / 1.2',
                      borderRadius: 16, 
                      background: '#0F1318',
                      border: '2px solid rgba(255,255,255,0.2)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden', padding: 0,
                      position: 'relative'
                    }}>
                      <Image src={p.imageUrl} alt={p.productName} width={200} height={200} unoptimized style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        padding: '32px 4px 4px',
                        background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.8) 50%, #000 100%)',
                        color: '#C0C8D0', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase',
                        textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>
                        {toTitleCase(p.productName)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description (ELI5) */}
                {(compound?.eli5Summary || compound?.plainSummary) && (
                  <p style={{ margin: 'var(--space-3) 0 0', color: '#D0DAE4', lineHeight: 1.55, fontSize: '0.9rem', flex: 1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {compound.eli5Summary || compound.plainSummary}
                  </p>
                )}

                {/* Cross-Over Discovery Tags */}
                {compound?.researchAreas && compound.researchAreas.length > 0 && (
                  <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                    {compound.researchAreas.map(ra => (
                      <span key={ra} style={{
                        padding: '3px 8px',
                        borderRadius: 12,
                        background: 'rgba(255,255,255,0.05)',
                        color: '#A8B4C0',
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        textTransform: 'capitalize',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <Dna size={10} /> {ra.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}

                {/* Add To Cart Button Centered */}
                <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
                  {outOfStock ? (
                    <button
                      disabled
                      style={{
                        height: 60,
                        width: '100%',
                        background: 'rgba(255,255,255,0.06)',
                        color: '#718096',
                        border: 'none',
                        borderRadius: 10,
                        fontWeight: 800,
                        fontSize: '0.88rem',
                        cursor: 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      Out Of Stock
                    </button>
                  ) : !p.agentProductId ? (
                    <button
                      disabled
                      style={{
                        height: 60,
                        width: '100%',
                        background: 'rgba(255,255,255,0.06)',
                        color: '#718096',
                        border: 'none',
                        borderRadius: 10,
                        fontWeight: 800,
                        fontSize: '0.88rem',
                        cursor: 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      Not Carried
                    </button>
                  ) : (
                    <div onClick={e => e.stopPropagation()} style={{ width: '100%' }}>
                      <DynamicAddToCartButton
                        onClick={() => addToCart(p)}
                        pendingQty={inCart}
                        style={{ height: 60, width: '100%' }}
                      />
                    </div>
                  )}
                </div>

              </div>
            </motion.article>
          );`;

const s = content.indexOf(startStr);
const e = content.indexOf(endStr, s);

if (s === -1) {
  console.error('startStr not found');
} else if (e === -1) {
  console.error('endStr not found');
} else {
  content = content.substring(0, s) + replacement + content.substring(e + endStr.length);
  fs.writeFileSync(p, content);
  console.log('Successfully patched AreaProductGrid.tsx');
}
