/**
 * Admin: intranasal route classification editor. Admin-only via middleware +
 * an explicit requireAdmin gate. Lists every compound with its current nasal
 * tier so the team can reclassify without a database migration.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import AdminIntranasalEditor, { type IntranasalRow } from '@/components/admin/AdminIntranasalEditor';

export const metadata: Metadata = {
  title: 'Intranasal Route | Admin | Pep Nation Lab',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

export default async function AdminIntranasalPage() {
  const gate = await requireAdmin();
  if (!gate.ok) redirect('/login');

  const supabase = await createServiceClient();
  const { data } = await supabase
    .from('compounds')
    .select('slug, display_name, category, evidence_tier, intranasal_status, intranasal_bioavailability_pct, intranasal_note')
    .order('display_name', { ascending: true });

  const rows = (data ?? []) as IntranasalRow[];

  const established = rows.filter((r) => r.intranasal_status === 'established').length;
  const emerging = rows.filter((r) => r.intranasal_status === 'emerging').length;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      <nav style={{ marginBottom: 16 }}>
        <Link href="/admin" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={16} /> Back To Admin
        </Link>
      </nav>
      <header style={{ marginBottom: 24 }}>
        <h1 className="animated-gradient-text" style={{ fontSize: '1.8rem', margin: 0 }}>Intranasal Route Classification</h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1rem', marginTop: 8, maxWidth: 780, lineHeight: 1.6 }}>
          Set each compound&apos;s nasal-route tier. Established and Emerging surface the nasal badges across the store and
          research library; Injection Only hides them. Changes save immediately and refresh the public pages. Currently
          {' '}{established} established and {emerging} emerging.
        </p>
      </header>
      <AdminIntranasalEditor rows={rows} />
    </div>
  );
}
