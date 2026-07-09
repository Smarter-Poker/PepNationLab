'use client';

import React, { useEffect, useState } from 'react';
import { reportClientError } from '@/lib/report-client-error';

export default function MermaidDiagram({ chart }: { chart: string }) {
  const [svgContent, setSvgContent] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const renderChart = async () => {
      setLoading(true);
      setError(false);
      try {
        // mermaid is ~1MB -- by far the heaviest dependency on the research area
        // pages. Load it only when a diagram actually renders, not with the route.
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          // 'strict' keeps mermaid's built-in DOMPurify sanitization of rendered
          // SVG and disables click/script directives. Charts are developer-authored
          // today, but 'strict' means a future dynamic chart source can't become an
          // XSS sink. (Was 'loose', which disables that sanitization.)
          securityLevel: 'strict',
        });

        const id = `mermaid-${Math.random().toString(36).substring(2, 11)}`;
        const { svg } = await mermaid.render(id, chart);
        if (!cancelled) setSvgContent(svg);
      } catch (err) {
        if (!cancelled) setError(true);
        reportClientError('research.mermaid-diagram', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    renderChart();
    return () => { cancelled = true; };
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
