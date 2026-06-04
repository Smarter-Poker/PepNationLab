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
      {/* Dynamic Image Header */}
      <header style={{ marginBottom: '40px', position: 'relative', width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
        <img 
          src="/images/areas_header.png" 
          alt="Therapeutic Areas" 
          style={{ width: '100%', display: 'block' }} 
        />

        {/* Hotspot: About Therapeutic Areas */}
        <Link 
          href="/research/about-areas" 
          style={{
            position: 'absolute',
            top: '20%',
            left: '60%',
            width: '38%',
            height: '30%',
            zIndex: 10,
          }}
          aria-label="About Therapeutic Areas"
        />

        {/* Hotspot: Universal Search Integration */}
        <LandingSearchOverlay 
          formStyle={{
            top: '68.5%',
            left: '4.5%',
            width: '72%',
            height: '12%',
            backgroundColor: 'transparent',
          }}
          buttonStyle={{
            top: '68.5%',
            left: '79%',
            width: '14%',
            height: '12%',
            backgroundColor: 'transparent',
          }}
          resultsStyle={{
            top: '82%',
            left: '4.5%',
            width: '72%',
          }}
        />
      </header>

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
        
        /* Full Image Card Link */
        .full-image-link {
          display: block;
          text-decoration: none;
          transition: all 0.2s ease;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
          aspect-ratio: 1 / 1;
        }
        
        .full-image-link:hover {
          transform: translateY(-4px) scale(1.02);
          box-shadow: 0 16px 32px rgba(0,0,0,0.7);
        }
        
        .full-card-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
      `}</style>
      
      <section style={{ marginBottom: '64px', padding: '16px' }}>
        <div className="areas-grid">
          {Object.keys(RESEARCH_AREAS).map((key) => {
            const meta = RESEARCH_AREAS[key];
            return (
              <Link
                key={key}
                href={`/research/area/${key}`}
                className="full-image-link"
              >
                <img src={`/images/areas/${key}.png`} alt={meta.label} className="full-card-image" />
              </Link>
            );
          })}
        </div>
      </section>

      <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '32px' }}>
        <img 
          src="/images/badges/research_use_pill_transparent.png" 
          alt="Research Use Only - Not For Human Use - Laboratory Research Only" 
          style={{ maxWidth: '95%', height: 'auto', maxHeight: '150px' }} 
        />
      </div>
    </div>
  );
}
