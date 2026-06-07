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
          border-radius: 12px;
        }
        .hotspot:hover {
          background-color: rgba(255, 255, 255, 0.08);
        }
        .hotspot:active {
          background-color: rgba(255, 255, 255, 0.15);
          transform: scale(0.98);
        }
      `}</style>

      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '800px',
      }}>
        {/* The Base Image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/research/research-landing-bg-v2.png"
          alt="Research Library"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />

        {/* 1 + 2. Live in-place universal search (input + button + instant results) */}
        <LandingSearchOverlay 
          placeholder="Ask Us Anything..."
          hideIcon={true}
          formStyle={{
            top: '19.5%',
            left: '5%',
            width: '76%',
            height: '4.5%',
          }}
          inputStyle={{
            paddingLeft: '46px',
          }}
          buttonStyle={{
            top: '19.5%',
            left: '82%',
            width: '13%',
            height: '4.5%',
          }}
          resultsStyle={{
            top: '24.5%',
            left: '5%',
            width: '90%',
            maxHeight: '40%',
          }}
        />

        {/* 3. The 4 Big Grid Buttons */}
        <HotspotLink href="/research/areas" style={{ top: '27%', left: '4%', width: '45%', height: '15%' }} />
        <HotspotLink href="/research/catalog" style={{ top: '27%', left: '51%', width: '45%', height: '15%' }} />
        <HotspotLink href="/research/compare" style={{ top: '43.5%', left: '4%', width: '45%', height: '15%' }} />
        <HotspotLink href="/research/stacks" style={{ top: '43.5%', left: '51%', width: '45%', height: '15%' }} />

        {/* 4. Quick Access Top Row */}
        <HotspotLink href="/research/area/weight_management" style={{ top: '63.5%', left: '3.5%', width: '17.5%', height: '10%' }} />
        <HotspotLink href="/research/area/tissue_repair" style={{ top: '63.5%', left: '22.5%', width: '17.5%', height: '10%' }} />
        <HotspotLink href="/research/area/healing" style={{ top: '63.5%', left: '41.5%', width: '17.5%', height: '10%' }} />
        <HotspotLink href="/research/area/performance" style={{ top: '63.5%', left: '60.5%', width: '17.5%', height: '10%' }} />
        <HotspotLink href="/research/area/skin_hair" style={{ top: '63.5%', left: '79.5%', width: '17.5%', height: '10%' }} />

        {/* 5. Quick Access Middle Row */}
        <HotspotLink href="/research/area/cognitive" style={{ top: '75%', left: '3.5%', width: '17.5%', height: '10%' }} />
        <HotspotLink href="/research/area/pain_inflammation" style={{ top: '75%', left: '22.5%', width: '17.5%', height: '10%' }} />
        <HotspotLink href="/research/area/gut_health" style={{ top: '75%', left: '41.5%', width: '17.5%', height: '10%' }} />
        <HotspotLink href="/research/area/sexual_health" style={{ top: '75%', left: '60.5%', width: '17.5%', height: '10%' }} />
        <HotspotLink href="/research/area/sleep" style={{ top: '75%', left: '79.5%', width: '17.5%', height: '10%' }} />

        {/* 6. Quick Access Bottom Row */}
        <HotspotLink href="/research/area/immune" style={{ top: '86%', left: '3.5%', width: '17.5%', height: '10%' }} />
        <HotspotLink href="/research/area/longevity" style={{ top: '86%', left: '22.5%', width: '17.5%', height: '10%' }} />
        <HotspotLink href="/research/area/mitochondrial" style={{ top: '86%', left: '41.5%', width: '17.5%', height: '10%' }} />
        <HotspotLink href="/research/area/metabolic" style={{ top: '86%', left: '60.5%', width: '17.5%', height: '10%' }} />
        <HotspotLink href="/research/area/joint_bone_health" style={{ top: '86%', left: '79.5%', width: '17.5%', height: '10%' }} />
      </div>
    </div>
  );
}
