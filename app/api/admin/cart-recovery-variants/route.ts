import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get('agent_id');

  const supabase = await createAdminClient();

  let query = supabase
    .from('profiles')
    .select('id, full_name, email, cart_state, cart_updated_at, last_cart_reminder_at')
    .eq('role', 'researcher')
    .not('cart_state', 'is', null);

  if (agentId) {
    query = query.eq('referring_agent_id', agentId);
  }

  const { data, error } = await query.order('cart_updated_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ researchers: data || [] });
}

export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const body = await req.json();
  const { researcherId, message } = body;

  if (!researcherId) {
    return NextResponse.json({ error: 'Missing researcherId' }, { status: 400 });
  }

  const supabase = await createAdminClient();

  // Log the reminder
  const { error } = await supabase
    .from('profiles')
    .update({ last_cart_reminder_at: new Date().toISOString() })
    .eq('id', researcherId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: message || 'Reminder sent' });
}
