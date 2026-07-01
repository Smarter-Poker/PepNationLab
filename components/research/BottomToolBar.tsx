'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
export default function BottomToolBar() {
  return (
    <motion.div 
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ delay: 0.5, type: 'spring', stiffness: 200, damping: 20 }}
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(15, 25, 35, 0.8)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '30px',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,229,255,0.05)',
        zIndex: 50
      }}
    >
      <Link href="/research/calculators" style={{ textDecoration: 'none' }}>
        <motion.div 
          whileHover={{ scale: 1.05, background: 'rgba(255,255,255,0.1)' }}
          whileTap={{ scale: 0.95 }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '20px', color: '#FFF', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
        >
          <div style={{ position: 'relative', width: '16px', height: '16px' }}>
            <Image src="/images/redesign/icon_search_3d.png" alt="Calculator" fill style={{ objectFit: 'contain' }} />
          </div> Reconstitution Calculator
        </motion.div>
      </Link>
      
      <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }} />
      
      <Link href="/research/faq" style={{ textDecoration: 'none' }}>
        <motion.div 
          whileHover={{ scale: 1.05, background: 'rgba(255,255,255,0.1)' }}
          whileTap={{ scale: 0.95 }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '20px', color: '#FFF', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
        >
          <div style={{ position: 'relative', width: '16px', height: '16px' }}>
            <Image src="/images/redesign/icon_sparkles_3d.png" alt="Message" fill style={{ objectFit: 'contain' }} />
          </div> Ask An Expert
        </motion.div>
      </Link>
      
      <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }} />
      
      <Link href="/community" style={{ textDecoration: 'none' }}>
        <motion.div
          whileHover={{ scale: 1.05, background: 'rgba(255,255,255,0.1)' }}
          whileTap={{ scale: 0.95 }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '20px', color: '#FFF', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
        >
          Community
          <div style={{ position: 'relative', width: '14px', height: '14px' }}>
            <Image src="/images/redesign/icon_pin_3d.png" alt="Link" fill style={{ objectFit: 'contain' }} />
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}
