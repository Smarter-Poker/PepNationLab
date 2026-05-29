import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import TaxExemptionsClient from './TaxExemptionsClient';

export const dynamic = 'force-dynamic';

export default async function AdminTaxExemptionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const service = await createServiceClient();
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/dashboard');

  return (
    <div style={{ padding: 'var(--space-6) var(--space-6)' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ color: 'var(--white)', fontSize: '1.6rem', marginBottom: 'var(--space-1)' }}>Tax Exemption Certificates</h1>
        <p style={{ color: 'var(--silver)', fontSize: '0.92rem' }}>
          Review Researcher-Submitted Tax Exemption Certificates. Approved Certificates Suppress Tax On Future Orders.
        </p>
      </div>
      <TaxExemptionsClient />
    </div>
  );
}

export const metadata = {
  title: 'Tax Exemptions | Admin | Pep Nation Lab',
  robots: { index: false, follow: false },
};
