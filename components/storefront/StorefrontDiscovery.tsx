'use client';

/**
 * StorefrontDiscovery
 * ---
 * Top-of-storefront discovery layer for researchers who do not already
 * know what compound they want to buy. Composes three pieces:
 *
 *   1. DiscoveryHero          large goal search + example chips + Let Us Guide You
 *   2. GuidedDiscoveryWizard  3-step modal that funnels into the match engine
 *   3. MatchResultsDrawer     bottom-sheet that shows matched products with Add To Cart
 *
 * The hero is the default export; the wizard and the results drawer are
 * managed internally by the hero so the caller only mounts one component.
 *
 * Public API surface (exported types):
 *   - DiscoveryHeroProps
 *   - MatchedProduct
 *
 * No DB changes. Reuses the existing /api/research/match endpoint and the
 * compoundsBySlug prop already plumbed into AgentStorefrontGrid.
 *
 * Research-Use-Only platform. Title Case on every user-facing string.
 * No emojis.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

import { X } from 'lucide-react';
import { reportClientError } from '@/lib/report-client-error';
import AutocompleteDropdown, { type Suggestion } from '../research/AutocompleteDropdown';
import TrendingSearchesDropdown from '../research/TrendingSearchesDropdown';
import { useSearchHistory } from '../research/useSearchHistory';

import type { Compound } from '@/lib/compounds';
import { RESEARCH_AREAS } from '../../lib/compounds';
import dynamic from 'next/dynamic';
import {
  labelForArea,
  capitalizeEveryWord,
  deriveAvailableAreas,
  buildGoalFromWizard,
  type MatchedProduct,
  type ExcludedCompound,
} from './discovery-shared';

export type { MatchedProduct, ExcludedCompound };

const MatchResultsDrawer = dynamic(() => import('./MatchResultsDrawer').then((m) => m.MatchResultsDrawer), { ssr: false });
const GuidedDiscoveryWizard = dynamic(() => import('./GuidedDiscoveryWizard').then((m) => m.GuidedDiscoveryWizard), { ssr: false });

// --------------------------------------------------------------------------
// Public types
// --------------------------------------------------------------------------

export interface DiscoveryHeroProps {
  /** Compound slug -> Compound (the same prop AgentStorefrontGrid already gets). */
  compoundsBySlug: Record<string, Compound>;
  /**
   * Caller resolves a list of compound slugs into the products this agent
   * actually sells, in the order they came in. Out-of-catalog slugs may be
   * dropped or returned with in_stock=false.
   */
  resolveProducts: (slugs: string[]) => MatchedProduct[];
  /** Caller adds a product (by agent_products.id) to the cart. */
  onAddToCart: (productId: string) => void;
  /** Caller opens the product detail modal (by agent_products.id). */
  onOpenProduct: (productId: string) => void;
  /** Caller filters the storefront by a single research area. */
  onSelectArea: (area: string) => void;
  /** Brand primary colour for the hero gradient. */
  primaryColor?: string;
  /** Caller notified when user starts typing or selects a goal */
  onSearchStarted?: (query?: string) => void;
  /** Caller notified when user clicks Already Know Which Peptide You Need */
  onAlreadyKnowClicked?: () => void;
  /** Automated search query passed from storefront zero-results fallback */
  autoSearchQuery?: string;
  /** Callback to clear the automated search query after consumption */
  onAutoSearchConsumed?: () => void;
  /** Override for Match Me button click */
  onMatchMeClick?: () => void;
  /** Override for Let Us Guide You button click */
  onLetUsGuideYouClick?: () => void;
  /** Override for search submission */
  onSearchSubmit?: (query: string) => void;
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

export default function DiscoveryHero({
  compoundsBySlug,
  resolveProducts,
  onAddToCart,
  onOpenProduct,
  onSelectArea,
  primaryColor = '#00C4BC',
  onSearchStarted,
  onAlreadyKnowClicked,
  autoSearchQuery,
  onAutoSearchConsumed,
  onMatchMeClick,
  onLetUsGuideYouClick,
  onSearchSubmit,
}: DiscoveryHeroProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showAllAreas, setShowAllAreas] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MatchedProduct[]>([]);
  const [excluded, setExcluded] = useState<ExcludedCompound[]>([]);
  const [goalSummary, setGoalSummary] = useState('');
  const [followUp, setFollowUp] = useState<{ question: string; originalGoal: string } | null>(null);
  const [matchError, setMatchError] = useState(false);
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [wizardMounted, setWizardMounted] = useState(false);
  useEffect(() => { if (drawerOpen) setDrawerMounted(true); }, [drawerOpen]);
  useEffect(() => { if (wizardOpen) setWizardMounted(true); }, [wizardOpen]);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const { recent, addHistory } = useSearchHistory();
  const availableAreas = useMemo(() => deriveAvailableAreas(compoundsBySlug), [compoundsBySlug]);

  useEffect(() => {
    function onPointer(e: MouseEvent) {
      if (!searchContainerRef.current) return;
      if (!searchContainerRef.current.contains(e.target as Node)) {
        setSuggestOpen(false);
      }
    }
    window.addEventListener('mousedown', onPointer);
    return () => window.removeEventListener('mousedown', onPointer);
  }, []);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestions([]);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/research/suggest?q=${encodeURIComponent(trimmed)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.suggestions)) {
          setSuggestions(data.suggestions);
        }
      } catch {
        // swallow
      }
    }, 200);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query]);

  function onSuggestionSelect(s: Suggestion) {
    if (s.kind === 'compound') {
      const matched = resolveProducts([s.slug]);
      if (matched && matched[0] && matched[0].product_id) {
        addHistory(s.display_name);
        onOpenProduct(matched[0].product_id);
        setSuggestOpen(false);
        return;
      }
      addHistory(s.display_name);
      router.push(`/research/${s.slug}`);
      setSuggestOpen(false);
      return;
    }
    if (s.kind === 'area') {
      if (onSelectArea) {
        onSelectArea(s.slug);
        setSuggestOpen(false);
        return;
      }
      router.push(`/research/area/${s.slug}`);
      setSuggestOpen(false);
      return;
    }
    // For 'glossary', we can filter the storefront grid directly
    if (s.kind === 'glossary') {
      if (onSearchStarted) {
        addHistory(s.display_name);
        onSearchStarted(s.display_name);
        setSuggestOpen(false);
        return;
      }
      addHistory(s.display_name);
      router.push(`/research/search?q=${encodeURIComponent(s.display_name)}`);
      setSuggestOpen(false);
      return;
    }
    // default fallback
    addHistory(s.display_name);
    setQuery(s.display_name);
    if (onSearchStarted) onSearchStarted(s.display_name);
  }

  const runMatch = useCallback(async (input: {
    goal: string;
    goals?: string[];
    evidenceComfort?: 'strict_human_only' | 'investigational_ok' | 'preclinical_ok' | 'any';
    riskTolerance?: 'low_only' | 'moderate_ok' | 'any';
    preference?: 'single' | 'stack' | 'either';
    budget?: 'conservative' | 'standard' | 'unlimited';
    excludeInjectables?: boolean;
    requireLongHalfLife?: boolean;
    /** When set, /match parses this raw goal server-side (single round trip). */
    prompt?: string;
  }, summary: string) => {
    setLoading(true);
    setResults([]);
    setExcluded([]);
    setGoalSummary(summary);
    setDrawerOpen(true);
    setFollowUp(null);
    setMatchError(false);
    try {
      const res = await fetch('/api/research/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          input.prompt
            ? { prompt: input.prompt }
            : {
                input: {
                  goal: input.goal,
                  goals: input.goals,
                  evidenceComfort: input.evidenceComfort || 'preclinical_ok',
                  riskTolerance: input.riskTolerance || 'moderate_ok',
                  preference: input.preference,
                  budget: input.budget || 'standard',
                  excludeInjectables: input.excludeInjectables,
                  requireLongHalfLife: input.requireLongHalfLife,
                },
              }
        ),
      });
      if (!res.ok) {
        setMatchError(true);
        reportClientError('find-a-peptide.match', new Error(`match http ${res.status}`), { meta: { status: res.status } });
        return;
      }
      const json = await res.json().catch(() => null) as {
        results?: Array<{ 
          slug: string; 
          rationale?: string; 
          isStackPartner?: boolean;
          score?: number;
          riskLevel?: string;
          halfLife?: string;
          molecularWeight?: number;
        }>;
        excluded?: ExcludedCompound[];
      } | null;
      const slugs = (json?.results || []).map(r => r.slug).filter(Boolean);
      
      const detailsMap = new Map((json?.results || []).map(r => [r.slug, r]));
      
      const products = resolveProducts(slugs);
      
      // Attach rationale and stack data by slug when available.
      const stitched = products.map(p => {
        const details = p.compound_slug ? detailsMap.get(p.compound_slug) : null;
        return {
          ...p,
          rationale: details?.rationale || p.rationale,
          isStackPartner: details?.isStackPartner || false,
          score: details?.score,
          riskLevel: details?.riskLevel,
          halfLife: details?.halfLife,
          molecularWeight: details?.molecularWeight,
        };
      });
      setResults(stitched);
      setExcluded(json?.excluded || []);
    } catch (e) {
      setResults([]);
      setMatchError(true);
      reportClientError('find-a-peptide.match', e);
    } finally {
      setLoading(false);
    }
  }, [resolveProducts]);

  const submitTypedGoal = useCallback(async (overrideGoal?: string) => {
    const g = (overrideGoal || query).trim();
    if (!g) return;
    
    setSuggestOpen(false);
    // Single round trip: /api/research/match now parses a raw prompt server-side,
    // so we skip the separate /ai-match call. runMatch owns the loading, drawer,
    // error, and result state (including the "Something Went Wrong" panel).
    await runMatch({ goal: g, prompt: g }, g);
  }, [query, runMatch]);

  useEffect(() => {
    if (autoSearchQuery) {
      setQuery(autoSearchQuery);
      submitTypedGoal(autoSearchQuery);
      if (onAutoSearchConsumed) {
        onAutoSearchConsumed();
      }
    }
  }, [autoSearchQuery, submitTypedGoal, onAutoSearchConsumed]);

  const submitFollowUp = useCallback(async (answer: string) => {
    if (!followUp) return;
    const combined = `${followUp.originalGoal}. Clarification: ${answer}`;
    
    setLoading(true);
    setFollowUp(null);
    setGoalSummary(combined);

    try {
      const res = await fetch('/api/research/ai-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: combined })
      });
      const data = await res.json().catch(() => null);
      if (data?.result) {
        // If it asks ANOTHER follow-up, just force the match without it to prevent loops
        await runMatch(data.result, combined);
      } else {
        setDrawerOpen(false);
      }
    } catch {
      setDrawerOpen(false);
    } finally {
      setLoading(false);
    }
  }, [followUp, runMatch]);

  return (
    <>
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 980,
          margin: '0 auto 18px',
          aspectRatio: '941 / 1672',
          backgroundImage: 'url(/images/research/store-hero.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          borderRadius: 22,
          overflow: 'hidden',
          boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
        }}
      >
        {/* Match Me Button Overlay — runs the AI match engine on the typed goal
            (opening the results drawer). If nothing is typed yet, focus the
            search box so the researcher can describe their goal, then match. */}
        <button
          type="button"
          onClick={() => {
            if (onMatchMeClick) {
              onMatchMeClick();
              return;
            }
            if (query.trim()) {
              void submitTypedGoal();
            } else {
              // No goal typed yet. The search box sits at the very top of this
              // tall hero and programmatic scrolling is unreliable on this page,
              // so focusing it did nothing the user could see -- the button
              // looked dead. Open the guided wizard instead: it collects the
              // research goal in-place and funnels into the same match engine.
              setWizardOpen(true);
            }
          }}
          title="Match Me"
          style={{
            position: 'absolute', top: '85%', left: '15%', width: '33%', height: '8%',
            cursor: 'pointer', opacity: 0, zIndex: 10
          }}
          aria-label="Match Me"
        />

        {/* Let Us Guide You Button Overlay — opens the step-by-step guided wizard
            that funnels answers into the match engine. */}
        <button
          type="button"
          onClick={() => {
            if (onLetUsGuideYouClick) {
              onLetUsGuideYouClick();
            } else {
              setWizardOpen(true);
            }
          }}
          title="Let Us Guide You"
          style={{
            position: 'absolute', top: '85%', left: '52%', width: '33%', height: '8%',
            cursor: 'pointer', opacity: 0, zIndex: 10
          }}
          aria-label="Let Us Guide You"
        />

        {/* Search Input Box */}
        <div 
          ref={searchContainerRef}
          style={{
            position: 'absolute', top: '12.5%', left: '6%', width: '88%', height: '5.5%',
            zIndex: 5,
          }}
        >
          <input
            id="discovery-search-input"
            type="text"
            value={query}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={suggestOpen}
            aria-haspopup="listbox"
            aria-controls="storefront-search-autocomplete"
            onChange={(e) => {
              setQuery(e.target.value);
              setSuggestOpen(true);
            }}
            onFocus={() => setSuggestOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim()) {
                e.preventDefault();
                addHistory(query.trim());
                if (onSearchSubmit) {
                  onSearchSubmit(query.trim());
                } else {
                  // Run the in-page AI match engine (opens the results drawer) rather
                  // than navigating away to the store grid. This makes the "Ask Us
                  // Anything" box, the Match Me button, and the guided wizard all funnel
                  // into the same match experience.
                  void submitTypedGoal();
                }
              }
            }}
            placeholder="Ask Us Anything..."
            style={{
              width: '100%', height: '100%',
              background: 'transparent',
              border: 'none', outline: 'none', color: '#FFFFFF',
              fontSize: 'max(16px, 1.86vw)',
              padding: '0 10px 12px 72px',
              textAlign: 'left',
              fontWeight: 500,
              letterSpacing: '0.02em',
            }}
          />
          {suggestOpen && (query.trim().length > 0 || recent.length > 0) && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: '4%', zIndex: 50, marginTop: '4px' }}>
              <AutocompleteDropdown
                id="storefront-search-autocomplete"
                suggestions={suggestions}
                recent={recent}
                onSelect={onSuggestionSelect}
                onSelectRecent={(t) => { 
                  addHistory(t);
                  setQuery(t); 
                  if (onSearchStarted) onSearchStarted(t); 
                }}
              />
            </div>
          )}
          {suggestOpen && query.trim().length === 0 && recent.length === 0 && (
             <TrendingSearchesDropdown 
               onSelect={(term) => {
                 addHistory(term);
                 setQuery(term);
                 setSuggestOpen(false);
                 if (onSearchStarted) onSearchStarted(term);
               }}
               style={{ right: '4%' }}
             />
          )}
        </div>

        {/* Quick Select Buttons */}
        <button type="button" aria-label="Weight Management" title="Weight Management" onClick={() => onSelectArea('weight_management')} style={{ position: 'absolute', top: '23%', left: '5%', width: '21%', height: '18%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />
        <button type="button" aria-label="Tissue Repair" title="Tissue Repair" onClick={() => onSelectArea('tissue_repair')} style={{ position: 'absolute', top: '23%', left: '27%', width: '22%', height: '18%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />
        <button type="button" aria-label="Healing & Recovery" title="Healing & Recovery" onClick={() => onSelectArea('healing')} style={{ position: 'absolute', top: '23%', left: '50%', width: '22%', height: '18%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />
        <button type="button" aria-label="Performance" title="Performance" onClick={() => onSelectArea('performance')} style={{ position: 'absolute', top: '23%', left: '73%', width: '22%', height: '18%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />
        <button type="button" aria-label="Skin & Hair" title="Skin & Hair" onClick={() => onSelectArea('cosmetic')} style={{ position: 'absolute', top: '42%', left: '5%', width: '21%', height: '19%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />
        <button type="button" aria-label="Cognitive" title="Cognitive" onClick={() => onSelectArea('cognitive')} style={{ position: 'absolute', top: '42%', left: '27%', width: '22%', height: '19%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />
        <button type="button" aria-label="Pain & Inflammation" title="Pain & Inflammation" onClick={() => onSelectArea('pain_inflammation')} style={{ position: 'absolute', top: '42%', left: '50%', width: '22%', height: '19%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />
        <button title="More" onClick={() => {
          setShowAllAreas(true);
        }} style={{ position: 'absolute', top: '42%', left: '73%', width: '22%', height: '19%', cursor: 'pointer', opacity: 0, zIndex: 10 }} />

        {/* Already Know Which Peptide You Need */}
        <button
          type="button"
          onClick={() => {
            if (onAlreadyKnowClicked) onAlreadyKnowClicked();
          }}
          title="Already Know Which Peptide You Need"
          style={{ position: 'absolute', top: '64.5%', left: '3%', width: '94%', height: '12.5%', cursor: 'pointer', opacity: 0, zIndex: 10 }}
        />
        
        {/* Pop Up For All Areas */}
        {showAllAreas && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(5, 10, 15, 0.95)', backdropFilter: 'blur(12px)',
            zIndex: 50, display: 'flex', flexDirection: 'column', padding: 24,
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ color: '#FFF', fontSize: '1.4rem', fontWeight: 800 }}>{capitalizeEveryWord('Browse By Research Area')}</h3>
              <button 
                type="button" 
                onClick={() => setShowAllAreas(false)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#FFF', cursor: 'pointer', borderRadius: '50%', padding: '8px', display: 'flex' }}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: '16px',
              paddingBottom: '32px'
            }}>
              {availableAreas.map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => { setShowAllAreas(false); onSelectArea(area); }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    cursor: 'pointer',
                    padding: 0,
                    margin: 0,
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    transition: 'transform 0.2s ease, background 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    textAlign: 'left'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  }}
                >
                  <div style={{ width: '100%', aspectRatio: '1 / 1', position: 'relative' }}>
                    <Image src={`/images/areas/${area}.png`} alt={labelForArea(area).replace('\n', ' ')} width={200} height={200} unoptimized style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                  
                  {/* Dynamic description underneath the image */}
                  <div style={{ padding: '12px', flex: 1, display: 'flex', alignItems: 'flex-start' }}>
                    <p style={{
                      margin: 0,
                      fontSize: '0.85rem',
                      color: 'var(--silver-light, #D0DAE4)',
                      lineHeight: 1.4,
                      fontWeight: 400
                    }}>
                      {capitalizeEveryWord(RESEARCH_AREAS[area]?.blurb || 'Explore Research Compounds In This Category.')}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {wizardMounted && (
      <GuidedDiscoveryWizard
        open={wizardOpen}
        availableAreas={availableAreas}
        primaryColor={primaryColor}
        onClose={() => setWizardOpen(false)}
        onSubmit={(s) => {
          setWizardOpen(false);
          // The match engine keys goal relevance on the research_area KEY
          // (c.research_areas.includes(goal) / GOAL_KEYWORDS[goal]). Passing a
          // display label like "Healing & Recovery Research" matched no key and
          // every compound failed the relevance gate -> "zero peptides match".
          // s.area IS the research_area key; the human-readable summary is the
          // second arg (buildGoalFromWizard), so the drawer copy is unaffected.
          const goal = s.area;
          void runMatch(
            { goal, evidenceComfort: s.comfort, preference: s.preference, budget: s.budget },
            buildGoalFromWizard(s),
          );
        }}
      />
      )}

      {drawerMounted && (
      <MatchResultsDrawer
        open={drawerOpen}
        loading={loading}
        results={results}
        excluded={excluded}
        goalSummary={goalSummary}
        followUp={followUp}
        submitFollowUp={submitFollowUp}
        matchError={matchError}
        onRetry={() => { if (goalSummary) submitTypedGoal(goalSummary); }}
        primaryColor={primaryColor}
        onClose={() => setDrawerOpen(false)}
        onAddToCart={(id) => { setDrawerOpen(false); onAddToCart(id); }}
        onOpenProduct={(id) => { setDrawerOpen(false); onOpenProduct(id); }}
      />
      )}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (min-width: 769px) {
          #discovery-search-input {
            font-size: calc(max(16px, 1.86vw) * 1.5) !important;
            padding: 14px 10px 0 96px !important;
          }
        }
      ` }} />
    </>
  );
}
