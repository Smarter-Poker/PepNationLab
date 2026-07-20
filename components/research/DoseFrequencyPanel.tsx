'use client';

/**
 * DoseFrequencyPanel
 *
 * Collapsible "DOSE AND FREQUENCY" accordion panel for compound monograph pages.
 * Uses the branded dark-metallic pill button design with teal checkmark/chevron.
 *
 * ⚠️ FOR RESEARCH REFERENCE ONLY — NOT MEDICAL ADVICE.
 */

import { useState, useRef, useEffect } from 'react';
import { getDoseProfile, type DoseProfile } from '@/lib/research/dose-profiles';

interface Props {
  slug: string;
  compoundName: string;
}

// ── Row component ─────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '160px 1fr',
        gap: '8px 16px',
        padding: '12px 0',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        alignItems: 'start',
      }}
    >
      <span
        style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#00C4BC',
          paddingTop: 2,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: '0.88rem',
          lineHeight: 1.6,
          color: '#D0DAE4',
          fontWeight: 500,
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Route pill ────────────────────────────────────────────────────────────────
function RoutePill({ route }: { route: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 20,
        background: 'rgba(0,196,188,0.08)',
        border: '1px solid rgba(0,196,188,0.22)',
        color: '#00C4BC',
        fontSize: '0.74rem',
        fontWeight: 700,
        letterSpacing: '0.03em',
        whiteSpace: 'nowrap',
      }}
    >
      {route}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DoseFrequencyPanel({ slug, compoundName }: Props) {
  const profile: DoseProfile | null = getDoseProfile(slug);
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  // Smooth height animation
  useEffect(() => {
    if (!contentRef.current) return;
    setHeight(open ? contentRef.current.scrollHeight : 0);
  }, [open]);

  // Nothing to show for reconstitution vehicles
  const isVehicle = !profile || profile.cycleOn === 'N/A — reconstitution vehicle';

  if (!profile || isVehicle) return null;

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: '0 16px 24px',
      }}
    >
      {/* ── Branded Toggle Button ───────────────────────────────────────────── */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls="dose-frequency-panel"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'block',
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          outline: 'none',
          position: 'relative',
        }}
      >
        <img
          src="/images/buttons/dose-and-frequency-btn.png"
          alt="Dose and Frequency"
          style={{ width: '100%', height: 'auto', display: 'block', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }}
        />
        <div style={{ position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 18 18"
            fill="none"
            aria-hidden
            style={{
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <polyline
              points="4,6.5 9,12 14,6.5"
              stroke="#00C4BC"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </button>

      {/* ── Collapsible Content ─────────────────────────────────────────────── */}
      <div
        id="dose-frequency-panel"
        role="region"
        aria-label={`Dose and Frequency for ${compoundName}`}
        style={{
          overflow: 'hidden',
          height: `${height}px`,
          transition: 'height 0.32s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <div ref={contentRef}>
          <div
            style={{
              marginTop: 12,
              borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
              padding: '8px 24px 20px',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            {/* Disclaimer banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                marginBottom: 8,
                marginTop: 8,
                background: 'rgba(255,180,0,0.06)',
                border: '1px solid rgba(255,180,0,0.18)',
                borderRadius: 10,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }} aria-hidden>
                <path d="M8 1.5L14.5 13H1.5L8 1.5Z" stroke="#FFA500" strokeWidth="1.5" strokeLinejoin="round" />
                <line x1="8" y1="6" x2="8" y2="9.5" stroke="#FFA500" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="8" cy="11.5" r="0.75" fill="#FFA500" />
              </svg>
              <span
                style={{
                  fontSize: '0.72rem',
                  color: '#FFBE5C',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                Research Reference Only — Not Medical Advice. For In Vitro Laboratory Use Only.
              </span>
            </div>

            {/* Data rows */}
            <InfoRow label="Typical Dose" value={profile.typicalDose} />
            <InfoRow label="Frequency" value={profile.frequency} />
            <InfoRow label="Cycle On" value={profile.cycleOn} />
            <InfoRow label="Cycle Off" value={profile.cycleOff} />

            {/* Routes */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '160px 1fr',
                gap: '8px 16px',
                padding: '12px 0',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                alignItems: 'start',
              }}
            >
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#00C4BC',
                  paddingTop: 4,
                }}
              >
                Route(s)
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 2 }}>
                {profile.routes.map((r) => (
                  <RoutePill key={r} route={r} />
                ))}
              </div>
            </div>

            {/* Notes */}
            {profile.notes && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '160px 1fr',
                  gap: '8px 16px',
                  padding: '12px 0 0',
                  alignItems: 'start',
                }}
              >
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#00C4BC',
                    paddingTop: 2,
                  }}
                >
                  Research Notes
                </span>
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.85rem',
                    lineHeight: 1.65,
                    color: 'rgba(208,218,228,0.85)',
                    fontWeight: 400,
                  }}
                >
                  {profile.notes}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
