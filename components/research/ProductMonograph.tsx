'use client';

/**
 * ProductMonograph - research access shown inside the storefront product detail
 * modal. This is the STANDARD template for every compound: a break line under
 * the description, then five premium brushed-metal buttons (Research, Findings,
 * Preparation, Spec Sheet, FAQs) on a single row. Each button opens the
 * ProductResearchPanel as an in-app popup showing only that one section; from
 * the FAQ the user can open the in-app Full Research Profile view.
 *
 * The panel is fully data-driven, so this works for any compound. Research-Use-
 * Only framing. Title Case everywhere.
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { type Compound } from '@/lib/compounds';
import ProductResearchPanel, { type ResearchSection } from '@/components/research/ProductResearchPanel';

interface Props {
  compound: Compound;
  primaryColor?: string;
}

const PANEL_BUTTONS: { key: ResearchSection; label: string }[] = [
  { key: 'profile', label: 'Research' },
  { key: 'findings', label: 'Findings' },
  { key: 'prep', label: 'Preparation' },
  { key: 'spec', label: 'Spec Sheet' },
  { key: 'faq', label: 'FAQs' },
];

const premiumMetalButton: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: '13px 4px',
  borderRadius: 11,
  cursor: 'pointer',
  border: '1px solid rgba(190,200,210,0.30)',
  background: 'linear-gradient(180deg, #34424f 0%, #1d2630 55%, #151d26 100%)',
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -2px 4px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.5)',
  color: '#EAF2F8',
  fontWeight: 800,
  fontSize: 'clamp(0.62rem, 2.7vw, 0.8rem)',
  letterSpacing: 0,
  whiteSpace: 'nowrap',
  lineHeight: 1,
};

export default function ProductMonograph({ compound, primaryColor = '#00C4BC' }: Props) {
  const [panelSection, setPanelSection] = useState<ResearchSection | null>(null);
  if (!compound) return null;

  return (
    <div style={{ marginBottom: 'var(--space-6)' }}>
      {/* Break line under the description, above the buttons */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.10)', margin: '0 0 var(--space-5)' }} />

      {/* Premium metal buttons on a single row (5 columns, centered labels) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 6,
        }}
      >
        {PANEL_BUTTONS.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => setPanelSection(b.key)}
            style={premiumMetalButton}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* Break line under the buttons */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.10)', margin: 'var(--space-5) 0 0' }} />

      {panelSection && typeof document !== 'undefined'
        ? createPortal(
            <ProductResearchPanel
              compound={compound}
              primaryColor={primaryColor}
              initialSection={panelSection}
              onClose={() => setPanelSection(null)}
            />,
            document.body
          )
        : null}
    </div>
  );
}
