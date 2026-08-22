import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireManufacturer } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import { notify } from '@/lib/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Manufacturer agent-broadcast center.
// GET  -> the caller's broadcast history
// POST -> send an announcement (in-app + web push) to every active agent
//         in the caller's downline. Rate-limited to 5 per hour per manufacturer.

const TITLE_MAX = 80;
const BODY_MAX = 500;

export async function GET() {
  const gate = await requireManufacturer();
  if (!gate.ok) return gate.response;

  const svc = await createServiceClient();
  const { data, error } = await svc
    .from('agent_broadcasts')
    .select('id, title, body, url, recipient_count, sent_count, created_at')
    .eq('agent_id', gate.user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: 'Could Not Load Your Broadcasts.' }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireManufacturer();
  if (!gate.ok) return gate.response;

  const limited = await rateLimit({
    key: 'manufacturer_broadcast',
    limit: 5,
    windowSeconds: 3600,
    identifier: gate.user.id,
  });
  if (!limited.allowed) {
    return NextResponse.json(
      { error: 'You Have Sent Too Many Broadcasts In The Last Hour. Try Again Later.' },
      { status: 429 },
    );
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid Request Body.' }, { status: 400 }); }

  const title = String(body?.title ?? '').trim().slice(0, TITLE_MAX);
  const message = String(body?.message ?? '').trim().slice(0, BODY_MAX);
  let url = body?.url ? String(body.url).trim().slice(0, 300) : null;

  if (title.length < 2) return NextResponse.json({ error: 'A Title Is Required.' }, { status: 400 });
  if (message.length < 2) return NextResponse.json({ error: 'A Message Is Required.' }, { status: 400 });
  // Only allow same-site relative deeplinks (never an off-domain redirect).
  if (url && !url.startsWith('/')) url = null;

  const svc = await createServiceClient();

  const { data: agents } = await svc
    .from('profiles')
    .select('id')
    .eq('parent_agent_id', gate.user.id)
    .in('role', ['agent', 'super_agent'])
    .eq('is_active', true);

  const recipients = (agents ?? []).map((r: { id: string }) => r.id);

  let sent = 0;
  for (const recipient of recipients) {
    try {
      await notify(svc, {
        userId: recipient,
        type: 'system',
        title,
        body: message,
        url: url ?? '/dashboard',
      });
      sent += 1;
    } catch {
      // best-effort per recipient
    }
  }

  // Record the broadcast for the history (best-effort; never fail the
  // send because history logging hiccuped).
  try {
    await svc.from('agent_broadcasts').insert({
      agent_id: gate.user.id,
      title,
      body: message,
      url,
      recipient_count: recipients.length,
      sent_count: sent,
    });
  } catch {
    // no-op
  }

  return NextResponse.json({ success: true, sent, total: recipients.length });
}
