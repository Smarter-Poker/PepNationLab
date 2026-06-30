import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const supabase = await createAdminClient();
  const body = await req.json();
  const { agentId, updates } = body;

  if (!agentId || !updates) {
    return NextResponse.json({ error: 'Missing agentId or updates' }, { status: 400 });
  }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', agentId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
