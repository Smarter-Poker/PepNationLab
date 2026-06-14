// Round 24 Wallet - Receipt Vault
import { NextResponse } from 'next/server';
import { safeError } from '@/lib/api-error';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10) || 100, 500);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10) || 0;

  const svc = await createServiceClient();
  // Get all payment_proofs for orders where this user is the agent OR buyer
  const { data: agentOrders } = await svc.from('orders').select('id').eq('agent_id', user.id);
  const orderIds = (agentOrders ?? []).map((o: any) => o.id);
  if (orderIds.length === 0) return NextResponse.json({ receipts: [], count: 0 });

  const { data, count, error } = await svc
    .from('payment_proofs')
    .select('id, order_id, storage_key, mime_type, size_bytes, uploaded_at, uploader_id, verified_at', { count: 'exact' })
    .in('order_id', orderIds)
    .order('uploaded_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return safeError('wallet.receipts', error, 400);
  return NextResponse.json({ receipts: data ?? [], count: count ?? 0 });
}
