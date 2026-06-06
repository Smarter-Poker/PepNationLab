'use client';

/**
 * PlainTechnicalToggle - two-button switch between a plain-language summary and
 * the technical view (children). If `plain` is null the toggle is hidden and
 * children render alone. Defaults to the Technical view.
 */
import { useState } from 'react';

export default function PlainTechnicalToggle({
  plain,
  children,
}: {
  plain: string | null;
  children: React.ReactNode;
}) {
  const [view, setView] = useState<'plain' | 'technical'>('technical');

  if (!plain) return <>{children}</>;

  const btnBase: React.CSSProperties = {
    padding: '6px 14px',
    fontSize: '0.8rem',
    fontWeight: 700,
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    border: '1px solid var(--teal)',
    background: 'transparent',
    color: 'var(--silver)',
  };
  const activeBtn: React.CSSProperties = {
    background: 'var(--teal)',
    color: 'var(--black)',
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        <button
          type="button"
          onClick={() => setView('plain')}
          style={{ ...btnBase, ...(view === 'plain' ? activeBtn : {}) }}
        >
          Plain Language
        </button>
        <button
          type="button"
          onClick={() => setView('technical')}
          style={{ ...btnBase, ...(view === 'technical' ? activeBtn : {}) }}
        >
          Technical
        </button>
      </div>
      {view === 'plain' ? (
        <p style={{ color: 'var(--silver)', lineHeight: 1.6 }}>{plain}</p>
      ) : (
        <div>{children}</div>
      )}
    </div>
  );
}
