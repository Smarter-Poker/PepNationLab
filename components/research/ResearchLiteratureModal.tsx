"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, BookOpen, ExternalLink, AlertTriangle, Loader2 } from 'lucide-react';

interface Paper {
  uid: string;
  title: string;
  authors: string;
  journal: string;
  pubdate: string;
}

interface ResearchLiteratureModalProps {
  query: string;
  onClose: () => void;
  onSelectPaper: (pmid: string) => void;
}

export function ResearchLiteratureModal({ query, onClose, onSelectPaper }: ResearchLiteratureModalProps) {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchPapers() {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch PMIDs
        const searchRes = await fetch(`/api/pubmed?action=esearch&term=${encodeURIComponent(query)}`);
        if (!searchRes.ok) throw new Error('Failed to fetch from PubMed');
        const searchData = await searchRes.json();
        const idList = searchData.esearchresult?.idlist || [];

        if (idList.length === 0) {
          if (isMounted) setPapers([]);
          return;
        }

        // 2. Fetch Summaries
        const summaryRes = await fetch(`/api/pubmed?action=esummary&id=${idList.join(',')}`);
        if (!summaryRes.ok) throw new Error('Failed to fetch paper details');
        const summaryData = await summaryRes.json();

        if (isMounted) {
          const results = summaryData.result || {};
          const loadedPapers = idList.map((id: string) => {
            const paperData = results[id];
            if (!paperData) return null;
            return {
              uid: id,
              title: paperData.title,
              authors: paperData.authors?.map((a: any) => a.name).join(', ') || 'Unknown Authors',
              journal: paperData.source || 'Unknown Journal',
              pubdate: paperData.pubdate || 'Unknown Date',
            };
          }).filter(Boolean) as Paper[];

          setPapers(loadedPapers);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'An error occurred while fetching papers');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchPapers();
    return () => { isMounted = false; };
  }, [query]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 999999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(8px)',
      padding: 16
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        style={{
          background: '#11151A',
          border: '1px solid #2A3441',
          borderRadius: 24,
          width: '100%',
          maxWidth: 800,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{ padding: '24px 32px', borderBottom: '1px solid #2A3441', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(0, 229, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BookOpen size={20} color="#00E5FF" />
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#FFF', margin: 0 }}>Scientific Literature</h2>
            </div>
            <p style={{ color: '#A8B4C0', fontSize: '0.9rem', margin: 0, paddingLeft: 52 }}>
              Displaying top PubMed results for: <strong style={{ color: '#E2E8F0' }}>{query}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: 'none',
              width: 40,
              height: 40,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#A8B4C0',
              transition: 'all 0.2s'
            }}
            onMouseOver={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              e.currentTarget.style.color = '#FFF';
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              e.currentTarget.style.color = '#A8B4C0';
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Area */}
        <div style={{ padding: 32, overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0' }}>
              <Loader2 size={48} color="#00E5FF" style={{ animation: 'spin 1s linear infinite', marginBottom: 24 }} />
              <div style={{ color: '#A8B4C0', fontSize: '1.1rem', fontWeight: 600 }}>Querying the National Library of Medicine...</div>
              <div style={{ color: '#5A6B7D', fontSize: '0.9rem', marginTop: 8 }}>Fetching peer-reviewed papers via NCBI E-utilities</div>
            </div>
          ) : error ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', color: '#FF6B6B' }}>
              <AlertTriangle size={48} style={{ marginBottom: 16 }} />
              <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>Failed to load literature</div>
              <div style={{ opacity: 0.8, marginTop: 8 }}>{error}</div>
            </div>
          ) : papers.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', color: '#A8B4C0' }}>
              <BookOpen size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
              <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>No papers found</div>
              <div style={{ opacity: 0.7, marginTop: 8 }}>We couldn't find any direct matches in PubMed for this combination.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {papers.map((paper, index) => (
                <motion.button
                  key={paper.uid}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => onSelectPaper(paper.uid)}
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 16,
                    padding: 24,
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0, 229, 255, 0.08) 0%, rgba(0, 229, 255, 0.02) 100%)';
                    e.currentTarget.style.borderColor = 'rgba(0, 229, 255, 0.3)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                    <h3 style={{ color: '#FFF', fontSize: '1.15rem', fontWeight: 700, margin: 0, lineHeight: 1.4 }}>
                      {paper.title}
                    </h3>
                    <ExternalLink size={20} color="#00E5FF" style={{ flexShrink: 0, opacity: 0.8 }} />
                  </div>
                  
                  <div style={{ color: '#E2E8F0', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    {paper.authors}
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                    <span style={{ background: 'rgba(255,255,255,0.1)', color: '#A8B4C0', padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {paper.journal}
                    </span>
                    <span style={{ color: '#5A6B7D', fontSize: '0.85rem', fontWeight: 500 }}>
                      {paper.pubdate}
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div style={{ padding: '16px 32px', borderTop: '1px solid #2A3441', background: '#0D1115', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#5A6B7D', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            Powered by NCBI E-utilities API
          </div>
        </div>
      </motion.div>
    </div>
  );
}
