'use client';

import { motion } from 'framer-motion';
import { TrendingUp, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { type Compound } from '@/lib/compounds';
import PremiumCompoundCard from './PremiumCompoundCard'; // We will create this next

export default function TrendingCarousel({ compounds }: { compounds: Compound[] }) {
  // Hardcode trending slugs for now, or use a prop
  const trendingSlugs = ['bpc-157', 'tirzepatide', 'retatrutide', 'ss-31', 'tesamorelin'];
  
  const trendingCompounds = compounds.filter(c => trendingSlugs.includes(c.slug));

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
        {trendingCompounds.map((c) => (
          <div key={c.slug} style={{ flex: '0 0 auto', width: '320px' }}>
             {/* We will pass the compound to the new PremiumCompoundCard */}
             <PremiumCompoundCard compound={c} showBadge="Trending" badgeColor="#F6AD55" />
          </div>
        ))}
      </div>
    </section>
  );
}
