'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, ChevronRight } from 'lucide-react';
import { type Compound } from '@/lib/compounds';
import PinToCompareButton from '@/components/research/PinToCompareButton';
import ResearchCartButton from '@/components/research/ResearchCartButton';
import InteractiveGlossaryText from '@/components/research/InteractiveGlossaryText';

interface Props {
  compound: Compound;
  isEli5?: boolean;
  onQuickView?: (c: Compound) => void;
  showBadge?: string;
  badgeColor?: string;
}

export default function PremiumCompoundCard({ compound, isEli5 = false, onQuickView, showBadge, badgeColor }: Props) {
  return (
    <motion.div 
      whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(0,0,0,0.4), inset 0 0 20px rgba(0, 229, 255, 0.05)', borderColor: 'rgba(0, 229, 255, 0.3)' }}
      style={{ 
        position: 'relative', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '12px', 
        padding: '20px', 
        borderRadius: '16px', 
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'linear-gradient(145deg, rgba(20, 30, 45, 0.8) 0%, rgba(10, 15, 25, 0.9) 100%)',
        backdropFilter: 'blur(12px)',
        transition: 'border-color 0.3s ease',
        height: '100%'
      }}
    >
      {showBadge && (
        <div style={{ 
          position: 'absolute', 
          top: '-12px', 
          right: '20px', 
          background: badgeColor || '#00E5FF', 
          color: '#000', 
          fontSize: '0.7rem', 
          fontWeight: 800, 
          textTransform: 'uppercase',
          padding: '4px 12px', 
          borderRadius: '12px', 
          boxShadow: `0 4px 10px ${badgeColor ? badgeColor + '66' : 'rgba(0,229,255,0.4)'}`, 
          zIndex: 10 
        }}>
          {showBadge}
        </div>
      )}
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, paddingRight: '12px' }}>
          <Link href={`/research/${compound.slug}`} style={{ textDecoration: 'none', color: '#FFF' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 4px 0', lineHeight: 1.2 }}>{compound.display_name}</h3>
            {(compound.aliases || []).length > 0 && (
              <div style={{ fontSize: '0.8rem', color: '#A8B4C0', marginBottom: '8px' }}>
                {(compound.aliases || []).slice(0, 2).join(', ')}
              </div>
            )}
          </Link>
          
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {compound.category && (
              <span style={{ background: 'rgba(0, 229, 255, 0.1)', color: '#00E5FF', border: '1px solid rgba(0, 229, 255, 0.2)', fontSize: '0.65rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, textTransform: 'uppercase' }}>
                {compound.category}
              </span>
            )}
            {/* Fallback evidence tier badge if needed, though previously removed, we can keep category */}
          </div>
        </div>

        {/* Top right molecule thumbnail placeholder */}
        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
           <Image src="/images/redesign/hero_molecule.png" alt="molecule" fill style={{ objectFit: 'cover', opacity: 0.5, mixBlendMode: 'screen' }} />
        </div>
      </div>
      
      <div style={{ fontSize: '0.9rem', color: '#A8B4C0', margin: '4px 0', lineHeight: 1.5, flexGrow: 1 }}>
        {isEli5 ? <InteractiveGlossaryText text={compound.eli5_summary || compound.plain_summary || ''} /> : <InteractiveGlossaryText text={compound.mechanism || compound.plain_summary || ''} />}
      </div>
      
      <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button 
          onClick={() => onQuickView?.(compound)} 
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px', color: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
          title="Quick View"
        >
          <Eye size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <PinToCompareButton compoundSlug={compound.slug} compoundName={compound.display_name} category={compound.category} evidenceTierKey={compound.evidence_tier} size="sm" />
        </div>
        <ResearchCartButton productName={compound.display_name} size="sm" />
      </div>
    </motion.div>
  );
}
