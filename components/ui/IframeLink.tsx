'use client';

import React, { useState } from 'react';
import IframeModal from '@/components/ui/IframeModal';

export default function IframeLink({ 
  href, 
  children, 
  style 
}: { 
  href: string; 
  children: React.ReactNode; 
  style?: React.CSSProperties 
}) {
  const [modalUrl, setModalUrl] = useState<string | null>(null);
  
  return (
    <>
      <button 
        type="button"
        onClick={() => setModalUrl(href)} 
        style={{ 
          background: 'none', 
          border: 'none', 
          padding: 0, 
          cursor: 'pointer', 
          textAlign: 'left', 
          textDecoration: 'underline', 
          fontFamily: 'inherit',
          ...style 
        }}
      >
        {children}
      </button>
      {modalUrl && <IframeModal url={modalUrl} onClose={() => setModalUrl(null)} />}
    </>
  );
}
