'use client';

import React, { useState } from 'react';
import IframeModal from '@/components/ui/IframeModal';
import { ExternalLink, BookOpen } from 'lucide-react';
import { isSocialPlatformUrl } from '@/lib/ArticleProxyUtils';

interface Reference {
  citation: string;
  url?: string;
}

export default function AreaReferencesClient({ references }: { references: Reference[] }) {
  const [modalUrl, setModalUrl] = useState<string | null>(null);

  if (!references || references.length === 0) return null;

  return (
    <section className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)' }}>
      <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--white, #FFFFFF)', margin: 0, marginBottom: 'var(--space-4, 16px)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <BookOpen size={18} style={{ color: 'var(--teal, #00C4BC)' }} />
        Key References
      </h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
        {references.map((r, i) => (
          <article
            key={i}
            style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: 'var(--radius-md, 8px)',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start',
            }}
          >
            <div style={{ 
              color: 'var(--teal, #00C4BC)', 
              fontWeight: 800, 
              fontSize: '0.9rem',
              backgroundColor: 'rgba(0, 196, 188, 0.1)',
              padding: '2px 8px',
              borderRadius: '4px',
              minWidth: '28px',
              textAlign: 'center'
            }}>
              {i + 1}
            </div>
            
            <div style={{ flex: 1 }}>
              <p style={{ 
                margin: 0, 
                fontSize: '0.92rem', 
                color: 'var(--silver-light, #D0DAE4)',
                lineHeight: 1.6 
              }}>
                {r.citation}
              </p>
              
              {r.url && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    (isSocialPlatformUrl(r.url!) ? window.open(r.url!, '_blank') : setModalUrl(r.url!));
                  }}
                  style={{
                    marginTop: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.8rem',
                    color: 'var(--teal, #00C4BC)',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    textTransform: 'none'
                  }}
                >
                  <ExternalLink size={14} />
                  View Source Document
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      {modalUrl && (
        <IframeModal url={modalUrl} onClose={() => setModalUrl(null)} />
      )}
    </section>
  );
}
