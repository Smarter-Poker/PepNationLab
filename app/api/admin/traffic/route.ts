export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

// GET /api/admin/traffic?days=7 -> global site-traffic summary (all storefronts).
export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const daysRaw = Number(req.nextUrl.searchParams.get('days'));
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(90, Math.trunc(daysRaw))) : 7;

  const svc = await createServiceClient();
  const { data, error } = await svc.rpc('site_traffic_summary', { p_agent_id: null, p_days: days });
  if (error) return NextResponse.json({ error: 'Could Not Load Site Traffic.' }, { status: 500 });
  return NextResponse.json(data ?? {});
}
