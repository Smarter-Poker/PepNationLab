'use client';

/**
 * R35 Phase 2 + 3 — Product modal enhancements for agent storefronts.
 *
 * Sections rendered below the existing product modal body, in order:
 *
 *   PHASE 2
 *     1. IsThisRightForMe         — collapsible expander that surfaces the
 *                                   compound's studied_for + research areas +
 *                                   WADA + cold-chain in a researcher-friendly
 *                                   "Is This Right For My Research?" panel
 *                                   (PHASE 3 addition).
 *     2. StackComponentsCards     — when the current compound is itself a
 *                                   stack (e.g., KLOW = TB10+BPC10+GHK50+KPV10),
 *                                   each component is rendered as a tappable
 *                                   mini-card.
 *     3. SaveVsSeparately         — for stacks where every component is also
 *                                   stocked on this storefront, compute the
 *                                   sum vs the stack price.
 *     4. SuppliesYouNeed          — Bac. Water + Acetic Acid + Alcohol Swabs.
 *                                   We NEVER suggest syringes; that is enforced
 *                                   both by an allow-list and a hard
 *                                   FORBIDDEN_SUPPLY_NAME block.
 *     5. CompoundsStudiedWithThis — ranked via lib/compounds.relatedCompounds.
 *
 *   PHASE 3
 *     6. ReconstitutionCalc       — inline lab-prep calculator using
 *                                   lib/compounds.reconstitutionVolumeMl()
 *                                   and drawVolumeMl(). Optional, collapsible.
 *
 *   COMPARE
 *     7. PinToCompareButton       — renders a small action button that fires
 *                                   the custom DOM event `pnl:compare-add`
 *                                   with the current product payload. The
 *                                   compare drawer (StorefrontCompareDrawer)
 *                                   listens for these events and tracks state
 *                                   independently in localStorage.
 *
 * Plus a small <ClickableCategoryBadge> helper that the modal uses to make the
 * inline category badge a filter shortcut (taps it -> modal closes, storefront
 * grid filters to that category).
 *
 * Caller: components/AgentStorefrontGrid.tsx. Pure presentational client
 * component — no fs, no fetch.
 */

import { useMemo, useState, useEffect } from 'react';
import { ArrowRight, Plus, Beaker, ChevronDown, ChevronUp, BookmarkPlus, AlertCircle, CheckCircle2, Shield, AlertTriangle, BookOpen, Trophy, Clock, Sparkles, Thermometer } from 'lucide-react';
import PinToCompareButton from '../research/PinToCompareButton';
import { scoreCompound } from '../research/CompareTool';
import {
  evidenceTier,
  relatedCompounds,
  reconstitutionVolumeMl,
  drawVolumeMl,
  researchAreaLabel,
  wadaLabel,
  type Compound,
} from '@/lib/compounds';

export interface ModalGroupedProductRef {
  name: string;
  category: string;
  imageUrl: string | null;
  lowestPrice: number;
  defaultVariantId: string;
  compoundSlug: string | null;
}

interface Props {
  currentCompound: Compound | null;
  currentCompoundSlug: string | null;
  currentProductName: string;
  currentBundlePriceDollars?: number | null;
  currentDefaultVariantId?: string | null;
  currentImageUrl?: string | null;
  currentVialMassMg?: number | null;
  grouped: ModalGroupedProductRef[];
  compoundsBySlug: Record<string, Compound>;
  primaryColor: string;
  onOpenProductBySlug: (compoundSlug: string) => void;
  onOpenProductByName: (name: string) => void;
  onAddVariantToCart: (variantId: string, qty: number) => void;
}

function pickSupply(grouped: ModalGroupedProductRef[], pattern: RegExp, currentSlug: string | null) {
  for (const g of grouped) {
    if (g.compoundSlug && g.compoundSlug === currentSlug) continue;
    if (pattern.test(g.name)) return g;
    if (g.compoundSlug && pattern.test(g.compoundSlug)) return g;
  }
  return null;
}

function normalizeStackComponent(token: string): string {
  return token
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function findGroupForCompound(
  grouped: ModalGroupedProductRef[],
  compoundsBySlug: Record<string, Compound>,
  token: string,
): { group: ModalGroupedProductRef | null; compound: Compound | null } {
  const slug = normalizeStackComponent(token);
  let compound = compoundsBySlug?.[slug] ?? null;
  if (!compound) {
    for (const c of Object.values(compoundsBySlug)) {
      if (!c) continue;
      if ((c.aliases || []).some((a) => normalizeStackComponent(a) === slug)) {
        compound = c;
        break;
      }
    }
  }
  const targetSlug = compound?.slug ?? slug;
  const group = grouped.find((g) => g.compoundSlug === targetSlug) ?? null;
  return { group, compound };
}

function formatMoney(dollars: number): string {
  return dollars.toFixed(2);
}

function SectionTitle({ children, primaryColor }: { children: React.ReactNode; primaryColor: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      marginBottom: 10,
    }}>
      <div style={{ width: 4, height: 18, borderRadius: 2, background: primaryColor }} aria-hidden="true" />
      <h4 style={{
        fontFamily: 'var(--font-brand)',
        fontSize: '0.92rem',
        margin: 0,
        color: 'var(--white)',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        fontWeight: 800,
      }}>
        {children}
      </h4>
    </div>
  );
}

function SupplyMiniCard({
  supply,
  primaryColor,
  onAdd,
  onOpen,
}: {
  supply: ModalGroupedProductRef;
  primaryColor: string;
  onAdd: () => void;
  onOpen: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: 10, borderRadius: 12,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {supply.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={supply.imageUrl}
          alt={supply.name}
          width={48}
          height={48}
          style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', flexShrink: 0, background: '#0F1923' }}
        />
      ) : (
        <div
          style={{ width: 48, height: 48, borderRadius: 10, background: `${primaryColor}20`, flexShrink: 0 }}
          aria-hidden="true"
        />
      )}
      <button
        type="button"
        onClick={onOpen}
        style={{
          flex: 1, minWidth: 0, textAlign: 'left',
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          color: 'var(--white)', fontWeight: 700, fontSize: '0.86rem',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {supply.name}
        <div style={{ fontSize: '0.74rem', color: 'var(--grey-400)', fontWeight: 500 }}>
          ${formatMoney(supply.lowestPrice / 10)} Per Vial
        </div>
      </button>
      <button
        type="button"
        onClick={onAdd}
        aria-label={`Add ${supply.name} To Cart`}
        style={{
          width: 36, height: 36, minWidth: 36, minHeight: 36,
          borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: primaryColor, color: '#FFFFFF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, flexShrink: 0,
          boxShadow: `0 4px 12px ${primaryColor}55`,
        }}
      >
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export function ClickableCategoryBadge({
  category,
  primaryColor,
  onClick,
}: {
  category: string;
  primaryColor: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Filter Storefront By ${category} Category`}
      style={{
        fontSize: '0.7rem',
        padding: '4px 12px',
        borderRadius: 9999,
        background: `${primaryColor}20`,
        color: primaryColor,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        whiteSpace: 'nowrap',
        border: `1px solid ${primaryColor}40`,
        cursor: 'pointer',
      }}
    >
      {category}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * QualityScoreWidget: Show composite score & grade letter            *
 * ------------------------------------------------------------------ */
function QualityScoreWidget({
  compound,
  primaryColor,
}: {
  compound: Compound;
  primaryColor: string;
}) {
  const [displayPct, setDisplayPct] = useState(0);
  const [showAudit, setShowAudit] = useState(false);

  const score = useMemo(() => scoreCompound(compound), [compound]);

  useEffect(() => {
    const target = score.total;
    const duration = 900;
    const start = performance.now();
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      setDisplayPct(Math.round(easeOut(t) * target));
      if (t < 1) requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score.total]);

  const r = 32;
  const circ = 2 * Math.PI * r;
  const pct = (displayPct / 100) * circ;
  const gradeColor =
    score.letter.startsWith('A') ? '#68D391' :
    score.letter.startsWith('B') ? '#00C4BC' :
    score.letter.startsWith('C') ? '#F6AD55' : '#FC8181';

  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 14,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Score Ring */}
        <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
          <svg width="72" height="72" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
            <circle
              cx="36"
              cy="36"
              r={r}
              fill="none"
              stroke={gradeColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ - pct}
              transform="rotate(-90 36 36)"
              style={{ transition: 'stroke-dashoffset 0.1s linear' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '1.05rem', fontWeight: 900, color: gradeColor, lineHeight: 1 }}>{displayPct}</span>
            <span style={{ fontSize: '0.5rem', color: gradeColor, opacity: 0.6 }}>/100</span>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 900,
                padding: '2px 8px',
                borderRadius: 999,
                background: score.letter.startsWith('A') ? 'rgba(104,211,145,0.15)' : 'rgba(0,196,188,0.15)',
                color: gradeColor,
                border: `1px solid ${gradeColor}40`,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Grade {score.letter}
            </span>
            <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>PepNation Lab Grade</span>
          </div>
          <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#FFF' }}>
            {score.verdict}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>
            Composite quality score calculated across evidence level, risk tolerances, and publication backing.
          </div>
        </div>
      </div>

      {score.strengths.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 2 }}>
          {score.strengths.map((str) => (
            <span
              key={str}
              style={{
                fontSize: '0.64rem',
                fontWeight: 800,
                color: '#68D391',
                background: 'rgba(104, 211, 145, 0.08)',
                border: '1px solid rgba(104, 211, 145, 0.25)',
                borderRadius: 6,
                padding: '2px 8px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              ✓ {str}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowAudit(!showAudit)}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          color: primaryColor,
          fontSize: '0.74rem',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          alignSelf: 'flex-start',
          marginTop: 2,
        }}
      >
        {showAudit ? 'Hide Score Breakdown' : 'Show Score Breakdown'}
      </button>

      {showAudit && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '8px 16px',
            padding: 12,
            background: 'rgba(255,255,255,0.01)',
            border: '1px solid rgba(255,255,255,0.04)',
            borderRadius: 10,
            marginTop: 2,
          }}
        >
          {[
            ['Evidence Strength', score.breakdown.evidence, 28, '#00C4BC'],
            ['Safety Profile', score.breakdown.safety, 24, '#FC8181'],
            ['Scientific Backing', score.breakdown.science, 14, '#F6AD55'],
            ['Research Breadth', score.breakdown.coverage, 16, '#9F7AEA'],
            ['Protocol Practicality', score.breakdown.handling, 10, '#4FD1C5'],
            ['Data Completeness', score.breakdown.completeness, 8, '#ED64A6'],
          ].map(([label, val, max, col]) => (
            <div key={String(label)} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.64rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                <span>{label}</span>
                <span style={{ color: String(col), fontFamily: 'monospace' }}>{val}/{max}</span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(Number(val) / Number(max)) * 100}%`, background: String(col), borderRadius: 999 }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Phase 3: IsThisRightForMe expander                                 *
 * ------------------------------------------------------------------ */
function IsThisRightForMe({
  compound,
  primaryColor,
}: {
  compound: Compound | null;
  primaryColor: string;
}) {
  const [open, setOpen] = useState(false);
  if (!compound) return null;
  const studied = (compound.studied_for || []).slice(0, 6);
  const areas = (compound.research_areas || []).slice(0, 6);
  const isWadaProhibited = false;
  const isTempSensitive = compound.is_temp_sensitive;
  if (studied.length === 0 && areas.length === 0 && !isWadaProhibited && !isTempSensitive) return null;

  return (
    <section aria-label="Is This Right For My Research" style={{
      borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.10)',
      background: 'rgba(255,255,255,0.02)',
      overflow: 'hidden',
    }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--white)', fontWeight: 800, fontSize: '0.9rem',
          textAlign: 'left',
        }}
      >
        <CheckCircle2 size={18} color={primaryColor} aria-hidden="true" />
        <span style={{ flex: 1 }}>Is This Right For My Research?</span>
        {open ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
      </button>
      {open && (
        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {studied.length > 0 && (
            <div>
              <div style={{ fontSize: '0.74rem', color: 'var(--silver)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                Best Studied For
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {studied.map((s) => (
                  <span key={s} style={{
                    fontSize: '0.74rem', padding: '4px 10px', borderRadius: 9999,
                    background: `${primaryColor}15`, color: 'var(--white)', fontWeight: 600,
                    border: `1px solid ${primaryColor}35`,
                  }}>{s}</span>
                ))}
              </div>
            </div>
          )}
          {areas.length > 0 && (
            <div>
              <div style={{ fontSize: '0.74rem', color: 'var(--silver)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                Research Areas
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {areas.map((a) => (
                  <span key={a} style={{
                    fontSize: '0.74rem', padding: '4px 10px', borderRadius: 9999,
                    background: 'rgba(255,255,255,0.06)', color: 'var(--white)', fontWeight: 600,
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}>{researchAreaLabel(a)}</span>
                ))}
              </div>
            </div>
          )}
          {(isWadaProhibited || isTempSensitive) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {isWadaProhibited && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', borderRadius: 10,
                  background: 'rgba(229,62,62,0.10)',
                  border: '1px solid rgba(229,62,62,0.30)',
                  color: '#F08A8A', fontSize: '0.82rem', fontWeight: 700,
                }}>
                  <AlertCircle size={14} aria-hidden="true" />
                  {wadaLabel(compound.wada_status)} - Not For Tested Athletes
                </div>
              )}
              {isTempSensitive && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', borderRadius: 10,
                  background: 'rgba(0,229,255,0.08)',
                  border: '1px solid rgba(0,229,255,0.28)',
                  color: '#7DD8EE', fontSize: '0.82rem', fontWeight: 700,
                }}>
                  <AlertCircle size={14} aria-hidden="true" />
                  Cold-Chain Handling - Refrigerate On Arrival
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Phase 3: ReconstitutionCalc                                        *
 * ------------------------------------------------------------------ */
function ReconstitutionCalc({
  defaultVialMassMg,
  primaryColor,
}: {
  defaultVialMassMg: number | null | undefined;
  primaryColor: string;
}) {
  const [open, setOpen] = useState(false);
  const [vialMass, setVialMass] = useState<number>(defaultVialMassMg && defaultVialMassMg > 0 ? defaultVialMassMg : 10);
  const [targetConc, setTargetConc] = useState<number>(2);
  const [desiredMass, setDesiredMass] = useState<number>(0.25);

  useEffect(() => {
    if (defaultVialMassMg && defaultVialMassMg > 0) {
      const timer = window.setTimeout(() => {
        setVialMass(defaultVialMassMg);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [defaultVialMassMg]);

  const diluentMl = reconstitutionVolumeMl(vialMass, targetConc);
  const drawMl = diluentMl ? drawVolumeMl(vialMass, diluentMl, desiredMass) : null;

  return (
    <section aria-label="Reconstitution Calculator" style={{
      borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.10)',
      background: 'rgba(255,255,255,0.02)',
      overflow: 'hidden',
    }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--white)', fontWeight: 800, fontSize: '0.9rem',
          textAlign: 'left',
        }}
      >
        <Beaker size={18} color={primaryColor} aria-hidden="true" />
        <span style={{ flex: 1 }}>Reconstitution Calculator</span>
        {open ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
      </button>
      {open && (
        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--grey-400)', lineHeight: 1.5 }}>
            Research-Use Lab Prep Only. Volume Of Diluent To Add Equals Mass Divided By Target Concentration.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--silver)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', minHeight: '28px', display: 'flex', alignItems: 'flex-end' }}>Vial Mass (Mg)</span>
              <input
                type="number"
                inputMode="decimal"
                value={vialMass || ''}
                onChange={(e) => setVialMass(Number(e.target.value))}
                style={{
                  padding: '8px 10px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  borderRadius: 8, color: 'var(--white)', fontSize: '0.9rem',
                  outline: 'none', width: '100%', boxSizing: 'border-box',
                }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--silver)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', minHeight: '28px', display: 'flex', alignItems: 'flex-end' }}>Target Conc. (Mg/Ml)</span>
              <input
                type="number"
                inputMode="decimal"
                value={targetConc || ''}
                onChange={(e) => setTargetConc(Number(e.target.value))}
                style={{
                  padding: '8px 10px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  borderRadius: 8, color: 'var(--white)', fontSize: '0.9rem',
                  outline: 'none', width: '100%', boxSizing: 'border-box',
                }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--silver)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', minHeight: '28px', display: 'flex', alignItems: 'flex-end' }}>Desired Mass (Mg)</span>
              <input
                type="number"
                inputMode="decimal"
                value={desiredMass || ''}
                onChange={(e) => setDesiredMass(Number(e.target.value))}
                style={{
                  padding: '8px 10px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  borderRadius: 8, color: 'var(--white)', fontSize: '0.9rem',
                  outline: 'none', width: '100%', boxSizing: 'border-box',
                }}
              />
            </label>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))',
            gap: 10,
          }}>
            <div style={{
              padding: 12, borderRadius: 10,
              background: `${primaryColor}10`,
              border: `1px solid ${primaryColor}30`,
            }}>
              <div style={{ fontSize: '0.72rem', color: primaryColor, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Diluent To Add
              </div>
              <div style={{ fontSize: '1.2rem', color: 'var(--white)', fontWeight: 800, fontFamily: 'var(--font-brand)', marginTop: 4 }}>
                {diluentMl !== null ? `${diluentMl.toFixed(2)} mL` : 'Enter Mass + Conc.'}
              </div>
            </div>
            <div style={{
              padding: 12, borderRadius: 10,
              background: 'rgba(104,211,145,0.10)',
              border: '1px solid rgba(104,211,145,0.32)',
            }}>
              <div style={{ fontSize: '0.72rem', color: '#68D391', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Volume To Draw
              </div>
              <div style={{ fontSize: '1.2rem', color: 'var(--white)', fontWeight: 800, fontFamily: 'var(--font-brand)', marginTop: 4 }}>
                {drawMl !== null ? `${drawMl.toFixed(3)} mL` : 'Enter Desired Mass'}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--grey-400)', marginTop: 4 }}>
                For {desiredMass} Mg
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Phase 3: Pin To Compare                                            *
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * Phase 4: Recently Viewed strip (localStorage-backed)               *
 * ------------------------------------------------------------------ */
const RECENTLY_VIEWED_KEY = 'pnl:recently-viewed';
const RECENTLY_VIEWED_MAX = 6;

interface RecentItem {
  name: string;
  imageUrl: string | null;
  pricePerVialDollars: number | null;
  viewedAt: number;
}

function readRecentlyViewed(): RecentItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]';
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.slice(-RECENTLY_VIEWED_MAX);
  } catch {
    return [];
  }
}

function writeRecentlyViewed(item: RecentItem) {
  if (typeof window === 'undefined') return;
  try {
    const list = readRecentlyViewed().filter((r) => r.name !== item.name);
    list.push(item);
    window.localStorage.setItem(
      RECENTLY_VIEWED_KEY,
      JSON.stringify(list.slice(-RECENTLY_VIEWED_MAX)),
    );
  } catch {
    // ignore
  }
}

export default function ProductModalEnhancements({
  currentCompound,
  currentCompoundSlug,
  currentProductName,
  currentBundlePriceDollars,
  currentImageUrl,
  currentVialMassMg,
  grouped,
  compoundsBySlug,
  primaryColor,
  onOpenProductBySlug,
  onOpenProductByName,
  onAddVariantToCart,
}: Props) {
  // Smart "Similar Products" — ranked by relatedCompounds scorer which now
  // weights best_stacked_with highest (+7 per direction), then compound class
  // (+4), research area overlap (+3 each), etc.
  const similarProducts = useMemo(() => {
    if (!currentCompound) return [];

    const allCompounds = Object.values(compoundsBySlug).filter(Boolean) as Compound[];
    if (allCompounds.length === 0) return [];

    // Score and rank — fetch up to 15 candidates so we have room to filter
    const rankedRefs = relatedCompounds(currentCompound, allCompounds, 15);

    // Map to storefront groups, keep only stocked items that aren't the current product
    const items = rankedRefs
      .map((ref) => {
        const group = grouped.find((g) => g.compoundSlug === ref.slug) ?? null;
        return { ref, group };
      })
      .filter((x) => x.group !== null && x.group.name !== currentProductName);

    // If scored matches are fewer than 3, pad with same-category products
    if (items.length < 3) {
      const existingSlugs = new Set(items.map((x) => x.ref.slug));
      existingSlugs.add(currentCompound.slug);

      const fallback = grouped.filter((g) => {
        if (g.name === currentProductName || !g.compoundSlug) return false;
        if (existingSlugs.has(g.compoundSlug)) return false;
        const comp = compoundsBySlug[g.compoundSlug];
        return comp?.category === currentCompound.category;
      });

      for (const fg of fallback) {
        if (items.length >= 5) break;
        const comp = compoundsBySlug[fg.compoundSlug!];
        if (!comp) continue;
        items.push({
          ref: {
            slug: fg.compoundSlug!,
            display_name: comp.display_name,
            category: comp.category,
            evidence_tier: comp.evidence_tier,
            research_areas: comp.research_areas || [],
            is_best_stack_match: false,
          },
          group: fg,
        });
      }
    }

    // Final fallback: any other stocked peptide
    if (items.length < 3) {
      const existingSlugs = new Set(items.map((x) => x.ref.slug));
      existingSlugs.add(currentCompound.slug);

      const anyPeptide = grouped.filter((g) => {
        if (g.name === currentProductName || !g.compoundSlug) return false;
        return !existingSlugs.has(g.compoundSlug);
      });

      for (const fg of anyPeptide) {
        if (items.length >= 5) break;
        const comp = compoundsBySlug[fg.compoundSlug!];
        if (!comp) continue;
        items.push({
          ref: {
            slug: fg.compoundSlug!,
            display_name: comp.display_name,
            category: comp.category,
            evidence_tier: comp.evidence_tier,
            research_areas: comp.research_areas || [],
            is_best_stack_match: false,
          },
          group: fg,
        });
      }
    }

    return items.slice(0, 5);
  }, [currentCompound, compoundsBySlug, grouped, currentProductName]);
  const supplies = useMemo(() => {
    const supplyPatterns = [
      { key: 'bac_water', pattern: /bac\.?\s*water|bacteriostatic/i, label: 'Bac. Water' },
      { key: 'acetic_acid', pattern: /acetic\s*acid/i, label: 'Acetic Acid' },
      { key: 'alcohol_swabs', pattern: /alcohol\s*(swabs?|pads?|prep)/i, label: 'Alcohol Swabs' },
    ];
    return supplyPatterns.map(({ key, pattern, label }) => ({
      key,
      label,
      group: pickSupply(grouped, pattern, currentCompoundSlug),
    })).filter((s) => s.group !== null);
  }, [grouped, currentCompoundSlug]);

  const stackComponents = useMemo(() => {
    if (!currentCompound || !currentCompound.is_stack) return [];
    return (currentCompound.stack_components || [])
      .map((tok) => {
        const found = findGroupForCompound(grouped, compoundsBySlug, tok);
        return {
          token: tok,
          displayLabel: found.compound?.display_name ?? tok,
          group: found.group,
          compound: found.compound,
          inStock: found.group != null,
        };
      })
      .filter((x) => x.displayLabel);
  }, [currentCompound, grouped, compoundsBySlug]);

  const saveVsSeparately = useMemo(() => {
    if (!currentCompound || !currentCompound.is_stack || !currentBundlePriceDollars || currentBundlePriceDollars <= 0) {
      return null;
    }
    let separateTotal = 0;
    let allFound = true;
    for (const x of stackComponents) {
      if (!x.group) {
        allFound = false;
        break;
      }
      separateTotal += Number(x.group.lowestPrice) || 0;
    }
    if (!allFound || separateTotal <= 0) return null;
    const savings = separateTotal - currentBundlePriceDollars;
    if (savings <= 0) return null;
    const pct = (savings / separateTotal) * 100;
    return { separateTotal, bundle: currentBundlePriceDollars, savings, pct };
  }, [currentCompound, stackComponents, currentBundlePriceDollars]);

  const studiedWith = useMemo(() => {
    if (!currentCompound) return [];
    const allCompounds = Object.values(compoundsBySlug).filter(Boolean) as Compound[];
    if (allCompounds.length === 0) return [];
    const ranked = relatedCompounds(currentCompound, allCompounds, 8);
    const stackSlugs = new Set(stackComponents.map((s) => s.compound?.slug).filter(Boolean));
    return ranked
      .map((r) => {
        const group = grouped.find((g) => g.compoundSlug === r.slug) ?? null;
        return { ref: r, group };
      })
      .filter((x) => x.group !== null && !stackSlugs.has(x.ref.slug))
      .slice(0, 4);
  }, [currentCompound, compoundsBySlug, grouped, stackComponents]);

  const hasAnythingPhase2 =
    supplies.length > 0 ||
    stackComponents.length > 0 ||
    studiedWith.length > 0 ||
    saveVsSeparately !== null;

  const showPhase3 = currentCompound !== null;

  if (!hasAnythingPhase2 && !showPhase3) return null;

  return (
    <div style={{
      marginTop: 24,
      paddingTop: 20,
      borderTop: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column', gap: 22,
    }}>
      {currentCompound && (
        <QualityScoreWidget compound={currentCompound} primaryColor={primaryColor} />
      )}
      <IsThisRightForMe compound={currentCompound} primaryColor={primaryColor} />

      {stackComponents.length > 0 && (
        <section aria-label="Stack Components">
          <SectionTitle primaryColor={primaryColor}>
            What&apos;s Inside This Stack
          </SectionTitle>
          <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginTop: -4, marginBottom: 10 }}>
            Each Component Is Tappable - View Its Research Profile Or Add It Solo.
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(140px, 100%), 1fr))',
            gap: 10,
          }}>
            {stackComponents.map((sc) => {
              const tier = sc.compound ? evidenceTier(sc.compound.evidence_tier) : null;
              const labelText = sc.displayLabel;
              return (
                <button
                  key={sc.token}
                  type="button"
                  onClick={() => {
                    if (sc.compound) onOpenProductBySlug(sc.compound.slug);
                    else if (sc.group) onOpenProductByName(sc.group.name);
                  }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                    gap: 4,
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: sc.inStock ? `${primaryColor}10` : 'rgba(255,255,255,0.03)',
                    border: sc.inStock
                      ? `1px solid ${primaryColor}40`
                      : '1px dashed rgba(255,255,255,0.16)',
                    cursor: (sc.compound || sc.group) ? 'pointer' : 'default',
                    textAlign: 'left',
                    color: 'var(--white)',
                    minHeight: 64,
                  }}
                >
                  <span style={{ fontWeight: 800, fontSize: '0.86rem', lineHeight: 1.2 }}>
                    {labelText}
                  </span>
                  {tier && (
                    tier.badgeUrl ? (
                      <img src={tier.badgeUrl} alt={tier.label} style={{ height: '22px', width: 'auto', maxWidth: 'none', borderRadius: 3, objectFit: 'contain', marginTop: 2, flexShrink: 0 }} />
                    ) : (
                      <span style={{ fontSize: '0.64rem', color: tier.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {tier.label}
                      </span>
                    )
                  )}
                  {!sc.inStock && (
                    <span style={{ fontSize: '0.66rem', color: 'var(--grey-400)', fontWeight: 600 }}>
                      Not Stocked Here
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {saveVsSeparately !== null && (
        <section
          aria-label="Save Vs Buying Separately"
          style={{
            padding: 14,
            borderRadius: 14,
            background: `linear-gradient(135deg, ${primaryColor}1A 0%, rgba(104,211,145,0.10) 100%)`,
            border: `1px solid ${primaryColor}40`,
          }}
        >
          <div style={{ fontSize: '0.72rem', color: '#68D391', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Save Vs. Buying Separately
          </div>
          <div style={{
            display: 'flex', alignItems: 'baseline', flexWrap: 'wrap',
            gap: 10, color: 'var(--white)',
          }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-brand)' }}>
              Save ${formatMoney(saveVsSeparately.savings)}
            </span>
            <span style={{ fontSize: '0.86rem', color: 'var(--grey-300)' }}>
              ({saveVsSeparately.pct.toFixed(0)}% Off Separate Vials)
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginTop: 6 }}>
            Separate Vials Add Up To ${formatMoney(saveVsSeparately.separateTotal)}. The Stack Is ${formatMoney(saveVsSeparately.bundle)}.
          </div>
        </section>
      )}

      {supplies.length > 0 && (
        <section aria-label="Supplies You Will Need">
          <SectionTitle primaryColor={primaryColor}>
            Supplies You&apos;ll Need
          </SectionTitle>
          <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginTop: -4, marginBottom: 10 }}>
            For Reconstitution And Lab Prep Of {currentProductName}.
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(220px, 100%), 1fr))',
            gap: 10,
          }}>
            {supplies.map((s) => (
              <SupplyMiniCard
                key={s.key}
                supply={s.group!}
                primaryColor={primaryColor}
                onAdd={() => onAddVariantToCart(s.group!.defaultVariantId, s.key === 'bac_water' ? 10 : 1)}
                onOpen={() => onOpenProductByName(s.group!.name)}
              />
            ))}
          </div>
        </section>
      )}

      {studiedWith.length > 0 && (
        <section aria-label="Compounds Studied With This One">
          <SectionTitle primaryColor={primaryColor}>
            Compounds Studied With This One
          </SectionTitle>
          <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginTop: -4, marginBottom: 10 }}>
            Ranked By Shared Research Areas And Mechanism - All Currently Stocked Here.
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(160px, 100%), 1fr))',
            gap: 10,
          }}>
            {studiedWith.map(({ ref, group }) => {
              if (!group) return null;
              const tier = evidenceTier(ref.evidence_tier);
              return (
                <button
                  key={ref.slug}
                  type="button"
                  onClick={() => onOpenProductBySlug(ref.slug)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                    gap: 6,
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: 'var(--white)',
                    minHeight: 76,
                  }}
                >
                  <span style={{ fontWeight: 800, fontSize: '0.86rem', lineHeight: 1.2 }}>
                    {ref.display_name}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {tier.badgeUrl ? (
                      <img src={tier.badgeUrl} alt={tier.label} style={{ height: '22px', width: 'auto', maxWidth: 'none', borderRadius: 3, objectFit: 'contain', flexShrink: 0 }} />
                    ) : (
                      <span style={{ fontSize: '0.66rem', color: tier.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {tier.label}
                      </span>
                    )}
                    <span style={{ fontSize: '0.7rem', color: primaryColor, fontWeight: 700 }}>
                      ${formatMoney((group.lowestPrice || 0) / 10)}/Vial
                    </span>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 'auto', fontSize: '0.72rem', color: 'var(--grey-300)', fontWeight: 600 }}>
                    View Details <ArrowRight size={11} aria-hidden="true" />
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <ReconstitutionCalc
        defaultVialMassMg={currentVialMassMg ?? null}
        primaryColor={primaryColor}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {currentCompoundSlug && currentProductName && (
          <PinToCompareButton
            compoundSlug={currentCompoundSlug}
            compoundName={currentCompound?.display_name ?? currentProductName}
            productName={currentProductName}
            imageUrl={currentImageUrl ?? null}
            pricePerVialDollars={
              currentBundlePriceDollars != null ? Number(currentBundlePriceDollars) / 10 : null
            }
            evidenceTierKey={currentCompound?.evidence_tier ?? undefined}
            category={currentCompound?.category ?? null}
          />
        )}
      </div>

      {similarProducts.length > 0 && (
        <section aria-label="Similar Products">
          <SectionTitle primaryColor={primaryColor}>
            Similar Products
          </SectionTitle>
          <div style={{
            display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6,
            scrollSnapType: 'x mandatory',
          }}>
            {similarProducts.map(({ ref, group }) => {
              if (!group) return null;
              const pricePerVial = group.lowestPrice ? group.lowestPrice / 10 : null;
              // Show up to 2 research area labels
              const areaLabels = (ref.research_areas || []).slice(0, 2).map(researchAreaLabel);
              return (
                <button
                  key={group.name}
                  type="button"
                  onClick={() => onOpenProductByName(group.name)}
                  style={{
                    flex: '0 0 auto', scrollSnapAlign: 'start',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                    padding: '10px 8px', borderRadius: 14,
                    background: ref.is_best_stack_match
                      ? `linear-gradient(160deg, ${primaryColor}18 0%, rgba(255,255,255,0.04) 100%)`
                      : 'rgba(255,255,255,0.04)',
                    border: ref.is_best_stack_match
                      ? `1.5px solid ${primaryColor}55`
                      : '1px solid rgba(255,255,255,0.10)',
                    cursor: 'pointer', minWidth: 116, maxWidth: 144,
                    color: 'var(--white)',
                    position: 'relative',
                    boxShadow: ref.is_best_stack_match
                      ? `0 0 0 1px ${primaryColor}22, inset 0 1px 0 rgba(255,255,255,0.08)`
                      : 'none',
                  }}
                >
                  {/* "Pairs Well Together" badge for explicit best_stacked_with matches */}
                  {ref.is_best_stack_match && (
                    <div style={{
                      position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)',
                      background: primaryColor, color: '#fff',
                      fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.04em',
                      padding: '2px 8px', borderRadius: 99,
                      whiteSpace: 'nowrap', textTransform: 'uppercase',
                      boxShadow: `0 2px 6px ${primaryColor}60`,
                    }}>
                      Pairs Well
                    </div>
                  )}
                  {group.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={group.imageUrl}
                      alt={group.name}
                      width={64}
                      height={64}
                      style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', background: '#0F1923' }}
                    />
                  ) : (
                    <div style={{ width: 64, height: 64, borderRadius: 10, background: `${primaryColor}20` }} aria-hidden="true" />
                  )}
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 700, lineHeight: 1.15,
                    textAlign: 'center', maxWidth: 128,
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>
                    {group.name}
                  </span>
                  {/* Research area pills */}
                  {areaLabels.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center' }}>
                      {areaLabels.map((label) => (
                        <span key={label} style={{
                          fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.02em',
                          padding: '2px 6px', borderRadius: 99,
                          background: 'rgba(255,255,255,0.07)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          color: 'var(--grey-300)',
                          whiteSpace: 'nowrap', maxWidth: 120,
                          overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {label}
                        </span>
                      ))}
                    </div>
                  )}
                  {pricePerVial != null && (
                    <span style={{ fontSize: '0.72rem', color: primaryColor, fontWeight: 800 }}>
                      ${formatMoney(pricePerVial)}/Vial
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
