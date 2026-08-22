import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

/**
 * /admin/push-health - the reach-out list behind the "Push Health" admin
 * notification. Shows EVERY staff account (admin / super agent / agent) that
 * cannot receive push notifications right now:
 *
 *   - "Never Enabled":     no push subscription on any device, ever
 *   - "Subscription Dead": had one, but no active subscription remains
 *
 * plus how many pushes were skipped for them in the last 7 days, so the
 * admin can prioritize who to call first. The old version only listed
 * accounts that happened to have a skipped push in the last 7 days - a staff
 * member who simply had not been pushed anything yet was invisible.
 */
export default async function PushHealthPage() {
  const gate = await requireAdmin();
  if (!gate.ok) redirect('/admin');

  const svc = await createServiceClient();
  const d7 = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const [{ data: staff }, { data: subs }, { data: skippedRows }] = await Promise.all([
    svc
      .from('profiles')
      .select('id, full_name, role, email, contact_email, phone, last_sign_in_at')
      .in('role', ['admin', 'super_agent', 'agent'])
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('full_name'),
    svc
      .from('push_subscriptions')
      .select('user_id, is_active'),
    svc
      .from('push_outbox')
      .select('recipient_user_id')
      .eq('status', 'skipped')
      .eq('failure_reason', 'no_subscription')
      .gte('created_at', d7)
      .limit(2000),
  ]);

  const activeSubUsers = new Set<string>();
  const everSubUsers = new Set<string>();
  for (const s of subs ?? []) {
    if (!s.user_id) continue;
    everSubUsers.add(s.user_id);
    if (s.is_active) activeSubUsers.add(s.user_id);
  }

  const skipCount = new Map<string, number>();
  for (const r of skippedRows ?? []) {
    if (!r.recipient_user_id) continue;
    skipCount.set(r.recipient_user_id, (skipCount.get(r.recipient_user_id) ?? 0) + 1);
  }

  const unreachable = (staff ?? [])
    .filter((a) => !activeSubUsers.has(a.id))
    .map((a) => ({
      ...a,
      email: a.contact_email || a.email,
      neverEnabled: !everSubUsers.has(a.id),
      skipped7d: skipCount.get(a.id) ?? 0,
    }))
    // Most urgent first: most missed pushes, then never-enabled.
    .sort((a, b) => b.skipped7d - a.skipped7d || Number(b.neverEnabled) - Number(a.neverEnabled));

  const reachableCount = (staff ?? []).length - unreachable.length;

  return (
    <div style={{ padding: '24px', maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.8rem', fontFamily: 'var(--font-brand)', marginBottom: '8px' }}>Push Health Reachout</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
        Every active staff account (admins, super agents, agents) with no working push device. They miss order alerts, payment confirmations, and reminders until they open Pep Nation Lab and enable notifications. Reach out below.
      </p>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '28px' }}>
        {reachableCount} Staff Account{reachableCount !== 1 ? 's' : ''} Reachable By Push. {unreachable.length} Not Reachable.
      </p>

      {unreachable.length === 0 ? (
        <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: '#2DD4BF' }}>
          All active staff accounts are properly subscribed to push notifications!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {unreachable.map((account) => (
            <div key={account.id} className="glass-panel" style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 220 }}>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '4px' }}>{account.full_name || 'Unnamed Agent'}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {String(account.role).replace('_', ' ')}
                </div>
                <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                    background: account.neverEnabled ? 'rgba(252,129,129,0.12)' : 'rgba(235,178,54,0.12)',
                    color: account.neverEnabled ? '#FC8181' : '#EBB236',
                    border: `1px solid ${account.neverEnabled ? 'rgba(252,129,129,0.35)' : 'rgba(235,178,54,0.35)'}`,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    {account.neverEnabled ? 'Never Enabled' : 'Subscription Dead'}
                  </span>
                  {account.skipped7d > 0 && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: 'rgba(0,196,188,0.1)', color: '#2DD4BF', border: '1px solid rgba(0,196,188,0.3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {account.skipped7d} Missed Push{account.skipped7d !== 1 ? 'es' : ''} (7d)
                    </span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {account.email && <a href={`mailto:${account.email}`} style={{ color: '#00E5FF', textDecoration: 'none' }}>{account.email}</a>}
                {account.phone && <a href={`tel:${account.phone}`} style={{ color: '#00E5FF', textDecoration: 'none' }}>{account.phone}</a>}
                <Link href={`/messenger?compose=1&participant=${account.id}`} style={{ color: '#00E5FF', textDecoration: 'none', fontSize: '0.82rem' }}>
                  Message In App
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
