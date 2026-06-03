'use client';

/**
 * R35 Phase 2 — Product modal enhancements for agent storefronts.
 *
 * Adds four discovery pieces below the existing product modal body:
 *
 *   1. SuppliesYouNeed          — Bac. Water + Acetic Acid + Alcohol Swabs
 *                                 (we NEVER suggest syringes; that is
 *                                 enforced both by an allow-list and a
 *                                 hard FORBIDDEN_SUPPLY_NAME block).
 *
 *   2. StackComponentsCards     — when the current compound is itself a
 *                                 stack (e.g., KLOW = TB10+BPC10+GHK50+KPV10),
 *                                 each component is rendered as a tappable
 *                                 mini-card that opens that compound's modal
 *                                 if it exists on this storefront.
 *
 *   3. SaveVsSeparately         — for stacks where every component is also
 *                                 stocked on this storefront, compute the
 *                                 sum of the cheapest variant of each
 *                                 component vs the stack's bundle price and
 *                                 show the dollar / percentage saved.
 *
 *   4. CompoundsStudiedWithThis — ranked list via lib/compounds.relatedCompounds
 *                                 filtered to compounds actually stocked here.
 *
 * Plus a small <ClickableCategoryBadge> helper that the modal uses to make the
 * inline category badge a filter shortcut (taps it -> modal closes, storefront
 * grid filters to that category).
 *
 * Caller: components/AgentStorefrontGrid.tsx (import at top of file, mounted
 * inside the product detail modal body, replacing the single legacy
 * "Researchers Also Bought" RecommendationStrip).
 */

import { useMemo } from 'react';
import { ArrowRight, Plus } from 'lucide-react';
import { evidenceTier, relatedCompounds, type Compound } from '@/lib/compounds';

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
  grouped: ModalGroupedProductRef[];
  compoundsBySlug: Record<string, Compound>;
  primaryColor: string;
  onOpenProductBySlug: (compoundSlug: string) => void;
  onOpenProductByName: (name: string) => void;
  onAddVariantToCart: (variantId: string, qty: number) => void;
}

const SUPPLY_PATTERNS: Array<{ key: string; pattern: RegExp; label: string }> = [
  { key: 'bac_water', pattern: /bac\.?\s*water|bacteriostatic/i, label: 'Bac. Water' },
  { key: 'acetic_acid', pattern: /acetic\s*acid/i, label: 'Acetic Acid' },
  { key: 'alcohol_swabs', pattern: /alcohol\s*(swabs?|pads?|prep)/i, label: 'Alcohol Swabs' },
];

// Hard, non-negotiable block. PepNationLab never sells syringes - if anything
// matches this regex it is filtered out, even from the supplies grid.
const FORBIDDEN_SUPPLY_NAME = /syring/i;

function pickSupply(grouped: ModalGroupedProductRef[], pattern: RegExp, currentSlug: string | null) {
  for (const g of grouped) {
    if (FORBIDDEN_SUPPLY_NAME.test(g.name)) continue;
    if (g.compoundSlug && g.compoundSlug === currentSlug) continue;
    if (pattern.test(g.name)) return g;
    if (g.compoundSlug && pattern.test(g.compoundSlug)) return g;
  }
  return null;
}

function normalizeStackComponent(token: string): string {
  // Stack component tokens in the database are typically compound slugs, but a
  // few legacy rows use display names. Normalize so we can look them up either
  // way without forcing a migration here.
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

export default function ProductModalEnhancements({
  currentCompound,
  currentCompoundSlug,
  currentProductName,
  currentBundlePriceDollars,
  grouped,
  compoundsBySlug,
  primaryColor,
  onOpenProductBySlug,
  onOpenProductByName,
  onAddVariantToCart,
}: Props) {
  const supplies = useMemo(() => {
    return SUPPLY_PATTERNS.map(({ key, pattern, label }) => ({
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
    // Filter to compounds we ACTUALLY stock on this storefront, and never echo
    // back a stack-component (those already render in the StackComponentsCards
    // section above).
    const stackSlugs = new Set(stackComponents.map((s) => s.compound?.slug).filter(Boolean));
    return ranked
      .map((r) => {
        const group = grouped.find((g) => g.compoundSlug === r.slug) ?? null;
        return { ref: r, group };
      })
      .filter((x) => x.group !== null && !stackSlugs.has(x.ref.slug))
      .slice(0, 4);
  }, [currentCompound, compoundsBySlug, grouped, stackComponents]);

  const hasAnything =
    supplies.length > 0 ||
    stackComponents.length > 0 ||
    studiedWith.length > 0 ||
    saveVsSeparately !== null;
  if (!hasAnything) return null;

  return (
    <div style={{
      marginTop: 24,
      paddingTop: 20,
      borderTop: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column', gap: 22,
    }}>
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
                    <span style={{ fontSize: '0.64rem', color: tier.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {tier.label}
                    </span>
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
                    <span style={{ fontSize: '0.66rem', color: tier.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {tier.label}
                    </span>
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
    </div>
  );
}
