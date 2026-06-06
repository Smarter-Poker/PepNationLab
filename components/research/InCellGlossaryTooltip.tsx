'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X, Info } from 'lucide-react';

// Hardcoded core glossary map for immediate comparison context
const GLOSSARY_MAP: Record<string, string> = {
  'Half-Life': 'The time required for a quantity to reduce to half of its initial value in the body.',
  'Molecular Weight': 'The mass of a molecule. Compounds under 500 Da are considered small molecules and typically have better oral bioavailability.',
  'Route': 'The method by which the compound is administered into the body (e.g., Subcutaneous, Oral, Intranasal).',
  'Evidence Tier': 'Our proprietary classification of the robustness of clinical and preclinical evidence supporting the compound.',
  'Mechanism': 'The specific biochemical interaction through which a substance produces its pharmacological effect.',
  'Reconstitution': 'The process of mixing a lyophilized (freeze-dried) powder with a diluent (like bacteriostatic water) before use.',
  'Storage': 'Recommended temperature and conditions to preserve the integrity and shelf-life of the compound.'
};

interface Props {
  term: string;
}

export default function InCellGlossaryTooltip({ term }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Case-insensitive lookup in GLOSSARY_MAP
  const matchedKey = Object.keys(GLOSSARY_MAP).find(
    (key) => key.toLowerCase() === term.toLowerCase()
  );
  const displayTitle = matchedKey || term;
  const definition = matchedKey ? GLOSSARY_MAP[matchedKey] : `Learn more about ${term} in the Glossary.`;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Disable body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          margin: 0,
          marginLeft: 6,
          display: 'inline-flex',
          alignItems: 'center',
          cursor: 'pointer',
          outline: 'none',
          verticalAlign: 'middle',
        }}
        aria-label={`View explanation for ${term}`}
      >
        <HelpCircle size={14} color="rgba(255,255,255,0.4)" style={{ cursor: 'help' }} />
      </button>
      
      {open && mounted && createPortal(
        <div 
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          {/* Framed pop up with Brushed Nickel finish */}
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '360px',
              borderRadius: '16px',
              padding: '24px',
              background: 'rgba(15, 25, 35, 0.95)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05)',
              backdropFilter: 'blur(20px)',
              // Brushed Nickel Border
              border: '3.5px solid transparent',
              backgroundImage: 'linear-gradient(rgba(15, 25, 35, 0.95), rgba(15, 25, 35, 0.95)), linear-gradient(135deg, #4f5660 0%, #aab2bd 20%, #f5f7fa 40%, #7e8794 60%, #cbd2db 80%, #4f5660 100%)',
              backgroundOrigin: 'border-box',
              backgroundClip: 'padding-box, border-box',
              animation: 'scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
                outline: 'none',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.color = '#FFF';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
              }}
            >
              <X size={14} />
            </button>

            {/* Content */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'rgba(0,196,188,0.1)',
                border: '1px solid rgba(0,196,188,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Info size={16} color="#00C4BC" />
              </div>
              <h3 style={{
                margin: 0,
                fontSize: '1.15rem',
                fontWeight: 900,
                color: '#FFF',
                fontFamily: 'var(--font-brand, system-ui, sans-serif)',
                letterSpacing: '0.02em',
              }}>
                {displayTitle}
              </h3>
            </div>

            <p style={{
              margin: 0,
              fontSize: '0.88rem',
              color: 'rgba(255,255,255,0.75)',
              lineHeight: 1.6,
              fontWeight: 400,
            }}>
              {definition}
            </p>
          </div>
        </div>,
        document.body
      )}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
}
