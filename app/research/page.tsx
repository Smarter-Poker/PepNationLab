'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { vibrateLight, initHaptics } from '@/lib/messenger/haptics';
import LandingSearchOverlay from '@/components/research/LandingSearchOverlay';
import { FlaskConical, Share2, BookOpen, Scale, Layers, ChevronRight } from 'lucide-react';

export default function ResearchLandingPage() {
  // Initialize haptics on first touch/click
  useEffect(() => {
    const handleInit = () => initHaptics();
    window.addEventListener('pointerdown', handleInit, { once: true });
    return () => window.removeEventListener('pointerdown', handleInit);
  }, []);

  return (
    <div style={{
      width: '100%',
      backgroundColor: '#070a0e', // Deep dark blue/black background
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minHeight: '100vh',
      padding: 'var(--space-6, 32px) var(--space-4, 16px)',
      fontFamily: 'var(--font-inter), sans-serif'
    }}>
      <style>{`
        .gold-text {
          background: linear-gradient(180deg, #F3E5C8 0%, #C4A478 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0px 4px 12px rgba(196, 164, 120, 0.25));
        }
        .gold-icon {
          color: #D4BFA0;
          filter: drop-shadow(0px 2px 4px rgba(196, 164, 120, 0.2));
        }
        .gold-border {
          border: 1px solid rgba(196, 164, 120, 0.3);
        }
        .research-card {
          background: linear-gradient(180deg, #0f1620 0%, #0a0e14 100%);
          border: 1px solid rgba(196, 164, 120, 0.25);
          border-radius: 16px;
          padding: 24px;
          text-decoration: none;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          position: relative;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03);
        }
        .research-card:hover {
          transform: translateY(-4px) scale(1.01);
          border-color: rgba(196, 164, 120, 0.5);
          box-shadow: 0 16px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05);
        }
        .research-card:active {
          transform: translateY(0) scale(0.98);
        }
        .icon-circle {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(180deg, #182230 0%, #0e141c 100%);
          border: 1px solid rgba(196, 164, 120, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.03);
          flex-shrink: 0;
        }
        .search-container {
          background: linear-gradient(180deg, #0d131b 0%, #080c11 100%);
          border: 1px solid rgba(196, 164, 120, 0.4);
          border-radius: 20px;
          padding: 32px 24px;
          width: 100%;
          max-width: 900px;
          margin-bottom: 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          box-shadow: 0 12px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03);
        }
        .search-input-wrapper {
          position: relative;
          width: 100%;
          height: 56px;
          margin-top: 24px;
          border-radius: 12px;
          border: 1px solid rgba(196, 164, 120, 0.2);
          background: #05070a;
          box-shadow: inset 0 2px 8px rgba(0,0,0,0.6);
        }
        .grid-container {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
          width: 100%;
          max-width: 900px;
        }
        @media (max-width: 768px) {
          .grid-container {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div style={{ textAlign: 'center', marginBottom: '32px', marginTop: '20px' }}>
        <h1 className="gold-text" style={{ 
          fontSize: 'clamp(2.5rem, 5vw, 4rem)', 
          fontWeight: 900, 
          letterSpacing: '0.08em',
          margin: '0 0 16px 0',
          textTransform: 'uppercase'
        }}>
          Research Library
        </h1>
        <p style={{ 
          color: '#A8B4C0', 
          fontSize: 'clamp(1rem, 1.5vw, 1.15rem)', 
          maxWidth: '650px', 
          margin: '0 auto',
          lineHeight: 1.5,
          fontWeight: 500
        }}>
          Your All-In-One Research Center For Compounds, Mechanisms, And Laboratory Insights.
        </p>
      </div>

      <div className="search-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <FlaskConical className="gold-icon" size={28} strokeWidth={2} />
          <h2 className="gold-text" style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, letterSpacing: '0.08em' }}>
            ASK THE LAB
          </h2>
        </div>
        <p style={{ color: '#8A9BA8', fontSize: '0.95rem', margin: 0, textAlign: 'center' }}>
          Search Compounds, Mechanisms, Targets, Pathways, Stacks, And More.
        </p>
        
        <div className="search-input-wrapper">
          <LandingSearchOverlay 
            placeholder="Ask Us Anything..."
            formStyle={{
              position: 'relative',
              top: 0, left: 0, width: '100%', height: '100%',
              backgroundColor: 'transparent',
              paddingRight: '120px', // Space for the search button
              zIndex: 20
            }}
            inputStyle={{
              fontSize: '1rem',
              color: '#ffffff',
            }}
            buttonStyle={{
              position: 'absolute',
              top: '6px',
              right: '6px',
              left: 'auto',
              bottom: '6px',
              width: '100px',
              height: 'auto',
              borderRadius: '8px',
              background: 'linear-gradient(180deg, #D4BFA0 0%, #A88B63 100%)',
              color: '#1A1105',
              fontWeight: 800,
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              transition: 'filter 0.2s',
            }}
            buttonContent={<span>Search</span>}
            resultsStyle={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              width: '100%',
              maxHeight: '400px',
            }}
          />
        </div>
      </div>

      <div className="grid-container">
        <Link href="/research/areas" className="research-card" onPointerDown={() => vibrateLight()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '16px' }}>
            <div className="icon-circle">
              <Share2 className="gold-icon" size={26} strokeWidth={1.5} />
            </div>
            <h3 style={{ margin: 0, color: '#D4BFA0', fontSize: '1.4rem', fontWeight: 700, lineHeight: 1.2 }}>
              Therapeutic<br/>Areas
            </h3>
          </div>
          <p style={{ margin: 0, color: '#8A9BA8', fontSize: '0.95rem', lineHeight: 1.5, paddingRight: '24px' }}>
            Explore Compounds By Research And Therapeutic Focus Areas.
          </p>
          <div style={{ position: 'absolute', bottom: '24px', right: '24px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid rgba(196, 164, 120, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronRight className="gold-icon" size={16} />
            </div>
          </div>
        </Link>

        <Link href="/research/catalog" className="research-card" onPointerDown={() => vibrateLight()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '16px' }}>
            <div className="icon-circle">
              <BookOpen className="gold-icon" size={26} strokeWidth={1.5} />
            </div>
            <h3 style={{ margin: 0, color: '#D4BFA0', fontSize: '1.4rem', fontWeight: 700, lineHeight: 1.2 }}>
              Browse<br/>Catalog
            </h3>
          </div>
          <p style={{ margin: 0, color: '#8A9BA8', fontSize: '0.95rem', lineHeight: 1.5, paddingRight: '24px' }}>
            View And Filter The Full Catalog Of Research Compounds.
          </p>
          <div style={{ position: 'absolute', bottom: '24px', right: '24px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid rgba(196, 164, 120, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronRight className="gold-icon" size={16} />
            </div>
          </div>
        </Link>

        <Link href="/research/compare" className="research-card" onPointerDown={() => vibrateLight()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '16px' }}>
            <div className="icon-circle">
              <Scale className="gold-icon" size={26} strokeWidth={1.5} />
            </div>
            <h3 style={{ margin: 0, color: '#D4BFA0', fontSize: '1.4rem', fontWeight: 700, lineHeight: 1.2 }}>
              Compare<br/>Compounds
            </h3>
          </div>
          <p style={{ margin: 0, color: '#8A9BA8', fontSize: '0.95rem', lineHeight: 1.5, paddingRight: '24px' }}>
            Compare Compounds Side-By-Side With Key Research Data.
          </p>
          <div style={{ position: 'absolute', bottom: '24px', right: '24px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid rgba(196, 164, 120, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronRight className="gold-icon" size={16} />
            </div>
          </div>
        </Link>

        <Link href="/research/stacks" className="research-card" onPointerDown={() => vibrateLight()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '16px' }}>
            <div className="icon-circle">
              <Layers className="gold-icon" size={26} strokeWidth={1.5} />
            </div>
            <h3 style={{ margin: 0, color: '#D4BFA0', fontSize: '1.4rem', fontWeight: 700, lineHeight: 1.2 }}>
              Stacks &<br/>Combinations
            </h3>
          </div>
          <p style={{ margin: 0, color: '#8A9BA8', fontSize: '0.95rem', lineHeight: 1.5, paddingRight: '24px' }}>
            Explore Synergistic Stacks And Proven Compound Combinations.
          </p>
          <div style={{ position: 'absolute', bottom: '24px', right: '24px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid rgba(196, 164, 120, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronRight className="gold-icon" size={16} />
            </div>
          </div>
        </Link>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '64px', paddingBottom: '32px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src="/images/badges/research_use_pill_transparent.png" 
          alt="Research Use Only - Not For Human Use - Laboratory Research Only" 
          style={{ maxWidth: '95%', height: 'auto', maxHeight: '150px' }} 
        />
      </div>
    </div>
  );
}
