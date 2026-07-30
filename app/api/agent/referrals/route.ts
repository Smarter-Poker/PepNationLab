
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgentOrAdmin } from '@/lib/admin-auth';
import { STORE_SLUG_RE, RESERVED_SEGMENTS } from '@/lib/store-slug';

export async function GET() {
  try {
    const gate = await requireAgentOrAdmin();
    if (!gate.ok) return gate.response;

    const supabase = createAdminClient();
    const agentId = gate.user.id;

    // 1. Referral identifier is the agent's username (resolves across all roles
    //    in apply_signup_referral).
    const { data: selfProfile } = await supabase
      .from('profiles')
      .select('username, referral_code')
      .eq('id', agentId)
      .maybeSingle();
    const { data: agentProfileData } = await supabase
      .from('agent_profiles')
      .select('slug, is_active')
      .eq('id', agentId)
      .maybeSingle();

    // GUEST STOREFRONT RULE (2026-07-30)
    // The referral link must open the agent's storefront so the visitor can
    // browse products and see pricing as a guest. It must NEVER open
    // /signup ("Create Researcher Account") - nobody is asked to register
    // before they have seen the store.
    //
    // Only an active, routable slug is used. `is_active === false` means the
    // storefront is switched off and proxy.ts will not render it; a legacy
    // slug that fails STORE_SLUG_RE or collides with a reserved app route
    // predates the agent_profiles_slug_shape CHECK and the
    // agent_profiles_slug_not_reserved trigger and is likewise unroutable.
    // In either case fall back to `/?ref=<code>` - the landing page, which
    // offers "Continue As Guest" - rather than emitting a dead link.
    // Attribution is preserved on both paths because proxy.ts mints the
    // signed ref lock from the `?ref=` parameter.
    const rawSlug = agentProfileData?.slug ?? null;
    const slug =
      rawSlug &&
      agentProfileData?.is_active !== false &&
      STORE_SLUG_RE.test(rawSlug) &&
      !RESERVED_SEGMENTS.has(rawSlug)
        ? rawSlug
        : null;

    const referral_code = selfProfile?.username ?? selfProfile?.referral_code ?? null;
    const base = (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')) || 'https://pepnationlab.com';
    const referral_url = referral_code
      ? slug
        ? `${base}/${slug}?ref=${encodeURIComponent(referral_code)}`
        : `${base}/?ref=${encodeURIComponent(referral_code)}`
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
        referral_code,
        storefront_slug: slug,
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
      const entry = researcherMap.get(o.buyer_id); // @ts-ignore
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
      referral_code,
      storefront_slug: slug,
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
