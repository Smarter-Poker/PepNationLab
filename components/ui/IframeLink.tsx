'use client';

import React, { useState } from 'react';
import IframeModal from '@/components/ui/IframeModal';
import { isSocialPlatformUrl } from '@/lib/ArticleProxyUtils';

interface IframeLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
}

export default function IframeLink({ 
  href, 
  children, 
  style,
  className,
  onClick,
  ...props
}: IframeLinkProps) {
  const [modalUrl, setModalUrl] = useState<string | null>(null);
  
  return (
    <>
      <button 
        type="button"
        onClick={(e) => {
          if (onClick) onClick(e as any);
          (isSocialPlatformUrl(href) ? window.open(href, '_blank') : setModalUrl(href));
        }} 
        className={className}
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
        {...(props as any)}
      >
        {children}
      </button>
      {modalUrl && <IframeModal url={modalUrl} onClose={() => setModalUrl(null)} />}
    </>
  );
}
