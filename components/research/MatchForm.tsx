'use client';

import { useMemo, useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Sparkles, ChevronRight, ShieldCheck, Printer, X, Info, Scale, Trash2, ArrowRight, ArrowLeft, Save, Search, Eye, Clock, Atom, Snowflake, AlertTriangle, Check, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { RESEARCH_AREAS } from '@/lib/compounds';
import type {
  EvidenceComfort,
  MatchResult,
  RiskTolerance,
} from '@/lib/match-engine';
import CompoundDrawer from './CompoundDrawer';
import { saveMatchAction } from '@/app/research/actions';
import { toast } from 'sonner';
import { useModalA11y } from '@/lib/useModalA11y';

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

function riskMeta(level: string): { label: string; color: string } {
  switch (level) {
    case 'low': return { label: 'Low Risk', color: '#68D391' };
    case 'moderate': return { label: 'Moderate Risk', color: '#F6AD55' };
    case 'high': return { label: 'High Risk', color: '#FC8181' };
    case 'critical': return { label: 'Critical Risk', color: '#FF6B6B' };
    default: return { label: level, color: '#A8B4C0' };
  }
}

// Ordered factors for the score-breakdown bars. Kept in one place so the card
// and any future surface stay consistent with the engine's ScoreBreakdown.
const BREAKDOWN_FACTORS: { key: 'base' | 'keyword' | 'evidenceBonus' | 'classBonus' | 'interest' | 'budget'; label: string; color: string }[] = [
  { key: 'base', label: 'Exact Goal Match', color: '#00C4BC' },
  { key: 'keyword', label: 'Keyword Relevance', color: '#3DD9A4' },
  { key: 'evidenceBonus', label: 'Evidence Tier', color: '#63B3ED' },
  { key: 'classBonus', label: 'Class Synergy', color: '#F6AD55' },
  { key: 'interest', label: 'Research Interest', color: '#B794F4' },
  { key: 'budget', label: 'Budget Adjustment', color: '#F08A8A' },
];



function CircularScore({ score }: { score: number }) {
  const reduce = useReducedMotion();
  const size = 60;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  const strokeDashoffset = circumference - (pct / 100) * circumference;
  // Calibrated to the engine's real score distribution. A strong match
  // (research-area tag + keyword + solid evidence tier + research interest)
  // lands in the high 70s-90s; a keyword-only match lands in the 40s. The old
  // 80/50 cutoffs were tuned for the pre-gradient engine, where nearly every
  // relevant compound scored ~90, and made strong results render amber.
  const color = pct >= 75 ? '#3DD9A4' : pct >= 45 ? '#F6AD55' : '#FC8181';

  return (
    <div
      title={`Match score: ${pct} out of 100`}
      style={{ position: 'relative', width: size, height: size, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference}
          initial={reduce ? false : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: reduce ? 0 : 1, ease: 'easeOut' }}
        />
      </svg>
      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
        <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--white)' }}>{pct}</span>
        <span style={{ fontSize: '0.48rem', fontWeight: 700, letterSpacing: '0.1em', color: color, marginTop: 3 }}>MATCH</span>
      </div>
    </div>
  );
}

function MatchFormInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const goalOptions = useMemo(() => {
    const opts = Object.keys(RESEARCH_AREAS).map(key => ({
      value: key,
      label: RESEARCH_AREAS[key as keyof typeof RESEARCH_AREAS].label,
      blurb: RESEARCH_AREAS[key as keyof typeof RESEARCH_AREAS].blurb
    }));
    opts.unshift({ 
      value: 'any', 
      label: 'Any Goal (Explore All)', 
      blurb: 'Do not restrict by a specific research area. Explore top compounds by evidence tier.' 
    });
    return opts;
  }, []);

  const [goal, setGoal] = useState<string>(searchParams.get('goal') || goalOptions[0]?.value || 'tissue_repair');
  const [evidenceComfort, setEvidenceComfort] = useState<EvidenceComfort>((searchParams.get('comfort') as EvidenceComfort) || 'preclinical_ok');
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>((searchParams.get('risk') as RiskTolerance) || 'moderate_ok');
  const [excludeInjectables, setExcludeInjectables] = useState<boolean>(searchParams.get('no_injectables') === 'true');
  const [requireLongHalfLife, setRequireLongHalfLife] = useState<boolean>(searchParams.get('long_half_life') === 'true');
  const [excludeSlugs, setExcludeSlugs] = useState<string[]>(searchParams.getAll('exclude') || []);
  const [preference, setPreference] = useState<'single' | 'stack' | 'either'>((searchParams.get('preference') as 'single' | 'stack' | 'either') || 'either');
  const [budget, setBudget] = useState<'conservative' | 'standard' | 'unlimited'>((searchParams.get('budget') as 'conservative' | 'standard' | 'unlimited') || 'standard');

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [excludedCompounds, setExcludedCompounds] = useState<{slug: string; displayName: string; reason: string}[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const reduceMotion = useReducedMotion();

  function toggleCompare(slug: string) {
    setCompareSelection(prev => {
      if (prev.includes(slug)) return prev.filter(s => s !== slug);
      if (prev.length >= 2) return [prev[1], slug]; // keep the most recent two
      return [...prev, slug];
    });
  }

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Wizard state
  const [step, setStep] = useState(searchParams.get('run') === 'true' ? 5 : 1);
  const [saving, setSaving] = useState(false);
  const [selectedDrawerCompound, setSelectedDrawerCompound] = useState<MatchResult | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Sync state to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (goal) params.set('goal', goal);
    if (evidenceComfort) params.set('comfort', evidenceComfort);
    if (riskTolerance) params.set('risk', riskTolerance);
    if (excludeInjectables) params.set('no_injectables', 'true');
    if (requireLongHalfLife) params.set('long_half_life', 'true');
    if (preference && preference !== 'either') params.set('preference', preference);
    if (budget && budget !== 'standard') params.set('budget', budget);
    excludeSlugs.forEach(s => params.append('exclude', s));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [goal, evidenceComfort, riskTolerance, excludeInjectables, requireLongHalfLife, preference, budget, excludeSlugs, pathname, router]);

  async function onSubmit(e?: React.FormEvent, overrides?: Record<string, unknown>) {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const payload = overrides ? overrides : { goal, evidenceComfort, riskTolerance, excludeInjectables, requireLongHalfLife, excludeSlugs, preference, budget };
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
      setExcludedCompounds((data as Record<string, unknown>).excluded as {slug: string; displayName: string; reason: string}[] ?? []);
    } catch {
      setErrorMsg('Network Error. Please Try Again.');
    } finally {
      setLoading(false);
    }
  }

  // Auto-run if deep linked
  useEffect(() => {
    if (searchParams.get('run') === 'true') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      onSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Only re-run if we already have results (meaning we are on step 5)
    if (results !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      onSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excludeSlugs]);

  // Lock background scroll while the compare modal is open.
  useEffect(() => {
    if (!showCompare) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showCompare]);

  // A11y: initial focus, Tab trap, Escape-to-close, focus restore for the compare modal
  const compareDialogRef = useModalA11y<HTMLDivElement>(showCompare, {
    onClose: () => setShowCompare(false),
  });

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
        const msg = data.error ?? 'AI Configure Failed. Please Try Again.';
        setErrorMsg(msg);
        toast.error(msg);
        return;
      }
      if (data.result) {
        if (data.result.goal) setGoal(data.result.goal);
        if (data.result.evidenceComfort) setEvidenceComfort(data.result.evidenceComfort);
        if (data.result.riskTolerance) setRiskTolerance(data.result.riskTolerance);
        if (typeof data.result.excludeInjectables === 'boolean') setExcludeInjectables(data.result.excludeInjectables);
        if (typeof data.result.requireLongHalfLife === 'boolean') setRequireLongHalfLife(data.result.requireLongHalfLife);
        if (data.result.preference) setPreference(data.result.preference);
        if (data.result.budget) setBudget(data.result.budget);
        setAiPrompt('');
        
        // Advance to results step, then run matching with overrides to bypass React closure state delays
        setStep(5);
        onSubmit(undefined, {
          goal: data.result.goal || goal,
          goals: data.result.goals || (data.result.goal ? [data.result.goal] : undefined),
          evidenceComfort: data.result.evidenceComfort || evidenceComfort,
          riskTolerance: data.result.riskTolerance || riskTolerance,
          excludeInjectables: typeof data.result.excludeInjectables === 'boolean' ? data.result.excludeInjectables : excludeInjectables,
          requireLongHalfLife: typeof data.result.requireLongHalfLife === 'boolean' ? data.result.requireLongHalfLife : requireLongHalfLife,
          preference: data.result.preference || preference,
          budget: data.result.budget || budget,
          excludeSlugs
        });
      }
    } catch {
      const msg = 'Network Error Communicating With AI.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSaveMatch() {
    setSaving(true);
    try {
      const payload = { goal, evidenceComfort, riskTolerance, excludeInjectables, requireLongHalfLife, preference, budget, excludeSlugs };
      const res = await saveMatchAction(payload, results || []);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success('Match Saved To Your Dashboard.');
      }
    } catch {
      toast.error('Failed To Save Match.');
    } finally {
      setSaving(false);
    }
  }

  const stackPartners = results?.filter(r => r.isStackPartner) || [];

  // The two compounds shown in the compare modal: the user's picks if they
  // selected exactly two, otherwise the top two results.
  const comparePair: MatchResult[] = results
    ? (compareSelection.length === 2
        ? compareSelection.map(s => results.find(r => r.slug === s)).filter((r): r is MatchResult => Boolean(r))
        : results.slice(0, 2))
    : [];

  // Human-readable summary of the active criteria, shown on the results view.
  const criteriaChips: string[] = [
    goalOptions.find(g => g.value === goal)?.label ?? goal,
    EVIDENCE_OPTIONS.find(o => o.value === evidenceComfort)?.label ?? 'Any Evidence',
    RISK_OPTIONS.find(o => o.value === riskTolerance)?.label ?? 'Any Risk',
  ];
  if (preference && preference !== 'either') criteriaChips.push(preference === 'single' ? 'Single Compounds' : 'Pre-Blended Stacks');
  if (budget && budget !== 'standard') criteriaChips.push(budget === 'conservative' ? 'Cost-Sensitive' : 'Ignore Cost');
  if (excludeInjectables) criteriaChips.push('No Injectables');
  if (requireLongHalfLife) criteriaChips.push('Long Half-Life');

  return (
    <div className="match-container" style={{ position: 'relative', minHeight: '600px' }}>
      <CompoundDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} result={selectedDrawerCompound} />

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
        .step-card {
          background: #0F1923;
          border: 1px solid rgba(168,180,192,0.2);
          border-radius: 12px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .step-card:hover {
          border-color: var(--teal);
          background: rgba(0,196,188,0.05);
        }
        .step-card.selected {
          border-color: var(--teal);
          background: rgba(0,196,188,0.1);
        }
        .image-card {
          border-radius: 12px;
          cursor: pointer;
          transition: transform 0.3s, box-shadow 0.3s, border-color 0.3s;
        }
        .image-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 20px rgba(0,0,0,0.4);
          border-color: var(--teal) !important;
        }
        .image-card:hover .card-overlay {
          background: rgba(0,196,188,0.1) !important;
        }
        .match-result-card {
          transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
        }
        .match-result-card:hover {
          border-color: rgba(0,196,188,0.45) !important;
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(0,0,0,0.35);
        }
        .match-head { display: flex; align-items: flex-start; gap: 18px; }
        .match-name {
          color: var(--white, #FFFFFF);
          font-weight: 800;
          font-size: 1.3rem;
          letter-spacing: -0.01em;
          text-decoration: none;
          transition: color 0.15s ease;
        }
        .match-name:hover { color: var(--teal, #00C4BC); }
        .match-rank {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 26px; height: 26px; padding: 0 8px;
          border-radius: 8px; font-size: 0.82rem; font-weight: 800;
          background: rgba(255,255,255,0.06); color: var(--silver-light, #D0DAE4);
          border: 1px solid rgba(255,255,255,0.08); flex-shrink: 0;
        }
        .match-rank.top1 { background: linear-gradient(135deg,#F6C453,#E0A32E); color:#241A00; border-color:transparent; }
        .match-rank.top2 { background: linear-gradient(135deg,#D7DEE6,#AEB9C6); color:#1A1F26; border-color:transparent; }
        .match-rank.top3 { background: linear-gradient(135deg,#E0A579,#C07A45); color:#241304; border-color:transparent; }
        .match-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
        .match-chip {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 0.78rem; font-weight: 600; color: var(--silver, #A8B4C0);
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 999px; padding: 4px 11px;
        }
        .match-actions { display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; }
        .match-actions button { white-space: nowrap; justify-content: center; min-width: 118px; }
        @media (max-width: 640px) {
          .match-head { flex-wrap: wrap; }
          .match-actions { flex-direction: row; width: 100%; }
          .match-actions button { flex: 1; }
        }
        .criteria-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 20px; }
        .criteria-chip {
          font-size: 0.76rem; font-weight: 600; color: var(--silver-light, #D0DAE4);
          background: rgba(0,196,188,0.08); border: 1px solid rgba(0,196,188,0.25);
          border-radius: 999px; padding: 4px 11px;
        }
        .cmp-toggle {
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          background: none; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
          color: #A8B4C0; padding: 8px 12px; cursor: pointer; font-size: 0.85rem;
        }
        .cmp-toggle.on { border-color: var(--teal, #00C4BC); color: var(--teal, #00C4BC); background: rgba(0,196,188,0.08); }
        .factor-row { display: grid; grid-template-columns: 130px 1fr 46px; align-items: center; gap: 10px; margin-bottom: 8px; }
        .factor-track { height: 7px; border-radius: 999px; background: rgba(255,255,255,0.06); overflow: hidden; }
        .factor-fill { height: 100%; border-radius: 999px; }
        @keyframes skeleton-pulse { 0%,100% { opacity: 0.35; } 50% { opacity: 0.7; } }
        .skeleton-shimmer { background: rgba(255,255,255,0.08); animation: skeleton-pulse 1.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .skeleton-shimmer { animation: none; } }
        @media (max-width: 480px) { .factor-row { grid-template-columns: 108px 1fr 40px; } }
      `}</style>

      <div className="print-only">
        <h1>Pep Nation Lab - Research Protocol Report</h1>
        <p><strong>Goal:</strong> {goalOptions.find(g => g.value === goal)?.label}</p>
        <p><strong>Generated:</strong> {new Date().toLocaleDateString()}</p>
        <hr />
      </div>

      <div className="no-print" style={{ display: 'flex', gap: '8px', marginBottom: '24px', justifyContent: 'center' }}>
        {[1, 2, 3, 4, 5].map(s => (
          <div key={s} style={{ height: '4px', flex: 1, maxWidth: '60px', background: s <= step ? 'var(--teal)' : 'rgba(255,255,255,0.1)', borderRadius: '2px', transition: 'background 0.3s' }} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.3 }} className="glass-panel no-print" style={{ padding: '32px' }}>
            <h2 style={{ fontSize: '1.8rem', color: 'white', marginBottom: '8px' }}>What Is Your Primary Research Goal?</h2>
            <p style={{ color: 'var(--silver)', marginBottom: '32px' }}>Tap Any Goal Below To Continue &mdash; The Engine Calibrates Instantly.</p>
            
            <div style={{ marginBottom: '40px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p style={{ color: 'var(--silver)', fontSize: '0.9rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} color="var(--teal)" /> Or Use AI To Configure Parameters:
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Describe Your Scenario..." style={{ flex: 1, padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid #1D2D3E', background: '#0F1923', color: 'white', fontSize: '1rem' }} onKeyDown={e => e.key === 'Enter' && onAiSubmit()} />
                <button onClick={onAiSubmit} disabled={aiLoading} className="btn-secondary" style={{ padding: '0 1.5rem', fontWeight: 600 }}>{aiLoading ? 'Thinking...' : 'AI Configure'}</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
              {goalOptions.map(g => (
                <div
                  key={g.value}
                  onClick={() => { setGoal(g.value); setStep(2); }}
                  role="button"
                  tabIndex={0}
                  aria-pressed={goal === g.value}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      if (e.key === ' ') e.preventDefault();
                      setGoal(g.value); setStep(2);
                    }
                  }}
                  className={`image-card ${goal === g.value ? 'selected' : ''}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#0F1923',
                    border: goal === g.value ? '2px solid var(--teal)' : '1px solid rgba(168,180,192,0.2)',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{
                    width: '100%',
                    aspectRatio: '1/1',
                    backgroundImage: `url('/images/areas/${g.value === 'any' ? 'blank_card' : g.value}.png')`,
                    backgroundSize: 'contain',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    position: 'relative',
                    backgroundColor: goal === g.value ? 'rgba(0,196,188,0.1)' : 'transparent'
                  }}>
                    {goal === g.value && (
                      <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 3, background: 'var(--teal)', borderRadius: '50%', padding: '4px' }}>
                        <ShieldCheck size={16} color="#0F1923" />
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '20px 16px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', background: '#0a0f14' }}>
                    <h3 style={{ color: 'white', fontSize: '1.2rem', margin: '0 0 8px 0' }}>{g.label}</h3>
                    <p style={{ color: 'var(--silver)', fontSize: '0.9rem', margin: 0 }}>{g.blurb}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'center' }}>
              <button 
                onClick={() => setStep(2)} 
                className="btn-primary" 
                style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', 
                  width: '100%', maxWidth: '400px', padding: '16px', fontSize: '1.2rem', 
                  fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px',
                  boxShadow: '0 0 20px rgba(0,196,188,0.4)'
                }}
              >
                Continue With {goalOptions.find(g => g.value === goal)?.label ?? 'This Goal'} <ArrowRight size={24} />
              </button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step2" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.3 }} className="glass-panel no-print" style={{ padding: '32px' }}>
            <h2 style={{ fontSize: '1.8rem', color: 'white', marginBottom: '8px' }}>Evidence Tier Comfort</h2>
            <p style={{ color: 'var(--silver)', marginBottom: '24px' }}>How Much Clinical Evidence Do You Require For These Compounds?</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {EVIDENCE_OPTIONS.map(o => (
                <div key={o.value} onClick={() => { setEvidenceComfort(o.value); setStep(3); }} role="button" tabIndex={0} aria-pressed={evidenceComfort === o.value} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { if (e.key === ' ') e.preventDefault(); setEvidenceComfort(o.value); setStep(3); } }} className={`step-card ${evidenceComfort === o.value ? 'selected' : ''}`}>
                  <h3 style={{ color: 'white', fontSize: '1.1rem', margin: '0 0 4px 0' }}>{o.label}</h3>
                  <p style={{ color: 'var(--silver)', fontSize: '0.85rem', margin: 0 }}>{o.help}</p>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => setStep(1)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ArrowLeft size={18} /> Back</button>
              <button onClick={() => setStep(3)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>Next Step <ArrowRight size={18} /></button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="step3" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.3 }} className="glass-panel no-print" style={{ padding: '32px' }}>
            <h2 style={{ fontSize: '1.8rem', color: 'white', marginBottom: '8px' }}>Risk Tolerance</h2>
            <p style={{ color: 'var(--silver)', marginBottom: '24px' }}>Set Your Safety Constraints.</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {RISK_OPTIONS.map(o => (
                <div key={o.value} onClick={() => { setRiskTolerance(o.value); setStep(4); }} role="button" tabIndex={0} aria-pressed={riskTolerance === o.value} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { if (e.key === ' ') e.preventDefault(); setRiskTolerance(o.value); setStep(4); } }} className={`step-card ${riskTolerance === o.value ? 'selected' : ''}`}>
                  <h3 style={{ color: 'white', fontSize: '1.1rem', margin: '0 0 4px 0' }}>{o.label}</h3>
                  <p style={{ color: 'var(--silver)', fontSize: '0.85rem', margin: 0 }}>{o.help}</p>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => setStep(2)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ArrowLeft size={18} /> Back</button>
              <button onClick={() => setStep(4)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>Next Step <ArrowRight size={18} /></button>
            </div>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div key="step4" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.3 }} className="glass-panel no-print" style={{ padding: '32px' }}>
            <h2 style={{ fontSize: '1.8rem', color: 'white', marginBottom: '8px' }}>Advanced Preferences</h2>
            <p style={{ color: 'var(--silver)', marginBottom: '24px' }}>Fine-Tune Format And Handling Requirements.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label className="block text-sm font-bold text-white mb-2">Format Preference</label>
                <select value={preference} onChange={(e) => setPreference(e.target.value as 'single' | 'stack' | 'either')} className="w-full max-w-md p-3 rounded-md border border-[#1D2D3E] bg-[#0F1923] text-white">
                  <option value="either">Any Format</option>
                  <option value="single">Single Compounds Only</option>
                  <option value="stack">Pre-Blended Stacks Only</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-white mb-2">Budget Sensitivity</label>
                <select value={budget} onChange={(e) => setBudget(e.target.value as 'conservative' | 'standard' | 'unlimited')} className="w-full max-w-md p-3 rounded-md border border-[#1D2D3E] bg-[#0F1923] text-white">
                  <option value="standard">Standard Budget</option>
                  <option value="conservative">Conservative (Cost-Sensitive)</option>
                  <option value="unlimited">Unlimited (Ignore Cost)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'white', fontSize: '1.05rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={excludeInjectables} onChange={e => setExcludeInjectables(e.target.checked)} style={{ width: 20, height: 20 }} />
                  Exclude Injectables (Oral/Topical/Nasal Only)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'white', fontSize: '1.05rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={requireLongHalfLife} onChange={e => setRequireLongHalfLife(e.target.checked)} style={{ width: 20, height: 20 }} />
                  Require Long Half-Life (Less Frequent Dosing)
                </label>
              </div>
            </div>

            <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => setStep(3)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ArrowLeft size={18} /> Back</button>
              <button onClick={() => { setStep(5); onSubmit(); }} className="btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} /> {loading ? 'Matching...' : 'Generate Matches'}
              </button>
            </div>
          </motion.div>
        )}

        {step === 5 && (
          <motion.div key="step5" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }} className="no-print">
              <button onClick={() => setStep(1)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ArrowLeft size={18} /> Edit Criteria</button>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {results && results.length > 0 && (
                  <>
                    <button onClick={handleSaveMatch} disabled={saving} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Save size={18} /> {saving ? 'Saving...' : 'Save Stack'}
                    </button>
                    <button onClick={() => window.print()} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Printer size={18} /> Export PDF
                    </button>
                  </>
                )}
                {results && results.length >= 2 && (
                  <button onClick={() => setShowCompare(true)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Scale size={18} /> {compareSelection.length === 2 ? 'Compare Selected' : 'Compare Top 2'}
                  </button>
                )}
              </div>
            </div>

            {loading && !results && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--teal)', marginBottom: '20px' }}>
                  <Sparkles size={20} className="animate-pulse" />
                  <span style={{ color: 'white', fontWeight: 700 }}>Ranking The Catalog...</span>
                </div>
                <div style={{ display: 'grid', gap: 'var(--space-4, 16px)' }}>
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className="glass-panel skeleton-card" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', display: 'flex', gap: '18px', alignItems: 'center' }}>
                      <div className="skeleton-shimmer" style={{ width: 60, height: 60, borderRadius: '50%', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div className="skeleton-shimmer" style={{ width: '45%', height: 18, borderRadius: 6, marginBottom: 12 }} />
                        <div className="skeleton-shimmer" style={{ width: '90%', height: 12, borderRadius: 6, marginBottom: 8 }} />
                        <div className="skeleton-shimmer" style={{ width: '70%', height: 12, borderRadius: 6 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!loading && errorMsg && (
              <div className="no-print" style={{ color: '#F08A8A', background: 'rgba(229,62,62,0.08)', border: '1px solid rgba(229,62,62,0.3)', borderRadius: '8px', padding: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={18} /> {errorMsg}</span>
                <button onClick={() => onSubmit()} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '8px 14px' }}>
                  <RotateCcw size={15} /> Try Again
                </button>
              </div>
            )}

            {results && stackPartners.length >= 2 && (
              <div className="glass-panel" style={{ borderColor: 'var(--teal, #00C4BC)', marginBottom: '1.5rem', background: 'rgba(0,196,188,0.05)', opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 8px 0', color: 'var(--teal, #00C4BC)' }}>
                  <Info size={18} /> Synergistic Stack Detected
                </h4>
                <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--silver)' }}>
                  The engine detected that <strong>{stackPartners[0].displayName}</strong> and <strong>{stackPartners[1].displayName}</strong> are highly synergistic and frequently researched together as a stack for this protocol.
                  <Link href={`/research/compare?add=${stackPartners[0].slug},${stackPartners[1].slug}`} style={{ color: 'var(--white)', fontWeight: 700, marginLeft: '8px', textDecoration: 'underline' }}>
                    Compare Them Side-By-Side <ChevronRight size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />
                  </Link>
                </p>
              </div>
            )}

            {!loading && results && results.length === 0 && (
              <div className="glass-panel" style={{ textAlign: 'center', padding: '48px' }}>
                <p style={{ color: 'var(--silver)', fontSize: '1.2rem', marginBottom: '24px' }}>No Matching Compounds Survived Your Constraints.</p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button onClick={() => setStep(2)} className="btn-primary">Loosen Constraints</button>
                  {excludeSlugs.length > 0 && (
                    <button onClick={() => setExcludeSlugs([])} className="btn-secondary">Clear Exclusions</button>
                  )}
                </div>
              </div>
            )}

            {results && results.length > 0 && (
              <div style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s', pointerEvents: loading ? 'none' : 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4, 16px)' }}>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--white, #FFFFFF)', margin: 0 }}>
                    Top {results.length} {results.length === 1 ? 'Match' : 'Matches'} {loading && <Sparkles size={16} className="animate-pulse inline" />}
                  </h3>
                  {excludeSlugs.length > 0 && (
                    <button onClick={() => setExcludeSlugs([])} className="no-print" style={{ background: 'rgba(229,62,62,0.1)', color: '#F08A8A', border: '1px solid rgba(229,62,62,0.3)', borderRadius: '8px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                      Clear Exclusions ({excludeSlugs.length})
                    </button>
                  )}
                </div>
                <div className="criteria-bar no-print" aria-label="Active match criteria">
                  <span style={{ fontSize: '0.76rem', color: 'var(--grey-500, #6B7785)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Criteria</span>
                  {criteriaChips.map((c, i) => (
                    <span key={i} className="criteria-chip">{c}</span>
                  ))}
                  <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: 'var(--teal, #00C4BC)', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: '4px' }}>Edit</button>
                </div>
                <div style={{ display: 'grid', gap: 'var(--space-4, 16px)' }}>
                  {results.map((r, idx) => (
                    <div key={r.slug} className="glass-panel match-result-card" style={{ position: 'relative', padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)' }}>
                      <div className="match-head">
                        <CircularScore score={r.score} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <span className={`match-rank${idx === 0 ? ' top1' : idx === 1 ? ' top2' : idx === 2 ? ' top3' : ''}`}>#{idx + 1}</span>
                            <Link href={`/research/${r.slug}`} className="match-name">{r.displayName}</Link>
                          </div>
                          <p style={{ margin: '10px 0 0', color: 'var(--silver-light, #D0DAE4)', lineHeight: 1.6, fontSize: '0.98rem' }}>
                            {r.rationale}
                          </p>
                          <div className="match-chips">
                            {(() => {
                              const rm = riskMeta(r.riskLevel);
                              return (
                                <span className="match-chip" style={{ color: rm.color, borderColor: `${rm.color}55` }}>
                                  <AlertTriangle size={12} aria-hidden="true" /> {rm.label}
                                </span>
                              );
                            })()}
                            {r.halfLife && (
                              <span className="match-chip"><Clock size={13} aria-hidden="true" /> Half-Life: {r.halfLife}</span>
                            )}
                            {r.molecularWeight && (
                              <span className="match-chip"><Atom size={13} aria-hidden="true" /> {r.molecularWeight} Da</span>
                            )}
                            {r.isTempSensitive && (
                              <span className="match-chip"><Snowflake size={13} aria-hidden="true" /> Cold Storage</span>
                            )}
                          </div>
                        </div>
                        <div className="match-actions no-print">
                          <button onClick={() => { setSelectedDrawerCompound(r); setIsDrawerOpen(true); }} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '8px 12px' }}>
                            <Eye size={16} /> Quick View
                          </button>
                          <button
                            onClick={() => toggleCompare(r.slug)}
                            aria-pressed={compareSelection.includes(r.slug)}
                            className={`cmp-toggle${compareSelection.includes(r.slug) ? ' on' : ''}`}
                          >
                            {compareSelection.includes(r.slug) ? <Check size={14} /> : <Scale size={14} />} Compare
                          </button>
                          <button onClick={() => setExcludeSlugs(prev => [...prev, r.slug])} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#A8B4C0', padding: '8px 12px', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Trash2 size={14} /> Exclude
                          </button>
                        </div>
                      </div>
                      
                      <div className="no-print" style={{ marginTop: '16px', background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '8px' }}>
                        <details style={{ fontSize: '0.9rem', color: '#A8B4C0' }}>
                          <summary style={{ cursor: 'pointer', outline: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Search size={16} /> How This Score Was Calculated
                          </summary>
                          <div style={{ marginTop: '14px' }}>
                            {BREAKDOWN_FACTORS.filter(f => (r.scoreBreakdown[f.key] ?? 0) !== 0).map(f => {
                              const val = r.scoreBreakdown[f.key] ?? 0;
                              const width = `${Math.min(100, (Math.abs(val) / 45) * 100)}%`;
                              const neg = val < 0;
                              return (
                                <div key={f.key} className="factor-row">
                                  <span style={{ fontSize: '0.8rem', color: 'var(--silver, #A8B4C0)' }}>{f.label}</span>
                                  <span className="factor-track"><span className="factor-fill" style={{ width, background: neg ? '#FC8181' : f.color }} /></span>
                                  <span style={{ fontSize: '0.85rem', fontWeight: 800, textAlign: 'right', color: neg ? '#FC8181' : 'var(--white, #FFFFFF)' }}>{val > 0 ? `+${val}` : val}</span>
                                </div>
                              );
                            })}
                            <div className="factor-row" style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--white, #FFFFFF)' }}>Total Match Score</span>
                              <span className="factor-track" style={{ background: 'transparent' }} />
                              <span style={{ fontSize: '0.95rem', fontWeight: 800, textAlign: 'right', color: 'var(--teal, #00C4BC)' }}>{r.score}</span>
                            </div>
                          </div>
                        </details>
                      </div>
                    </div>
                  ))}
                </div>

                {excludedCompounds && excludedCompounds.length > 0 && (
                  <div className="no-print glass-panel" style={{ marginTop: '32px', background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '12px' }}>
                    <h4 style={{ color: 'var(--silver)', marginBottom: '16px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Info size={16} /> Famous Compounds Excluded
                    </h4>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {excludedCompounds.map(ec => (
                        <li key={ec.slug} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--teal)', fontWeight: 600, minWidth: '120px' }}>{ec.displayName}</span>
                          <span style={{ color: 'var(--silver)' }}>{ec.reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {showCompare && comparePair.length >= 2 && (
        <div
          className="no-print"
          onClick={() => setShowCompare(false)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div
            ref={compareDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Head-to-head compound comparison"
            onClick={(e) => e.stopPropagation()}
            className="glass-panel"
            style={{ width: '100%', maxWidth: '760px', maxHeight: '90vh', overflowY: 'auto', background: '#0F1923' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: 'white' }}>Head-To-Head Comparison</h3>
              <button onClick={() => setShowCompare(false)} aria-label="Close comparison" style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            {(() => {
              const [a, b] = comparePair;
              const higher = (x: number, y: number) => (x === y ? 0 : x > y ? -1 : 1); // -1 => a wins
              const win = higher(a.score, b.score);
              const winStyle = { color: 'var(--teal, #00C4BC)', fontWeight: 800 };
              const rows: { label: string; a: React.ReactNode; b: React.ReactNode }[] = [
                {
                  label: 'Match Score',
                  a: <span style={win === -1 ? winStyle : { fontWeight: 700 }}>{a.score} / 100</span>,
                  b: <span style={win === 1 ? winStyle : { fontWeight: 700 }}>{b.score} / 100</span>,
                },
                {
                  label: 'Evidence Tier',
                  a: <span style={{ color: tierColor(a.evidenceTier), fontWeight: 700 }}>{tierLabel(a.evidenceTier)}</span>,
                  b: <span style={{ color: tierColor(b.evidenceTier), fontWeight: 700 }}>{tierLabel(b.evidenceTier)}</span>,
                },
                {
                  label: 'Risk Level',
                  a: <span style={{ color: riskMeta(a.riskLevel).color, fontWeight: 700 }}>{riskMeta(a.riskLevel).label}</span>,
                  b: <span style={{ color: riskMeta(b.riskLevel).color, fontWeight: 700 }}>{riskMeta(b.riskLevel).label}</span>,
                },
                { label: 'Half-Life', a: a.halfLife || 'Unknown', b: b.halfLife || 'Unknown' },
                { label: 'Molecular Weight', a: a.molecularWeight ? `${a.molecularWeight} Da` : 'Unknown', b: b.molecularWeight ? `${b.molecularWeight} Da` : 'Unknown' },
                { label: 'Storage', a: a.isTempSensitive ? 'Cold Storage' : 'Room Temp', b: b.isTempSensitive ? 'Cold Storage' : 'Room Temp' },
              ];
              return (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: 'white' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1D2D3E' }}>
                      <th style={{ padding: '12px', color: '#A8B4C0', fontWeight: 600 }}>Feature</th>
                      <th style={{ padding: '12px', fontSize: '1.05rem', color: 'var(--teal)' }}>
                        <Link href={`/research/${a.slug}`} style={{ color: 'var(--teal)', textDecoration: 'none' }}>{a.displayName}</Link>
                      </th>
                      <th style={{ padding: '12px', fontSize: '1.05rem', color: 'var(--teal)' }}>
                        <Link href={`/research/${b.slug}`} style={{ color: 'var(--teal)', textDecoration: 'none' }}>{b.displayName}</Link>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={row.label} style={{ borderBottom: i < rows.length - 1 ? '1px solid #1D2D3E' : 'none' }}>
                        <td style={{ padding: '12px', color: '#A8B4C0' }}>{row.label}</td>
                        <td style={{ padding: '12px' }}>{row.a}</td>
                        <td style={{ padding: '12px' }}>{row.b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
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
