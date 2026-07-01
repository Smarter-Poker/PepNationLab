'use client';

import React, { useEffect, useState } from 'react';
import mermaid from 'mermaid';

export default function MermaidDiagram({ chart }: { chart: string }) {
  const [svgContent, setSvgContent] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
    });

    const renderChart = async () => {
      setLoading(true);
      setError(false);
      try {
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, chart);
        setSvgContent(svg);
      } catch (err) {
        console.error('Mermaid render error:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    renderChart();
  }, [chart]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '40px 20px',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.05)',
          color: '#A8B4C0',
          fontSize: '0.85rem',
        }}
      >
        Loading Diagram...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '40px 20px',
          background: 'rgba(229,62,62,0.05)',
          borderRadius: '12px',
          border: '1px solid rgba(229,62,62,0.2)',
          color: '#FC8181',
          fontSize: '0.85rem',
        }}
      >
        Diagram Could Not Be Rendered.
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '20px',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.05)',
        overflowX: 'auto',
      }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}
