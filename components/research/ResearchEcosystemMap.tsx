'use client';

import { motion } from 'framer-motion';
import { Network } from 'lucide-react';
import Link from 'next/link';

export default function ResearchEcosystemMap() {
  // A visual representation of compound relationships
  // BPC-157 (Center) -> TB-500, GHK-Cu, CJC-1295, Thymosin Alpha-1

  return (
    <section style={{ marginBottom: '60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ background: 'rgba(0, 229, 255, 0.1)', color: '#00E5FF', padding: '8px', borderRadius: '50%' }}>
          <Network size={20} />
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>Research Ecosystem Map</h2>
      </div>

      <div style={{ 
        position: 'relative', 
        width: '100%', 
        height: '400px', 
        background: 'rgba(15, 25, 35, 0.4)', 
        backdropFilter: 'blur(16px)', 
        borderRadius: '24px', 
        border: '1px solid rgba(255,255,255,0.05)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {/* Abstract background grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(0,229,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.03) 1px, transparent 1px)', backgroundSize: '50px 50px' }} />

        {/* Central Node */}
        <Link href="/research/bpc-157" style={{ zIndex: 10, textDecoration: 'none' }}>
          <motion.div 
            whileHover={{ scale: 1.1, boxShadow: '0 0 30px rgba(0,229,255,0.6)' }}
            animate={{ boxShadow: ['0 0 10px rgba(0,229,255,0.2)', '0 0 30px rgba(0,229,255,0.4)', '0 0 10px rgba(0,229,255,0.2)'] }}
            transition={{ duration: 4, repeat: Infinity }}
            style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(10, 20, 30, 0.9)',
              border: '2px solid #00E5FF',
              padding: '16px 24px',
              borderRadius: '20px',
              color: '#FFF',
              fontWeight: 800,
              fontSize: '1.2rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: 'pointer'
            }}
          >
            BPC-157
            <span style={{ fontSize: '0.7rem', color: '#00E5FF', fontWeight: 600, textTransform: 'uppercase', marginTop: '4px' }}>Healing Hub</span>
          </motion.div>
        </Link>

        {/* Satellite Nodes */}
        {[
          { name: 'TB-500', top: '20%', left: '30%', color: '#68D391', slug: 'tb-500' },
          { name: 'GHK-Cu', top: '20%', left: '70%', color: '#B794F4', slug: 'ghk-cu' },
          { name: 'Thymosin Alpha-1', top: '80%', left: '30%', color: '#F6AD55', slug: 'thymosin-alpha-1' },
          { name: 'CJC-1295', top: '80%', left: '70%', color: '#90CDF4', slug: 'cjc-1295' },
        ].map((node, i) => (
          <Link key={node.name} href={`/research/${node.slug}`} style={{ zIndex: 10, textDecoration: 'none' }}>
            <motion.div
              whileHover={{ scale: 1.1, boxShadow: `0 0 20px ${node.color}66` }}
              style={{
                position: 'absolute',
                top: node.top,
                left: node.left,
                transform: 'translate(-50%, -50%)',
                background: 'rgba(15, 25, 35, 0.8)',
                border: `1px solid ${node.color}`,
                padding: '10px 16px',
                borderRadius: '16px',
                color: '#FFF',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: `0 4px 10px rgba(0,0,0,0.5), inset 0 0 10px ${node.color}33`
              }}
            >
              {node.name}
            </motion.div>
          </Link>
        ))}

        {/* SVG Connecting Lines */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          {/* We'll use simple hardcoded paths for the visual effect since coordinates are % based, it's easier to use a single path from center to the nodes */}
          <line x1="50%" y1="50%" x2="30%" y2="20%" stroke="#00E5FF" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
          <line x1="50%" y1="50%" x2="70%" y2="20%" stroke="#00E5FF" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
          <line x1="50%" y1="50%" x2="30%" y2="80%" stroke="#00E5FF" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
          <line x1="50%" y1="50%" x2="70%" y2="80%" stroke="#00E5FF" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
          
          {/* Animated particles moving along the lines */}
          <circle r="3" fill="#00E5FF">
            <animateMotion dur="3s" repeatCount="indefinite" path="M 500 200 L 300 80" />
          </circle>
        </svg>

        <div style={{ position: 'absolute', bottom: '24px', right: '24px', color: '#A8B4C0', fontSize: '0.8rem' }}>
          Interactive Map: Click nodes to explore.
        </div>
      </div>
    </section>
  );
}
