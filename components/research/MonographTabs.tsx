'use client';

/**
 * MonographTabs v2 - comprehensive compound research profile with 8 tabs:
 *   1. Overview       - summary, key facts, purity, identity, stack components
 *   2. Analytics      - efficacy scores chart (NEW), top application domains
 *   3. Mechanism      - MOA, molecular target, PK summary
 *   4. Studied For    - studied_for, research_areas, benefits, best_stacked_with
 *   5. Handling       - reconstitution, shelf life, storage, half-life, PK
 *   6. Safety         - warnings, side_effects, risk_reasons
 *   7. Research Data  - trials metrics, citations, external DB links (NEW)
 *   8. Sources        - linked references
 *
 * Research-Use-Only. Title Case on prose via `capitalize`.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, FileText, FlaskConical, Beaker, Snowflake, ShieldAlert, BookOpen, Microscope, Sparkles,
  BarChart3, TrendingUp, AlertTriangle, Check, Zap, ExternalLink,
} from 'lucide-react';
import {
  type Compound,
  type RelatedCompoundRef,
  evidenceTier,
  researchAreaLabel,
  RISK_META,
} from '@/lib/compounds';
import ReconstitutionCalculator from '@/components/research/ReconstitutionCalculator';
import GlossaryText from '@/components/research/GlossaryText';
import SequenceViewer from '@/components/research/SequenceViewer';
import PinToCompareButton from '@/components/research/PinToCompareButton';
import ResearchCartButton from '@/components/research/ResearchCartButton';
import EfficacyScoreChart from '@/components/research/EfficacyScoreChart';
import TrialsMetricsPanel from '@/components/research/TrialsMetricsPanel';
import IframeModal from '@/components/ui/IframeModal';
import { isSocialPlatformUrl } from '@/lib/ArticleProxyUtils';

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

function SectionDivider({ title }: { title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0 14px' }}>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
      <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>{title}</span>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
    </div>
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

function Chips({ items, color = '#A8B4C0', linkPrefix }: { items: string[]; color?: string; linkPrefix?: string }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map((it) =>
        linkPrefix ? (
          <Link
            key={it}
            href={`${linkPrefix}${it}`}
            style={{ fontSize: '0.78rem', fontWeight: 700, padding: '4px 10px', borderRadius: 9999, background: `${color}14`, border: `1px solid ${color}33`, color, textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            {it}
          </Link>
        ) : (
          <span key={it} style={{ ...cap, fontSize: '0.78rem', fontWeight: 600, padding: '4px 10px', borderRadius: 9999, background: `${color}14`, border: `1px solid ${color}33`, color: '#D0DAE4', whiteSpace: 'nowrap' }}>
            {it}
          </span>
        )
      )}
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

function InfoCard({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: `${color}08`,
      border: `1px solid ${color}20`,
      borderRadius: 12,
      padding: '14px 16px',
      marginBottom: 12,
    }}>
      {children}
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
  const hasEfficacy = compound.efficacy_scores && Object.keys(compound.efficacy_scores).length > 0;
  const hasTrialsData = (compound.pubmed_citation_count ?? 0) > 0 || (compound.active_trial_count ?? 0) > 0 || (compound.completed_trial_count ?? 0) > 0 || compound.year_discovered;
  const hasStackData = compound.best_stacked_with && compound.best_stacked_with.length > 0;

  // Build tabs - only show tabs with content
  const tabs: Array<{ key: string; label: string; icon: React.ReactNode; badge?: string }> = [
    { key: 'overview', label: 'Overview', icon: <Microscope size={15} aria-hidden="true" /> },
  ];

  if (hasEfficacy) {
    tabs.push({ key: 'analytics', label: 'Analytics', icon: <BarChart3 size={15} aria-hidden="true" />, badge: 'NEW' });
  }

  if (compound.mechanism) {
    tabs.push({ key: 'mechanism', label: 'Mechanism', icon: <FlaskConical size={15} aria-hidden="true" /> });
  }

  if (compound.studied_for.length > 0 || compound.research_areas.length > 0 || compound.benefits || hasStackData) {
    tabs.push({ key: 'studied', label: 'Studied For', icon: <Beaker size={15} aria-hidden="true" /> });
  }

  tabs.push({ key: 'handling', label: 'Handling', icon: <Snowflake size={15} aria-hidden="true" /> });

  if (compound.side_effects || compound.warnings || compound.regulatory || (compound.risk_reasons && compound.risk_reasons.length > 0)) {
    tabs.push({ key: 'safety', label: 'Safety', icon: <ShieldAlert size={15} aria-hidden="true" /> });
  }

  if (hasTrialsData) {
    tabs.push({ key: 'research_data', label: 'Research Data', icon: <TrendingUp size={15} aria-hidden="true" />, badge: 'NEW' });
  }

  if (compound.sources.length > 0) {
    tabs.push({ key: 'sources', label: 'Sources', icon: <BookOpen size={15} aria-hidden="true" /> });
  }

  const [active, setActive] = useState('overview');
  const [modalUrl, setModalUrl] = useState<string | null>(null);

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: 'var(--space-4) var(--space-4) var(--space-8)' }}>
      {/* Sticky Back / actions bar */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
          padding: 'var(--space-3) 0',
          background: 'var(--black)',
          marginBottom: 'var(--space-3)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PinToCompareButton
            compoundSlug={compound.slug}
            compoundName={compound.display_name}
            evidenceTierKey={compound.evidence_tier}
            size="sm"
          />
          <ResearchCartButton
            productName={compound.display_name}
            size="sm"
          />
          <Link
            href={`/research/${compound.slug}/spec`}
            className="btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <FileText size={16} aria-hidden="true" />
            Spec Sheet
          </Link>
        </div>
      </div>

      {/* Header */}
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
          {compound.is_glp1 && (
            <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 9999, background: 'rgba(159,122,234,0.15)', border: '1px solid rgba(159,122,234,0.5)', color: '#9F7AEA' }}>
              GLP-1 Class
            </span>
          )}
          {compound.is_pro_angiogenic && (
            <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 9999, background: 'rgba(246,173,85,0.12)', border: '1px solid rgba(246,173,85,0.4)', color: '#F6AD55' }}>
              Pro-Angiogenic
            </span>
          )}
        </div>
      </header>

      {/* Tab bar */}
      <div
        role="tablist"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 4, borderBottom: '1px solid rgba(192,184,168,0.2)', marginBottom: 'var(--space-4)', overflowX: 'auto' }}
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
                fontSize: '0.82rem',
                cursor: 'pointer',
                marginBottom: -1,
                whiteSpace: 'nowrap',
                position: 'relative',
              }}
            >
              <span style={{ color: isActive ? teal : 'var(--silver)', display: 'flex' }}>{t.icon}</span>
              {t.label}
              {t.badge && (
                <span style={{
                  fontSize: '0.52rem',
                  fontWeight: 900,
                  letterSpacing: '0.06em',
                  color: '#00C4BC',
                  background: 'rgba(0,196,188,0.15)',
                  border: '1px solid rgba(0,196,188,0.3)',
                  padding: '1px 4px',
                  borderRadius: 3,
                }}>
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab panels */}
      <section role="tabpanel" className="glass-panel" style={{ padding: 'var(--space-5)', minHeight: 160 }}>

        {/* ── OVERVIEW ─────────────────────────────────────────────────── */}
        {active === 'overview' && (
          <div>
            {compound.eli5_summary && (
              <Eli5Formatter text={compound.eli5_summary} color={teal} />
            )}

            {compound.plain_summary && <Para>{compound.plain_summary}</Para>}

            <SectionDivider title="Identity & Classification" />
            <Fact label="Class" value={compound.compound_class} />
            <Fact label="Molecular Target" value={compound.molecular_target} />
            <Fact label="Category" value={compound.category} />
            <Fact label="Year Discovered" value={compound.year_discovered} />
            <Fact label="Molecular Weight" value={compound.molecular_weight_da ? `${compound.molecular_weight_da} Da` : id.molecular_weight} />
            <Fact label="CAS Number" value={id.cas} />
            <Fact label="Parent Compound" value={id.parent} />

            {/* Purity bar */}
            {compound.purity_percentage != null && (
              <div style={{ display: 'flex', gap: 'var(--space-3)', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '0.88rem', alignItems: 'center' }}>
                <span style={{ flex: '0 0 42%', color: 'var(--silver)', fontWeight: 700 }}>Purity</span>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    fontWeight: 800,
                    color: compound.purity_percentage >= 99 ? '#68D391' : compound.purity_percentage >= 95 ? '#F6AD55' : '#FC8181',
                    minWidth: 44,
                  }}>
                    {compound.purity_percentage}%
                  </span>
                  <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', maxWidth: 160 }}>
                    <div style={{
                      height: '100%',
                      width: `${compound.purity_percentage}%`,
                      background: compound.purity_percentage >= 99 ? '#68D391' : '#F6AD55',
                      borderRadius: 3,
                    }} />
                  </div>
                  {compound.coa_url && (
                    <a href={compound.coa_url} onClick={(e) => { e.preventDefault(); (isSocialPlatformUrl(compound.coa_url!) ? window.open(compound.coa_url!, '_blank') : setModalUrl(compound.coa_url!)); }} style={{ fontSize: '0.72rem', color: teal, textDecoration: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <ExternalLink size={11} /> COA
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Flags */}
            {(compound.is_glp1 || compound.is_pro_angiogenic || compound.is_stack) && (
              <>
                <SectionDivider title="Classification Flags" />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {compound.is_glp1 && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(159,122,234,0.1)', border: '1px solid rgba(159,122,234,0.25)' }}>
                      <Check size={13} color="#9F7AEA" />
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#9F7AEA' }}>GLP-1 / Incretin Class</span>
                    </div>
                  )}
                  {compound.is_pro_angiogenic && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(246,173,85,0.1)', border: '1px solid rgba(246,173,85,0.25)' }}>
                      <AlertTriangle size={13} color="#F6AD55" />
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#F6AD55' }}>Pro-Angiogenic - promotes new vessel growth</span>
                    </div>
                  )}
                  {compound.is_stack && compound.stack_components && compound.stack_components.length > 0 && (
                    <div style={{ width: '100%', marginTop: 4 }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Stack Components</div>
                      <Chips items={compound.stack_components} color="#9F7AEA" />
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Quick stats row */}
            {(compound.pubmed_citation_count || compound.active_trial_count || compound.completed_trial_count) && (
              <>
                <SectionDivider title="Research Metrics at a Glance" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8 }}>
                  {compound.pubmed_citation_count != null && (
                    <div style={{ textAlign: 'center', padding: '10px 8px', borderRadius: 10, background: 'rgba(0,196,188,0.06)', border: '1px solid rgba(0,196,188,0.15)' }}>
                      <div style={{ fontSize: '1.3rem', fontWeight: 900, color: teal }}>{compound.pubmed_citation_count.toLocaleString()}</div>
                      <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>PubMed Citations</div>
                    </div>
                  )}
                  {((compound.active_trial_count ?? 0) + (compound.completed_trial_count ?? 0)) > 0 && (
                    <div style={{ textAlign: 'center', padding: '10px 8px', borderRadius: 10, background: 'rgba(104,211,145,0.06)', border: '1px solid rgba(104,211,145,0.15)' }}>
                      <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#68D391' }}>{(compound.active_trial_count ?? 0) + (compound.completed_trial_count ?? 0)}</div>
                      <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>Clinical Trials</div>
                      {(compound.active_trial_count ?? 0) > 0 && <div style={{ fontSize: '0.58rem', color: '#68D391', fontWeight: 700 }}>{compound.active_trial_count} Active</div>}
                    </div>
                  )}
                  {compound.typical_frequency && (
                    <div style={{ textAlign: 'center', padding: '10px 8px', borderRadius: 10, background: 'rgba(246,173,85,0.06)', border: '1px solid rgba(246,173,85,0.15)', gridColumn: 'span 2' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 3 }}>
                        <Zap size={12} color="#F6AD55" />
                        <div style={{ fontSize: '0.65rem', color: '#F6AD55', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Typical Frequency</div>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600, lineHeight: 1.3 }}>{compound.typical_frequency}</div>
                    </div>
                  )}
                </div>
              </>
            )}

            <div style={{ marginTop: 'var(--space-4)' }}>
              <SequenceViewer sequence={id.sequence} molecularWeight={compound.molecular_weight_da ? `${compound.molecular_weight_da} Da` : id.molecular_weight} />
            </div>
          </div>
        )}

        {/* ── ANALYTICS (NEW) ──────────────────────────────────────── */}
        {active === 'analytics' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: teal, marginBottom: 4 }}>
                Application Domain Efficacy Profile
              </div>
              <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.6 }}>
                Per-domain efficacy scores derived from compound research metadata. Scores represent the strength of research evidence and mechanistic alignment with each application area (0–100 scale).
              </p>
            </div>

            {hasEfficacy && (
              <EfficacyScoreChart
                scores={compound.efficacy_scores!}
                title={`${compound.display_name} - Research Efficacy Profile`}
                accentColor={teal}
              />
            )}

            {/* Best stacked with context in analytics */}
            {hasStackData && (
              <>
                <SectionDivider title="Synergy Potential" />
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
                    Best Stacked With
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {compound.best_stacked_with!.map((slug) => (
                      <Link
                        key={slug}
                        href={`/research/${slug}`}
                        style={{ fontSize: '0.78rem', fontWeight: 700, padding: '4px 10px', borderRadius: 9999, background: 'rgba(246,173,85,0.1)', border: '1px solid rgba(246,173,85,0.3)', color: '#F6AD55', textDecoration: 'none' }}
                      >
                        {slug} →
                      </Link>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Research breadth */}
            {compound.research_areas.length > 0 && (
              <>
                <SectionDivider title="Research Coverage" />
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
                    {compound.research_areas.length} Application Area{compound.research_areas.length > 1 ? 's' : ''} - {compound.research_areas.length >= 6 ? 'Exceptionally broad' : compound.research_areas.length >= 4 ? 'Wide coverage' : compound.research_areas.length >= 2 ? 'Moderate coverage' : 'Focused scope'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {compound.research_areas.map((area) => (
                      <Link
                        key={area}
                        href={`/research/area/${area}`}
                        style={{ fontSize: '0.78rem', fontWeight: 700, padding: '4px 10px', borderRadius: 9999, background: `${teal}14`, border: `1px solid ${teal}33`, color: teal, textDecoration: 'none' }}
                      >
                        {researchAreaLabel(area)}
                      </Link>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── MECHANISM ────────────────────────────────────────────── */}
        {active === 'mechanism' && (
          <div>
            {compound.compound_class && (
              <InfoCard color={teal}>
                <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>Compound Class</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: teal }}>{compound.compound_class}</div>
              </InfoCard>
            )}
            {compound.molecular_target && (
              <InfoCard color="#9F7AEA">
                <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>Molecular Target</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#9F7AEA', lineHeight: 1.4 }}>{compound.molecular_target}</div>
              </InfoCard>
            )}

            <Label>Mechanism of Action</Label>
            <Para>{compound.mechanism}</Para>

            {compound.pk_summary && (
              <>
                <SectionDivider title="Pharmacokinetics" />
                {compound.half_life && (
                  <p style={{ margin: '0 0 8px', fontSize: '0.95rem' }}>
                    <span style={{ color: 'var(--silver)', fontWeight: 700 }}>Half-Life: </span>
                    <span style={{ color: teal, fontWeight: 800 }}>{compound.half_life}</span>
                    {compound.measured_half_life_hours && <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem', marginLeft: 8 }}>(Measured: {compound.measured_half_life_hours}h)</span>}
                    {compound.predicted_half_life_hours && <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.78rem', marginLeft: 8 }}>(Predicted: {compound.predicted_half_life_hours}h)</span>}
                  </p>
                )}
                {compound.typical_frequency && (
                  <p style={{ margin: '0 0 10px', fontSize: '0.88rem' }}>
                    <span style={{ color: 'var(--silver)', fontWeight: 700 }}>Typical Frequency: </span>
                    <span style={{ color: 'rgba(255,255,255,0.8)' }}>{compound.typical_frequency}</span>
                  </p>
                )}
                <Para>{compound.pk_summary}</Para>
              </>
            )}

            {/* External ID quick links in mechanism tab */}
            {(() => {
              const ext = compound as unknown as Record<string, unknown>;
              const chemblId = typeof ext.chembl_id === 'string' ? ext.chembl_id : null;
              const uniprotId = typeof ext.uniprot_id === 'string' ? ext.uniprot_id : null;
              if (!chemblId && !uniprotId) return null;
              return (
                <>
                  <SectionDivider title="Database References" />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {chemblId && (
                      <a href={`https://www.ebi.ac.uk/chembl/compound_report_card/${chemblId}/`} onClick={(e) => { e.preventDefault(); (isSocialPlatformUrl(`https://www.ebi.ac.uk/chembl/compound_report_card/${chemblId}/`) ? window.open(`https://www.ebi.ac.uk/chembl/compound_report_card/${chemblId}/`, '_blank') : setModalUrl(`https://www.ebi.ac.uk/chembl/compound_report_card/${chemblId}/`)); }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: teal, textDecoration: 'none', fontWeight: 700, padding: '5px 10px', borderRadius: 6, background: 'rgba(0,196,188,0.08)', border: '1px solid rgba(0,196,188,0.2)' }}>
                        <ExternalLink size={12} /> ChEMBL: {chemblId}
                      </a>
                    )}
                    {uniprotId && (
                      <a href={`https://www.uniprot.org/uniprotkb/${uniprotId}/entry`} onClick={(e) => { e.preventDefault(); (isSocialPlatformUrl(`https://www.uniprot.org/uniprotkb/${uniprotId}/entry`) ? window.open(`https://www.uniprot.org/uniprotkb/${uniprotId}/entry`, '_blank') : setModalUrl(`https://www.uniprot.org/uniprotkb/${uniprotId}/entry`)); }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: '#9F7AEA', textDecoration: 'none', fontWeight: 700, padding: '5px 10px', borderRadius: 6, background: 'rgba(159,122,234,0.08)', border: '1px solid rgba(159,122,234,0.2)' }}>
                        <ExternalLink size={12} /> UniProt: {uniprotId}
                      </a>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* ── STUDIED FOR ──────────────────────────────────────────── */}
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
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <Label>Reported In Research</Label>
                <Para>{compound.benefits}</Para>
              </div>
            )}

            {/* Best Stacked With - now shown here with links */}
            {hasStackData && (
              <>
                <SectionDivider title="Stack Compatibility" />
                <div style={{ marginBottom: 12 }}>
                  <Label>Best Stacked With</Label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {compound.best_stacked_with!.map((slug) => (
                      <Link
                        key={slug}
                        href={`/research/${slug}`}
                        style={{ fontSize: '0.8rem', fontWeight: 700, padding: '5px 12px', borderRadius: 9999, background: 'rgba(246,173,85,0.1)', border: '1px solid rgba(246,173,85,0.3)', color: '#F6AD55', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                      >
                        {slug} <ExternalLink size={11} />
                      </Link>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Stack components if this is a pre-made combo */}
            {compound.is_stack && compound.stack_components && compound.stack_components.length > 0 && (
              <>
                <SectionDivider title="Pre-Formulated Stack" />
                <div style={{ marginBottom: 12 }}>
                  <Label>Component Compounds</Label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {compound.stack_components.map((slug) => (
                      <Link
                        key={slug}
                        href={`/research/${slug}`}
                        style={{ fontSize: '0.8rem', fontWeight: 700, padding: '5px 12px', borderRadius: 9999, background: 'rgba(159,122,234,0.1)', border: '1px solid rgba(159,122,234,0.3)', color: '#9F7AEA', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                      >
                        {slug} <ExternalLink size={11} />
                      </Link>
                    ))}
                  </div>
                  {compound.stack_rationale && <Para>{compound.stack_rationale}</Para>}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── HANDLING ─────────────────────────────────────────────── */}
        {active === 'handling' && (
          <div>
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <Fact label="Form" value={h.form} />
              <Fact label="Diluent" value={h.diluent} />
              <Fact label="Storage Temperature" value={h.storage_temp} />
              <Fact label="Light Sensitive" value={h.light_sensitive == null ? null : h.light_sensitive ? 'Yes - Protect from light' : 'No'} />
              <Fact label="Freeze / Thaw" value={h.freeze_thaw} />
              <Fact label="Typical Frequency" value={compound.typical_frequency} />
              <Fact
                label="Reconstituted Shelf Life"
                value={(compound.reconstitution_shelf_days ?? h.reconstituted_days) != null
                  ? <span style={{ color: (compound.reconstitution_shelf_days ?? h.reconstituted_days ?? 0) >= 28 ? '#68D391' : (compound.reconstitution_shelf_days ?? h.reconstituted_days ?? 0) < 14 ? '#FC8181' : '#F6AD55', fontWeight: 700 }}>
                      {compound.reconstitution_shelf_days ?? h.reconstituted_days} Days Refrigerated
                    </span>
                  : null}
              />
              {/* Purity in handling context */}
              {compound.purity_percentage != null && (
                <div style={{ display: 'flex', gap: 'var(--space-3)', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '0.88rem', alignItems: 'center' }}>
                  <span style={{ flex: '0 0 42%', color: 'var(--silver)', fontWeight: 700 }}>Purity</span>
                  <span style={{ flex: 1, color: compound.purity_percentage >= 99 ? '#68D391' : '#F6AD55', fontWeight: 800 }}>
                    {compound.purity_percentage}% {compound.purity_percentage >= 99 ? '- Pharmaceutical Grade' : compound.purity_percentage >= 98 ? '- High Purity' : '- Research Grade'}
                  </span>
                </div>
              )}
            </div>

            {(compound.half_life || compound.pk_summary) && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <Label>Pharmacokinetics</Label>
                {compound.half_life && (
                  <p style={{ margin: '0 0 6px', fontSize: '0.95rem' }}>
                    <span style={{ color: 'var(--silver)', fontWeight: 700 }}>Half-Life: </span>
                    <span style={{ color: teal, fontWeight: 800 }}>{compound.half_life}</span>
                    {compound.measured_half_life_hours && <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>Measured: {compound.measured_half_life_hours}h</span>}
                    {compound.predicted_half_life_hours && <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', marginLeft: 8 }}>Predicted: {compound.predicted_half_life_hours}h</span>}
                  </p>
                )}
                {compound.pk_summary && <Para>{compound.pk_summary}</Para>}
              </div>
            )}
            {h.notes && <Para>{h.notes}</Para>}
            <ReconstitutionCalculator />
          </div>
        )}

        {/* ── SAFETY ───────────────────────────────────────────────── */}
        {active === 'safety' && (
          <div>
            {/* Risk Level Card */}
            {risk && (
              <InfoCard color={risk.color}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>
                    Risk Classification
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: risk.color }}>{risk.label} Risk</span>
                </div>
                {/* Risk reasons - full list */}
                {compound.risk_reasons && compound.risk_reasons.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {compound.risk_reasons.map((reason, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <AlertTriangle size={13} color={risk.color} style={{ marginTop: 2, flexShrink: 0 }} />
                        <span style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>{reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </InfoCard>
            )}

            {compound.warnings && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <Label>Warnings &amp; Limitations</Label>
                <Para>{compound.warnings}</Para>
              </div>
            )}
            {compound.side_effects && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <Label>Reported Side Effects</Label>
                <Para>{compound.side_effects}</Para>
              </div>
            )}

            <SectionDivider title="Regulatory" />
            {compound.regulatory && (
              <div style={{ marginBottom: 12 }}>
                <Label>Regulatory Status</Label>
                <Para>{compound.regulatory}</Para>
              </div>
            )}
          </div>
        )}

        {/* ── RESEARCH DATA (NEW) ──────────────────────────────────── */}
        {active === 'research_data' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: teal, marginBottom: 4 }}>
                Research Metrics & External Databases
              </div>
              <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.6 }}>
                Quantitative research footprint: clinical trial registrations, peer-reviewed publications, regulatory classifications, and links to authoritative external databases.
              </p>
            </div>
            <TrialsMetricsPanel compound={compound} />
          </div>
        )}

        {/* ── SOURCES ──────────────────────────────────────────────── */}
        {active === 'sources' && (
          <div>
            <Label>Sources</Label>
            <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {compound.sources.map((src, i) => {
                const href = /^https?:\/\//i.test(src) ? src : `https://${src}`;
                return (
                  <li key={i} style={{ wordBreak: 'break-all', fontSize: '0.82rem' }}>
                    <a
                      href={href}
                      onClick={(e) => { e.preventDefault(); (isSocialPlatformUrl(href) ? window.open(href, '_blank') : setModalUrl(href)); }}
                      style={{ color: teal, textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                    >
                      <BookOpen size={12} />
                      {src}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* Related Compounds */}
      {related.length > 0 && (
        <section style={{ marginTop: 'var(--space-5)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--white)', margin: '0 0 var(--space-3)' }}>
            Related Compounds
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
            {related.map((r) => {
              const t = evidenceTier(r.evidence_tier);
              return (
                <div
                  key={r.slug}
                  className="glass-panel"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-lg, 12px)',
                    color: 'var(--white, #FFFFFF)',
                    height: '100%',
                  }}
                >
                  <Link
                    href={`/research/${r.slug}`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      textDecoration: 'none',
                      color: 'var(--white, #FFFFFF)',
                      flexGrow: 1,
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
                  <div
                    style={{
                      display: 'flex',
                      gap: '6px',
                      marginTop: '8px',
                      paddingTop: '8px',
                      borderTop: '1px solid rgba(255,255,255,0.06)',
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <PinToCompareButton
                        compoundSlug={r.slug}
                        compoundName={r.display_name}
                        evidenceTierKey={r.evidence_tier}
                        size="sm"
                      />
                    </div>
                  </div>
                </div>
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
