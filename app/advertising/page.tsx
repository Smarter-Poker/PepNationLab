import { redirect } from 'next/navigation';
import { createClient, getCachedUser } from '@/lib/supabase/server';
import Navbar from '@/components/Navbar';
import AdvertisingHub from '@/components/AdvertisingHub';

export const dynamic = 'force-dynamic';

/**
 * Advertising Hub - agent-facing page.
 *
 * Central library of marketing creatives (flyers, banners, social graphics,
 * videos) that every agent-type account can browse, download, or screenshot
 * to reuse across their own marketing channels. Reached from the hamburger
 * menu of every agent, super agent, and sub-agent (see roleNavLinks).
 * Admins manage the same library from /admin/advertising.
 */
export default async function AdvertisingPage() {
  const supabase = await createClient();
  const { user } = await getCachedUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, username, is_sub_agent, is_super_agent')
    .eq('id', user.id)
    .maybeSingle();

  const role = profile?.role ?? 'researcher';
  if (role === 'admin') redirect('/admin/advertising');
  if (role === 'shipping') redirect('/shipping');

  const isAgentType =
    role === 'agent' ||
    role === 'super_agent' ||
    (profile as { is_sub_agent?: boolean | null })?.is_sub_agent === true ||
    (profile as { is_super_agent?: boolean | null })?.is_super_agent === true;

  if (!isAgentType) redirect('/dashboard');

  const viewerName =
    profile?.full_name ?? profile?.username ?? user.email?.split('@')[0] ?? 'Agent';

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--black)' }}>
      <Navbar />
      {/* Spacer for the fixed navbar */}
      <div style={{ height: 60 }} />
      <div
        className="container"
        style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-6)' }}
      >
        <AdvertisingHub viewerId={user.id} viewerName={viewerName} isAdmin={false} />
      </div>
    </div>
  );
}
