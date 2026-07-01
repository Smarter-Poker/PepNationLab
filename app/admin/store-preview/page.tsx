import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * "Visit Storefront" opens the admin's real public storefront - the exact same
 * store every agent and researcher sees (AgentStorefrontGrid + standard
 * checkout), not a synthetic admin-only preview. Resolve the admin's own
 * storefront slug and redirect to it.
 */
export default async function AdminStorePreviewRedirect() {
  const gate = await requireAdmin();
  if (!gate.ok) redirect('/login');

  const supabase = await createServiceClient();
  const { data } = await supabase
    .from('agent_profiles')
    .select('slug')
    .eq('id', gate.userId)
    .maybeSingle();

  if (data?.slug) {
    redirect(`/${data.slug}`);
  }

  redirect('/admin');
}
