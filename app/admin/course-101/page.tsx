'use client';

import { useEffect, useState } from 'react';

interface Funnel {
  id: string;
  title: string;
  completed: number;
}
interface Data {
  enrolled: number;
  certified: number;
  completionRate: number;
  avgModules: number;
  avgScore: number;
  totalModules: number;
  funnel: Funnel[];
}

export default function Course101Analytics() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/course-analytics')
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          setErr(j.error || 'Failed To Load Analytics.');
          return;
        }
        setD(await r.json());
      })
      .catch(() => setErr('Failed To Load Analytics.'));
  }, []);

  if (err)
    return (
      <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Peptide 101 - Course Analytics</h1>
        <p style={{ color: '#E53E3E' }}>{err}</p>
      </div>
    );
  if (!d) return <div style={{ padding: 24 }}>Loading...</div>;

  const max = Math.max(1, d.enrolled, ...d.funnel.map((f) => f.completed));
  const cards: [string, string | number][] = [
    ['Enrolled', d.enrolled],
    ['Certified', d.certified],
    ['Completion Rate', d.completionRate + '%'],
    ['Avg Modules', d.avgModules + ' / ' + d.totalModules],
    ['Avg Assessment', d.avgScore + '%'],
  ];

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Peptide 101 - Course Analytics</h1>
      <p style={{ color: '#A8B4C0', marginBottom: 20, fontSize: 14 }}>
        Account-Bound Completion Funnel And Certification, From The Course Progress Table.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {cards.map(([l, v]) => (
          <div
            key={l}
            style={{
              padding: 16,
              borderRadius: 12,
              background: '#0F1923',
              border: '1px solid #1D2D3E',
            }}
          >
            <div style={{ fontSize: 26, fontWeight: 800, color: '#00C4BC' }}>{v}</div>
            <div style={{ fontSize: 12, color: '#A8B4C0' }}>{l}</div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 10 }}>Module Completion Funnel</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {d.funnel.map((f) => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 200, fontSize: 13, color: '#D0DAE4' }}>{f.title}</div>
            <div
              style={{
                flex: 1,
                background: '#0F1923',
                borderRadius: 6,
                overflow: 'hidden',
                height: 22,
              }}
            >
              <div
                style={{
                  width: `${Math.round((f.completed / max) * 100)}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg,#00C4BC,#3B82F6)',
                }}
              />
            </div>
            <div style={{ width: 40, textAlign: 'right', fontSize: 13, color: '#A8B4C0' }}>
              {f.completed}
            </div>
          </div>
        ))}
      </div>

      {d.enrolled === 0 && (
        <p style={{ marginTop: 16, color: '#A8B4C0', fontSize: 13 }}>
          No Researchers Have Started The Course Yet.
        </p>
      )}
    </div>
  );
}
