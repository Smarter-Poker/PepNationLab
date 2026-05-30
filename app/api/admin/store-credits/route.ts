import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { notifyBalanceRecharge } from '@/lib/notify';

const GrantSchema = z.object({
  user_id: z.string().uuid(),
  amount: z.number().positive(),
  description: z.string().min(1).max(500),
  expires_at: z.string().datetime().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const service = await createServiceClient();
  const userId = req.nextUrl.searchParams.get('user_id');

  let query = service
    .from('store_credits')
    .select('id, user_id, amount, balance_before, balance_after, type, source_order_id, expires_at, description, created_by, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (userId) query = query.eq('user_id', userId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  // Join in user names for display
  const userIds = Array.from(new Set((data ?? []).map((r: any) => r.user_id).filter(Boolean)));
  const users: Record<string, { full_name: string | null; email: string | null }> = {};
  if (userIds.length) {
    const { data: profs } = await service
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds as string[]);
    profs?.forEach((p: any) => {
      users[p.id] = { full_name: p.full_name, email: p.email };
    });
  }

  return NextResponse.json({ data, users });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  const parsed = GrantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Grant Payload', details: parsed.error.issues }, { status: 400 });
  }

  const service = await createServiceClient();

  const { data: balanceRow, error: balanceErr } = await service
    .from('store_credit_balances')
    .select('balance')
    .eq('user_id', parsed.data.user_id)
    .maybeSingle();
  if (balanceErr) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  const balanceBefore = Number(balanceRow?.balance ?? 0);
  const balanceAfter = balanceBefore + parsed.data.amount;

  const { data: inserted, error: insertErr } = await service
    .from('store_credits')
    .insert({
      user_id: parsed.data.user_id,
      amount: parsed.data.amount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      type: 'issue',
      description: parsed.data.description,
      expires_at: parsed.data.expires_at ?? null,
      created_by: gate.userId,
    })
    .select('id, balance_after')
    .single();

  if (insertErr) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  await service.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'store_credit_granted',
    entity_type: 'store_credit',
    entity_id: inserted.id,
    changes: {
      user_id: parsed.data.user_id,
      amount: parsed.data.amount,
      description: parsed.data.description,
      expires_at: parsed.data.expires_at ?? null,
    },
  });

  // In-app notification — shows in bell immediately
  void notifyBalanceRecharge(
    service,
    parsed.data.user_id,
    parsed.data.amount,
    parsed.data.description ?? undefined,
  ).catch(() => { /* best-effort */ });

  return NextResponse.json({ success: true, id: inserted.id, balance_after: Number(inserted.balance_after) });
}
