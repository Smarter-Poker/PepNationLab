import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { sanitizeUsername, validateUsername } from '@/lib/usernames';

export const dynamic = 'force-dynamic';

const COOLDOWN_DAYS = 30;
const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

const BodySchema = z.object({
  username: z.string().trim().min(1).max(60),
});

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const candidate = sanitizeUsername(parsed.data.username);
  const validation = validateUsername(candidate);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error ?? 'invalid_username' },
      { status: 400 },
    );
  }

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('username, username_changed_at')
    .eq('id', user.id)
    .maybeSingle();

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'profile_not_found' }, { status: 404 });
  }

  if (profile.username === candidate) {
    return NextResponse.json({ error: 'Username Unchanged.' }, { status: 400 });
  }

  if (profile.username_changed_at) {
    const last = new Date(profile.username_changed_at).getTime();
    const diff = Date.now() - last;
    if (diff < COOLDOWN_MS) {
      const daysLeft = Math.ceil((COOLDOWN_MS - diff) / (24 * 60 * 60 * 1000));
      return NextResponse.json(
        { error: 'Username Change Cooldown Active.', days_until_eligible: daysLeft },
        { status: 429 },
      );
    }
  }

  const service = await createServiceClient();
  const { data: existing } = await service
    .from('profiles')
    .select('id')
    .eq('username', candidate)
    .maybeSingle();

  if (existing && existing.id !== user.id) {
    return NextResponse.json(
      { error: 'Username Is Already Taken.' },
      { status: 409 },
    );
  }

  const nowIso = new Date().toISOString();
  const oldUsername = profile.username;
  const syntheticEmail = `${candidate}@internal.auth`;

  const { error: updErr } = await service
    .from('profiles')
    .update({
      username: candidate,
      username_changed_at: nowIso,
      email: syntheticEmail,
    })
    .eq('id', user.id);

  if (updErr) {
    return NextResponse.json({ error: 'profile_update_failed' }, { status: 500 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminAuth = (service as any).auth?.admin;
    if (adminAuth?.updateUserById) {
      await adminAuth.updateUserById(user.id, { email: syntheticEmail });
    }
  } catch {
    // swallow - audit log captures the change
  }

  await service
    .from('username_changes')
    .insert({
      user_id: user.id,
      old_username: oldUsername ?? null,
      new_username: candidate,
    });

  await supabase
    .rpc('log_account_event', {
      p_user_id: user.id,
      p_event: 'username_changed',
      p_details: { from: oldUsername, to: candidate },
    })
    .then(() => null, () => null);

  return NextResponse.json({
    username: candidate,
    username_changed_at: nowIso,
    cooldown_days: COOLDOWN_DAYS,
  });
}
