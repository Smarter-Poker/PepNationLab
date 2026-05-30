import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Payment proof upload + retrieve.
 *
 * - POST (multipart/form-data, field "file" + "orderId"): authenticated buyer
 *   uploads a payment-proof image/PDF for one of their orders.
 * - GET (?orderId=...): returns the list of proofs for an order, visible to
 *   the buyer, the order's agent, the agent's parent (super agent), and admins
 *   (RLS on payment_proofs enforces this).
 */

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/pdf',
]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'application/pdf': 'pdf',
};

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orderId = req.nextUrl.searchParams.get('orderId');
  if (!orderId) return NextResponse.json({ error: 'orderId Required' }, { status: 400 });

  const service = await createServiceClient();

  // Code-level ownership check: allow the order's buyer OR the order's agent
  // (and admins checked via profile below). This provides defense-in-depth
  // beyond RLS — ensures agents can view payment proofs to approve orders.
  const { data: orderCheck } = await service
    .from('orders')
    .select('buyer_id, agent_id')
    .eq('id', orderId)
    .maybeSingle();

  if (!orderCheck) return NextResponse.json({ error: 'Order Not Found.' }, { status: 404 });

  const isBuyer = orderCheck.buyer_id === user.id;
  const isAgent = orderCheck.agent_id === user.id;

  // Allow admins as a third access tier
  let isAdmin = false;
  if (!isBuyer && !isAgent) {
    const { data: prof } = await service
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    isAdmin = prof?.role === 'admin';
  }

  if (!isBuyer && !isAgent && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('payment_proofs')
    .select('id, order_id, uploader_id, storage_key, mime_type, size_bytes, uploaded_at, verified_at, verified_by')
    .eq('order_id', orderId)
    .order('uploaded_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  const enriched = await Promise.all(
    (data ?? []).map(async (row) => {
      const { data: signed } = await service.storage
        .from('payment-proofs')
        .createSignedUrl(row.storage_key, 600);
      return { ...row, signed_url: signed?.signedUrl ?? null };
    })
  );

  return NextResponse.json({ data: enriched });
}


export async function POST(req: NextRequest) {
  const csrfFail = assertSameOrigin(req);
  if (csrfFail) return csrfFail;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid Multipart Form Data.' }, { status: 400 });
  }

  const orderId = form.get('orderId');
  const file = form.get('file');

  if (typeof orderId !== 'string' || !orderId) {
    return NextResponse.json({ error: 'orderId Is Required.' }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'A File Is Required.' }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: 'Unsupported File Type. Use PNG, JPG, Or PDF.' }, { status: 400 });
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: 'File Is Empty.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File Exceeds 10 MB Maximum.' }, { status: 400 });
  }

  const service = await createServiceClient();
  const { data: order, error: orderErr } = await service
    .from('orders')
    .select('id, buyer_id, agent_id')
    .eq('id', orderId)
    .maybeSingle();

  if (orderErr) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  if (!order) return NextResponse.json({ error: 'Order Not Found.' }, { status: 404 });
  if (order.buyer_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const ext = EXT_BY_MIME[file.type] || 'bin';
  const key = `${orderId}/${crypto.randomUUID()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const { error: uploadErr } = await service.storage
    .from('payment-proofs')
    .upload(key, bytes, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadErr) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  const { data: row, error: insertErr } = await service
    .from('payment_proofs')
    .insert({
      order_id: orderId,
      uploader_id: user.id,
      storage_key: key,
      mime_type: file.type,
      size_bytes: file.size,
    })
    .select('id, order_id, uploader_id, storage_key, mime_type, size_bytes, uploaded_at, verified_at, verified_by')
    .single();

  if (insertErr) {
    await service.storage.from('payment-proofs').remove([key]).catch(() => {});
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  const { data: signed } = await service.storage
    .from('payment-proofs')
    .createSignedUrl(key, 600);

  // ── Messenger integration (fire-and-forget) ────────────────────────────
  // Post a message in the researcher↔agent conversation so the agent is
  // immediately alerted and can view the proof without leaving the app.
  void (async () => {
    try {
      if (!order.agent_id) return; // No agent on this order
      const conversationId = await findOrCreateDirectConversation(
        service,
        order.buyer_id,
        order.agent_id
      );
      if (!conversationId) return;

      const shortId = orderId.slice(0, 8).toUpperCase();
      const isImage = file.type.startsWith('image/');

      // 24-hour signed URL for the messenger preview
      const { data: longSigned } = await service.storage
        .from('payment-proofs')
        .createSignedUrl(key, 86400);

      await service.from('messenger_messages').insert({
        conversation_id: conversationId,
        sender_id: user.id, // The researcher who uploaded
        text: `📎 Payment proof submitted for Order #${shortId}. Please review and mark as paid once verified.`,
        message_type: isImage ? 'image' : 'file',
        media_url: longSigned?.signedUrl ?? null,
        media_metadata: {
          fileName: file.name || `payment-proof.${EXT_BY_MIME[file.type] || 'bin'}`,
          mimeType: file.type,
          sizeBytes: file.size,
          orderId,
        },
      });

      // Also drop an in-app notification for the agent
      await service.from('notifications').insert({
        user_id: order.agent_id,
        title: 'Payment Proof Received',
        body: `Your researcher submitted a payment proof for Order #${shortId}. Review and mark as paid.`,
        type: 'order',
        metadata: { orderId, action: 'mark_paid' },
      });
    } catch (err) {
      console.error('[payment-proof] messenger integration error:', err);
    }
  })();

  return NextResponse.json({ data: { ...row, signed_url: signed?.signedUrl ?? null } });
}

// ── Helper shared with mark-paid route ─────────────────────────────────────
async function findOrCreateDirectConversation(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  userAId: string,
  userBId: string
): Promise<string | null> {
  try {
    const { data: aParticipations } = await svc
      .from('messenger_participants')
      .select('conversation_id')
      .eq('user_id', userAId);

    const aConvoIds = (aParticipations ?? [])
      .map((p) => p.conversation_id)
      .filter(Boolean) as string[];

    if (aConvoIds.length > 0) {
      const { data: sharedPart } = await svc
        .from('messenger_participants')
        .select('conversation_id')
        .eq('user_id', userBId)
        .in('conversation_id', aConvoIds)
        .limit(1)
        .maybeSingle();

      if (sharedPart?.conversation_id) {
        const { data: convo } = await svc
          .from('messenger_conversations')
          .select('id')
          .eq('id', sharedPart.conversation_id)
          .eq('type', 'direct')
          .maybeSingle();
        if (convo?.id) return convo.id;
      }
    }

    // Create a new direct conversation
    const { data: newConvo, error: convoErr } = await svc
      .from('messenger_conversations')
      .insert({ type: 'direct' })
      .select('id')
      .single();

    if (convoErr || !newConvo?.id) return null;

    await svc.from('messenger_participants').insert([
      { conversation_id: newConvo.id, user_id: userAId },
      { conversation_id: newConvo.id, user_id: userBId },
    ]);

    return newConvo.id;
  } catch {
    return null;
  }
}
