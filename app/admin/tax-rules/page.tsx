import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import TaxRulesClient from './TaxRulesClient';

export const dynamic = 'force-dynamic';

export default async function AdminTaxRulesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const service = await createServiceClient();
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/dashboard');

  const { data: rules } = await service
    .from('tax_rules')
    .select('id, jurisdiction, state_code, base_rate, applies_to, shipping_taxable, is_active, notes, updated_at')
    .order('state_code', { ascending: true });

  return (
    <div style={{ padding: 'var(--space-6) var(--space-6)' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ color: 'var(--white)', fontSize: '1.6rem', marginBottom: 'var(--space-1)' }}>Tax Rules</h1>
        <p style={{ color: 'var(--silver)', fontSize: '0.92rem' }}>
          Configure Statewide Sales Tax Base Rates Used By The Checkout Tax Engine.
        </p>
      </div>
      <TaxRulesClient initialRules={(rules ?? []) as any} />
    </div>
  );
}

export const metadata = {
  title: 'Tax Rules | Admin | Pep Nation Lab',
  robots: { index: false, follow: false },
};
