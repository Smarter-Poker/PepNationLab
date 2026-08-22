import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';
import { assertSameOrigin } from '@/lib/csrf';
import { findOrCreateDirectConversation } from '@/lib/messenger/conversations';
import { sendBroadcast } from '@/lib/messenger/broadcast';
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

  // Abuse cap: a handful of proofs per order is legitimate (wrong screenshot,
  // second payment); dozens is a storage / notification-spam loop. Each
  // upload fans out messenger inserts, broadcasts, and agent + upline
  // notifications, so this must be bounded.
  const { count: existingProofs } = await service
    .from('payment_proofs')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', orderId);
  if ((existingProofs ?? 0) >= 10) {
    return NextResponse.json(
      { error: 'Upload Limit Reached For This Order. Contact Your Agent If You Need To Replace A Proof.' },
      { status: 429 },
    );
  }

  const ext = EXT_BY_MIME[file.type] || 'bin';
  const key = `${orderId}/${crypto.randomUUID()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // Fraud guard: fingerprint the file so re-used receipts are detectable.
  const contentHash = crypto.createHash('sha256').update(bytes).digest('hex');

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
      content_hash: contentHash,
    })
    .select('id, order_id, uploader_id, storage_key, mime_type, size_bytes, uploaded_at, verified_at, verified_by')
    .maybeSingle();

  if (insertErr) {
    await service.storage.from('payment-proofs').remove([key]).catch(() => {});
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  // Uploading a payment screenshot IS confirming you sent payment - stamp
  // buyer_payment_sent_at (CAS, first writer wins) so the buyer's 12-hour
  // "Did You Send Payment?" reminders stop without needing a second tap.
  try {
    await service
      .from('orders')
      .update({ buyer_payment_sent_at: new Date().toISOString(), buyer_payment_sent_by: user.id })
      .eq('id', orderId)
      .is('buyer_payment_sent_at', null);
  } catch { /* best-effort - the proof itself is already saved */ }

  const { data: signed } = await service.storage
    .from('payment-proofs')
    .createSignedUrl(key, 600);

  // Fraud guard: has this EXACT image already been submitted on a different
  // order? Uploads still succeed (the reviewer decides), but the agent and
  // admins get an explicit duplicate warning so a recycled screenshot can't
  // slip through as fresh proof of a new payment.
  let duplicateOfOrder: string | null = null;
  try {
    const { data: dup } = await service
      .from('payment_proofs')
      .select('order_id')
      .eq('content_hash', contentHash)
      .neq('order_id', orderId)
      .limit(1)
      .maybeSingle();
    duplicateOfOrder = dup?.order_id ?? null;
  } catch {
    duplicateOfOrder = null;
  }

  // ── Messenger integration ──────────────
  // Post a message in the researcher↔agent conversation so the agent is
  // immediately alerted and can view the proof without leaving the app.
  // IMPORTANT: We must 'await' this so Vercel does not kill the process!
  try {
    const shortId = orderId.slice(0, 8).toUpperCase();
    const isImage = file.type.startsWith('image/');

    // 24-hour signed URL stored in media_url. Read paths (get-messages,
    // list-pins, thread replies) re-sign it fresh on every load via the
    // bucket-aware lib/messenger/signMedia, so the proof keeps rendering in
    // the chat after this token expires.
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
        const { data: proofMsg } = await service
          .from('messenger_messages')
          .insert({
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
          })
          .select('*')
          .maybeSingle();

        // Realtime fanout - the bare insert above bypasses the send-message
        // route, so without these broadcasts the agent's open messenger never
        // shows the proof until a full page reload: the conversation channel
        // renders the bubble live, user_notify updates the sidebar/OS layer,
        // and user_unread bumps the red badge (participant row is fetched
        // AFTER the insert so the trigger-updated unread_count is fresh).
        if (proofMsg) {
          const outgoing = { ...proofMsg, media_url: longSigned?.signedUrl ?? null };
          await sendBroadcast({
            topic: `conversation:${conversationId}`,
            event: 'new_message',
            payload: { message: outgoing },
          }).catch(() => {});

          const { data: agentPart } = await service
            .from('messenger_participants')
            .select('*')
            .eq('conversation_id', conversationId)
            .eq('user_id', order.agent_id)
            .maybeSingle();

          await sendBroadcast([
            {
              topic: `user_notify:${order.agent_id}`,
              event: 'new_message_notify',
              payload: { message: outgoing },
            },
            ...(agentPart
              ? [{
                  topic: `user_unread:${order.agent_id}`,
                  event: 'participant_updated',
                  payload: { participant: agentPart },
                }]
              : []),
          ]).catch(() => {});
        }
      }

      // Notifications are independent of the messenger thread - a messenger
      // failure must never silence the payment-proof alert.
      await notify(service, {
        userId: order.agent_id,
        type: 'system',
        title: 'Payment Proof Received',
        body: `Your Researcher Submitted A Payment Proof For Order #${shortId}. Review And Mark As Paid Once Verified.`,
        url: `/dashboard/agent?tab=Orders&order=${shortId}`,
      });
      const { data: agentProf } = await service.from('profiles').select('parent_agent_id').eq('id', order.agent_id).maybeSingle();
      if (agentProf?.parent_agent_id) {
        await notify(service, {
          userId: agentProf.parent_agent_id,
          type: 'system',
          title: 'Sub-Agent Payment Proof Received',
          body: `A Researcher For Your Sub-Agent Submitted A Payment Proof For Order #${shortId}.`,
          url: `/dashboard/agent?tab=Orders&order=${shortId}`,
        });
      }
    }
  } catch (err) {
    console.error('[payment-proof] messenger integration error:', err);
  }

  // Duplicate-receipt warning fanout (kept OUTSIDE the messenger block so a
  // chat failure can never silence a fraud signal).
  if (duplicateOfOrder) {
    try {
      const shortId = orderId.slice(0, 8).toUpperCase();
      const dupShort = duplicateOfOrder.slice(0, 8).toUpperCase();
      if (order.agent_id) {
        await notify(service, {
          userId: order.agent_id,
          type: 'order_attention',
          title: `Duplicate Payment Proof Warning: Order #${shortId}`,
          body: `The Receipt Submitted For Order #${shortId} Is Identical To One Already Submitted For Order #${dupShort}. Verify The Payment Carefully Before Marking Paid.`,
          url: `/dashboard/agent?tab=Orders&order=${shortId}`,
        });
      }
      await notifyAdmins(service, {
        type: 'order_attention',
        title: `Duplicate Payment Proof: Order #${shortId}`,
        body: `A Payment Proof Identical To Order #${dupShort}'s Receipt Was Submitted For Order #${shortId}.`,
        url: `/admin/orders?highlight=${orderId}`,
      });
    } catch (err) {
      console.error('[payment-proof] duplicate warning error:', err);
    }
  }

  return NextResponse.json({ data: { ...row, signed_url: signed?.signedUrl ?? null } });
}

// The direct-conversation resolver lives in lib/messenger/conversations.ts,
// shared with /api/agent/orders/mark-paid (was previously duplicated here).
