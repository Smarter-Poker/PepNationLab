import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin, requireAgent } from '@/lib/admin-auth';

// POST: Create an internal message (usually used by Super Agents or System to send invoices/notifications)
export async function POST(req: NextRequest) {
  try {
    const authCheck = await requireAgent();
    if (!authCheck.ok) return authCheck.response;

    const { receiverId, subject, body, type, attachmentUrl } = await req.json();

    if (!receiverId || !subject || !body) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const validTypes = ['direct_message', 'notification', 'invoice'];
    if (type && !validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid message type' }, { status: 400 });
    }

    const supabase = await createServiceClient();
    
    // Verify Sender Authorization
    const { data: senderProfile } = await supabase.from('profiles').select('role, parent_agent_id').eq('id', authCheck.user.id).single();
    const { data: receiverProfile } = await supabase.from('profiles').select('role, parent_agent_id').eq('id', receiverId).single();

    if (!senderProfile || !receiverProfile) {
      return NextResponse.json({ error: 'Invalid sender or receiver' }, { status: 400 });
    }

    const isSenderAdmin = senderProfile.role === 'admin';
    const isReceiverAdmin = receiverProfile.role === 'admin';
    const isParentSub = senderProfile.parent_agent_id === receiverId || receiverProfile.parent_agent_id === authCheck.user.id;

    if (!isSenderAdmin && !isReceiverAdmin && !isParentSub) {
      return NextResponse.json({ error: 'Not authorized to message this user' }, { status: 403 });
    }
    
    const { data, error } = await supabase
      .from('internal_messages')
      .insert({
        sender_id: authCheck.user.id,
        receiver_id: receiverId,
        subject: subject,
        body: body,
        type: type || 'direct_message',
        attachment_url: attachmentUrl || null
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: data });
  } catch (error) {
    console.error('Messages API POST Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
