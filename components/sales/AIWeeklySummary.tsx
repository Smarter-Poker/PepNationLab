'use client';

import { useEffect, useState } from 'react';

export default function AIWeeklySummary() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/agent/sales/ai-summary', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => j && setText(j.summary));
  }, []);

  if (!text) return null;
  return (
    <div className="glass-panel">
      <div className="" style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
          <h3 style={{ color: 'var(--white)', fontSize: '0.95rem', margin: 0 }}>Weekly Summary</h3>
          <span style={{ color: 'var(--grey-500)', fontSize: '0.7rem' }}>Last 7 Days</span>
        </div>
        <p style={{ color: 'var(--grey-200)', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>{text}</p>
      </div>
    </div>
  );
}
