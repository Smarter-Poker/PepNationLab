"use client";
import { useEffect, useState } from "react";
import GuestCTA from '@/components/GuestCTA';

export default function Peptide101LandingPage() {
  const [completedModules, setCompletedModules] = useState(0);
  const [mounted, setMounted] = useState(false);
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
    setMounted(true);

    // Auto-launch Module 1 for first-time visitors (no progress yet).
    // Fires after 800ms so the landing image is visible briefly before navigating.
    // Skipped if the user has already started the course (has any completed modules
    // or has a last-viewed screen stored).
    const autoLaunchTimer = setTimeout(() => {
      try {
        const hasProgress = !!localStorage.getItem('p101_progress_v3');
        const hasLastScreen = !!localStorage.getItem('p101_screen');
        if (!hasProgress && !hasLastScreen) {
          window.location.href = '/peptide-101/course#s1';
        }
      } catch { /* storage unavailable - skip */ }
    }, 800);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY) calculateProgress();
    };
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) calculateProgress();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('pageshow', handlePageShow);
    return () => {
      clearTimeout(autoLaunchTimer);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  if (!mounted) return <div style={{ backgroundColor: '#020617', width: '100vw', height: '100vh' }}></div>;

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

  const handleModuleClick = (modId: string, index: number) => {
    try {
      localStorage.removeItem(`p101_m${index + 1}_page`);
      localStorage.removeItem(`p101_v14_cur_${modId}`);
    } catch(e) {}
    window.location.href = `/peptide-101/course#${modId}`;
  };

  return (
    <>
    <div style={{ backgroundColor: '#020617', minHeight: '100vh', display: 'flex', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
        <img
          src={`/images/landing-states/state-${landingState}.png`}
          alt={`Peptide 101 State ${landingState}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />

        <div onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} style={{ position: 'absolute', top: '0%', left: '0%', width: '20%', height: '60px', cursor: 'pointer', zIndex: 10 }} title="Overview"></div>
        <div onClick={() => window.location.href='/peptide-101/course#s1'} style={{ position: 'absolute', top: '0%', left: '20%', width: '20%', height: '60px', cursor: 'pointer', zIndex: 10 }} title="Roadmap"></div>
        <div onClick={() => window.location.href='/peptide-101/course#s6'} style={{ position: 'absolute', top: '0%', left: '40%', width: '20%', height: '60px', cursor: 'pointer', zIndex: 10 }} title="Families"></div>
        <div onClick={() => window.location.href='/peptide-101/course#s8'} style={{ position: 'absolute', top: '0%', left: '60%', width: '20%', height: '60px', cursor: 'pointer', zIndex: 10 }} title="Reconstitution"></div>
        <div onClick={() => window.location.href='/peptide-101/course#s10'} style={{ position: 'absolute', top: '0%', left: '80%', width: '20%', height: '60px', cursor: 'pointer', zIndex: 10 }} title="Certificate"></div>

        <div
          onClick={routeToNext}
          style={{ position: 'absolute', top: '28%', left: '2%', width: '58%', height: '6%', cursor: 'pointer', zIndex: 10 }}
          title={landingState === 1 ? "Start Learning" : "Continue Learning"}
        ></div>

        <div
          onClick={() => window.location.href='/peptide-101/course#glossary'}
          style={{ position: 'absolute', top: '12%', left: '5%', width: '40%', height: '8%', cursor: 'pointer', zIndex: 10 }}
          title="60+ Peptides (Glossary)"
        ></div>

        {CONTENT.concat(['s15']).map((modId, index) => {
          const ROADMAP_START = 54.9;
          const ROADMAP_STEP  = 1.84;
          const topPosition   = ROADMAP_START + (index * ROADMAP_STEP);

          const isLocked   = index > completedModules;
          const isCurrent  = index === completedModules;

          return (
            <div
              key={modId}
              onClick={() => handleModuleClick(modId, index)}
              style={{
                position: 'absolute',
                top: `${topPosition}%`,
                left: '5%',
                width: '90%',
                height: '2%',
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
            ></div>
          );
        })}

        <div
          onClick={routeToRoadmap}
          style={{ position: 'absolute', top: '28%', left: '61%', width: '37%', height: '6%', cursor: 'pointer', zIndex: 10 }}
          title="View Roadmap"
        ></div>

        <div
          onClick={routeToNext}
          style={{ position: 'absolute', bottom: '2%', left: '3%', width: '94%', height: '6%', cursor: 'pointer', zIndex: 10 }}
          title={landingState === 1 ? "Start Learning" : "Continue To Module"}
        ></div>

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
    <GuestCTA />
    </>
  );
}
