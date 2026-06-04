'use client';

/**
 * MonographTabs — the full compound research profile, organized into tabs with
 * short paragraphs instead of one endless stack. Includes a sticky Back control
 * so the page is never a dead end (router.back, with a Research Library fallback).
 *
 * Research-Use-Only. Title Case on prose via `capitalize`.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, FileText, FlaskConical, Beaker, Snowflake, ShieldAlert, BookOpen, Microscope,
} from 'lucide-react';
import {
  type Compound,
  type RelatedCompoundRef,
  evidenceTier,
  wadaLabel,
  researchAreaLabel,
  RISK_META,
} from '@/lib/compounds';
import ReconstitutionCalculator from '@/components/research/ReconstitutionCalculator';
import GlossaryText from '@/components/research/GlossaryText';
import SequenceViewer from '@/components/research/SequenceViewer';
import IframeModal from '@/components/ui/IframeModal';

interface Props {
  compound: Compound;
  related?: RelatedCompoundRef[];
}

const cap: React.CSSProperties = { textTransform: 'capitalize' };

function Para({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ ...cap, color: '#C8D2DC', lineHeight: 1.7, fontSize: '0.92rem', margin: '0 0 var(--space-3)' }}>
      {typeof children === 'string' ? <GlossaryText text={children} /> : children}
    </p>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--silver)', margin: '0 0 6px' }}>
      {children}
    </p>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '') return null;
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '0.88rem' }}>
      <span style={{ flex: '0 0 42%', color: 'var(--silver)', fontWeight: 700 }}>{label}</span>
      <span style={{ ...cap, flex: 1, color: 'var(--white)' }}>{value}</span>
    </div>
  );
}

function Chips({ items, color = '#A8B4C0' }: { items: string[]; color?: string }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map((it) => (
        <span key={it} style={{ ...cap, fontSize: '0.78rem', fontWeight: 600, padding: '4px 10px', borderRadius: 9999, background: `${color}14`, border: `1px solid ${color}33`, color: '#D0DAE4', whiteSpace: 'nowrap' }}>
          {it}
        </span>
      ))}
    </div>
  );
}

export default function MonographTabs({ compound, related = [] }: Props) {
  const router = useRouter();
  const tier = evidenceTier(compound.evidence_tier);
  const risk = RISK_META[compound.risk_level];
  const isHighRisk = compound.risk_level === 'critical' || compound.risk_level === 'high';
  const id = compound.identity ?? {};
  const h = compound.handling ?? {};
  const teal = '#00C4BC';

  // Build only the tabs that have content.
  const tabs: Array<{ key: string; label: string; icon: React.ReactNode }> = [
    { key: 'overview', label: 'Overview', icon: <Microscope size={15} aria-hidden="true" /> },
  ];
  if (compound.mechanism) tabs.push({ key: 'mechanism', label: 'Mechanism', icon: <FlaskConical size={15} aria-hidden="true" /> });
  if (compound.studied_for.length > 0 || compound.research_areas.length > 0 || compound.benefits) {
    tabs.push({ key: 'studied', label: 'Studied For', icon: <Beaker size={15} aria-hidden="true" /> });
  }
  tabs.push({ key: 'handling', label: 'Handling', icon: <Snowflake size={15} aria-hidden="true" /> });
  if (compound.side_effects || compound.warnings || compound.regulatory || compound.wada_status) {
    tabs.push({ key: 'safety', label: 'Safety', icon: <ShieldAlert size={15} aria-hidden="true" /> });
  }
  if (compound.sources.length > 0) tabs.push({ key: 'sources', label: 'Sources', icon: <BookOpen size={15} aria-hidden="true" /> });

  const [active, setActive] = useState('overview');
  const [modalUrl, setModalUrl] = useState<string | null>(null);

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: 'var(--space-4) var(--space-4) var(--space-8)' }}>
      {/* Sticky Back / actions bar — never a dead end */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
          padding: 'var(--space-3) 0',
          background: 'var(--black)',
          marginBottom: 'var(--space-3)',
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined' && window.history.length > 1) router.back();
            else router.push('/research');
          }}
          className="btn-ghost"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back
        </button>
        <Link
          href={`/research/${compound.slug}/spec`}
          className="btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <FileText size={16} aria-hidden="true" />
          Spec Sheet
        </Link>
      </div>

      {/* Centered header */}
      <header style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
        <h1 style={{ fontSize: '1.7rem', fontWeight: 900, color: 'var(--white)', margin: 0 }}>
          {compound.display_name}
        </h1>
        {compound.aliases.length > 0 && (
          <p style={{ ...cap, fontSize: '0.82rem', color: 'var(--silver)', margin: '6px 0 0' }}>
            Also Known As: {compound.aliases.join(', ')}
          </p>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 'var(--space-3)' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 9999, background: `${tier.color}1A`, border: `1px solid ${tier.color}55`, color: tier.color }}>
            {tier.label}
          </span>
          {compound.category && (
            <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 9999, background: `${teal}20`, border: `1px solid ${teal}40`, color: teal }}>
              {compound.category}
            </span>
          )}
          {isHighRisk && (
            <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 9999, background: risk.bg, border: `1px solid ${risk.color}`, color: risk.color }}>
              {risk.label} Risk
            </span>
          )}
          {compound.wada_status && compound.wada_status !== 'not_listed' && (
            <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 9999, background: 'rgba(246,173,85,0.12)', border: '1px solid #F6AD55', color: '#F6AD55' }}>
              {wadaLabel(compound.wada_status)}
            </span>
          )}
        </div>
      </header>

      {/* Tab bar */}
      <div
        role="tablist"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 6, borderBottom: '1px solid rgba(192,184,168,0.2)', marginBottom: 'var(--space-4)' }}
      >
        {tabs.map((t) => {
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 14px',
                border: 'none',
                borderBottom: `2px solid ${isActive ? teal : 'transparent'}`,
                background: 'transparent',
                color: isActive ? 'var(--white)' : 'var(--silver)',
                fontWeight: isActive ? 800 : 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                marginBottom: -1,
              }}
            >
              <span style={{ color: isActive ? teal : 'var(--silver)', display: 'flex' }}>{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab panels */}
      <section role="tabpanel" className="glass-panel" style={{ padding: 'var(--space-5)', minHeight: 160 }}>
        {active === 'overview' && (
          <div>
            {compound.plain_summary && <Para>{compound.plain_summary}</Para>}
            <div style={{ marginTop: 'var(--space-2)' }}>
              <Fact label="Class" value={compound.compound_class} />
              <Fact label="Molecular Target" value={compound.molecular_target} />
              <Fact label="Sequence" value={id.sequence} />
              <Fact label="Molecular Weight" value={compound.molecular_weight_da ? `${compound.molecular_weight_da} Da` : id.molecular_weight} />
              <Fact label="Year Discovered" value={compound.year_discovered} />
              <Fact label="PubMed Citations" value={compound.pubmed_citation_count?.toLocaleString()} />
              <Fact label="Clinical Trials" value={(compound.active_trial_count || compound.completed_trial_count) ? String((compound.active_trial_count ?? 0) + (compound.completed_trial_count ?? 0)) : null} />
              <Fact label="CAS" value={id.cas} />
              <Fact label="Parent" value={id.parent} />
            </div>
            <div style={{ marginTop: 'var(--space-4)' }}>
              <SequenceViewer sequence={id.sequence} molecularWeight={compound.molecular_weight_da ? `${compound.molecular_weight_da} Da` : id.molecular_weight} />
            </div>
          </div>
        )}

        {active === 'mechanism' && (
          <div>
            <Label>Mechanism Of Action</Label>
            <Para>{compound.mechanism}</Para>
          </div>
        )}

        {active === 'studied' && (
          <div>
            {compound.studied_for.length > 0 && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <Label>Studied For</Label>
                <Chips items={compound.studied_for} color={teal} />
              </div>
            )}
            {compound.research_areas.length > 0 && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <Label>Research Areas</Label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {compound.research_areas.map((area) => (
                    <Link
                      key={area}
                      href={`/research/area/${area}`}
                      style={{ ...cap, fontSize: '0.78rem', fontWeight: 700, padding: '4px 10px', borderRadius: 9999, border: `1px solid ${teal}`, color: teal, background: `${teal}14`, textDecoration: 'none' }}
                    >
                      {researchAreaLabel(area)}
                    </Link>
                  ))}
                </div>
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

        {active === 'handling' && (
          <div>
            <div style={{ marginBottom: 'var(--space-4)' }}>
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
            {(compound.half_life || compound.pk_summary) && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <Label>Pharmacokinetics</Label>
                {compound.half_life && (
                  <p style={{ margin: '0 0 6px', fontSize: '0.95rem' }}>
                    <span style={{ color: 'var(--silver)', fontWeight: 700 }}>Half-Life: </span>
                    <span style={{ color: teal, fontWeight: 800 }}>{compound.half_life}</span>
                  </p>
                )}
                {compound.pk_summary && <Para>{compound.pk_summary}</Para>}
              </div>
            )}
            {h.notes && <Para>{h.notes}</Para>}
            <ReconstitutionCalculator />
          </div>
        )}

        {active === 'safety' && (
          <div>
            {compound.warnings && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <Label>Warnings & Limitations</Label>
                <Para>{compound.warnings}</Para>
              </div>
            )}
            {compound.side_effects && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
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

        {active === 'sources' && (
          <div>
            <Label>Sources</Label>
            <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {compound.sources.map((src, i) => {
                const href = /^https?:\/\//i.test(src) ? src : `https://${src}`;
                return (
                  <li key={i} style={{ wordBreak: 'break-all', fontSize: '0.82rem' }}>
                    <button 
                      onClick={() => setModalUrl(href)} 
                      style={{ 
                        color: teal, 
                        background: 'none', 
                        border: 'none', 
                        padding: 0, 
                        cursor: 'pointer', 
                        textAlign: 'left',
                        textDecoration: 'underline'
                      }}
                    >
                      {src}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {related.length > 0 && (
        <section style={{ marginTop: 'var(--space-5)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--white)', margin: '0 0 var(--space-3)' }}>
            Related Compounds
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
            {related.map((r) => {
              const t = evidenceTier(r.evidence_tier);
              return (
                <Link
                  key={r.slug}
                  href={`/research/${r.slug}`}
                  className="glass-panel"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-lg, 12px)',
                    textDecoration: 'none',
                  }}
                >
                  <span style={{ ...cap, fontWeight: 700, color: 'var(--white)', fontSize: '0.92rem' }}>
                    {r.display_name}
                  </span>
                  <span style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 9999, background: `${t.color}1A`, border: `1px solid ${t.color}55`, color: t.color }}>
                      {t.label}
                    </span>
                    {r.category && (
                      <span style={{ ...cap, fontSize: '0.72rem', color: 'var(--silver)' }}>{r.category}</span>
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <p style={{ fontSize: '0.74rem', color: 'var(--grey-400)', lineHeight: 1.5, margin: 'var(--space-4) 0 0', textAlign: 'center' }}>
        Research Use Only. Not For Human Or Veterinary Use. Information Provided For Laboratory Research Purposes Only.
      </p>

      {modalUrl && (
        <IframeModal url={modalUrl} onClose={() => setModalUrl(null)} />
      )}
    </main>
  );
}
