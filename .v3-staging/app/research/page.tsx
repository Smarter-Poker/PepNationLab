'use client';

/**
 * Research Library home -- v3 update.
 *
 * Keeps the image-mapped hotspot landing intact and adds a hero with the new
 * <GlobalSearchBar> at the top plus a <BrowseSurfaceNav> strip at the bottom.
 *
 * Research use only.
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { vibrateLight, initHaptics } from '@/lib/messenger/haptics';
import GlobalSearchBar from '@/components/research/GlobalSearchBar';
import BrowseSurfaceNav from '@/components/research/BrowseSurfaceNav';

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

  useEffect(() => {
    const handleInit = () => initHaptics();
    window.addEventListener('pointerdown', handleInit, { once: true });
    return () => window.removeEventListener('pointerdown', handleInit);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) {
      vibrateLight();
      router.push(`/research/search?q=${encodeURIComponent(q.trim())}`);
    }
  }

  return (
    <div style={{
      width: '100%',
      backgroundColor: '#05070a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
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

      <section
        aria-label="Research Library Search"
        style={{
          width: '100%',
          maxWidth: 960,
          padding: '32px 16px 8px',
          textAlign: 'center',
        }}
      >
        <h1 style={{
          color: '#FFFFFF',
          fontSize: 'clamp(24px, 4vw, 36px)',
          fontWeight: 900,
          margin: 0,
          letterSpacing: '-0.01em',
        }}>
          The Research Library
        </h1>
        <p style={{
          color: '#A8B4C0',
          fontSize: 'clamp(13px, 1.5vw, 16px)',
          marginTop: 8,
          marginBottom: 18,
          maxWidth: 720,
          marginLeft: 'auto',
          marginRight: 'auto',
          lineHeight: 1.55,
        }}>
          Fifteen Research Areas, A Match-Me Engine, A Google-Grade Search Engine, And Six
          Researcher Calculators. Research Use Only.
        </p>
        <GlobalSearchBar />
      </section>

      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '800px',
        aspectRatio: '682 / 1024',
        marginTop: 20,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/research/research-landing-bg.jpg"
          alt="Research Library"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />

        <form onSubmit={handleSearch} style={{
          position: 'absolute',
          top: '26.8%',
          left: '7.5%',
          width: '71%',
          height: '4.0%',
          zIndex: 10,
          backgroundColor: '#0a1017',
          borderRadius: '24px 0 0 24px',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '16px',
        }}>
          <Search size={20} color="#A8B4C0" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder=" Ask Me Anything..."
            aria-label="Search The Research Library"
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
            transition: 'all 0.15s ease',
          }}
        />

        <HotspotLink href="/research/areas" style={{ top: '35.5%', left: '4%', width: '44%', height: '18.5%' }} />
        <HotspotLink href="/research/catalog" style={{ top: '35.5%', left: '50.5%', width: '44%', height: '18.5%' }} />
        <HotspotLink href="/research/compare" style={{ top: '56%', left: '4%', width: '44%', height: '18.5%' }} />
        <HotspotLink href="/research/stacks" style={{ top: '56%', left: '50.5%', width: '44%', height: '18.5%' }} />

        <HotspotLink href="/research/area/tissue_repair" style={{ top: '78.5%', left: '5%', width: '16.5%', height: '5%', borderRadius: '8px' }} />
        <HotspotLink href="/research/area/healing" style={{ top: '78.5%', left: '22.5%', width: '16.5%', height: '5%', borderRadius: '8px' }} />
        <HotspotLink href="/research/area/cognitive" style={{ top: '78.5%', left: '40.5%', width: '16.5%', height: '5%', borderRadius: '8px' }} />
        <HotspotLink href="/research/area/metabolic" style={{ top: '78.5%', left: '58.5%', width: '16.5%', height: '5%', borderRadius: '8px' }} />
        <HotspotLink href="/research/area/longevity" style={{ top: '78.5%', left: '76.5%', width: '16.5%', height: '5%', borderRadius: '8px' }} />

        <HotspotLink href="/research/area/immune" style={{ top: '86%', left: '5%', width: '16.5%', height: '5%', borderRadius: '8px' }} />
        <HotspotLink href="/research/area/sleep" style={{ top: '86%', left: '22.5%', width: '16.5%', height: '5%', borderRadius: '8px' }} />
        <HotspotLink href="/research/area/cosmetic" style={{ top: '86%', left: '40.5%', width: '16.5%', height: '5%', borderRadius: '8px' }} />
        <HotspotLink href="/research/area/performance" style={{ top: '86%', left: '58.5%', width: '16.5%', height: '5%', borderRadius: '8px' }} />
        <HotspotLink href="/research/area/mitochondrial" style={{ top: '86%', left: '76.5%', width: '16.5%', height: '5%', borderRadius: '8px' }} />
      </div>

      <section
        aria-label="Explore More Of The Research Library"
        style={{
          width: '100%',
          maxWidth: 960,
          padding: '24px 16px 56px',
        }}
      >
        <h2 style={{
          color: '#FFFFFF',
          fontSize: 18,
          fontWeight: 800,
          margin: '0 0 6px',
          textAlign: 'center',
        }}>
          Explore More Of The Research Library
        </h2>
        <p style={{
          color: '#A8B4C0',
          fontSize: 13,
          textAlign: 'center',
          margin: 0,
        }}>
          A To Z Index, Discovery Timeline, Most Cited, Calculators, And More.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <BrowseSurfaceNav />
        </div>
      </section>
    </div>
  );
}
