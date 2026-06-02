'use client';

/**
 * ProductMonograph — COMPACT, collapsed-by-default research summary shown inside
 * the storefront product detail modal. It is intentionally short: a one-line
 * "Research Profile" toggle that expands to a brief summary plus a button to the
 * full tabbed profile page (/research/[slug]). The deep, sectioned data lives on
 * that page, not stacked inside the modal.
 *
 * Research-Use-Only framing. Title Case everywhere (prose uses capitalize).
 */
import { useState } from 'react';
import Link from 'next/link';
import { Microscope, ChevronDown, ArrowRight } from 'lucide-react';
import { type Compound, evidenceTier } from '@/lib/compounds';

interface Props {
  compound: Compound;
  primaryColor?: string;
}

// First letter of every word capitalized, on display, per platform rule.
const capitalize: React.CSSProperties = { textTransform: 'capitalize' };

export default function ProductMonograph({ compound, primaryColor = '#00C4BC' }: Props) {
  const [open, setOpen] = useState(false);
  if (!compound) return null;

  const tier = evidenceTier(compound.evidence_tier);
  const summary = compound.plain_summary || compound.mechanism || '';
  const studied = (compound.studied_for ?? []).slice(0, 4);

  return (
    <div style={{ marginBottom: 'var(--space-6)' }}>
      {/* Collapsed toggle button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(0,196,188,0.08)',
          border: `1px solid ${primaryColor}40`,
          color: 'var(--white)',
          cursor: 'pointer',
          fontWeight: 700,
          fontSize: '0.9rem',
          textAlign: 'left',
        }}
      >
        <Microscope size={16} aria-hidden="true" style={{ color: primaryColor, flexShrink: 0 }} />
        <span style={{ flex: 1 }}>Research Profile</span>
        <span
          style={{
            fontSize: '0.66rem',
            fontWeight: 800,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            padding: '3px 8px',
            borderRadius: 9999,
            background: `${tier.color}1A`,
            border: `1px solid ${tier.color}55`,
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

      {/* Expanded compact summary */}
      {open && (
        <div
          style={{
            marginTop: 'var(--space-3)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(15,25,35,0.6)',
            border: '1px solid rgba(192,184,168,0.16)',
          }}
        >
          {summary && (
            <p style={{ ...capitalize, fontSize: '0.88rem', color: '#D0DAE4', lineHeight: 1.6, margin: '0 0 var(--space-3)' }}>
              {summary}
            </p>
          )}

          {studied.length > 0 && (
            <>
              <p style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--silver)', margin: '0 0 6px' }}>
                Studied For
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 'var(--space-4)' }}>
                {studied.map((s) => (
                  <span
                    key={s}
                    style={{
                      ...capitalize,
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 9999,
                      background: `${primaryColor}14`,
                      border: `1px solid ${primaryColor}33`,
                      color: '#D0DAE4',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </>
          )}

          <Link
            href={`/research/${compound.slug}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: 'var(--radius-md)',
              background: primaryColor,
              color: '#04221F',
              fontWeight: 800,
              fontSize: '0.85rem',
              textDecoration: 'none',
            }}
          >
            View Full Research Profile
            <ArrowRight size={15} aria-hidden="true" />
          </Link>

          <p style={{ fontSize: '0.72rem', color: 'var(--grey-400)', lineHeight: 1.5, margin: 'var(--space-3) 0 0' }}>
            Research Use Only. Not For Human Or Veterinary Use.
          </p>
        </div>
      )}
    </div>
  );
}
