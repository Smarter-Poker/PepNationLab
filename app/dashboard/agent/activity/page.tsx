import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import AgentActivityFeed from '@/components/AgentActivityFeed';

export const dynamic = 'force-dynamic';

export default async function AgentActivityPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/dashboard/agent/activity');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) redirect('/login');
  if (!['agent', 'super_agent', 'admin'].includes(profile.role)) redirect('/dashboard');

  return (
    <div className="container" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-12)' }}>
      <Link href="/dashboard/agent" prefetch={false}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--grey-400)', fontSize: '0.82rem', textDecoration: 'none', marginBottom: 'var(--space-4)' }}>
        <ArrowLeft size={15} /> Back to Dashboard
      </Link>
      <AgentActivityFeed />
    </div>
  );
}
