import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * The Admin Store IS the admin's own real storefront - the exact same store
 * every agent and researcher uses (AgentStorefrontGrid + the standard checkout),
 * NOT a separate bespoke base-cost catalog. We resolve the admin's own
 * storefront slug and send them straight to it so the admin and every
 * researcher attached to the admin shop on the identical storefront.
 */
export default async function AdminStoreRedirect() {
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

  // No storefront provisioned yet - guide the admin to create/configure one.
  redirect('/dashboard/agent?tab=Storefront+Config');
}
