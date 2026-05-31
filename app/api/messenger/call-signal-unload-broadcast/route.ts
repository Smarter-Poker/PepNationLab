import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetId = searchParams.get('targetId');
  if (!targetId) {
    return NextResponse.json({ error: 'Missing targetId' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Missing body' }, { status: 400 });
  }

  try {
    const svc = await createServiceClient();
    const channel = svc.channel(`call-signal:${targetId}`);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Channel subscription timeout')), 5000);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          resolve();
        } else if (status === 'CHANNEL_ERROR') {
          clearTimeout(timeout);
          reject(new Error('Channel error'));
        }
      });
    });

    await channel.send({
      type: 'broadcast',
      event: 'call_ended',
      payload: body.payload || body,
    });

    // Cleanup channel
    void svc.removeChannel(channel);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[UNLOAD BROADCAST] Failed to broadcast server-side:', err);
    return NextResponse.json({ error: 'Failed to broadcast' }, { status: 500 });
  }
}
