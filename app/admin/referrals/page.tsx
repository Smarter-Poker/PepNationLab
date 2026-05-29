import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import AdminReferralsClient from './AdminReferralsClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Referrals | Admin | Pep Nation Lab',
  robots: { index: false, follow: false },
};

interface RefRow {
  id: string;
  referrer_id: string;
  referee_id: string | null;
  referee_email: string | null;
  code: string;
  status: string;
  referrer_reward_amount: number | null;
  referee_reward_amount: number | null;
  qualifying_order_id: string | null;
  applied_at: string | null;
  rewarded_at: string | null;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
}

const STATUSES = ['pending', 'applied', 'qualifying', 'rewarded', 'expired', 'revoked'];

export default async function AdminReferralsPage(
  { searchParams }: { searchParams: Promise<{ status?: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/admin/referrals');

  const service = await createServiceClient();
  const { data: me } = await service.from('profiles').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') redirect('/dashboard');

  const params = await searchParams;
  const statusFilter = params.status && STATUSES.includes(params.status) ? params.status : null;

  let query = service
    .from('researcher_referrals')
    .select('id, referrer_id, referee_id, referee_email, code, status, referrer_reward_amount, referee_reward_amount, qualifying_order_id, applied_at, rewarded_at, expires_at, notes, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (statusFilter) query = query.eq('status', statusFilter);
  const { data: rowsRaw } = await query;
  const rows = (rowsRaw ?? []) as RefRow[];

  const ids = new Set<string>();
  for (const r of rows) {
    if (r.referrer_id) ids.add(r.referrer_id);
    if (r.referee_id) ids.add(r.referee_id);
  }
  const profileMap: Record<string, { full_name: string | null; email: string | null }> = {};
  if (ids.size > 0) {
    const { data: profs } = await service.from('profiles').select('id, full_name, email').in('id', Array.from(ids));
    for (const p of profs ?? []) {
      profileMap[String(p.id)] = { full_name: p.full_name ?? null, email: p.email ?? null };
    }
  }

  const decorated = rows.map((r) => ({
    ...r,
    referrer_label:
      profileMap[String(r.referrer_id)]?.full_name ||
      profileMap[String(r.referrer_id)]?.email ||
      String(r.referrer_id).slice(0, 8),
    referee_label: r.referee_id
      ? profileMap[String(r.referee_id)]?.full_name ||
        profileMap[String(r.referee_id)]?.email ||
        String(r.referee_id).slice(0, 8)
      : r.referee_email || 'Anonymous',
  }));

  const { data: stats } = await service
    .from('researcher_referrals')
    .select('status, referrer_reward_amount, referee_reward_amount');

  const summary = {
    total: 0,
    qualifying: 0,
    rewarded: 0,
    expired: 0,
    revoked: 0,
    total_rewarded_amount: 0,
  };
  for (const s of stats ?? []) {
    summary.total += 1;
    if (s.status === 'qualifying') summary.qualifying += 1;
    if (s.status === 'rewarded') {
      summary.rewarded += 1;
      summary.total_rewarded_amount +=
        Number(s.referrer_reward_amount ?? 0) + Number(s.referee_reward_amount ?? 0);
    }
    if (s.status === 'expired') summary.expired += 1;
    if (s.status === 'revoked') summary.revoked += 1;
  }

  const { data: settings } = await service
    .from('referral_settings')
    .select('referrer_reward, referee_reward, min_order_total, is_active')
    .eq('id', 1)
    .maybeSingle();

  return (
    <AdminReferralsClient
      rows={decorated}
      summary={summary}
      settings={settings ?? null}
      currentStatus={statusFilter}
    />
  );
}
