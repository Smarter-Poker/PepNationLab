'use client';

/**
 * LearnGuidesExplorer — progressive-disclosure view of the education guides.
 * Instead of rendering all guides as one endless scroll, the reader picks a
 * single guide from a button rail and sees only that guide's sections. Keeps
 * the platform style (teal/black, Title Case, no emoji, 44px touch targets).
 * Research-Use-Only.
 */

import { useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { LEARN_GUIDES } from '@/lib/research-education';

export default function LearnGuidesExplorer() {
  const guides = LEARN_GUIDES;
  const [activeSlug, setActiveSlug] = useState(guides[0]?.slug ?? '');
  const active = guides.find((g) => g.slug === activeSlug) ?? guides[0];

  if (!active) return null;

  return (
    <div>
      {/* Category button rail — pick one guide */}
      <nav
        aria-label="Guides"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-2, 8px)',
          marginBottom: 'var(--space-5, 24px)',
        }}
      >
        {guides.map((g) => {
          const isActive = g.slug === active.slug;
          return (
            <button
              key={g.slug}
              type="button"
              onClick={() => setActiveSlug(g.slug)}
              aria-pressed={isActive}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
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
              {g.title}
            </button>
          );
        })}
      </nav>

      {/* Active guide only */}
      <article key={active.slug}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--white, #FFFFFF)', margin: '0 0 var(--space-2, 8px)' }}>
          <GraduationCap size={20} aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 8, color: 'var(--teal, #00C4BC)' }} />
          {active.title}
        </h2>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1rem', lineHeight: 1.6, margin: '0 0 var(--space-4, 16px)' }}>
          {active.intro}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
          {active.sections.map((s, i) => (
            <div key={i} className="card-glass" style={{ padding: 'var(--space-4, 16px)', borderRadius: 'var(--radius-lg, 12px)' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--teal, #00C4BC)', margin: '0 0 var(--space-2, 8px)' }}>
                {s.heading}
              </h3>
              {s.body.split('\n\n').map((para, j) => (
                <p key={j} style={{ color: 'var(--silver, #D0DAE4)', fontSize: '0.95rem', lineHeight: 1.6, margin: j === 0 ? 0 : 'var(--space-2, 8px) 0 0' }}>
                  {para}
                </p>
              ))}
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}
