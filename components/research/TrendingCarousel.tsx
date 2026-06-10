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
        <motion.button 
          whileHover={{ scale: 1.02, filter: 'drop-shadow(0 0 15px rgba(246, 173, 85, 0.4))' }}
          whileTap={{ scale: 0.98 }}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '12px', 
            background: '#1A1A1A', 
            padding: '6px 24px 6px 6px', 
            borderRadius: '100px', 
            border: '1px solid rgba(246, 173, 85, 0.2)',
            cursor: 'pointer',
            outline: 'none'
          }}
        >
          <div style={{ background: 'rgba(246, 173, 85, 0.1)', color: '#F6AD55', padding: '8px', borderRadius: '50%' }}>
            <TrendingUp size={20} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', margin: 0, letterSpacing: '0.5px' }}>Trending Now</h2>
        </motion.button>
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
