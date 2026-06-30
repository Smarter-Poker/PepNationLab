import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const supabase = await createAdminClient();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'open';

  const { data, error } = await supabase
    .from('disputes')
    .select('*, orders(id, total, buyer_id, agent_id), profiles!disputes_reporter_id_fkey(full_name, email)')
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ disputes: data || [] });
}

export async function PATCH(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const supabase = await createAdminClient();
  const body = await req.json();
  const { disputeId, status, resolution } = body;

  if (!disputeId || !status) {
    return NextResponse.json({ error: 'Missing disputeId or status' }, { status: 400 });
  }

  const { error } = await supabase
    .from('disputes')
    .update({ status, resolution, resolved_at: status === 'resolved' ? new Date().toISOString() : null })
    .eq('id', disputeId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
