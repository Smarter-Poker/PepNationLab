'use client';

import React, { useState } from 'react';
import IframeModal from '@/components/ui/IframeModal';
import CitationExportButton from '@/components/research/CitationExportButton';

interface ReferenceRow {
  id: string;
  compound_slug: string;
  ref_type: string | null;
  authors: string | string[] | null;
  title: string | null;
  journal: string | null;
  year: number | string | null;
  pmid: string | null;
  doi: string | null;
  url: string | null;
  volume: string | null;
  pages: string | null;
  is_pivotal?: boolean | null;
}

interface CompoundReferencesClientProps {
  references: ReferenceRow[];
  slug: string;
}

export default function CompoundReferencesClient({ references, slug }: CompoundReferencesClientProps) {
  const [modalUrl, setModalUrl] = useState<string | null>(null);

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
        {references.map((r) => {
          const authorsLine = Array.isArray(r.authors) ? r.authors.join(', ') : (r.authors ?? 'Unknown Authors');
          return (
            <article
              key={r.id}
              className="glass-panel"
              style={{
                padding: 'var(--space-4, 16px) var(--space-5, 24px)',
                borderRadius: 'var(--radius-lg, 12px)',
                borderLeft: r.is_pivotal ? '3px solid var(--teal, #00C4BC)' : '3px solid rgba(168,180,192,0.18)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3, 12px)', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--silver, #A8B4C0)', marginBottom: 4 }}>
                    {r.year ?? 'n.d.'}
                    {r.ref_type ? ` - ${r.ref_type}` : ''}
                    {r.is_pivotal ? ' - Pivotal Reference' : ''}
                  </div>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--white, #FFFFFF)', margin: 0 }}>
                    {r.title ?? 'Untitled'}
                  </h2>
                  <p style={{ fontSize: '0.88rem', color: 'var(--silver-light, #D0DAE4)', margin: '6px 0 0', lineHeight: 1.55 }}>
                    {authorsLine}
                    {r.journal ? `. ${r.journal}` : ''}
                    {r.volume ? `, Vol. ${r.volume}` : ''}
                    {r.pages ? `, pp. ${r.pages}` : ''}.
                  </p>
                  
                  <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: '0.82rem' }}>
                    {r.doi && (
                      <button 
                        onClick={() => setModalUrl(`https://doi.org/${encodeURIComponent(r.doi!)}`)}
                        style={{ 
                          color: 'var(--teal, #00C4BC)', 
                          textDecoration: 'none',
                          background: 'transparent',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          fontWeight: 600,
                          textTransform: 'none'
                        }}
                      >
                        DOI: {r.doi}
                      </button>
                    )}
                    {r.pmid && (
                      <button 
                        onClick={() => setModalUrl(`https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(r.pmid!)}/`)}
                        style={{ 
                          color: 'var(--teal, #00C4BC)', 
                          textDecoration: 'none',
                          background: 'transparent',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          fontWeight: 600,
                          textTransform: 'none'
                        }}
                      >
                        PMID: {r.pmid}
                      </button>
                    )}
                    {r.url && !r.doi && (
                      <button 
                        onClick={() => setModalUrl(r.url!)}
                        style={{ 
                          color: 'var(--teal, #00C4BC)', 
                          textDecoration: 'none',
                          background: 'transparent',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          fontWeight: 600,
                          textTransform: 'none'
                        }}
                      >
                        Source
                      </button>
                    )}
                  </div>
                </div>
                <CitationExportButton reference={r} filenameBase={`${slug}-${r.id}`} />
              </div>
            </article>
          );
        })}
      </div>
      
      {modalUrl && (
        <IframeModal url={modalUrl} onClose={() => setModalUrl(null)} />
      )}
    </>
  );
}
