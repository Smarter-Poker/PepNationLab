import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { NotificationPrefsSchema } from '@/lib/messenger/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PrefsRow {
  id: string;
  user_id: string;
  email_on_message: boolean | null;
  email_on_invoice: boolean | null;
  browser_push: boolean | null;
  mute_all: boolean | null;
  email_digest_messenger: boolean | null;
}

async function ensurePrefsRow(userId: string): Promise<PrefsRow | null> {
  const svc = await createServiceClient();
  const { data: existing } = await svc
    .from('notification_preferences')
    .select('id, user_id, email_on_message, email_on_invoice, browser_push, mute_all, email_digest_messenger')
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) return existing as PrefsRow;
  // Audit6 fix: two-tab race could fire two concurrent INSERTs. The table has
  // UNIQUE(user_id) so the loser hit ON CONFLICT and the original code
  // returned null, surfacing a transient null prefs to the user.
  // Use upsert(onConflict: user_id) so both tabs resolve to the same row.
  // Service-role bypasses RLS.
  const { data: created } = await svc
    .from('notification_preferences')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: false })
    .select('id, user_id, email_on_message, email_on_invoice, browser_push, mute_all, email_digest_messenger')
    .maybeSingle();
  if (created) return created as PrefsRow;
  // Final fallback: in the extremely rare case the upsert returns no row,
  // SELECT the row written by the racing tab so we never return null.
  const { data: again } = await svc
    .from('notification_preferences')
    .select('id, user_id, email_on_message, email_on_invoice, browser_push, mute_all, email_digest_messenger')
    .eq('user_id', userId)
    .maybeSingle();
  return (again as PrefsRow | null) ?? null;
}

export async function GET(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const limited = await messengerRateLimit('default', user.id);
  if (!limited.allowed) return messengerRateLimitResponse(limited);
  const prefs = await ensurePrefsRow(user.id);
  return NextResponse.json({ prefs });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const limited = await messengerRateLimit('default', user.id);
  if (!limited.allowed) return messengerRateLimitResponse(limited);
  const body = await req.json().catch(() => ({}));
  const parsed = NotificationPrefsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid Body', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  // Make sure a row exists before we update it.
  await ensurePrefsRow(user.id);

  const update: Record<string, unknown> = {};
  if (parsed.data.browserPush !== undefined) update.browser_push = parsed.data.browserPush;
  if (parsed.data.emailOnMessage !== undefined) update.email_on_message = parsed.data.emailOnMessage;
  if (parsed.data.emailOnInvoice !== undefined) update.email_on_invoice = parsed.data.emailOnInvoice;
  if (parsed.data.muteAll !== undefined) update.mute_all = parsed.data.muteAll;

  if (Object.keys(update).length === 0) {
    const prefs = await ensurePrefsRow(user.id);
    return NextResponse.json({ prefs });
  }

  const svc = await createServiceClient();
  const { data, error: updErr } = await svc
    .from('notification_preferences')
    .update(update)
    .eq('user_id', user.id)
    .select('id, user_id, email_on_message, email_on_invoice, browser_push, mute_all, email_digest_messenger')
    .maybeSingle();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json({ prefs: data });
}
