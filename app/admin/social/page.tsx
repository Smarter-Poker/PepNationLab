import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getSocialStatus, getSocialQueue } from '@/lib/social/admin';
import AdminSocialConsole, { type QueuePost } from './AdminSocialConsole';

/**
 * Social Autoposter admin console.
 *
 * Server-rendered initial data (no client fetch waterfall on first paint), then
 * the client component handles filtering / retry / refresh from event handlers.
 * The /admin prefix is already role-gated in proxy.ts; we re-check here because
 * this page reads through the service-role client.
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Social Autoposter',
};

export default async function AdminSocialPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const service = await createServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if ((profile as { role?: string } | null)?.role !== 'admin') redirect('/dashboard');

  const [status, posts] = await Promise.all([getSocialStatus(), getSocialQueue(null, 50)]);

  return (
    <AdminSocialConsole
      initialEnabled={status.enabled}
      initialAccounts={status.accounts}
      initialCounts={status.counts}
      initialPosts={posts as unknown as QueuePost[]}
    />
  );
}
