import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

// One-shot: set is_admin_account = true on Savage Brands / savagebrands
// DELETE THIS FILE after use.
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const svc = createAdminClient();

  const { data, error } = await svc
    .from('profiles')
    .update({ is_admin_account: true })
    .ilike('username', 'savagebrands')
    .select('id, username, is_admin_account, is_manufacturer, is_super_agent');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updated: data });
}
