import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';
import { assertSameOrigin } from '@/lib/csrf';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  status: z.enum(['open','in_progress','waiting_on_researcher','resolved']),
});

/**
 * PATCH /api/messenger/support/[id]/status
 * Admin-only. Sets the support_status on the conversation via SECDEF RPC
 * which also writes an admin_audit_log entry.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const supabase = await createClient();
  const { data: { user } } = await getEffectiveUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid Id' }, { status: 400 });

  const raw = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid Status' }, { status: 400 });

  const { error } = await supabase.rpc('fn_messenger_support_set_status', {
    p_conv: id,
    p_status: parsed.data.status,
  });
  if (error) {
    if (/Admin only/i.test(error.message)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Failed To Update Status' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
