'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ResearchAreaCards() {
  const router = useRouter();

  const areas = [
    { id: 'weight_management', label: 'Weight Management', count: 127, image: '/images/redesign/research_weight.png', filter: 'weight_management' },
    { id: 'healing', label: 'Tissue Repair & Healing', count: 83, image: '/images/redesign/research_tissue.png', filter: 'healing' },
    { id: 'longevity', label: 'Longevity & Anti-Aging', count: 62, image: '/images/redesign/hero_molecule.png', filter: 'longevity' }, // Fallback to hero_molecule if needed, or unique image
    { id: 'cognitive', label: 'Cognitive Health', count: 49, fallbackGradient: 'linear-gradient(135deg, #4c1d95, #6b21a8)', filter: 'cognitive' },
    { id: 'performance', label: 'Performance & Strength', count: 73, fallbackGradient: 'linear-gradient(135deg, #064e3b, #047857)', filter: 'performance' },
  ];

  return (
    <section style={{ marginBottom: '60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>Explore Research Areas</h2>
        <button 
          onClick={() => router.push('/research/catalog')}
          style={{ background: 'none', border: 'none', color: '#A8B4C0', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
        >
          View all areas <ArrowRight size={14} />
        </button>
      </div>

      <div style={{ 
        display: 'flex', 
        gap: '20px', 
        overflowX: 'auto', 
        paddingBottom: '20px',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        {areas.map((area) => (
          <motion.div
            key={area.id}
            onClick={() => router.push(`/research/catalog?area=${area.filter}`)}
            whileHover={{ y: -8, boxShadow: '0 20px 40px rgba(0,0,0,0.6), inset 0 0 20px rgba(0, 229, 255, 0.2)' }}
            style={{
              flex: '0 0 auto',
              width: '240px',
              height: '320px',
              borderRadius: '24px',
              position: 'relative',
              overflow: 'hidden',
              cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.1)',
              background: area.fallbackGradient || '#0F1923',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              padding: '24px'
            }}
          >
            {area.image && (
              <Image 
                src={area.image} 
                alt={area.label} 
                fill 
                style={{ objectFit: 'cover', opacity: 0.6, mixBlendMode: 'screen' }} 
              />
            )}
            
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,15,20,0.95) 0%, rgba(10,15,20,0) 60%)' }} />

            <div style={{ position: 'relative', zIndex: 10 }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', margin: '0 0 12px 0', lineHeight: 1.2 }}>
                {area.label}
              </h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: '#A8B4C0', fontWeight: 600 }}>{area.count} Compounds</span>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF' }}>
                  <ArrowRight size={14} />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
