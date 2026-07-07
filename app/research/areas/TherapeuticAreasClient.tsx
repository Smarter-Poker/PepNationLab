'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { RESEARCH_AREAS } from '@/lib/compounds';
import LandingSearchOverlay from '@/components/research/LandingSearchOverlay';


export default function TherapeuticAreasClient() {
  return (
    <div style={{ 
      maxWidth: '1100px', 
      margin: '0 auto', 
      padding: 'var(--space-6, 32px) var(--space-4, 16px)',
      minHeight: '100dvh',
      backgroundColor: '#05070a'
    }}>
      {/* Dynamic Image Header */}
      <header style={{ marginTop: '-110px', marginBottom: '-110px', position: 'relative', width: '100%', borderRadius: '12px', zIndex: 10 }}>
        <Image 
          src="/images/areas_header.png" 
          alt="Therapeutic Areas"
          width={1200}
          height={400}
          unoptimized
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
          hideIcon={true}
          formStyle={{
            top: '68.5%',
            left: '4.5%',
            width: '72%',
            height: '12%',
            backgroundColor: 'transparent',
          }}
          inputStyle={{
            paddingLeft: '47px',
            fontSize: 'clamp(16px, 1.86vw, 21.3px)',
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
          display: flex;
          flex-direction: column;
          text-decoration: none;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        
        .full-image-link:hover {
          transform: translateY(-4px) scale(1.02);
        }
        
        .full-card-image {
          width: 100%;
          height: auto;
          display: block;
          border-radius: 20px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
          transition: box-shadow 0.2s ease;
        }

        .full-image-link:hover .full-card-image {
          box-shadow: 0 16px 32px rgba(0,0,0,0.7);
        }
      `}</style>
      
      <section style={{ position: 'relative', zIndex: 20, marginBottom: '64px', padding: '16px' }}>
        <div className="areas-grid">
          {Object.keys(RESEARCH_AREAS).map((key) => {
            const meta = RESEARCH_AREAS[key];
            return (
              <Link
                key={key}
                href={`/research/area/${key}`}
                className="full-image-link"
              >
                <Image src={`/images/areas/${key}.png`} alt={meta.label} width={400} height={300} unoptimized className="full-card-image" />
                <p style={{ 
                  marginTop: '16px', 
                  color: 'var(--silver, #A8B4C0)', 
                  fontSize: '1.0rem', 
                  textAlign: 'center', 
                  lineHeight: 1.5, 
                  textTransform: 'capitalize',
                  padding: '0 8px'
                }}>
                  {meta.blurb}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '32px' }}>
        <Image 
          src="/images/badges/research_use_pill_transparent.png" 
          alt="Research Use Only - Not For Human Use - Laboratory Research Only" 
          width={800}
          height={150}
          unoptimized
          style={{ maxWidth: '95%', height: 'auto', maxHeight: '150px', objectFit: 'contain' }} 
        />
      </div>
    </div>
  );
}
