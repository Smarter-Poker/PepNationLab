// R24 phase 6 - Auto-Pay toggle. When enabled and prepaid balance covers the
// statement, the late-fees cron auto-pays. Otherwise no-op.
import { NextResponse } from 'next/server';
import { safeError } from '@/lib/api-error';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireAgent } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;
  const userId = gate.user.id;
  const svc = await createServiceClient();
  const { data } = await svc
    .from('profiles')
    .select('auto_pay_enabled, preferred_payout_handle')
    .eq('id', userId)
    .maybeSingle();
  return NextResponse.json({
    enabled: !!data?.auto_pay_enabled,
    handle: data?.preferred_payout_handle ?? null,
  });
}

const Body = z.object({
  enabled: z.boolean(),
  // Must cover every option WalletSettings offers - it lists Varo too, and a
  // narrower enum here made saving Varo 400 on every attempt.
  handle: z.enum(['zelle', 'venmo', 'cashapp', 'apple_pay', 'varo']).optional(),
});

export async function PATCH(req: Request) {
  const csrf = assertSameOrigin(req as any);
  if (csrf) return csrf;
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;
  const userId = gate.user.id;
  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch (e: any) { return NextResponse.json({ error: 'bad_request', details: e.errors }, { status: 400 }); }
  const svc = await createServiceClient();

  // Turning auto-pay ON with no handle on file left the account enabled with
  // preferred_payout_handle NULL - the cron would then try to settle bills for
  // an account with nowhere to send money from.
  if (body.enabled) {
    let handle = body.handle;
    if (!handle) {
      const { data: existing } = await svc
        .from('profiles').select('preferred_payout_handle').eq('id', userId).maybeSingle();
      handle = (existing?.preferred_payout_handle as typeof body.handle) ?? undefined;
    }
    if (!handle) {
      return NextResponse.json(
        { error: 'Choose A Payment Handle Before Turning On Auto-Pay.', code: 'handle_required' },
        { status: 400 },
      );
    }
  }

  const updates: any = { auto_pay_enabled: body.enabled };
  if (body.handle) updates.preferred_payout_handle = body.handle;
  const { error } = await svc.from('profiles').update(updates).eq('id', userId);
  if (error) return safeError('wallet.auto-pay', error, 400);
  return NextResponse.json({ ok: true });
}
