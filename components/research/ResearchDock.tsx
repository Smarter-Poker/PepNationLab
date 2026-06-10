'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

export default function ResearchDock() {
  const pathname = usePathname();

  const links = [
    { name: 'Research Library', href: '/research/catalog', iconSrc: '/images/redesign/icon_database_3d.png' },
    { name: 'Match Me Engine', href: '/research/match', iconSrc: '/images/redesign/icon_wand_3d.png' },
    { name: 'Compare', href: '/research/compare', iconSrc: '/images/redesign/icon_compare_3d.png' },
    { name: 'Stacks', href: '/research/stacks', iconSrc: '/images/redesign/icon_layers_3d.png' },
    { name: 'Safety', href: '/research/evidence', iconSrc: '/images/redesign/icon_shield_check_3d.png' },
    { name: 'Learn', href: '/research/learn', iconSrc: '/images/redesign/icon_cap_3d.png' },
    { name: 'Glossary', href: '/research/glossary', iconSrc: '/images/redesign/icon_book_3d.png' },
    { name: 'References', href: '/research/references', iconSrc: '/images/redesign/icon_library_3d.png' },
    { name: 'FAQ', href: '/research/faq', iconSrc: '/images/redesign/icon_question_3d.png' },
  ];

  return (
    <nav style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      background: 'rgba(15, 25, 35, 0.4)',
      backdropFilter: 'blur(16px)',
      borderRight: '1px solid rgba(255, 255, 255, 0.05)',
      padding: '24px 16px',
      height: '100vh',
      position: 'sticky',
      top: 0,
      width: '240px',
      overflowY: 'auto'
    }}>
      <div style={{ marginBottom: '32px', paddingLeft: '8px' }}>
        <div style={{ color: '#A8B4C0', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Navigation
        </div>
      </div>

      {links.map((link) => {
        const isActive = pathname === link.href;
        
        return (
          <Link key={link.name} href={link.href} style={{ textDecoration: 'none' }}>
            <motion.div
              whileHover={{ x: 6, backgroundColor: 'rgba(255,255,255,0.08)' }}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 16px',
                borderRadius: '12px',
                color: isActive ? '#00E5FF' : '#A8B4C0',
                background: isActive ? 'rgba(0, 229, 255, 0.1)' : 'transparent',
                border: isActive ? '1px solid rgba(0, 229, 255, 0.3)' : '1px solid transparent',
                boxShadow: isActive ? '0 0 20px rgba(0, 229, 255, 0.15)' : 'none',
                transition: 'all 0.2s ease',
                fontWeight: isActive ? 800 : 600,
                fontSize: '0.95rem',
                letterSpacing: '0.5px'
              }}
            >
              {link.name}
            </motion.div>
          </Link>
        );
      })}

      <div style={{ marginTop: 'auto', paddingTop: '32px' }}>
        <Link href="/research/calculators" style={{ textDecoration: 'none' }}>
          <motion.div 
            whileHover={{ scale: 1.02, filter: 'drop-shadow(0 0 10px rgba(0, 229, 255, 0.4))' }}
            whileTap={{ scale: 0.98 }}
            style={{ position: 'relative', width: '100%', aspectRatio: '1/1', cursor: 'pointer' }}
          >
            <Image src="/images/research/box_new_to_peptides.png" alt="New to Peptides?" fill style={{ objectFit: 'contain' }} />
          </motion.div>
        </Link>
      </div>
    </nav>
  );
}
