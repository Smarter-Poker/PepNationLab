'use client';

/**
 * ProductResearchPanel - research content shown INSIDE the product detail modal
 * as an in-app popup (no route navigation, no new browser tab). Premium thick
 * brushed-nickel frame, the global back arrow, short paragraphs, Title Case prose.
 *
 * Each toolbar button in ProductMonograph opens this panel at one section
 * (`initialSection`): Research, Findings, Preparation, Spec Sheet, COA, FAQs. From
 * the FAQ section, 'View The Full Research Page' switches to an in-app 'full' view
 * that stacks every section; its Back arrow returns to the FAQ (true back). The
 * top back arrow otherwise returns to the product modal.
 *
 * Research-Use-Only. Storage temperatures render in Fahrenheit. FAQ answers are
 * stripped of em/en dashes.
 */
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import {
  type Compound,
  evidenceTier,
  researchAreaLabel,
  intranasalDisplay,
  RISK_META,
} from '@/lib/compounds';
import ReconstitutionCalculator from '@/components/research/ReconstitutionCalculator';
import GlossaryText from '@/components/research/GlossaryText';
import IframeModal from '@/components/ui/IframeModal';
import { useModalA11y } from '@/lib/useModalA11y';

export type ResearchSection = 'profile' | 'findings' | 'prep' | 'spec' | 'coa' | 'faq';
type View = ResearchSection | 'full';

interface Props {
  compound: Compound;
  primaryColor?: string;
  onClose: () => void;
  initialSection?: ResearchSection;
  coaUrl?: string | null;
}

const cap: React.CSSProperties = { textTransform: 'capitalize' };

const VIEW_TITLE: Record<View, string> = {
  profile: 'Research Profile',
  findings: 'Reported Findings',
  prep: 'Preparation',
  spec: 'Spec Sheet',
  coa: 'Certificate Of Analysis',
  faq: 'Frequently Asked Questions',
  full: 'Full Research Profile',
};

// Convert Celsius temperatures embedded in free text to Fahrenheit.
// Ranges first ("2-8C" -> "36-46°F"), then single values ("-20C" -> "-4°F").
function toFahrenheit(value?: string | null): string | null {
  if (!value) return value ?? null;
  let out = value.replace(/(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)\s*°?\s*C\b/gi, (_m, a, b) => {
    const fa = Math.round(Number(a) * 9 / 5 + 32);
    const fb = Math.round(Number(b) * 9 / 5 + 32);
    return `${fa}-${fb}°F`;
  });
  out = out.replace(/(-?\d+(?:\.\d+)?)\s*°?\s*C\b/gi, (_m, a) => {
    const f = Math.round(Number(a) * 9 / 5 + 32);
    return `${f}°F`;
  });
  return out;
}

// Ban em/en dashes from FAQ copy (platform request). Replace with a comma.
function noEmDash(value: string): string {
  return value.replace(/\s*[-–-]\s*/g, ', ');
}

function Para({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ ...cap, color: '#C8D2DC', lineHeight: 1.75, fontSize: '0.95rem', margin: '0 0 var(--space-3)' }}>
      {typeof children === 'string' ? <GlossaryText text={children} /> : children}
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

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--white)', margin: '0 0 var(--space-3)', paddingBottom: 6, borderBottom: '2px solid var(--teal)' }}>
      {children}
    </h2>
  );
}

function Fact({ label, value, capValue = true }: { label: string; value: React.ReactNode; capValue?: boolean }) {
  if (value == null || value === '') return null;
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.07)', fontSize: '0.9rem' }}>
      <span style={{ flex: '0 0 40%', color: 'var(--silver)', fontWeight: 700 }}>{label}</span>
      <span style={{ ...(capValue ? cap : {}), flex: 1, color: 'var(--white)' }}>{value}</span>
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

function Eli5Formatter({ text, color }: { text: string; color: string }) {
  if (!text) return null;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  return (
    <div style={{ marginBottom: 'var(--space-4)', padding: '12px 16px', background: `${color}1A`, border: `1px solid ${color}33`, borderRadius: '12px' }}>
      <p style={{ margin: '0 0 8px', fontSize: '0.85rem', fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        <Sparkles size={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 6 }} />
        Explain Like I&apos;m 5
      </p>
      <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--white)', fontSize: '0.9rem', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {lines.map((line, i) => {
          const content = line.replace(/^[\*\-\d\.]+\s*/, '');
          return <li key={i}>{content}</li>;
        })}
      </ul>
    </div>
  );
}

export default function ProductResearchPanel({ compound, primaryColor = '#00C4BC', onClose, initialSection = 'profile', coaUrl = null }: Props) {
  const [view, setView] = useState<View>(initialSection);
  const [coaOpen, setCoaOpen] = useState(false);
  const tier = evidenceTier(compound.evidence_tier);
  const risk = RISK_META[compound.risk_level];
  const isHighRisk = compound.risk_level === 'critical' || compound.risk_level === 'high';
  const id = compound.identity ?? {};
  const h = compound.handling ?? {};
  const nasal = intranasalDisplay(compound);
  const full = view === 'full';
  const show = (k: ResearchSection) => view === k || full;

  const handleBack = () => {
    if (full) setView('faq');
    else onClose();
  };

  // A11y: initial focus, Tab trap, Escape-to-close, focus restore
  const dialogRef = useModalA11y<HTMLDivElement>(true, { onClose });

  const badge = (label: string, color: string) => (
    <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '5px 13px', borderRadius: 9999, background: `${color}1A`, border: `1px solid ${color}66`, color }}>
      {label}
    </span>
  );

  // --- Build an organized FAQ from the compound's data (works for any compound) ---
  const shelfDays = compound.reconstitution_shelf_days ?? h.reconstituted_days ?? null;
  const prepBits: string[] = [];
  if (h.form) prepBits.push(`Supplied As ${h.form}`);
  if (h.diluent) prepBits.push(`Reconstituted With ${h.diluent}`);
  if (h.storage_temp) prepBits.push(`Stored At ${toFahrenheit(h.storage_temp)}`);
  if (shelfDays != null) prepBits.push(`Used Within ${shelfDays} Days Of Reconstitution`);

  const faqsRaw: { q: string; a: string }[] = [];
  if (compound.plain_summary) faqsRaw.push({ q: `What Is ${compound.display_name}?`, a: compound.plain_summary });
  if (compound.mechanism) faqsRaw.push({ q: 'How Does It Work?', a: compound.mechanism });
  if (compound.studied_for.length > 0) faqsRaw.push({ q: 'What Is It Studied For?', a: compound.studied_for.join(', ') + '.' });
  if (compound.benefits) faqsRaw.push({ q: 'What Findings Have Been Reported In Research?', a: compound.benefits });
  if (compound.side_effects) faqsRaw.push({ q: 'What Side Effects Have Been Reported?', a: compound.side_effects });
  if (compound.warnings) faqsRaw.push({ q: 'What Are The Warnings And Limitations?', a: compound.warnings });
  if (prepBits.length > 0) faqsRaw.push({ q: 'How Should It Be Stored And Prepared?', a: prepBits.join('; ') + '.' });
  faqsRaw.push({ q: 'Can It Be Used As A Nasal Spray Instead Of An Injection?', a: nasal.nasal ? (nasal.status === 'established' ? `${nasal.routesLabel}. This compound has documented intranasal use as an alternative to injection. ${nasal.caveat ?? ''}`.trim() : `${nasal.routesLabel}. Intranasal use is supported by early research only. ${nasal.caveat ?? ''}`.trim()) : 'No. The established route for this compound is injection. There is no credible evidence supporting a nasal spray alternative.' });
  if (tier.blurb) faqsRaw.push({ q: `What Does The ${tier.label} Evidence Tier Mean?`, a: tier.blurb });
  if (compound.regulatory) {
    faqsRaw.push({ q: 'What Is Its Regulatory Status?', a: `${compound.regulatory}.` });
  }
  faqsRaw.push({ q: 'Is It Approved For Human Use?', a: 'No. Every Product On Pep Nation Lab Is Sold Strictly For Laboratory And Research Use Only. It Is Not For Human Or Veterinary Use.' });
  const faqs = faqsRaw.map((f) => ({ q: noEmDash(f.q), a: noEmDash(f.a) }));

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${compound.display_name} ${VIEW_TITLE[view]}`}
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
        {/* Top bar: back arrow + view title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.05), transparent)' }}>
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--white)', fontWeight: 700, fontSize: '0.9rem' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <Image src="/back-arrow.png" alt="Back" width={38} height={38} unoptimized style={{ objectFit: 'contain' }} />
            Back
          </button>
          <span style={{ marginLeft: 'auto', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--silver)' }}>
            {VIEW_TITLE[view]}
          </span>
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
            </div>
            
            {coaUrl && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
                <a
                  href={coaUrl}
                  onClick={(e) => { e.preventDefault(); setCoaOpen(true); }}
                  title="View Certificate of Analysis"
                  style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/coa-button.png" alt="View Certificate of Analysis" style={{ width: 220, height: 'auto', objectFit: 'contain' }} draggable={false} />
                </a>
              </div>
            )}
          </header>

          <section style={{ minHeight: 160 }}>
            {show('profile') && (
              <div style={{ marginBottom: full ? 'var(--space-6)' : 0 }}>
                {full && <SectionHeading>Research Profile</SectionHeading>}
                
                {compound.eli5_summary && (
                  <Eli5Formatter text={compound.eli5_summary} color={primaryColor} />
                )}

                {compound.plain_summary && <Para>{compound.plain_summary}</Para>}
                <div style={{ marginTop: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
                  <Fact label="Class" value={compound.compound_class} />
                  <Fact label="Molecular Target" value={compound.molecular_target} />
                  <Fact label="Sequence" value={id.sequence} />
                  <Fact label="Molecular Weight" value={id.molecular_weight} />
                  <Fact label="CAS" value={id.cas} capValue={false} />
                  <Fact label="Parent" value={id.parent} />
                </div>
                {compound.mechanism && (
                  <div style={{ marginBottom: 'var(--space-5)' }}>
                    <Label>Mechanism Of Action</Label>
                    <Para>{compound.mechanism}</Para>
                  </div>
                )}
                {compound.studied_for.length > 0 && (
                  <div style={{ marginBottom: 'var(--space-5)' }}>
                    <Label>Studied For</Label>
                    <Chips items={compound.studied_for} color={primaryColor} />
                  </div>
                )}
                {compound.research_areas.length > 0 && (
                  <div>
                    <Label>Research Areas</Label>
                    <Chips items={compound.research_areas.map(researchAreaLabel)} color="#A8B4C0" />
                  </div>
                )}
              </div>
            )}

            {show('findings') && (
              <div style={{ marginBottom: full ? 'var(--space-6)' : 0 }}>
                {full && <SectionHeading>Reported Findings</SectionHeading>}
                {compound.benefits && (
                  <div style={{ marginBottom: 'var(--space-5)' }}>
                    <Label>Reported Findings</Label>
                    <Para>{compound.benefits}</Para>
                  </div>
                )}
                {compound.side_effects && (
                  <div style={{ marginBottom: 'var(--space-5)' }}>
                    <Label>Reported Side Effects</Label>
                    <Para>{compound.side_effects}</Para>
                  </div>
                )}
                {compound.warnings && (
                  <div>
                    <Label>Warnings & Limitations</Label>
                    <Para>{compound.warnings}</Para>
                  </div>
                )}
                {!compound.benefits && !compound.side_effects && !compound.warnings && (
                  <Para>No Reported Findings Are On File For This Research Compound Yet.</Para>
                )}
              </div>
            )}

            {show('prep') && (
              <div style={{ marginBottom: full ? 'var(--space-6)' : 0 }}>
                {full ? <SectionHeading>Preparation</SectionHeading> : <Label>Handling, Storage & Reconstitution</Label>}
                <div style={{ marginBottom: 'var(--space-5)' }}>
                  <Fact label="Administration Route" value={nasal.routesLabel} />
                  <Fact label="Form" value={h.form} />
                  <Fact label="Diluent" value={h.diluent} />
                  <Fact label="Storage Temperature" value={toFahrenheit(h.storage_temp)} />
                  <Fact label="Light Sensitive" value={h.light_sensitive == null ? null : h.light_sensitive ? 'Yes' : 'No'} />
                  <Fact label="Freeze / Thaw" value={h.freeze_thaw} />
                  <Fact
                    label="Reconstituted Shelf Life"
                    value={shelfDays != null ? `${shelfDays} Days Refrigerated` : null}
                  />
                </div>
                {nasal.nasal && nasal.caveat && (
                  <p style={{ fontSize: '0.8rem', color: '#9FB0BD', lineHeight: 1.55, margin: '0 0 var(--space-4)' }}>{nasal.caveat}</p>
                )}
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

            {show('spec') && (
              <div style={{ marginBottom: full ? 'var(--space-6)' : 0 }}>
                {full ? <SectionHeading>Spec Sheet</SectionHeading> : <Label>Technical Spec Sheet</Label>}
                <div style={{ marginBottom: 'var(--space-5)' }}>
                  <Fact label="Evidence Tier" value={tier.label} />
                  <Fact label="Category" value={compound.category} />
                  <Fact label="Administration Route" value={nasal.routesLabel} />
                  <Fact label="Class" value={compound.compound_class} />
                  <Fact label="Molecular Target" value={compound.molecular_target} />
                  <Fact label="Sequence" value={id.sequence} />
                  <Fact label="Molecular Weight" value={id.molecular_weight} />
                  <Fact label="CAS" value={id.cas} capValue={false} />
                  <Fact label="Parent" value={id.parent} />
                  <Fact label="Form" value={h.form} />
                  <Fact label="Diluent" value={h.diluent} />
                  <Fact label="Storage Temperature" value={toFahrenheit(h.storage_temp)} />
                  <Fact label="Regulatory" value={compound.regulatory} />
                </div>
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

            {show('coa') && (
              <div style={{ marginBottom: full ? 'var(--space-6)' : 0 }}>
                {full ? <SectionHeading>Certificate Of Analysis</SectionHeading> : <Label>Certificate Of Analysis</Label>}
                <Para>
                  This Certificate Confirms The Identity And Specifications Of {compound.display_name}. A
                  Batch-Specific Laboratory Certificate Of Analysis, Documenting The Analytical Results For
                  Each Production Lot, Is Available On Request.
                </Para>


                <div style={{ marginBottom: 'var(--space-4)' }}>
                  <Label>Analytical Specifications</Label>
                  <Fact label="Identity (Mass Spectrometry)" value="Confirmed On The Batch Certificate" />
                  <Fact label="Purity (HPLC)" value="Reported On The Batch Certificate" />
                  <Fact label="Appearance" value={h.form ? h.form : 'Reported On The Batch Certificate'} />
                  <Fact label="Net Quantity Per Vial" value="Reported On The Batch Certificate" />
                </div>

                {/* Removed from here to move to the top */}
                  <div style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.10)' }}>
                    <Para>
                      A Batch-Specific Certificate Of Analysis For The Current Lot Is Available On Request.
                      Contact Your Agent To Receive The Latest Lot Certificate For This Product.
                    </Para>
                  </div>
              </div>
            )}

            {show('faq') && (
              <div>
                {full && <SectionHeading>Frequently Asked Questions</SectionHeading>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {faqs.map((f, i) => (
                    <div
                      key={i}
                      style={{
                        padding: 'var(--space-4)',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.07)',
                      }}
                    >
                      <p style={{ margin: '0 0 6px', fontWeight: 800, fontSize: '0.95rem', color: primaryColor }}>
                        {f.q}
                      </p>
                      <p style={{ ...cap, margin: 0, color: '#C8D2DC', lineHeight: 1.7, fontSize: '0.9rem' }}>
                        {f.a}
                      </p>
                    </div>
                  ))}
                </div>
                {!full && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-5)' }}>
                    <button
                      type="button"
                      onClick={() => setView('full')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '12px 20px',
                        borderRadius: 'var(--radius-md)',
                        background: primaryColor,
                        color: '#04221F',
                        fontWeight: 800,
                        fontSize: '0.88rem',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      View The Full {compound.display_name} Research Page
                      <ArrowRight size={15} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          <p style={{ fontSize: '0.74rem', color: 'var(--grey-400)', lineHeight: 1.5, margin: 'var(--space-5) 0 0', textAlign: 'center' }}>
            Research Use Only. Not For Human Or Veterinary Use. Information Provided For Laboratory Research Purposes Only.
          </p>
        </div>

        {coaOpen && coaUrl ? (
          <IframeModal url={coaUrl} title={`${compound.display_name} Certificate Of Analysis`} onClose={() => setCoaOpen(false)} />
        ) : null}
      </div>
    </div>
  );
}
