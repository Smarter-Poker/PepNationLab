'use client';

/**
 * StorefrontDiscovery
 * ---
 * Top-of-storefront discovery layer for researchers who do not already
 * know what compound they want to buy. Composes three pieces:
 *
 *   1. DiscoveryHero          large goal search + example chips + Let Us Guide You
 *   2. GuidedDiscoveryWizard  3-step modal that funnels into the match engine
 *   3. MatchResultsDrawer     bottom-sheet that shows matched products with Add To Cart
 *
 * The hero is the default export; the wizard and the results drawer are
 * managed internally by the hero so the caller only mounts one component.
 *
 * Public API surface (exported types):
 *   - DiscoveryHeroProps
 *   - MatchedProduct
 *
 * No DB changes. Reuses the existing /api/research/match endpoint and the
 * compoundsBySlug prop already plumbed into AgentStorefrontGrid.
 *
 * Research-Use-Only platform. Title Case on every user-facing string.
 * No emojis.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Search, ArrowRight, X, ShoppingCart, Compass } from 'lucide-react';
import type { Compound } from '@/lib/compounds';

// --------------------------------------------------------------------------
// Public types
// --------------------------------------------------------------------------

export interface MatchedProduct {
  product_id: string;          // agent_products.id (used by the cart)
  display_name: string;        // what the researcher sees
  compound_slug: string | null;
  price_cents: number;
  evidence_tier: string | null;
  rationale: string;           // plain-English "why this match"
  image_url: string | null;
  in_stock: boolean;
  isStackPartner?: boolean;
  score?: number;
  riskLevel?: string;
  halfLife?: string;
  molecularWeight?: number;
}

export interface DiscoveryHeroProps {
  /** Compound slug -> Compound (the same prop AgentStorefrontGrid already gets). */
  compoundsBySlug: Record<string, Compound>;
  /**
   * Caller resolves a list of compound slugs into the products this agent
   * actually sells, in the order they came in. Out-of-catalog slugs may be
   * dropped or returned with in_stock=false.
   */
  resolveProducts: (slugs: string[]) => MatchedProduct[];
  /** Caller adds a product (by agent_products.id) to the cart. */
  onAddToCart: (productId: string) => void;
  /** Caller opens the product detail modal (by agent_products.id). */
  onOpenProduct: (productId: string) => void;
  /** Caller filters the storefront by a single research area. */
  onSelectArea: (area: string) => void;
  /** Brand primary colour for the hero gradient. */
  primaryColor?: string;
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

const getTierPercent = (tier?: string | null) => {
  if (!tier) return 0;
  if (tier === 'approved_drug') return 100;
  if (tier === 'investigational') return 80;
  if (tier === 'preclinical') return 60;
  if (tier === 'research_chemical') return 40;
  if (tier === 'cosmetic') return 20;
  return 0;
};

const getRiskPercent = (risk?: string | null) => {
  if (!risk) return 0;
  if (risk === 'low') return 100;
  if (risk === 'moderate') return 70;
  if (risk === 'high') return 40;
  if (risk === 'critical') return 15;
  return 0;
};

const getRiskColor = (risk?: string | null) => {
  if (risk === 'low') return 'linear-gradient(90deg, #00C4BC, #4FD1C5)';
  if (risk === 'moderate') return 'linear-gradient(90deg, #ED8936, #F6AD55)';
  if (risk === 'high') return 'linear-gradient(90deg, #E53E3E, #FC8181)';
  if (risk === 'critical') return 'linear-gradient(90deg, #9B2C2C, #F56565)';
  return '#A8B4C0';
};


// --------------------------------------------------------------------------
// Internal helpers
// --------------------------------------------------------------------------

/** Six static goal chips. Title Case, no emojis. */
const EXAMPLE_GOALS: ReadonlyArray<{ label: string; goal: string }> = [
  { label: 'Recovery',        goal: 'Recover Faster From Training And Injury' },
  { label: 'Weight Management', goal: 'Reduce Body Fat And Improve Metabolic Health' },
  { label: 'Sleep',           goal: 'Improve Sleep Quality And Circadian Rhythm' },
  { label: 'Cognitive',       goal: 'Sharpen Focus And Cognitive Performance' },
  { label: 'Anti-Aging',      goal: 'Healthspan And Anti-Aging Research' },
  { label: 'Immune',          goal: 'Strengthen Immune Response And Resilience' },
] as const;

const RESEARCH_AREA_LABELS: Record<string, string> = {
  weight_management:   'Weight Management',
  metabolic:           'Metabolic & Glucose',
  healing:             'Recovery & Healing',
  tissue_repair:       'Tendon & Tissue Repair',
  longevity:           'Anti-Aging & Longevity',
  cosmetic:            'Skin & Hair',
  cognitive:           'Cognitive & Focus',
  sleep:               'Sleep & Circadian',
  immune:              'Immune Support',
  hormonal:            'Hormonal Balance',
  gut_health:          'Gut Health',
  pain_inflammation:   'Pain & Inflammation',
  bone_joint:          'Bone & Joint',
  sexual_health:       'Sexual Health',
  cardiovascular:      'Cardiovascular',
  muscle_growth:       'Muscle Growth',
};

function labelForArea(area: string): string {
  return RESEARCH_AREA_LABELS[area] || area.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Collect the unique research areas the agent's catalog actually covers. */
function deriveAvailableAreas(compoundsBySlug: Record<string, Compound>): string[] {
  const seen = new Set<string>();
  for (const c of Object.values(compoundsBySlug)) {
    for (const area of c.research_areas || []) {
      if (typeof area === 'string' && area.length > 0) seen.add(area);
    }
  }
  // Sort so high-traffic areas float to the front; everything else alpha.
  const PRIORITY = [
    'weight_management', 'healing', 'tissue_repair', 'longevity',
    'cognitive', 'sleep', 'immune', 'metabolic', 'cosmetic',
  ];
  const out = Array.from(seen);
  out.sort((a, b) => {
    const ai = PRIORITY.indexOf(a);
    const bi = PRIORITY.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });
  return out;
}

// --------------------------------------------------------------------------
// MatchResultsDrawer
// --------------------------------------------------------------------------

function MatchResultsDrawer({
  open,
  loading,
  results,
  goalSummary,
  onClose,
  onAddToCart,
  onOpenProduct,
  primaryColor,
}: {
  open: boolean;
  loading: boolean;
  results: MatchedProduct[];
  goalSummary: string;
  onClose: () => void;
  onAddToCart: (productId: string) => void;
  onOpenProduct: (productId: string) => void;
  primaryColor: string;
}) {
  const [filterOralOnly, setFilterOralOnly] = useState(false);
  const [filterHumanOnly, setFilterHumanOnly] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setFilterOralOnly(false);
      setFilterHumanOnly(false);
      setCompareIds([]);
      setCompareOpen(false);
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

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

  const inCatalog = filteredResults.filter(r => r.in_stock);
  const outOfCatalog = filteredResults.filter(r => !r.in_stock);
  const stackItems = inCatalog.filter(r => r.isStackPartner);

  const handleAddStack = () => {
    stackItems.forEach(item => onAddToCart(item.product_id));
  };

  const toggleCompare = (id: string) => {
    setCompareIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
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
              borderTop: '1px solid rgba(255,255,255,0.1)',
              borderLeft: '1px solid rgba(255,255,255,0.1)',
              borderRight: '1px solid rgba(255,255,255,0.1)',
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
                    background: filterOralOnly ? 'rgba(0,196,188,0.2)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${filterOralOnly ? '#00C4BC' : 'rgba(255,255,255,0.1)'}`,
                    color: filterOralOnly ? '#00C4BC' : '#A8B4C0',
                    padding: '6px 14px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                    whiteSpace: 'nowrap', transition: 'all 0.2s ease',
                  }}
                >
                  {filterOralOnly ? '✓ Oral Only' : 'Oral Only'}
                </button>
                <button
                  type="button"
                  onClick={() => setFilterHumanOnly(!filterHumanOnly)}
                  style={{
                    background: filterHumanOnly ? 'rgba(0,196,188,0.2)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${filterHumanOnly ? '#00C4BC' : 'rgba(255,255,255,0.1)'}`,
                    color: filterHumanOnly ? '#00C4BC' : '#A8B4C0',
                    padding: '6px 14px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                    whiteSpace: 'nowrap', transition: 'all 0.2s ease',
                  }}
                >
                  {filterHumanOnly ? '✓ Human Data Only' : 'Human Data Only'}
                </button>
                <div style={{ flex: 1 }} />
                {compareIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCompareOpen(true)}
                    style={{
                      background: '#00C4BC', color: '#0A1018',
                      border: 'none', padding: '6px 14px', borderRadius: 20,
                      fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer',
                      whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,196,188,0.3)',
                    }}
                  >
                    Compare ({compareIds.length})
                  </button>
                )}
              </div>
            )}

            <div style={{ overflowY: 'auto', padding: '14px 20px 18px', flex: 1 }}>
              {loading && (
                <div style={{ padding: '64px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
                  <div style={{
                    width: 60, height: 60, borderRadius: '50%',
                    border: '3px solid rgba(0, 196, 188, 0.1)',
                    borderTopColor: '#00C4BC',
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
              )}

              {!loading && filteredResults.length === 0 && (
                <div style={{ padding: '32px 8px', textAlign: 'center', color: 'var(--silver, #A8B4C0)' }}>
                  No Matches Found With These Filters. Try Expanding Your Search.
                </div>
              )}

              {/* Stack "Add Protocol to Cart" logic */}
              {!loading && stackItems.length > 1 && !filterOralOnly && !filterHumanOnly && (
                <div style={{ background: 'rgba(246,173,85,0.08)', border: '1px solid rgba(246,173,85,0.3)', borderRadius: 16, padding: '14px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ color: '#F6AD55', fontWeight: 800, fontSize: '0.9rem' }}>⚡ Recommended Protocol Stack</div>
                    <button
                      type="button"
                      onClick={handleAddStack}
                      style={{
                        background: '#F6AD55', color: '#0A1018', border: 'none',
                        padding: '6px 12px', borderRadius: 8, fontWeight: 800, fontSize: '0.75rem',
                        cursor: 'pointer', boxShadow: '0 4px 12px rgba(246,173,85,0.3)'
                      }}
                    >
                      Add Stack To Cart
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
                        border: `2px solid ${compareIds.includes(r.product_id) ? '#00C4BC' : 'rgba(255,255,255,0.3)'}`,
                        borderRadius: 6, cursor: 'pointer',
                      }}>
                        <input
                          type="checkbox"
                          checked={compareIds.includes(r.product_id)}
                          onChange={() => toggleCompare(r.product_id)}
                          style={{ opacity: 0, position: 'absolute' }}
                        />
                        {compareIds.includes(r.product_id) && <div style={{ width: 12, height: 12, background: '#00C4BC', borderRadius: 2 }} />}
                      </label>

                      {r.image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={r.image_url}
                          alt=""
                          onClick={() => onOpenProduct(r.product_id)}
                          style={{ width: 72, height: 72, borderRadius: 10, objectFit: 'cover', cursor: 'pointer', flexShrink: 0 }}
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
                          {r.evidence_tier && (
                            <span style={{
                              fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
                              padding: '3px 7px', borderRadius: 6,
                              background: 'rgba(0,196,188,0.14)', color: '#00C4BC',
                              border: '1px solid rgba(0,196,188,0.35)', flexShrink: 0,
                            }}>
                              {r.evidence_tier.replace(/_/g, ' ')}
                            </span>
                          )}
                          {r.isStackPartner && (
                            <span style={{
                              fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
                              padding: '3px 7px', borderRadius: 6,
                              background: 'rgba(246,173,85,0.14)', color: '#F6AD55',
                              border: '1px solid rgba(246,173,85,0.35)', flexShrink: 0,
                            }} title="Synergizes well with other matched compounds">
                              ⚡ Synergistic Stack Partner
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
                          <div style={{ color: '#00C4BC', fontWeight: 900, fontSize: '1rem' }}>
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
                          <button
                            type="button"
                            onClick={() => onAddToCart(r.product_id)}
                            style={{
                              background: '#00C4BC', color: '#0A1018',
                              border: 0, fontWeight: 900, fontSize: '0.82rem',
                              padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              minHeight: 40,
                            }}
                          >
                            <ShoppingCart size={14} aria-hidden /> Add To Cart
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!loading && outOfCatalog.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                    Also Studied For This Goal — Not Currently Stocked Here
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {outOfCatalog.map((r) => (
                      <span
                        key={`oos-${r.compound_slug || r.display_name}`}
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
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}

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

              <div style={{ flex: 1, overflowX: 'auto', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20 }}>
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
                        return <td key={id} style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: 800, color: '#00C4BC' }}>${(item?.price_cents ? item.price_cents / 100 : 0).toFixed(2)}</td>;
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
    </AnimatePresence>
  );
}

// --------------------------------------------------------------------------
// GuidedDiscoveryWizard
// --------------------------------------------------------------------------

interface WizardState {
  area: string;             // research_area key
  preference: 'single' | 'stack' | 'either';
  comfort: 'strict_human_only' | 'investigational_ok' | 'preclinical_ok' | 'any';
}

const DEFAULT_WIZARD: WizardState = {
  area: 'healing',
  preference: 'either',
  comfort: 'preclinical_ok',
};

function GuidedDiscoveryWizard({
  open,
  availableAreas,
  onClose,
  onSubmit,
  primaryColor,
}: {
  open: boolean;
  availableAreas: string[];
  onClose: () => void;
  onSubmit: (state: WizardState) => void;
  primaryColor: string;
}) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(DEFAULT_WIZARD);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep(0);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(s => ({ ...s, area: availableAreas[0] || 'healing' }));
    }
  }, [open, availableAreas]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const TOTAL_STEPS = 3;

  const variants = {
    initial: { x: 20, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -20, opacity: 0 }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Guided Discovery"
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 850,
            background: 'rgba(5,10,15,0.82)',
            backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 'max(16px, env(safe-area-inset-top, 0px)) 16px max(16px, env(safe-area-inset-bottom, 0px))',
          }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 560,
              background: 'rgba(15, 25, 35, 0.85)', color: '#FFFFFF',
              borderRadius: 20,
              border: '1px solid rgba(255,255,255,0.10)',
              boxShadow: `0 20px 48px ${primaryColor}33`,
              display: 'flex', flexDirection: 'column',
              maxHeight: 'calc(100dvh - 32px)',
            }}
          >
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '14px 18px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                background: `linear-gradient(135deg, ${primaryColor}22 0%, transparent 60%)`,
                borderTopLeftRadius: 20, borderTopRightRadius: 20,
              }}
            >
              <Compass size={18} aria-hidden style={{ color: '#00C4BC' }} />
              <div style={{ fontWeight: 800, fontSize: '0.98rem', flex: 1 }}>Let Us Guide You</div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.16)',
                  color: '#FFFFFF', borderRadius: 10, padding: 8, cursor: 'pointer',
                  minWidth: 40, minHeight: 40,
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '14px 18px 6px', display: 'flex', gap: 6 }}>
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1, height: 4, borderRadius: 999,
                    background: i <= step ? '#00C4BC' : 'rgba(255,255,255,0.10)',
                    transition: 'background 0.3s ease',
                  }}
                />
              ))}
            </div>

            <div style={{ padding: '14px 18px 18px', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
              <AnimatePresence mode="wait">
                {step === 0 && (
                  <motion.div key="step0" variants={variants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>What Research Area Are You Focused On?</h3>
                    <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.88rem', lineHeight: 1.5, marginTop: 6 }}>
                      Pick The Area Closest To Your Goal. We Will Match Compounds Studied For That Area.
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                      {availableAreas.map((area) => {
                        const active = state.area === area;
                        return (
                          <button
                            key={area}
                            type="button"
                            onClick={() => setState(s => ({ ...s, area }))}
                            style={{
                              padding: '10px 14px',
                              borderRadius: 12,
                              background: active ? 'rgba(0,196,188,0.2)' : 'rgba(255,255,255,0.05)',
                              border: active ? '1px solid #00C4BC' : '1px solid rgba(255,255,255,0.14)',
                              color: active ? '#00C4BC' : '#FFFFFF',
                              fontWeight: 700, fontSize: '0.86rem',
                              cursor: 'pointer', minHeight: 44, transition: 'all 0.2s ease',
                            }}
                          >
                            {labelForArea(area)}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {step === 1 && (
                  <motion.div key="step1" variants={variants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Single Compounds Or Blended Stacks?</h3>
                    <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.88rem', lineHeight: 1.5, marginTop: 6 }}>
                      Stacks Bundle Multiple Peptides Into One Vial For Combined Effects. Singles Let You Mix Your Own Protocol.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginTop: 14 }}>
                      {([
                        { v: 'single', label: 'Single Compounds', sub: 'I Want To Build My Own Protocol.' },
                        { v: 'stack', label: 'Blended Stacks', sub: 'I Want A Pre-Built Combination.' },
                        { v: 'either', label: 'Show Me Both', sub: 'I Am Open To Either.' },
                      ] as const).map(o => {
                        const active = state.preference === o.v;
                        return (
                          <button
                            key={o.v}
                            type="button"
                            onClick={() => setState(s => ({ ...s, preference: o.v }))}
                            style={{
                              textAlign: 'left',
                              padding: '14px 16px',
                              borderRadius: 12,
                              background: active ? 'rgba(0,196,188,0.15)' : 'rgba(255,255,255,0.04)',
                              border: active ? '1px solid #00C4BC' : '1px solid rgba(255,255,255,0.12)',
                              color: '#FFFFFF',
                              cursor: 'pointer', minHeight: 56, transition: 'all 0.2s ease',
                            }}
                          >
                            <div style={{ fontWeight: 800, fontSize: '0.96rem', color: active ? '#00C4BC' : '#FFF' }}>{o.label}</div>
                            <div style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.82rem', marginTop: 2 }}>{o.sub}</div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div key="step2" variants={variants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>How Well-Studied Should The Compound Be?</h3>
                    <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.88rem', lineHeight: 1.5, marginTop: 6 }}>
                      Stricter Comfort Returns Fewer But More Established Compounds. Looser Comfort Opens Up Newer Research Areas.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginTop: 14 }}>
                      {([
                        { v: 'strict_human_only', label: 'Approved Compounds Only',     sub: 'Strongest Human Evidence.' },
                        { v: 'investigational_ok', label: 'Investigational Or Better', sub: 'Active Clinical Trials Allowed.' },
                        { v: 'preclinical_ok',     label: 'Preclinical Or Better',     sub: 'Animal And Cell Studies Allowed (Recommended).' },
                        { v: 'any',                label: 'Any Research Stage',        sub: 'Show Me Everything Studied For My Goal.' },
                      ] as const).map(o => {
                        const active = state.comfort === o.v;
                        return (
                          <button
                            key={o.v}
                            type="button"
                            onClick={() => setState(s => ({ ...s, comfort: o.v }))}
                            style={{
                              textAlign: 'left',
                              padding: '14px 16px',
                              borderRadius: 12,
                              background: active ? 'rgba(0,196,188,0.15)' : 'rgba(255,255,255,0.04)',
                              border: active ? '1px solid #00C4BC' : '1px solid rgba(255,255,255,0.12)',
                              color: '#FFFFFF',
                              cursor: 'pointer', minHeight: 56, transition: 'all 0.2s ease',
                            }}
                          >
                            <div style={{ fontWeight: 800, fontSize: '0.96rem', color: active ? '#00C4BC' : '#FFF' }}>{o.label}</div>
                            <div style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.82rem', marginTop: 2 }}>{o.sub}</div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div
              style={{
                display: 'flex', gap: 10, padding: '12px 18px 16px',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
              }}
            >
              <button
                type="button"
                onClick={() => (step > 0 ? setStep(step - 1) : onClose())}
                style={{
                  flex: 1,
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.18)',
                  color: '#FFFFFF', fontWeight: 700, fontSize: '0.92rem',
                  padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                  minHeight: 48,
                }}
              >
                {step === 0 ? 'Cancel' : 'Back'}
              </button>
              {step < TOTAL_STEPS - 1 ? (
                <button
                  type="button"
                  onClick={() => setStep(step + 1)}
                  style={{
                    flex: 1,
                    background: '#00C4BC', color: '#0A1018', border: 0,
                    fontWeight: 900, fontSize: '0.92rem',
                    padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    minHeight: 48,
                    boxShadow: '0 4px 12px rgba(0,196,188,0.3)',
                  }}
                >
                  Next <ArrowRight size={16} aria-hidden />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSubmit(state)}
                  style={{
                    flex: 1,
                    background: '#00C4BC', color: '#0A1018', border: 0,
                    fontWeight: 900, fontSize: '0.92rem',
                    padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                    minHeight: 48,
                    boxShadow: '0 4px 12px rgba(0,196,188,0.3)',
                  }}
                >
                  Reveal Top Matches
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// --------------------------------------------------------------------------
// DiscoveryHero — the default export
// --------------------------------------------------------------------------

function buildGoalFromWizard(state: WizardState): string {
  const area = labelForArea(state.area);
  const pref =
    state.preference === 'single' ? 'Single Compound' :
    state.preference === 'stack'  ? 'Blended Stack' :
                                    'Either Single Or Stack';
  return `${area} Goal · ${pref}`;
}

export default function DiscoveryHero({
  compoundsBySlug,
  resolveProducts,
  onAddToCart,
  onOpenProduct,
  onSelectArea,
  primaryColor = '#00C4BC',
}: DiscoveryHeroProps) {
  const [query, setQuery] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showAllAreas, setShowAllAreas] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MatchedProduct[]>([]);
  const [goalSummary, setGoalSummary] = useState('');

  const availableAreas = useMemo(() => deriveAvailableAreas(compoundsBySlug), [compoundsBySlug]);

  const runMatch = useCallback(async (input: {
    goal: string;
    evidenceComfort?: 'strict_human_only' | 'investigational_ok' | 'preclinical_ok' | 'any';
    wadaConstraint?: 'wada_permitted_only' | 'no_constraint';
    riskTolerance?: 'low_only' | 'moderate_ok' | 'any';
    preference?: 'single' | 'stack' | 'either';
    excludeInjectables?: boolean;
    requireLongHalfLife?: boolean;
  }, summary: string) => {
    setLoading(true);
    setResults([]);
    setGoalSummary(summary);
    setDrawerOpen(true);
    try {
      const res = await fetch('/api/research/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: {
            goal: input.goal,
            evidenceComfort: input.evidenceComfort || 'preclinical_ok',
            wadaConstraint: input.wadaConstraint || 'no_constraint',
            riskTolerance: input.riskTolerance || 'moderate_ok',
            preference: input.preference,
            excludeInjectables: input.excludeInjectables,
            requireLongHalfLife: input.requireLongHalfLife,
          },
        }),
      });
      const json = await res.json().catch(() => null) as {
        results?: Array<{ 
          slug: string; 
          rationale?: string; 
          isStackPartner?: boolean;
          score?: number;
          riskLevel?: string;
          halfLife?: string;
          molecularWeight?: number;
        }>;
      } | null;
      const slugs = (json?.results || []).map(r => r.slug).filter(Boolean);
      
      const detailsMap = new Map((json?.results || []).map(r => [r.slug, r]));
      
      const products = resolveProducts(slugs);
      
      // Attach rationale and stack data by slug when available.
      const stitched = products.map(p => {
        const details = p.compound_slug ? detailsMap.get(p.compound_slug) : null;
        return {
          ...p,
          rationale: details?.rationale || p.rationale,
          isStackPartner: details?.isStackPartner || false,
          score: details?.score,
          riskLevel: details?.riskLevel,
          halfLife: details?.halfLife,
          molecularWeight: details?.molecularWeight,
        };
      });
      setResults(stitched);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [resolveProducts]);

  const submitTypedGoal = useCallback(async () => {
    const g = query.trim();
    if (!g) return;
    
    setLoading(true);
    setDrawerOpen(true);
    setSummary(g);

    try {
      const res = await fetch('/api/research/ai-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: g })
      });
      const data = await res.json().catch(() => null);
      
      if (data?.result) {
        await runMatch(data.result, g);
      } else {
        await runMatch({ goal: g }, g);
      }
    } catch (e) {
      console.error(e);
      await runMatch({ goal: g }, g);
    }
  }, [query, runMatch]);

  return (
    <>
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 980,
          margin: '0 auto 18px',
          aspectRatio: '980 / 476',
          backgroundImage: 'url(/images/store_discovery_hero_v2.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          borderRadius: 22,
          overflow: 'hidden',
          boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
        }}
      >
        {/* Match Me Button Overlay */}
        <button
          type="button"
          onClick={() => {
            onSelectArea(''); // Clear filter
            if (!query.trim()) {
              setWizardOpen(true);
            } else {
              submitTypedGoal();
            }
          }}
          title="Match Me"
          style={{
            position: 'absolute', top: '7%', left: '52%', width: '20%', height: '15%',
            cursor: 'pointer', opacity: 0, zIndex: 10
          }}
          aria-label="Match Me"
        />

        {/* Let Us Guide You Button Overlay */}
        <button
          type="button"
          onClick={() => {
            onSelectArea(''); // Clear filter
            setWizardOpen(true);
          }}
          title="Let Us Guide You"
          style={{
            position: 'absolute', top: '7%', left: '73%', width: '22%', height: '15%',
            cursor: 'pointer', opacity: 0, zIndex: 10
          }}
          aria-label="Let Us Guide You"
        />

        {/* Search Input Box */}
        <input
          id="discovery-search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { 
            if (e.key === 'Enter' && query.trim()) {
              onSelectArea(''); // Clear filter
              submitTypedGoal();
            }
          }}
          placeholder="Ask Us Anything About The Peptides You Want To Research..."
          style={{
            position: 'absolute', top: '34.4%', left: '9%', width: '89%', height: '13%',
            background: 'transparent',
            border: 'none', outline: 'none', color: '#FFFFFF',
            fontSize: 'max(15px, 1.4vw)',
            padding: '0 10px 0 45px',
            zIndex: 5,
            fontWeight: 500,
            letterSpacing: '0.02em',
          }}
        />

        {/* Quick Select Buttons */}
        <button title="Recovery" onClick={() => onSelectArea('healing')} style={{ position: 'absolute', top: '67%', left: '1%', width: '11%', height: '25%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />
        <button title="Weight Management" onClick={() => onSelectArea('weight_management')} style={{ position: 'absolute', top: '67%', left: '13%', width: '11%', height: '25%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />
        <button title="Sleep" onClick={() => onSelectArea('sleep')} style={{ position: 'absolute', top: '67%', left: '25%', width: '11%', height: '25%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />
        <button title="Cognitive" onClick={() => onSelectArea('cognitive')} style={{ position: 'absolute', top: '67%', left: '37%', width: '11%', height: '25%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />
        <button title="Immune" onClick={() => onSelectArea('immune')} style={{ position: 'absolute', top: '67%', left: '49%', width: '11%', height: '25%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />
        <button title="Metabolic" onClick={() => onSelectArea('metabolic')} style={{ position: 'absolute', top: '67%', left: '61%', width: '11%', height: '25%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />
        <button title="Longevity" onClick={() => onSelectArea('longevity')} style={{ position: 'absolute', top: '67%', left: '73%', width: '11%', height: '25%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />
        <button title="More" onClick={() => {
          onSelectArea(''); // Clear filter
          setShowAllAreas(true);
        }} style={{ position: 'absolute', top: '67%', left: '85%', width: '13%', height: '25%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />
        
        {/* Pop Up For All Areas */}
        {showAllAreas && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(5, 10, 15, 0.95)', backdropFilter: 'blur(12px)',
            zIndex: 50, display: 'flex', flexDirection: 'column', padding: 24,
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ color: '#FFF', fontSize: '1.4rem', fontWeight: 800 }}>Browse By Research Area</h3>
              <button 
                type="button" 
                onClick={() => setShowAllAreas(false)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#FFF', cursor: 'pointer', borderRadius: '50%', padding: '8px', display: 'flex' }}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: '16px',
              paddingBottom: '32px'
            }}>
              {availableAreas.map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => { setShowAllAreas(false); onSelectArea(area); }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    margin: 0,
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    transition: 'transform 0.2s ease',
                    aspectRatio: '1 / 1'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0) scale(1)'}
                >
                  <img 
                    src={`/images/areas/${area}.png`} 
                    alt={labelForArea(area)} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <GuidedDiscoveryWizard
        open={wizardOpen}
        availableAreas={availableAreas}
        primaryColor={primaryColor}
        onClose={() => setWizardOpen(false)}
        onSubmit={(s) => {
          setWizardOpen(false);
          const goal = `${labelForArea(s.area)} Research`;
          void runMatch(
            { goal, evidenceComfort: s.comfort, preference: s.preference },
            buildGoalFromWizard(s),
          );
        }}
      />

      <MatchResultsDrawer
        open={drawerOpen}
        loading={loading}
        results={results}
        goalSummary={goalSummary}
        primaryColor={primaryColor}
        onClose={() => setDrawerOpen(false)}
        onAddToCart={(id) => { setDrawerOpen(false); onAddToCart(id); }}
        onOpenProduct={(id) => { setDrawerOpen(false); onOpenProduct(id); }}
      />
    </>
  );
}
