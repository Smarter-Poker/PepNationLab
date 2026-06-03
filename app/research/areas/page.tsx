'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { vibrateLight, initHaptics } from '@/lib/messenger/haptics';
import LandingSearchOverlay from '@/components/research/LandingSearchOverlay';

function HotspotLink({ href, style }: { href: string; style: React.CSSProperties }) {
  return (
    <Link
      href={href}
      className="hotspot"
      onPointerDown={() => vibrateLight()}
      style={{
        ...style,
        position: 'absolute',
        cursor: 'pointer',
      }}
    />
  );
}

export default function TherapeuticAreasPage() {
  // Initialize haptics on first touch/click
  useEffect(() => {
    const handleInit = () => initHaptics();
    window.addEventListener('pointerdown', handleInit, { once: true });
    return () => window.removeEventListener('pointerdown', handleInit);
  }, []);

  return (
    <div style={{
      width: '100%',
      backgroundColor: '#05070a',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      minHeight: '100vh',
    }}>
      <style>{`
        .hotspot {
          transition: background-color 0.2s ease, transform 0.1s ease;
          border-radius: 12px;
        }
        .hotspot:hover {
          background-color: rgba(255, 255, 255, 0.06);
        }
        .hotspot:active {
          background-color: rgba(255, 255, 255, 0.1);
          transform: scale(0.98);
        }
      `}</style>

      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '800px',
        aspectRatio: '576 / 1024',
      }}>
        {/* The Base Image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/research/areas-landing-bg.png"
          alt="Therapeutic Areas Library"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />

        {/* About Therapeutic Areas */}
        <HotspotLink href="/research/about-areas" style={{ top: '2.7%', left: '57.8%', width: '38.2%', height: '10.5%' }} />

        {/* 1 + 2. Live in-place universal search (input + button + instant results) */}
        <LandingSearchOverlay 
          formStyle={{
            top: '19.1%',
            left: '5.9%',
            width: '74.0%',
            height: '3.7%',
          }}
          buttonStyle={{
            top: '19.1%',
            left: '81.6%',
            width: '12.1%',
            height: '3.7%',
          }}
          resultsStyle={{
            top: '23.6%',
            left: '5.9%',
            width: '87.8%',
          }}
        />

        {/* 3. Grid of 15 Cards */}
        {/* Row 1 */}
        <HotspotLink href="/research/area/tissue_repair" style={{ top: '25.4%', left: '3.8%', width: '28.8%', height: '13.5%' }} />
        <HotspotLink href="/research/area/healing" style={{ top: '25.4%', left: '35.1%', width: '28.8%', height: '13.5%' }} />
        <HotspotLink href="/research/area/metabolic" style={{ top: '25.4%', left: '66.3%', width: '28.8%', height: '13.5%' }} />

        {/* Row 2 */}
        <HotspotLink href="/research/area/weight_management" style={{ top: '40.2%', left: '3.8%', width: '28.8%', height: '13.5%' }} />
        <HotspotLink href="/research/area/longevity" style={{ top: '40.2%', left: '35.1%', width: '28.8%', height: '13.5%' }} />
        <HotspotLink href="/research/area/cosmetic" style={{ top: '40.2%', left: '66.3%', width: '28.8%', height: '13.5%' }} />

        {/* Row 3 */}
        <HotspotLink href="/research/area/cognitive" style={{ top: '55.1%', left: '3.8%', width: '28.8%', height: '13.5%' }} />
        <HotspotLink href="/research/area/immune" style={{ top: '55.1%', left: '35.1%', width: '28.8%', height: '13.5%' }} />
        <HotspotLink href="/research/area/gut_health" style={{ top: '55.1%', left: '66.3%', width: '28.8%', height: '13.5%' }} />

        {/* Row 4 */}
        <HotspotLink href="/research/area/pain_inflammation" style={{ top: '69.9%', left: '3.8%', width: '28.8%', height: '13.5%' }} />
        <HotspotLink href="/research/area/bone_joint" style={{ top: '69.9%', left: '35.1%', width: '28.8%', height: '13.5%' }} />
        <HotspotLink href="/research/area/sexual_health" style={{ top: '69.9%', left: '66.3%', width: '28.8%', height: '13.5%' }} />

        {/* Row 5 */}
        <HotspotLink href="/research/area/performance" style={{ top: '84.8%', left: '3.8%', width: '28.8%', height: '13.5%' }} />
        <HotspotLink href="/research/area/sleep" style={{ top: '84.8%', left: '35.1%', width: '28.8%', height: '13.5%' }} />
        <HotspotLink href="/research/area/mitochondrial" style={{ top: '84.8%', left: '66.3%', width: '28.8%', height: '13.5%' }} />

      </div>
    </div>
  );
}
