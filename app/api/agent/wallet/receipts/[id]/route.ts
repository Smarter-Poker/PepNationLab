// Wallet Receipt Vault - short-lived signed URL for one payment proof.
// Authorizes the caller: the proof's order must belong to this agent (orders.agent_id)
// or the caller uploaded it (payment_proofs.uploader_id). Bucket: payment-proofs (private).
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const svc = await createServiceClient();
  const { data: proof } = await svc
    .from('payment_proofs')
    .select('id, order_id, storage_key, uploader_id, mime_type')
    .eq('id', id)
    .maybeSingle();
  if (!proof) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Authorize: uploader, or the agent on the proof's order.
  let allowed = proof.uploader_id === user.id;
  if (!allowed && proof.order_id) {
    const { data: order } = await svc
      .from('orders')
      .select('agent_id')
      .eq('id', proof.order_id)
      .maybeSingle();
    allowed = order?.agent_id === user.id;
  }
  if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { data: signed, error } = await svc
    .storage
    .from('payment-proofs')
    .createSignedUrl(proof.storage_key, 600);
  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: 'sign_failed' }, { status: 400 });
  }

  return NextResponse.json({ url: signed.signedUrl, mime_type: proof.mime_type ?? null });
}
