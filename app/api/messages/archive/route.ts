import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/** POST: Archive | DELETE: Unarchive | GET: List archived */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();
  const { data, error } = await service
    .from('archived_conversations')
    .select('counterpart_id, archived_at')
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ archived: data });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { counterpartId } = body;
  if (!counterpartId) return NextResponse.json({ error: 'Missing counterpartId' }, { status: 400 });

  const service = await createServiceClient();
  const { error } = await service.from('archived_conversations').upsert({
    user_id: user.id, counterpart_id: counterpartId,
  }, { onConflict: 'user_id,counterpart_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { counterpartId } = body;
  if (!counterpartId) return NextResponse.json({ error: 'Missing counterpartId' }, { status: 400 });

  const service = await createServiceClient();
  const { error } = await service.from('archived_conversations')
    .delete()
    .eq('user_id', user.id)
    .eq('counterpart_id', counterpartId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
