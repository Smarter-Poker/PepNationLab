"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import GuestCTA from '@/components/GuestCTA';

// Module titles as taught by the course engines (public/peptide-101.m*.js).
// Server-rendered in the syllabus below so the page carries real, crawlable
// educational text instead of an artwork-only shell.
const CONTENT_STATIC = ['s1','s2','s3','s4','s5','s6','s7','s8','s9','s11','s12','s13','s14'];

const MODULE_TITLES = [
  'Module 1: What Is A Peptide',
  'Module 2: Building A Peptide',
  'Module 3: The Lock And Key',
  'Module 4: What Peptides Are Studied For',
  'Module 5: Handling And Storage',
  'Module 6: Peptide Families And Categories',
  'Module 7: Stacking And Research Protocols',
  'Module 8: Reconstitution Calculator',
  'Module 9: Dosing Reference',
  'Module 10: What Peptides Are NOT',
  'Module 11: Why Peptides Are Injected',
  'Module 12: Safety, Purity And Sourcing',
  'Module 13: Legality And Research Use',
  'Module 14: Final Quiz And Certificate',
];

export default function Peptide101LandingPage() {
  const [completedModules, setCompletedModules] = useState(0);
  const [lockedToast, setLockedToast] = useState(false);

  useEffect(() => {
    const LS_KEY = 'p101_progress_v3';

    const calculateProgress = () => {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          const state = JSON.parse(raw);
          if (state.done) {
            setCompletedModules(Object.keys(state.done).length);
          }
        }
      } catch (e) {
        console.error("Failed to parse progress:", e);
      }
    };

    calculateProgress();

    // No auto-launch — users must manually click Start Learning.

    const handleStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY) calculateProgress();
    };
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) calculateProgress();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('pageshow', handlePageShow);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  // SSR note: no mounted gate - the server HTML must carry the state-1 artwork,
  // real <a href> links, and the syllabus below so non-JS crawlers (GPTBot,
  // ClaudeBot, PerplexityBot) see content and the LCP image can preload.
  // localStorage progress corrects the artwork after hydration.
  const landingState = Math.min(completedModules + 1, 14);
  const CONTENT = ['s1','s2','s3','s4','s5','s6','s7','s8','s9','s11','s12','s13','s14'];

  const routeToNext = () => {
    let lastScreen = '';
    try {
      const s = localStorage.getItem("p101_screen");
      if (s) lastScreen = '#s' + s;
    } catch(e) {}
    const nextModuleId = completedModules < 13 ? CONTENT[completedModules] : 's15';
    window.location.href = `/peptide-101/course${lastScreen || '#' + nextModuleId}`;
  };

  const routeToRoadmap = () => {
    window.scrollTo({ top: window.innerHeight * 0.45, behavior: 'smooth' });
  };

  const showLockedPopup = () => {
    setLockedToast(true);
    setTimeout(() => setLockedToast(false), 2800);
  };

  // Clears per-module resume state; navigation is handled by the anchor href.
  const handleModuleClick = (modId: string, index: number) => {
    try {
      localStorage.removeItem(`p101_m${index + 1}_page`);
      localStorage.removeItem(`p101_v14_cur_${modId}`);
    } catch(e) {}
  };

  return (
    <>
    <div style={{ backgroundColor: '#020617', minHeight: '100dvh', display: 'flex', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
        {/* Mobile LCP: each state artwork is a ~1.6MB source PNG. Routing it
            through next/image serves a right-sized AVIF/WebP instead, and the
            intrinsic dimensions reserve the layout box (no CLS). */}
        <Image
          src={`/images/landing-states/state-${landingState}.png`}
          alt={`Peptide 101 State ${landingState}`}
          width={853}
          height={1844}
          priority
          fetchPriority="high"
          quality={40}
          sizes="(max-width: 480px) 250px, (max-width: 1000px) 100vw, 1000px"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />

        {/* Real anchors (crawlable + keyboard reachable) with visually-hidden
            text - same pattern as the homepage ZONES layer. */}
        <button type="button" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} aria-label="Overview" style={{ position: 'absolute', top: '0%', left: '0%', width: '20%', height: '60px', cursor: 'pointer', zIndex: 10, background: 'transparent', border: 'none' }} title="Overview"></button>
        <a href="/peptide-101/course#s1" style={{ position: 'absolute', top: '0%', left: '20%', width: '20%', height: '60px', cursor: 'pointer', zIndex: 10 }} title="Roadmap"><span className="sr-only">Course Roadmap</span></a>
        <a href="/peptide-101/course#s6" style={{ position: 'absolute', top: '0%', left: '40%', width: '20%', height: '60px', cursor: 'pointer', zIndex: 10 }} title="Families"><span className="sr-only">Peptide Families And Categories</span></a>
        <a href="/peptide-101/course#s8" style={{ position: 'absolute', top: '0%', left: '60%', width: '20%', height: '60px', cursor: 'pointer', zIndex: 10 }} title="Reconstitution"><span className="sr-only">Reconstitution Module</span></a>
        <a href="/peptide-101/course#s10" style={{ position: 'absolute', top: '0%', left: '80%', width: '20%', height: '60px', cursor: 'pointer', zIndex: 10 }} title="Certificate"><span className="sr-only">Course Certificate</span></a>

        <a
          href={`/peptide-101/course#${completedModules < 13 ? CONTENT[completedModules] : 's15'}`}
          onClick={(e) => { e.preventDefault(); routeToNext(); }}
          style={{ position: 'absolute', top: '28%', left: '2%', width: '58%', height: '6%', cursor: 'pointer', zIndex: 10 }}
          title={landingState === 1 ? "Start Learning" : "Continue Learning"}
        ><span className="sr-only">{landingState === 1 ? 'Start Learning' : 'Continue Learning'}</span></a>

        <a
          href="/peptide-101/course#glossary"
          style={{ position: 'absolute', top: '12%', left: '5%', width: '40%', height: '8%', cursor: 'pointer', zIndex: 10 }}
          title="60+ Peptides (Glossary)"
        ><span className="sr-only">60+ Peptides Glossary</span></a>

        {CONTENT.concat(['s15']).map((modId, index) => {
          const ROADMAP_START = 54.9;
          const ROADMAP_STEP  = 1.84;
          const topPosition   = ROADMAP_START + (index * ROADMAP_STEP);

          const isLocked   = index > completedModules;
          const isCurrent  = index === completedModules;

          return (
            <a
              key={modId}
              href={`/peptide-101/course#${modId}`}
              onClick={() => handleModuleClick(modId, index)}
              style={{
                position: 'absolute',
                top: `${topPosition}%`,
                left: '5%',
                width: '90%',
                // Height matches ROADMAP_STEP so consecutive hitboxes no longer
                // overlap (boundary taps were landing on the wrong module).
                height: '1.84%',
                cursor: isLocked ? 'not-allowed' : 'pointer',
                zIndex: 10,
              }}
              title={
                isLocked
                  ? `Locked: Module ${index + 1} - Complete Previous Modules To Unlock`
                  : isCurrent
                  ? `Continue: Module ${index + 1}`
                  : `Review: Module ${index + 1}`
              }
            ><span className="sr-only">{MODULE_TITLES[index]}</span></a>
          );
        })}

        <button
          type="button"
          onClick={routeToRoadmap}
          aria-label="View Roadmap"
          style={{ position: 'absolute', top: '28%', left: '61%', width: '37%', height: '6%', cursor: 'pointer', zIndex: 10, background: 'transparent', border: 'none' }}
          title="View Roadmap"
        ></button>

        <a
          href={`/peptide-101/course#${completedModules < 13 ? CONTENT[completedModules] : 's15'}`}
          onClick={(e) => { e.preventDefault(); routeToNext(); }}
          style={{ position: 'absolute', bottom: '2%', left: '3%', width: '94%', height: '6%', cursor: 'pointer', zIndex: 10 }}
          title={landingState === 1 ? "Start Learning" : "Continue To Module"}
        ><span className="sr-only">{landingState === 1 ? 'Start Learning' : 'Continue To Module'}</span></a>

        {lockedToast && (
          <div style={{
            position: 'fixed',
            bottom: '32px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #1a0a2e, #0d1a2e)',
            border: '1px solid rgba(239,68,68,0.6)',
            borderRadius: '16px',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            zIndex: 99999,
            boxShadow: '0 8px 32px rgba(239,68,68,0.3)',
            minWidth: '280px',
            maxWidth: '90vw',
          }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                <rect x="5" y="11" width="14" height="10" rx="2"/>
                <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#ef4444', marginBottom: '2px' }}>Module Locked</div>
              <div style={{ fontSize: '12px', color: '#9ca3af' }}>Complete Previous Modules To Unlock This One.</div>
            </div>
          </div>
        )}
      </div>
    </div>
    {/* Crawlable syllabus: /peptide-101 is an indexable, sitemap-promoted URL
        but previously exposed zero text. This block gives search and AI
        crawlers the actual course scope. */}
    <section aria-label="Peptide 101 Course Syllabus" style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 20px 64px', backgroundColor: '#020617' }}>
      <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#FFFFFF', margin: '0 0 12px' }}>Peptide 101 Course Syllabus</h2>
      <p style={{ color: '#A8B4C0', fontSize: '1rem', lineHeight: 1.7, margin: '0 0 20px', maxWidth: 760 }}>
        Peptide 101 Is A Free, Self-Paced Research Academy Covering What Peptides Are, How They Are
        Built And Studied, Peptide Families, Laboratory Handling, Storage, Reconstitution, Quality
        Verification, And The Legal Framework Around Research Use. Fourteen Interactive Modules End
        With A Final Quiz And Certificate Of Completion.
      </p>
      <ol style={{ color: '#A8B4C0', fontSize: '0.95rem', lineHeight: 1.9, margin: 0, paddingLeft: 22, columns: 1 }}>
        {MODULE_TITLES.map((t, i) => (
          <li key={t}>
            <a href={`/peptide-101/course#${i < 13 ? CONTENT_STATIC[i] : 's15'}`} style={{ color: '#A8B4C0', textDecoration: 'none' }}>{t}</a>
          </li>
        ))}
      </ol>
      <p style={{ fontSize: '0.78rem', color: '#6B7785', marginTop: 24 }}>
        For Laboratory Research Use Only. Course Material Restates Published Science And Is Not
        Medical Advice, Dosing Guidance, Or An Endorsement Of Human Use.
      </p>
    </section>
    <GuestCTA />
    </>
  );
}
