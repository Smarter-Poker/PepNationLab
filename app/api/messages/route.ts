import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

/**
 * GET /api/messages
 * Fetch messages for the current user. Supports:
 *   ?unread=true  → returns only { unreadCount: number }
 *   (default)     → returns all messages (sent + received)
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();
  const url = new URL(req.url);

  // Unread count mode
  if (url.searchParams.get('unread') === 'true') {
    const { count } = await service
      .from('internal_messages')
      .select('id', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .eq('is_read', false);
    return NextResponse.json({ unreadCount: count ?? 0 });
  }

  // Full inbox — received messages
  const { data, error } = await service
    .from('internal_messages')
    .select('*, sender_profile:profiles!internal_messages_sender_id_fkey(full_name, email, username)')
    .eq('receiver_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  return NextResponse.json({ messages: data });
}

/**
 * POST /api/messages
 * Send a message. Hierarchy:
 *   Admin     → anyone
 *   SuperAgent→ their agents (parent_agent_id), sub-agents (parent_agent_id),
 *               and downline researchers (referring_agent_id points to one of their agents)
 *   Agent     → their researchers (referring_agent_id) and sub-agents (parent_agent_id)
 *   Anyone    → admin (reply up)
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();

  const body = await req.json().catch(() => ({}));
  const { receiverId, subject, body: msgBody, type, attachmentUrl, invoiceAmount, dueDate, lineItems, replyToId } = body;

  if (!receiverId || !subject || !msgBody) {
    return NextResponse.json({ error: 'Missing Required Fields' }, { status: 400 });
  }

  const validTypes = ['direct_message', 'notification', 'invoice', 'broadcast', 'credit_memo', 'payment_reminder'];
  if (type && !validTypes.includes(type)) {
    return NextResponse.json({ error: 'Invalid Message Type' }, { status: 400 });
  }

  // Verify sender role
  const { data: senderProfile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!senderProfile) {
    return NextResponse.json({ error: 'Sender Profile Not Found' }, { status: 400 });
  }

  const senderRole = senderProfile.role;

  // Admin can message anyone — skip auth checks
  if (senderRole !== 'admin') {
    // Get receiver details
    const { data: receiverProfile } = await service
      .from('profiles')
      .select('role, referring_agent_id, parent_agent_id')
      .eq('id', receiverId)
      .single();

    if (!receiverProfile) {
      return NextResponse.json({ error: 'Receiver Not Found' }, { status: 404 });
    }

    // Anyone can reply to admin
    if (receiverProfile.role === 'admin') {
      // allowed
    }
    // Direct relationship: receiver's referring_agent_id = me (my researcher)
    else if (receiverProfile.referring_agent_id === user.id) {
      // allowed
    }
    // Direct relationship: receiver's parent_agent_id = me (my sub-agent)
    else if (receiverProfile.parent_agent_id === user.id) {
      // allowed
    }
    // Super Agent downline: receiver is a researcher whose referring_agent_id
    // is an agent whose parent_agent_id = me
    else if (senderRole === 'super_agent' && receiverProfile.referring_agent_id) {
      const { data: referringAgent } = await service
        .from('profiles')
        .select('parent_agent_id')
        .eq('id', receiverProfile.referring_agent_id)
        .single();
      if (!referringAgent || referringAgent.parent_agent_id !== user.id) {
        return NextResponse.json({ error: 'Not Authorized To Message This User' }, { status: 403 });
      }
    }
    else {
      return NextResponse.json({ error: 'Not Authorized To Message This User' }, { status: 403 });
    }
  }

  // Build insert row
  const insertRow: Record<string, any> = {
    sender_id: user.id,
    receiver_id: receiverId,
    subject,
    body: msgBody,
    type: type || 'direct_message',
    attachment_url: attachmentUrl || null,
    reply_to_id: replyToId || null,
  };

  // Invoice-specific fields
  if (type === 'invoice') {
    insertRow.invoice_status = 'pending';
    insertRow.invoice_amount = invoiceAmount ? Number(invoiceAmount) : null;
    insertRow.due_date = dueDate || null;
    insertRow.line_items = lineItems || null;
  }

  // Credit memo: negative amount
  if (type === 'credit_memo') {
    insertRow.invoice_status = 'paid';
    insertRow.invoice_amount = invoiceAmount ? -Math.abs(Number(invoiceAmount)) : null;
  }

  const { data, error } = await service
    .from('internal_messages')
    .insert(insertRow)
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  // Auto-responder: check if receiver has it enabled
  try {
    const { data: receiverProfile } = await service
      .from('profiles')
      .select('auto_responder_enabled, auto_responder_message')
      .eq('id', receiverId)
      .single();

    if (receiverProfile?.auto_responder_enabled && receiverProfile?.auto_responder_message) {
      await service.from('internal_messages').insert({
        sender_id: receiverId,
        receiver_id: user.id,
        subject: 'Auto-Reply',
        body: receiverProfile.auto_responder_message,
        type: 'notification',
      });
    }
  } catch { /* auto-responder is best-effort */ }

  return NextResponse.json({ success: true, message: data });
}

/**
 * PATCH /api/messages
 * Mark messages as read. Body: { messageIds: string[] }
 */
export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();
  const body = await req.json().catch(() => ({}));
  const { messageIds } = body;

  if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
    return NextResponse.json({ error: 'Missing messageIds' }, { status: 400 });
  }

  const { error } = await service
    .from('internal_messages')
    .update({ is_read: true })
    .in('id', messageIds)
    .eq('receiver_id', user.id); // Only mark YOUR messages as read

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  return NextResponse.json({ success: true });
}
