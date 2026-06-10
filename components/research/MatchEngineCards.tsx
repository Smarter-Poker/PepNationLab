'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function MatchEngineCards() {
  const router = useRouter();

  const objectives = [
    { id: 'fat_loss', label: 'Fat Loss', iconSrc: '/images/redesign/icon_fire_3d.png', color: '#00E5FF', filter: 'weight_management' },
    { id: 'muscle_gain', label: 'Muscle Gain', iconSrc: '/images/redesign/icon_dumbbell_3d.png', color: '#68D391', filter: 'performance' },
    { id: 'healing', label: 'Healing', iconSrc: '/images/redesign/icon_shield_3d.png', color: '#00E5FF', filter: 'healing' },
    { id: 'cognitive', label: 'Cognitive', iconSrc: '/images/redesign/icon_brain_3d.png', color: '#B794F4', filter: 'cognitive' },
    { id: 'longevity', label: 'Longevity', iconSrc: '/images/redesign/icon_hourglass_3d.png', color: '#00E5FF', filter: 'longevity' },
    { id: 'sleep', label: 'Sleep', iconSrc: '/images/redesign/icon_moon_3d.png', color: '#90CDF4', filter: 'sleep' },
    { id: 'hair_skin', label: 'Hair & Skin', iconSrc: '/images/redesign/icon_stars_3d.png', color: '#A8B4C0', filter: 'cosmetic' },
  ];

  const handleSelect = (filterValue: string) => {
    // Navigate and set the area filter
    router.push(`/research/catalog?area=${filterValue}`);
  };

  return (
    <section style={{ marginBottom: '60px' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#FFFFFF', margin: '0 0 8px 0' }}>What Are You Researching?</h2>
      <p style={{ color: '#A8B4C0', fontSize: '0.95rem', margin: '0 0 24px 0' }}>
        Our Match-Me Engine finds the top compounds for your specific goal.
      </p>

      <div style={{ 
        display: 'flex', 
        gap: '16px', 
        overflowX: 'auto', 
        paddingBottom: '16px',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        {objectives.map((obj) => (
          <motion.button
            key={obj.id}
            onClick={() => handleSelect(obj.filter)}
            whileHover={{ y: -6, boxShadow: `0 10px 30px ${obj.color}33`, borderColor: obj.color }}
            whileTap={{ scale: 0.95 }}
            style={{
              flex: '0 0 auto',
              width: '110px',
              height: '110px',
              background: 'rgba(15, 25, 35, 0.6)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              cursor: 'pointer',
              color: '#FFFFFF',
              boxShadow: 'inset 0 0 20px rgba(255,255,255,0.02)',
              transition: 'all 0.3s ease',
              outline: 'none'
            }}
          >
            <div style={{ position: 'relative', width: '48px', height: '48px', filter: `drop-shadow(0 0 8px ${obj.color}66)` }}>
              <Image src={obj.iconSrc} alt={obj.label} fill style={{ objectFit: 'contain' }} />
            </div>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, textAlign: 'center' }}>{obj.label}</span>
          </motion.button>
        ))}
      </div>
    </section>
  );
}
