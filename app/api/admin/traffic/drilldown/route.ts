export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

// GET /api/admin/traffic/drilldown?metric=pageviews&days=7
export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const metric = url.searchParams.get('metric');
  const daysRaw = Number(url.searchParams.get('days'));
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(90, Math.trunc(daysRaw))) : 7;
  const agentId = url.searchParams.get('agent_id') || null;

  const svc = await createServiceClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    if (metric === 'abandoned_carts') {
      const { data, error } = await svc.rpc('get_abandoned_carts', { p_agent_id: agentId, p_days: days });
      if (error) throw error;
      return NextResponse.json(data || []);
    }

    if (metric === 'orders') {
      let q = svc.from('orders').select('id, total, status, created_at, user_id').gte('created_at', since).neq('status', 'cancelled').order('created_at', { ascending: false }).limit(200);
      if (agentId) q = q.eq('agent_id', agentId);
      const { data, error } = await q;
      if (error) throw error;
      return NextResponse.json(data || []);
    }

    if (metric === 'signups') {
      let q = svc.from('agent_storefront_events').select('visitor_id, session_id, created_at').eq('event_type', 'signup').gte('created_at', since).order('created_at', { ascending: false }).limit(200);
      if (agentId) q = q.eq('agent_id', agentId);
      const { data, error } = await q;
      if (error) throw error;
      return NextResponse.json(data || []);
    }

    // For other events (pageviews, visitors, product_views, searches, add_to_cart, checkout_start)
    let eventType = metric;
    // Handle 'visitors' metric which isn't a direct event type for the drilldown, but we can return recent unique visitors from pageviews
    if (metric === 'visitors') eventType = 'pageview';

    let q = svc.from('agent_storefront_events')
      .select('id, visitor_id, session_id, path, search_term, product_id, created_at')
      .eq('event_type', eventType as string)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200);

    if (agentId) q = q.eq('agent_id', agentId);

    const { data, error } = await q;
    if (error) throw error;

    // For 'visitors', we might want to return unique visitors
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
    console.error('Drilldown error:', err);
    return NextResponse.json({ error: 'Could Not Load Drilldown Data' }, { status: 500 });
  }
}
