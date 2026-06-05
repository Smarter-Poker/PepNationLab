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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ProtocolScheduler } from '../research/ProtocolScheduler';
import { motion, AnimatePresence } from 'framer-motion';
import { RESEARCH_AREAS } from '../../lib/compounds';
import { ShoppingCart, X, Sparkles, ArrowRight, Compass, Check } from 'lucide-react';
import type { Compound } from '@/lib/compounds';
import AutocompleteDropdown, { type Suggestion } from '../research/AutocompleteDropdown';

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

export interface ExcludedCompound {
  slug: string;
  displayName: string;
  reason: string;
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
  /** Caller notified when user starts typing or selects a goal */
  onSearchStarted?: (query?: string) => void;
  /** Caller notified when user clicks Already Know Which Peptide You Need */
  onAlreadyKnowClicked?: () => void;
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
  if (risk === 'low') return 'linear-gradient(90deg, #C0C5CE, #4FD1C5)';
  if (risk === 'moderate') return 'linear-gradient(90deg, #ED8936, #F6AD55)';
  if (risk === 'high') return 'linear-gradient(90deg, #E53E3E, #FC8181)';
  if (risk === 'critical') return 'linear-gradient(90deg, #9B2C2C, #F56565)';
  return '#A8B4C0';
};


// --------------------------------------------------------------------------
// Internal helpers
// --------------------------------------------------------------------------



const RESEARCH_AREA_LABELS: Record<string, string> = {
  weight_management:   'Weight Management\n& Fat Loss',
  metabolic:           'Metabolic',
  healing:             'Healing & Recovery',
  tissue_repair:       'Tissue Repair',
  longevity:           'Longevity',
  cosmetic:            'Skin & Hair',
  cognitive:           'Cognitive',
  sleep:               'Sleep',
  immune:              'Immune',
  hormonal:            'Hormonal Balance',
  gut_health:          'Gut Health',
  pain_inflammation:   'Pain & Inflammation',
  bone_joint:          'Joint & Bone Health',
  sexual_health:       'Sexual Health',
  cardiovascular:      'Cardiovascular',
  muscle_growth:       'Muscle Building',
};

function labelForArea(area: string): string {
  return RESEARCH_AREA_LABELS[area] || area.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function capitalizeEveryWord(str: string): string {
  if (!str) return '';
  return str.replace(/\b\w/g, char => char.toUpperCase());
}

/** Collect the unique research areas the agent's catalog actually covers. */
function deriveAvailableAreas(compoundsBySlug: Record<string, Compound>): string[] {
  const seen = new Set<string>();
  for (const c of Object.values(compoundsBySlug)) {
    for (const area of c.research_areas || []) {
      if (typeof area === 'string' && area.length > 0) {
        if (area === 'hormonal' || area === 'supply') continue;
        seen.add(area);
      }
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
  excluded,
  goalSummary,
  followUp,
  submitFollowUp,
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

  const handleShare = async () => {
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
      const data = await res.json();
      if (data.url) {
        await navigator.clipboard.writeText(window.location.origin + data.url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      }
    } catch (e) {
      console.error('Failed to share', e);
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
    <>
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
              {loading ? (
                <div style={{ padding: '64px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
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
              ) : followUp ? (
                <div style={{ padding: '32px 16px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ marginBottom: 24, padding: 20, background: 'rgba(192,197,206,0.1)', borderRadius: 16, border: '1px solid rgba(192,197,206,0.2)' }}>
                    <p style={{ color: '#C0C5CE', fontSize: '1.1rem', fontWeight: 600, lineHeight: 1.5 }}>
                      {followUp.question}
                    </p>
                  </div>
                    <div style={{ marginTop: 24, padding: 20, background: 'rgba(192,197,206,0.1)', borderRadius: 16, border: '1px solid rgba(192,197,206,0.2)' }}>
                      <p style={{ color: '#C0C5CE', fontSize: '1.1rem', fontWeight: 600, lineHeight: 1.5, textAlign: 'center' }}>
                        The AI needs more context to refine these results. Please restart the match process and provide more detail.
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
                    We couldn&apos;t find a protocol matching all of your strict constraints (e.g. Oral-Only, Low-Risk, WADA-Permitted).
                  </p>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button type="button" onClick={() => setFilterOralOnly(false)} style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.1)', color: '#FFF', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Drop Oral-Only</button>
                    <button type="button" onClick={() => setFilterHumanOnly(false)} style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.1)', color: '#FFF', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Drop Human-Only</button>
                    <button type="button" onClick={onClose} style={{ padding: '10px 16px', background: 'transparent', color: primaryColor, border: `1px solid ${primaryColor}`, borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Start Over</button>
                  </div>
                </div>
              ) : null}

              {/* Stack "Add Protocol to Cart" logic */}
              {!loading && stackItems.length > 1 && !filterOralOnly && !filterHumanOnly && (
                <div style={{ background: 'rgba(246,173,85,0.08)', border: '1px solid rgba(246,173,85,0.3)', borderRadius: 16, padding: '14px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ color: '#F6AD55', fontWeight: 800, fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Sparkles size={14} /> Recommended Protocol Stack</div>
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
                              background: 'rgba(192,197,206,0.14)', color: '#C0C5CE',
                              border: '1px solid rgba(192,197,206,0.35)', flexShrink: 0,
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
                          <button
                            type="button"
                            onClick={() => onAddToCart(r.product_id)}
                            style={{
                              background: '#C0C5CE', color: '#0A1018',
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
                        <span style={{ color: '#A8B4C0', fontSize: '0.85rem' }}>— {e.reason}</span>
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
                  onClick={handleShare}
                  style={{ flex: 1, padding: '14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#FFF', borderRadius: 8, fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  {shareCopied ? 'Copied Link!' : 'Share Protocol'}
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

// --------------------------------------------------------------------------
// GuidedDiscoveryWizard
// --------------------------------------------------------------------------

interface WizardState {
  area: string;             // research_area key
  preference: 'single' | 'stack' | 'either';
  comfort: 'strict_human_only' | 'investigational_ok' | 'preclinical_ok' | 'any';
  budget: 'conservative' | 'standard' | 'unlimited';
}

const DEFAULT_WIZARD: WizardState = {
  area: 'healing',
  preference: 'either',
  comfort: 'preclinical_ok',
  budget: 'standard',
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
      const timer = window.setTimeout(() => {
        setStep(0);
        setState(s => ({ ...s, area: availableAreas[0] || 'healing' }));
      }, 0);
      return () => window.clearTimeout(timer);
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

  const TOTAL_STEPS = 4;

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
              border: '6px solid #E2E8F0',
              boxSizing: 'border-box',
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
              <Compass size={18} aria-hidden style={{ color: '#C0C5CE' }} />
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
                    background: i <= step ? '#C0C5CE' : 'rgba(255,255,255,0.10)',
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
                              background: active ? 'rgba(192,197,206,0.2)' : 'rgba(255,255,255,0.05)',
                              border: active ? '1px solid #C0C5CE' : '1px solid rgba(255,255,255,0.14)',
                              color: active ? '#C0C5CE' : '#FFFFFF',
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
                              background: active ? 'rgba(192,197,206,0.15)' : 'rgba(255,255,255,0.04)',
                              border: active ? '1px solid #C0C5CE' : '1px solid rgba(255,255,255,0.12)',
                              color: '#FFFFFF',
                              cursor: 'pointer', minHeight: 56, transition: 'all 0.2s ease',
                            }}
                          >
                            <div style={{ fontWeight: 800, fontSize: '0.96rem', color: active ? '#C0C5CE' : '#FFF' }}>{o.label}</div>
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
                              background: active ? 'rgba(192,197,206,0.15)' : 'rgba(255,255,255,0.04)',
                              border: active ? '1px solid #C0C5CE' : '1px solid rgba(255,255,255,0.12)',
                              color: '#FFFFFF',
                              cursor: 'pointer', minHeight: 56, transition: 'all 0.2s ease',
                            }}
                          >
                            <div style={{ fontWeight: 800, fontSize: '0.96rem', color: active ? '#C0C5CE' : '#FFF' }}>{o.label}</div>
                            <div style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.82rem', marginTop: 2 }}>{o.sub}</div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div key="step-3" variants={variants} initial="initial" animate="animate" exit="exit" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 12 }}>
                      Step 4 of 4
                    </div>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', fontWeight: 800 }}>What is your budget appetite?</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        { v: 'conservative', label: 'Conservative', sub: 'Prioritize single, foundational compounds' },
                        { v: 'standard', label: 'Standard', sub: 'Balanced recommendations' },
                        { v: 'unlimited', label: 'Unlimited', sub: 'Show me the absolute best, regardless of price' },
                      ].map(o => {
                        const active = state.budget === o.v;
                        return (
                          <button
                            key={o.v}
                            type="button"
                            onClick={() => setState(s => ({ ...s, budget: o.v as 'conservative' | 'standard' | 'unlimited' }))}
                            style={{
                              textAlign: 'left',
                              padding: '14px 16px',
                              borderRadius: 12,
                              background: active ? 'rgba(192,197,206,0.15)' : 'rgba(255,255,255,0.04)',
                              border: active ? '1px solid #C0C5CE' : '1px solid rgba(255,255,255,0.12)',
                              color: '#FFFFFF',
                              cursor: 'pointer', minHeight: 56, transition: 'all 0.2s ease',
                            }}
                          >
                            <div style={{ fontWeight: 800, fontSize: '0.96rem', color: active ? '#C0C5CE' : '#FFF' }}>{o.label}</div>
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
                    background: '#C0C5CE', color: '#0A1018', border: 0,
                    fontWeight: 900, fontSize: '0.92rem',
                    padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    minHeight: 48,
                    boxShadow: '0 4px 12px rgba(192,197,206,0.3)',
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
                    background: '#C0C5CE', color: '#0A1018', border: 0,
                    fontWeight: 900, fontSize: '0.92rem',
                    padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                    minHeight: 48,
                    boxShadow: '0 4px 12px rgba(192,197,206,0.3)',
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
  onSearchStarted,
  onAlreadyKnowClicked,
}: DiscoveryHeroProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showAllAreas, setShowAllAreas] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MatchedProduct[]>([]);
  const [excluded, setExcluded] = useState<ExcludedCompound[]>([]);
  const [goalSummary, setGoalSummary] = useState('');
  const [followUp, setFollowUp] = useState<{ question: string; originalGoal: string } | null>(null);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const availableAreas = useMemo(() => deriveAvailableAreas(compoundsBySlug), [compoundsBySlug]);

  useEffect(() => {
    function onPointer(e: MouseEvent) {
      if (!searchContainerRef.current) return;
      if (!searchContainerRef.current.contains(e.target as Node)) {
        setSuggestOpen(false);
      }
    }
    window.addEventListener('mousedown', onPointer);
    return () => window.removeEventListener('mousedown', onPointer);
  }, []);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestions([]);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/research/suggest?q=${encodeURIComponent(trimmed)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.suggestions)) {
          setSuggestions(data.suggestions);
        }
      } catch {
        // swallow
      }
    }, 200);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query]);

  function onSuggestionSelect(s: Suggestion) {
    if (s.kind === 'compound') {
      const matched = resolveProducts([s.slug]);
      if (matched && matched[0] && matched[0].product_id) {
        onOpenProduct(matched[0].product_id);
        setSuggestOpen(false);
        return;
      }
      router.push(`/research/${s.slug}`);
      setSuggestOpen(false);
      return;
    }
    if (s.kind === 'area') {
      if (onSelectArea) {
        onSelectArea(s.slug);
        setSuggestOpen(false);
        return;
      }
      router.push(`/research/area/${s.slug}`);
      setSuggestOpen(false);
      return;
    }
    // For 'glossary', we can filter the storefront grid directly
    if (s.kind === 'glossary') {
      if (onSearchStarted) {
        onSearchStarted(s.display_name);
        setSuggestOpen(false);
        return;
      }
      router.push(`/research/search?q=${encodeURIComponent(s.display_name)}`);
      setSuggestOpen(false);
      return;
    }
    // default fallback
    setQuery(s.display_name);
    if (onSearchStarted) onSearchStarted(s.display_name);
  }

  const runMatch = useCallback(async (input: {
    goal: string;
    evidenceComfort?: 'strict_human_only' | 'investigational_ok' | 'preclinical_ok' | 'any';
    wadaConstraint?: 'wada_permitted_only' | 'no_constraint';
    riskTolerance?: 'low_only' | 'moderate_ok' | 'any';
    preference?: 'single' | 'stack' | 'either';
    budget?: 'conservative' | 'standard' | 'unlimited';
    excludeInjectables?: boolean;
    requireLongHalfLife?: boolean;
  }, summary: string) => {
    setLoading(true);
    setResults([]);
    setExcluded([]);
    setGoalSummary(summary);
    setDrawerOpen(true);
    setFollowUp(null);
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
            budget: input.budget || 'standard',
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
        excluded?: ExcludedCompound[];
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
      setExcluded(json?.excluded || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [resolveProducts]);

  const submitTypedGoal = useCallback(async (overrideGoal?: string) => {
    const g = (overrideGoal || query).trim();
    if (!g) return;
    
    setSuggestOpen(false);
    
    setLoading(true);
    setDrawerOpen(true);
    setGoalSummary(g);

    try {
      const res = await fetch('/api/research/ai-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: g })
      });
      const data = await res.json().catch(() => null);
      
      if (data?.result) {
        if (data.result.followUpQuestion) {
          setFollowUp({ question: data.result.followUpQuestion, originalGoal: g });
          setLoading(false);
          // Wait for user to answer
        } else {
          await runMatch(data.result, g);
        }
      } else {
        setDrawerOpen(false);
        setLoading(false);
      }
    } catch {
      setDrawerOpen(false);
      setLoading(false);
    }
  }, [query, runMatch]);

  const submitFollowUp = useCallback(async (answer: string) => {
    if (!followUp) return;
    const combined = `${followUp.originalGoal}. Clarification: ${answer}`;
    
    setLoading(true);
    setFollowUp(null);
    setGoalSummary(combined);

    try {
      const res = await fetch('/api/research/ai-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: combined })
      });
      const data = await res.json().catch(() => null);
      if (data?.result) {
        // If it asks ANOTHER follow-up, just force the match without it to prevent loops
        await runMatch(data.result, combined);
      } else {
        setDrawerOpen(false);
      }
    } catch {
      setDrawerOpen(false);
    } finally {
      setLoading(false);
    }
  }, [followUp, runMatch]);

  return (
    <>
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 980,
          margin: '0 auto 18px',
          aspectRatio: '941 / 1672',
          backgroundImage: 'url(/images/research/store-hero.png)',
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
            if (onAlreadyKnowClicked) onAlreadyKnowClicked();
          }}
          title="Match Me"
          style={{
            position: 'absolute', top: '85%', left: '15%', width: '33%', height: '8%',
            cursor: 'pointer', opacity: 0, zIndex: 10
          }}
          aria-label="Match Me"
        />

        {/* Let Us Guide You Button Overlay */}
        <button
          type="button"
          onClick={() => {
            if (onAlreadyKnowClicked) onAlreadyKnowClicked();
          }}
          title="Let Us Guide You"
          style={{
            position: 'absolute', top: '85%', left: '52%', width: '33%', height: '8%',
            cursor: 'pointer', opacity: 0, zIndex: 10
          }}
          aria-label="Let Us Guide You"
        />

        {/* Search Input Box */}
        <div 
          ref={searchContainerRef}
          style={{
            position: 'absolute', top: '12.5%', left: '6%', width: '88%', height: '5.5%',
            zIndex: 5,
          }}
        >
          <input
            id="discovery-search-input"
            type="text"
            value={query}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={suggestOpen}
            aria-haspopup="listbox"
            aria-controls="storefront-search-autocomplete"
            onChange={(e) => {
              setQuery(e.target.value);
              setSuggestOpen(true);
            }}
            onFocus={() => setSuggestOpen(true)}
            onKeyDown={(e) => { 
              if (e.key === 'Enter' && query.trim()) {
                e.preventDefault();
                onSelectArea(''); // Clear filter
                if (onSearchStarted) onSearchStarted(query.trim());
              }
            }}
            placeholder="Ask Us Anything..."
            style={{
              width: '100%', height: '100%',
              background: 'transparent',
              border: 'none', outline: 'none', color: '#FFFFFF',
              fontSize: 'max(16px, 1.86vw)',
              padding: '0 10px 12px 42px',
              textAlign: 'left',
              fontWeight: 500,
              letterSpacing: '0.02em',
            }}
          />
          {suggestOpen && query.trim().length >= 2 && suggestions.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: '4%', zIndex: 50, marginTop: '4px' }}>
              <AutocompleteDropdown
                id="storefront-search-autocomplete"
                suggestions={suggestions}
                recent={[]} // Storefront doesn't need recent searches history necessarily, but we provide empty array
                onSelect={onSuggestionSelect}
                onSelectRecent={(t) => { setQuery(t); if (onSearchStarted) onSearchStarted(t); }}
              />
            </div>
          )}
          {suggestOpen && query.trim().length === 0 && (
             <div style={{ position: 'absolute', top: '100%', left: 0, right: '4%', zIndex: 50, marginTop: '8px' }}>
                <div style={{ background: 'rgba(15, 20, 25, 0.98)', backdropFilter: 'blur(10px)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                  <h4 style={{ color: 'var(--grey-400)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                    <Sparkles size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Trending Searches
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                     {['BPC-157', 'Tirzepatide', 'Weight Loss', 'Tesamorelin', 'NAD+', 'GHK-Cu'].map(term => (
                        <button
                          key={term}
                          type="button"
                          onClick={() => {
                             setQuery(term);
                             setSuggestOpen(false);
                             if (onSearchStarted) onSearchStarted(term);
                          }}
                          style={{
                             background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                             color: 'var(--white)', padding: '6px 12px', borderRadius: '100px',
                             fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                             e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                          }}
                          onMouseLeave={(e) => {
                             e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                          }}
                        >
                           {term}
                        </button>
                     ))}
                  </div>
                </div>
             </div>
          )}
        </div>

        {/* Quick Select Buttons */}
        <button title="Weight Management" onClick={() => setShowAllAreas(true)} style={{ position: 'absolute', top: '23%', left: '5%', width: '21%', height: '18%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />
        <button title="Tissue Repair" onClick={() => setShowAllAreas(true)} style={{ position: 'absolute', top: '23%', left: '27%', width: '22%', height: '18%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />
        <button title="Healing & Recovery" onClick={() => setShowAllAreas(true)} style={{ position: 'absolute', top: '23%', left: '50%', width: '22%', height: '18%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />
        <button title="Performance" onClick={() => setShowAllAreas(true)} style={{ position: 'absolute', top: '23%', left: '73%', width: '22%', height: '18%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />
        <button title="Skin & Hair" onClick={() => setShowAllAreas(true)} style={{ position: 'absolute', top: '42%', left: '5%', width: '21%', height: '19%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />
        <button title="Cognitive" onClick={() => setShowAllAreas(true)} style={{ position: 'absolute', top: '42%', left: '27%', width: '22%', height: '19%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />
        <button title="Pain & Inflammation" onClick={() => setShowAllAreas(true)} style={{ position: 'absolute', top: '42%', left: '50%', width: '22%', height: '19%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />
        <button title="More" onClick={() => {
          setShowAllAreas(true);
        }} style={{ position: 'absolute', top: '42%', left: '73%', width: '22%', height: '19%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />

        {/* Already Know Which Peptide You Need */}
        <button
          type="button"
          onClick={() => {
            if (onAlreadyKnowClicked) onAlreadyKnowClicked();
          }}
          title="Already Know Which Peptide You Need"
          style={{ position: 'absolute', top: '64.5%', left: '3%', width: '94%', height: '12.5%', cursor: 'pointer', opacity: 0, zIndex: 10 }}
        />
        
        {/* Pop Up For All Areas */}
        {showAllAreas && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(5, 10, 15, 0.95)', backdropFilter: 'blur(12px)',
            zIndex: 50, display: 'flex', flexDirection: 'column', padding: 24,
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ color: '#FFF', fontSize: '1.4rem', fontWeight: 800 }}>{capitalizeEveryWord('Browse By Research Area')}</h3>
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
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    cursor: 'pointer',
                    padding: 0,
                    margin: 0,
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    transition: 'transform 0.2s ease, background 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    textAlign: 'left'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  }}
                >
                  <div style={{ width: '100%', aspectRatio: '1 / 1', position: 'relative' }}>
                    <img 
                      src={`/images/areas/${area}.png`} 
                      alt={labelForArea(area).replace('\n', ' ')} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </div>
                  
                  {/* Dynamic description underneath the image */}
                  <div style={{ padding: '12px', flex: 1, display: 'flex', alignItems: 'flex-start' }}>
                    <p style={{
                      margin: 0,
                      fontSize: '0.85rem',
                      color: 'var(--silver-light, #D0DAE4)',
                      lineHeight: 1.4,
                      fontWeight: 400
                    }}>
                      {capitalizeEveryWord(RESEARCH_AREAS[area]?.blurb || 'Explore Research Compounds In This Category.')}
                    </p>
                  </div>
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
            { goal, evidenceComfort: s.comfort, preference: s.preference, budget: s.budget },
            buildGoalFromWizard(s),
          );
        }}
      />

      <MatchResultsDrawer
        open={drawerOpen}
        loading={loading}
        results={results}
        excluded={excluded}
        goalSummary={goalSummary}
        followUp={followUp}
        submitFollowUp={submitFollowUp}
        primaryColor={primaryColor}
        onClose={() => setDrawerOpen(false)}
        onAddToCart={(id) => { setDrawerOpen(false); onAddToCart(id); }}
        onOpenProduct={(id) => { setDrawerOpen(false); onOpenProduct(id); }}
      />
      <style dangerouslySetInnerHTML={{ __html: `
        @media (min-width: 769px) {
          #discovery-search-input {
            font-size: calc(max(16px, 1.86vw) * 1.5) !important;
            padding: 14px 10px 0 76px !important;
          }
        }
      ` }} />
    </>
  );
}
