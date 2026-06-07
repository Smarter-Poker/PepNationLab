'use client';

import { useMemo, useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Sparkles, ChevronRight, ShieldCheck, Printer, X, Info, Scale, Trash2, ArrowRight, ArrowLeft, Save, Search, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RESEARCH_AREAS, evidenceTier, RISK_META } from '@/lib/compounds';
import type {
  EvidenceComfort,
  MatchResult,
  RiskTolerance,
} from '@/lib/match-engine';
import CompoundDrawer from './CompoundDrawer';
import { saveMatchAction } from '@/app/research/actions';
import { toast } from 'sonner';

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
  const wadaConstraint = 'no_constraint';
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
      const payload = overrides ? overrides : { goal, evidenceComfort, wadaConstraint, riskTolerance, excludeInjectables, requireLongHalfLife, excludeSlugs, preference, budget };
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
        if (data.result.riskTolerance) setRiskTolerance(data.result.riskTolerance);
        if (typeof data.result.excludeInjectables === 'boolean') setExcludeInjectables(data.result.excludeInjectables);
        if (typeof data.result.requireLongHalfLife === 'boolean') setRequireLongHalfLife(data.result.requireLongHalfLife);
        if (data.result.preference) setPreference(data.result.preference);
        if (data.result.budget) setBudget(data.result.budget);
        setAiPrompt('');
        
        // Use overrides to bypass React closure state delays
        onSubmit(undefined, {
          goal: data.result.goal || goal,
          evidenceComfort: data.result.evidenceComfort || evidenceComfort,
          wadaConstraint: data.result.wadaConstraint || wadaConstraint,
          riskTolerance: data.result.riskTolerance || riskTolerance,
          excludeInjectables: typeof data.result.excludeInjectables === 'boolean' ? data.result.excludeInjectables : excludeInjectables,
          requireLongHalfLife: typeof data.result.requireLongHalfLife === 'boolean' ? data.result.requireLongHalfLife : requireLongHalfLife,
          preference: data.result.preference || preference,
          budget: data.result.budget || budget,
          excludeSlugs
        });
      }
    } catch {
      setErrorMsg('Network error communicating with AI.');
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSaveMatch() {
    setSaving(true);
    try {
      const payload = { goal, evidenceComfort, wadaConstraint, riskTolerance, excludeInjectables, requireLongHalfLife, preference, budget, excludeSlugs };
      const res = await saveMatchAction(payload, results || []);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success('Match saved to your dashboard!');
      }
    } catch {
      toast.error('Failed to save match.');
    } finally {
      setSaving(false);
    }
  }

  const stackPartners = results?.filter(r => r.isStackPartner) || [];

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
          <motion.div key="step1" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }} transition={{ duration: 0.3 }} className="glass-panel no-print" style={{ padding: '32px' }}>
            <h2 style={{ fontSize: '1.8rem', color: 'white', marginBottom: '8px' }}>What is your primary research goal?</h2>
            <p style={{ color: 'var(--silver)', marginBottom: '32px' }}>Select the main focus of your protocol to calibrate the engine.</p>
            
            <div style={{ marginBottom: '40px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p style={{ color: 'var(--silver)', fontSize: '0.9rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} color="var(--teal)" /> Or use AI to configure parameters:
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Describe your scenario..." style={{ flex: 1, padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid #1D2D3E', background: '#0F1923', color: 'white', fontSize: '1rem' }} onKeyDown={e => e.key === 'Enter' && onAiSubmit()} />
                <button onClick={onAiSubmit} disabled={aiLoading} className="btn-secondary" style={{ padding: '0 1.5rem', fontWeight: 600 }}>{aiLoading ? 'Thinking...' : 'AI Configure'}</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
              {goalOptions.map(g => (
                <div 
                  key={g.value} 
                  onClick={() => setGoal(g.value)} 
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
                Next Step <ArrowRight size={24} />
              </button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step2" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }} transition={{ duration: 0.3 }} className="glass-panel no-print" style={{ padding: '32px' }}>
            <h2 style={{ fontSize: '1.8rem', color: 'white', marginBottom: '8px' }}>Evidence Tier Comfort</h2>
            <p style={{ color: 'var(--silver)', marginBottom: '24px' }}>How much clinical evidence do you require for these compounds?</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {EVIDENCE_OPTIONS.map(o => (
                <div key={o.value} onClick={() => setEvidenceComfort(o.value)} className={`step-card ${evidenceComfort === o.value ? 'selected' : ''}`}>
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
          <motion.div key="step3" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }} transition={{ duration: 0.3 }} className="glass-panel no-print" style={{ padding: '32px' }}>
            <h2 style={{ fontSize: '1.8rem', color: 'white', marginBottom: '8px' }}>Risk Tolerance</h2>
            <p style={{ color: 'var(--silver)', marginBottom: '24px' }}>Set your safety constraints.</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {RISK_OPTIONS.map(o => (
                <div key={o.value} onClick={() => setRiskTolerance(o.value)} className={`step-card ${riskTolerance === o.value ? 'selected' : ''}`}>
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
          <motion.div key="step4" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }} transition={{ duration: 0.3 }} className="glass-panel no-print" style={{ padding: '32px' }}>
            <h2 style={{ fontSize: '1.8rem', color: 'white', marginBottom: '8px' }}>Advanced Preferences</h2>
            <p style={{ color: 'var(--silver)', marginBottom: '24px' }}>Fine-tune format and handling requirements.</p>

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
          <motion.div key="step5" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }} className="no-print">
              <button onClick={() => setStep(1)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ArrowLeft size={18} /> Edit Criteria</button>
              <div style={{ display: 'flex', gap: '12px' }}>
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
                    <Scale size={18} /> Compare Top 2
                  </button>
                )}
              </div>
            </div>

            {loading && !results && (
              <div style={{ textAlign: 'center', padding: '64px', color: 'var(--teal)' }}>
                <Sparkles size={48} className="animate-pulse mx-auto mb-4" />
                <h3 style={{ fontSize: '1.5rem', color: 'white' }}>Running Deterministic Match Engine...</h3>
              </div>
            )}

            {!loading && errorMsg && (
              <p className="no-print" style={{ color: '#E53E3E', background: 'rgba(229,62,62,0.08)', border: '1px solid rgba(229,62,62,0.3)', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                {errorMsg}
              </p>
            )}

            {results && stackPartners.length >= 2 && (
              <div className="glass-panel" style={{ borderColor: 'var(--teal, #00C4BC)', marginBottom: '1.5rem', background: 'rgba(0,196,188,0.05)', opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 8px 0', color: 'var(--teal, #00C4BC)' }}>
                  <Info size={18} /> Synergistic Stack Detected
                </h4>
                <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--silver)' }}>
                  The engine detected that <strong>{stackPartners[0].displayName}</strong> and <strong>{stackPartners[1].displayName}</strong> are highly synergistic and frequently researched together as a stack for this protocol.
                  <Link href={`/research/compare?add=${stackPartners[0].slug},${stackPartners[1].slug}`} style={{ color: 'var(--white)', fontWeight: 700, marginLeft: '8px', textDecoration: 'underline' }}>
                    Compare Them Side-by-Side <ChevronRight size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />
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
                <div style={{ display: 'grid', gap: 'var(--space-4, 16px)' }}>
                  {results.map((r, idx) => (
                    <div key={r.slug} className="glass-panel" style={{ position: 'relative', padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                          <CircularScore score={r.score} />
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                              <span style={{ color: 'var(--teal, #00C4BC)', fontWeight: 800, fontSize: '1.4rem' }}>
                                {idx + 1}. {r.displayName}
                              </span>
                              {(() => {
                                const meta = evidenceTier(r.evidenceTier);
                                return meta.badgeUrl ? (
                                  <img src={meta.badgeUrl} alt={meta.label} style={{ height: '38px', width: 'auto', maxWidth: 'none', borderRadius: 6, objectFit: 'contain', flexShrink: 0 }} />
                                ) : (
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '999px', color: tierColor(r.evidenceTier), border: `1px solid ${tierColor(r.evidenceTier)}` }}>
                                    {tierLabel(r.evidenceTier)}
                                  </span>
                                );
                              })()}
                            </div>
                            <p style={{ margin: '8px 0 0', color: 'var(--silver-light, #D0DAE4)', lineHeight: 1.55, fontSize: '1rem' }}>
                              {r.rationale}
                            </p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} className="no-print">
                          <button onClick={() => { setSelectedDrawerCompound(r); setIsDrawerOpen(true); }} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '8px 12px' }}>
                            <Eye size={16} /> Quick View
                          </button>
                          <button onClick={() => setExcludeSlugs(prev => [...prev, r.slug])} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#A8B4C0', padding: '8px 12px', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Trash2 size={14} /> Exclude
                          </button>
                        </div>
                      </div>
                      
                      <div className="no-print" style={{ marginTop: '16px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                        <details style={{ fontSize: '0.9rem', color: '#A8B4C0' }}>
                          <summary style={{ cursor: 'pointer', outline: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Search size={16} /> View Explainable AI Score Breakdown
                          </summary>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '12px' }}>
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px' }}>
                              <div style={{ fontSize: '0.8rem' }}>Exact Goal Match</div>
                              <div style={{ color: 'white', fontWeight: 800, fontSize: '1.1rem' }}>+{r.scoreBreakdown.base} pts</div>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px' }}>
                              <div style={{ fontSize: '0.8rem' }}>Keyword Mentions</div>
                              <div style={{ color: 'var(--teal)', fontWeight: 800, fontSize: '1.1rem' }}>+{r.scoreBreakdown.keyword} pts</div>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px' }}>
                              <div style={{ fontSize: '0.8rem' }}>Evidence Bonus</div>
                              <div style={{ color: '#63B3ED', fontWeight: 800, fontSize: '1.1rem' }}>+{r.scoreBreakdown.evidenceBonus} pts</div>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px' }}>
                              <div style={{ fontSize: '0.8rem' }}>Class Synergy</div>
                              <div style={{ color: '#F6AD55', fontWeight: 800, fontSize: '1.1rem' }}>+{r.scoreBreakdown.classBonus} pts</div>
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
                  <td style={{ padding: '12px' }}>
                    {(() => {
                      const meta = evidenceTier(results[0].evidenceTier);
                      return meta.badgeUrl ? (
                        <img src={meta.badgeUrl} alt={meta.label} style={{ height: '38px', width: 'auto', maxWidth: 'none', borderRadius: 6, objectFit: 'contain', flexShrink: 0 }} />
                      ) : (
                        <span style={{ color: tierColor(results[0].evidenceTier) }}>{tierLabel(results[0].evidenceTier)}</span>
                      );
                    })()}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {(() => {
                      const meta = evidenceTier(results[1].evidenceTier);
                      return meta.badgeUrl ? (
                        <img src={meta.badgeUrl} alt={meta.label} style={{ height: '38px', width: 'auto', maxWidth: 'none', borderRadius: 6, objectFit: 'contain', flexShrink: 0 }} />
                      ) : (
                        <span style={{ color: tierColor(results[1].evidenceTier) }}>{tierLabel(results[1].evidenceTier)}</span>
                      );
                    })()}
                  </td>
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
