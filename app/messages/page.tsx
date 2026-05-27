import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PageShell from '@/components/PageShell';
import Messaging from '@/components/Messaging';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Messages | Pep Nation Lab',
  description: 'Message your referring agent.',
};

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/messages');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, referring_agent_id')
    .eq('id', user.id)
    .single();

  const role = profile?.role ?? 'researcher';
  const agentId = profile?.referring_agent_id ?? null;

  // Agents manage conversations from their dedicated dashboard inbox.
  const isAgent = role === 'agent' || role === 'super_agent';

  let agentName = 'Your Agent';
  if (agentId) {
    const { data: agentProfile } = await supabase
      .from('agent_profiles')
      .select('display_name')
      .eq('id', agentId)
      .maybeSingle();
    if (agentProfile?.display_name) {
      agentName = agentProfile.display_name;
    }
  }

  return (
    <PageShell>
      <section className="section">
        <div className="container-sm">
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <h1 style={{ fontSize: '1.8rem', marginBottom: 'var(--space-2)' }}>
              <span style={{ color: 'var(--teal)' }}>Messages</span>
            </h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--grey-400)' }}>
              Direct Messaging With Your Referring Agent
            </p>
          </div>

          {isAgent ? (
            <div className="card-metal" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--silver)', marginBottom: 'var(--space-6)' }}>
                Agents Manage Researcher Conversations From The Agent Dashboard.
              </p>
              <Link href="/dashboard/agent" className="btn btn-primary">
                Open Agent Dashboard
              </Link>
            </div>
          ) : agentId ? (
            <Messaging selfId={user.id} counterpartId={agentId} counterpartName={agentName} />
          ) : (
            <div className="card-metal" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--silver)', marginBottom: 'var(--space-3)' }}>
                You Are Not Currently Linked To A Referring Agent.
              </p>
              <p style={{ fontSize: '0.84rem', color: 'var(--grey-400)', margin: 0 }}>
                Direct Messaging Is Available To Researchers Who Registered Through An Agent
                Storefront. For Help, Contact Us At research@pepnationlab.com.
              </p>
            </div>
          )}
        </div>
      </section>
    </PageShell>
  );
}
