import { NextResponse } from 'next/server';
import { safeError } from '@/lib/api-error';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireAgent } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req as any);
  if (csrf) return csrf;
  const { id } = await ctx.params;
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;
  const svc = await createServiceClient();
  const { error } = await svc
    .from('agent_domains')
    .delete()
    .eq('id', id)
    .eq('agent_id', gate.user.id);
  if (error) return safeError('storefront.domains.id', error, 400);
  return NextResponse.json({ ok: true });
}
