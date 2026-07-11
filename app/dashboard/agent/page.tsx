import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import AgentDashboardClient from './AgentDashboardClient';

export const dynamic = 'force-dynamic';

export default async function AgentDashboardPage() {
  const supabase = await createClient();

  // 1. Authenticate user session
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login?redirect=/dashboard/agent');
  }

  // 2. Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, tier, is_super_agent, is_sub_agent')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    redirect('/login');
  }

  // 3. Gate access: Must be agent, super_agent, or admin
  const isAgentOrAbove = ['agent', 'super_agent', 'admin'].includes(profile.role);
  if (!isAgentOrAbove) {
    redirect('/dashboard');
  }

  // SACA: sub-agents are role='agent' + is_sub_agent=true. They have no
  // agent_profiles row, no agent_products, no agent_inventory, no storefront
  // - every query below returns empty for them and the full agent dashboard
  // exposes config they cannot own. Send them to the dedicated sub-agent
  // dashboard (already covered by /dashboard but a direct hit on this URL
  // would bypass that). This is a defense-in-depth complement to the
  // /dashboard/page.tsx redirect that landed in Round 4.
  if ((profile as { is_sub_agent?: boolean | null }).is_sub_agent === true) {
    redirect('/dashboard/sub-agent');
  }

  // 4. Fetch agent storefront profile. Shipping is platform-managed - there
  // are no per-agent shipping API keys.
  const { data: agentProfileRaw } = await supabase
    .from('agent_profiles')
    .select('id, slug, display_name, logo_url, primary_color, secondary_color, qr_code_url, qr_code_data, payment_handles, warehouse_address, is_active, featured_products')
    .eq('id', user.id)
    .maybeSingle();

  const agentProfile = agentProfileRaw ?? null;

  // 5. Fetch referred researchers
  const { data: researchersData } = await supabase
    .from('profiles')
    .select('id, email, username, full_name, role, created_at, auto_approve_orders, last_sign_in_at')
    .eq('referring_agent_id', user.id)
    .eq('role', 'researcher')
    .order('created_at', { ascending: false });

  const researchers = (researchersData || []).map(r => ({
    id: r.id,
    email: r.email,
    username: r.username,
    full_name: r.full_name,
    created_at: r.created_at,
    auto_approve_orders: !!r.auto_approve_orders,
    last_sign_in_at: (r as { last_sign_in_at?: string | null }).last_sign_in_at ?? null,
  }));

  // 5.5. Fetch Sub-Agents (if this user is a Super Agent)
  const { data: subAgents } = await supabase
    .from('profiles')
    .select('id')
    .eq('parent_agent_id', user.id);
  const agentIds = [user.id, ...(subAgents || []).map((a: any) => a.id)];

  // 6. Fetch referred/assigned orders
  const { data: ordersData } = await supabase
    .from('orders')
    .select(`
      id,
      buyer_id,
      status,
      fulfillment_method,
      payment_method,
      shipping_address,
      shipping_cost,
      subtotal,
      total,
      created_at,
      tracking_number,
      label_url,
      profiles!buyer_id(full_name, email),
      agent_id
    `)
    .in('agent_id', agentIds)
    .order('created_at', { ascending: false });

  const orders = (ordersData || []).map((order: any) => {
    const buyerProfile = order.profiles;
    const buyer_name = buyerProfile 
      ? (Array.isArray(buyerProfile) ? buyerProfile[0]?.full_name : buyerProfile?.full_name) 
      : '';
    const buyer_email = buyerProfile 
      ? (Array.isArray(buyerProfile) ? buyerProfile[0]?.email : buyerProfile?.email) 
      : '';

    return {
      id: order.id,
      buyer_id: order.buyer_id,
      status: order.status,
      fulfillment_method: order.fulfillment_method,
      payment_method: order.payment_method,
      shipping_address: order.shipping_address,
      shipping_cost: Number(order.shipping_cost || 0),
      subtotal: Number(order.subtotal || 0),
      total: Number(order.total || 0),
      created_at: order.created_at,
      buyer_name: buyer_name || 'Anonymous Researcher',
      buyer_email: buyer_email || '',
      tracking_number: order.tracking_number,
      label_url: order.label_url,
      agent_id: order.agent_id,
      is_sub_agent_order: order.agent_id !== user.id
    };
  });

  return (
    <Suspense fallback={<div style={{ padding: '2rem', color: 'var(--grey-400, #888)' }}>Loading Dashboard…</div>}>
      <AgentDashboardClient
        userProfile={{
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          role: profile.role,
          tier: profile.tier,
          is_super_agent: profile.is_super_agent
        }}
        initialAgentProfile={agentProfile}
        initialResearchers={researchers}
        initialOrders={orders}
      />
    </Suspense>
  );
}
