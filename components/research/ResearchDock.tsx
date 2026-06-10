'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Sparkles, GitCompare, Calculator, Table2, Layers, 
  ShieldCheck, GraduationCap, BookOpen, HelpCircle, Library, Database
} from 'lucide-react';

export default function ResearchDock() {
  const pathname = usePathname();

  const links = [
    { name: 'Research Library', href: '/research/catalog', icon: <Database size={20} /> },
    { name: 'Match Me Engine', href: '/research/match', icon: <Sparkles size={20} /> },
    { name: 'Compare', href: '/research/compare', icon: <GitCompare size={20} /> },
    { name: 'Stacks', href: '/research/stacks', icon: <Layers size={20} /> },
    { name: 'Safety', href: '/research/evidence', icon: <ShieldCheck size={20} /> },
    { name: 'Learn', href: '/research/learn', icon: <GraduationCap size={20} /> },
    { name: 'Glossary', href: '/research/glossary', icon: <BookOpen size={20} /> },
    { name: 'References', href: '/research/references', icon: <Library size={20} /> },
    { name: 'FAQ', href: '/research/faq', icon: <HelpCircle size={20} /> },
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
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '12px',
                color: isActive ? '#00E5FF' : '#A8B4C0',
                background: isActive ? 'rgba(0, 229, 255, 0.1)' : 'transparent',
                border: isActive ? '1px solid rgba(0, 229, 255, 0.3)' : '1px solid transparent',
                boxShadow: isActive ? '0 0 20px rgba(0, 229, 255, 0.15)' : 'none',
                transition: 'all 0.2s ease',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.95rem'
              }}
            >
              <div style={{ 
                color: isActive ? '#00E5FF' : '#88929C',
                filter: isActive ? 'drop-shadow(0 0 8px rgba(0,229,255,0.6))' : 'none'
              }}>
                {link.icon}
              </div>
              {link.name}
            </motion.div>
          </Link>
        );
      })}

      <div style={{ marginTop: 'auto', paddingTop: '32px' }}>
        <div style={{ 
          background: 'rgba(255,255,255,0.03)', 
          border: '1px solid rgba(255,255,255,0.1)', 
          borderRadius: '16px', 
          padding: '16px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.85rem', color: '#FFF', fontWeight: 700, marginBottom: '8px' }}>New to Peptides?</div>
          <div style={{ fontSize: '0.75rem', color: '#A8B4C0', marginBottom: '16px' }}>60-Second Guide & Dose Calculator</div>
          <Link href="/research/calculators" style={{ textDecoration: 'none' }}>
            <motion.div 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{
                background: 'transparent',
                border: '1px solid #A8B4C0',
                color: '#FFF',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Get Started →
            </motion.div>
          </Link>
        </div>
      </div>
    </nav>
  );
}
