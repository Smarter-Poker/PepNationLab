'use client';

/**
 * Research Browser - client-side faceted search over the compound catalog.
 * Redesigned for the Research Intelligence Center.
 */

import { useMemo, useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Image from 'next/image';
import {
  type Compound,
  EVIDENCE_TIER,
  RESEARCH_AREAS,
} from '@/lib/compounds';
import HelpMeChooseWizard from './HelpMeChooseWizard';
import QuickViewModal from './QuickViewModal';
import PremiumCompoundCard from './PremiumCompoundCard'; // The newly created premium card

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

function getDynamicBadge(slug: string): { label: string, color: string } | undefined {
  const trending = ['bpc-157', 'tirzepatide', 'retatrutide', 'ss-31'];
  const isNew = ['carglumic-acid', '5-amino-1mq'];
  const lowStock = ['dsip', 'epithalon'];

  if (trending.includes(slug)) return { label: 'Trending', color: '#F6AD55' };
  if (isNew.includes(slug)) return { label: 'New', color: '#68D391' };
  if (lowStock.includes(slug)) return { label: 'Low Stock', color: '#FC8181' };
  return undefined;
}

// Reusable Filter Group styled for intelligence center
const FilterGroup = ({ title, options, selected, onToggle }: { title: string, options: {label: string, value: string}[], selected: string[], onToggle: (value: string) => void }) => {
  return (
    <div style={{ marginBottom: '24px' }}>
      <h4 style={{ fontSize: '0.85rem', color: '#00E5FF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', fontWeight: 800 }}>{title}</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '8px' }}>
        {options.map(opt => (
          <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: selected.includes(opt.value) ? '#FFF' : '#A8B4C0', fontSize: '0.9rem', cursor: 'pointer', transition: 'color 0.2s' }}>
            <div style={{
              width: '18px', height: '18px', borderRadius: '4px', border: selected.includes(opt.value) ? 'none' : '1px solid rgba(255,255,255,0.2)',
              background: selected.includes(opt.value) ? '#00E5FF' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
            }}>
              {selected.includes(opt.value) && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
            </div>
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
};

export default function ResearchBrowser({ compounds }: { compounds: Compound[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [isEli5, setIsEli5] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardChoices, setWizardChoices] = useState<any>(null);
  const [quickViewCompound, setQuickViewCompound] = useState<Compound | null>(null);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [productsMap, setProductsMap] = useState<Record<string, any>>({});

  useEffect(() => {
    // Fetch products and pricing for all compounds to inject into cards
    async function fetchProducts() {
      try {
        const slugs = compounds.map(c => c.slug).join(',');
        const res = await fetch(`/api/research/products?slugs=${slugs}`);
        if (res.ok) {
          const data = await res.json();
          const map: Record<string, any> = {};
          if (data.products) {
            data.products.forEach((p: any) => {
              map[p.compoundSlug] = p;
            });
          }
          setProductsMap(map);
        }
      } catch (err) {
        console.error('Failed to fetch pricing', err);
      }
    }
    fetchProducts();
  }, [compounds]);

  const parseArrayParam = (key: string) => {
    const val = searchParams.get(key);
    return val ? val.split(',').filter(Boolean) : [];
  };

  const query = searchParams.get('q') || '';
  const categories = parseArrayParam('category');
  const tiers = parseArrayParam('tier');
  const areas = parseArrayParam('area');
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
      const tierOrder: Record<string, number> = { approved_drug: 1, investigational: 2, preclinical: 3, research_chemical: 4, cosmetic: 5, supply: 6 };
      results.sort((a, b) => (tierOrder[a.evidence_tier] || 99) - (tierOrder[b.evidence_tier] || 99));
    }

    return results;
  }, [compounds, query, categories, tiers, areas, forms, budgets, preps, sortParam]);

  const paginatedResults = filtered.slice(0, page * ITEMS_PER_PAGE);
  const hasMore = paginatedResults.length < filtered.length;

  const handleWizardComplete = (wizardFilters: any) => {
    const params = new URLSearchParams();
    if (wizardFilters.area === 'healing') params.set('area', 'healing');
    else if (wizardFilters.area !== 'all') params.set('area', wizardFilters.area);
    
    if (wizardFilters.form !== 'all') params.set('form', wizardFilters.form);
    if (wizardFilters.budget !== 'all') params.set('budget', wizardFilters.budget);
    if (wizardFilters.prep !== 'all') params.set('prep', wizardFilters.prep);

    setWizardChoices(wizardFilters);
    setPage(1);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const activePills: { key: string, val: string, label: string }[] = [];
  categories.forEach(v => activePills.push({ key: 'category', val: v, label: v }));
  tiers.forEach(v => activePills.push({ key: 'tier', val: v, label: EVIDENCE_TIER[v]?.label || v }));
  areas.forEach(v => activePills.push({ key: 'area', val: v, label: RESEARCH_AREAS[v]?.label || v }));
  forms.forEach(v => activePills.push({ key: 'form', val: v, label: v === 'injection' ? 'Injection' : v === 'oral' ? 'Oral' : 'Topical' }));
  budgets.forEach(v => activePills.push({ key: 'budget', val: v, label: v === 'conservative' ? 'Conservative' : 'Standard' }));
  preps.forEach(v => activePills.push({ key: 'prep', val: v, label: v === 'reconstitution' ? 'Lyophilized' : 'Ready-To-Use' }));

  return (
    <div id="intelligence-database" style={{ scrollMarginTop: '90px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
        <div style={{ position: 'relative', width: '24px', height: '24px', filter: 'drop-shadow(0 0 8px rgba(0,229,255,0.6))' }}>
          <Image src="/images/redesign/molecule_default.png" alt="Database" fill style={{ objectFit: 'contain' }} />
        </div>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#FFFFFF', margin: 0 }}>Full Intelligence Database</h2>
      </div>

      <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>
        
        {/* Intelligence Sidebar */}
        <aside style={{ flex: '0 0 280px', position: 'sticky', top: '100px', background: 'rgba(15, 25, 35, 0.4)', backdropFilter: 'blur(16px)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', borderLeft: '4px solid #00E5FF', padding: '24px', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
          <button onClick={() => { setIsWizardOpen(true); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.2), rgba(0, 100, 255, 0.2))', border: '1px solid rgba(0, 229, 255, 0.4)', color: '#FFF', fontWeight: 800, padding: '12px', borderRadius: '12px', cursor: 'pointer', marginBottom: '24px', boxShadow: '0 4px 15px rgba(0,229,255,0.15)' }}>
            <div style={{ position: 'relative', width: '16px', height: '16px' }}>
              <Image src="/images/redesign/icon_sparkles_3d.png" alt="Sparkles" fill style={{ objectFit: 'contain' }} />
            </div>
            Need Guidance?
          </button>

          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ fontSize: '0.85rem', color: '#00E5FF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', fontWeight: 800 }}>Detail Level</h4>
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <button onClick={() => setIsEli5(true)} style={{ flex: 1, padding: '8px 0', borderRadius: '8px', border: 'none', background: isEli5 ? '#00E5FF' : 'transparent', color: isEli5 ? '#000' : '#A8B4C0', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}>Plain English</button>
              <button onClick={() => setIsEli5(false)} style={{ flex: 1, padding: '8px 0', borderRadius: '8px', border: 'none', background: !isEli5 ? '#00E5FF' : 'transparent', color: !isEli5 ? '#000' : '#A8B4C0', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}>Technical</button>
            </div>
          </div>

          <FilterGroup title="Category" selected={categories} onToggle={(v) => toggleParam('category', v)} options={allCategories.map(c => ({ label: c, value: c }))} />
          <FilterGroup title="Research Area" selected={areas} onToggle={(v) => toggleParam('area', v)} options={Object.keys(RESEARCH_AREAS).map(k => ({ label: RESEARCH_AREAS[k].label, value: k }))} />
          <FilterGroup title="Form" selected={forms} onToggle={(v) => toggleParam('form', v)} options={[{ label: 'Injection (Vial)', value: 'injection' }, { label: 'Oral (Capsule)', value: 'oral' }, { label: 'Topical', value: 'topical' }]} />
          <FilterGroup title="Evidence Tier" selected={tiers} onToggle={(v) => toggleParam('tier', v)} options={Object.keys(EVIDENCE_TIER).map(k => ({ label: EVIDENCE_TIER[k].label, value: k }))} />
        </aside>

        {/* Main Database Grid */}
        <main style={{ flex: 1, minWidth: 0 }}>
          {activePills.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '24px' }}>
              <span style={{ fontSize: '0.85rem', color: '#A8B4C0', fontWeight: 600 }}>Active Filters:</span>
              {activePills.map(pill => (
                <button key={`${pill.key}-${pill.val}`} onClick={() => toggleParam(pill.key, pill.val)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0, 229, 255, 0.1)', border: '1px solid rgba(0, 229, 255, 0.3)', color: '#00E5FF', padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,229,255,0.1)' }}>
                  {pill.label} 
                  <div style={{ position: 'relative', width: '12px', height: '12px' }}>
                    <Image src="/images/redesign/icon_close_3d.png" alt="Close" fill style={{ objectFit: 'contain' }} />
                  </div>
                </button>
              ))}
              <button onClick={clearAllFilters} style={{ background: 'none', border: 'none', color: '#FC8181', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline', marginLeft: '8px' }}>Clear All</button>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
            <p style={{ color: '#00E5FF', fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              {filtered.length} Results
            </p>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <select value={sortParam} onChange={(e) => setSingleParam('sort', e.target.value)} style={{ background: 'rgba(15, 25, 35, 0.8)', color: '#FFF', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 16px', borderRadius: '12px', fontSize: '0.85rem', outline: 'none' }}>
                <option value="default">Default Sorting</option>
                <option value="az">Alphabetical (A-Z)</option>
                <option value="za">Alphabetical (Z-A)</option>
                <option value="tier">Highest Evidence Tier</option>
              </select>
              
              <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '4px' }}>
                <button onClick={() => setSingleParam('view', 'grid')} style={{ padding: '6px 12px', borderRadius: '8px', background: viewParam === 'grid' ? 'rgba(0, 229, 255, 0.2)' : 'transparent', border: 'none', color: viewParam === 'grid' ? '#00E5FF' : '#A8B4C0', cursor: 'pointer' }}>
                  <div style={{ position: 'relative', width: '16px', height: '16px', filter: viewParam === 'grid' ? 'drop-shadow(0 0 8px rgba(0,229,255,0.6))' : 'grayscale(1) opacity(0.6)' }}>
                    <Image src="/images/redesign/icon_grid_3d.png" alt="Grid" fill style={{ objectFit: 'contain' }} />
                  </div>
                </button>
                <button onClick={() => setSingleParam('view', 'list')} style={{ padding: '6px 12px', borderRadius: '8px', background: viewParam === 'list' ? 'rgba(0, 229, 255, 0.2)' : 'transparent', border: 'none', color: viewParam === 'list' ? '#00E5FF' : '#A8B4C0', cursor: 'pointer' }}>
                  <div style={{ position: 'relative', width: '16px', height: '16px', filter: viewParam === 'list' ? 'drop-shadow(0 0 8px rgba(0,229,255,0.6))' : 'grayscale(1) opacity(0.6)' }}>
                    <Image src="/images/redesign/icon_list_3d.png" alt="List" fill style={{ objectFit: 'contain' }} />
                  </div>
                </button>
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', background: 'rgba(15, 25, 35, 0.4)', borderRadius: '24px', border: '1px dashed rgba(255,255,255,0.1)' }}>
              <div style={{ position: 'relative', width: '48px', height: '48px', margin: '0 auto 16px auto', opacity: 0.5 }}>
                <Image src="/images/redesign/molecule_default.png" alt="Database" fill style={{ objectFit: 'contain' }} />
              </div>
              <div style={{ color: '#FFF', fontSize: '1.2rem', fontWeight: 800, marginBottom: '8px' }}>No Matches Found In The Database.</div>
              <div style={{ color: '#A8B4C0', marginBottom: '24px' }}>Try Broadening Your Search Parameters Or Research Area.</div>
              <button onClick={clearAllFilters} style={{ background: '#00E5FF', color: '#000', border: 'none', padding: '12px 32px', borderRadius: '12px', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,229,255,0.3)' }}>
                Reset Database Query
              </button>
            </div>
          ) : viewParam === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {paginatedResults.map((c) => {
                const badge = getDynamicBadge(c.slug);
                return (
                  <PremiumCompoundCard 
                    key={c.slug} 
                    compound={c} 
                    isEli5={isEli5} 
                    onQuickView={setQuickViewCompound} 
                    showBadge={badge?.label} 
                    badgeColor={badge?.color} 
                    storeProduct={productsMap[c.slug]}
                  />
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {paginatedResults.map((c) => {
                const badge = getDynamicBadge(c.slug);
                return (
                  <div key={c.slug} style={{ height: '200px' }}>
                     <PremiumCompoundCard 
                        compound={c} 
                        isEli5={isEli5} 
                        onQuickView={setQuickViewCompound} 
                        showBadge={badge?.label} 
                        badgeColor={badge?.color} 
                        storeProduct={productsMap[c.slug]}
                      />
                  </div>
                );
              })}
            </div>
          )}

          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: '48px', paddingBottom: '80px' }}>
              <button onClick={() => setPage(p => p + 1)} style={{ background: 'transparent', border: '2px solid #00E5FF', color: '#00E5FF', padding: '12px 40px', borderRadius: '16px', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 0 20px rgba(0,229,255,0.1)' }}>
                Load More Results
              </button>
            </div>
          )}
        </main>
      </div>

      <HelpMeChooseWizard isOpen={isWizardOpen} onClose={() => setIsWizardOpen(false)} onComplete={handleWizardComplete} />
      {quickViewCompound && <QuickViewModal compound={quickViewCompound} storeProduct={productsMap[quickViewCompound.slug]} isOpen={true} onClose={() => setQuickViewCompound(null)} />}
    </div>
  );
}
