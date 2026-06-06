'use client';

/**
 * PrintButton - triggers the browser print dialog so the spec sheet can be
 * saved as a PDF. Hidden when printing via the @media print rule.
 */
import { Printer } from 'lucide-react';

export default function PrintButton() {
  return (
    <button
      type="button"
      className="btn-primary"
      onClick={() => window.print()}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
      data-print-hide="true"
    >
      <Printer size={16} aria-hidden="true" />
      Print / Save As PDF
    </button>
  );
}
