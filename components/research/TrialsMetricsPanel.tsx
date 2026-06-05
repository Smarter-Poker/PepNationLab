'use client';

/**
 * TrialsMetricsPanel — Analytics panel for clinical trials, citations,
 * and research maturity. Shown on individual compound monograph pages.
 *
 * Surfaces data that was previously just raw numbers:
 *   - active_trial_count / completed_trial_count (split + visual)
 *   - pubmed_citation_count (with percentile benchmarks vs all compounds)
 *   - year_discovered (research timeline context)
 *   - Deep links to ClinicalTrials.gov and PubMed searches
 *   - Evidence tier context card
 *   - WADA status detail card
 *   - chembl_id / uniprot_id / unii external links
 */

import Link from 'next/link';
import { type Compound, evidenceTier, wadaLabel, RISK_META } from '@/lib/compounds';

interface Props {
  compound: Compound;
}

function percentileLabel(citations: number): { label: string; pct: number; color: string } {
  // Rough percentile tiers based on the compounds in our catalog
  if (citations >= 5000) return { label: 'Top 1%', pct: 99, color: '#68D391' };
  if (citations >= 2000) return { label: 'Top 5%', pct: 95, color: '#68D391' };
  if (citations >= 1000) return { label: 'Top 10%', pct: 90, color: '#00C4BC' };
  if (citations >= 500)  return { label: 'Top 20%', pct: 80, color: '#00C4BC' };
  if (citations >= 200)  return { label: 'Top 35%', pct: 65, color: '#F6AD55' };
  if (citations >= 100)  return { label: 'Top 50%', pct: 50, color: '#F6AD55' };
  if (citations >= 30)   return { label: 'Top 65%', pct: 35, color: '#F6AD55' };
  return { label: 'Emerging',  pct: 15, color: '#FC8181' };
}

function trialsTier(total: number): { label: string; color: string } {
  if (total >= 100) return { label: 'Extensively Studied', color: '#68D391' };
  if (total >= 20)  return { label: 'Well Studied', color: '#00C4BC' };
  if (total >= 5)   return { label: 'Actively Trialed', color: '#F6AD55' };
  if (total >= 1)   return { label: 'Early-Stage Trials', color: '#F6AD55' };
  return { label: 'No Registered Trials', color: '#FC8181' };
}

function researchAge(yearDiscovered: number | null | undefined): string | null {
  if (!yearDiscovered) return null;
  const age = new Date().getFullYear() - yearDiscovered;
  if (age < 5) return `Very New (${age} years) — emerging research`;
  if (age < 15) return `Modern (${age} years) — actively expanding research base`;
  if (age < 30) return `Established (${age} years) — mature research trajectory`;
  return `Well-Established (${age} years) — decades of research literature`;
}

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  color?: string;
  icon?: string;
}

function StatCard({ label, value, sub, color = '#00C4BC', icon }: StatCardProps) {
  return (
    <div style={{
      background: `${color}08`,
      border: `1px solid ${color}20`,
      borderRadius: 12,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
        {icon && <span style={{ marginRight: 4 }}>{icon}</span>}{label}
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 900, color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>{sub}</div>}
    </div>
  );
}

export default function TrialsMetricsPanel({ compound }: Props) {
  const c = compound as Compound & Record<string, unknown>; // for chembl_id etc.
  const tier = evidenceTier(compound.evidence_tier);
  const risk = RISK_META[compound.risk_level];
  const active = compound.active_trial_count ?? 0;
  const completed = compound.completed_trial_count ?? 0;
  const totalTrials = active + completed;
  const citations = compound.pubmed_citation_count ?? 0;
  const citPercentile = percentileLabel(citations);
  const trialTier = trialsTier(totalTrials);
  const ageContext = researchAge(compound.year_discovered);
  const teal = '#00C4BC';

  // External IDs from wave-2 columns
  const chemblId = c.chembl_id as string | null;
  const uniprotId = c.uniprot_id as string | null;
  const unii = c.unii as string | null;

  const pubmedUrl = `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(compound.display_name + ' peptide')}`;
  const trialsUrl = `https://clinicaltrials.gov/search?cond=${encodeURIComponent(compound.display_name)}&aggFilters=results:with`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Stats Grid ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <StatCard
          label="PubMed Citations"
          value={citations > 0 ? citations.toLocaleString() : '—'}
          sub={citations > 0 ? (
            <span>
              <span style={{ color: citPercentile.color, fontWeight: 700 }}>{citPercentile.label}</span>
              {' of research compounds'}
            </span>
          ) : 'No indexed publications found'}
          color={citPercentile.color}
          icon="📄"
        />
        <StatCard
          label="Clinical Trials"
          value={totalTrials > 0 ? totalTrials : '—'}
          sub={totalTrials > 0 ? (
            <span>
              <span style={{ color: '#68D391', fontWeight: 700 }}>{active} Active</span>
              {' · '}
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>{completed} Completed</span>
            </span>
          ) : 'No registered trials found'}
          color={trialTier.color}
          icon="🧪"
        />
        <StatCard
          label="Evidence Tier"
          value={<span style={{ fontSize: '1rem' }}>{tier.label}</span>}
          sub={tier.blurb}
          color={tier.color}
          icon="🏅"
        />
        {compound.year_discovered && (
          <StatCard
            label="Year Discovered"
            value={compound.year_discovered}
            sub={ageContext ?? undefined}
            color="#9F7AEA"
            icon="📅"
          />
        )}
      </div>

      {/* ── Citation Percentile Bar ─────────────────────────────────── */}
      {citations > 0 && (
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12,
          padding: '14px 16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'rgba(255,255,255,0.7)' }}>
              📊 Literature Depth
            </div>
            <span style={{ fontSize: '0.68rem', color: citPercentile.color, fontWeight: 700 }}>
              {citPercentile.label} of peptide compounds
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            {/* Graduated bar segments */}
            {[
              { threshold: 30, label: 'Sparse' },
              { threshold: 100, label: 'Moderate' },
              { threshold: 500, label: 'Good' },
              { threshold: 2000, label: 'Strong' },
              { threshold: Infinity, label: 'Exceptional' },
            ].map(({ threshold, label }, i) => {
              const prevThreshold = [0, 30, 100, 500, 2000][i];
              const filled = citations >= prevThreshold;
              const isCurrent = citations < threshold && citations >= prevThreshold;
              const color = isCurrent ? citPercentile.color : filled ? `${citPercentile.color}60` : 'rgba(255,255,255,0.06)';
              return (
                <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ height: 6, borderRadius: 3, background: color }} />
                  <div style={{ fontSize: '0.55rem', color: isCurrent ? citPercentile.color : 'rgba(255,255,255,0.25)', fontWeight: isCurrent ? 800 : 400, textAlign: 'center' }}>
                    {label}
                  </div>
                </div>
              );
            })}
          </div>
          <a
            href={pubmedUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: teal, textDecoration: 'none', fontWeight: 700, marginTop: 4 }}
          >
            Search {citations.toLocaleString()} publications on PubMed →
          </a>
        </div>
      )}

      {/* ── Clinical Trials Breakdown ───────────────────────────────── */}
      {totalTrials > 0 && (
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12,
          padding: '14px 16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'rgba(255,255,255,0.7)' }}>
              🧬 Trial Registry Summary
            </div>
            <span style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              color: trialTier.color,
              background: `${trialTier.color}15`,
              border: `1px solid ${trialTier.color}30`,
              padding: '2px 8px',
              borderRadius: 4,
            }}>
              {trialTier.label}
            </span>
          </div>

          {/* Visual split bar */}
          <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2, marginBottom: 10 }}>
            {active > 0 && (
              <div style={{
                flex: active,
                background: '#68D391',
                borderRadius: '5px 0 0 5px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }} />
            )}
            {completed > 0 && (
              <div style={{
                flex: completed,
                background: 'rgba(255,255,255,0.2)',
                borderRadius: active > 0 ? '0 5px 5px 0' : '5px',
              }} />
            )}
          </div>

          <div style={{ display: 'flex', gap: 16, fontSize: '0.75rem', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: '#68D391' }} />
              <span style={{ color: '#68D391', fontWeight: 700 }}>{active} Active</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
              <span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{completed} Completed</span>
            </div>
            <div style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
              {totalTrials} Total
            </div>
          </div>

          <a
            href={trialsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: '#68D391', textDecoration: 'none', fontWeight: 700 }}
          >
            Browse trials on ClinicalTrials.gov →
          </a>
        </div>
      )}

      {/* ── Evidence Tier Card ──────────────────────────────────────── */}
      <div style={{
        background: `${tier.color}08`,
        border: `1px solid ${tier.color}25`,
        borderRadius: 12,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>
            Evidence Classification
          </div>
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            color: tier.color,
            border: `1px solid ${tier.color}`,
            padding: '2px 10px',
            borderRadius: 999,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>
            {tier.label}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.55 }}>
          {tier.blurb}
        </p>
        {/* Evidence ladder */}
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          {[
            { key: 'research_chemical', label: 'Research' },
            { key: 'preclinical', label: 'Preclinical' },
            { key: 'investigational', label: 'Investigational' },
            { key: 'approved_drug', label: 'Approved' },
          ].map(({ key, label }) => {
            const t = evidenceTier(key);
            const isActive = compound.evidence_tier === key;
            const tierOrder = { research_chemical: 0, preclinical: 1, cosmetic: 1, investigational: 2, approved_drug: 3 };
            const compoundOrder = tierOrder[compound.evidence_tier as keyof typeof tierOrder] ?? 0;
            const thisOrder = tierOrder[key as keyof typeof tierOrder] ?? 0;
            const passed = compoundOrder >= thisOrder;
            return (
              <div key={key} style={{ flex: 1 }}>
                <div style={{
                  height: 4,
                  borderRadius: 2,
                  background: passed ? t.color : 'rgba(255,255,255,0.06)',
                  marginBottom: 4,
                }} />
                <div style={{
                  fontSize: '0.56rem',
                  color: isActive ? t.color : passed ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)',
                  fontWeight: isActive ? 800 : 500,
                  textAlign: 'center',
                }}>
                  {label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── WADA Card ───────────────────────────────────────────────── */}
      {compound.wada_status && compound.wada_status !== 'not_listed' && (() => {
        const isProhibited = compound.wada_status === 'prohibited' || compound.wada_status === 'prohibited_males';
        const isPermitted = compound.wada_status === 'permitted';
        const wadaColor = isProhibited ? '#FC8181' : isPermitted ? '#68D391' : '#F6AD55';
        const wadaDesc = isProhibited
          ? 'This compound is listed on the WADA Prohibited List and is not permitted in any tested competitive sport. Researchers working with athletes must be aware of this restriction.'
          : compound.wada_status === 'prohibited_males'
          ? 'Prohibited for male athletes under WADA regulations. Female athletes should verify current WADA list status.'
          : isPermitted
          ? 'This compound is not prohibited under WADA regulations and may be used by tested athletes without concern for anti-doping violations based on current regulations.'
          : 'Current WADA status requires verification. Researchers should consult the current WADA Prohibited List before designing athlete-related protocols.';
        return (
          <div style={{
            background: `${wadaColor}08`,
            border: `1px solid ${wadaColor}25`,
            borderRadius: 12,
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>
                ⚡ WADA Anti-Doping Status
              </div>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: wadaColor,
                background: `${wadaColor}15`,
                border: `1px solid ${wadaColor}30`,
                padding: '2px 10px',
                borderRadius: 4,
              }}>
                {wadaLabel(compound.wada_status)}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.55 }}>{wadaDesc}</p>
            <a
              href="https://www.wada-ama.org/en/prohibited-list"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '0.72rem', color: wadaColor, textDecoration: 'none', fontWeight: 700 }}
            >
              View current WADA Prohibited List →
            </a>
          </div>
        );
      })()}

      {/* ── Risk Reasons ───────────────────────────────────────────── */}
      {compound.risk_reasons && compound.risk_reasons.length > 0 && (
        <div style={{
          background: `${risk?.color ?? '#F6AD55'}08`,
          border: `1px solid ${risk?.color ?? '#F6AD55'}20`,
          borderRadius: 12,
          padding: '14px 16px',
        }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>
            ⚠️ Risk Considerations ({risk?.label ?? compound.risk_level})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {compound.risk_reasons.map((reason, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: risk?.color ?? '#F6AD55', flexShrink: 0, marginTop: 2 }}>•</span>
                <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── External Database Links ─────────────────────────────────── */}
      {(chemblId || uniprotId || unii) && (
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12,
          padding: '14px 16px',
        }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>
            🔗 External Research Databases
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {chemblId && (
              <a
                href={`https://www.ebi.ac.uk/chembl/compound_report_card/${chemblId}/`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: 'rgba(0,196,188,0.08)',
                  border: '1px solid rgba(0,196,188,0.25)',
                  color: teal,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                ChEMBL: {chemblId} ↗
              </a>
            )}
            {uniprotId && (
              <a
                href={`https://www.uniprot.org/uniprotkb/${uniprotId}/entry`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: 'rgba(159,122,234,0.08)',
                  border: '1px solid rgba(159,122,234,0.25)',
                  color: '#9F7AEA',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                UniProt: {uniprotId} ↗
              </a>
            )}
            {unii && (
              <a
                href={`https://precision.fda.gov/uniisearch/srs/unii/${unii}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: 'rgba(246,173,85,0.08)',
                  border: '1px solid rgba(246,173,85,0.25)',
                  color: '#F6AD55',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                FDA UNII: {unii} ↗
              </a>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            <a
              href={pubmedUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 6,
                background: 'rgba(104,211,145,0.08)',
                border: '1px solid rgba(104,211,145,0.25)',
                color: '#68D391',
                fontSize: '0.75rem',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Search PubMed ↗
            </a>
            <a
              href={trialsUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 6,
                background: 'rgba(252,129,129,0.08)',
                border: '1px solid rgba(252,129,129,0.25)',
                color: '#FC8181',
                fontSize: '0.75rem',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              ClinicalTrials.gov ↗
            </a>
          </div>
        </div>
      )}

    </div>
  );
}
