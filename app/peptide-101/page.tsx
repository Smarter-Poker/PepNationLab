"use client";
import { useEffect, useState } from "react";
import Head from "next/head";

export default function Peptide101LandingPage() {
  const [completedModules, setCompletedModules] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const LS_KEY = 'p101_progress_v3';
    
    const calculateProgress = () => {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          const state = JSON.parse(raw);
          if (state.done) {
            const doneCount = Object.keys(state.done).length;
            setCompletedModules(doneCount);
          }
        }
      } catch (e) {
        console.error("Failed to parse progress:", e);
      }
    };

    calculateProgress();
    setMounted(true);

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

  if (!mounted) return <div style={{ backgroundColor: '#020617', width: '100vw', height: '100vh' }}></div>;

  const landingState = Math.min(completedModules + 1, 14);
  const CONTENT = ['s1','s2','s3','s4','s5','s6','s7','s8','s9','s11','s12','s13','s14'];
  const nextModuleId = completedModules < 13 ? CONTENT[completedModules] : 's15';

  const routeToNext = () => {
    window.location.href = `/peptide-101/course#${nextModuleId}`;
  };

  const routeToRoadmap = () => {
    // Scroll down to the roadmap section approximately
    window.scrollTo({
      top: window.innerHeight * 0.45,
      behavior: 'smooth'
    });
  };

  return (
    <div style={{ backgroundColor: '#020617', minHeight: '100vh', display: 'flex', justifyContent: 'center' }}>
      <Head>
        <title>Peptide 101 - Research Academy</title>
      </Head>
      <div style={{ position: 'relative', width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
        <img 
          src={`/images/landing-states/state-${landingState}.png`} 
          alt={`Peptide 101 State ${landingState}`} 
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />

        {/* --- Top Nav Hotspots --- */}
        <div onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} style={{ position: 'absolute', top: '1%', left: '0%', width: '20%', height: '5%', cursor: 'pointer', zIndex: 10 }} title="Overview"></div>
        <div onClick={routeToRoadmap} style={{ position: 'absolute', top: '1%', left: '20%', width: '20%', height: '5%', cursor: 'pointer', zIndex: 10 }} title="Roadmap"></div>
        <div onClick={() => window.location.href='/peptide-101/course#s6'} style={{ position: 'absolute', top: '1%', left: '40%', width: '20%', height: '5%', cursor: 'pointer', zIndex: 10 }} title="Families"></div>
        <div onClick={() => window.location.href='/peptide-101/course#s8'} style={{ position: 'absolute', top: '1%', left: '60%', width: '20%', height: '5%', cursor: 'pointer', zIndex: 10 }} title="Reconstitution"></div>
        <div onClick={() => window.location.href='/peptide-101/course#s15'} style={{ position: 'absolute', top: '1%', left: '80%', width: '20%', height: '5%', cursor: 'pointer', zIndex: 10 }} title="Certificate"></div>

        {/* --- Main CTA Button (Top) --- */}
        <div 
          onClick={routeToNext}
          style={{
            position: 'absolute',
            top: '28%',
            left: '2%',
            width: '58%',
            height: '6%',
            cursor: 'pointer',
            zIndex: 10
          }}
          title={landingState === 1 ? "Start Learning" : "Continue Learning"}
        ></div>

        {/* --- View Roadmap Button --- */}
        <div 
          onClick={routeToRoadmap}
          style={{
            position: 'absolute',
            top: '28%',
            left: '61%',
            width: '37%',
            height: '6%',
            cursor: 'pointer',
            zIndex: 10
          }}
          title="View Roadmap"
        ></div>

        {/* --- Bottom CTA Button --- */}
        <div 
          onClick={routeToNext}
          style={{
            position: 'absolute',
            bottom: '2%',
            left: '3%',
            width: '94%',
            height: '6%',
            cursor: 'pointer',
            zIndex: 10
          }}
          title={landingState === 1 ? "Start Learning" : "Continue To Module"}
        ></div>
      </div>
    </div>
  );
}
