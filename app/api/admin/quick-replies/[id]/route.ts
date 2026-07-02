import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid Id' }, { status: 400 });

  const svc = createServiceClient();
  const { error } = await svc
    .from('messenger_support_quick_replies')
    .delete()
    .eq('id', id)
    .eq('user_id', gate.user.id);
  if (error) return NextResponse.json({ error: 'Failed To Delete' }, { status: 500 });
  return NextResponse.json({ success: true });
}
