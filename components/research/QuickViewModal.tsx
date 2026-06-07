'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { Compound, evidenceTier, wadaLabel } from '@/lib/compounds';
import InteractiveGlossaryText from '@/components/research/InteractiveGlossaryText';
import PinToCompareButton from '@/components/research/PinToCompareButton';
import ResearchCartButton from '@/components/research/ResearchCartButton';

interface QuickViewModalProps {
  compound: Compound;
  isOpen: boolean;
  onClose: () => void;
}

export default function QuickViewModal({ compound, isOpen, onClose }: QuickViewModalProps) {
  if (!isOpen) return null;

  const t = evidenceTier(compound.evidence_tier);
  const aliasLine = (compound.aliases ?? []).slice(0, 3).join(', ');

  const wadaBadgeStyle = (status: string) => {
    if (status === 'permitted') return { color: '#68D391', border: '1px solid #68D391' };
    if (status === 'prohibited') return { color: '#FC8181', border: '1px solid #FC8181' };
    if (status === 'prohibited_males') return { color: '#F6AD55', border: '1px solid #F6AD55' };
    return { color: '#A8B4C0', border: '1px solid rgba(168,180,192,0.3)' };
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--black, #0C151D)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '85vh',
          overflowY: 'auto',
          position: 'relative',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--white, #FFFFFF)',
          }}
        >
          <X size={18} />
        </button>

        <div style={{ paddingRight: '40px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: '0.7rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: t.color,
                border: `1px solid ${t.color}`,
                borderRadius: '999px',
                padding: '2px 10px',
              }}
            >
              {t.label}
            </span>
            {compound.category && (
              <span style={{ fontSize: '0.75rem', color: 'var(--teal, #00C4BC)', fontWeight: 600 }}>
                {compound.category}
              </span>
            )}
            {compound.wada_status && compound.wada_status !== 'not_listed' && (
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  ...wadaBadgeStyle(compound.wada_status),
                }}
              >
                {wadaLabel(compound.wada_status)}
              </span>
            )}
          </div>

          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--white, #FFFFFF)', margin: '0 0 4px 0' }}>
            {compound.display_name}
          </h2>
          {aliasLine && (
            <div style={{ fontSize: '0.9rem', color: 'var(--silver, #A8B4C0)' }}>
              Also known as: {aliasLine}
            </div>
          )}
        </div>

        <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: 'var(--silver, #A8B4C0)', fontSize: '0.95rem', lineHeight: 1.5 }}>
          <div>
            <strong style={{ color: 'var(--white, #FFFFFF)' }}>Summary:</strong>{' '}
            <InteractiveGlossaryText text={compound.plain_summary || compound.eli5_summary || ''} />
          </div>

          {compound.mechanism && (
            <div>
              <strong style={{ color: 'var(--white, #FFFFFF)' }}>Mechanism of Action:</strong>{' '}
              <InteractiveGlossaryText text={compound.mechanism} />
            </div>
          )}

          {compound.pk_summary && (
            <div>
              <strong style={{ color: 'var(--white, #FFFFFF)' }}>Pharmacokinetics:</strong>{' '}
              <InteractiveGlossaryText text={compound.pk_summary} />
            </div>
          )}
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '8px' }}>
             <div>
               <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--silver, #A8B4C0)', fontWeight: 600 }}>Form</div>
               <div style={{ color: 'var(--white, #FFFFFF)', fontWeight: 500 }}>{compound.handling?.form || 'N/A'}</div>
             </div>
             <div>
               <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--silver, #A8B4C0)', fontWeight: 600 }}>Frequency</div>
               <div style={{ color: 'var(--white, #FFFFFF)', fontWeight: 500 }}>{compound.typical_frequency || 'N/A'}</div>
             </div>
          </div>
        </div>

        <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.1)', marginTop: '8px' }} />

        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <Link
            href={`/research/${compound.slug}`}
            style={{
              flex: 1,
              textAlign: 'center',
              background: 'var(--teal, #00C4BC)',
              color: 'var(--black, #0C151D)',
              padding: '12px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 800,
              transition: 'opacity 0.2s',
            }}
            onClick={onClose}
          >
            View Full Profile
          </Link>
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
    </div>
  );
}
