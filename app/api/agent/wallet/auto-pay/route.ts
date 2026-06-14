// R24 phase 6 - Auto-Pay toggle. When enabled and prepaid balance covers the
// statement, the late-fees cron auto-pays. Otherwise no-op.
import { NextResponse } from 'next/server';
import { safeError } from '@/lib/api-error';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const svc = await createServiceClient();
  const { data } = await svc
    .from('profiles')
    .select('auto_pay_enabled, preferred_payout_handle')
    .eq('id', user.id)
    .single();
  return NextResponse.json({
    enabled: !!data?.auto_pay_enabled,
    handle: data?.preferred_payout_handle ?? null,
  });
}

const Body = z.object({
  enabled: z.boolean(),
  handle: z.enum(['zelle', 'venmo', 'cashapp', 'apple_pay']).optional(),
});

export async function PATCH(req: Request) {
  const csrf = assertSameOrigin(req as any);
  if (csrf) return csrf;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch (e: any) { return NextResponse.json({ error: 'bad_request', details: e.errors }, { status: 400 }); }
  const svc = await createServiceClient();
  const updates: any = { auto_pay_enabled: body.enabled };
  if (body.handle) updates.preferred_payout_handle = body.handle;
  const { error } = await svc.from('profiles').update(updates).eq('id', user.id);
  if (error) return safeError('wallet.auto-pay', error, 400);
  return NextResponse.json({ ok: true });
}
