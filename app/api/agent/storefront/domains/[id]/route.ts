import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try { assertSameOrigin(req); }
  catch { return NextResponse.json({ error: 'csrf' }, { status: 403 }); }
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const svc = createServiceClient();
  const { error } = await svc
    .from('agent_domains')
    .delete()
    .eq('id', id)
    .eq('agent_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
