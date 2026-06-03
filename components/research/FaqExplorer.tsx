'use client';

/**
 * FaqExplorer — progressive-disclosure FAQ. The reader picks one category from
 * a button rail and sees only that category's questions (each still a collapsed
 * disclosure), instead of every category at once. Teal/black, Title Case, no
 * emoji, 44px touch targets. Research-Use-Only.
 */

import { useState } from 'react';

export interface FaqItem {
  q: string;
  a: string;
  category: string;
}

export default function FaqExplorer({ items, categories }: { items: FaqItem[]; categories: string[] }) {
  const [active, setActive] = useState(categories[0] ?? '');

  const byCat: Record<string, FaqItem[]> = {};
  for (const f of items) (byCat[f.category] ||= []).push(f);
  const cats = categories.filter((c) => byCat[c]?.length);
  const current = byCat[active] ?? byCat[cats[0]] ?? [];

  return (
    <div>
      {/* Category button rail */}
      <div role="tablist" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-5, 24px)' }}>
        {cats.map((cat) => {
          const isActive = cat === active;
          return (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(cat)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                minHeight: '44px',
                padding: '8px 16px',
                borderRadius: '9999px',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: isActive ? 'rgba(0,196,188,0.16)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isActive ? 'var(--teal, #00C4BC)' : 'rgba(255,255,255,0.14)'}`,
                color: isActive ? 'var(--teal, #00C4BC)' : 'var(--silver, #D0DAE4)',
                transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
              }}
            >
              {cat}
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: isActive ? 'var(--teal, #00C4BC)' : 'var(--silver, #A8B4C0)', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', padding: '1px 8px' }}>
                {byCat[cat].length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active category questions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)' }}>
        {current.map((f, i) => (
          <details key={i} className="glass-panel" style={{ borderRadius: 'var(--radius-lg, 12px)', padding: 'var(--space-3, 12px) var(--space-4, 16px)' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700, color: 'var(--white, #FFFFFF)', fontSize: '0.98rem', listStyle: 'revert' }}>
              {f.q}
            </summary>
            <p style={{ margin: 'var(--space-2, 8px) 0 0', color: 'var(--silver, #A8B4C0)', fontSize: '0.93rem', lineHeight: 1.6 }}>{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
