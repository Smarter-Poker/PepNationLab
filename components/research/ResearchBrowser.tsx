'use client';

/**
 * Research Browser - client-side faceted search over the compound catalog.
 * Upgraded with URL syncing, multi-select checkboxes, responsive sidebar,
 * Quick View modals, and layout toggles.
 */

import { useMemo, useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { 
  Search, Sparkles, GraduationCap, ArrowRight, X, LayoutGrid, List, Filter, Flame, Eye, ChevronDown
} from 'lucide-react';
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
import QuickViewModal from './QuickViewModal';

const ITEMS_PER_PAGE = 24;

// Autocorrect / shorthand mapping helper
function autocorrectSearch(input: string): string {
  const words = input.trim().toLowerCase().split(/\s+/);
  const map: Record<string, string> = {
    sema: 'semaglutide', tirz: 'tirzepatide', reta: 'retatrutide',
    bpc157: 'bpc-157', bpc: 'bpc-157', tb500: 'tb-500', tb: 'tb-500',
  };
  return words.map((w) => map[w] || w).join(' ');
}

function getCompoundForm(c: Compound): 'injection' | 'oral' | 'topical' | 'other' {
  const form = (c.handling?.form || '').toLowerCase();
  if (form.includes('capsule') || form.includes('oral') || form.includes('tablet')) return 'oral';
  if (form.includes('cream') || form.includes('topical') || form.includes('nasal') || form.includes('spray') || form.includes('gel')) return 'topical';
  if (form.includes('vial') || form.includes('powder') || form.includes('lyophilized') || form.includes('injection')) return 'injection';
  return 'other';
}

// Generate dynamic badges mock
function getDynamicBadge(slug: string): { label: string, color: string } | null {
  const trending = ['bpc-157', 'tirzepatide', 'retatrutide', 'ss-31'];
  const isNew = ['carglumic-acid', '5-amino-1mq'];
  const lowStock = ['dsip', 'epithalon'];

  if (trending.includes(slug)) return { label: 'Trending', color: '#F6AD55' };
  if (isNew.includes(slug)) return { label: 'New', color: '#68D391' };
  if (lowStock.includes(slug)) return { label: 'Low Stock', color: '#FC8181' };
  return null;
}

export default function ResearchBrowser({ compounds }: { compounds: Compound[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Local UI State
  const [isEli5, setIsEli5] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardChoices, setWizardChoices] = useState<any>(null);
  const [quickViewCompound, setQuickViewCompound] = useState<Compound | null>(null);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);

  // URL Params State
  const parseArrayParam = (key: string) => {
    const val = searchParams.get(key);
    return val ? val.split(',').filter(Boolean) : [];
  };

  const query = searchParams.get('q') || '';
  const categories = parseArrayParam('category');
  const tiers = parseArrayParam('tier');
  const areas = parseArrayParam('area');
  const wadas = parseArrayParam('wada');
  const forms = parseArrayParam('form');
  const budgets = parseArrayParam('budget');
  const preps = parseArrayParam('prep');
  
  const sortParam = searchParams.get('sort') || 'default';
  const viewParam = searchParams.get('view') || 'grid';

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const c of compounds) if (c.category) set.add(c.category);
    return Array.from(set).sort();
  }, [compounds]);

  const toggleParam = (key: string, value: string) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    const existing = current.get(key);
    
    if (existing) {
      const arr = existing.split(',');
      if (arr.includes(value)) {
        const filtered = arr.filter(v => v !== value);
        if (filtered.length > 0) current.set(key, filtered.join(','));
        else current.delete(key);
      } else {
        current.set(key, [...arr, value].join(','));
      }
    } else {
      current.set(key, value);
    }
    
    // Reset pagination on filter change
    setPage(1);
    router.push(`${pathname}?${current.toString()}`, { scroll: false });
  };

  const setSingleParam = (key: string, value: string) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    if (value) current.set(key, value);
    else current.delete(key);
    setPage(1);
    router.push(`${pathname}?${current.toString()}`, { scroll: false });
  };

  const clearAllFilters = () => {
    router.push(pathname, { scroll: false });
    setWizardChoices(null);
    setPage(1);
  };

  // Derived filtered & sorted compounds
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const tokens = q ? autocorrectSearch(q).split(/\s+/).filter(Boolean) : [];

    let results = compounds.filter((c) => {
      if (tokens.length > 0) {
        const haystack = [
          c.display_name, ...(c.aliases ?? []), c.category ?? '', ...(c.research_areas ?? []),
          c.plain_summary ?? '', c.eli5_summary ?? '', c.compound_class ?? '', c.molecular_target ?? '',
        ].join(' ').toLowerCase();
        if (!tokens.every(tok => haystack.includes(tok))) return false;
      }
      
      if (categories.length > 0 && !categories.includes(c.category || '')) return false;
      if (tiers.length > 0 && !tiers.includes(c.evidence_tier)) return false;
      if (areas.length > 0 && !(c.research_areas ?? []).some(a => areas.includes(a))) return false;
      if (wadas.length > 0 && !wadas.includes(c.wada_status)) return false;

      if (forms.length > 0) {
        const cForm = getCompoundForm(c);
        if (!forms.includes(cForm)) return false;
      }

      if (preps.length > 0) {
        const isRecon = (c.handling?.form || '').toLowerCase().includes('vial') || (c.handling?.form || '').toLowerCase().includes('lyophilized');
        if (preps.includes('reconstitution') && !isRecon) return false;
        if (preps.includes('no_reconstitution') && isRecon) return false;
      }

      if (budgets.includes('conservative')) {
        if (c.is_stack) return false;
        const premiumSlugs = ['semaglutide', 'tirzepatide', 'retatrutide', 'igf-1-lr3', 'dihexa'];
        if (premiumSlugs.includes(c.slug)) return false;
      }

      return true;
    });

    if (sortParam === 'az') results.sort((a, b) => a.display_name.localeCompare(b.display_name));
    if (sortParam === 'za') results.sort((a, b) => b.display_name.localeCompare(a.display_name));
    if (sortParam === 'tier') {
      const tierOrder: Record<string, number> = { tier1: 1, tier2: 2, tier3: 3, tier4: 4, experimental: 5 };
      results.sort((a, b) => (tierOrder[a.evidence_tier] || 99) - (tierOrder[b.evidence_tier] || 99));
    }

    return results;
  }, [compounds, query, categories, tiers, areas, wadas, forms, budgets, preps, sortParam]);

  const paginatedResults = filtered.slice(0, page * ITEMS_PER_PAGE);
  const hasMore = paginatedResults.length < filtered.length;

  const handleWizardComplete = (wizardFilters: any) => {
    const params = new URLSearchParams();
    if (wizardFilters.area === 'healing') params.set('area', 'healing');
    else if (wizardFilters.area !== 'all') params.set('area', wizardFilters.area);
    
    if (wizardFilters.form !== 'all') params.set('form', wizardFilters.form);
    if (wizardFilters.wada !== 'all') params.set('wada', wizardFilters.wada);
    if (wizardFilters.budget !== 'all') params.set('budget', wizardFilters.budget);
    if (wizardFilters.prep !== 'all') params.set('prep', wizardFilters.prep);

    setWizardChoices(wizardFilters);
    setPage(1);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Reusable Filter Group
  const FilterGroup = ({ title, paramKey, options }: { title: string, paramKey: string, options: {label: string, value: string}[] }) => {
    const selected = parseArrayParam(paramKey);
    return (
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ fontSize: '0.9rem', color: 'var(--white, #FFFFFF)', marginBottom: '12px', fontWeight: 700 }}>{title}</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
          {options.map(opt => (
            <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--silver, #A8B4C0)', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={selected.includes(opt.value)}
                onChange={() => toggleParam(paramKey, opt.value)}
                style={{ accentColor: 'var(--teal, #00C4BC)', width: '16px', height: '16px', cursor: 'pointer' }}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>
    );
  };

  // Collect Active Pills
  const activePills: { key: string, val: string, label: string }[] = [];
  categories.forEach(v => activePills.push({ key: 'category', val: v, label: v }));
  tiers.forEach(v => activePills.push({ key: 'tier', val: v, label: EVIDENCE_TIER[v]?.label || v }));
  areas.forEach(v => activePills.push({ key: 'area', val: v, label: RESEARCH_AREAS[v]?.label || v }));
  forms.forEach(v => activePills.push({ key: 'form', val: v, label: v === 'injection' ? 'Injection (Vial)' : v === 'oral' ? 'Oral' : 'Topical' }));
  wadas.forEach(v => activePills.push({ key: 'wada', val: v, label: WADA_LABEL[v] || v }));
  budgets.forEach(v => activePills.push({ key: 'budget', val: v, label: v === 'conservative' ? 'Conservative' : 'Standard' }));
  preps.forEach(v => activePills.push({ key: 'prep', val: v, label: v === 'reconstitution' ? 'Lyophilized Only' : 'Ready-To-Use' }));

  return (
    <div>
      <style>{`
        .catalog-layout {
          display: flex;
          gap: 32px;
          align-items: flex-start;
        }
        .catalog-sidebar {
          flex: 0 0 260px;
          position: sticky;
          top: 24px;
          height: max-content;
          display: flex;
          flex-direction: column;
        }
        .catalog-main {
          flex: 1;
          min-width: 0;
        }
        .mobile-filter-toggle {
          display: none;
        }
        .compound-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }
        @media (max-width: 900px) {
          .catalog-layout {
            flex-direction: column;
          }
          .catalog-sidebar {
            display: none; /* hidden by default on mobile */
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: var(--black, #0C151D);
            z-index: 100;
            padding: 24px;
            overflow-y: auto;
          }
          .catalog-sidebar.open {
            display: flex;
          }
          .mobile-filter-toggle {
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(0, 196, 188, 0.1);
            border: 1px solid var(--teal, #00C4BC);
            color: var(--teal, #00C4BC);
            padding: 8px 16px;
            border-radius: 8px;
            font-weight: 700;
            margin-bottom: 16px;
            cursor: pointer;
          }
        }
      `}</style>

      {/* First-Time Researcher Guide */}
      <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 24px', borderRadius: '12px', marginBottom: '28px', background: 'linear-gradient(90deg, rgba(0, 196, 188, 0.06), rgba(22, 34, 48, 0.95))', borderLeft: '4px solid var(--teal, #00C4BC)' }}>
        <div style={{ background: 'rgba(0, 196, 188, 0.1)', padding: '12px', borderRadius: '50%', color: 'var(--teal, #00C4BC)' }}><GraduationCap size={24} /></div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--white, #FFFFFF)' }}>New To Peptide Research?</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)', margin: '4px 0 0 0' }}>Check Out Our 60-Second Reconstitution Guide & Dose Calculator.</p>
        </div>
        <Link href="/research/calculators" className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '6px', textDecoration: 'none' }}>
          Open Calculators <ArrowRight size={14} />
        </Link>
      </div>

      <button className="mobile-filter-toggle" onClick={() => setIsMobileFiltersOpen(true)}>
        <Filter size={18} /> Show Filters & Sort
      </button>

      <div className="catalog-layout">
        {/* Left Sidebar Filters */}
        <aside className={`catalog-sidebar ${isMobileFiltersOpen ? 'open' : ''}`}>
          {isMobileFiltersOpen && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.25rem', color: '#FFF', margin: 0 }}>Filters</h2>
              <button onClick={() => setIsMobileFiltersOpen(false)} style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer' }}><X size={24} /></button>
            </div>
          )}

          <button onClick={() => { setIsWizardOpen(true); setIsMobileFiltersOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, rgba(0, 196, 188, 0.2), rgba(22, 34, 48, 0.8))', border: '1px solid var(--teal, #00C4BC)', color: '#FFF', fontWeight: 700, padding: '12px', borderRadius: '8px', cursor: 'pointer', marginBottom: '24px' }}>
            <Sparkles size={16} color="var(--teal, #00C4BC)" /> Help Me Choose Wizard
          </button>

          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--white, #FFFFFF)', marginBottom: '12px', fontWeight: 700 }}>Description Detail</h4>
            <div style={{ display: 'flex', border: '1px solid rgba(168, 180, 192, 0.25)', borderRadius: '8px', padding: '2px', background: 'var(--grey-400, #162230)' }}>
              <button onClick={() => setIsEli5(true)} style={{ flex: 1, padding: '6px 0', borderRadius: '6px', border: 'none', background: isEli5 ? 'var(--teal, #00C4BC)' : 'transparent', color: isEli5 ? 'var(--black, #0C151D)' : 'var(--silver, #A8B4C0)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>Plain English</button>
              <button onClick={() => setIsEli5(false)} style={{ flex: 1, padding: '6px 0', borderRadius: '6px', border: 'none', background: !isEli5 ? 'var(--teal, #00C4BC)' : 'transparent', color: !isEli5 ? 'var(--black, #0C151D)' : 'var(--silver, #A8B4C0)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>Technical</button>
            </div>
          </div>

          <FilterGroup title="Category" paramKey="category" options={allCategories.map(c => ({ label: c, value: c }))} />
          <FilterGroup title="Research Area" paramKey="area" options={Object.keys(RESEARCH_AREAS).map(k => ({ label: RESEARCH_AREAS[k].label, value: k }))} />
          <FilterGroup title="Form" paramKey="form" options={[{ label: 'Injection (Vial)', value: 'injection' }, { label: 'Oral (Capsule)', value: 'oral' }, { label: 'Topical', value: 'topical' }]} />
          <FilterGroup title="Evidence Tier" paramKey="tier" options={Object.keys(EVIDENCE_TIER).map(k => ({ label: EVIDENCE_TIER[k].label, value: k }))} />
          <FilterGroup title="Budget" paramKey="budget" options={[{ label: 'Conservative Budget', value: 'conservative' }, { label: 'Standard Budget', value: 'standard' }]} />
          <FilterGroup title="Preparation" paramKey="prep" options={[{ label: 'Lyophilized Vials Only', value: 'reconstitution' }, { label: 'Ready-To-Use Formats Only', value: 'no_reconstitution' }]} />
          <FilterGroup title="WADA Status" paramKey="wada" options={Object.keys(WADA_LABEL).map(k => ({ label: WADA_LABEL[k], value: k }))} />
        </aside>

        {/* Main Content Area */}
        <main className="catalog-main">
          {/* Active Filters Bar */}
          {activePills.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)', fontWeight: 600 }}>Active Filters:</span>
              {activePills.map(pill => (
                <button key={`${pill.key}-${pill.val}`} onClick={() => toggleParam(pill.key, pill.val)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,196,188,0.1)', border: '1px solid rgba(0,196,188,0.3)', color: 'var(--teal, #00C4BC)', padding: '4px 10px', borderRadius: '16px', fontSize: '0.8rem', cursor: 'pointer' }}>
                  {pill.label} <X size={12} />
                </button>
              ))}
              <button onClick={clearAllFilters} style={{ background: 'none', border: 'none', color: '#FC8181', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>Clear All</button>
            </div>
          )}

          {/* Top Controls Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
            <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.9rem', margin: 0 }}>
              Showing {filtered.length} {filtered.length === 1 ? 'Compound' : 'Compounds'}
            </p>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {/* Sort Dropdown */}
              <select value={sortParam} onChange={(e) => setSingleParam('sort', e.target.value)} style={{ background: 'var(--grey-400, #162230)', color: '#FFF', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem' }}>
                <option value="default">Default Sorting</option>
                <option value="az">Alphabetical (A-Z)</option>
                <option value="za">Alphabetical (Z-A)</option>
                <option value="tier">Highest Evidence Tier</option>
              </select>
              
              {/* Grid / List Toggle */}
              <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden' }}>
                <button onClick={() => setSingleParam('view', 'grid')} style={{ padding: '6px 10px', background: viewParam === 'grid' ? 'rgba(0,196,188,0.2)' : 'var(--grey-400, #162230)', border: 'none', color: viewParam === 'grid' ? 'var(--teal, #00C4BC)' : '#A8B4C0', cursor: 'pointer' }}><LayoutGrid size={16} /></button>
                <button onClick={() => setSingleParam('view', 'list')} style={{ padding: '6px 10px', background: viewParam === 'list' ? 'rgba(0,196,188,0.2)' : 'var(--grey-400, #162230)', border: 'none', color: viewParam === 'list' ? 'var(--teal, #00C4BC)' : '#A8B4C0', cursor: 'pointer' }}><List size={16} /></button>
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--silver, #A8B4C0)', borderRadius: '12px' }}>
              <div style={{ marginBottom: '16px' }}>We couldn't find any compounds matching all selected filters.</div>
              <button onClick={clearAllFilters} style={{ background: 'var(--teal, #00C4BC)', color: '#0C151D', border: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: 800, fontSize: '1rem', cursor: 'pointer' }}>
                Clear All Filters
              </button>
            </div>
          ) : viewParam === 'grid' ? (
            <div className="compound-grid">
              {paginatedResults.map((c) => {
                const badge = getDynamicBadge(c.slug);
                return (
                  <div key={c.slug} className="glass-panel" style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {badge && (
                      <div style={{ position: 'absolute', top: '-10px', right: '-10px', background: badge.color, color: '#000', fontSize: '0.7rem', fontWeight: 800, padding: '4px 12px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)', zIndex: 10 }}>
                        {badge.label}
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Link href={`/research/${c.slug}`} style={{ textDecoration: 'none', color: '#FFF' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{c.display_name}</span>
                        {(c.aliases || []).length > 0 && <div style={{ fontSize: '0.8rem', color: 'var(--silver, #A8B4C0)' }}>{(c.aliases || []).slice(0, 2).join(', ')}</div>}
                      </Link>
                      <button onClick={() => setQuickViewCompound(c)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', padding: '6px', color: '#FFF', cursor: 'pointer' }} title="Quick View"><Eye size={16} /></button>
                    </div>
                    
                    <div style={{ fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)', margin: '8px 0', lineHeight: 1.4, flexGrow: 1 }}>
                      {isEli5 ? <InteractiveGlossaryText text={c.eli5_summary || c.plain_summary || ''} /> : <InteractiveGlossaryText text={c.mechanism || c.plain_summary || ''} />}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                      <div style={{ flex: 1 }}><PinToCompareButton compoundSlug={c.slug} compoundName={c.display_name} category={c.category} size="sm" /></div>
                      <ResearchCartButton productName={c.display_name} size="sm" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {paginatedResults.map((c) => (
                <div key={c.slug} className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ flex: '0 0 200px' }}>
                    <Link href={`/research/${c.slug}`} style={{ textDecoration: 'none', color: '#FFF', fontWeight: 800, fontSize: '1.05rem' }}>{c.display_name}</Link>
                    <div style={{ fontSize: '0.75rem', color: 'var(--teal, #00C4BC)' }}>{c.category}</div>
                  </div>
                  <div style={{ flex: 1, fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)' }}>
                     {c.plain_summary ? c.plain_summary.substring(0, 100) + '...' : ''}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setQuickViewCompound(c)} className="btn-secondary" style={{ padding: '6px', borderRadius: '6px' }}><Eye size={16} /></button>
                    <PinToCompareButton compoundSlug={c.slug} compoundName={c.display_name} category={c.category} size="sm" style={{ width: 'auto', minWidth: '40px' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: '32px' }}>
              <button onClick={() => setPage(p => p + 1)} style={{ background: 'rgba(0,196,188,0.1)', border: '1px solid var(--teal, #00C4BC)', color: 'var(--teal, #00C4BC)', padding: '10px 32px', borderRadius: '8px', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer' }}>
                Load More Compounds
              </button>
            </div>
          )}
        </main>
      </div>

      <HelpMeChooseWizard isOpen={isWizardOpen} onClose={() => setIsWizardOpen(false)} onComplete={handleWizardComplete} />
      {quickViewCompound && <QuickViewModal compound={quickViewCompound} isOpen={true} onClose={() => setQuickViewCompound(null)} />}
    </div>
  );
}
