'use client';

/**
 * Tiny client component used by the server-rendered /wallet/print page
 * so the Print button actually invokes window.print(). The print page
 * itself is a server component (the entire <html> shell is rendered
 * server-side for a clean print stream), so it cannot own this click
 * handler.
 */
export default function PrintButton() {
  return (
    <button
      type="button"
      className="print-btn"
      onClick={() => {
        try { window.print(); } catch { /* noop */ }
      }}
    >
      Print Invoice
    </button>
  );
}
