export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const svc = await createServiceClient();
  const { data: profile } = await svc
    .from('profiles')
    .select('role, is_super_agent, is_sub_agent')
    .eq('id', user.id)
    .maybeSingle();
  
  const isAgentTier = profile?.role === 'agent' || profile?.role === 'super_agent'
    || !!profile?.is_super_agent || !!profile?.is_sub_agent || profile?.role === 'admin';
  
  if (!isAgentTier) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  const url = new URL(req.url);
  const metric = url.searchParams.get('metric');
  const daysRaw = Number(url.searchParams.get('days'));
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(90, Math.trunc(daysRaw))) : 7;
  const agentId = user.id;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    if (metric === 'abandoned_carts') {
      const { data, error } = await svc.rpc('get_abandoned_carts', { p_agent_id: agentId, p_days: days });
      if (error) throw error;
      return NextResponse.json(data || []);
    }

    if (metric === 'orders') {
      const { data, error } = await svc.from('orders')
        .select('id, total, status, created_at, user_id')
        .eq('agent_id', agentId)
        .gte('created_at', since)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return NextResponse.json(data || []);
    }

    if (metric === 'signups') {
      const { data, error } = await svc.from('agent_storefront_events')
        .select('visitor_id, session_id, created_at')
        .eq('event_type', 'signup')
        .eq('agent_id', agentId)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return NextResponse.json(data || []);
    }

    let eventType = metric;
    if (metric === 'visitors') eventType = 'pageview';

    const { data, error } = await svc.from('agent_storefront_events')
      .select('id, visitor_id, session_id, path, search_term, product_id, created_at')
      .eq('event_type', eventType as string)
      .eq('agent_id', agentId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    if (metric === 'visitors' && data) {
      const unique = new Map();
      for (const row of data) {
        if (row.visitor_id && !unique.has(row.visitor_id)) {
          unique.set(row.visitor_id, row);
        }
      }
      return NextResponse.json(Array.from(unique.values()));
    }

    return NextResponse.json(data || []);
  } catch (err: any) {
    console.error('Agent Drilldown error:', err);
    return NextResponse.json({ error: 'Could Not Load Drilldown Data' }, { status: 500 });
  }
}
