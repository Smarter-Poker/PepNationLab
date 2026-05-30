import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/researcher/referrals
 *
 * Returns the current researcher's referral code (minting one lazily on first
 * call) along with the list of referrals they have issued and a summary of
 * rewards earned. Researchers only see their own row via RLS; the service
 * client is used for the SECURITY DEFINER RPC and the join-style decoration.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const service = await createServiceClient();

  // Caller must be a researcher to participate in the program.
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile || profile.role !== 'researcher') {
    return NextResponse.json(
      { error: 'Only Researchers Can Participate In The Referral Program.' },
      { status: 403 },
    );
  }

  // Settings (public read) — drives whether the apply UI is shown.
  const { data: settings } = await service
    .from('referral_settings')
    .select('referrer_reward, referee_reward, min_order_total, is_active')
    .eq('id', 1)
    .maybeSingle();

  // Mint / fetch the code via the SECURITY DEFINER RPC.
  const { data: code, error: codeErr } = await service.rpc('get_or_create_referral_code', {
    p_user_id: user.id,
  });
  if (codeErr) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  // Referrals issued by this researcher.
  const { data: issued } = await service
    .from('researcher_referrals')
    .select('id, referee_id, referee_email, code, status, referrer_reward_amount, referee_reward_amount, applied_at, rewarded_at, expires_at, qualifying_order_id, created_at')
    .eq('referrer_id', user.id)
    .order('created_at', { ascending: false });

  // Decorate referee names (masked email) for display.
  const refereeIds = Array.from(new Set((issued ?? []).map((r) => r.referee_id).filter(Boolean))) as string[];
  const refereeMap: Record<string, { name: string }> = {};
  if (refereeIds.length > 0) {
    const { data: refs } = await service
      .from('profiles')
      .select('id, full_name, email')
      .in('id', refereeIds);
    for (const r of refs ?? []) {
      refereeMap[String(r.id)] = { name: r.full_name || maskEmail(r.email) };
    }
  }

  // Has the caller themselves already redeemed someone else's code?
  const { data: redeemed } = await service
    .from('researcher_referrals')
    .select('id, code, status, referrer_id, referee_reward_amount, applied_at')
    .eq('referee_id', user.id)
    .in('status', ['qualifying', 'rewarded'])
    .maybeSingle();

  const summary = (issued ?? []).reduce(
    (acc, r) => {
      acc.total += 1;
      if (r.status === 'qualifying') acc.qualifying += 1;
      if (r.status === 'rewarded') {
        acc.rewarded += 1;
        acc.earned += Number(r.referrer_reward_amount ?? 0);
      }
      return acc;
    },
    { total: 0, qualifying: 0, rewarded: 0, earned: 0 },
  );

  const decorated = (issued ?? []).map((r) => ({
    ...r,
    referee_name: r.referee_id ? refereeMap[String(r.referee_id)]?.name ?? null : null,
  }));

  return NextResponse.json({
    code,
    settings: settings ?? null,
    referrals: decorated,
    summary,
    redeemed: redeemed ?? null,
  });
}

function maskEmail(email: string | null): string {
  if (!email) return 'Researcher';
  const [name, domain] = email.split('@');
  if (!domain) return 'Researcher';
  if (name.length <= 2) return `${name[0] ?? '*'}***@${domain}`;
  return `${name.slice(0, 2)}***@${domain}`;
}
