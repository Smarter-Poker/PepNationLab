import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { safeError } from '@/lib/api-error';
import { requireAgentOrAdmin } from '@/lib/admin-auth';

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
//
// Gate note 2026-07-29: this used requireAgent(), which deliberately REJECTS
// role='admin' — so every admin-side Freeze Transactions click returned 403
// "Forbidden. Agent Access Required.". This route takes a foreign target_id and
// does all authorization inside the SECURITY DEFINER RPC against auth.uid(),
// so requireAgentOrAdmin is the correct gate.
export async function POST(req: Request) {
  const csrf = assertSameOrigin(req as any);
  if (csrf) return csrf;

  const gate = await requireAgentOrAdmin();
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
    const msg = String(error.message || '');
    if (msg.includes('forbidden')) return NextResponse.json({ error: 'This Account Is Not In Your Network.' }, { status: 403 });
    if (msg.includes('unauthorized')) return NextResponse.json({ error: 'Your Session Expired. Please Sign In Again.' }, { status: 401 });
    if (msg.includes('not_found')) return NextResponse.json({ error: 'Account Not Found.' }, { status: 404 });
    return safeError('agent.freeze', error);
  }
  return NextResponse.json({ ok: true, result: data });
}

// DELETE /api/agent/freeze - unfreeze a downline.
export async function DELETE(req: Request) {
  const csrf = assertSameOrigin(req as any);
  if (csrf) return csrf;

  const gate = await requireAgentOrAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createClient();

  let body: z.infer<typeof UnfreezeBody>;
  try { body = UnfreezeBody.parse(await req.json()); }
  catch (e: any) { return NextResponse.json({ error: 'bad_request', details: e.errors }, { status: 400 }); }

  const { data, error } = await supabase.rpc('unfreeze_account', {
    p_target_id: body.target_id,
  });
  if (error) {
    const msg = String(error.message || '');
    if (msg.includes('forbidden')) return NextResponse.json({ error: 'This Account Is Not In Your Network.' }, { status: 403 });
    if (msg.includes('unauthorized')) return NextResponse.json({ error: 'Your Session Expired. Please Sign In Again.' }, { status: 401 });
    if (msg.includes('not_found')) return NextResponse.json({ error: 'Account Not Found.' }, { status: 404 });
    return safeError('agent.unfreeze', error);
  }
  return NextResponse.json({ ok: true, result: data });
}
