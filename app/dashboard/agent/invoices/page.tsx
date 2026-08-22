import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AgentStatements from '@/components/AgentStatements';
import AgentDownlineInvoices from '@/components/AgentDownlineInvoices';
import Navbar from '@/components/Navbar';
import BackButton from '@/components/ui/BackButton';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Invoices | Pep Nation Lab',
  robots: { index: false, follow: true },
};

export default async function AgentInvoicesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_super_agent, is_sub_agent')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || !['agent', 'super_agent', 'admin'].includes(profile.role ?? '')) {
    redirect('/dashboard');
  }

  const isSub = !!profile.is_sub_agent;
  const isSuperAgent = !!profile.is_super_agent;

  return (
    <div style={{ padding: 'var(--space-5)' }}>
      <Navbar />
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <BackButton label="Back To Agent Dashboard" />
      </div>
      <h1 className="animated-gradient-text" style={{ color: 'var(--white)', fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>
        Invoices
      </h1>
      <p style={{ color: 'var(--silver)', fontSize: '0.92rem', marginBottom: 'var(--space-5)' }}>
        View your weekly statements and downline invoices.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {!isSub && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <h3 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-brand)', color: 'var(--teal)', margin: '0 0 10px' }}>Bills To Pay</h3>
            <AgentStatements />
          </div>
        )}
        {(isSuperAgent || isSub) && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <h3 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-brand)', color: 'var(--teal)', margin: '0 0 10px' }}>Downline Invoices</h3>
            <AgentDownlineInvoices isSuperAgent={isSuperAgent} />
          </div>
        )}
      </div>
    </div>
  );
}
