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
      backgroundColor: '#05070a',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      minHeight: '100vh',
    }}>
      <style>{`
        .hotspot {
          transition: background-color 0.2s ease, transform 0.1s ease;
          border-radius: 16px;
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
        aspectRatio: '682 / 1024',
      }}>
        {/* The Base Image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/research/research-landing-bg.jpg"
          alt="Research Library"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />

        {/* 1 + 2. Live in-place universal search (input + button + instant results) */}
        <LandingSearchOverlay />

        {/* 3. The 4 Big Grid Buttons */}
        <HotspotLink href="/research/areas" style={{ top: '35.5%', left: '4%', width: '44%', height: '18.5%' }} />
        <HotspotLink href="/research/catalog" style={{ top: '35.5%', left: '50.5%', width: '44%', height: '18.5%' }} />
        <HotspotLink href="/research/compare" style={{ top: '56%', left: '4%', width: '44%', height: '18.5%' }} />
        <HotspotLink href="/research/stacks" style={{ top: '56%', left: '50.5%', width: '44%', height: '18.5%' }} />

        {/* 4. Quick Access Top Row */}
        <HotspotLink href="/research/area/tissue_repair" style={{ top: '78.5%', left: '5%', width: '16.5%', height: '5%', borderRadius: '8px' }} />
        <HotspotLink href="/research/area/healing" style={{ top: '78.5%', left: '22.5%', width: '16.5%', height: '5%', borderRadius: '8px' }} />
        <HotspotLink href="/research/area/cognitive" style={{ top: '78.5%', left: '40.5%', width: '16.5%', height: '5%', borderRadius: '8px' }} />
        <HotspotLink href="/research/area/metabolic" style={{ top: '78.5%', left: '58.5%', width: '16.5%', height: '5%', borderRadius: '8px' }} />
        <HotspotLink href="/research/area/longevity" style={{ top: '78.5%', left: '76.5%', width: '16.5%', height: '5%', borderRadius: '8px' }} />

        {/* 5. Quick Access Bottom Row */}
        <HotspotLink href="/research/area/immune" style={{ top: '86%', left: '5%', width: '16.5%', height: '5%', borderRadius: '8px' }} />
        <HotspotLink href="/research/area/sleep" style={{ top: '86%', left: '22.5%', width: '16.5%', height: '5%', borderRadius: '8px' }} />
        <HotspotLink href="/research/area/cosmetic" style={{ top: '86%', left: '40.5%', width: '16.5%', height: '5%', borderRadius: '8px' }} />
        <HotspotLink href="/research/area/performance" style={{ top: '86%', left: '58.5%', width: '16.5%', height: '5%', borderRadius: '8px' }} />
        <HotspotLink href="/research/area/mitochondrial" style={{ top: '86%', left: '76.5%', width: '16.5%', height: '5%', borderRadius: '8px' }} />
      </div>
    </div>
  );
}
