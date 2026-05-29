import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import ReferralsClient from './ReferralsClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Referrals | Pep Nation Lab',
  robots: { index: false, follow: false },
};

interface Referral {
  id: string;
  referee_id: string | null;
  referee_email: string | null;
  code: string;
  status: string;
  referrer_reward_amount: number | null;
  referee_reward_amount: number | null;
  applied_at: string | null;
  rewarded_at: string | null;
  expires_at: string | null;
  qualifying_order_id: string | null;
  created_at: string;
  referee_name: string | null;
}

export default async function ReferralsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/account/referrals');

  const service = await createServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'researcher') {
    redirect('/dashboard');
  }

  const { data: settings } = await service
    .from('referral_settings')
    .select('referrer_reward, referee_reward, min_order_total, is_active')
    .eq('id', 1)
    .maybeSingle();

  // Mint the code.
  const { data: code } = await service.rpc('get_or_create_referral_code', {
    p_user_id: user.id,
  });

  // Issued referrals + referee profile decoration.
  const { data: issuedRaw } = await service
    .from('researcher_referrals')
    .select('id, referee_id, referee_email, code, status, referrer_reward_amount, referee_reward_amount, applied_at, rewarded_at, expires_at, qualifying_order_id, created_at')
    .eq('referrer_id', user.id)
    .order('created_at', { ascending: false });

  const refereeIds = Array.from(new Set((issuedRaw ?? []).map((r) => r.referee_id).filter(Boolean))) as string[];
  const refereeMap: Record<string, string> = {};
  if (refereeIds.length > 0) {
    const { data: refs } = await service
      .from('profiles')
      .select('id, full_name, email')
      .in('id', refereeIds);
    for (const r of refs ?? []) {
      refereeMap[String(r.id)] = r.full_name || maskEmail(r.email);
    }
  }
  const issued: Referral[] = (issuedRaw ?? []).map((r) => ({
    ...r,
    referee_name: r.referee_id ? refereeMap[String(r.referee_id)] ?? null : null,
  }));

  // Did the caller themselves redeem someone else's code?
  const { data: redeemed } = await service
    .from('researcher_referrals')
    .select('id, code, status, referee_reward_amount, applied_at')
    .eq('referee_id', user.id)
    .in('status', ['qualifying', 'rewarded'])
    .maybeSingle();

  const summary = issued.reduce(
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

  return (
    <ReferralsClient
      code={String(code ?? '')}
      settings={settings ?? null}
      referrals={issued}
      redeemed={redeemed ?? null}
      summary={summary}
    />
  );
}

function maskEmail(email: string | null): string {
  if (!email) return 'Researcher';
  const [name, domain] = email.split('@');
  if (!domain) return 'Researcher';
  if (name.length <= 2) return `${name[0] ?? '*'}***@${domain}`;
  return `${name.slice(0, 2)}***@${domain}`;
}
