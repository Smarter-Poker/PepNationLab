import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import PrintLabelsClient from './PrintLabelsClient';
import Navbar from '@/components/Navbar';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Print Labels | Pep Nation Lab',
  robots: { index: false, follow: false },
};

/**
 * Label Printer Area.
 *
 * Available to every admin, super agent, agent, and manufacturer account.
 * Researchers are redirected away. The label artwork is print-only brand
 * collateral served from the public `print-labels` storage bucket - it is
 * intentionally NOT used as product imagery anywhere else on the site.
 */
export default async function PrintLabelsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login?redirect=/dashboard/labels');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, is_super_agent, is_sub_agent, is_manufacturer, parent_agent_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    redirect('/login');
  }

  const allowed =
    ['agent', 'super_agent', 'admin'].includes(profile.role) ||
    (profile as { is_super_agent?: boolean | null }).is_super_agent === true ||
    (profile as { is_manufacturer?: boolean | null }).is_manufacturer === true;

  if (!allowed) {
    redirect('/dashboard');
  }

  // Brand routing: the Savage Brands store and every agent in her downline
  // print Savage-branded labels; everyone else prints Pep Nation labels.
  const service = await createServiceClient();
  let brand: 'pepnation' | 'savage' = 'pepnation';
  const { data: savage } = await service
    .from('profiles')
    .select('id')
    .eq('username', 'savagebrands')
    .maybeSingle();
  if (savage?.id) {
    let currentId: string | null = profile.id;
    let parentId: string | null = (profile as { parent_agent_id?: string | null }).parent_agent_id ?? null;
    for (let hop = 0; hop < 6 && currentId; hop++) {
      if (currentId === savage.id) {
        brand = 'savage';
        break;
      }
      if (!parentId) break;
      currentId = parentId;
      const { data: parent } = await service
        .from('profiles')
        .select('id, parent_agent_id')
        .eq('id', parentId)
        .maybeSingle();
      parentId = (parent as { parent_agent_id?: string | null } | null)?.parent_agent_id ?? null;
    }
  }

  // Full catalog - every peptide, stack, and supply gets a printable label.
  // Banned / inactive products are intentionally included: agents still hold
  // physical stock of them and need vial labels.
  const { data: products } = await service
    .from('products')
    .select('id, name, slug, category, unit_size, unit_measure')
    .order('category', { ascending: true })
    .order('name', { ascending: true })
    .order('slug', { ascending: true });

  return (
    <div style={{ minHeight: '100dvh', background: '#050A0F' }}>
      <Navbar />
      {/* Spacer for the fixed navbar */}
      <div style={{ height: 'var(--nav-offset, 60px)' }} />
      <PrintLabelsClient products={products || []} isAdmin={profile.role === 'admin'} brand={brand} />
    </div>
  );
}
