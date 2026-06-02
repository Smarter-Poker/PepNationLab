'use client';

/**
 * ProductResearchPanel — ONE research section, opened INSIDE the product detail
 * modal (no route navigation). Premium thick brushed-nickel frame, the same back
 * arrow used in the global header, short paragraphs, Title Case prose.
 *
 * Each toolbar button in ProductMonograph opens this panel at exactly one
 * section (`initialSection`): Research, Findings, Preparation, Spec Sheet, FAQs.
 * There is no cross-section tab nav — the back arrow returns to the modal.
 *
 * Research-Use-Only. Storage temperatures render in Fahrenheit.
 */
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import {
  type Compound,
  evidenceTier,
  wadaLabel,
  researchAreaLabel,
  RISK_META,
} from '@/lib/compounds';
import ReconstitutionCalculator from '@/components/research/ReconstitutionCalculator';

export type ResearchSection = 'profile' | 'findings' | 'prep' | 'spec' | 'faq';

interface Props {
  compound: Compound;
  primaryColor?: string;
  onClose: () => void;
  initialSection?: ResearchSection;
}

const cap: React.CSSProperties = { textTransform: 'capitalize' };

const SECTION_TITLE: Record<ResearchSection, string> = {
  profile: 'Research Profile',
  findings: 'Reported Findings',
  prep: 'Preparation',
  spec: 'Spec Sheet',
  faq: 'Frequently Asked Questions',
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

export default function ProductResearchPanel({ compound, primaryColor = '#00C4BC', onClose, initialSection = 'profile' }: Props) {
  const tier = evidenceTier(compound.evidence_tier);
  const risk = RISK_META[compound.risk_level];
  const isHighRisk = compound.risk_level === 'critical' || compound.risk_level === 'high';
  const id = compound.identity ?? {};
  const h = compound.handling ?? {};
  const section = initialSection;

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

  const faqs: { q: string; a: string }[] = [];
  if (compound.plain_summary) faqs.push({ q: `What Is ${compound.display_name}?`, a: compound.plain_summary });
  if (compound.mechanism) faqs.push({ q: 'How Does It Work?', a: compound.mechanism });
  if (compound.studied_for.length > 0) faqs.push({ q: 'What Is It Studied For?', a: compound.studied_for.join(', ') + '.' });
  if (compound.benefits) faqs.push({ q: 'What Findings Have Been Reported In Research?', a: compound.benefits });
  if (compound.side_effects) faqs.push({ q: 'What Side Effects Have Been Reported?', a: compound.side_effects });
  if (compound.warnings) faqs.push({ q: 'What Are The Warnings And Limitations?', a: compound.warnings });
  if (prepBits.length > 0) faqs.push({ q: 'How Should It Be Stored And Prepared?', a: prepBits.join('; ') + '.' });
  if (tier.blurb) faqs.push({ q: `What Does The ${tier.label} Evidence Tier Mean?`, a: tier.blurb });
  if (compound.regulatory || compound.wada_status) {
    faqs.push({ q: 'What Is Its Regulatory And Anti-Doping Status?', a: `${compound.regulatory ? compound.regulatory + ' ' : ''}${wadaLabel(compound.wada_status)}.` });
  }
  faqs.push({ q: 'Is It Approved For Human Use?', a: 'No. Every Product On Pep Nation Lab Is Sold Strictly For Laboratory And Research Use Only — Not For Human Or Veterinary Use.' });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${compound.display_name} ${SECTION_TITLE[section]}`}
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
        {/* Top bar: global back arrow + section title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.05), transparent)' }}>
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
          <span style={{ marginLeft: 'auto', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--silver)' }}>
            {SECTION_TITLE[section]}
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
              {compound.wada_status && compound.wada_status !== 'not_listed' && badge(wadaLabel(compound.wada_status), '#F6AD55')}
            </div>
          </header>

          <section style={{ minHeight: 160 }}>
            {section === 'profile' && (
              <div>
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

            {section === 'findings' && (
              <div>
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

            {section === 'prep' && (
              <div>
                <Label>Handling, Storage & Reconstitution</Label>
                <div style={{ marginBottom: 'var(--space-5)' }}>
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

            {section === 'spec' && (
              <div>
                <Label>Technical Spec Sheet</Label>
                <div style={{ marginBottom: 'var(--space-5)' }}>
                  <Fact label="Evidence Tier" value={tier.label} />
                  <Fact label="Category" value={compound.category} />
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
                  <Fact label="WADA Status" value={wadaLabel(compound.wada_status)} />
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

            {section === 'faq' && (
              <div>
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
                <Link
                  href={`/research/${compound.slug}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 'var(--space-5)',
                    padding: '12px 18px',
                    borderRadius: 'var(--radius-md)',
                    background: primaryColor,
                    color: '#04221F',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    textDecoration: 'none',
                  }}
                >
                  View The Full {compound.display_name} Research Page
                  <ArrowRight size={15} aria-hidden="true" />
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
