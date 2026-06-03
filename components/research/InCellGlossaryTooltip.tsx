'use client';

import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

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
  
  const definition = GLOSSARY_MAP[term] || `Learn more about ${term} in the Glossary.`;

  return (
    <div 
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 6 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen(!open)}
    >
      <HelpCircle size={14} color="rgba(255,255,255,0.4)" style={{ cursor: 'help' }} />
      
      {open && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: 8,
          width: 220,
          padding: '10px 14px',
          background: 'var(--surface-1)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          zIndex: 100,
          color: 'var(--silver)',
          fontSize: '0.75rem',
          lineHeight: 1.4,
          fontWeight: 400,
          pointerEvents: 'none'
        }}>
          <div style={{ fontWeight: 600, color: 'var(--white)', marginBottom: 4 }}>{term}</div>
          {definition}
          <div style={{
            position: 'absolute',
            bottom: -5,
            left: '50%',
            transform: 'translateX(-50%) rotate(45deg)',
            width: 10,
            height: 10,
            background: 'var(--surface-1)',
            borderRight: '1px solid rgba(255,255,255,0.1)',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }} />
        </div>
      )}
    </div>
  );
}
