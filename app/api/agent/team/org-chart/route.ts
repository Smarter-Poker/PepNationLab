// R24 phase 6 - Org chart for super-agent/agent downline.
import { NextResponse } from 'next/server';
import { safeError } from '@/lib/api-error';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Role gate: only agent, super_agent, or admin may access the org chart
  const svc = await createAdminClient();
  const { data: profile } = await svc.from('profiles').select('role, is_super_agent').eq('id', user.id).maybeSingle();
  if (!profile || !['agent', 'super_agent', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { data, error } = await svc.rpc('agent_team_org_chart', { p_root: user.id });
  if (error) return safeError('team.org-chart', error, 400);
  return NextResponse.json({ nodes: data ?? [] });
}
