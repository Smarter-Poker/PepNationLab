import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

/** PATCH: Edit message (5 min window) | DELETE: Soft-delete (5 min window) */
export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { messageId, newBody } = body;
  if (!messageId || !newBody?.trim()) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  if (typeof newBody !== 'string' || newBody.trim().length > 4_000) {
    return NextResponse.json({ error: 'Message body too long (max 4,000 characters)' }, { status: 400 });
  }

  const service = await createServiceClient();

  // Fetch message to verify ownership + time window
  const { data: msg, error: fetchError } = await service
    .from('internal_messages')
    .select('sender_id, created_at, deleted_at')
    .eq('id', messageId)
    .single();

  if (fetchError || !msg) return NextResponse.json({ error: 'Message Not Found' }, { status: 404 });
  if (msg.sender_id !== user.id) return NextResponse.json({ error: 'Can Only Edit Own Messages' }, { status: 403 });
  if (msg.deleted_at) return NextResponse.json({ error: 'Message Already Deleted' }, { status: 400 });

  const ageMs = Date.now() - new Date(msg.created_at).getTime();
  if (ageMs > 5 * 60 * 1000) return NextResponse.json({ error: 'Edit Window Expired (5 Minutes)' }, { status: 403 });

  const { error: updateError } = await service
    .from('internal_messages')
    .update({ body: newBody.trim(), edited_at: new Date().toISOString() })
    .eq('id', messageId);

  if (updateError) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { messageId } = body;
  if (!messageId) return NextResponse.json({ error: 'Missing messageId' }, { status: 400 });

  const service = await createServiceClient();

  const { data: msg, error: fetchError } = await service
    .from('internal_messages')
    .select('sender_id, created_at, deleted_at')
    .eq('id', messageId)
    .single();

  if (fetchError || !msg) return NextResponse.json({ error: 'Message Not Found' }, { status: 404 });
  if (msg.sender_id !== user.id) return NextResponse.json({ error: 'Can Only Delete Own Messages' }, { status: 403 });
  if (msg.deleted_at) return NextResponse.json({ error: 'Already Deleted' }, { status: 400 });

  const ageMs = Date.now() - new Date(msg.created_at).getTime();
  if (ageMs > 5 * 60 * 1000) return NextResponse.json({ error: 'Delete Window Expired (5 Minutes)' }, { status: 403 });

  const { error: updateError } = await service
    .from('internal_messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId);

  if (updateError) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  return NextResponse.json({ success: true });
}
