/**
 * Dosing & Unit Converter route — laboratory preparation math (reconstitution
 * concentration, aliquot draw, mg/mcg/IU conversion). Server shell + client tool.
 * Research-Use-Only framing.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { Calculator } from 'lucide-react';
import DosingConverter from '@/components/research/DosingConverter';

export const metadata: Metadata = {
  title: 'Dosing & Unit Converter | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default function ConverterPage() {
  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>

      <header style={{ marginBottom: 'var(--space-6, 32px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          <Calculator size={24} aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 10, color: 'var(--teal, #00C4BC)' }} />
          Dosing & Unit Converter
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '640px' }}>
          Solution-Preparation Arithmetic For The Bench: Reconstitution Concentration, Insulin-Syringe Aliquot Draw, And
          Milligram / Microgram / International-Unit Conversion. For Laboratory Research Only.
        </p>
      </header>

      <DosingConverter />
    </div>
  );
}
