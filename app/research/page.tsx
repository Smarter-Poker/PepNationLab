'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { vibrateLight, initHaptics } from '@/lib/messenger/haptics';
import LandingSearchOverlay from '@/components/research/LandingSearchOverlay';
import { 
  FlaskConical, Share2, BookOpen, Scale, Layers, ChevronRight,
  ShieldPlus, HeartPulse, Zap, Sparkles, Brain, Activity, Heart, Moon, Shield, Hourglass, Dna, Flame, ShieldCheck
} from 'lucide-react';

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
      backgroundColor: '#050a11', // Very dark blue/black matching the image background
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minHeight: '100vh',
      padding: 'var(--space-6, 32px) var(--space-4, 16px)',
      fontFamily: 'var(--font-inter), sans-serif',
      backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(20, 35, 60, 0.4) 0%, transparent 70%)'
    }}>
      <style>{`
        .silver-text {
          background: linear-gradient(180deg, #FFFFFF 0%, #A0B0C0 50%, #708090 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0px 4px 8px rgba(160, 176, 192, 0.3));
        }
        .silver-icon {
          color: #E2E8F0;
          filter: drop-shadow(0px 0px 8px rgba(226, 232, 240, 0.5));
        }
        .silver-border {
          border: 1px solid rgba(160, 176, 192, 0.4);
        }
        .research-card {
          background: linear-gradient(180deg, #0d1522 0%, #080d15 100%);
          border: 1px solid rgba(160, 176, 192, 0.3);
          border-radius: 12px;
          padding: 24px;
          text-decoration: none;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          position: relative;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 0 20px rgba(160,176,192,0.05);
        }
        .research-card:hover {
          transform: translateY(-4px) scale(1.01);
          border-color: rgba(160, 176, 192, 0.6);
          box-shadow: 0 16px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 0 30px rgba(160,176,192,0.1);
        }
        .research-card:active {
          transform: translateY(0) scale(0.98);
        }
        .icon-circle {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: radial-gradient(circle at 50% 50%, #1a2639 0%, #0a101a 100%);
          border: 1px solid rgba(160, 176, 192, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 0px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.6), inset 0 0 15px rgba(255,255,255,0.1);
          flex-shrink: 0;
        }
        .search-container {
          background: linear-gradient(180deg, #0a101a 0%, #05080d 100%);
          border: 1px solid rgba(160, 176, 192, 0.4);
          border-radius: 16px;
          padding: 24px;
          width: 100%;
          max-width: 900px;
          margin-bottom: 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          box-shadow: 0 12px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1);
        }
        .search-input-wrapper {
          position: relative;
          width: 100%;
          height: 52px;
          margin-top: 16px;
          border-radius: 8px;
          border: 1px solid rgba(160, 176, 192, 0.3);
          background: #030508;
          box-shadow: inset 0 2px 10px rgba(0,0,0,0.8);
        }
        .grid-container {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          width: 100%;
          max-width: 900px;
          margin-bottom: 32px;
        }
        
        .quick-access-header {
          display: flex;
          align-items: center;
          width: 100%;
          max-width: 900px;
          margin: 16px 0 24px 0;
          color: #A0B0C0;
          font-weight: 700;
          letter-spacing: 0.15em;
          font-size: 0.9rem;
        }
        .quick-access-line {
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(160, 176, 192, 0.5), transparent);
          box-shadow: 0 0 8px rgba(160, 176, 192, 0.5);
        }
        .quick-access-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background-color: #E2E8F0;
          box-shadow: 0 0 6px #E2E8F0;
        }

        .qa-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 12px;
          width: 100%;
          max-width: 900px;
        }
        .qa-card {
          background: linear-gradient(180deg, #0d1522 0%, #080d15 100%);
          border: 1px solid rgba(160, 176, 192, 0.25);
          border-radius: 12px;
          padding: 16px 8px;
          text-decoration: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 12px;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
        }
        .qa-card:hover {
          transform: translateY(-2px);
          border-color: rgba(160, 176, 192, 0.5);
          box-shadow: 0 8px 16px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 0 15px rgba(160,176,192,0.1);
        }
        .qa-icon-circle {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: radial-gradient(circle at 50% 50%, #1a2639 0%, #0a101a 100%);
          border: 1px solid rgba(160, 176, 192, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.5), inset 0 0 10px rgba(255,255,255,0.1);
        }

        @media (max-width: 768px) {
          .grid-container {
            grid-template-columns: 1fr;
          }
          .qa-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media (max-width: 480px) {
          .qa-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>

      <div style={{ textAlign: 'center', marginBottom: '24px', marginTop: '12px' }}>
        <h1 className="silver-text" style={{ 
          fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', 
          fontWeight: 900, 
          letterSpacing: '0.05em',
          margin: '0 0 8px 0',
          textTransform: 'uppercase'
        }}>
          RESEARCH LIBRARY
        </h1>
        <p style={{ 
          color: '#A0B0C0', 
          fontSize: 'clamp(0.9rem, 1.2vw, 1.1rem)', 
          maxWidth: '700px', 
          margin: '0 auto',
          lineHeight: 1.5,
          fontWeight: 400
        }}>
          Your All-In-One Research Center For Compounds, Mechanisms, And Laboratory Insights.
        </p>
      </div>

      <div className="search-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <FlaskConical className="silver-icon" size={28} strokeWidth={2} />
          <h2 className="silver-text" style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, letterSpacing: '0.08em' }}>
            ASK THE LAB
          </h2>
        </div>
        <p style={{ color: '#A0B0C0', fontSize: '0.9rem', margin: 0, textAlign: 'center' }}>
          Search For Key Words, Categories, Phrases, Compounds, Mechanisms, Targets, Pathways, Stacks And More...
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
              top: '4px',
              right: '4px',
              left: 'auto',
              bottom: '4px',
              width: '100px',
              height: 'auto',
              borderRadius: '6px',
              background: 'linear-gradient(180deg, #E2E8F0 0%, #94A3B8 100%)',
              color: '#0f172a',
              fontWeight: 800,
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              transition: 'filter 0.2s',
              border: '1px solid #FFFFFF'
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '8px' }}>
            <div className="icon-circle">
              <Share2 className="silver-icon" size={32} strokeWidth={1.5} />
            </div>
            <h3 style={{ margin: 0, color: '#F1F5F9', fontSize: '1.6rem', fontWeight: 700, lineHeight: 1.2 }}>
              Therapeutic<br/>Areas
            </h3>
          </div>
          <p style={{ margin: '8px 0 0 84px', color: '#A0B0C0', fontSize: '0.9rem', lineHeight: 1.5, paddingRight: '24px' }}>
            Explore Compounds By Research And Therapeutic Focus Areas.
          </p>
          <div style={{ position: 'absolute', bottom: '24px', right: '24px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid rgba(160, 176, 192, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronRight className="silver-icon" size={16} />
            </div>
          </div>
        </Link>

        <Link href="/research/catalog" className="research-card" onPointerDown={() => vibrateLight()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '8px' }}>
            <div className="icon-circle">
              <BookOpen className="silver-icon" size={32} strokeWidth={1.5} />
            </div>
            <h3 style={{ margin: 0, color: '#F1F5F9', fontSize: '1.6rem', fontWeight: 700, lineHeight: 1.2 }}>
              Browse<br/>Catalog
            </h3>
          </div>
          <p style={{ margin: '8px 0 0 84px', color: '#A0B0C0', fontSize: '0.9rem', lineHeight: 1.5, paddingRight: '24px' }}>
            View And Filter The Full Catalog Of Research Compounds.
          </p>
          <div style={{ position: 'absolute', bottom: '24px', right: '24px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid rgba(160, 176, 192, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronRight className="silver-icon" size={16} />
            </div>
          </div>
        </Link>

        <Link href="/research/compare" className="research-card" onPointerDown={() => vibrateLight()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '8px' }}>
            <div className="icon-circle">
              <Scale className="silver-icon" size={32} strokeWidth={1.5} />
            </div>
            <h3 style={{ margin: 0, color: '#F1F5F9', fontSize: '1.6rem', fontWeight: 700, lineHeight: 1.2 }}>
              Compare<br/>Compounds
            </h3>
          </div>
          <p style={{ margin: '8px 0 0 84px', color: '#A0B0C0', fontSize: '0.9rem', lineHeight: 1.5, paddingRight: '24px' }}>
            Compare Compounds Side-By-Side With Key Research Data.
          </p>
          <div style={{ position: 'absolute', bottom: '24px', right: '24px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid rgba(160, 176, 192, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronRight className="silver-icon" size={16} />
            </div>
          </div>
        </Link>

        <Link href="/research/stacks" className="research-card" onPointerDown={() => vibrateLight()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '8px' }}>
            <div className="icon-circle">
              <Layers className="silver-icon" size={32} strokeWidth={1.5} />
            </div>
            <h3 style={{ margin: 0, color: '#F1F5F9', fontSize: '1.6rem', fontWeight: 700, lineHeight: 1.2 }}>
              Stacks &<br/>Combinations
            </h3>
          </div>
          <p style={{ margin: '8px 0 0 84px', color: '#A0B0C0', fontSize: '0.9rem', lineHeight: 1.5, paddingRight: '24px' }}>
            Explore Synergistic Stacks And Proven Compound Combinations.
          </p>
          <div style={{ position: 'absolute', bottom: '24px', right: '24px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid rgba(160, 176, 192, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronRight className="silver-icon" size={16} />
            </div>
          </div>
        </Link>
      </div>

      <div className="quick-access-header">
        <div className="quick-access-dot" style={{ marginRight: '8px' }}></div>
        <div className="quick-access-line"></div>
        <span style={{ margin: '0 16px' }}>QUICK ACCESS</span>
        <div className="quick-access-line"></div>
        <div className="quick-access-dot" style={{ marginLeft: '8px' }}></div>
      </div>

      <div className="qa-grid">
        <Link href="/research/area/weight_management" className="qa-card" onPointerDown={() => vibrateLight()}>
          <div className="qa-icon-circle"><Scale className="silver-icon" size={24} /></div>
          <span style={{ color: '#E2E8F0', fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.2 }}>Weight<br/>Management</span>
        </Link>
        <Link href="/research/area/tissue_repair" className="qa-card" onPointerDown={() => vibrateLight()}>
          <div className="qa-icon-circle"><ShieldPlus className="silver-icon" size={24} /></div>
          <span style={{ color: '#E2E8F0', fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.2 }}>Tissue<br/>Repair</span>
        </Link>
        <Link href="/research/area/healing" className="qa-card" onPointerDown={() => vibrateLight()}>
          <div className="qa-icon-circle"><HeartPulse className="silver-icon" size={24} /></div>
          <span style={{ color: '#E2E8F0', fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.2 }}>Healing &<br/>Recovery</span>
        </Link>
        <Link href="/research/area/performance" className="qa-card" onPointerDown={() => vibrateLight()}>
          <div className="qa-icon-circle"><Zap className="silver-icon" size={24} /></div>
          <span style={{ color: '#E2E8F0', fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.2 }}>Performance</span>
        </Link>
        <Link href="/research/area/skin_hair" className="qa-card" onPointerDown={() => vibrateLight()}>
          <div className="qa-icon-circle"><Sparkles className="silver-icon" size={24} /></div>
          <span style={{ color: '#E2E8F0', fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.2 }}>Skin &<br/>Hair</span>
        </Link>
        
        <Link href="/research/area/cognitive" className="qa-card" onPointerDown={() => vibrateLight()}>
          <div className="qa-icon-circle"><Brain className="silver-icon" size={24} /></div>
          <span style={{ color: '#E2E8F0', fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.2 }}>Cognitive</span>
        </Link>
        <Link href="/research/area/pain_inflammation" className="qa-card" onPointerDown={() => vibrateLight()}>
          <div className="qa-icon-circle"><Activity className="silver-icon" size={24} /></div>
          <span style={{ color: '#E2E8F0', fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.2 }}>Pain &<br/>Inflammation</span>
        </Link>
        <Link href="/research/area/gut_health" className="qa-card" onPointerDown={() => vibrateLight()}>
          <div className="qa-icon-circle"><Activity className="silver-icon" size={24} /></div>
          <span style={{ color: '#E2E8F0', fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.2 }}>Gut Health</span>
        </Link>
        <Link href="/research/area/sexual_health" className="qa-card" onPointerDown={() => vibrateLight()}>
          <div className="qa-icon-circle"><Heart className="silver-icon" size={24} /></div>
          <span style={{ color: '#E2E8F0', fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.2 }}>Sexual<br/>Health</span>
        </Link>
        <Link href="/research/area/sleep" className="qa-card" onPointerDown={() => vibrateLight()}>
          <div className="qa-icon-circle"><Moon className="silver-icon" size={24} /></div>
          <span style={{ color: '#E2E8F0', fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.2 }}>Sleep</span>
        </Link>

        <Link href="/research/area/immune" className="qa-card" onPointerDown={() => vibrateLight()}>
          <div className="qa-icon-circle"><ShieldCheck className="silver-icon" size={24} /></div>
          <span style={{ color: '#E2E8F0', fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.2 }}>Immune</span>
        </Link>
        <Link href="/research/area/longevity" className="qa-card" onPointerDown={() => vibrateLight()}>
          <div className="qa-icon-circle"><Hourglass className="silver-icon" size={24} /></div>
          <span style={{ color: '#E2E8F0', fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.2 }}>Longevity</span>
        </Link>
        <Link href="/research/area/mitochondrial" className="qa-card" onPointerDown={() => vibrateLight()}>
          <div className="qa-icon-circle"><Dna className="silver-icon" size={24} /></div>
          <span style={{ color: '#E2E8F0', fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.2 }}>Mitochondrial</span>
        </Link>
        <Link href="/research/area/metabolic" className="qa-card" onPointerDown={() => vibrateLight()}>
          <div className="qa-icon-circle"><Flame className="silver-icon" size={24} /></div>
          <span style={{ color: '#E2E8F0', fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.2 }}>Metabolic</span>
        </Link>
        <Link href="/research/area/joint_bone_health" className="qa-card" onPointerDown={() => vibrateLight()}>
          <div className="qa-icon-circle"><Activity className="silver-icon" size={24} /></div>
          <span style={{ color: '#E2E8F0', fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.2 }}>Joint &<br/>Bone Health</span>
        </Link>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '48px', paddingBottom: '32px', width: '100%', maxWidth: '900px' }}>
        <div style={{
          background: 'linear-gradient(180deg, #0d1522 0%, #080d15 100%)',
          border: '1px solid rgba(160, 176, 192, 0.4)',
          borderRadius: '24px',
          padding: '12px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)'
        }}>
          <Shield className="silver-icon" size={20} />
          <div style={{ color: '#A0B0C0', fontSize: '0.85rem', display: 'flex', gap: '16px', fontWeight: 500 }}>
            <span>Research Use Only</span>
            <span style={{ color: '#E2E8F0' }}>•</span>
            <span>Not For Human Use</span>
            <span style={{ color: '#E2E8F0' }}>•</span>
            <span>Laboratory Research Only</span>
          </div>
        </div>
      </div>
    </div>
  );
}
