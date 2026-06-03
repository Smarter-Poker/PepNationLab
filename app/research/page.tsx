'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { vibrateLight, initHaptics } from '@/lib/messenger/haptics';

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
  const router = useRouter();
  const [q, setQ] = useState('');

  // Initialize haptics on first touch/click
  useEffect(() => {
    const handleInit = () => initHaptics();
    window.addEventListener('pointerdown', handleInit, { once: true });
    return () => window.removeEventListener('pointerdown', handleInit);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) {
      vibrateLight();
      router.push(`/research/catalog?q=${encodeURIComponent(q.trim())}`);
    }
  }

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
        .search-btn:hover {
          background-color: rgba(255, 255, 255, 0.08);
          border-radius: 12px;
        }
        .search-btn:active {
          background-color: rgba(255, 255, 255, 0.15);
          transform: scale(0.95);
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

        {/* 1. The Search Input Field */}
        <form onSubmit={handleSearch} style={{
          position: 'absolute',
          top: '26.8%',
          left: '7.5%',
          width: '71%',
          height: '4.0%',
          zIndex: 10,
          backgroundColor: '#0a1017', // Match the image's dark color to cover baked-in text
          borderRadius: '24px 0 0 24px',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '16px'
        }}>
          <Search size={20} color="#A8B4C0" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder=" Ask Me Anything..."
            style={{
              flex: 1,
              height: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontSize: 'clamp(12px, 1.4vw, 16px)',
              padding: '0 12px 0 12px',
            }}
          />
        </form>

        {/* 2. The Search Button (Submit) */}
        <div 
          className="search-btn"
          onClick={handleSearch}
          onPointerDown={() => vibrateLight()}
          style={{
            position: 'absolute',
            top: '26.8%',
            left: '79%',
            width: '13.5%',
            height: '4.0%',
            cursor: 'pointer',
            zIndex: 10,
            transition: 'all 0.15s ease'
          }}
        />

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
