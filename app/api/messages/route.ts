import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data });
}

/**
 * POST /api/messages
 * Send a message. Admin can message anyone. Agents can message
 * their researchers (referring_agent_id) and sub-agents (parent_agent_id).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();

  const body = await req.json().catch(() => ({}));
  const { receiverId, subject, body: msgBody, type, attachmentUrl } = body;

  if (!receiverId || !subject || !msgBody) {
    return NextResponse.json({ error: 'Missing Required Fields' }, { status: 400 });
  }

  const validTypes = ['direct_message', 'notification', 'invoice'];
  if (type && !validTypes.includes(type)) {
    return NextResponse.json({ error: 'Invalid Message Type' }, { status: 400 });
  }

  // Verify sender
  const { data: senderProfile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!senderProfile) {
    return NextResponse.json({ error: 'Sender Profile Not Found' }, { status: 400 });
  }

  const isSenderAdmin = senderProfile.role === 'admin';

  // Admin can message anyone
  if (!isSenderAdmin) {
    // Agents: verify the receiver belongs to them
    const { data: receiverProfile } = await service
      .from('profiles')
      .select('referring_agent_id, parent_agent_id')
      .eq('id', receiverId)
      .single();

    if (!receiverProfile) {
      return NextResponse.json({ error: 'Receiver Not Found' }, { status: 404 });
    }

    const isReferredResearcher = receiverProfile.referring_agent_id === user.id;
    const isSubAgent = receiverProfile.parent_agent_id === user.id;

    // Also allow replying to admin (receiver is admin)
    const { data: receiverRole } = await service
      .from('profiles')
      .select('role')
      .eq('id', receiverId)
      .single();
    const isReplyToAdmin = receiverRole?.role === 'admin';

    if (!isReferredResearcher && !isSubAgent && !isReplyToAdmin) {
      return NextResponse.json({ error: 'Not Authorized To Message This User' }, { status: 403 });
    }
  }

  const { data, error } = await service
    .from('internal_messages')
    .insert({
      sender_id: user.id,
      receiver_id: receiverId,
      subject,
      body: msgBody,
      type: type || 'direct_message',
      attachment_url: attachmentUrl || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, message: data });
}

/**
 * PATCH /api/messages
 * Mark messages as read. Body: { messageIds: string[] }
 */
export async function PATCH(req: NextRequest) {
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
