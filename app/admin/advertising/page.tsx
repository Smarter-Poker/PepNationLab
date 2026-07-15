import { redirect } from 'next/navigation';
import { createClient, getCachedUser } from '@/lib/supabase/server';
import AdvertisingHub from '@/components/AdvertisingHub';

export const dynamic = 'force-dynamic';

/**
 * Advertising Hub - admin management page.
 *
 * Same creative library as /advertising, with admin powers: upload, edit,
 * hide, or delete any creative. Rendered inside the admin sidebar layout,
 * which already gates this segment to role = 'admin'.
 */
export default async function AdminAdvertisingPage() {
  const supabase = await createClient();
  const { user } = await getCachedUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      <AdvertisingHub
        viewerId={user.id}
        viewerName={profile?.full_name ?? 'Admin'}
        isAdmin={true}
      />
    </div>
  );
}
