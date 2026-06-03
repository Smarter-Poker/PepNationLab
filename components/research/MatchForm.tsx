'use client';

import { useMemo, useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Sparkles, ChevronRight, ShieldCheck, Printer, Brain, X, Info, Scale, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
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
    case 'approved_drug': return 'Approved Drug';
    case 'investigational': return 'Investigational';
    case 'preclinical': return 'Preclinical';
    case 'research_chemical': return 'Research Compound';
    case 'cosmetic': return 'Cosmetic';
    default: return tier;
  }
}

function tierColor(tier: string): string {
  switch (tier) {
    case 'approved_drug': return '#68D391';
    case 'investigational': return '#00E5FF';
    case 'preclinical': return '#F6AD55';
    case 'research_chemical': return '#A8B4C0';
    case 'cosmetic': return '#D6BCFA';
    default: return '#A8B4C0';
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

function CircularScore({ score }: { score: number }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#68D391' : score >= 50 ? '#F6AD55' : '#FC8181';

  return (
    <div style={{ position: 'relative', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="44" height="44" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="22" cy="22" r={radius} fill="transparent" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
        <motion.circle
          cx="22" cy="22" r={radius} fill="transparent"
          stroke={color} strokeWidth="4"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <span style={{ position: 'absolute', fontSize: '0.8rem', fontWeight: 800, color: 'var(--white)' }}>{score}</span>
    </div>
  );
}

function MatchFormInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const goalOptions = useMemo(() => {
    return Object.keys(RESEARCH_AREAS).map(key => ({
      value: key,
      label: RESEARCH_AREAS[key as keyof typeof RESEARCH_AREAS].label,
      blurb: RESEARCH_AREAS[key as keyof typeof RESEARCH_AREAS].blurb
    }));
  }, []);

  const [goal, setGoal] = useState<string>(searchParams.get('goal') || goalOptions[0]?.value || 'tissue_repair');
  const [evidenceComfort, setEvidenceComfort] = useState<EvidenceComfort>((searchParams.get('comfort') as EvidenceComfort) || 'preclinical_ok');
  const [wadaConstraint, setWadaConstraint] = useState<WadaConstraint>((searchParams.get('wada') as WadaConstraint) || 'no_constraint');
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>((searchParams.get('risk') as RiskTolerance) || 'moderate_ok');
  const [excludeInjectables, setExcludeInjectables] = useState<boolean>(searchParams.get('no_injectables') === 'true');
  const [requireLongHalfLife, setRequireLongHalfLife] = useState<boolean>(searchParams.get('long_half_life') === 'true');
  const [excludeSlugs, setExcludeSlugs] = useState<string[]>(searchParams.getAll('exclude') || []);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Sync state to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (goal) params.set('goal', goal);
    if (evidenceComfort) params.set('comfort', evidenceComfort);
    if (wadaConstraint) params.set('wada', wadaConstraint);
    if (riskTolerance) params.set('risk', riskTolerance);
    if (excludeInjectables) params.set('no_injectables', 'true');
    if (requireLongHalfLife) params.set('long_half_life', 'true');
    excludeSlugs.forEach(s => params.append('exclude', s));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [goal, evidenceComfort, wadaConstraint, riskTolerance, excludeInjectables, requireLongHalfLife, excludeSlugs, pathname, router]);

  async function onSubmit(e?: React.FormEvent, overrides?: any) {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const payload = overrides ? overrides : { goal, evidenceComfort, wadaConstraint, riskTolerance, excludeInjectables, requireLongHalfLife, excludeSlugs };
      const res = await fetch('/api/research/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: payload }),
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

  // Trigger search if excludeSlugs change, so exclusion happens immediately
  useEffect(() => {
    if (excludeSlugs.length > 0 && results) {
      onSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excludeSlugs]);

  async function onAiSubmit() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/research/ai-match', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt }) 
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? 'AI Failed. Is your API key configured?');
        return;
      }
      if (data.result) {
        if (data.result.goal) setGoal(data.result.goal);
        if (data.result.evidenceComfort) setEvidenceComfort(data.result.evidenceComfort);
        if (data.result.wadaConstraint) setWadaConstraint(data.result.wadaConstraint);
        if (data.result.riskTolerance) setRiskTolerance(data.result.riskTolerance);
        if (typeof data.result.excludeInjectables === 'boolean') setExcludeInjectables(data.result.excludeInjectables);
        if (typeof data.result.requireLongHalfLife === 'boolean') setRequireLongHalfLife(data.result.requireLongHalfLife);
        setAiPrompt('');
        
        // Use overrides to bypass React closure state delays
        onSubmit(undefined, {
          goal: data.result.goal || goal,
          evidenceComfort: data.result.evidenceComfort || evidenceComfort,
          wadaConstraint: data.result.wadaConstraint || wadaConstraint,
          riskTolerance: data.result.riskTolerance || riskTolerance,
          excludeInjectables: typeof data.result.excludeInjectables === 'boolean' ? data.result.excludeInjectables : excludeInjectables,
          requireLongHalfLife: typeof data.result.requireLongHalfLife === 'boolean' ? data.result.requireLongHalfLife : requireLongHalfLife,
          excludeSlugs
        });
      }
    } catch (err) {
      setErrorMsg('Network error communicating with AI.');
    } finally {
      setAiLoading(false);
    }
  }

  const stackPartners = results?.filter(r => r.isStackPartner) || [];

  return (
    <div className="match-container">
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .glass-panel { border: 1px solid #ccc !important; background: white !important; box-shadow: none !important; color: black !important; margin-bottom: 20px; page-break-inside: avoid; }
          * { text-shadow: none !important; color: black !important; }
          .match-container { padding: 0 !important; }
        }
        .print-only { display: none; }
      `}</style>

      <div className="print-only">
        <h1>Pep Nation Lab - Research Protocol Report</h1>
        <p><strong>Goal:</strong> {goalOptions.find(g => g.value === goal)?.label}</p>
        <p><strong>Generated:</strong> {new Date().toLocaleDateString()}</p>
        <hr />
      </div>

      <div className="glass-panel no-print" style={{ padding: 'var(--space-6, 24px)', marginBottom: 'var(--space-6, 24px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)', marginBottom: 'var(--space-2, 8px)' }}>
          <Brain size={22} color="var(--teal, #00C4BC)" />
          <h2 style={{ margin: 0, color: 'var(--white)', fontSize: '1.2rem', fontWeight: 800 }}>AI Natural Language Match</h2>
        </div>
        <p style={{ margin: '0 0 var(--space-4, 16px)', color: 'var(--silver)', fontSize: '0.9rem' }}>
          Describe your scenario in plain English, and our AI will configure the strict search parameters for you.
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="text" 
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            placeholder="e.g., I'm looking for a non-WADA banned healing peptide with human data, preferably not injectable."
            style={{ flex: 1, padding: '0.8rem', borderRadius: '8px', border: '1px solid #1D2D3E', background: '#0F1923', color: 'white' }}
            onKeyDown={e => e.key === 'Enter' && onAiSubmit()}
          />
          <button onClick={onAiSubmit} disabled={aiLoading} className="btn-secondary" style={{ padding: '0 1.5rem' }}>
            {aiLoading ? 'Thinking...' : 'AI Configure'}
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 'var(--space-6, 24px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)', marginBottom: 'var(--space-2, 8px)' }}>
          <Sparkles size={22} color="var(--teal, #00C4BC)" aria-hidden="true" />
          <h2 style={{ margin: 0, color: 'var(--white, #FFFFFF)', fontSize: '1.35rem', fontWeight: 800 }}>Match Engine</h2>
        </div>
        
        <form onSubmit={onSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4, 16px)' }}>
            <div>
              <label className="block text-sm font-bold text-white mb-2">Primary Research Goal</label>
              <select value={goal} onChange={(e) => setGoal(e.target.value)} className="w-full p-3 rounded-md border border-[#1D2D3E] bg-[#0F1923] text-white">
                {goalOptions.map((g) => (<option key={g.value} value={g.value}>{g.label}</option>))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-white mb-2">Evidence Tier Comfort</label>
              <select value={evidenceComfort} onChange={(e) => setEvidenceComfort(e.target.value as EvidenceComfort)} className="w-full p-3 rounded-md border border-[#1D2D3E] bg-[#0F1923] text-white">
                {EVIDENCE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-white mb-2">WADA Constraint</label>
              <select value={wadaConstraint} onChange={(e) => setWadaConstraint(e.target.value as WadaConstraint)} className="w-full p-3 rounded-md border border-[#1D2D3E] bg-[#0F1923] text-white">
                {WADA_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-white mb-2">Risk Tolerance</label>
              <select value={riskTolerance} onChange={(e) => setRiskTolerance(e.target.value as RiskTolerance)} className="w-full p-3 rounded-md border border-[#1D2D3E] bg-[#0F1923] text-white">
                {RISK_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
            </div>
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }} className="no-print">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--silver)', fontSize: '0.9rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={excludeInjectables} onChange={e => setExcludeInjectables(e.target.checked)} />
              Exclude Injectables (Oral/Topical/Nasal Only)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--silver)', fontSize: '0.9rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={requireLongHalfLife} onChange={e => setRequireLongHalfLife(e.target.checked)} />
              Require Long Half-Life (Less Frequent Dosing)
            </label>
          </div>

          {excludeSlugs.length > 0 && (
            <div style={{ marginTop: '1rem', color: '#FC8181', fontSize: '0.85rem' }} className="no-print">
              <strong>Excluded:</strong> {excludeSlugs.join(', ')} 
              <button type="button" onClick={() => setExcludeSlugs([])} style={{ marginLeft: '10px', textDecoration: 'underline', background: 'none', border: 'none', color: '#FC8181', cursor: 'pointer' }}>Clear</button>
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3, 12px)', alignItems: 'center', marginTop: 'var(--space-5, 20px)' }} className="no-print">
            <button type="submit" className="btn-primary" disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} aria-hidden="true" /> {loading ? 'Matching' : 'Find My Matches'}
            </button>
            {results && results.length > 0 && (
              <button type="button" onClick={() => window.print()} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={18} /> Export PDF Report
              </button>
            )}
            {results && results.length >= 2 && (
              <button type="button" onClick={() => setShowCompare(true)} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <Scale size={18} /> Compare Top 2
              </button>
            )}
          </div>
        </form>
      </div>

      <div style={{ marginTop: 'var(--space-6, 24px)' }}>
        {errorMsg && (
          <p className="no-print" style={{ color: '#E53E3E', background: 'rgba(229,62,62,0.08)', border: '1px solid rgba(229,62,62,0.3)', borderRadius: '8px', padding: '12px' }}>
            {errorMsg}
          </p>
        )}

        {results && stackPartners.length >= 2 && (
          <div className="glass-panel" style={{ borderColor: 'var(--teal, #00C4BC)', marginBottom: '1.5rem', background: 'rgba(0,196,188,0.05)' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 8px 0', color: 'var(--teal, #00C4BC)' }}>
              <Info size={18} /> Synergistic Stack Detected
            </h4>
            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--silver)' }}>
              The engine detected that <strong>{stackPartners[0].displayName}</strong> and <strong>{stackPartners[1].displayName}</strong> are highly synergistic and frequently researched together as a stack for this protocol.
            </p>
          </div>
        )}

        {results && results.length === 0 && (
          <p style={{ color: 'var(--silver, #A8B4C0)' }}>
            No Matching Compounds Survived Your Constraints. Try Loosening The Evidence Tier Or Risk Tolerance.
          </p>
        )}

        {results && results.length > 0 && (
          <>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--white, #FFFFFF)', margin: '0 0 var(--space-3, 12px)' }}>
              Top {results.length} {results.length === 1 ? 'Match' : 'Matches'}
            </h3>
            <div style={{ display: 'grid', gap: 'var(--space-3, 12px)' }}>
              {results.map((r, idx) => (
                <div key={r.slug} className="glass-panel" style={{ position: 'relative', padding: 'var(--space-4, 16px)', borderRadius: 'var(--radius-lg, 12px)' }}>
                  
                  <button 
                    onClick={() => setExcludeSlugs(prev => [...prev, r.slug])}
                    className="no-print"
                    style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: '#A8B4C0', cursor: 'pointer', opacity: 0.7 }}
                    title="Exclude this compound"
                  >
                    <Trash2 size={16} />
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <CircularScore score={r.score} />
                      <Link href={`/research/${r.slug}`} style={{ color: 'var(--teal, #00C4BC)', fontWeight: 800, fontSize: '1.3rem', textDecoration: 'none' }}>
                        {idx + 1}. {r.displayName}
                      </Link>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '999px', color: tierColor(r.evidenceTier), border: `1px solid ${tierColor(r.evidenceTier)}` }}>
                        {tierLabel(r.evidenceTier)}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--silver)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '999px', padding: '0.1rem 0.55rem' }}>
                        {wadaText(r.wadaStatus)}
                      </span>
                    </div>
                  </div>
                  <p style={{ margin: '12px 0 0', color: 'var(--silver-light, #D0DAE4)', lineHeight: 1.55, fontSize: '0.95rem' }}>
                    {r.rationale}
                  </p>
                  
                  <details className="no-print" style={{ marginTop: '12px', fontSize: '0.85rem', color: '#A8B4C0' }}>
                    <summary style={{ cursor: 'pointer', outline: 'none' }}>View Score Breakdown</summary>
                    <ul style={{ marginTop: '8px', paddingLeft: '20px', listStyleType: 'disc' }}>
                      {r.scoreBreakdown.base > 0 && <li>Exact Goal Match: +{r.scoreBreakdown.base}</li>}
                      {r.scoreBreakdown.keyword > 0 && <li>Keyword Mentions: +{r.scoreBreakdown.keyword}</li>}
                      {r.scoreBreakdown.evidenceBonus > 0 && <li>Evidence Tier Bonus: +{r.scoreBreakdown.evidenceBonus}</li>}
                      {r.scoreBreakdown.classBonus > 0 && <li>Class/Mechanism Bonus: +{r.scoreBreakdown.classBonus}</li>}
                    </ul>
                  </details>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showCompare && results && results.length >= 2 && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', background: '#0F1923' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: 'white' }}>Head-to-Head Comparison</h3>
              <button onClick={() => setShowCompare(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: 'white' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1D2D3E' }}>
                  <th style={{ padding: '12px', color: '#A8B4C0' }}>Feature</th>
                  <th style={{ padding: '12px', fontSize: '1.1rem', color: 'var(--teal)' }}>{results[0].displayName}</th>
                  <th style={{ padding: '12px', fontSize: '1.1rem', color: 'var(--teal)' }}>{results[1].displayName}</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #1D2D3E' }}>
                  <td style={{ padding: '12px', color: '#A8B4C0' }}>Match Score</td>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{results[0].score}</td>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{results[1].score}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #1D2D3E' }}>
                  <td style={{ padding: '12px', color: '#A8B4C0' }}>Evidence Tier</td>
                  <td style={{ padding: '12px', color: tierColor(results[0].evidenceTier) }}>{tierLabel(results[0].evidenceTier)}</td>
                  <td style={{ padding: '12px', color: tierColor(results[1].evidenceTier) }}>{tierLabel(results[1].evidenceTier)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #1D2D3E' }}>
                  <td style={{ padding: '12px', color: '#A8B4C0' }}>WADA Status</td>
                  <td style={{ padding: '12px' }}>{wadaText(results[0].wadaStatus)}</td>
                  <td style={{ padding: '12px' }}>{wadaText(results[1].wadaStatus)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #1D2D3E' }}>
                  <td style={{ padding: '12px', color: '#A8B4C0' }}>Half-Life</td>
                  <td style={{ padding: '12px' }}>{results[0].halfLife || 'Unknown'}</td>
                  <td style={{ padding: '12px' }}>{results[1].halfLife || 'Unknown'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #1D2D3E' }}>
                  <td style={{ padding: '12px', color: '#A8B4C0' }}>Molecular Weight</td>
                  <td style={{ padding: '12px' }}>{results[0].molecularWeight ? `${results[0].molecularWeight} Da` : 'Unknown'}</td>
                  <td style={{ padding: '12px' }}>{results[1].molecularWeight ? `${results[1].molecularWeight} Da` : 'Unknown'}</td>
                </tr>
                <tr>
                  <td style={{ padding: '12px', color: '#A8B4C0' }}>Temp Sensitive</td>
                  <td style={{ padding: '12px' }}>{results[0].isTempSensitive ? 'Yes (Cold Storage)' : 'No'}</td>
                  <td style={{ padding: '12px' }}>{results[1].isTempSensitive ? 'Yes (Cold Storage)' : 'No'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <footer className="no-print" style={{ marginTop: 'var(--space-6, 24px)', padding: 'var(--space-4, 16px)', borderRadius: 'var(--radius-md, 8px)', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', color: 'var(--silver, #A8B4C0)', fontSize: '0.82rem', display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3, 12px)' }}>
        <ShieldCheck size={18} color="var(--teal, #00C4BC)" aria-hidden="true" style={{ marginTop: '2px' }} />
        <span>
          Research Use Only. The Match Engine Reports Cataloged Laboratory Facts. It Is Not Medical Advice, Diagnosis, Or Treatment. Always Defer To A Qualified Professional For Health Decisions.
        </span>
      </footer>
    </div>
  );
}

export default function MatchForm() {
  return (
    <Suspense fallback={<div className="text-white p-8">Loading Match Engine...</div>}>
      <MatchFormInner />
    </Suspense>
  );
}
