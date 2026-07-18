'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, X, Sparkles, Check, AlertTriangle } from 'lucide-react';
import DynamicAddToCartButton from './DynamicAddToCartButton';
import { ProtocolScheduler } from '../research/ProtocolScheduler';
import { getTierPercent, getRiskPercent, getRiskColor, type MatchedProduct, type ExcludedCompound } from './discovery-shared';
import { useModalA11y } from '@/lib/useModalA11y';

export function MatchResultsDrawer({
  open,
  loading,
  results,
  excluded,
  goalSummary,
  followUp,
  submitFollowUp,
  matchError,
  relaxed = false,
  onRetry,
  onClose,
  onAddToCart,
  onOpenProduct,
  primaryColor,
}: {
  open: boolean;
  loading: boolean;
  results: MatchedProduct[];
  excluded: ExcludedCompound[];
  goalSummary: string;
  followUp: { question: string; originalGoal: string } | null;
  submitFollowUp: (answer: string) => void;
  matchError: boolean;
  relaxed?: boolean;
  onRetry: () => void;
  onClose: () => void;
  onAddToCart: (productId: string) => void;
  onOpenProduct: (productId: string) => void;
  primaryColor: string;
}) {
  const [filterOralOnly, setFilterOralOnly] = useState(false);
  const [filterHumanOnly, setFilterHumanOnly] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [followUpInput, setFollowUpInput] = useState('');
  const [shareCopied, setShareCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      const res = await fetch('/api/research/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: window.location.pathname.split('/')[1] || 'pepnation',
          results,
          goalSummary
        })
      });
      if (!res.ok) throw new Error('Share request failed');
      const data = await res.json();
      if (data.url) {
        await navigator.clipboard.writeText(window.location.origin + data.url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      } else {
        throw new Error('No share URL returned');
      }
    } catch (e) {
      console.error('Failed to share', e);
      // Show user-visible feedback via the button label
      setShareCopied(false);
      // Brief flash of error label reusing the button state
      const el = document.getElementById('pnl-share-btn');
      if (el) { el.textContent = 'Error — Try Again'; setTimeout(() => { if (el) el.textContent = 'Share Results'; }, 2000); }
    } finally {
      setIsSharing(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setFilterOralOnly(false);
        setFilterHumanOnly(false);
        setCompareIds([]);
        setCompareOpen(false);
      }, 0);
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // A11y: initial focus, Tab trap, Escape-to-close, focus restore
  const dialogRef = useModalA11y<HTMLDivElement>(open, { onClose });

  const filteredResults = useMemo(() => {
    return results.filter(r => {
      if (filterOralOnly && !r.display_name.toLowerCase().includes('capsule') && !r.display_name.toLowerCase().includes('oral') && !r.display_name.toLowerCase().includes('sublingual') && !r.display_name.toLowerCase().includes('spray')) {
        return false;
      }
      if (filterHumanOnly && r.evidence_tier !== 'approved_drug' && r.evidence_tier !== 'investigational') {
        return false;
      }
      return true;
    });
  }, [results, filterOralOnly, filterHumanOnly]);

  // A card is purchasable only when the caller resolved it to a real, in-stock
  // product. Everything else -- out-of-stock, or a page that sells nothing (the
  // global Find A Peptide page) -- still renders as a full recommendation card so
  // the engine's answer is NEVER hidden. This is the display half of the fix that
  // stops the guided wizard from "walking you through but never recommending".
  const inCatalog = filteredResults.filter(r => r.product_id && r.in_stock);
  const recommendations = filteredResults.filter(r => !(r.product_id && r.in_stock));
  const stackItems = inCatalog.filter(r => r.isStackPartner);

  const handleAddStack = () => {
    stackItems.forEach(item => onAddToCart(item.product_id));
  };

  const toggleCompare = (id: string) => {
    setCompareIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
          ref={dialogRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Match Results"
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 800,
            background: 'rgba(10, 15, 20, 0.75)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            paddingTop: 'env(safe-area-inset-top, 0px)',
          }}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 760,
              background: 'rgba(15, 20, 25, 0.85)',
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              borderTop: '6px solid #E2E8F0',
              borderLeft: '6px solid #E2E8F0',
              borderRight: '6px solid #E2E8F0',
              boxSizing: 'border-box',
              boxShadow: `0 0 40px ${primaryColor}22`,
              maxHeight: 'calc(100dvh - 56px)',
              display: 'flex', flexDirection: 'column',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '16px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                background: `linear-gradient(135deg, ${primaryColor}22 0%, transparent 60%)`,
                borderTopLeftRadius: 24, borderTopRightRadius: 24,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Top Matches For
                </div>
                <div style={{ color: '#FFFFFF', fontSize: '0.98rem', fontWeight: 800, lineHeight: 1.25, marginTop: 2,
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {goalSummary}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.16)',
                  color: '#FFFFFF',
                  borderRadius: 10, padding: 8, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: 44, minHeight: 44,
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Live Filtering & Compare Bar */}
            {!loading && results.length > 0 && (
              <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 8, alignItems: 'center', overflowX: 'auto', flexWrap: 'nowrap' }}>
                <button
                  type="button"
                  onClick={() => setFilterOralOnly(!filterOralOnly)}
                  style={{
                    background: filterOralOnly ? 'rgba(192,197,206,0.2)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${filterOralOnly ? '#C0C5CE' : 'rgba(255,255,255,0.1)'}`,
                    color: filterOralOnly ? '#C0C5CE' : '#A8B4C0',
                    padding: '6px 14px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                    whiteSpace: 'nowrap', transition: 'all 0.2s ease',
                  }}
                >
                  {filterOralOnly ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Check size={12} /> Oral Only
                    </span>
                  ) : 'Oral Only'}
                </button>
                <button
                  type="button"
                  onClick={() => setFilterHumanOnly(!filterHumanOnly)}
                  style={{
                    background: filterHumanOnly ? 'rgba(192,197,206,0.2)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${filterHumanOnly ? '#C0C5CE' : 'rgba(255,255,255,0.1)'}`,
                    color: filterHumanOnly ? '#C0C5CE' : '#A8B4C0',
                    padding: '6px 14px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                    whiteSpace: 'nowrap', transition: 'all 0.2s ease',
                  }}
                >
                  {filterHumanOnly ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Check size={12} /> Human Data Only
                    </span>
                  ) : 'Human Data Only'}
                </button>
                <div style={{ flex: 1 }} />
                {compareIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCompareOpen(true)}
                    style={{
                      background: '#C0C5CE', color: '#0A1018',
                      border: 'none', padding: '6px 14px', borderRadius: 20,
                      fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer',
                      whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(192,197,206,0.3)',
                    }}
                  >
                    Compare ({compareIds.length})
                  </button>
                )}
              </div>
            )}

            <div style={{ overflowY: 'auto', padding: '14px 20px 18px', flex: 1 }}>
              {/* Screen-reader announcement of the result count once matching resolves */}
              <span
                role="status"
                aria-live="polite"
                style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 }}
              >
                {!loading && !matchError && !followUp ? `${filteredResults.length} Matches Found` : ''}
              </span>
              {loading ? (
                <div role="status" aria-live="polite" style={{ padding: '64px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
                  <div style={{
                    width: 60, height: 60, borderRadius: '50%',
                    border: '3px solid rgba(192, 197, 206, 0.2)',
                    borderTopColor: '#C0C5CE',
                    animation: 'spin 1s linear infinite',
                  }} />
                  <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                  <div style={{ color: '#FFFFFF', fontSize: '1.2rem', fontWeight: 800, letterSpacing: '0.02em' }}>
                    Scanning The Research Library...
                  </div>
                  <div style={{ color: '#A8B4C0', fontSize: '0.9rem', maxWidth: 320, lineHeight: 1.5 }}>
                    Our AI Match Engine Is Analyzing Your Research Goal Against All Available Compounds And Data.
                  </div>
                </div>
              ) : matchError ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', textAlign: 'center' }}>
                  <AlertTriangle size={48} color="#E53E3E" style={{ marginBottom: 16, opacity: 0.85 }} />
                  <h3 style={{ color: '#FFF', fontSize: '1.2rem', fontWeight: 800, marginBottom: 8 }}>Something Went Wrong</h3>
                  <p style={{ color: '#A8B4C0', marginBottom: 24, lineHeight: 1.5, maxWidth: 340 }}>
                    We Couldn&apos;t Reach The Match Engine. This Is Usually Temporary — Please Try Again.
                  </p>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button type="button" onClick={onRetry} style={{ padding: '10px 20px', background: primaryColor, color: '#0A1018', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 800 }}>Try Again</button>
                    <button type="button" onClick={onClose} style={{ padding: '10px 16px', background: 'transparent', color: primaryColor, border: `1px solid ${primaryColor}`, borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Close</button>
                  </div>
                </div>
              ) : followUp ? (
                <div style={{ padding: '32px 16px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ marginBottom: 24, padding: 20, background: 'rgba(192,197,206,0.1)', borderRadius: 16, border: '1px solid rgba(192,197,206,0.2)' }}>
                    <p style={{ color: '#C0C5CE', fontSize: '1.1rem', fontWeight: 600, lineHeight: 1.5 }}>
                      {followUp.question}
                    </p>
                  </div>
                    <div style={{ marginTop: 24, padding: 20, background: 'rgba(192,197,206,0.1)', borderRadius: 16, border: '1px solid rgba(192,197,206,0.2)' }}>
                      <p style={{ color: '#C0C5CE', fontSize: '1.1rem', fontWeight: 600, lineHeight: 1.5, textAlign: 'center' }}>
                        The AI Needs More Context To Refine These Results. Please Restart The Match Process And Provide More Detail.
                      </p>
                      <button
                        type="button"
                        onClick={onClose}
                        style={{
                          display: 'block', margin: '24px auto 0',
                          background: primaryColor, color: '#0A1018', border: 'none',
                          padding: '12px 24px', borderRadius: 12, fontWeight: 800, fontSize: '1rem',
                          cursor: 'pointer'
                        }}
                      >
                        Start Over
                      </button>
                    </div>
                </div>
              ) : filteredResults.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', textAlign: 'center' }}>
                  <Sparkles size={48} color={primaryColor} style={{ marginBottom: 16, opacity: 0.5 }} />
                  <h3 style={{ color: '#FFF', fontSize: '1.2rem', fontWeight: 800, marginBottom: 8 }}>0 Matches Found</h3>
                  <p style={{ color: '#A8B4C0', marginBottom: 24, lineHeight: 1.5 }}>
                    We Couldn&apos;t Find A Protocol Matching All Of Your Strict Constraints (E.G. Oral-Only, Low-Risk).
                  </p>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {filterOralOnly && <button type="button" onClick={() => setFilterOralOnly(false)} style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.1)', color: '#FFF', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Drop Oral-Only</button>}
                    {filterHumanOnly && <button type="button" onClick={() => setFilterHumanOnly(false)} style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.1)', color: '#FFF', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Drop Human-Only</button>}
                    <button type="button" onClick={onClose} style={{ padding: '10px 16px', background: 'transparent', color: primaryColor, border: `1px solid ${primaryColor}`, borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Start Over</button>
                  </div>
                </div>
              ) : null}

              {/* Filters-broadened notice. The engine relaxed the requested
                  evidence/risk/format constraints because nothing matched them, so
                  we say so plainly rather than silently changing what the user asked
                  for. */}
              {!loading && !matchError && !followUp && relaxed && filteredResults.length > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  margin: '0 0 14px', padding: '10px 12px', borderRadius: 10,
                  background: 'rgba(246,173,85,0.08)', border: '1px solid rgba(246,173,85,0.3)',
                }}>
                  <Sparkles size={14} color="#F6AD55" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
                  <span style={{ color: '#E2E8F0', fontSize: '0.8rem', lineHeight: 1.4 }}>
                    No Compounds Met Every Filter You Chose, So We Broadened The Evidence And Risk Settings To Show The Closest Matches For Your Goal. Check Each Compound&apos;s Evidence And Safety Bars Below.
                  </span>
                </div>
              )}

              {/* Stack "Add Protocol to Cart" logic */}
              {!loading && stackItems.length > 1 && !filterOralOnly && !filterHumanOnly && (
                <div style={{ background: 'rgba(246,173,85,0.08)', border: '1px solid rgba(246,173,85,0.3)', borderRadius: 16, padding: '14px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ color: '#F6AD55', fontWeight: 800, fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Sparkles size={14} /> Recommended Protocol Stack</div>
                    <button
                      type="button"
                      onClick={handleAddStack}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', filter: 'drop-shadow(0 4px 15px rgba(246,173,85,0.3))' }}
                    >
                      <Image src="/images/add_stack_to_cart_btn.png" alt="Add Stack to Cart" width={200} height={200} unoptimized style={{ height: 42, objectFit: 'contain' }} />
                    </button>
                  </div>
                  <div style={{ color: '#E2E8F0', fontSize: '0.8rem', lineHeight: 1.4 }}>
                    This synergy stack includes <span style={{ fontWeight: 700 }}>{stackItems.map(s => s.display_name).join(' + ')}</span>. Research indicates superior outcomes when studying these compounds in combination.
                  </div>
                </div>
              )}

              {!loading && inCatalog.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {inCatalog.map((r) => (
                    <div
                      key={r.product_id}
                      style={{
                        display: 'flex', gap: 12, alignItems: 'stretch',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.10)',
                        borderRadius: 14, padding: 12, position: 'relative'
                      }}
                    >
                      {/* Compare Checkbox */}
                      <label style={{
                        position: 'absolute', top: 12, left: 12, zIndex: 10,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 24, height: 24, background: 'rgba(0,0,0,0.4)',
                        border: `2px solid ${compareIds.includes(r.product_id) ? '#C0C5CE' : 'rgba(255,255,255,0.3)'}`,
                        borderRadius: 6, cursor: 'pointer',
                      }}>
                        <input
                          type="checkbox"
                          checked={compareIds.includes(r.product_id)}
                          onChange={() => toggleCompare(r.product_id)}
                          style={{ opacity: 0, position: 'absolute' }}
                        />
                        {compareIds.includes(r.product_id) && <div style={{ width: 12, height: 12, background: '#C0C5CE', borderRadius: 2 }} />}
                      </label>

                      {r.image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <Image
                          src={r.image_url}
                          alt={r.display_name}
                          onClick={() => onOpenProduct(r.product_id)}
                          style={{ width: 72, height: 72, borderRadius: 10, objectFit: 'cover', cursor: 'pointer', flexShrink: 0 }}
                          width={200} height={200} unoptimized
                        />
                      ) : (
                        <div style={{ width: 72, height: 72, borderRadius: 10, background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} />
                      )}

                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <div
                            onClick={() => onOpenProduct(r.product_id)}
                            style={{
                              color: '#FFFFFF', fontWeight: 800, fontSize: '0.96rem', lineHeight: 1.25,
                              flex: 1, minWidth: 0, cursor: 'pointer',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}
                          >
                            {r.display_name}
                          </div>

                          {r.isStackPartner && (
                            <span style={{
                              fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
                              padding: '3px 7px', borderRadius: 6,
                              background: 'rgba(246,173,85,0.14)', color: '#F6AD55',
                              border: '1px solid rgba(246,173,85,0.35)', flexShrink: 0,
                              display: 'inline-flex', alignItems: 'center', gap: '4px'
                            }} title="Synergizes well with other matched compounds">
                              <Sparkles size={10} /> Synergistic Stack Partner
                            </span>
                          )}
                        </div>

                        <div style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.82rem', lineHeight: 1.4 }}>
                          <span style={{ color: 'var(--grey-400, #C8D2DD)', fontWeight: 700 }}>Why This Match: </span>
                          {r.rationale}
                        </div>

                        {/* Visualizations */}
                        <div style={{ display: 'flex', gap: 16, marginTop: 6, marginBottom: 6 }}>
                          {/* Efficacy */}
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--silver)', textTransform: 'uppercase' }}>Target Efficacy</div>
                            <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ width: `${r.score || 0}%`, height: '100%', background: 'linear-gradient(90deg, #3182ce, #63b3ed)', borderRadius: 4 }} />
                            </div>
                          </div>
                          {/* Evidence */}
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--silver)', textTransform: 'uppercase' }}>Human Data</div>
                            <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ width: `${getTierPercent(r.evidence_tier)}%`, height: '100%', background: 'linear-gradient(90deg, #805ad5, #b794f4)', borderRadius: 4 }} />
                            </div>
                          </div>
                          {/* Safety */}
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--silver)', textTransform: 'uppercase' }}>Safety Profile</div>
                            <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ width: `${getRiskPercent(r.riskLevel)}%`, height: '100%', background: getRiskColor(r.riskLevel), borderRadius: 4 }} />
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                          <div style={{ color: '#C0C5CE', fontWeight: 900, fontSize: '1rem' }}>
                            ${(r.price_cents / 100).toFixed(2)}
                          </div>
                          <div style={{ flex: 1 }} />
                          <button
                            type="button"
                            onClick={() => onOpenProduct(r.product_id)}
                            style={{
                              background: 'transparent',
                              border: '1px solid rgba(255,255,255,0.16)',
                              color: '#FFFFFF', fontWeight: 700, fontSize: '0.82rem',
                              padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
                              minHeight: 40,
                            }}
                          >
                            View Details
                          </button>
                          <DynamicAddToCartButton
                            onClick={() => onAddToCart(r.product_id)}
                            isSmall={true}
                            style={{ minHeight: 40, height: 40, width: 'auto' }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Full recommendation cards ONLY when there is nothing purchasable
                  to show (e.g. the global Find A Peptide page, or a store that
                  stocks none of the matches). When the store DOES stock some
                  matches, non-stocked compounds stay as the compact chips below so
                  the store's own sellable inventory keeps visual priority -- that
                  was the pre-existing merchandising behavior and is preserved. */}
              {!loading && recommendations.length > 0 && inCatalog.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {recommendations.map((r) => (
                    <div
                      key={`rec-${r.compound_slug || r.display_name}`}
                      style={{
                        display: 'flex', gap: 12, alignItems: 'stretch',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.10)',
                        borderRadius: 14, padding: 12, position: 'relative',
                      }}
                    >
                      {r.image_url ? (
                        <Image
                          src={r.image_url}
                          alt={r.display_name}
                          onClick={() => { if (r.product_id) onOpenProduct(r.product_id); }}
                          style={{ width: 72, height: 72, borderRadius: 10, objectFit: 'cover', cursor: r.product_id ? 'pointer' : 'default', flexShrink: 0 }}
                          width={200} height={200} unoptimized
                        />
                      ) : (
                        <div style={{ width: 72, height: 72, borderRadius: 10, background: 'rgba(192,197,206,0.08)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Sparkles size={22} color={primaryColor} style={{ opacity: 0.5 }} />
                        </div>
                      )}

                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <div style={{ color: '#FFFFFF', fontWeight: 800, fontSize: '0.96rem', lineHeight: 1.25, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {r.display_name}
                          </div>
                          {typeof r.score === 'number' && (
                            <span style={{
                              fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.04em',
                              padding: '3px 8px', borderRadius: 6, flexShrink: 0,
                              background: 'rgba(61,217,164,0.14)', color: '#3DD9A4',
                              border: '1px solid rgba(61,217,164,0.35)',
                            }} title="Match score out of 100">
                              {r.score}% Match
                            </span>
                          )}
                          {r.isStackPartner && (
                            <span style={{
                              fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
                              padding: '3px 7px', borderRadius: 6,
                              background: 'rgba(246,173,85,0.14)', color: '#F6AD55',
                              border: '1px solid rgba(246,173,85,0.35)', flexShrink: 0,
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                            }} title="Synergizes well with other matched compounds">
                              <Sparkles size={10} /> Stack Partner
                            </span>
                          )}
                        </div>

                        {r.rationale && (
                          <div style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.82rem', lineHeight: 1.4 }}>
                            <span style={{ color: 'var(--grey-400, #C8D2DD)', fontWeight: 700 }}>Why This Match: </span>
                            {r.rationale}
                          </div>
                        )}

                        {/* Visualizations */}
                        <div style={{ display: 'flex', gap: 16, marginTop: 6, marginBottom: 6 }}>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--silver)', textTransform: 'uppercase' }}>Target Efficacy</div>
                            <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ width: `${r.score || 0}%`, height: '100%', background: 'linear-gradient(90deg, #3182ce, #63b3ed)', borderRadius: 4 }} />
                            </div>
                          </div>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--silver)', textTransform: 'uppercase' }}>Human Data</div>
                            <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ width: `${getTierPercent(r.evidence_tier)}%`, height: '100%', background: 'linear-gradient(90deg, #805ad5, #b794f4)', borderRadius: 4 }} />
                            </div>
                          </div>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--silver)', textTransform: 'uppercase' }}>Safety Profile</div>
                            <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ width: `${getRiskPercent(r.riskLevel)}%`, height: '100%', background: getRiskColor(r.riskLevel), borderRadius: 4 }} />
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                          {r.product_id && r.price_cents > 0 && (
                            <div style={{ color: '#C0C5CE', fontWeight: 900, fontSize: '1rem' }}>
                              ${(r.price_cents / 100).toFixed(2)}
                            </div>
                          )}
                          <div style={{ flex: 1 }} />
                          {r.product_id ? (
                            <button
                              type="button"
                              onClick={() => onOpenProduct(r.product_id)}
                              style={{
                                background: 'transparent', border: '1px solid rgba(255,255,255,0.16)',
                                color: '#FFFFFF', fontWeight: 700, fontSize: '0.82rem',
                                padding: '8px 12px', borderRadius: 10, cursor: 'pointer', minHeight: 40,
                              }}
                            >
                              View Details
                            </button>
                          ) : r.compound_slug ? (
                            <a
                              href={`/research/${r.compound_slug}`}
                              style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                background: primaryColor, border: 'none',
                                color: '#0A1018', fontWeight: 800, fontSize: '0.82rem',
                                padding: '8px 14px', borderRadius: 10, cursor: 'pointer', minHeight: 40,
                                textDecoration: 'none',
                              }}
                            >
                              View Research Profile
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Compact "also studied" chips -- shown only when the store stocks
                  some matches, so its sellable inventory keeps priority. Same
                  treatment as before the recommendation-card change. */}
              {!loading && recommendations.length > 0 && inCatalog.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                    Also Studied For This Goal - Not Currently Stocked Here
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {recommendations.map((r) => (
                      r.compound_slug ? (
                        <a
                          key={`oos-${r.compound_slug}`}
                          href={`/research/${r.compound_slug}`}
                          style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.10)',
                            color: 'var(--silver, #A8B4C0)',
                            borderRadius: 999, padding: '6px 10px',
                            fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none',
                          }}
                        >
                          {r.display_name}
                        </a>
                      ) : (
                        <span
                          key={`oos-${r.display_name}`}
                          style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.10)',
                            color: 'var(--silver, #A8B4C0)',
                            borderRadius: 999, padding: '6px 10px',
                            fontSize: '0.78rem', fontWeight: 600,
                          }}
                        >
                          {r.display_name}
                        </span>
                      )
                    ))}
                  </div>
                </div>
              )}

              {/* Protocol Schedule */}
              {!loading && !followUp && filteredResults.length > 0 && (
                <ProtocolScheduler results={filteredResults} primaryColor={primaryColor} />
              )}

              {/* Excluded Compounds */}
              {!loading && !followUp && excluded && excluded.length > 0 && (
                <div style={{ marginTop: 32, padding: 20, background: 'rgba(255,0,0,0.03)', border: '1px solid rgba(255,0,0,0.1)', borderRadius: 12 }}>
                  <h4 style={{ color: '#FC8181', fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: 12, letterSpacing: '0.05em' }}>Excluded From Results</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {excluded.map((e, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ color: '#FFF', fontWeight: 600, fontSize: '0.9rem' }}>{e.displayName}</span>
                        <span style={{ color: '#A8B4C0', fontSize: '0.85rem' }}>- {e.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ height: 100 }} />
            </div>

            {/* Sticky Drawer Footer */}
            {!loading && !followUp && filteredResults.length > 0 && (
              <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', background: '#0A1018', display: 'flex', gap: 12, paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}>
                <button
                  id="pnl-share-btn"
                  onClick={handleShare}
                  disabled={isSharing}
                  aria-busy={isSharing}
                  style={{ flex: 1, padding: '14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#FFF', borderRadius: 8, fontWeight: 800, cursor: isSharing ? 'not-allowed' : 'pointer', transition: 'all 0.2s', opacity: isSharing ? 0.6 : 1 }}
                >
                  {isSharing ? 'Sharing...' : shareCopied ? 'Copied Link!' : 'Share Protocol'}
                </button>
                {stackItems.length > 0 && (
                  <button
                    onClick={handleAddStack}
                    style={{ flex: 2, padding: '14px', background: primaryColor, border: 'none', color: '#0A1018', borderRadius: 8, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <ShoppingCart size={18} />
                    Add Full Stack To Cart
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

      {/* Compare Modal */}
      <AnimatePresence>
        {compareOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 900,
              background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: 'env(safe-area-inset-top, 0px) 0 env(safe-area-inset-bottom, 0px)',
            }}
          >
            <div style={{ width: '100%', maxWidth: 1000, flex: 1, display: 'flex', flexDirection: 'column', padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <h2 style={{ color: '#FFF', margin: 0 }}>Compare Matches</h2>
                <button
                  type="button"
                  onClick={() => setCompareOpen(false)}
                  style={{
                    background: 'rgba(255,255,255,0.1)', color: '#FFF', border: 'none',
                    padding: 8, borderRadius: 12, cursor: 'pointer'
                  }}
                >
                  <X size={24} />
                </button>
              </div>

              <div style={{ flex: 1, overflowX: 'auto', background: 'rgba(255,255,255,0.03)', border: '6px solid #E2E8F0', boxSizing: 'border-box', borderRadius: 20 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#E2E8F0', minWidth: 800 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.1)', width: 180 }}>Attribute</th>
                      {compareIds.map(id => {
                        const item = results.find(r => r.product_id === id);
                        return (
                          <th key={id} style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.1)', minWidth: 200 }}>
                            {item?.display_name}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: 700, color: '#A8B4C0' }}>Price</td>
                      {compareIds.map(id => {
                        const item = results.find(r => r.product_id === id);
                        return <td key={id} style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: 800, color: '#C0C5CE' }}>${(item?.price_cents ? item.price_cents / 100 : 0).toFixed(2)}</td>;
                      })}
                    </tr>
                    <tr>
                      <td style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: 700, color: '#A8B4C0' }}>Target Efficacy</td>
                      {compareIds.map(id => {
                        const item = results.find(r => r.product_id === id);
                        return <td key={id} style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{item?.score}%</td>;
                      })}
                    </tr>
                    <tr>
                      <td style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: 700, color: '#A8B4C0' }}>Human Data Tier</td>
                      {compareIds.map(id => {
                        const item = results.find(r => r.product_id === id);
                        return <td key={id} style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{item?.evidence_tier?.replace(/_/g, ' ')}</td>;
                      })}
                    </tr>
                    <tr>
                      <td style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: 700, color: '#A8B4C0' }}>Safety Profile</td>
                      {compareIds.map(id => {
                        const item = results.find(r => r.product_id === id);
                        return <td key={id} style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.05)', textTransform: 'capitalize' }}>{item?.riskLevel} Risk</td>;
                      })}
                    </tr>
                    <tr>
                      <td style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: 700, color: '#A8B4C0' }}>Half Life</td>
                      {compareIds.map(id => {
                        const item = results.find(r => r.product_id === id);
                        return <td key={id} style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{item?.halfLife || 'N/A'}</td>;
                      })}
                    </tr>
                    <tr>
                      <td style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: 700, color: '#A8B4C0' }}>Molecular Wt</td>
                      {compareIds.map(id => {
                        const item = results.find(r => r.product_id === id);
                        return <td key={id} style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{item?.molecularWeight ? `${item.molecularWeight} Da` : 'N/A'}</td>;
                      })}
                    </tr>
                    <tr>
                      <td style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: 700, color: '#A8B4C0' }}>Why This Match</td>
                      {compareIds.map(id => {
                        const item = results.find(r => r.product_id === id);
                        return <td key={id} style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem', lineHeight: 1.5 }}>{item?.rationale}</td>;
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
