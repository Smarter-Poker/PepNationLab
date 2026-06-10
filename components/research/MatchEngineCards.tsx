'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function MatchEngineCards() {
  const router = useRouter();

  const objectives = [
    { id: 'weight_management', label: 'Fat Loss', iconSrc: '/images/research/icon_weight_management.png', color: '#FF7F50', filter: 'weight_management' },
    { id: 'tissue_repair', label: 'Tissue Repair', iconSrc: '/images/research/icon_tissue_repair.png', color: '#00E5FF', filter: 'tissue_repair' },
    { id: 'healing', label: 'Healing', iconSrc: '/images/research/icon_healing.png', color: '#E2E8F0', filter: 'healing' },
    { id: 'performance', label: 'Performance', iconSrc: '/images/research/icon_performance.png', color: '#F56565', filter: 'performance' },
    { id: 'cosmetic', label: 'Hair & Skin', iconSrc: '/images/research/icon_cosmetic.png', color: '#F6E05E', filter: 'cosmetic' },
    { id: 'cognitive', label: 'Cognitive', iconSrc: '/images/research/icon_cognitive.png', color: '#00E5FF', filter: 'cognitive' },
    { id: 'pain_inflammation', label: 'Pain & Inflam', iconSrc: '/images/research/icon_pain_inflammation.png', color: '#63B3ED', filter: 'pain_inflammation' },
    { id: 'gut_health', label: 'Gut Health', iconSrc: '/images/research/icon_gut_health.png', color: '#68D391', filter: 'gut_health' },
    { id: 'sexual_health', label: 'Sexual Health', iconSrc: '/images/research/icon_sexual_health.png', color: '#F56565', filter: 'sexual_health' },
    { id: 'sleep', label: 'Sleep', iconSrc: '/images/research/icon_sleep.png', color: '#4299E1', filter: 'sleep' },
    { id: 'longevity', label: 'Longevity', iconSrc: '/images/research/icon_longevity.png', color: '#E2E8F0', filter: 'longevity' },
    { id: 'bone_joint', label: 'Bone & Joint', iconSrc: '/images/research/icon_bone_joint.png', color: '#F6AD55', filter: 'bone_joint' },
    { id: 'immune', label: 'Immune', iconSrc: '/images/research/icon_immune.png', color: '#68D391', filter: 'immune' },
    { id: 'metabolic', label: 'Metabolic', iconSrc: '/images/research/icon_metabolic.png', color: '#F6E05E', filter: 'metabolic' },
    { id: 'mitochondrial', label: 'Mitochondrial', iconSrc: '/images/research/icon_mitochondrial.png', color: '#4299E1', filter: 'mitochondrial' },
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
