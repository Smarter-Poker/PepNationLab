'use client';

/**
 * Research Browser - client-side faceted search over the compound catalog.
 * Pure presentation: filtering happens in-memory on props already fetched by
 * the parent server component. Research-use-only framing throughout.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Flame, Activity, Shield, Brain, Sparkles, GraduationCap, ArrowRight } from 'lucide-react';
import {
  type Compound,
  EVIDENCE_TIER,
  evidenceTier,
  RESEARCH_AREAS,
  WADA_LABEL,
  wadaLabel,
} from '@/lib/compounds';
import PinToCompareButton from '@/components/research/PinToCompareButton';
import ResearchCartButton from '@/components/research/ResearchCartButton';
import InteractiveGlossaryText from './InteractiveGlossaryText';
import HelpMeChooseWizard from './HelpMeChooseWizard';

const ALL = 'all';

const selectStyle: React.CSSProperties = {
  background: 'var(--grey-400, #162230)',
  color: 'var(--white, #FFFFFF)',
  border: '1px solid rgba(168,180,192,0.25)',
  borderRadius: 'var(--radius-md, 8px)',
  padding: 'var(--space-2, 8px) var(--space-3, 12px)',
  fontSize: '0.9rem',
};

// Autocorrect / shorthand mapping helper
function autocorrectSearch(input: string): string {
  const words = input.trim().toLowerCase().split(/\s+/);
  const map: Record<string, string> = {
    sema: 'semaglutide',
    tirz: 'tirzepatide',
    reta: 'retatrutide',
    bpc157: 'bpc-157',
    bpc: 'bpc-157',
    tb500: 'tb-500',
    tb: 'tb-500',
  };
  return words.map((w) => map[w] || w).join(' ');
}

// Classify compound administration form
function getCompoundForm(c: Compound): 'injection' | 'oral' | 'topical' | 'other' {
  const form = (c.handling?.form || '').toLowerCase();
  if (form.includes('capsule') || form.includes('oral') || form.includes('tablet')) return 'oral';
  if (form.includes('cream') || form.includes('topical') || form.includes('nasal') || form.includes('spray') || form.includes('gel')) return 'topical';
  if (form.includes('vial') || form.includes('powder') || form.includes('lyophilized') || form.includes('injection')) return 'injection';
  return 'other';
}

export default function ResearchBrowser({ compounds }: { compounds: Compound[] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>(ALL);
  const [tier, setTier] = useState<string>(ALL);
  const [area, setArea] = useState<string>(ALL);
  const [wada, setWada] = useState<string>(ALL);
  const [formFilter, setFormFilter] = useState<string>(ALL);
  const [budgetFilter, setBudgetFilter] = useState<string>(ALL);
  const [prepFilter, setPrepFilter] = useState<string>(ALL);
  const [isEli5, setIsEli5] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardChoices, setWizardChoices] = useState<{ area: string; form: string; wada: string; budget: string; prep: string } | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const c of compounds) {
      if (c.category) set.add(c.category);
    }
    return Array.from(set).sort();
  }, [compounds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const tokens = q ? autocorrectSearch(q).split(/\s+/).filter(Boolean) : [];

    return compounds.filter((c) => {
      if (tokens.length > 0) {
        const haystack = [
          c.display_name,
          ...(c.aliases ?? []),
          c.category ?? '',
          ...(c.research_areas ?? []),
          c.plain_summary ?? '',
          c.eli5_summary ?? '',
          c.compound_class ?? '',
          c.molecular_target ?? '',
        ].join(' ').toLowerCase();
        
        const matchesAll = tokens.every(tok => haystack.includes(tok));
        if (!matchesAll) return false;
      }
      if (category !== ALL && c.category !== category) return false;
      if (tier !== ALL && c.evidence_tier !== tier) return false;
      if (area !== ALL && !(c.research_areas ?? []).includes(area)) return false;
      if (wada !== ALL && c.wada_status !== wada) return false;

      // Form filter matching
      if (formFilter !== ALL) {
        const cForm = getCompoundForm(c);
        if (cForm !== formFilter) return false;
      }

      // Reconstitution equipment matching
      if (prepFilter !== ALL) {
        const form = (c.handling?.form || '').toLowerCase();
        const isReconstitution = form.includes('lyophilized') || form.includes('powder') || form.includes('vial') || form.includes('injection') || form.includes('injectable');
        if (prepFilter === 'reconstitution' && !isReconstitution) return false;
        if (prepFilter === 'no_reconstitution' && isReconstitution) return false;
      }

      // Budget proxy matching
      if (budgetFilter !== ALL) {
        if (budgetFilter === 'conservative') {
          if (c.is_stack) return false;
          const premiumSlugs = ['semaglutide', 'tirzepatide', 'retatrutide', 'igf-1-lr3', 'igf-1-des', 'dihexa', 'mots-c'];
          if (premiumSlugs.includes(c.slug)) return false;
        }
      }

      return true;
    });
  }, [compounds, query, category, tier, area, wada, formFilter, budgetFilter, prepFilter]);

  const handleAreaToggle = (targetArea: string) => {
    setArea((prev) => (prev === targetArea ? ALL : targetArea));
  };

  const handleWizardComplete = (wizardFilters: { area: string; form: string; wada: string; budget: string; prep: string }) => {
    setQuery('');
    setCategory(ALL);
    setTier(ALL);
    if (wizardFilters.area === 'healing') {
      setArea('healing');
    } else {
      setArea(wizardFilters.area);
    }
    setFormFilter(wizardFilters.form);
    setWada(wizardFilters.wada);
    setBudgetFilter(wizardFilters.budget);
    setPrepFilter(wizardFilters.prep);
    setWizardChoices(wizardFilters);
  };

  // Helper to resolve card border based on WADA compliance
  const getCardBorder = (status: string) => {
    if (status === 'permitted') return '1px solid rgba(104, 211, 145, 0.4)';
    if (status === 'prohibited') return '1px solid rgba(229, 62, 62, 0.4)';
    if (status === 'prohibited_males') return '1px solid rgba(246, 173, 85, 0.4)';
    return '1px solid rgba(255, 255, 255, 0.08)';
  };

  // Form badge coloring
  const getFormBadgeStyle = (form: 'injection' | 'oral' | 'topical' | 'other'): React.CSSProperties => {
    const base: React.CSSProperties = {
      fontSize: '0.7rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      padding: '2px 8px',
      borderRadius: '4px',
    };
    if (form === 'oral') {
      return { ...base, background: 'rgba(214, 188, 250, 0.15)', color: '#D6BCFA', border: '1px solid rgba(214, 188, 250, 0.3)' };
    }
    if (form === 'topical') {
      return { ...base, background: 'rgba(0, 196, 188, 0.15)', color: 'var(--teal, #00C4BC)', border: '1px solid rgba(0, 196, 188, 0.3)' };
    }
    if (form === 'injection') {
      return { ...base, background: 'rgba(66, 153, 225, 0.15)', color: '#63B3ED', border: '1px solid rgba(66, 153, 225, 0.3)' };
    }
    return { ...base, background: 'rgba(255, 255, 255, 0.05)', color: 'var(--silver, #A8B4C0)', border: '1px solid rgba(255, 255, 255, 0.1)' };
  };

  // Dosing frequency badge coloring
  const getDosingBadgeStyle = (freq: string): React.CSSProperties => {
    const base: React.CSSProperties = {
      fontSize: '0.7rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      padding: '2px 8px',
      borderRadius: '4px',
    };
    const lower = freq.toLowerCase();
    if (lower.includes('weekly') || lower.includes('week')) {
      return { ...base, background: 'rgba(104, 211, 145, 0.15)', color: '#68D391', border: '1px solid rgba(104, 211, 145, 0.3)' };
    }
    if (lower.includes('daily') || lower.includes('day') || lower.includes('nightly')) {
      return { ...base, background: 'rgba(246, 173, 85, 0.15)', color: '#F6AD55', border: '1px solid rgba(246, 173, 85, 0.3)' };
    }
    return { ...base, background: 'rgba(255, 255, 255, 0.05)', color: 'var(--silver, #A8B4C0)', border: '1px solid rgba(255, 255, 255, 0.1)' };
  };

  // Resolve dosing badge display string
  const getDosingLabel = (freq: string): string => {
    const lower = freq.toLowerCase();
    if (lower.includes('weekly') || lower.includes('week')) return 'Once Weekly';
    if (lower.includes('daily') || lower.includes('day') || lower.includes('nightly')) return 'Daily';
    return freq;
  };

  // WADA badge coloring
  const wadaBadgeStyle = (status: string): React.CSSProperties => {
    if (status === 'permitted') {
      return { color: '#68D391', border: '1px solid #68D391' };
    }
    if (status === 'prohibited') {
      return { color: '#FC8181', border: '1px solid #FC8181' };
    }
    if (status === 'prohibited_males') {
      return { color: '#F6AD55', border: '1px solid #F6AD55' };
    }
    return { color: '#A8B4C0', border: '1px solid rgba(168,180,192,0.3)' };
  };

  // Helper to format profile value to Title Case
  const formatProfileValue = (key: string, val: string) => {
    if (val === 'all') {
      if (key === 'area') return 'All Areas';
      if (key === 'route') return 'All Routes';
      if (key === 'budget') return 'All Budgets';
      return 'All';
    }
    if (key === 'area') {
      if (val === 'weight_management') return 'Weight Management';
      if (val === 'healing') return 'Healing';
      if (val === 'longevity') return 'Longevity';
      if (val === 'sleep') return 'Sleep';
    }
    if (key === 'route') {
      if (val === 'injection') return 'Injection (Vial)';
      if (val === 'oral') return 'Oral (Capsule)';
      if (val === 'topical') return 'Topical';
    }
    if (key === 'budget') {
      if (val === 'conservative') return 'Conservative Budget';
      if (val === 'standard') return 'Standard Budget';
    }
    return val.charAt(0).toUpperCase() + val.slice(1);
  };

  return (
    <div>
      {/* Guided Selection Wizard Recommendations */}
      {wizardChoices && (
        <div
          className="glass-panel"
          style={{
            padding: '20px 24px',
            borderRadius: 'var(--radius-lg, 12px)',
            marginBottom: '28px',
            background: 'linear-gradient(135deg, rgba(0, 196, 188, 0.08), rgba(22, 34, 48, 0.95))',
            border: '1px solid rgba(0, 196, 188, 0.25)',
            borderLeft: '4px solid var(--teal, #00C4BC)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--white, #FFFFFF)' }}>
                Guided Recommendations
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', margin: '4px 0 0 0' }}>
                Your Profile: {formatProfileValue('area', wizardChoices.area)} | {formatProfileValue('route', wizardChoices.form)} | {formatProfileValue('budget', wizardChoices.budget)}
              </p>
            </div>
            <button
              onClick={() => {
                setArea(ALL);
                setFormFilter(ALL);
                setWada(ALL);
                setBudgetFilter(ALL);
                setPrepFilter(ALL);
                setWizardChoices(null);
              }}
              style={{
                background: 'rgba(229, 62, 62, 0.1)',
                border: '1px solid rgba(229, 62, 62, 0.3)',
                color: '#FC8181',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Clear Recommendation Profile
            </button>
          </div>
          <div style={{ fontSize: '0.85rem', lineHeight: 1.5, color: 'var(--silver, #A8B4C0)' }}>
            {wizardChoices.area === 'weight_management' && (
              <div>
                {wizardChoices.budget === 'conservative' ? (
                  <div>
                    We recommend evaluating <strong>AOD-9604</strong> (highly target lipolytic fragment) or <strong>5-Amino-1MQ</strong> (oral NNMT inhibitor designed to increase cellular energy metabolism and reduce adipose accumulation without affecting appetite).
                  </div>
                ) : (
                  <div>
                    We recommend evaluating <strong>Tirzepatide</strong> (dual GLP-1/GIP receptor agonist) or <strong>Retatrutide</strong> (triple GLP-1/GIP/GCGR agonist). These represent the current state-of-the-art in incretin hormone receptor agonist research with the highest clinical weight management efficacy profiles.
                  </div>
                )}
              </div>
            )}
            {wizardChoices.area === 'healing' && (
              <div>
                {wizardChoices.form === 'oral' ? (
                  <div>
                    We recommend evaluating <strong>BPC-157 Gastric-Stable Oral</strong> form. It maintains structural stability under gastric juices and local tissue repair pathways.
                  </div>
                ) : (
                  <div>
                    We recommend evaluating the dual-mechanism stacking protocol of <strong>BPC-157</strong> and <strong>TB-500</strong>. BPC-157 accelerates tissue granulation and tendon-to-bone healing, while TB-500 promotes cell migration and actin polymerization to accelerate recovery.
                  </div>
                )}
              </div>
            )}
            {wizardChoices.area === 'longevity' && (
              <div>
                We recommend evaluating <strong>Epithalon</strong> (telomerase activator and pineal gland regulator) or the mitochondrial stacking combination of <strong>MOTS-c</strong> and <strong>SS-31</strong> to target inner cardiolipin membrane stabilization.
              </div>
            )}
            {wizardChoices.area === 'sleep' && (
              <div>
                We recommend evaluating <strong>DSIP</strong> (Delta Sleep-Inducing Peptide) for targeting deep-wave EEG sleep states or <strong>Epithalon</strong> for its circadian rhythm melatonin restoration properties.
              </div>
            )}
            {wizardChoices.area === 'all' && (
              <div>
                Evaluate the filtered list of compounds below matching your chosen route and budget parameters. Use the Pin to Compare action to compare up to 4 compounds side-by-side.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. First-Time Researcher Quick Start Guide Card */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '20px 24px',
          borderRadius: 'var(--radius-lg, 12px)',
          marginBottom: '28px',
          background: 'linear-gradient(90deg, rgba(0, 196, 188, 0.06), rgba(22, 34, 48, 0.95))',
          borderLeft: '4px solid var(--teal, #00C4BC)',
        }}
      >
        <div
          style={{
            background: 'rgba(0, 196, 188, 0.1)',
            padding: '12px',
            borderRadius: '50%',
            color: 'var(--teal, #00C4BC)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <GraduationCap size={24} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--white, #FFFFFF)' }}>
            New To Peptide Research?
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)', margin: '4px 0 0 0' }}>
            Check Out Our 60-Second Reconstitution Guide & Dose Calculator Before Selecting Your Compounds.
          </p>
        </div>
        <Link
          href="/research/calculators"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            textDecoration: 'none',
            fontSize: '0.85rem',
            fontWeight: 700,
            color: 'var(--teal, #00C4BC)',
            padding: '8px 16px',
            background: 'rgba(0,196,188,0.08)',
            borderRadius: '6px',
            transition: 'all 0.2s ease',
          }}
        >
          Open Calculator Suite
          <ArrowRight size={14} />
        </Link>
      </div>

      <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start', flexDirection: 'row' }}>
        {/* Left Sidebar Filters */}
        <aside style={{ flex: '0 0 260px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--silver, #A8B4C0)', pointerEvents: 'none' }} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Compounds"
              style={{ ...selectStyle, width: '100%', paddingLeft: '36px' }}
            />
          </div>

          <button onClick={() => setIsWizardOpen(true)} style={{ ...selectStyle, display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, rgba(0, 196, 188, 0.2), rgba(22, 34, 48, 0.8))', borderColor: 'var(--teal, #00C4BC)', fontWeight: 700, cursor: 'pointer' }}>
            <Sparkles size={16} color="var(--teal, #00C4BC)" /> Help Me Choose
          </button>

          <div>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--white, #FFFFFF)', marginBottom: '12px', fontWeight: 700, margin: '0 0 12px 0' }}>Description Complexity</h4>
            <div style={{ display: 'flex', border: '1px solid rgba(168, 180, 192, 0.25)', borderRadius: '8px', padding: '2px', background: 'var(--grey-400, #162230)' }}>
              <button onClick={() => setIsEli5(true)} style={{ flex: 1, padding: '6px 0', borderRadius: '6px', border: 'none', background: isEli5 ? 'var(--teal, #00C4BC)' : 'transparent', color: isEli5 ? 'var(--black, #0C151D)' : 'var(--silver, #A8B4C0)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>Plain English</button>
              <button onClick={() => setIsEli5(false)} style={{ flex: 1, padding: '6px 0', borderRadius: '6px', border: 'none', background: !isEli5 ? 'var(--teal, #00C4BC)' : 'transparent', color: !isEli5 ? 'var(--black, #0C151D)' : 'var(--silver, #A8B4C0)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>Technical</button>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--white, #FFFFFF)', marginBottom: '12px', fontWeight: 700, margin: '0 0 12px 0' }}>Research Area</h4>
            <select value={area} onChange={(e) => setArea(e.target.value)} style={{ ...selectStyle, width: '100%' }}>
              <option value={ALL}>All Research Areas</option>
              {Object.keys(RESEARCH_AREAS).map((key) => <option key={key} value={key}>{RESEARCH_AREAS[key].label}</option>)}
            </select>
          </div>

          <div>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--white, #FFFFFF)', marginBottom: '12px', fontWeight: 700, margin: '0 0 12px 0' }}>Category</h4>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...selectStyle, width: '100%' }}>
              <option value={ALL}>All Categories</option>
              {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          <div>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--white, #FFFFFF)', marginBottom: '12px', fontWeight: 700, margin: '0 0 12px 0' }}>Administration Form</h4>
            <select value={formFilter} onChange={(e) => setFormFilter(e.target.value)} style={{ ...selectStyle, width: '100%' }}>
              <option value={ALL}>All Forms</option>
              <option value="injection">Injection (Vial)</option>
              <option value="oral">Oral (Capsule)</option>
              <option value="topical">Topical</option>
            </select>
          </div>

          <div>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--white, #FFFFFF)', marginBottom: '12px', fontWeight: 700, margin: '0 0 12px 0' }}>Evidence Tier</h4>
            <select value={tier} onChange={(e) => setTier(e.target.value)} style={{ ...selectStyle, width: '100%' }}>
              <option value={ALL}>All Evidence Tiers</option>
              {Object.keys(EVIDENCE_TIER).map((key) => <option key={key} value={key}>{EVIDENCE_TIER[key].label}</option>)}
            </select>
          </div>

          <div>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--white, #FFFFFF)', marginBottom: '12px', fontWeight: 700, margin: '0 0 12px 0' }}>Budget</h4>
            <select value={budgetFilter} onChange={(e) => setBudgetFilter(e.target.value)} style={{ ...selectStyle, width: '100%' }}>
              <option value={ALL}>All Budgets</option>
              <option value="conservative">Conservative Budget</option>
              <option value="standard">Standard Budget</option>
            </select>
          </div>

          <div>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--white, #FFFFFF)', marginBottom: '12px', fontWeight: 700, margin: '0 0 12px 0' }}>Reconstitution Prep</h4>
            <select value={prepFilter} onChange={(e) => setPrepFilter(e.target.value)} style={{ ...selectStyle, width: '100%' }}>
              <option value={ALL}>All Reconstitution Preps</option>
              <option value="reconstitution">Lyophilized Vials Only</option>
              <option value="no_reconstitution">Ready-To-Use Formats Only</option>
            </select>
          </div>

          <div>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--white, #FFFFFF)', marginBottom: '12px', fontWeight: 700, margin: '0 0 12px 0' }}>WADA Status</h4>
            <select value={wada} onChange={(e) => setWada(e.target.value)} style={{ ...selectStyle, width: '100%' }}>
              <option value={ALL}>All WADA Statuses</option>
              {Object.keys(WADA_LABEL).map((key) => <option key={key} value={key}>{WADA_LABEL[key]}</option>)}
            </select>
          </div>
        </aside>

        {/* Main Content Area */}
        <main style={{ flex: 1 }}>
          <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.9rem', marginBottom: '16px', marginTop: 0 }}>
            Showing {filtered.length} {filtered.length === 1 ? 'Compound' : 'Compounds'}
          </p>

      {/* 4. "No Results" Smart Recommendation Cards */}
      {filtered.length === 0 ? (
        <div
          className="glass-panel"
          style={{
            padding: 'var(--space-6, 40px) var(--space-4, 24px)',
            textAlign: 'center',
            color: 'var(--silver, #A8B4C0)',
            borderRadius: 'var(--radius-lg, 12px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div>{"We Couldn't Find A Direct Match. Try Searching For One Of Our Popular Research Goals:"}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={() => {
                setArea('weight_management');
                setQuery('');
                setCategory(ALL);
                setTier(ALL);
                setWada(ALL);
                setFormFilter(ALL);
              }}
              style={{
                background: 'rgba(0,196,188,0.1)',
                border: '1px solid var(--teal, #00C4BC)',
                color: 'var(--white, #FFFFFF)',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              Search: Fat Loss
            </button>
            <button
              onClick={() => {
                setArea('healing');
                setQuery('');
                setCategory(ALL);
                setTier(ALL);
                setWada(ALL);
                setFormFilter(ALL);
              }}
              style={{
                background: 'rgba(0,196,188,0.1)',
                border: '1px solid var(--teal, #00C4BC)',
                color: 'var(--white, #FFFFFF)',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              Search: Joint Repair
            </button>
            <button
              onClick={() => {
                setArea('sleep');
                setQuery('');
                setCategory(ALL);
                setTier(ALL);
                setWada(ALL);
                setFormFilter(ALL);
              }}
              style={{
                background: 'rgba(0,196,188,0.1)',
                border: '1px solid var(--teal, #00C4BC)',
                color: 'var(--white, #FFFFFF)',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              Search: Deep Sleep
            </button>
            <button
              onClick={() => {
                setArea('cosmetic');
                setQuery('');
                setCategory(ALL);
                setTier(ALL);
                setWada(ALL);
                setFormFilter(ALL);
              }}
              style={{
                background: 'rgba(0,196,188,0.1)',
                border: '1px solid var(--teal, #00C4BC)',
                color: 'var(--white, #FFFFFF)',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              Search: Skin Health
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 'var(--space-4, 16px)',
          }}
        >
          {filtered.map((c) => {
            const t = evidenceTier(c.evidence_tier);
            const aliasLine = (c.aliases ?? []).slice(0, 3).join(', ');
            const cForm = getCompoundForm(c);

            return (
              <div
                key={c.slug}
                className="glass-panel"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-2, 8px)',
                  padding: 'var(--space-4, 16px)',
                  borderRadius: 'var(--radius-lg, 12px)',
                  color: 'var(--white, #FFFFFF)',
                  height: '100%',
                  /* 2. Dynamic WADA border compliance indicators */
                  border: getCardBorder(c.wada_status),
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                }}
              >
                <Link
                  href={`/research/${c.slug}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-2, 8px)',
                    textDecoration: 'none',
                    color: 'var(--white, #FFFFFF)',
                    flexGrow: 1,
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: t.color,
                        border: `1px solid ${t.color}`,
                        borderRadius: '999px',
                        padding: '2px 10px',
                      }}
                    >
                      {t.label}
                    </span>

                    {/* 1. Form badge */}
                    {c.handling?.form && (
                      <span style={getFormBadgeStyle(cForm)}>
                        {cForm === 'injection'
                          ? 'Injection (Vial)'
                          : cForm === 'oral'
                          ? 'Oral (Capsule)'
                          : cForm === 'topical'
                          ? 'Topical'
                          : c.handling.form}
                      </span>
                    )}

                    {/* 1. Dosing Complexity badge */}
                    {c.typical_frequency && (
                      <span style={getDosingBadgeStyle(c.typical_frequency)}>
                        {getDosingLabel(c.typical_frequency)}
                      </span>
                    )}
                  </div>

                  <span style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '4px' }}>
                    {c.display_name}
                  </span>

                  {aliasLine && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--silver, #A8B4C0)' }}>
                      {aliasLine}
                    </span>
                  )}

                  {/* Description area based on isEli5 toggle */}
                  <div style={{ fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)', margin: '8px 0', lineHeight: '1.4' }}>
                    {isEli5 ? (
                      /* Plain English view */
                      <InteractiveGlossaryText text={c.eli5_summary || c.plain_summary || c.mechanism || ''} />
                    ) : (
                      /* Technical view */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {c.mechanism && (
                          <div>
                            <strong style={{ color: 'var(--white, #FFFFFF)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>
                              Mechanism
                            </strong>
                            <InteractiveGlossaryText text={c.mechanism} />
                          </div>
                        )}
                        {c.pk_summary && (
                          <div>
                            <strong style={{ color: 'var(--white, #FFFFFF)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>
                              Pharmacokinetics
                            </strong>
                            <InteractiveGlossaryText text={c.pk_summary} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {c.category && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--teal, #00C4BC)',
                        marginTop: 'auto',
                      }}
                    >
                      {c.category}
                    </span>
                  )}

                  {/* 2. Dynamic WADA badge */}
                  {c.wada_status && c.wada_status !== 'not_listed' && (
                    <span
                      style={{
                        alignSelf: 'flex-start',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        marginTop: '4px',
                        ...wadaBadgeStyle(c.wada_status),
                      }}
                    >
                      {wadaLabel(c.wada_status)}
                    </span>
                  )}
                </Link>

                {/* 4. Popular Pairing click shortcuts */}
                {c.best_stacked_with && c.best_stacked_with.length > 0 && (
                  (() => {
                    const partnerSlug = c.best_stacked_with[0];
                    const partner = compounds.find((x) => x.slug === partnerSlug);
                    if (partner) {
                      return (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setQuery(partner.display_name);
                            setCategory(ALL);
                            setTier(ALL);
                            setArea(ALL);
                            setWada(ALL);
                            setFormFilter(ALL);
                          }}
                          style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px dashed rgba(255,255,255,0.1)',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '0.72rem',
                            color: 'var(--teal, #00C4BC)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            marginTop: '6px',
                            alignSelf: 'flex-start',
                            fontWeight: 600,
                            transition: 'all 0.2s ease',
                          }}
                        >
                          Often Paired With {partner.display_name}
                        </button>
                      );
                    }
                    return null;
                  })()
                )}

                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    marginTop: '12px',
                    paddingTop: '12px',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <PinToCompareButton
                      compoundSlug={c.slug}
                      compoundName={c.display_name}
                      evidenceTierKey={c.evidence_tier}
                      size="sm"
                    />
                  </div>
                  <ResearchCartButton
                    productName={c.display_name}
                    size="sm"
                  />
                </div>
              </div>
            );
          })}
      )}
        </main>
      </div>

      {/* guided wizard dialog */}
      <HelpMeChooseWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onComplete={handleWizardComplete}
      />
    </div>
  );
}
