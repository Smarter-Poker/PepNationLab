'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ResearchAreaCards() {
  const router = useRouter();

  const areas = [
    { id: 'weight_management', label: 'Weight Management', count: 127, image: '/images/research/icon_weight_management.png', filter: 'weight_management' },
    { id: 'tissue_repair', label: 'Tissue Repair', count: 83, image: '/images/research/icon_tissue_repair.png', filter: 'tissue_repair' },
    { id: 'healing', label: 'Healing', count: 62, image: '/images/research/icon_healing.png', filter: 'healing' },
    { id: 'performance', label: 'Performance', count: 73, image: '/images/research/icon_performance.png', filter: 'performance' },
    { id: 'cosmetic', label: 'Cosmetic', count: 45, image: '/images/research/icon_cosmetic.png', filter: 'cosmetic' },
    { id: 'cognitive', label: 'Cognitive', count: 49, image: '/images/research/icon_cognitive.png', filter: 'cognitive' },
    { id: 'pain_inflammation', label: 'Pain & Inflam', count: 58, image: '/images/research/icon_pain_inflammation.png', filter: 'pain_inflammation' },
    { id: 'gut_health', label: 'Gut Health', count: 32, image: '/images/research/icon_gut_health.png', filter: 'gut_health' },
    { id: 'sexual_health', label: 'Sexual Health', count: 21, image: '/images/research/icon_sexual_health.png', filter: 'sexual_health' },
    { id: 'sleep', label: 'Sleep', count: 38, image: '/images/research/icon_sleep.png', filter: 'sleep' },
    { id: 'longevity', label: 'Longevity', count: 66, image: '/images/research/icon_longevity.png', filter: 'longevity' },
    { id: 'bone_joint', label: 'Bone & Joint', count: 44, image: '/images/research/icon_bone_joint.png', filter: 'bone_joint' },
    { id: 'immune', label: 'Immune', count: 52, image: '/images/research/icon_immune.png', filter: 'immune' },
    { id: 'metabolic', label: 'Metabolic', count: 89, image: '/images/research/icon_metabolic.png', filter: 'metabolic' },
    { id: 'mitochondrial', label: 'Mitochondrial', count: 31, image: '/images/research/icon_mitochondrial.png', filter: 'mitochondrial' },
  ];

  return (
    <section style={{ marginBottom: '60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>Explore Research Areas</h2>
        <motion.button 
          onClick={() => router.push('/research/catalog')}
          whileHover={{ scale: 1.05, filter: 'drop-shadow(0 0 10px rgba(0, 229, 255, 0.4))' }}
          whileTap={{ scale: 0.95 }}
          style={{ 
            background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.15), rgba(0,0,0,0.5))', 
            border: '1px solid rgba(0, 229, 255, 0.4)', 
            padding: '8px 20px', 
            borderRadius: '20px', 
            color: '#00E5FF', 
            fontSize: '0.85rem',
            fontWeight: 800, 
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            outline: 'none'
          }}
        >
          View All
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
