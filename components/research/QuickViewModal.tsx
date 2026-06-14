'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Compound, evidenceTier, intranasalDisplay } from '@/lib/compounds';
import InteractiveGlossaryText from '@/components/research/InteractiveGlossaryText';
import PinToCompareButton from '@/components/research/PinToCompareButton';
import ResearchCartButton from '@/components/research/ResearchCartButton';

interface QuickViewModalProps {
  compound: Compound | null | any;
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string;
  price?: number | null;
  storeProduct?: any;
}

export default function QuickViewModal({ compound, isOpen, onClose, imageUrl, price, storeProduct }: QuickViewModalProps) {
  const formatPrice = (p: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p);
  const nasal = intranasalDisplay(compound);
  return (
    <AnimatePresence>
      {isOpen && compound && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(16px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ position: 'absolute', inset: 0 }} onClick={onClose} />
          <motion.div 
            initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{ 
              width: '100%', maxWidth: 640, maxHeight: '90vh', 
              background: 'linear-gradient(145deg, rgba(20, 30, 45, 0.95) 0%, rgba(10, 15, 25, 0.98) 100%)', 
              borderRadius: 24, 
              boxShadow: '0 20px 60px rgba(0,0,0,0.8), inset 0 0 0 4px #8b939e, inset 0 0 0 6px #2a3138', 
              overflowY: 'auto', 
              position: 'relative', 
              display: 'flex', 
              flexDirection: 'column' 
            }}
          >
            {/* Header */}
            <div style={{ padding: '24px 32px', borderBottom: '2px solid rgba(139, 147, 158, 0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'sticky', top: 0, background: 'linear-gradient(to bottom, rgba(10,15,20,0.98) 0%, rgba(10,15,20,0.9) 100%)', zIndex: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '16px' }}>
                  <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900, color: '#C0C8D0' }}>
                    {storeProduct?.productName || compound.display_name}
                  </h2>
                  {storeProduct && storeProduct.retailPrice != null ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.4rem', fontWeight: 800 }}>
                      {storeProduct.isOnSale ? (
                        <>
                          <span style={{ color: '#FC8181', textDecoration: 'line-through', opacity: 0.6, fontSize: '1rem' }}>{formatPrice(storeProduct.retailPrice)}</span>
                          <span style={{ color: '#68D391' }}>{formatPrice(storeProduct.salePrice)}</span>
                        </>
                      ) : (
                        <span style={{ color: '#68D391' }}>{formatPrice(storeProduct.retailPrice)}</span>
                      )}
                    </div>
                  ) : price != null ? (
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#68D391' }}>
                      ${price.toFixed(2)}
                    </div>
                  ) : null}
                </div>
                
                {/* Popular Name Only */}
                {compound.aliases && compound.aliases.length > 0 && (
                  <div style={{ fontSize: '0.85rem', color: '#A8B4C0' }}>
                    <strong style={{ color: '#C0C8D0' }}>Popular Name:</strong> {compound.aliases.slice(0, 3).join(', ')}
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
                <div style={{ 
                  background: 'rgba(10, 15, 20, 0.6)', 
                  borderRadius: 16, 
                  padding: '16px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  minWidth: 200, 
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5), inset 0 0 0 3px #8b939e, inset 0 0 0 5px #2a3138',
                  position: 'relative'
                }}>
                  {(storeProduct?.imageUrl || imageUrl) ? (
                    <div style={{ width: 180, height: 180, position: 'relative' }}>
                      <Image src={storeProduct?.imageUrl || imageUrl || ""} alt={compound.display_name} fill style={{ objectFit: 'contain', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.5))' }} unoptimized={!!imageUrl} />
                    </div>
                  ) : (
                    <div style={{ width: 180, height: 180, position: 'relative', opacity: 0.5 }}>
                      <Image src="/images/redesign/hero_molecule.png" alt="molecule" fill style={{ objectFit: 'contain' }} />
                    </div>
                  )}
                  <div style={{ marginTop: 16, color: '#C0C8D0', fontSize: '1.1rem', fontWeight: 800, textAlign: 'center' }}>
                    {storeProduct?.productName || compound.display_name}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: '0 32px 32px 32px', flex: 1 }}>
              <div style={{ marginTop: 24 }}>
                <h4 style={{ margin: '0 0 16px', color: '#fff', fontSize: '1.1rem' }}>Compound Details</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {compound.mechanism && (
                    <div style={{ background: '#0F1318', border: '2px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: '16px 20px' }}>
                      <div style={{ color: '#C0C8D0', fontSize: '1.1rem', fontWeight: 800, marginBottom: 8 }}>Mechanism Of Action</div>
                      <div style={{ color: '#A8B4C0', fontSize: '0.85rem', lineHeight: 1.5 }}>
                        <InteractiveGlossaryText text={compound.mechanism} />
                      </div>
                    </div>
                  )}
                  
                  {compound.pk_summary && (
                    <div style={{ background: '#0F1318', border: '2px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: '16px 20px' }}>
                      <div style={{ color: '#C0C8D0', fontSize: '1.1rem', fontWeight: 800, marginBottom: 8 }}>Pharmacokinetics</div>
                      <div style={{ color: '#A8B4C0', fontSize: '0.85rem', lineHeight: 1.5 }}>
                        <InteractiveGlossaryText text={compound.pk_summary} />
                      </div>
                    </div>
                  )}

                  <div style={{ background: '#0F1318', border: '2px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--silver, #A8B4C0)', fontWeight: 600 }}>Form</div>
                      <div style={{ color: 'var(--white, #FFFFFF)', fontWeight: 500 }}>{compound.handling?.form || 'Vial'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--silver, #A8B4C0)', fontWeight: 600 }}>Frequency</div>
                      <div style={{ color: 'var(--white, #FFFFFF)', fontWeight: 500 }}>{compound.typical_frequency || 'N/A'}</div>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--silver, #A8B4C0)', fontWeight: 600 }}>Administration Route</div>
                      <div style={{ color: nasal.color, fontWeight: 700 }}>{nasal.routesLabel}</div>
                      {nasal.nasal && nasal.caveat && (
                        <div style={{ color: '#9FB0BD', fontSize: '0.72rem', lineHeight: 1.45, marginTop: 4 }}>{nasal.caveat}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Row */}
            <div style={{ padding: '20px 32px', background: 'rgba(0,0,0,0.4)', borderTop: '2px solid rgba(139, 147, 158, 0.3)', display: 'flex', justifyContent: 'center', gap: 16, alignItems: 'center' }}>
              <Link
                href={`/research/${compound.slug}`}
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'linear-gradient(180deg, #8b939e 0%, #4a5158 100%)',
                  boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.4), 0 4px 10px rgba(0,0,0,0.5)',
                  border: '1px solid #2a3138',
                  borderRadius: '12px',
                  padding: '10px 20px',
                  color: '#FFF',
                  textDecoration: 'none',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  transition: 'transform 0.15s, box-shadow 0.15s'
                }}
                onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = 'inset 0 1px 1px rgba(255,255,255,0.4), 0 6px 15px rgba(0,0,0,0.6)'; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'inset 0 1px 1px rgba(255,255,255,0.4), 0 4px 10px rgba(0,0,0,0.5)'; }}
                onClick={onClose}
              >
                <div style={{ position: 'relative', width: '20px', height: '20px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>
                  <Image src="/images/redesign/icon_profile_card_3d.png" alt="Profile" fill style={{ objectFit: 'contain' }} />
                </div>
                View Full Profile
              </Link>
              
              <PinToCompareButton
                compoundSlug={compound.slug}
                compoundName={compound.display_name}
                evidenceTierKey={compound.evidence_tier}
                category={compound.category}
                size="md"
              />
              <ResearchCartButton 
                productName={storeProduct?.productName || compound.display_name} 
                size="md" 
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
