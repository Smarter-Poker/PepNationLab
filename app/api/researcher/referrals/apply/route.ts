/**
 * POST { code } -- apply a researcher referral code to the signed-in user.
 *
 * The apply_referral_code RPC (SECURITY DEFINER, service-role only since the
 * 2026-07-11 lockdown) validates the code, blocks self-referral and reuse, and
 * applies any live promotion's reward amounts. This route is the session-side
 * wrapper: it pins p_referee_id to the caller so one user can never attach a
 * referral to someone else's account.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

const KNOWN_ERRORS: Record<string, string> = {
  'Invalid Code': 'Please Enter A Referral Code.',
  'Referral Code Not Found': 'That Referral Code Was Not Found.',
  'You Have Already Used A Referral Code': 'You Have Already Used A Referral Code.',
  'Referral Program Is Currently Paused': 'The Referral Program Is Currently Paused.',
};

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await getEffectiveUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { code?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const code = String(body.code ?? '').trim();
  if (!code || code.length > 20 || !/^[A-Za-z0-9_-]+$/.test(code)) {
    return NextResponse.json({ error: 'Please Enter A Valid Referral Code.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: referralId, error } = await admin.rpc('apply_referral_code', {
    p_referee_id: user.id,
    p_code: code,
  });

  if (error) {
    const friendly = KNOWN_ERRORS[error.message] ?? 'Could Not Apply That Referral Code.';
    return NextResponse.json({ error: friendly }, { status: 400 });
  }

  // Best-effort: stamp the referee's contact email onto the referral row so
  // the referrer's history shows who signed up (falls back to 'Pending Signup').
  if (referralId) {
    const { data: prof } = await admin
      .from('profiles')
      .select('contact_email, email')
      .eq('id', user.id)
      .maybeSingle();
    const refereeEmail = (prof?.contact_email || prof?.email || null) as string | null;
    if (refereeEmail) {
      await admin
        .from('researcher_referrals')
        .update({ referee_email: refereeEmail })
        .eq('id', referralId as string);
    }
  }

  return NextResponse.json({ ok: true, referralId });
}
