'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useState } from 'react';

// Animated Counter Component
const AnimatedCounter = ({ end, duration = 2, suffix = '' }: { end: number, duration?: number, suffix?: string }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const incrementTime = (duration / end) * 1000;
    
    const timer = setInterval(() => {
      start += Math.ceil(end / (duration * 60)); // smooth increment
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 16);

    return () => clearInterval(timer);
  }, [end, duration]);

  return <span>{count}{suffix}</span>;
};

export default function ResearchHero() {
  const stats = [
    { label: 'Compounds', value: 61 },
    { label: 'Research Areas', value: 15 },
    { label: 'References', value: 420, suffix: '+' },
    { label: 'Stack Combos', value: 93 },
    { label: 'Trending Now', value: 27 },
  ];

  return (
    <section style={{ 
      display: 'flex', 
      flexWrap: 'wrap',
      gap: '40px',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '40px 0 60px 0',
      position: 'relative'
    }}>
      {/* Background glow effects */}
      <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: '40%', height: '80%', background: 'radial-gradient(circle, rgba(0,229,255,0.15) 0%, transparent 70%)', filter: 'blur(60px)', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '10%', right: '5%', width: '50%', height: '100%', background: 'radial-gradient(circle, rgba(0,100,255,0.1) 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 0, pointerEvents: 'none' }} />

      <div style={{ flex: '1 1 600px', zIndex: 1 }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div style={{ color: '#00E5FF', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>
            Research Intelligence Center
          </div>
          <h1 style={{ 
            fontSize: 'clamp(2.5rem, 5vw, 4rem)', 
            fontWeight: 900, 
            color: '#FFFFFF', 
            lineHeight: 1.1, 
            margin: '0 0 24px 0',
            letterSpacing: '-0.02em',
            textShadow: '0 4px 20px rgba(0,0,0,0.5)'
          }}>
            Research Intelligence Center
          </h1>
          <p style={{ 
            color: '#A8B4C0', 
            fontSize: '1.2rem', 
            lineHeight: 1.6, 
            maxWidth: '680px',
            margin: '0 0 40px 0'
          }}>
            Explore compounds, compare mechanisms, discover stacks, and find candidates matched to your research objective.
          </p>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {stats.map((stat, i) => (
              <motion.div 
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 + (i * 0.1) }}
                whileHover={{ y: -6, boxShadow: '0 12px 30px rgba(0,229,255,0.2)', borderColor: '#00E5FF' }}
                style={{
                  background: 'rgba(15, 25, 35, 0.6)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(0,229,255,0.3)',
                  borderRadius: '16px',
                  padding: '16px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  minWidth: '120px',
                  boxShadow: 'inset 0 0 20px rgba(255,255,255,0.02), 0 4px 10px rgba(0,0,0,0.5)',
                  transition: 'border-color 0.3s ease'
                }}
              >
                <div style={{ color: '#FFFFFF', fontSize: '2rem', fontWeight: 900, lineHeight: 1 }}>
                  <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                </div>
                <div style={{ color: '#88929C', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '8px' }}>
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* 3D Visual Panel */}
      <div style={{ flex: '1 1 400px', display: 'flex', justifyContent: 'center', zIndex: 1 }}>
        <motion.div 
          animate={{ y: [0, -15, 0], rotateX: [0, 2, 0], rotateY: [0, -2, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '500px',
            aspectRatio: '1/1',
            background: 'rgba(10, 20, 30, 0.4)',
            backdropFilter: 'blur(20px)',
            borderRadius: '24px',
            border: '1px solid rgba(0,229,255,0.4)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6), inset 0 0 40px rgba(0,229,255,0.1)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {/* Subtle grid pattern inside */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '40px 40px', opacity: 0.5 }} />
          
          <Image
            src="/images/redesign/hero_molecule.png"
            alt="3D Molecular Research"
            fill
            priority
            sizes="(max-width: 968px) 100vw, 50vw"
            style={{ objectFit: 'cover', mixBlendMode: 'screen', opacity: 0.9 }}
          />
          
          <div style={{ position: 'absolute', top: '24px', right: '24px', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '8px 16px' }}>
            <div style={{ fontSize: '0.7rem', color: '#00E5FF', fontWeight: 800, textTransform: 'uppercase' }}>Peptide Intelligence</div>
            <div style={{ fontSize: '0.6rem', color: '#A8B4C0', marginTop: '2px' }}>Data-Driven Discovery</div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
