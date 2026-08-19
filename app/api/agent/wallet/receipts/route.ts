// Round 24 Wallet - Receipt Vault
import { NextResponse } from 'next/server';
import { safeError } from '@/lib/api-error';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await getEffectiveUser(supabase);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const ALLOWED_ROLES = ['agent', 'super_agent', 'admin'];
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10) || 100, 500);
  // Clamp: a negative offset produced .range(-5, 94), which PostgREST rejects.
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') ?? '0', 10) || 0);

  const svc = await createServiceClient();

  // Join from payment_proofs to orders rather than materialising every order id
  // in Node first. The old shape fetched ALL of the agent's order ids with no
  // limit and no ordering - PostgREST caps that at 1000 rows, so a busy agent
  // silently lost an arbitrary subset of their receipts (and the count was
  // wrong too), and 1000 UUIDs interpolated into .in() is a ~37KB query string
  // that hits URL length limits before it reaches Postgres.
  const { data, count, error } = await svc
    .from('payment_proofs')
    .select(
      'id, order_id, storage_key, mime_type, size_bytes, uploaded_at, uploader_id, verified_at, orders!inner(agent_id)',
      { count: 'exact' },
    )
    .eq('orders.agent_id', user.id)
    .order('uploaded_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return safeError('wallet.receipts', error, 400);
  // Strip the join artifact so the client shape is unchanged.
  const receipts = (data ?? []).map(({ orders: _orders, ...rest }: any) => rest);
  return NextResponse.json({ receipts, count: count ?? 0 });
}
