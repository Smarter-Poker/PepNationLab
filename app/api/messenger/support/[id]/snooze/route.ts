
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
    const t = new Date(); t.setDate(t.getDate() + 1); t.setHours(9, 0, 0, 0); until = t.toISOString();
  } else if (parsed.data.preset === 'clear') until = null;
  else if (parsed.data.until !== undefined) until = parsed.data.until;

  const { error } = await supabase.rpc('fn_messenger_support_snooze', { p_conv: id, p_until: until }); // @ts-ignore
  if (error) {
    if (/Admin only/i.test(error.message)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Failed To Snooze' }, { status: 500 });
  }
  return NextResponse.json({ success: true, snoozed_until: until });
}
