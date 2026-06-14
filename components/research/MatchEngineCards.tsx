'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

const BASE_URL = 'https://ydsaqnnuwyvtyxgvrnys.supabase.co/storage/v1/object/public/15DynamicImages/';

export default function MatchEngineCards() {
  const router = useRouter();

  const objectives = [
    { id: 'weight_management', label: 'Fat Loss', iconSrc: `${BASE_URL}weight_management.png`, color: '#FF7F50', filter: 'weight_management' },
    { id: 'tissue_repair', label: 'Tissue Repair', iconSrc: `${BASE_URL}tissue_repair.png`, color: '#00E5FF', filter: 'tissue_repair' },
    { id: 'healing', label: 'Healing', iconSrc: `${BASE_URL}healing.png`, color: '#E2E8F0', filter: 'healing' },
    { id: 'performance', label: 'Performance', iconSrc: `${BASE_URL}performance.png`, color: '#F56565', filter: 'performance' },
    { id: 'cosmetic', label: 'Hair & Skin', iconSrc: `${BASE_URL}cosmetic.png`, color: '#F6E05E', filter: 'cosmetic' },
    { id: 'cognitive', label: 'Cognitive', iconSrc: `${BASE_URL}cognitive.png`, color: '#00E5FF', filter: 'cognitive' },
    { id: 'pain_inflammation', label: 'Pain & Inflam', iconSrc: `${BASE_URL}pain_inflammation.png`, color: '#63B3ED', filter: 'pain_inflammation' },
    { id: 'gut_health', label: 'Gut Health', iconSrc: `${BASE_URL}gut_health.png`, color: '#68D391', filter: 'gut_health' },
    { id: 'sexual_health', label: 'Sexual Health', iconSrc: `${BASE_URL}sexual_health.png`, color: '#F56565', filter: 'sexual_health' },
    { id: 'sleep', label: 'Sleep', iconSrc: `${BASE_URL}sleep.png`, color: '#4299E1', filter: 'sleep' },
    { id: 'longevity', label: 'Longevity', iconSrc: `${BASE_URL}longevity.png`, color: '#E2E8F0', filter: 'longevity' },
    { id: 'bone_joint', label: 'Bone & Joint', iconSrc: `${BASE_URL}bone_joint.png`, color: '#F6AD55', filter: 'bone_joint' },
    { id: 'immune', label: 'Immune', iconSrc: `${BASE_URL}immune.png`, color: '#68D391', filter: 'immune' },
    { id: 'metabolic', label: 'Metabolic', iconSrc: `${BASE_URL}metabolic.png`, color: '#F6E05E', filter: 'metabolic' },
    { id: 'mitochondrial', label: 'Mitochondrial', iconSrc: `${BASE_URL}mitochondrial.png`, color: '#4299E1', filter: 'mitochondrial' },
  ];

  const handleSelect = (filterValue: string) => {
    // Set the area filter on the in-page Intelligence Database, then scroll the
    // results into view. Without the scroll the click only mutated the query
    // string far above the fold, so the button felt unresponsive ("not
    // clickable") on both desktop and mobile.
    router.push(`/research/catalog?area=${filterValue}`, { scroll: false });
    setTimeout(() => {
      document.getElementById('intelligence-database')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
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
            whileHover={{ y: -6, boxShadow: `0 10px 30px ${obj.color}33` }}
            whileTap={{ scale: 0.95 }}
            style={{
              flex: '0 0 auto',
              width: '120px',
              height: '120px',
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              outline: 'none',
              transition: 'all 0.3s ease'
            }}
          >
            <img src={obj.iconSrc} alt={obj.label} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '16px' }} />
          </motion.button>
        ))}
      </div>
    </section>
  );
}
