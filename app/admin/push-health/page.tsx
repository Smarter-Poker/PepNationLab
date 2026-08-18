import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function PushHealthPage() {
  const gate = await requireAdmin();
  if (!gate.ok) redirect('/admin');

  const svc = await createServiceClient();
  const d7 = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const { data: skippedRows } = await svc
    .from('push_outbox')
    .select('recipient_user_id')
    .eq('status', 'skipped')
    .eq('failure_reason', 'no_subscription')
    .gte('created_at', d7)
    .limit(1000);

  const skippedUserIds = [...new Set((skippedRows ?? [])
    .map((r: { recipient_user_id: string | null }) => r.recipient_user_id)
    .filter((v: string | null): v is string => !!v))];

  let staffAccounts: any[] = [];
  if (skippedUserIds.length > 0) {
    const { data: staff } = await svc
      .from('profiles')
      .select('id, full_name, role, email, phone')
      .in('id', skippedUserIds)
      .in('role', ['admin', 'super_agent', 'agent'])
      .order('full_name');
    staffAccounts = staff ?? [];
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.8rem', fontFamily: 'var(--font-brand)', marginBottom: '8px' }}>Push Health Reachout</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
        These staff accounts (agents, super agents, admins) have had web push notifications skipped in the last 7 days because they do not have a push subscription enabled on any device.
      </p>

      {staffAccounts.length === 0 ? (
        <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: '#2DD4BF' }}>
          All active staff accounts are properly subscribed to push notifications!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {staffAccounts.map(account => (
            <div key={account.id} className="glass-panel" style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '4px' }}>{account.full_name || 'Unnamed Agent'}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {account.role.replace('_', ' ')}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.9rem' }}>
                {account.email && <div><a href={`mailto:${account.email}`} style={{ color: '#00E5FF', textDecoration: 'none' }}>{account.email}</a></div>}
                {account.phone && <div><a href={`tel:${account.phone}`} style={{ color: '#00E5FF', textDecoration: 'none' }}>{account.phone}</a></div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
