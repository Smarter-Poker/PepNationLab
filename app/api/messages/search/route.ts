import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/** GET: Search messages by keyword */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get('q');
  const counterpartId = url.searchParams.get('counterpartId');
  if (!q || q.trim().length < 2) return NextResponse.json({ error: 'Query too short' }, { status: 400 });

  // Sanitize inputs to prevent PostgREST filter injection
  const safeQ = q.replace(/[.,()]/g, '');
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (counterpartId && !uuidRegex.test(counterpartId)) {
    return NextResponse.json({ error: 'Invalid counterpartId' }, { status: 400 });
  }

  const service = await createServiceClient();
  let query = service
    .from('internal_messages')
    .select('id, sender_id, receiver_id, subject, body, type, created_at, sender_profile:profiles!internal_messages_sender_id_fkey(full_name, email)')
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .is('deleted_at', null)
    .or(`body.ilike.%${safeQ}%,subject.ilike.%${safeQ}%`)
    .order('created_at', { ascending: false })
    .limit(50);

  if (counterpartId) {
    query = query.or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${counterpartId}),and(sender_id.eq.${counterpartId},receiver_id.eq.${user.id})`
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  return NextResponse.json({ results: data });
}
