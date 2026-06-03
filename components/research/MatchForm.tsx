'use client';

/**
 * Match Me To A Peptide — client form.
 *
 * Structured suggestion UI. The researcher selects a primary goal, evidence
 * comfort, WADA constraint, and risk tolerance. On submit, the form POSTs to
 * `/api/research/match` which runs the deterministic scoring engine and
 * returns the top 5 candidate compounds. Each result links to its monograph
 * at `/research/[slug]`.
 *
 * Research-Use-Only framing is shown in the header and footer; no medical or
 * dosing advice is given.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Sparkles, ChevronRight, ShieldCheck } from 'lucide-react';
import { RESEARCH_AREAS } from '@/lib/compounds';
import type {
  EvidenceComfort,
  MatchResult,
  RiskTolerance,
  WadaConstraint,
} from '@/lib/match-engine';

interface ApiResponse {
  results?: MatchResult[];
  error?: string;
  note?: string;
}

// The engine accepts additional goals beyond the canonical RESEARCH_AREAS map
// (weight_management, pain_inflammation). Surface them here so researchers can
// pick from the full goal vocabulary the engine understands.
const EXTRA_GOALS: Record<string, { label: string; blurb: string }> = {
  weight_management: {
    label: 'Weight Management',
    blurb: 'Compounds studied for satiety, appetite, and weight regulation.',
  },
  pain_inflammation: {
    label: 'Pain & Inflammation',
    blurb: 'Compounds studied for inflammatory and analgesic pathways.',
  },
};

const EVIDENCE_OPTIONS: { value: EvidenceComfort; label: string; help: string }[] = [
  { value: 'strict_human_only', label: 'Approved Drugs Only', help: 'FDA / EMA approved compounds with human trial data.' },
  { value: 'investigational_ok', label: 'Investigational Or Better', help: 'In active human clinical trials, or approved.' },
  { value: 'preclinical_ok', label: 'Preclinical Or Better', help: 'Animal or in-vitro evidence acceptable.' },
  { value: 'any', label: 'Any Evidence Level', help: 'Include research-only and exploratory compounds.' },
];

const WADA_OPTIONS: { value: WadaConstraint; label: string; help: string }[] = [
  { value: 'wada_permitted_only', label: 'WADA Permitted Only', help: 'Exclude anything on the WADA Prohibited List.' },
  { value: 'no_constraint', label: 'No WADA Constraint', help: 'Not Tested In Sport. Include WADA-Prohibited Compounds.' },
];

const RISK_OPTIONS: { value: RiskTolerance; label: string; help: string }[] = [
  { value: 'low_only', label: 'Low Risk Only', help: 'Exclude compounds with moderate, high, or critical research risk.' },
  { value: 'moderate_ok', label: 'Low Or Moderate Risk', help: 'Exclude high and critical risk compounds.' },
  { value: 'any', label: 'Any Risk Level', help: 'Include all risk classifications.' },
];

function tierLabel(tier: string): string {
  switch (tier) {
    case 'approved_drug':
      return 'Approved Drug';
    case 'investigational':
      return 'Investigational';
    case 'preclinical':
      return 'Preclinical';
    case 'research_chemical':
      return 'Research Compound';
    case 'cosmetic':
      return 'Cosmetic';
    default:
      return tier;
  }
}

function tierColor(tier: string): string {
  switch (tier) {
    case 'approved_drug':
      return '#68D391';
    case 'investigational':
      return '#00E5FF';
    case 'preclinical':
      return '#F6AD55';
    case 'research_chemical':
      return '#A8B4C0';
    case 'cosmetic':
      return '#D6BCFA';
    default:
      return '#A8B4C0';
  }
}

function wadaText(status: string): string {
  if (status === 'permitted') return 'WADA Permitted';
  if (status === 'prohibited') return 'WADA Prohibited';
  if (status === 'prohibited_males') return 'WADA Prohibited (Males)';
  if (status === 'not_listed') return 'Not WADA Listed';
  return status;
}

function riskText(level: string): string {
  return level.charAt(0).toUpperCase() + level.slice(1) + ' Risk';
}

export default function MatchForm() {
  // Build the canonical goal list once. Use Object.keys to keep ordering
  // deterministic with the source definition.
  const goalOptions = useMemo(() => {
    const items: { value: string; label: string; blurb: string }[] = [];
    for (const key of Object.keys(RESEARCH_AREAS)) {
      const meta = RESEARCH_AREAS[key];
      items.push({ value: key, label: meta.label, blurb: meta.blurb });
    }
    for (const key of Object.keys(EXTRA_GOALS)) {
      const meta = EXTRA_GOALS[key];
      items.push({ value: key, label: meta.label, blurb: meta.blurb });
    }
    return items;
  }, []);

  const [goal, setGoal] = useState<string>(goalOptions[0]?.value ?? 'tissue_repair');
  const [evidenceComfort, setEvidenceComfort] = useState<EvidenceComfort>('preclinical_ok');
  const [wadaConstraint, setWadaConstraint] = useState<WadaConstraint>('no_constraint');
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>('moderate_ok');

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setResults(null);
    try {
      const res = await fetch('/api/research/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { goal, evidenceComfort, wadaConstraint, riskTolerance },
        }),
      });
      const data = (await res.json()) as ApiResponse;
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Something Went Wrong. Please Try Again.');
        return;
      }
      setResults(data.results ?? []);
    } catch {
      setErrorMsg('Network Error. Please Try Again.');
    } finally {
      setLoading(false);
    }
  }

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.7rem 0.85rem',
    borderRadius: 'var(--radius-md, 8px)',
    border: '1px solid #1D2D3E',
    background: '#0F1923',
    color: 'var(--white, #FFFFFF)',
    fontSize: '0.95rem',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 700,
    color: 'var(--white, #FFFFFF)',
    marginBottom: 'var(--space-2, 8px)',
  };

  const helpStyle: React.CSSProperties = {
    fontSize: '0.78rem',
    color: 'var(--silver, #A8B4C0)',
    marginTop: 'var(--space-2, 8px)',
  };

  return (
    <div>
      <div className="glass-panel" style={{ padding: 0 }}>
        <div className="glass-panel">
          <div className="" style={{ padding: 'var(--space-6, 24px)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3, 12px)',
                marginBottom: 'var(--space-2, 8px)',
              }}
            >
              <Sparkles size={22} color="var(--teal, #00C4BC)" aria-hidden="true" />
              <h2 style={{ margin: 0, color: 'var(--white, #FFFFFF)', fontSize: '1.35rem', fontWeight: 800 }}>
                Match Me To A Peptide
              </h2>
            </div>
            <p style={{ margin: '0 0 var(--space-4, 16px)', color: 'var(--silver, #A8B4C0)', fontSize: '0.95rem' }}>
              Pick A Research Goal And Your Comfort Levels. The Library Will Rank Up To 5 Candidate Compounds With A Plain-English Rationale. Research Use Only.
            </p>

            <form onSubmit={onSubmit}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 'var(--space-4, 16px)',
                }}
              >
                <div>
                  <label htmlFor="match-goal" style={labelStyle}>
                    Primary Research Goal
                  </label>
                  <select
                    id="match-goal"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    style={selectStyle}
                  >
                    {goalOptions.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                  <p style={helpStyle}>
                    {goalOptions.find((g) => g.value === goal)?.blurb ?? 'Select A Research Area.'}
                  </p>
                </div>

                <div>
                  <label htmlFor="match-evidence" style={labelStyle}>
                    Evidence Tier Comfort
                  </label>
                  <select
                    id="match-evidence"
                    value={evidenceComfort}
                    onChange={(e) => setEvidenceComfort(e.target.value as EvidenceComfort)}
                    style={selectStyle}
                  >
                    {EVIDENCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <p style={helpStyle}>
                    {EVIDENCE_OPTIONS.find((o) => o.value === evidenceComfort)?.help}
                  </p>
                </div>

                <div>
                  <label htmlFor="match-wada" style={labelStyle}>
                    WADA Constraint
                  </label>
                  <select
                    id="match-wada"
                    value={wadaConstraint}
                    onChange={(e) => setWadaConstraint(e.target.value as WadaConstraint)}
                    style={selectStyle}
                  >
                    {WADA_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <p style={helpStyle}>
                    {WADA_OPTIONS.find((o) => o.value === wadaConstraint)?.help}
                  </p>
                </div>

                <div>
                  <label htmlFor="match-risk" style={labelStyle}>
                    Risk Tolerance
                  </label>
                  <select
                    id="match-risk"
                    value={riskTolerance}
                    onChange={(e) => setRiskTolerance(e.target.value as RiskTolerance)}
                    style={selectStyle}
                  >
                    {RISK_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <p style={helpStyle}>
                    {RISK_OPTIONS.find((o) => o.value === riskTolerance)?.help}
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 'var(--space-3, 12px)',
                  alignItems: 'center',
                  marginTop: 'var(--space-5, 20px)',
                }}
              >
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--space-2, 8px)',
                  }}
                >
                  <Sparkles size={18} aria-hidden="true" />
                  {loading ? 'Matching' : 'Find My Matches'}
                </button>
                <Link
                  href="/research"
                  className="btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--space-2, 8px)',
                    textDecoration: 'none',
                  }}
                >
                  Back To Library
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Results */}
      <div style={{ marginTop: 'var(--space-6, 24px)' }}>
        {errorMsg && (
          <p
            role="alert"
            style={{
              color: '#E53E3E',
              background: 'rgba(229,62,62,0.08)',
              border: '1px solid rgba(229,62,62,0.3)',
              borderRadius: 'var(--radius-md, 8px)',
              padding: 'var(--space-3, 12px)',
            }}
          >
            {errorMsg}
          </p>
        )}

        {results && results.length === 0 && (
          <p style={{ color: 'var(--silver, #A8B4C0)' }}>
            No Matching Compounds Survived Your Constraints. Try Loosening The Evidence Tier Or Risk Tolerance.
          </p>
        )}

        {results && results.length > 0 && (
          <>
            <h3
              style={{
                fontSize: '1.1rem',
                fontWeight: 800,
                color: 'var(--white, #FFFFFF)',
                margin: '0 0 var(--space-3, 12px)',
              }}
            >
              Top {results.length} {results.length === 1 ? 'Match' : 'Matches'}
            </h3>
            <div style={{ display: 'grid', gap: 'var(--space-3, 12px)' }}>
              {results.map((r, idx) => (
                <Link
                  key={r.slug}
                  href={`/research/${r.slug}`}
                  className="glass-panel"
                  style={{
                    display: 'block',
                    padding: 'var(--space-4, 16px)',
                    borderRadius: 'var(--radius-lg, 12px)',
                    textDecoration: 'none',
                    color: 'var(--white, #FFFFFF)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 'var(--space-3, 12px)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)', flexWrap: 'wrap' }}>
                      <span
                        aria-hidden="true"
                        style={{
                          minWidth: '28px',
                          height: '28px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '999px',
                          background: 'rgba(0,196,188,0.12)',
                          color: 'var(--teal, #00C4BC)',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                        }}
                      >
                        {idx + 1}
                      </span>
                      <span style={{ color: 'var(--teal, #00C4BC)', fontWeight: 800, fontSize: '1.1rem' }}>
                        {r.displayName}
                      </span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.55rem',
                          borderRadius: '999px',
                          color: tierColor(r.evidenceTier),
                          border: `1px solid ${tierColor(r.evidenceTier)}`,
                          background: 'rgba(0,0,0,0.2)',
                        }}
                      >
                        {tierLabel(r.evidenceTier)}
                      </span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          color: 'var(--silver, #A8B4C0)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: '999px',
                          padding: '0.1rem 0.55rem',
                        }}
                      >
                        {wadaText(r.wadaStatus)}
                      </span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          color: 'var(--silver, #A8B4C0)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: '999px',
                          padding: '0.1rem 0.55rem',
                        }}
                      >
                        {riskText(r.riskLevel)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)' }}>Score</span>
                      <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--white, #FFFFFF)' }}>
                        {r.score}
                      </span>
                      <ChevronRight size={18} color="var(--silver, #A8B4C0)" aria-hidden="true" />
                    </div>
                  </div>
                  <p
                    style={{
                      margin: 'var(--space-2, 8px) 0 0',
                      color: 'var(--silver-light, #D0DAE4)',
                      lineHeight: 1.55,
                      fontSize: '0.92rem',
                    }}
                  >
                    {r.rationale}
                  </p>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      <footer
        style={{
          marginTop: 'var(--space-6, 24px)',
          padding: 'var(--space-4, 16px)',
          borderRadius: 'var(--radius-md, 8px)',
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.02)',
          color: 'var(--silver, #A8B4C0)',
          fontSize: '0.82rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--space-3, 12px)',
        }}
      >
        <ShieldCheck size={18} color="var(--teal, #00C4BC)" aria-hidden="true" style={{ marginTop: '2px' }} />
        <span>
          Research Use Only. The Match Engine Reports Cataloged Laboratory Facts. It Is Not Medical Advice, Diagnosis, Or Treatment. Always Defer To A Qualified Professional For Health Decisions.
        </span>
      </footer>
    </div>
  );
}
