export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { unwrap } from '@/lib/supabase/unwrap';

// Admin-only read of the client-error observability sink (client_error_events).
export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  try {
    const supabase = createAdminClient();
    const { searchParams } = req.nextUrl;
    const rawLimit = parseInt(searchParams.get('limit') ?? '250', 10);
    const limit = Math.min(isNaN(rawLimit) ? 250 : rawLimit, 500);
    const context = searchParams.get('context');

    let query = supabase
      .from('client_error_events')
      .select('id, created_at, user_id, context, kind, message, stack, url, user_agent')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (context) query = query.eq('context', context);

    const data = await unwrap('client-errors.list', query);
    return NextResponse.json({ data });
  } catch (err) {
    console.error('[admin/client-errors] GET error:', err);
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }
}
