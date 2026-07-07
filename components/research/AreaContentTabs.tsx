'use client';

/**
 * AreaContentTabs - progressive disclosure for the Research Area hub page.
 * Tabs: Overview | Compounds | Evidence | Safety | References
 * Teal/black, Title Case, no emoji, 44px touch targets.
 */

import { useState, ReactNode } from 'react';


export interface AreaTab {
  key: string;
  label: string;
  children: ReactNode;
}

export default function AreaContentTabs({ tabs }: { tabs: AreaTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? '');

  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div>
      {/* Tab rail */}
      <nav
        role="tablist"
        aria-label="Area sections"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'rgba(5,10,15,0.92)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          padding: '10px 0',
          marginBottom: 'var(--space-5, 24px)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`area-content-tab-${t.key}`}
              aria-selected={isActive}
              aria-controls="area-content-tabpanel"
              onClick={() => setActive(t.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                minHeight: '44px',
                padding: '8px 18px',
                borderRadius: '9999px',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: isActive ? 'rgba(0,196,188,0.16)' : 'rgba(255,255,255,0.04)',
                border: `1.5px solid ${isActive ? 'var(--teal, #00C4BC)' : 'rgba(255,255,255,0.12)'}`,
                color: isActive ? 'var(--teal, #00C4BC)' : 'var(--silver, #D0DAE4)',
                transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                boxShadow: isActive ? '0 0 10px rgba(0,196,188,0.18)' : 'none',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* Active panel */}
      <div role="tabpanel" id="area-content-tabpanel" aria-labelledby={`area-content-tab-${active}`}>
        {current?.children}
      </div>
    </div>
  );
}
