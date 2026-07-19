import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';
import { assertSameOrigin } from '@/lib/csrf';
import { findOrCreateDirectConversation } from '@/lib/messenger/conversations';
import { notify, notifyAdmins } from '@/lib/notify';
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
  const { data: { user } } = await getEffectiveUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orderId = req.nextUrl.searchParams.get('orderId');
  if (!orderId) return NextResponse.json({ error: 'orderId Required' }, { status: 400 });

  const service = await createServiceClient();

  // Code-level ownership check: allow the order's buyer OR the order's agent
  // (and admins checked via profile below). This provides defense-in-depth
  // beyond RLS - ensures agents can view payment proofs to approve orders.
  const { data: orderCheck } = await service
    .from('orders')
    .select('buyer_id, agent_id')
    .eq('id', orderId)
    .maybeSingle();

  if (!orderCheck) return NextResponse.json({ error: 'Order Not Found.' }, { status: 404 });

  const isBuyer = orderCheck.buyer_id === user.id;
  const isAgent = orderCheck.agent_id === user.id;

  // The order agent's upline super agent gets oversight access too (the
  // route's documented access model; mark-paid already honors it).
  let isUpline = false;
  if (!isBuyer && !isAgent && orderCheck.agent_id) {
    const { data: agentProf } = await service
      .from('profiles')
      .select('parent_agent_id')
      .eq('id', orderCheck.agent_id)
      .maybeSingle();
    isUpline = !!agentProf?.parent_agent_id && agentProf.parent_agent_id === user.id;
  }

  // Allow admins as a third access tier
  let isAdmin = false;
  if (!isBuyer && !isAgent && !isUpline) {
    const { data: prof } = await service
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    isAdmin = prof?.role === 'admin';
  }

  if (!isBuyer && !isAgent && !isUpline && !isAdmin) {
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
  const { data: { user } } = await getEffectiveUser(supabase);
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
    .select('id, buyer_id, agent_id, status')
    .eq('id', orderId)
    .maybeSingle();

  if (orderErr) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  if (!order) return NextResponse.json({ error: 'Order Not Found.' }, { status: 404 });
  if (order.buyer_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  if (['cancelled', 'shipped', 'delivered'].includes(order.status)) {
    return NextResponse.json(
      { error: 'This Order Is No Longer Awaiting Payment. Payment Proof Can No Longer Be Submitted.' },
      { status: 409 },
    );
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
    .maybeSingle();

  if (insertErr) {
    await service.storage.from('payment-proofs').remove([key]).catch(() => {});
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  const { data: signed } = await service.storage
    .from('payment-proofs')
    .createSignedUrl(key, 600);

  // ── Messenger integration ────────────────────────────────────────
  // Post a message in the researcher↔agent conversation so the agent is
  // immediately alerted and can view the proof without leaving the app.
  // IMPORTANT: We must 'await' this so Vercel does not kill the process!
  try {
    const shortId = orderId.slice(0, 8).toUpperCase();
    const isImage = file.type.startsWith('image/');

    // 24-hour signed URL for the messenger preview
    const { data: longSigned } = await service.storage
      .from('payment-proofs')
      .createSignedUrl(key, 86400);

    if (!order.agent_id) {
      await notifyAdmins(service, {
        type: 'system',
        title: 'Payment Proof Received (Direct Order)',
        body: `A Direct Customer Submitted A Payment Proof For Order #${shortId}. Review And Mark As Paid.`,
        url: '/admin/orders',
      });
    } else {
      const conversationId = await findOrCreateDirectConversation(
        service,
        order.buyer_id,
        order.agent_id
      );
      if (conversationId) {
        await service.from('messenger_messages').insert({
          conversation_id: conversationId,
          sender_id: user.id, // The researcher who uploaded
          text: `[Attachment] Payment proof submitted for Order #${shortId}. Please review and mark as paid once verified.`,
          message_type: isImage ? 'image' : 'file',
          media_url: longSigned?.signedUrl ?? null,
          media_metadata: {
            filename: file.name || `payment-proof.${EXT_BY_MIME[file.type] || 'bin'}`,
            contentType: file.type,
            size: file.size,
            orderId,
          },
          labels: [`Order #${shortId}`, 'Proof of Payment'],
        });
      }

      // Notifications are independent of the messenger thread - a messenger
      // failure must never silence the payment-proof alert.
      await notify(service, {
        userId: order.agent_id,
        type: 'system',
        title: 'Payment Proof Received',
        body: `Your Researcher Submitted A Payment Proof For Order #${shortId}. Review And Mark As Paid Once Verified.`,
        url: '/dashboard?tab=Orders',
      });
      const { data: agentProf } = await service.from('profiles').select('parent_agent_id').eq('id', order.agent_id).maybeSingle();
      if (agentProf?.parent_agent_id) {
        await notify(service, {
          userId: agentProf.parent_agent_id,
          type: 'system',
          title: 'Sub-Agent Payment Proof Received',
          body: `A Researcher For Your Sub-Agent Submitted A Payment Proof For Order #${shortId}.`,
          url: '/dashboard?tab=Orders',
        });
      }
    }
  } catch (err) {
    console.error('[payment-proof] messenger integration error:', err);
  }

  return NextResponse.json({ data: { ...row, signed_url: signed?.signedUrl ?? null } });
}

// The direct-conversation resolver lives in lib/messenger/conversations.ts,
// shared with /api/agent/orders/mark-paid (was previously duplicated here).
