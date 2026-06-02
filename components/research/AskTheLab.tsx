'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, Search } from 'lucide-react';
import { evidenceTier } from '@/lib/compounds';

interface AskMatch {
  slug: string;
  name: string;
  evidence_tier: string;
  composed: string;
}

interface AskResponse {
  matches: AskMatch[];
  message?: string;
  note?: string;
}

export default function AskTheLab() {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResponse | null>(null);

  async function ask() {
    const query = q.trim();
    if (!query) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/research/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query }),
      });
      const data = (await res.json()) as AskResponse;
      setResult(data);
    } catch {
      setResult({ matches: [], message: 'Something Went Wrong. Please Try Again.' });
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      ask();
    }
  }

  return (
    <div className="card-metal" style={{ padding: 0 }}>
      <div className="metal-frame">
        <div className="metal-content" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
            <Sparkles size={22} color="#00C4BC" aria-hidden="true" />
            <h2 style={{ margin: 0, color: '#FFFFFF', fontSize: '1.35rem', fontWeight: 700 }}>Ask The Lab</h2>
          </div>
          <p style={{ margin: '0 0 var(--space-4)', color: '#A8B4C0', fontSize: '0.95rem' }}>
            Ask About A Compound By Name And Get The Stored Laboratory Facts. Research Use Only.
          </p>

          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Try A Compound Name Or Mechanism"
              aria-label="Ask The Lab Query"
              style={{
                flex: '1 1 240px',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #1D2D3E',
                background: '#0F1923',
                color: '#FFFFFF',
                fontSize: '1rem',
              }}
            />
            <button
              type="button"
              className="btn-primary"
              onClick={ask}
              disabled={loading || !q.trim()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Search size={18} aria-hidden="true" />
              {loading ? 'Asking' : 'Ask'}
            </button>
          </div>

          {loading && (
            <p style={{ marginTop: 'var(--space-4)', color: '#A8B4C0' }}>Searching The Compound Library</p>
          )}

          {!loading && result && result.matches.length === 0 && (
            <p style={{ marginTop: 'var(--space-4)', color: '#A8B4C0' }}>
              {result.message ?? 'No Matching Compound Found. Try A Compound Name.'}
            </p>
          )}

          {!loading && result && result.matches.length > 0 && (
            <div style={{ marginTop: 'var(--space-5)', display: 'grid', gap: 'var(--space-4)' }}>
              {result.matches.map((m) => {
                const tier = evidenceTier(m.evidence_tier);
                return (
                  <div
                    key={m.slug}
                    style={{
                      padding: 'var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      background: '#0F1923',
                      border: '1px solid #1D2D3E',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                      <Link
                        href={`/research/${m.slug}`}
                        style={{ color: '#00C4BC', fontWeight: 700, fontSize: '1.1rem', textDecoration: 'none' }}
                      >
                        {m.name}
                      </Link>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.6rem',
                          borderRadius: '999px',
                          color: tier.color,
                          border: `1px solid ${tier.color}`,
                          background: 'rgba(0,0,0,0.2)',
                        }}
                      >
                        {tier.label}
                      </span>
                    </div>
                    <p style={{ margin: 'var(--space-3) 0 0', color: '#D0DAE4', lineHeight: 1.55 }}>{m.composed}</p>
                  </div>
                );
              })}
              {result.note && (
                <p style={{ margin: 0, color: '#A8B4C0', fontSize: '0.85rem', fontStyle: 'italic' }}>{result.note}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
