'use client';

import React from 'react';
import PremiumPeptideCard from '@/components/storefront/PremiumPeptideCard';

export default function TestCardPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <PremiumPeptideCard />
    </div>
  );
}
