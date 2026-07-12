// @ts-nocheck
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

// GET: List all researcher accounts for the admin agents page
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, username, email, phone, is_active, role, created_at, last_sign_in_at, parent_agent_id, referring_agent_id, provisioned_password, account_type, prepaid_balance, credit_limit, tier')
      .eq('role', 'researcher')
      .order('created_at', { ascending: false })
      .limit(2000);

    if (error) {
      return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
    }

    // Also pull the parent agent names so we can display them
    const parentIds = [...new Set((data ?? []).map(r => r.parent_agent_id).filter(Boolean))];
    let parentNames: Record<string, string> = {};
    if (parentIds.length > 0) {
      const { data: parents } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .in('id', parentIds); // @ts-ignore
      for (const p of parents ?? []) {
        parentNames[p.id] = p.full_name || p.username || p.id;
      }
    }

    const enriched = (data ?? []).map(r => ({
      ...r,
      parent_agent_name: r.parent_agent_id ? (parentNames[r.parent_agent_id] ?? 'Unknown') : null,
    }));

    return NextResponse.json({ data: enriched });
  } catch (err) {
    console.error('[admin/agents/researchers] GET error:', err);
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }
}
