import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DownlineTree from '@/components/DownlineTree';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'My Downline | Pep Nation Lab',
  robots: { index: false, follow: true },
};

/**
 * Super Agent Downline Page
 *
 * Shows The Full Hierarchy Under The Signed-In Super Agent: Their Agents,
 * Sub-Agents, And Every Researcher Owned At Each Level. Researchers Can Be
 * Moved Between Any Accounts Inside The Downline (Server-Enforced Scope).
 */
export default async function SuperAgentDownlinePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_super_agent')
    .eq('id', user.id)
    .maybeSingle();

  const isSuper = !!profile && (profile.is_super_agent === true || profile.role === 'super_agent');
  if (!isSuper) redirect('/dashboard/agent');

  return (
    <div style={{ padding: 'var(--space-5)' }}>
      <div style={{ marginBottom: 'var(--space-4)', display: 'flex', gap: 'var(--space-4)' }}>
        <Link href="/dashboard/agent" style={{ color: 'var(--teal)', fontSize: '0.85rem', textDecoration: 'none' }}>
          &larr; Back To Agent Dashboard
        </Link>
      </div>
      <h1 className="animated-gradient-text" style={{ color: 'var(--white)', fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>
        My Downline
      </h1>
      <p style={{ color: 'var(--silver)', fontSize: '0.92rem', marginBottom: 'var(--space-5)' }}>
        Your Agents, Their Researchers, And Yours. Move Any Researcher To Any Account In Your Downline.
      </p>
      <div className="glass-panel" style={{ padding: 'var(--space-5)' }}>
        <DownlineTree mode="super" />
      </div>
    </div>
  );
}
