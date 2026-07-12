import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';

/** GET: Export conversation as CSV */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await getEffectiveUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const counterpartId = url.searchParams.get('counterpartId');
  if (!counterpartId) return NextResponse.json({ error: 'Missing counterpartId' }, { status: 400 });
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(counterpartId)) return NextResponse.json({ error: 'Invalid counterpartId' }, { status: 400 });

  const service = await createServiceClient();
  const { data, error } = await service
    .from('internal_messages')
    .select('sender_id, subject, body, type, created_at, sender_profile:profiles!internal_messages_sender_id_fkey(full_name)')
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${counterpartId}),and(sender_id.eq.${counterpartId},receiver_id.eq.${user.id})`
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  // Build CSV
  const rows = [['Date', 'Sender', 'Type', 'Subject', 'Body'].join(',')];
  for (const m of data ?? []) {
    const senderName = (m as any).sender_profile?.full_name || 'Unknown';
    const escapeCsv = (s: string) => `"${(s || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`;
    rows.push([
      new Date(m.created_at).toISOString(),
      escapeCsv(senderName),
      m.type,
      escapeCsv(m.subject),
      escapeCsv(m.body),
    ].join(','));
  }

  const csv = rows.join('\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="chat-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
