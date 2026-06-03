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

  if (!open) return null;

  const inCatalog = results.filter(r => r.in_stock);
  const outOfCatalog = results.filter(r => !r.in_stock);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Match Results"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 800,
        background: 'rgba(5, 10, 15, 0.78)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 760,
          background: '#0F1923',
          borderTopLeftRadius: 22, borderTopRightRadius: 22,
          maxHeight: 'calc(100dvh - 56px)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 -16px 40px rgba(0,0,0,0.55)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 18px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: `linear-gradient(135deg, ${primaryColor}22 0%, transparent 60%)`,
            borderTopLeftRadius: 22, borderTopRightRadius: 22,
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

        <div style={{ overflowY: 'auto', padding: '14px 16px 18px', flex: 1 }}>
          {loading && (
            <div style={{ padding: '32px 8px', textAlign: 'center', color: 'var(--silver, #A8B4C0)' }}>
              Scanning The Research Library...
            </div>
          )}

          {!loading && results.length === 0 && (
            <div style={{ padding: '32px 8px', textAlign: 'center', color: 'var(--silver, #A8B4C0)' }}>
              No Matches Yet. Try Describing The Research Goal In Different Words Or Tap A Suggested Chip.
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
                    borderRadius: 14, padding: 12,
                  }}
                >
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
                    </div>

                    <div style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.82rem', lineHeight: 1.4 }}>
                      <span style={{ color: 'var(--grey-400, #C8D2DD)', fontWeight: 700 }}>Why This Match: </span>
                      {r.rationale}
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
      </div>
    </div>
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
      setStep(0);
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

  if (!open) return null;

  const TOTAL_STEPS = 3;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Guided Discovery"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 850,
        background: 'rgba(5,10,15,0.82)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'max(16px, env(safe-area-inset-top, 0px)) 16px max(16px, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560,
          background: '#0F1923', color: '#FFFFFF',
          borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 20px 48px rgba(0,0,0,0.55)',
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
              }}
            />
          ))}
        </div>

        <div style={{ padding: '14px 18px 18px', flex: 1, overflowY: 'auto' }}>
          {step === 0 && (
            <div>
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
                        background: active ? '#00C4BC' : 'rgba(255,255,255,0.05)',
                        border: active ? '1px solid #00C4BC' : '1px solid rgba(255,255,255,0.14)',
                        color: active ? '#0A1018' : '#FFFFFF',
                        fontWeight: 700, fontSize: '0.86rem',
                        cursor: 'pointer', minHeight: 44,
                      }}
                    >
                      {labelForArea(area)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
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
                        background: active ? 'rgba(0,196,188,0.10)' : 'rgba(255,255,255,0.04)',
                        border: active ? '1px solid #00C4BC' : '1px solid rgba(255,255,255,0.12)',
                        color: '#FFFFFF',
                        cursor: 'pointer', minHeight: 56,
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: '0.96rem' }}>{o.label}</div>
                      <div style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.82rem', marginTop: 2 }}>{o.sub}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
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
                        background: active ? 'rgba(0,196,188,0.10)' : 'rgba(255,255,255,0.04)',
                        border: active ? '1px solid #00C4BC' : '1px solid rgba(255,255,255,0.12)',
                        color: '#FFFFFF',
                        cursor: 'pointer', minHeight: 56,
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: '0.96rem' }}>{o.label}</div>
                      <div style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.82rem', marginTop: 2 }}>{o.sub}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
              }}
            >
              Reveal Top Matches
            </button>
          )}
        </div>
      </div>
    </div>
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
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MatchedProduct[]>([]);
  const [goalSummary, setGoalSummary] = useState('');

  const availableAreas = useMemo(() => deriveAvailableAreas(compoundsBySlug), [compoundsBySlug]);

  const runMatch = useCallback(async (input: {
    goal: string;
    evidenceComfort?: 'strict_human_only' | 'investigational_ok' | 'preclinical_ok' | 'any';
    wadaConstraint?: 'wada_permitted_only' | 'no_constraint';
    riskTolerance?: 'low_only' | 'moderate_ok' | 'any';
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
          },
        }),
      });
      const json = await res.json().catch(() => null) as {
        results?: Array<{ slug: string; rationale?: string }>;
      } | null;
      const slugs = (json?.results || []).map(r => r.slug).filter(Boolean);
      const rationales = new Map((json?.results || []).map(r => [r.slug, r.rationale || '']));
      const products = resolveProducts(slugs);
      // Attach rationale by slug when available.
      const stitched = products.map(p => ({
        ...p,
        rationale: p.compound_slug && rationales.get(p.compound_slug)
          ? (rationales.get(p.compound_slug) as string)
          : p.rationale,
      }));
      setResults(stitched);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [resolveProducts]);

  const submitTypedGoal = useCallback(() => {
    const g = query.trim();
    if (!g) return;
    void runMatch({ goal: g }, g);
  }, [query, runMatch]);

  return (
    <>
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 1024,
          margin: '0 auto 18px',
          aspectRatio: '1024 / 582',
          backgroundImage: 'url(/images/store_discovery_hero.png)',
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
          onClick={submitTypedGoal}
          disabled={!query.trim()}
          title="Match Me"
          style={{
            position: 'absolute', top: '15%', left: '52%', width: '19%', height: '12%',
            cursor: query.trim() ? 'pointer' : 'not-allowed', opacity: 0, zIndex: 10
          }}
          aria-label="Match Me"
        />

        {/* Let Us Guide You Button Overlay */}
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          title="Let Us Guide You"
          style={{
            position: 'absolute', top: '15%', left: '72%', width: '21%', height: '12%',
            cursor: 'pointer', opacity: 0, zIndex: 10
          }}
          aria-label="Let Us Guide You"
        />

        {/* Search Input Box */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submitTypedGoal(); }}
          placeholder="What Are You Trying To Research Today?"
          style={{
            position: 'absolute', top: '38%', left: '13%', width: '77%', height: '11%',
            background: '#041322',
            border: 'none', outline: 'none', color: '#FFFFFF',
            fontSize: 'max(14px, 1.3vw)',
            padding: '0 8px',
            zIndex: 5,
            fontWeight: 500,
            letterSpacing: '0.02em',
          }}
        />

        {/* Quick Select Buttons */}
        <button title="Recovery" onClick={() => { setQuery('Recovery'); void runMatch({ goal: 'Recovery' }, 'Recovery'); }} style={{ position: 'absolute', top: '64%', left: '3%', width: '10%', height: '22%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />
        <button title="Weight Management" onClick={() => { setQuery('Weight Management'); void runMatch({ goal: 'Weight Management' }, 'Weight Management'); }} style={{ position: 'absolute', top: '64%', left: '14.5%', width: '10%', height: '22%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />
        <button title="Sleep" onClick={() => { setQuery('Sleep'); void runMatch({ goal: 'Sleep' }, 'Sleep'); }} style={{ position: 'absolute', top: '64%', left: '26%', width: '10%', height: '22%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />
        <button title="Cognitive" onClick={() => { setQuery('Cognitive'); void runMatch({ goal: 'Cognitive' }, 'Cognitive'); }} style={{ position: 'absolute', top: '64%', left: '38%', width: '10%', height: '22%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />
        <button title="Immune" onClick={() => { setQuery('Immune'); void runMatch({ goal: 'Immune' }, 'Immune'); }} style={{ position: 'absolute', top: '64%', left: '49.5%', width: '10%', height: '22%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />
        <button title="Metabolic" onClick={() => { setQuery('Metabolic'); void runMatch({ goal: 'Metabolic' }, 'Metabolic'); }} style={{ position: 'absolute', top: '64%', left: '61.5%', width: '10%', height: '22%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />
        <button title="Longevity" onClick={() => { setQuery('Longevity'); void runMatch({ goal: 'Longevity' }, 'Longevity'); }} style={{ position: 'absolute', top: '64%', left: '73.5%', width: '10%', height: '22%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />
        <button title="More" onClick={() => { document.querySelector('.sf-toolbar')?.scrollIntoView({ behavior: 'smooth' }); }} style={{ position: 'absolute', top: '64%', left: '85.5%', width: '10%', height: '22%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />
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
            { goal, evidenceComfort: s.comfort },
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
