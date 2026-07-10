import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgentOrAdmin } from '@/lib/admin-auth';

export async function GET() {
  try {
    const gate = await requireAgentOrAdmin();
    if (!gate.ok) return gate.response;

    const supabase = createAdminClient();
    const agentId = gate.user.id;

    // 1. Fetch the agent's slug from agent_profiles
    const { data: agentProfileData } = await supabase
      .from('agent_profiles')
      .select('slug')
      .eq('id', agentId)
      .maybeSingle();

    const slug = agentProfileData?.slug ?? null;
    const referral_url = slug
      ? `https://pepnationlab.com?ref=${slug}`
      : null;

    // 2. Fetch all researchers referred via this agent's storefront
    //    (profiles where referring_agent_id = agentId and role = 'researcher')
    const { data: researchers, error: researchersError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('referring_agent_id', agentId)
      .eq('role', 'researcher')
      .limit(2000);

    if (researchersError) {
      return NextResponse.json({ error: 'Failed To Fetch Researchers' }, { status: 500 });
    }

    const researcherIds = (researchers ?? []).map((r: any) => r.id);
    const total_referred = researcherIds.length;

    if (researcherIds.length === 0) {
      return NextResponse.json({
        referral_url,
        total_referred: 0,
        total_orders: 0,
        total_revenue: 0,
        top_researchers: [],
      });
    }

    // 3. Fetch all orders placed by those researchers
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, buyer_id, total, status')
      .in('buyer_id', researcherIds)
      .neq('status', 'cancelled')
      .limit(10000);

    if (ordersError) {
      return NextResponse.json({ error: 'Failed To Fetch Orders' }, { status: 500 });
    }

    const total_orders = (orders ?? []).length;
    const total_revenue = (orders ?? []).reduce((acc: number, o: any) => acc + Number(o.total || 0), 0);

    // 4. Aggregate orders by researcher for top-5 table
    const researcherMap = new Map<string, { name: string; order_count: number; total_spent: number }>();

    for (const r of researchers ?? []) {
      researcherMap.set(r.id, {
        name: r.full_name || r.email || r.id,
        order_count: 0,
        total_spent: 0,
      });
    }

    for (const o of orders ?? []) {
      const entry = researcherMap.get(o.buyer_id);
      if (entry) {
        entry.order_count += 1;
        entry.total_spent += Number(o.total || 0);
      }
    }

    const top_researchers = Array.from(researcherMap.values())
      .filter((r) => r.order_count > 0)
      .sort((a, b) => b.total_spent - a.total_spent)
      .slice(0, 5)
      .map((r) => ({
        name: r.name,
        order_count: r.order_count,
        total_spent: Number(r.total_spent.toFixed(2)),
      }));

    return NextResponse.json({
      referral_url,
      total_referred,
      total_orders,
      total_revenue: Number(total_revenue.toFixed(2)),
      top_researchers,
    });
  } catch (err) {
    console.error('Agent Referrals API Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
