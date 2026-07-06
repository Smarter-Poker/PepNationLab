import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { safeError } from '@/lib/api-error';
import { requireAgent } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const FreezeBody = z.object({
  target_id: z.string().uuid(),
  reason: z.string().max(500).optional().default(''),
});

const UnfreezeBody = z.object({
  target_id: z.string().uuid(),
});

// POST /api/agent/freeze - freeze a downline (or any account if admin).
// The freeze_account RPC enforces the ancestor-or-admin authorization +
// writes admin_audit_log atomically.
export async function POST(req: Request) {
  const csrf = assertSameOrigin(req as any);
  if (csrf) return csrf;

  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const supabase = await createClient();

  let body: z.infer<typeof FreezeBody>;
  try { body = FreezeBody.parse(await req.json()); }
  catch (e: any) { return NextResponse.json({ error: 'bad_request', details: e.errors }, { status: 400 }); }

  const { data, error } = await supabase.rpc('freeze_account', {
    p_target_id: body.target_id,
    p_reason: body.reason ?? '',
  });
  if (error) {
    if (error.message === 'forbidden') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    if (error.message === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    return safeError('agent.freeze', error);
  }
  return NextResponse.json({ ok: true, result: data });
}

// DELETE /api/agent/freeze - unfreeze a downline.
export async function DELETE(req: Request) {
  const csrf = assertSameOrigin(req as any);
  if (csrf) return csrf;

  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const supabase = await createClient();

  let body: z.infer<typeof UnfreezeBody>;
  try { body = UnfreezeBody.parse(await req.json()); }
  catch (e: any) { return NextResponse.json({ error: 'bad_request', details: e.errors }, { status: 400 }); }

  const { data, error } = await supabase.rpc('unfreeze_account', {
    p_target_id: body.target_id,
  });
  if (error) {
    if (error.message === 'forbidden') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    if (error.message === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    return safeError('agent.unfreeze', error);
  }
  return NextResponse.json({ ok: true, result: data });
}
