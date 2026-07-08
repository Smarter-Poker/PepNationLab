import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AdminCatalogRisk from '@/components/AdminCatalogRisk';

export const dynamic = 'force-dynamic';

export default async function AdminCatalogRiskPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin') redirect('/dashboard');

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 className="animated-gradient-text" style={{ fontSize: '1.6rem', margin: 0 }}>Catalog Risk Audit</h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--grey-400)', marginTop: 'var(--space-2)', maxWidth: 760 }}>
          Every Compound Scored Against The Research Knowledge Base For Safety And Regulatory Risk.
          Restrict Hides A Compound From All Storefronts; Remove Blocks It From Sale. This Protects
          The Platform And Never Changes The Factual Compound Profile.
        </p>
      </div>
      <AdminCatalogRisk />
    </div>
  );
}

export const metadata = {
  title: 'Catalog Risk Audit | Pep Nation Lab',
  robots: { index: false, follow: true },
};
