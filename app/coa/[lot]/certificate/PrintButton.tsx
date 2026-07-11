'use client';

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="btn-secondary"
      style={{ padding: '0.6rem 1.25rem' }}
    >
      Print Or Save As PDF
    </button>
  );
}
