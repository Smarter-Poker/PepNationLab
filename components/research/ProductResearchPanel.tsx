'use client';

/**
 * ProductResearchPanel — the full research profile, opened INSIDE the product
 * detail modal (no route navigation). Premium thick brushed-nickel frame, the
 * same back arrow used in the global header, text-only tabs (no icons), short
 * paragraphs, Title Case prose. Spec Sheet link lives at the end of Sources.
 */
import { useState } from 'react';
import Link from 'next/link';
import {
  type Compound,
  evidenceTier,
  wadaLabel,
  researchAreaLabel,
  RISK_META,
} from '@/lib/compounds';
import ReconstitutionCalculator from '@/components/research/ReconstitutionCalculator';

interface Props {
  compound: Compound;
  primaryColor?: string;
  onClose: () => void;
}

const cap: React.CSSProperties = { textTransform: 'capitalize' };

function Para({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ ...cap, color: '#C8D2DC', lineHeight: 1.75, fontSize: '0.95rem', margin: '0 0 var(--space-3)' }}>
      {children}
    </p>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--silver)', margin: '0 0 8px' }}>
      {children}
    </p>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '') return null;
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.07)', fontSize: '0.9rem' }}>
      <span style={{ flex: '0 0 40%', color: 'var(--silver)', fontWeight: 700 }}>{label}</span>
      <span style={{ ...cap, flex: 1, color: 'var(--white)' }}>{value}</span>
    </div>
  );
}

function Chips({ items, color }: { items: string[]; color: string }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {items.map((it) => (
        <span key={it} style={{ ...cap, fontSize: '0.8rem', fontWeight: 600, padding: '6px 12px', borderRadius: 9999, background: `${color}14`, border: `1px solid ${color}3A`, color: '#E2EAF2', whiteSpace: 'nowrap' }}>
          {it}
        </span>
      ))}
    </div>
  );
}

export default function ProductResearchPanel({ compound, primaryColor = '#00C4BC', onClose }: Props) {
  const tier = evidenceTier(compound.evidence_tier);
  const risk = RISK_META[compound.risk_level];
  const isHighRisk = compound.risk_level === 'critical' || compound.risk_level === 'high';
  const id = compound.identity ?? {};
  const h = compound.handling ?? {};

  const tabs: string[] = ['Overview'];
  if (compound.mechanism) tabs.push('Mechanism');
  if (compound.studied_for.length > 0 || compound.research_areas.length > 0 || compound.benefits) tabs.push('Studied For');
  tabs.push('Handling');
  if (compound.side_effects || compound.warnings || compound.regulatory || compound.wada_status) tabs.push('Safety');
  if (compound.sources.length > 0) tabs.push('Sources');

  const [active, setActive] = useState('Overview');

  const badge = (label: string, color: string) => (
    <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '5px 13px', borderRadius: 9999, background: `${color}1A`, border: `1px solid ${color}66`, color }}>
      {label}
    </span>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${compound.display_name} Research Profile`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100001,
        background: 'rgba(5,10,15,0.92)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 'max(16px, env(safe-area-inset-top)) 12px calc(16px + env(safe-area-inset-bottom, 0px))',
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 720,
          margin: 'auto 0',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(180deg, #131b24 0%, #0a0f14 100%)',
          borderRadius: 24,
          boxShadow:
            '0 0 0 2px #5d6166, 0 0 0 4px #b9bdc2, 0 0 0 6px #6c7075, inset 0 1px 0 rgba(255,255,255,0.10), 0 30px 90px rgba(0,0,0,0.85), 0 6px 28px rgba(160,168,176,0.14)',
          overflow: 'hidden',
          maxHeight: '94dvh',
        }}
      >
        {/* Top bar: global back arrow */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.05), transparent)' }}>
          <button
            type="button"
            onClick={onClose}
            aria-label="Back"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--white)', fontWeight: 700, fontSize: '0.9rem' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/back-arrow.png" width={38} height={38} alt="Back" style={{ objectFit: 'contain' }} />
            Back
          </button>
        </div>

        {/* Scroll body */}
        <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: 'var(--space-5) var(--space-5) var(--space-6)' }}>
          {/* Centered header */}
          <header style={{ textAlign: 'center', marginBottom: 'var(--space-5)' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--white)', margin: 0, fontFamily: 'var(--font-brand)' }}>
              {compound.display_name}
            </h1>
            {compound.aliases.length > 0 && (
              <p style={{ fontSize: '0.84rem', color: 'var(--silver)', margin: '8px 0 0' }}>
                Also Known As: {compound.aliases.join(', ')}
              </p>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 'var(--space-3)' }}>
              {badge(tier.label, tier.color)}
              {compound.category && badge(compound.category, primaryColor)}
              {isHighRisk && badge(`${risk.label} Risk`, risk.color)}
              {compound.wada_status && compound.wada_status !== 'not_listed' && badge(wadaLabel(compound.wada_status), '#F6AD55')}
            </div>
          </header>

          {/* Tabs (text-only) */}
          <div role="tablist" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, borderBottom: '1px solid rgba(192,184,168,0.25)', marginBottom: 'var(--space-5)' }}>
            {tabs.map((t) => {
              const isActive = active === t;
              return (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActive(t)}
                  style={{
                    padding: '10px 16px',
                    border: 'none',
                    borderBottom: `2px solid ${isActive ? primaryColor : 'transparent'}`,
                    background: 'transparent',
                    color: isActive ? 'var(--white)' : 'var(--silver)',
                    fontWeight: isActive ? 800 : 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    marginBottom: -1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>

          {/* Panels */}
          <section role="tabpanel" style={{ minHeight: 140 }}>
            {active === 'Overview' && (
              <div>
                {compound.plain_summary && <Para>{compound.plain_summary}</Para>}
                <div style={{ marginTop: 'var(--space-3)' }}>
                  <Fact label="Class" value={compound.compound_class} />
                  <Fact label="Molecular Target" value={compound.molecular_target} />
                  <Fact label="Sequence" value={id.sequence} />
                  <Fact label="Molecular Weight" value={id.molecular_weight} />
                  <Fact label="CAS" value={id.cas} />
                  <Fact label="Parent" value={id.parent} />
                </div>
              </div>
            )}

            {active === 'Mechanism' && (
              <div>
                <Label>Mechanism Of Action</Label>
                <Para>{compound.mechanism}</Para>
              </div>
            )}

            {active === 'Studied For' && (
              <div>
                {compound.studied_for.length > 0 && (
                  <div style={{ marginBottom: 'var(--space-5)' }}>
                    <Label>Studied For</Label>
                    <Chips items={compound.studied_for} color={primaryColor} />
                  </div>
                )}
                {compound.research_areas.length > 0 && (
                  <div style={{ marginBottom: 'var(--space-5)' }}>
                    <Label>Research Areas</Label>
                    <Chips items={compound.research_areas.map(researchAreaLabel)} color="#A8B4C0" />
                  </div>
                )}
                {compound.benefits && (
                  <div>
                    <Label>Reported In Research</Label>
                    <Para>{compound.benefits}</Para>
                  </div>
                )}
              </div>
            )}

            {active === 'Handling' && (
              <div>
                <div style={{ marginBottom: 'var(--space-5)' }}>
                  <Fact label="Form" value={h.form} />
                  <Fact label="Diluent" value={h.diluent} />
                  <Fact label="Storage Temperature" value={h.storage_temp} />
                  <Fact label="Light Sensitive" value={h.light_sensitive == null ? null : h.light_sensitive ? 'Yes' : 'No'} />
                  <Fact label="Freeze / Thaw" value={h.freeze_thaw} />
                  <Fact
                    label="Reconstituted Shelf Life"
                    value={(compound.reconstitution_shelf_days ?? h.reconstituted_days) != null ? `${compound.reconstitution_shelf_days ?? h.reconstituted_days} Days Refrigerated` : null}
                  />
                </div>
                {h.notes && <Para>{h.notes}</Para>}
                <ReconstitutionCalculator
                  onAddDiluent={() => {
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('pnl:add-to-cart-by-name', { detail: { name: 'Bac. water' } }));
                    }
                  }}
                />
              </div>
            )}

            {active === 'Safety' && (
              <div>
                {compound.warnings && (
                  <div style={{ marginBottom: 'var(--space-5)' }}>
                    <Label>Warnings & Limitations</Label>
                    <Para>{compound.warnings}</Para>
                  </div>
                )}
                {compound.side_effects && (
                  <div style={{ marginBottom: 'var(--space-5)' }}>
                    <Label>Reported Side Effects</Label>
                    <Para>{compound.side_effects}</Para>
                  </div>
                )}
                <div>
                  <Label>Regulatory & Anti-Doping</Label>
                  {compound.regulatory && <Para>{compound.regulatory}</Para>}
                  <p style={{ color: 'var(--white)', fontWeight: 700, margin: 0 }}>{wadaLabel(compound.wada_status)}</p>
                </div>
              </div>
            )}

            {active === 'Sources' && (
              <div>
                <Label>Sources</Label>
                <ul style={{ margin: '0 0 var(--space-5)', paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {compound.sources.map((src, i) => {
                    const href = /^https?:\/\//i.test(src) ? src : `https://${src}`;
                    return (
                      <li key={i} style={{ wordBreak: 'break-all', fontSize: '0.85rem' }}>
                        <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: primaryColor }}>
                          {src}
                        </a>
                      </li>
                    );
                  })}
                </ul>
                <Link
                  href={`/research/${compound.slug}/spec`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    color: 'var(--white)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    textDecoration: 'none',
                  }}
                >
                  View Printable Spec Sheet
                </Link>
              </div>
            )}
          </section>

          <p style={{ fontSize: '0.74rem', color: 'var(--grey-400)', lineHeight: 1.5, margin: 'var(--space-5) 0 0', textAlign: 'center' }}>
            Research Use Only. Not For Human Or Veterinary Use. Information Provided For Laboratory Research Purposes Only.
          </p>
        </div>
      </div>
    </div>
  );
}
