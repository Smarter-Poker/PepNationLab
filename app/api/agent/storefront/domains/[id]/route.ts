import { NextResponse } from 'next/server';
import { safeError } from '@/lib/api-error';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req as any);
  if (csrf) return csrf;
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const svc = await createServiceClient();
  const { error } = await svc
    .from('agent_domains')
    .delete()
    .eq('id', id)
    .eq('agent_id', user.id);
  if (error) return safeError('storefront.domains.id', error, 400);
  return NextResponse.json({ ok: true });
}
