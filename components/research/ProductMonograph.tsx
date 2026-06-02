'use client';

/**
 * ProductMonograph — COMPACT, collapsed-by-default research summary shown inside
 * the storefront product detail modal. A premium brushed-metal "Research Profile"
 * toggle expands to a brief summary plus a button that opens the FULL profile
 * INSIDE the popup (ProductResearchPanel) — no route navigation.
 *
 * The enhanced in-popup experience is currently scoped to Tirzepatide while the
 * layout is being locked in; other compounds keep the link-out behavior until
 * the design is rolled out.
 *
 * Research-Use-Only framing. Title Case everywhere (prose uses capitalize).
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ChevronDown, ArrowRight } from 'lucide-react';
import { type Compound, evidenceTier } from '@/lib/compounds';
import ProductResearchPanel from '@/components/research/ProductResearchPanel';

interface Props {
  compound: Compound;
  primaryColor?: string;
}

// First letter of every word capitalized, on display, per platform rule.
const capitalize: React.CSSProperties = { textTransform: 'capitalize' };

export default function ProductMonograph({ compound, primaryColor = '#00C4BC' }: Props) {
  const [open, setOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  if (!compound) return null;

  // Scoped to Tirzepatide while the layout is locked in (see file header).
  const enhanced = compound.slug === 'tirzepatide';

  const tier = evidenceTier(compound.evidence_tier);
  const summary = compound.plain_summary || compound.mechanism || '';
  const studied = (compound.studied_for ?? []).slice(0, 4);

  return (
    <div style={{ marginBottom: 'var(--space-6)' }}>
      {/* Premium brushed-metal frame around the whole Research Profile block */}
      <div
        style={{
          padding: 2,
          borderRadius: 16,
          background:
            'linear-gradient(145deg, #c8c2b8 0%, #8a847c 35%, #5c5852 50%, #8a847c 65%, #c8c2b8 100%)',
          boxShadow: '0 6px 20px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.3)',
        }}
      >
        {/* Collapsed toggle button (inner dark surface) */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '13px 16px',
            borderRadius: open ? '14px 14px 0 0' : 14,
            background: 'linear-gradient(180deg, #18222d 0%, #0e1620 100%)',
            border: 'none',
            color: 'var(--white)',
            cursor: 'pointer',
            fontWeight: 800,
            fontSize: '0.95rem',
            letterSpacing: '0.01em',
            textAlign: 'left',
          }}
        >
          <span style={{ flex: 1 }}>Research Profile</span>
          <span
            style={{
              fontSize: '0.66rem',
              fontWeight: 800,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              padding: '4px 10px',
              borderRadius: 9999,
              background: `${tier.color}1A`,
              border: `1px solid ${tier.color}66`,
              color: tier.color,
              whiteSpace: 'nowrap',
            }}
          >
            {tier.label}
          </span>
          <ChevronDown
            size={18}
            aria-hidden="true"
            style={{
              color: 'var(--silver)',
              flexShrink: 0,
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease',
            }}
          />
        </button>

        {/* Expanded compact summary (inner dark surface) */}
        {open && (
          <div
            style={{
              padding: 'var(--space-4) var(--space-4) var(--space-5)',
              borderRadius: '0 0 14px 14px',
              background: 'linear-gradient(180deg, #0e1620 0%, #0a1018 100%)',
              borderTop: '1px solid rgba(192,184,168,0.18)',
            }}
          >
            {summary && (
              <p style={{ ...capitalize, fontSize: '0.9rem', color: '#D0DAE4', lineHeight: 1.65, margin: '0 0 var(--space-4)' }}>
                {summary}
              </p>
            )}

            {studied.length > 0 && (
              <>
                <p style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--silver)', margin: '0 0 8px' }}>
                  Studied For
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 'var(--space-5)' }}>
                  {studied.map((s) => (
                    <span
                      key={s}
                      style={{
                        ...capitalize,
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        padding: '6px 12px',
                        borderRadius: 9999,
                        background: `${primaryColor}14`,
                        border: `1px solid ${primaryColor}3A`,
                        color: '#E2EAF2',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </>
            )}

            {enhanced ? (
              <button
                type="button"
                onClick={() => setPanelOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '11px 18px',
                  borderRadius: 'var(--radius-md)',
                  background: primaryColor,
                  color: '#04221F',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                View Full Research Profile
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            ) : (
              <Link
                href={`/research/${compound.slug}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '11px 18px',
                  borderRadius: 'var(--radius-md)',
                  background: primaryColor,
                  color: '#04221F',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  textDecoration: 'none',
                }}
              >
                View Full Research Profile
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            )}

            <p style={{ fontSize: '0.72rem', color: 'var(--grey-400)', lineHeight: 1.5, margin: 'var(--space-4) 0 0' }}>
              Research Use Only. Not For Human Or Veterinary Use.
            </p>
          </div>
        )}
      </div>

      {/* Full profile, opened inside the popup (Tirzepatide) */}
      {enhanced && panelOpen && typeof document !== 'undefined'
        ? createPortal(
            <ProductResearchPanel compound={compound} primaryColor={primaryColor} onClose={() => setPanelOpen(false)} />,
            document.body
          )
        : null}
    </div>
  );
}
