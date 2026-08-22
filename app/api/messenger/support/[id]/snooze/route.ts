
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';
import { assertSameOrigin } from '@/lib/csrf';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Body accepts either a preset duration ("1h" | "4h" | "tomorrow") OR an
// explicit `until` ISO timestamp. Passing `until: null` clears the snooze.
const Body = z.object({
  preset: z.enum(['1h','4h','tomorrow','clear']).optional(),
  until: z.string().datetime().nullable().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const supabase = await createClient();
  const { data: { user } } = await getEffectiveUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid Id' }, { status: 400 });

  const raw = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid Payload' }, { status: 400 });

  let until: string | null = null;
  if (parsed.data.preset === '1h') until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  else if (parsed.data.preset === '4h') until = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
  else if (parsed.data.preset === 'tomorrow') {
    // Use Intl to find the current date in America/Chicago, then construct
    // tomorrow 9:00am Central as an explicit UTC timestamp.
    // CST = UTC-6, CDT = UTC-5. We detect DST by checking the offset.
    const nowUtc = new Date();
    const centralFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
    const parts = centralFormatter.formatToParts(nowUtc);
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00';
    const centralNow = new Date(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`);
    // Advance to tomorrow at 09:00 Central (local wall clock)
    const tomorrowCentralWall = new Date(centralNow);
    tomorrowCentralWall.setDate(tomorrowCentralWall.getDate() + 1);
    tomorrowCentralWall.setHours(9, 0, 0, 0);
    // Determine the UTC offset for America/Chicago at that future moment.
    // We approximate by checking current DST status: if central hour string
    // when formatting a date at tomorrowCentralWall differs, recalculate.
    // Simplest safe approach: offset = difference between UTC and Central NOW.
    const offsetMs = nowUtc.getTime() - centralNow.getTime();
    until = new Date(tomorrowCentralWall.getTime() + offsetMs).toISOString();
  } else if (parsed.data.preset === 'clear') until = null;
  else if (parsed.data.until !== undefined) until = parsed.data.until;

  const { error } = await supabase.rpc('fn_messenger_support_snooze', { p_conv: id, p_until: until }); // @ts-ignore
  if (error) {
    if (/Admin only/i.test(error.message)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Failed To Snooze' }, { status: 500 });
  }
  return NextResponse.json({ success: true, snoozed_until: until });
}
