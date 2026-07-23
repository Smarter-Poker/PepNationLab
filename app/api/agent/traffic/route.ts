export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// GET /api/agent/traffic?days=7 -> traffic summary scoped to the caller's own
// storefront (agent_id = self). Available to agent-tier accounts.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized. Please Sign In.' }, { status: 401 });

  const svc = await createServiceClient();
  const { data: profile } = await svc
    .from('profiles')
    .select('role, is_super_agent, is_sub_agent')
    .eq('id', user.id)
    .maybeSingle();
  const isAgentTier = profile?.role === 'agent' || profile?.role === 'super_agent'
    || !!profile?.is_super_agent || !!profile?.is_sub_agent || profile?.role === 'admin';
  if (!isAgentTier) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  const daysRaw = Number(req.nextUrl.searchParams.get('days'));
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(90, Math.trunc(daysRaw))) : 7;

  const { data, error } = await svc.rpc('site_traffic_summary', { p_agent_id: user.id, p_days: days });
  if (error) return NextResponse.json({ error: 'Could Not Load Your Storefront Traffic.' }, { status: 500 });
  return NextResponse.json(data ?? {});
}
