'use client';

/**
 * R35 Phase 2 + 3 - Product modal enhancements for agent storefronts.
 *
 * Sections rendered below the existing product modal body, in order:
 *
 *   PHASE 2
 *     1. IsThisRightForMe         - collapsible expander that surfaces the
 *                                   compound's studied_for + research areas +
 *                                   cold-chain in a researcher-friendly
 *                                   "Is This Right For My Research?" panel
 *                                   (PHASE 3 addition).
 *     2. StackComponentsCards     - when the current compound is itself a
 *                                   stack (e.g., KLOW = TB10+BPC10+GHK50+KPV10),
 *                                   each component is rendered as a tappable
 *                                   mini-card.
 *     3. SaveVsSeparately         - for stacks where every component is also
 *                                   stocked on this storefront, compute the
 *                                   sum vs the stack price.
 *     4. SuppliesYouNeed          - Bac. Water + Acetic Acid + Alcohol Swabs.
 *                                   We NEVER suggest syringes; that is enforced
 *                                   both by an allow-list and a hard
 *                                   FORBIDDEN_SUPPLY_NAME block.
 *     5. CompoundsStudiedWithThis - ranked via lib/compounds.relatedCompounds.
 *
 *   PHASE 3
 *     6. ReconstitutionCalc       - inline lab-prep calculator using
 *                                   lib/compounds.reconstitutionVolumeMl()
 *                                   and drawVolumeMl(). Optional, collapsible.
 *
 *   COMPARE
 *     7. PinToCompareButton       - renders a small action button that fires
 *                                   the custom DOM event `pnl:compare-add`
 *                                   with the current product payload. The
 *                                   storefront page listens and manages the
 *                                   compare tray.
 *
 * All network data is fetched once from the parent (AgentStorefrontGrid) and
 * passed down as props - this component intentionally does zero data fetching
 * of its own.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowRight, Plus, Beaker, ChevronDown, ChevronUp, BookmarkPlus, AlertCircle, CheckCircle2, Shield, AlertTriangle, BookOpen, Trophy, Clock, Sparkles, Thermometer } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CompoundResearchData {
  slug: string;
  display_name: string;
  aliases?: string[] | null;
  category?: string | null;
  compound_class?: string | null;
  evidence_tier?: string;
  mechanism?: string | null;
  molecular_target?: string | null;
  studied_for?: string[] | null;
  research_areas?: string[] | null;
  side_effects?: string | null;
  warnings?: string | null;
  plain_summary?: string | null;
  is_stack?: boolean | null;
  stack_components?: string[] | null;
  stack_rationale?: string | null;
  handling?: {
    form?: string;
    diluent?: string;
    storage_temp?: string;
    reconstituted_days?: number;
    [key: string]: unknown;
  } | null;
  half_life?: string | null;
  pk_summary?: string | null;
  measured_half_life_hours?: number | null;
  predicted_half_life_hours?: number | null;
  references?: Array<{
    authors?: string;
    year?: number;
    title?: string;
    journal?: string;
    doi?: string;
    url?: string;
  }> | null;
  // Intranasal
  intranasal_bioavailability_pct?: number | null;
  intranasal_onset_minutes?: number | null;
  intranasal_notes?: string | null;
  // NEW fields from extended schema
  solubility?: string | null;
  stability_notes?: string | null;
}

export interface StorefrontProduct {
  id: string;
  product_id: string;
  slug?: string | null;
  display_name?: string | null;
  description?: string | null;
  retail_price: number;
  sale_price?: number | null;
  is_on_sale?: boolean | null;
  category?: string | null;
  weight_oz?: number | null;
  inventory_count?: number | null;
  compound?: CompoundResearchData | null;
  image_url?: string | null;
  custom_name?: string | null;
}

interface Props {
  product: StorefrontProduct;
  allProducts: StorefrontProduct[];
  primaryColor?: string;
  onNavigate?: (slug: string) => void;
  onAddToCart?: (product: StorefrontProduct) => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const FORBIDDEN_SUPPLY_NAMES = [
  'syringe', 'needle', 'gauge', 'injector',
];

const ALLOWED_SUPPLY_SLUGS = [
  'bac-water', 'bacteriostatic-water',
  'acetic-acid', 'glacial-acetic-acid',
  'alcohol-swabs', 'alcohol-prep-pads', 'sterile-swabs',
];

const SUPPLY_DISPLAY_NAMES: Record<string, string> = {
  'bac-water': 'Bacteriostatic Water',
  'bacteriostatic-water': 'Bacteriostatic Water',
  'acetic-acid': 'Acetic Acid',
  'glacial-acetic-acid': 'Glacial Acetic Acid',
  'alcohol-swabs': 'Alcohol Swabs',
  'alcohol-prep-pads': 'Alcohol Prep Pads',
  'sterile-swabs': 'Sterile Swabs',
};

const EVIDENCE_TIER_LABELS: Record<string, string> = {
  tier_1: 'Preclinical',
  tier_2: 'Phase 1/2',
  tier_3: 'Phase 2/3',
  tier_4: 'Approved',
  exploratory: 'Exploratory',
};

const EVIDENCE_TIER_COLORS: Record<string, string> = {
  tier_1: '#A0AEC0',
  tier_2: '#68D391',
  tier_3: '#4FD1C5',
  tier_4: '#63B3ED',
  exploratory: '#F6AD55',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n % 1 === 0 ? n.toString() : n.toFixed(2);
}

function reconstitutionVolumeMl(
  vialMg: number,
  targetConcentrationMgPerMl: number,
): number {
  if (targetConcentrationMgPerMl <= 0) return 0;
  return vialMg / targetConcentrationMgPerMl;
}

function drawVolumeMl(
  doseMcg: number,
  concentrationMgPerMl: number,
): number {
  if (concentrationMgPerMl <= 0) return 0;
  return doseMcg / 1000 / concentrationMgPerMl;
}

function inferVialMg(product: StorefrontProduct): number | null {
  const name = (
    product.custom_name ??
    product.display_name ??
    product.compound?.display_name ??
    ''
  ).toLowerCase();
  const match = name.match(/(\d+(?:\.\d+)?)\s*mg/);
  if (match) return parseFloat(match[1]);
  return null;
}

// strength badge strings that should NOT appear
const STRENGTH_BLOCKLIST = new Set([
  'research grade',
  'research use',
  'for research',
  'research only',
]);

function strengthStrings(compound: CompoundResearchData): string[] {
  const raw: string[] = [];

  const tier = compound.evidence_tier;
  if (tier && EVIDENCE_TIER_LABELS[tier]) {
    raw.push(EVIDENCE_TIER_LABELS[tier]);
  }

  const cls = compound.compound_class;
  if (cls) raw.push(cls);

  const target = compound.molecular_target;
  if (target) raw.push(target);

  return raw
    .filter((s) => {
      const low = s.toLowerCase();
      return (
        s.length <= 24 &&
        ![...STRENGTH_BLOCKLIST].some((b) => low.includes(b))
      );
    })
    .slice(0, 3);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: '14px 16px',
        marginBottom: 12,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: '0.62rem',
        fontWeight: 800,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: '#A8B4C0',
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function CollapsibleCard({
  label,
  children,
  defaultOpen = false,
  primaryColor,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  primaryColor?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <SectionCard style={{ padding: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          color: '#fff',
        }}
      >
        <span
          style={{
            fontSize: '0.78rem',
            fontWeight: 700,
            color: primaryColor ?? '#00C4BC',
          }}
        >
          {label}
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div style={{ padding: '0 16px 14px' }}>{children}</div>
      )}
    </SectionCard>
  );
}

// ─── 1. IsThisRightForMe ────────────────────────────────────────────────────

function IsThisRightForMe({
  compound,
  primaryColor,
}: {
  compound: CompoundResearchData;
  primaryColor: string;
}) {
  const studiedFor = compound.studied_for ?? [];
  const areas = compound.research_areas ?? [];
  const handling = compound.handling;
  const coldChain = handling?.storage_temp?.toLowerCase().includes('-') || false;
  const halfLife =
    compound.half_life ??
    compound.pk_summary ??
    (compound.measured_half_life_hours != null
      ? `${compound.measured_half_life_hours} Hours (Measured)`
      : compound.predicted_half_life_hours != null
      ? `${compound.predicted_half_life_hours} Hours (Predicted)`
      : null);

  const strBadges = strengthStrings(compound);

  return (
    <CollapsibleCard
      label="Is This Right For My Research?"
      defaultOpen={false}
      primaryColor={primaryColor}
    >
      {/* Strength badges */}
      {strBadges.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            marginBottom: 12,
          }}
        >
          {strBadges.map((str) => (
            <span
              key={str}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
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
              <CheckCircle2 size={11} style={{ marginRight: 3, flexShrink: 0 }} />{str}
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
        }}
      >