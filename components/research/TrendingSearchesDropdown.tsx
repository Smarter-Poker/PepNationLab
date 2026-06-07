'use client';

import { Sparkles } from 'lucide-react';

export default function TrendingSearchesDropdown({
  onSelect,
  style,
  terms = ['BPC-157', 'Tirzepatide', 'Weight Loss', 'Tesamorelin', 'NAD+', 'GHK-Cu']
}: {
  onSelect: (term: string) => void;
  style?: React.CSSProperties;
  terms?: string[];
}) {
  return (
    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: '8px', ...style }}>
      <div style={{ background: 'rgba(15, 20, 25, 0.98)', backdropFilter: 'blur(10px)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
        <h4 style={{ color: 'var(--grey-400)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
          <Sparkles size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Trending Searches
        </h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {terms.map(term => (
            <button
              key={term}
              type="button"
              onClick={() => onSelect(term)}
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--white)', padding: '6px 12px', borderRadius: '100px',
                fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              }}
            >
              {term}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
