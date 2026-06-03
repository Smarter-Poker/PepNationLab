'use client';

/**
 * ReferencesBrowser — searchable list of every source cited across the catalog.
 * Each reference links out via the global in-app overlay (data-inapp="1"), so
 * the user is never redirected away from pepnationlab.com.
 *
 * Research-Use-Only. Title Case, no emojis.
 */

import { useMemo, useState } from 'react';

export interface RefEntry {
  url: string;
  host: string;
  citedBy: { slug: string; name: string }[];
}

export default function ReferencesBrowser({ refs }: { refs: RefEntry[] }) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return refs;
    return refs.filter(
      (r) =>
        r.url.toLowerCase().includes(term) ||
        r.host.toLowerCase().includes(term) ||
        r.citedBy.some((c) => c.name.toLowerCase().includes(term)),
    );
  }, [q, refs]);

  return (
    <div>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search By Source, Domain, Or Compound Name"
        aria-label="Search References"
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.16)',
          borderRadius: '12px',
          color: '#FFFFFF',
          padding: '14px 16px',
          fontSize: '16px',
          marginBottom: 'var(--space-3, 12px)',
        }}
      />
      <p style={{ fontSize: '0.8rem', color: 'var(--silver, #A8B4C0)', margin: '0 0 var(--space-5, 24px)' }}>
        {filtered.length} Source{filtered.length === 1 ? '' : 's'}{q.trim() ? ' Matched' : ' Across The Catalog'}
      </p>

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
        {filtered.map((r) => (
          <li
            key={r.url}
            className="glass-panel"
            style={{ borderRadius: 'var(--radius-lg, 12px)', padding: 'var(--space-4, 16px)' }}
          >
            <a
              href={r.url}
              data-inapp="1"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--teal, #00C4BC)', fontWeight: 700, fontSize: '0.95rem', wordBreak: 'break-all', textDecoration: 'none' }}
            >
              {r.url}
            </a>
            <div style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--silver, #A8B4C0)' }}>
              Cited By:{' '}
              {r.citedBy.map((c, i) => (
                <span key={c.slug}>
                  {i > 0 ? ', ' : ''}
                  <a href={`/research/${c.slug}`} style={{ color: 'var(--silver, #D0DAE4)', textDecoration: 'underline' }}>
                    {c.name}
                  </a>
                </span>
              ))}
            </div>
          </li>
        ))}
      </ol>

      {filtered.length === 0 && (
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.95rem' }}>No Sources Matched That Search.</p>
      )}
    </div>
  );
}
