'use client';

import { motion } from 'framer-motion';
import { TrendingUp, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { type Compound } from '@/lib/compounds';
import PremiumCompoundCard from './PremiumCompoundCard'; // We will create this next

export default function TrendingCarousel({ compounds }: { compounds: Compound[] }) {
  // Map trending slugs to their store product vial images
  const trendingData = [
    { slug: 'bpc-157', imageUrl: '/images/products/bpc-157.png' },
    { slug: 'tirzepatide', imageUrl: '/images/products/tirzepatide.png' },
    { slug: 'retatrutide', imageUrl: '/images/products/retatrutide.png' },
    { slug: 'ss-31', imageUrl: '/images/products/epithalon.png' }, // from db
    { slug: 'tesamorelin', imageUrl: '/images/products/tesamorelin.png' }
  ];
  
  const trendingCompounds = trendingData.map(t => {
    const compound = compounds.find(c => c.slug === t.slug);
    return compound ? { compound, storeProduct: { imageUrl: t.imageUrl } } : null;
  }).filter(Boolean) as { compound: Compound, storeProduct: any }[];

  if (trendingCompounds.length === 0) return null;

  return (
    <section style={{ marginBottom: '60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'rgba(246, 173, 85, 0.1)', color: '#F6AD55', padding: '8px', borderRadius: '50%' }}>
            <TrendingUp size={20} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>Trending Now</h2>
        </div>
      </div>

      <div style={{ 
        display: 'flex', 
        gap: '20px', 
        overflowX: 'auto', 
        paddingBottom: '20px',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        {trendingCompounds.map(({ compound, storeProduct }) => (
          <div key={compound.slug} style={{ flex: '0 0 auto', width: '320px' }}>
             <PremiumCompoundCard compound={compound} storeProduct={storeProduct} />
          </div>
        ))}
      </div>
    </section>
  );
}
