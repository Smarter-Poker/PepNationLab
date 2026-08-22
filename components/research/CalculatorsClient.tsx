'use client';

import { useState, useEffect, useRef } from 'react';
import DynamicCalculatorHero from './DynamicCalculatorHero';
import CalculatorSuite from './CalculatorSuite';

const CALC_LABELS: Record<string, string> = {
  reconstitution: 'Reconstitution',
  'shelf-life': 'Shelf Life Tracker',
  dilution: 'Serial Dilution',
  concentration: 'Concentration Converter',
  stability: 'Arrhenius Stability',
  cost: 'Cost Per Dose',
  pooling: 'Vial Pooling',
  'hplc-rt': 'HPLC RT Predictor',
  'mass-spec': 'Mass Spec m/z',
  'spps-cost': 'Fmoc-SPPS Cost',
  solubility: 'Solubility Predictor',
  'vial-quantity': 'Vial Quantity Power',
};

const CALC_IDS = Object.keys(CALC_LABELS);

export default function CalculatorsClient() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [navVisible, setNavVisible] = useState(false);
  const suiteRef = useRef<HTMLDivElement>(null);
  const prevIdRef = useRef<string | null>(null);

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && CALC_IDS.includes(hash)) {
        setActiveId(hash);
      }
    };
    onHashChange();
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Show sticky nav once a calculator is open and user scrolls past the hero
  useEffect(() => {
    if (!activeId) { setNavVisible(false); return; }
    const observer = new IntersectionObserver(
      ([entry]) => setNavVisible(!entry.isIntersecting),
      { rootMargin: '-80px 0px 0px 0px', threshold: 0 }
    );
    // Observe the hero section
    const hero = document.querySelector('.calc-hero-desktop, .calc-hero-mobile');
    if (hero) observer.observe(hero);
    return () => observer.disconnect();
  }, [activeId]);

  const handleSelect = (id: string) => {
    setActiveId(id);
    window.location.hash = id;
    // Trigger fade-in animation by tracking prev
    prevIdRef.current = id;
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  return (
    <>
      {/* Fade-in CSS for calculator transitions */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes calcFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .calc-container > section {
          animation: calcFadeUp 0.28s cubic-bezier(0.22,1,0.36,1) both;
        }

        /* Sticky calculator nav bar */
        .calc-sticky-nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 9000;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 20px;
          background: rgba(8, 10, 18, 0.92);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(0, 229, 255, 0.15);
          box-shadow: 0 4px 24px rgba(0,0,0,0.6);
          transition: transform 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease;
        }
        .calc-sticky-nav.hidden {
          transform: translateY(-100%);
          opacity: 0;
          pointer-events: none;
        }
        .calc-sticky-back {
          display: flex; align-items: center; gap: 6px;
          background: none; border: none; cursor: pointer;
          color: #A8B4C0; font-size: 12px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.06em;
          padding: 0; transition: color 0.15s;
          white-space: nowrap;
        }
        .calc-sticky-back:hover { color: #00E5FF; }
        .calc-sticky-sep { width: 1px; height: 20px; background: rgba(255,255,255,0.12); flex-shrink: 0; }
        .calc-sticky-label {
          color: #fff; font-size: 14px; font-weight: 800;
          letter-spacing: 0.02em; white-space: nowrap; overflow: hidden;
          text-overflow: ellipsis; flex: 1;
        }
        .calc-sticky-pills {
          display: flex; gap: 6px; overflow-x: auto; flex-shrink: 1;
          scrollbar-width: none; -ms-overflow-style: none;
        }
        .calc-sticky-pills::-webkit-scrollbar { display: none; }
        .calc-sticky-pill {
          flex-shrink: 0; padding: 5px 11px; border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          color: #A8B4C0; font-size: 11px; font-weight: 600;
          cursor: pointer; transition: all 0.15s; white-space: nowrap;
        }
        .calc-sticky-pill:hover { border-color: rgba(0,229,255,0.4); color: #00E5FF; }
        .calc-sticky-pill.active {
          border-color: #00E5FF; background: rgba(0,229,255,0.12); color: #00E5FF;
        }
        @media (max-width: 640px) {
          .calc-sticky-pills { display: none; }
          .calc-sticky-label { font-size: 12px; }
        }
      ` }} />

      {/* Sticky Nav Bar */}
      <nav
        aria-label="Calculator navigation"
        className={`calc-sticky-nav${navVisible ? '' : ' hidden'}`}
      >
        <button
          type="button"
          className="calc-sticky-back"
          onClick={() => {
            setActiveId(null);
            setNavVisible(false);
            window.location.hash = '';
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          aria-label="Back to all calculators"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          All Calculators
        </button>
        <div className="calc-sticky-sep" />
        <span className="calc-sticky-label">
          {activeId ? CALC_LABELS[activeId] ?? activeId : ''}
        </span>
        <div className="calc-sticky-pills" role="tablist" aria-label="Switch calculator">
          {CALC_IDS.map(id => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeId === id}
              className={`calc-sticky-pill${activeId === id ? ' active' : ''}`}
              onClick={() => handleSelect(id)}
            >
              {CALC_LABELS[id]}
            </button>
          ))}
        </div>
      </nav>

      <DynamicCalculatorHero onSelect={handleSelect} activeId={activeId} />

      <div ref={suiteRef}>
        <CalculatorSuite activeId={activeId} />
      </div>
    </>
  );
}
