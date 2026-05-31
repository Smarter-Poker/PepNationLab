import { redirect } from 'next/navigation';
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
    .select('id, email, full_name, role, tier, is_super_agent')
    .eq('id', user.id)
    .single();

  if (!profile) {
    redirect('/login');
  }

  // 3. Gate access: Must be agent, super_agent, or admin
  const isAgentOrAbove = ['agent', 'super_agent', 'admin'].includes(profile.role);
  if (!isAgentOrAbove) {
    redirect('/dashboard');
  }

  // 4. Fetch agent storefront profile
  const { data: agentProfileRaw } = await supabase
    .from('agent_profiles')
    .select('id, slug, display_name, logo_url, primary_color, secondary_color, qr_code_url, qr_code_data, payment_handles, warehouse_address, is_active, shippo_api_key')
    .eq('id', user.id)
    .maybeSingle();

  // SECURITY: never send the raw Shippo API token to the client. Strip it
  // here and expose only a presence boolean + last-4 mask for the UI.
  const shippoKey = (agentProfileRaw as any)?.shippo_api_key as string | null;
  const shippoLast4 = shippoKey && shippoKey.length >= 4 ? shippoKey.slice(-4) : null;
  const agentProfile = agentProfileRaw
    ? {
        ...agentProfileRaw,
        shippo_api_key: null,
        shippo_api_key_present: !!shippoKey,
        shippo_api_key_last4: shippoLast4,
      }
    : null;

  // 5. Fetch referred researchers
  const { data: researchersData } = await supabase
    .from('profiles')
    .select('id, email, username, full_name, role, created_at')
    .eq('referring_agent_id', user.id)
    .order('created_at', { ascending: false });

  const researchers = (researchersData || []).map(r => ({
    id: r.id,
    email: r.email,
    username: r.username,
    full_name: r.full_name,
    created_at: r.created_at
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
  );
}
