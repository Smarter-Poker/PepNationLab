import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ComplianceTab from '@/components/account/ComplianceTab';

export const dynamic = 'force-dynamic';

// /account/compliance
// Research-only disclaimer status + re-acknowledgement + public legal docs.
// Reuses the existing ComplianceTab component used by /account/settings.
export default async function AccountCompliancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase
    .from('profiles')
    .select('disclaimer_v1_accepted, disclaimer_accepted_at')
    .eq('id', user.id)
    .maybeSingle();

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--black)', padding: 'var(--space-6) var(--space-4)' }}>
      <div className="container" style={{ maxWidth: 760 }}>
        <h1
          className="animated-gradient-text"
          style={{ color: 'var(--white)', fontSize: '1.6rem', fontFamily: 'var(--font-brand)', marginBottom: 'var(--space-2)' }}
        >
          Compliance & Disclaimers
        </h1>
        <p style={{ color: 'var(--silver)', fontSize: '0.92rem', marginBottom: 'var(--space-6)' }}>
          Review Your Research-Only Acknowledgement Status And The Platform Legal Documents.
        </p>

        <ComplianceTab
          disclaimerAccepted={!!data?.disclaimer_v1_accepted}
          disclaimerAcceptedAt={(data?.disclaimer_accepted_at as string | null) ?? null}
        />
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Compliance & Disclaimers | Pep Nation Lab',
  robots: { index: false, follow: true },
};
