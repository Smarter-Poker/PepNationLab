'use client';

import React from 'react';
import Link from 'next/link';
import { RESEARCH_AREAS } from '@/lib/compounds';
import { ShieldCheck, ChevronRight, Activity, HeartPulse, Flame, Infinity, Sparkles, Brain, Shield, Target, Sun, Bone, Users, PersonStanding, Moon, Dna, Search } from 'lucide-react';
import LandingSearchOverlay from '@/components/research/LandingSearchOverlay';

const ICON_MAP: Record<string, React.ReactNode> = {
  tissue_repair: <Dna size={26} strokeWidth={1.5} />,
  healing: <HeartPulse size={26} strokeWidth={1.5} />,
  metabolic: <Flame size={26} strokeWidth={1.5} />,
  weight_management: <Infinity size={26} strokeWidth={1.5} />,
  longevity: <Infinity size={26} strokeWidth={1.5} />,
  cosmetic: <Sparkles size={26} strokeWidth={1.5} />,
  cognitive: <Brain size={26} strokeWidth={1.5} />,
  immune: <Shield size={26} strokeWidth={1.5} />,
  gut_health: <Target size={26} strokeWidth={1.5} />,
  pain_inflammation: <Sun size={26} strokeWidth={1.5} />,
  bone_joint: <Bone size={26} strokeWidth={1.5} />,
  sexual_health: <Users size={26} strokeWidth={1.5} />,
  performance: <PersonStanding size={26} strokeWidth={1.5} />,
  sleep: <Moon size={26} strokeWidth={1.5} />,
  mitochondrial: <Activity size={26} strokeWidth={1.5} />,
};

function toTitleCase(str: string) {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

export default function TherapeuticAreasPage() {
  return (
    <div style={{ 
      maxWidth: '1100px', 
      margin: '0 auto', 
      padding: 'var(--space-6, 32px) var(--space-4, 16px)',
      minHeight: '100vh',
      backgroundColor: '#05070a'
    }}>
      {/* Header Section matching the image */}
      <header style={{ marginBottom: '32px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00C4BC', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.05em', marginBottom: '16px' }}>
          <span>RESEARCH LIBRARY</span>
          <ChevronRight size={12} />
          <span style={{ color: '#A8B4C0' }}>THERAPEUTIC AREAS</span>
        </div>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px' }}>
          <div style={{ flex: '1 1 500px' }}>
            <h1
              style={{
                fontSize: '2.5rem',
                fontWeight: 900,
                color: 'var(--white, #FFFFFF)',
                margin: '0 0 16px 0',
                letterSpacing: '-0.02em'
              }}
            >
              Therapeutic Areas
            </h1>
            <p
              style={{
                color: 'var(--silver, #A8B4C0)',
                fontSize: '1.05rem',
                margin: 0,
                maxWidth: '540px',
                lineHeight: 1.5,
              }}
            >
              Explore Research Compounds By Focus Area. Each Category Contains Compounds Studied For Specific Physiological Systems And Therapeutic Applications.
            </p>
          </div>

          <Link href="/research/about-areas" style={{ textDecoration: 'none' }}>
            <div className="slate-card" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '20px 24px',
              borderRadius: '16px',
              maxWidth: '340px',
            }}>
              <div style={{ color: '#00C4BC' }}>
                <Activity size={32} />
              </div>
              <div>
                <h3 style={{ color: '#FFFFFF', margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: 700 }}>About Therapeutic Areas</h3>
                <p style={{ color: '#A8B4C0', margin: 0, fontSize: '0.85rem', lineHeight: 1.4 }}>
                  Therapeutic Areas Help You Discover Compounds By Biological Focus And Research Application.
                </p>
              </div>
              <ChevronRight size={20} color="#A8B4C0" style={{ flexShrink: 0, marginLeft: '8px' }} />
            </div>
          </Link>
        </div>
      </header>

      {/* Universal Search Integration */}
      <div style={{ position: 'relative', marginBottom: '40px', zIndex: 50 }}>
        <div className="slate-card" style={{
          padding: '24px',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00C4BC', fontWeight: 700 }}>
            <Sparkles size={18} />
            <span>Search For Anything Related To Therapeutic Areas</span>
          </div>
          <div style={{ position: 'relative', height: '52px' }}>
            {/* The LandingSearchOverlay relies on absolute positioning inside a relative container. We provide standard positioning. */}
            <LandingSearchOverlay 
              formStyle={{
                top: 0,
                left: 0,
                width: 'calc(100% - 130px)',
                height: '100%',
                backgroundColor: '#0a0e14',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '8px',
              }}
              buttonStyle={{
                top: 0,
                right: 0,
                left: 'auto',
                width: '120px',
                height: '100%',
                backgroundColor: '#e6d3ba', // metallic gold/beige accent for Ask button
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#1a1e24',
                fontWeight: 800,
                fontSize: '1.05rem',
                border: 'none',
              }}
              resultsStyle={{
                top: 'calc(100% + 8px)',
                left: 0,
                width: '100%',
              }}
            />
            {/* Custom "Ask" text over the invisible button area */}
            <div style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '120px',
              height: '100%',
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              color: '#1a1e24',
              fontWeight: 800,
              zIndex: 25,
            }}>
              <Search size={18} strokeWidth={2.5} /> Ask
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .areas-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          grid-auto-rows: 1fr;
          gap: 20px;
        }
        @media (max-width: 900px) {
          .areas-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 600px) {
          .areas-grid {
            grid-template-columns: 1fr;
            grid-auto-rows: auto;
          }
        }
        
        /* Dark Slate Card mimicking the image */
        .slate-card {
          background: #1c1f26; /* Deep slate blue/grey */
          border: 1px solid rgba(255, 255, 255, 0.04);
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          position: relative;
          overflow: hidden;
          transition: all 0.2s ease;
        }
        
        .slate-card:hover {
          background: #20242c;
          border-color: rgba(255, 255, 255, 0.08);
          box-shadow: 0 6px 24px rgba(0,0,0,0.4);
        }

        .area-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 12px;
          padding: 32px 24px;
          border-radius: 12px;
          text-decoration: none;
          height: 100%;
        }
        
        .icon-circle {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: #0d1219;
          border: 1px solid rgba(0, 196, 188, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 8px;
          color: #00C4BC;
          box-shadow: 
            inset 0 0 15px rgba(0, 196, 188, 0.1), 
            0 0 20px rgba(0, 196, 188, 0.05);
          transition: all 0.3s ease;
        }
        
        .area-card:hover .icon-circle {
          box-shadow: 
            inset 0 0 20px rgba(0, 196, 188, 0.2), 
            0 0 30px rgba(0, 196, 188, 0.1);
          transform: scale(1.05);
        }
      `}</style>
      
      <section style={{ marginBottom: '64px' }}>
        <div className="areas-grid">
          {Object.keys(RESEARCH_AREAS).map((key) => {
            const meta = RESEARCH_AREAS[key];
            return (
              <Link
                key={key}
                href={`/research/area/${key}`}
                className="slate-card area-card"
              >
                <div className="icon-circle">
                  {ICON_MAP[key] || <Activity size={26} strokeWidth={1.5} />}
                </div>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '0.01em' }}>
                  {toTitleCase(meta.label)}
                </span>
                <span style={{ fontSize: '0.85rem', color: '#8b96a5', lineHeight: 1.5, padding: '0 4px' }}>
                  {toTitleCase(meta.blurb)}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '32px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(187, 163, 113, 0.3)',
          borderRadius: '999px',
          padding: '12px 24px',
        }}>
          <ShieldCheck size={18} color="#BBA371" />
          <span style={{ color: '#A8B4C0', fontSize: '0.9rem', letterSpacing: '0.02em' }}>
            Research Use Only <span style={{ color: '#BBA371', margin: '0 8px' }}>•</span> Not For Human Use <span style={{ color: '#BBA371', margin: '0 8px' }}>•</span> Laboratory Research Only
          </span>
        </div>
      </div>
    </div>
  );
}
