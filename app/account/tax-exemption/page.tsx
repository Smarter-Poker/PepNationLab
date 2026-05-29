import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import TaxExemptionClient from './TaxExemptionClient';

export const dynamic = 'force-dynamic';

export default async function AccountTaxExemptionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--black)', padding: 'var(--space-6) var(--space-4)' }}>
      <div className="container" style={{ maxWidth: 760 }}>
        <h1 style={{ color: 'var(--white)', fontSize: '1.6rem', fontFamily: 'var(--font-brand)', marginBottom: 'var(--space-2)' }}>
          Tax Exemption Certificates
        </h1>
        <p style={{ color: 'var(--silver)', fontSize: '0.92rem', marginBottom: 'var(--space-6)' }}>
          Upload Your Sales Tax Exemption Certificate To Receive Tax-Exempt Status On Future Orders Shipping To That State.
        </p>
        <TaxExemptionClient />
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Tax Exemption | Pep Nation Lab',
  robots: { index: false, follow: false },
};
