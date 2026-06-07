'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface IframeModalProps {
  url: string;
  title?: string;
  onClose: () => void;
}

export default function IframeModal({ url, title, onClose }: IframeModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Prevent scrolling on the body when modal is open
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  const domain = useMemo(() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }, [url]);

  const modalContent = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100dvh',
          zIndex: 999999, // Max z-index to stay above everything
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes pn-progress {
            0% { width: 0%; opacity: 1; }
            80% { width: 85%; opacity: 1; }
            100% { width: 85%; opacity: 0.7; }
          }
          @keyframes pn-shimmer {
            0% { background-position: -1000px 0; }
            100% { background-position: 1000px 0; }
          }
        `}} />

        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 24px',
            backgroundColor: '#020617', // Solid dark color for header
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 16px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: 'var(--white, #FFFFFF)',
                borderRadius: '999px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)')}
            >
              ← Back
            </button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 0 }}>
              {title && (
                <div style={{ color: '#FFFFFF', fontSize: '0.95rem', fontWeight: 600, maxWidth: '400px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {title}
                </div>
              )}
              <div style={{ color: '#A8B4C0', fontSize: title ? '0.75rem' : '0.9rem', fontWeight: 600, maxWidth: '400px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {domain}
              </div>
            </div>
            
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: '#00C4BC',
                color: '#020617',
                borderRadius: '999px',
                fontSize: '0.85rem',
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'opacity 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
            >
              Open Original <ExternalLink size={14} />
            </a>
          </div>
        </div>

        {/* Loading Progress Bar */}
        {loading && (
          <div style={{ height: '3px', width: '100%', background: 'transparent' }}>
            <div style={{
              height: '100%',
              background: '#00C4BC',
              animation: 'pn-progress 10s cubic-bezier(0.1, 0.8, 0.3, 1) forwards'
            }} />
          </div>
        )}

        {/* Iframe Container */}
        <div style={{ flex: 1, backgroundColor: '#FFFFFF', position: 'relative' }}>
          
          {loading && (
            <div style={{ position: 'absolute', top: 40, left: 0, right: 0, display: 'flex', flexDirection: 'column', gap: 16, padding: '0 max(5vw, 40px)', maxWidth: 800, margin: '0 auto' }}>
              <div style={{ height: 40, width: '80%', background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)', backgroundSize: '1000px 100%', animation: 'pn-shimmer 2s infinite linear', borderRadius: 4, marginBottom: 20 }} />
              {[...Array(8)].map((_, i) => (
                <div key={i} style={{ height: 16, width: i === 7 ? '60%' : '100%', background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)', backgroundSize: '1000px 100%', animation: 'pn-shimmer 2s infinite linear', borderRadius: 4 }} />
              ))}
            </div>
          )}

          {error && (
             <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#333' }}>
               <AlertTriangle size={48} color="#FF6B6B" style={{ marginBottom: 16 }} />
               <h3 style={{ margin: '0 0 8px 0' }}>Failed to load document</h3>
               <p style={{ margin: 0, color: '#666' }}>The publisher may be blocking embedded viewers.</p>
               <a href={url} target="_blank" rel="noopener noreferrer" style={{ marginTop: 16, display: 'inline-block', background: '#00C4BC', color: '#000', padding: '8px 16px', borderRadius: 4, textDecoration: 'none', fontWeight: 'bold' }}>Open in New Tab</a>
             </div>
          )}

          <iframe
            src={'/api/proxy?url=' + encodeURIComponent(url)}
            style={{ width: '100%', height: '100%', border: 'none', display: 'block', opacity: loading ? 0 : 1, transition: 'opacity 0.3s ease' }}
            referrerPolicy="origin-when-cross-origin"
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
            title="External Link Viewer"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );

  // Need to ensure we only run createPortal on the client
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);
  
  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}
