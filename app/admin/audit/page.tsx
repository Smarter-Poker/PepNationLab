import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import AdminAuditClient from './AdminAuditClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Audit Log | Admin | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; action?: string; cursor?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') redirect('/dashboard');

  const sp = await searchParams;
  const limit = 50;
  const service = await createServiceClient();
  let q = service
    .from('admin_audit_log')
    .select('id, actor_id, actor_email, action, target_type, target_id, summary, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (sp.q) q = q.ilike('summary', `%${sp.q}%`);
  if (sp.action) q = q.eq('action', sp.action);
  if (sp.cursor) q = q.lt('created_at', sp.cursor);

  const { data: rows } = await q;

  const { data: actions } = await service
    .from('admin_audit_log')
    .select('action')
    .order('created_at', { ascending: false })
    .limit(1000);
  const uniqueActions = Array.from(new Set((actions ?? []).map((r) => r.action))).sort();

  return (
    <div style={{ padding: 'var(--space-5)' }}>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Link href="/admin" style={{ color: 'var(--teal)', fontSize: '0.85rem', textDecoration: 'none' }}>
          Back To Dashboard
        </Link>
      </div>
      <h1 style={{ color: 'var(--white)', fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>
        Audit Log
      </h1>
      <p style={{ color: 'var(--silver)', fontSize: '0.92rem', marginBottom: 'var(--space-5)' }}>
        Append-Only Record Of Sensitive Admin Actions: Password Resets, Role Changes, Tier Multiplier Updates, And Balance Adjustments.
      </p>
      <AdminAuditClient
        initialRows={rows ?? []}
        initialFilters={{ q: sp.q ?? '', action: sp.action ?? '' }}
        availableActions={uniqueActions}
        limit={limit}
      />
    </div>
  );
}
