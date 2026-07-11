import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Admin-gated by app/admin/layout.tsx. Management list for Certificates Of
// Analysis: every peptide in the catalogue with its current status and an edit
// link. Nothing here fabricates data; the editor is where real lab readings are
// entered and published.

interface Row {
  id: string;
  name: string;
  slug: string;
  molecular_weight_da: number | null;
  sequence_one_letter: string | null;
  published_count: number;
  draft_count: number;
}

function StatusBadge({ published, draft }: { published: number; draft: number }) {
  const [bg, fg, label] =
    published > 0
      ? ['#0F3D33', '#3DD9A4', 'Published']
      : draft > 0
        ? ['#3D3410', '#E8C15A', 'Draft']
        : ['#1D2D3E', '#A8B4C0', 'Not Started'];
  return (
    <span style={{ background: bg, color: fg, fontSize: '0.72rem', padding: '3px 10px', borderRadius: 6, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

export default async function AdminCoaListPage() {
  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc('coa_admin_catalogue');
  const rows = (data as Row[] | null) ?? [];

  const published = rows.filter((r) => r.published_count > 0).length;

  return (
    <main style={{ padding: '2rem 1.25rem 5rem', maxWidth: 860, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.5rem' }}>
        Certificates Of Analysis
      </h1>
      <p style={{ color: '#A8B4C0', lineHeight: 1.7, marginBottom: '1rem' }}>
        Every Peptide In The Catalogue. Open One To Edit Its Certificate: Enter The Laboratory
        Results, Review The Full Layout, And Publish. A Published Certificate Is Public At Its Lot
        Verification Page And Carries A Scannable QR Code.
      </p>

      {error && (
        <div className="card" style={{ padding: '1.25rem', borderColor: '#E53E3E' }}>
          <p style={{ color: '#E53E3E', margin: 0 }}>The Catalogue Could Not Be Loaded.</p>
        </div>
      )}

      <p style={{ color: '#00C4BC', fontSize: '0.9rem', margin: '0 0 1.5rem' }}>
        {published} Of {rows.length} Published
      </p>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {rows.map((r, i) => (
          <Link
            key={r.id}
            href={`/admin/coa/${r.id}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              padding: '0.85rem 1.25rem',
              borderTop: i === 0 ? 'none' : '1px solid #1D2D3E',
              color: '#FFFFFF',
              textDecoration: 'none',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 500 }}>{r.name}</div>
              <div style={{ fontSize: '0.78rem', color: '#6B7A8A' }}>
                {r.molecular_weight_da ? `${r.molecular_weight_da} Da` : 'Mass Not On File'}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <StatusBadge published={r.published_count} draft={r.draft_count} />
              <span style={{ color: '#00C4BC', fontSize: '0.85rem' }}>Edit</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
