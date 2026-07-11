        {filteredProducts.slice(0, visibleCount).map((group) => {
          const selectedVariantId = selectedVariants[group.name] || group.defaultVariantId;
          const activeVariant = group.variants.find(v => v.id === selectedVariantId) || group.variants[0];

          const stockAgentCount = Math.max(0, Number(inventoryMap[activeVariant.product_id] ?? 0));
          const stockMasterInventory = Math.max(0, Number(activeVariant.products?.inventory_count ?? 0));
          const stockThreshold = Math.max(0, Number(activeVariant.products?.low_stock_threshold ?? 5));
          const stockBackorder = Math.max(0, Number(activeVariant.products?.backorder_days ?? 0));
          const stockState = computeStockState(stockAgentCount, stockMasterInventory, stockThreshold, stockBackorder);

          return (
            <motion.div
              key={group.name} className="sf-product-card-nickel hover-lift stagger-fade-in" variants={itemVariants}
              style={{
                cursor: 'pointer'
              }}
              onMouseEnter={() => {
                // Prefetch recommendations for this product on hover so data
                // is already cached by the time the user clicks to open the detail.
                const seedId = activeVariant.product_id;
                if (seedId) {
                  // Prefetch via standard fetch so it triggers the Service Worker cache
                  fetch(
                    `/api/storefront/recommendations?product_id=${encodeURIComponent(seedId)}&agent_slug=${encodeURIComponent(agentSlug)}&limit=8`
                  ).catch(() => {});
                }
              }}
              onClick={() => {
                setDetailProduct(group);
                logRecentlyViewed(activeVariant.product_id);
                const defaultVId = group.defaultVariantId || group.variants[0]?.id;
                const existingQty = defaultVId ? cartItems[defaultVId] : undefined;
                const bw = isBacWaterItem(group.name, group.compoundSlug);
                setPendingQty(existingQty ?? (bw ? 10 : (selfBuyMin)));
              }}
              role="button"
              tabIndex={0}
              aria-label={`View Details For ${group.name}`}
              onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  if (e.key === ' ') e.preventDefault();
                  e.currentTarget.click();
                }
              }}
            >
              <div className="" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: 0, position: 'relative' }}>

              <div style={{
                height: 220,
                background: `radial-gradient(circle at 50% 50%, ${primaryColor}20 0%, var(--black) 100%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                borderBottom: '1px solid rgba(255,255,255,0.02)', position: 'relative'
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${primaryColor}50, transparent)` }} />
                {group._search?.reason && (
                  <div style={{
                    position: 'absolute',
                    top: 52,
                    left: 10,
                    right: 10,
                    zIndex: 10,
                    display: 'flex',
                    justifyContent: 'center',
                    pointerEvents: 'none'
                  }}>
                    <div style={{
                      background: 'rgba(20, 25, 30, 0.75)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      padding: '4px 10px',
                      borderRadius: 20,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--white)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    }}>
                      <Sparkles size={11} style={{ marginRight: 4 }} /> Matched: {toTitleCase(group._search.reason)}
                    </div>
                  </div>
                )}

                {/* Compare Checkbox opposite of the heart (which is on top-right, so this is on top-left) */}
                <label
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: 12,
                    left: 12,
                    zIndex: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                    transition: 'transform 0.15s ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.10)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <input
                    type="checkbox"
                    checked={pinnedNames.has(group.name)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        if (pinnedNames.size >= 4) {
                          toast.error('You can compare up to 4 compounds at a time.');
                          return;
                        }
                        try {
                          const raw = window.localStorage.getItem('pnl:compare') || '[]';
                          const list = JSON.parse(raw);
                          if (Array.isArray(list) && list.length > 0) {
                            const firstItem = list[0];
                            const firstCategory = firstItem.category;
                            if (firstCategory && firstCategory !== group.category) {
                              toast.error(`You can only compare peptides within the same category ("${firstCategory}").`);
                              return;
                            }
                          }
                        } catch {}
                        pin(group, activeVariant);
                      } else {
                        unpin(group);
                      }
                    }}
                    disabled={!pinnedNames.has(group.name) && pinnedNames.size >= 4}
                    style={{
                      width: 17,
                      height: 17,
                      accentColor: primaryColor,
                      cursor: 'pointer',
                      margin: 0,
                    }}
                    title="Compare this peptide"
                    aria-label={`Compare ${group.name}`}
                  />
                  <span
                    style={{
                      fontSize: '0.55rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: pinnedNames.has(group.name) ? primaryColor : 'rgba(255,255,255,0.85)',
                      textShadow: '0 1px 3px rgba(0, 0, 0, 0.9), 0 0 1px rgba(0, 0, 0, 0.9)',
                      transition: 'color 0.15s',
                      pointerEvents: 'none',
                      marginTop: 4
                    }}
                  >
                    Compare
                  </span>
                </label>

                {(() => {
                  const wished = wishlist.has(activeVariant.product_id);
                  return (
                    <button
                      type="button"
                      aria-label={wished ? 'Remove From Wishlist' : 'Add To Wishlist'}
                      onClick={e => { e.stopPropagation(); void toggleWishlist(activeVariant.product_id); }}
                      className="sf-wishlist-btn"
                      style={{
                        background: wished ? 'rgba(229,62,62,0.20)' : 'rgba(0,0,0,0.55)',
                        border: `1px solid ${wished ? 'rgba(229,62,62,0.50)' : 'rgba(255,255,255,0.20)'}`,
                      }}
                    >
                      <Heart
                        size={17}
                        stroke={wished ? '#FF5A6E' : 'rgba(220,220,220,0.9)'}
                        fill={wished ? '#FF5A6E' : 'none'}
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                    </button>
                  );
                })()}

                {/* eslint-disable-next-line @next/next/no-img-element */}
                <Image
                  src={group.imageUrl || '/images/peptide_clear.png'}
                  alt={group.name}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  style={{ objectFit: 'contain', objectPosition: 'center', padding: '8px', transition: 'transform 0.4s ease' }}
                  className="store-image-hover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    const fallback = getProductImage(null, group.category || 'Other', group.name);
                    if (target.src !== fallback && !target.src.includes(fallback)) {
                      target.srcset = '';
                      target.src = fallback;
                    } else {
                      target.srcset = '';
                      target.src = '/images/peptide_clear.png';
                      target.style.opacity = '0.9';
                    }
                  }}
                />

                {stockState.kind !== 'in_stock' && (
                  <div style={{ position: 'absolute', bottom: 12, left: 12 }}>
                    <StockBadge state={stockState} />
                  </div>
                )}
              </div>

              <div style={{ padding: 'var(--space-5)', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                {(() => {
                  const { main, subtitle } = splitProductName(toTitleCase(group.name));
                  const searchReason = (group as any)._search?.reason;
                  const confidence = (group as any)._search?.confidence as 'high' | 'medium' | 'low' | undefined;
                  // ── #6 Confidence tier colour map ─────────────────────────
                  const confidenceStyle: Record<'high' | 'medium' | 'low', { bg: string; border: string; color: string; label: string }> = {
                    high:   { bg: 'rgba(79,209,197,0.12)',  border: 'rgba(79,209,197,0.35)',  color: '#4FD1C5', label: 'Strong Match' },
                    medium: { bg: 'rgba(235,178,54,0.10)',  border: 'rgba(235,178,54,0.30)',  color: '#EBB236', label: 'Good Match'   },
                    low:    { bg: 'rgba(160,174,192,0.08)', border: 'rgba(160,174,192,0.22)', color: '#A0AEC0', label: 'Partial Match' },
                  };
                  const cs = confidence ? confidenceStyle[confidence] : null;
                  return (
                    <div style={{ textAlign: 'center', marginBottom: 'var(--space-2)' }}>
                      {searchReason && cs && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          background: cs.bg, border: `1px solid ${cs.border}`,
                          color: cs.color, fontSize: '0.63rem', fontWeight: 700,
                          padding: '3px 8px', borderRadius: 'var(--radius-full)',
                          textTransform: 'uppercase', marginBottom: 'var(--space-2)',
                          letterSpacing: '0.04em', maxWidth: '100%',
                        }}>
                          <Sparkles size={9} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                            {cs.label}: {searchReason}
                          </span>
                        </div>
                      )}
                      <h4 style={{
                        fontFamily: 'var(--font-brand)',
                        fontSize: '1.15rem', color: 'var(--white)', letterSpacing: '0.02em', lineHeight: 1.2,
                        marginBottom: subtitle ? 2 : 0
                      }}>
                        {highlightText(main, deferredSearch)}
                      </h4>
                      {subtitle && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--grey-400)', fontWeight: 500 }}>
                          {highlightText(subtitle, deferredSearch)}
                        </span>
                      )}
                      {(() => {
                        const _canonicalName = group.variants[0]?.products?.name || group.name;
                        const _nick = getPopularName(_canonicalName);
                        if (!_nick) return null;
                        return (
                          <span style={{ fontSize: '0.72rem', color: 'var(--teal)', fontStyle: 'italic', fontWeight: 500, display: 'block', marginTop: 2 }}>
                            {_nick}
                          </span>
                        );
                      })()}
                      {(() => {
  const _c = group.compoundSlug ? compoundsBySlug?.[group.compoundSlug] : undefined;
  const _nasal = intranasalDisplay(_c);
  if (!_nasal.nasal) return null;
  return (
    <span title={_nasal.caveat ?? undefined} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6,
      padding: '3px 9px', borderRadius: 'var(--radius-full)',
      background: _nasal.bg, border: `1px solid ${_nasal.border}`,
      color: _nasal.color, fontSize: '0.62rem', fontWeight: 800,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      <Wind size={9} aria-hidden="true" />{_nasal.badgeLabel}
    </span>
  );
})()}

                    </div>
                  );
                })()}

              <div style={{
                  marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 'var(--space-4)',
                  textAlign: 'center'
                }}>
                  {(() => {
                    const defaultV = group.variants.find(v => v.id === group.defaultVariantId) || group.variants[0];
                    const size = defaultV.products?.unit_size || '10';
                    const measure = defaultV.products?.unit_measure || 'mg';
                    const perVialBase = defaultV.retail_price / 10;
                    const isOnSale = (defaultV as any).is_on_sale && (defaultV as any).sale_price;
                    const perVialDisplay = isOnSale ? (defaultV as any).sale_price / 10 : perVialBase;
                    const perVialOriginal = perVialBase;
                    
                    const isBW = isBacWaterItem(group.name, defaultV.products?.compound_slug);
                    const displayPrice = isBW ? perVialDisplay * 10 : perVialDisplay;
                      const _marketAvgVial = Number((defaultV as any).products?.market_avg_price) || 0;
                      const _marketAvgDisplay = isBW ? _marketAvgVial * 10 : _marketAvgVial;
                      const _showMarketAvg = agentSlug === 'researchstore' && _marketAvgDisplay > displayPrice;
                    const displayOriginalPrice = isBW ? perVialOriginal * 10 : perVialOriginal;
                    const displaySizeText = isBW ? `10x ${size}${measure} Vials` : `${size}${measure} Vials`;

                    return (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                          {isOnSale && (
                            <span style={{ fontSize: '0.95rem', color: 'var(--grey-500)', textDecoration: 'line-through', fontWeight: 600 }}>
                              ${displayOriginalPrice.toFixed(2)}
                            </span>
                          )}
                          {_showMarketAvg && (
                            <span style={{ fontSize: '0.95rem', color: 'var(--grey-500)', textDecoration: 'line-through', fontWeight: 600 }}>
                              ${_marketAvgDisplay.toFixed(2)}
                            </span>
                          )}
                          <span className="sf-product-price-nickel" style={{
                            fontSize: '1.2rem', fontWeight: 800,
                            fontFamily: 'var(--font-brand)',
                          }}>
                            {displaySizeText} &nbsp;${displayPrice.toFixed(2)}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
              </div>
            </motion.div>
          );
        })}
