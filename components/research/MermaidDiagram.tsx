'use client';

import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

export default function MermaidDiagram({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'dark',
      securityLevel: 'loose',
    });
    if (containerRef.current) {
      mermaid.init(undefined, containerRef.current);
    }
  }, [chart]);

  return (
    <div
      className="mermaid"
      ref={containerRef}
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '20px',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.05)',
        overflowX: 'auto',
      }}
    >
      {chart}
    </div>
  );
}
