'use client';

/**
 * BrowseFilterShell - universal progressive-disclosure wrapper for browse pages.
 *
 * Accepts an array of { key, label, count, children } groups. Renders a sticky
 * button rail; clicking a tab reveals only that group's content. Default is the
 * first non-empty group. Teal/black, Title Case, no emoji, 44 px touch targets.
 */

import { useState, ReactNode } from 'react';

export interface BrowseGroup {
  key: string;
  /** Display name shown on the button */
  label: string;
  /** Item count shown as a badge - pass 0 to still show the group */
  count: number;
  children: ReactNode;
}

export default function BrowseFilterShell({
  groups,
  emptyMessage = 'No data in this category yet.',
}: {
  groups: BrowseGroup[];
  emptyMessage?: string;
}) {
  const [active, setActive] = useState(() => groups.find((g) => g.count > 0)?.key ?? groups[0]?.key ?? '');

  if (groups.length === 0) {
    return (
      <div
        className="glass-panel"
        style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', color: 'var(--silver, #A8B4C0)' }}
      >
        {emptyMessage}
      </div>
    );
  }

  const current = groups.find((g) => g.key === active) ?? groups[0];

  return (
    <div>
      {/* ── Tab button rail ── */}
      <nav
        role="tablist"
        aria-label="Category filter"
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
        }}
      >
        {groups.map((g) => {
          const isActive = g.key === active;
          return (
            <button
              key={g.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(g.key)}
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
              {g.label}
              {g.count > 0 && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    color: isActive ? 'var(--teal, #00C4BC)' : 'var(--silver, #A8B4C0)',
                    background: 'rgba(255,255,255,0.07)',
                    borderRadius: '999px',
                    padding: '1px 8px',
                    minWidth: '22px',
                    textAlign: 'center',
                  }}
                >
                  {g.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Active group content ── */}
      <div role="tabpanel" aria-label={current.label}>
        {current.count === 0 ? (
          <div
            className="glass-panel"
            style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', color: 'var(--silver, #A8B4C0)' }}
          >
            {emptyMessage}
          </div>
        ) : (
          current.children
        )}
      </div>
    </div>
  );
}
