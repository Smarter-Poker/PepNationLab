'use client';

import { motion } from 'framer-motion';
import { 
  Flame, Dumbbell, ShieldPlus, Brain, Hourglass, Moon, Sparkles, Activity
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function MatchEngineCards() {
  const router = useRouter();

  const objectives = [
    { id: 'fat_loss', label: 'Fat Loss', icon: <Flame size={32} />, color: '#00E5FF', filter: 'weight_management' },
    { id: 'muscle_gain', label: 'Muscle Gain', icon: <Dumbbell size={32} />, color: '#68D391', filter: 'performance' },
    { id: 'healing', label: 'Healing', icon: <ShieldPlus size={32} />, color: '#00E5FF', filter: 'healing' },
    { id: 'cognitive', label: 'Cognitive', icon: <Brain size={32} />, color: '#B794F4', filter: 'cognitive' },
    { id: 'longevity', label: 'Longevity', icon: <Hourglass size={32} />, color: '#00E5FF', filter: 'longevity' },
    { id: 'sleep', label: 'Sleep', icon: <Moon size={32} />, color: '#90CDF4', filter: 'sleep' },
    { id: 'hair_skin', label: 'Hair & Skin', icon: <Sparkles size={32} />, color: '#A8B4C0', filter: 'cosmetic' },
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
            <div style={{ color: obj.color, filter: `drop-shadow(0 0 8px ${obj.color}66)` }}>
              {obj.icon}
            </div>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, textAlign: 'center' }}>{obj.label}</span>
          </motion.button>
        ))}
      </div>
    </section>
  );
}
