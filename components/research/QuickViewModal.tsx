'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Compound, evidenceTier } from '@/lib/compounds';
import InteractiveGlossaryText from '@/components/research/InteractiveGlossaryText';
import PinToCompareButton from '@/components/research/PinToCompareButton';
import ResearchCartButton from '@/components/research/ResearchCartButton';

interface QuickViewModalProps {
  compound: Compound | null | any;
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string;
  price?: number | null;
}

export default function QuickViewModal({ compound, isOpen, onClose, imageUrl, price }: QuickViewModalProps) {
  return (
    <AnimatePresence>
      {isOpen && compound && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(16px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ position: 'absolute', inset: 0 }} onClick={onClose} />
          <motion.div 
            initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{ width: '100%', maxWidth: 640, maxHeight: '90vh', background: 'rgba(10, 15, 20, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.6)', overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column' }}
          >
            {/* Header */}
            <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'sticky', top: 0, background: 'linear-gradient(to bottom, rgba(10,15,20,0.98) 0%, rgba(10,15,20,0.9) 100%)', zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '16px' }}>
                <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900, color: '#C0C8D0' }}>{compound.display_name}</h2>
                {price != null && (
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#C0C8D0' }}>
                    ${price.toFixed(2)}
                  </div>
                )}
              </div>
              <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#FFF', borderRadius: '50%', padding: 8, cursor: 'pointer', display: 'flex', transition: 'all 0.2s ease-in-out' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '24px 32px 0 32px' }}>
              {/* Summary */}
              <p style={{ color: '#D0DAE4', lineHeight: 1.6, fontSize: '0.95rem', margin: '0 0 24px 0', textAlign: 'center' }}>
                <InteractiveGlossaryText text={compound.plain_summary || compound.eli5_summary || ''} />
              </p>

              {/* Banner Image Card */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
                <div style={{ background: '#0F1318', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16, padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 200, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                  {imageUrl ? (
                    <Image src={imageUrl} alt={compound.display_name} width={180} height={180} style={{ objectFit: 'contain', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.5))' }} unoptimized />
                  ) : (
                    <div style={{ width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A8B4C0' }}>No Image</div>
                  )}
                  <div style={{ marginTop: 16, color: '#C0C8D0', fontSize: '1.1rem', fontWeight: 800, textAlign: 'center' }}>
                    {compound.display_name}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: '0 32px 32px 32px', flex: 1 }}>
              <div style={{ marginTop: 24 }}>
                <h4 style={{ margin: '0 0 16px', color: '#fff', fontSize: '1.1rem' }}>Compound Details</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {compound.mechanism && (
                    <div style={{ background: '#0F1318', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16, padding: '16px 20px' }}>
                      <div style={{ color: '#C0C8D0', fontSize: '1.1rem', fontWeight: 800, marginBottom: 8 }}>Mechanism Of Action</div>
                      <div style={{ color: '#A8B4C0', fontSize: '0.85rem', lineHeight: 1.5 }}>
                        <InteractiveGlossaryText text={compound.mechanism} />
                      </div>
                    </div>
                  )}
                  
                  {compound.pk_summary && (
                    <div style={{ background: '#0F1318', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16, padding: '16px 20px' }}>
                      <div style={{ color: '#C0C8D0', fontSize: '1.1rem', fontWeight: 800, marginBottom: 8 }}>Pharmacokinetics</div>
                      <div style={{ color: '#A8B4C0', fontSize: '0.85rem', lineHeight: 1.5 }}>
                        <InteractiveGlossaryText text={compound.pk_summary} />
                      </div>
                    </div>
                  )}

                  <div style={{ background: '#0F1318', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16, padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--silver, #A8B4C0)', fontWeight: 600 }}>Form</div>
                      <div style={{ color: 'var(--white, #FFFFFF)', fontWeight: 500 }}>{compound.handling?.form || 'Vial'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--silver, #A8B4C0)', fontWeight: 600 }}>Frequency</div>
                      <div style={{ color: 'var(--white, #FFFFFF)', fontWeight: 500 }}>{compound.typical_frequency || 'N/A'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Row */}
            <div style={{ padding: '20px 32px', background: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Link
                href={`/research/${compound.slug}`}
                style={{ background: 'var(--teal, #00C4BC)', color: '#0C151D', padding: '12px 24px', borderRadius: 8, textDecoration: 'none', fontWeight: 800, flexShrink: 0 }}
                onClick={onClose}
              >
                View Full Profile
              </Link>
              
              <div style={{ display: 'flex', gap: 12 }}>
                <PinToCompareButton
                  compoundSlug={compound.slug}
                  compoundName={compound.display_name}
                  evidenceTierKey={compound.evidence_tier}
                  category={compound.category}
                  size="md"
                  style={{ height: '100%' }}
                />
                <ResearchCartButton 
                  productName={compound.display_name} 
                  size="md" 
                />
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
