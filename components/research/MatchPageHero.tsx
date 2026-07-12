'use client';

import React, { useState, useRef, useMemo } from 'react';
import DiscoveryHero from '../storefront/StorefrontDiscovery';
import type { Compound } from '@/lib/compounds';
import { useRouter } from 'next/navigation';

export default function MatchPageHero({ compounds, children }: { compounds: Compound[], children?: React.ReactNode }) {
  const router = useRouter();
  
  // Convert array to map for DiscoveryHero
  const compoundsBySlug = useMemo(() => {
    const map: Record<string, Compound> = {};
    for (const c of compounds) {
      if (c.slug) map[c.slug] = c;
    }
    return map;
  }, [compounds]);

  const [showForm, setShowForm] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const handleMatchMeClick = () => {
    setShowForm(true);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
      <DiscoveryHero
        compoundsBySlug={compoundsBySlug}
        resolveProducts={() => []} // No e-commerce products on this global page
        onAddToCart={() => {}}
        onOpenProduct={() => {}}
        onSelectArea={(area) => {
          // Could pass this area into the MatchForm in the future, for now just open the form
          handleMatchMeClick();
        }}
        primaryColor="#00C4BC"
        onMatchMeClick={handleMatchMeClick}
        onLetUsGuideYouClick={handleMatchMeClick}
        onSearchSubmit={(query) => {
          handleMatchMeClick();
        }}
        onAlreadyKnowClicked={() => {
          router.push('/research/catalog');
        }}
      />

      {showForm && (
        <div ref={formRef} style={{ animation: 'fadeIn 0.5s ease-out' }}>
          {children}
        </div>
      )}
      
      {!showForm && (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.1rem' }}>
            Click <strong>MATCH ME</strong> above to start the engine.
          </p>
        </div>
      )}
    </div>
  );
}
