import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ShelfLifeTracker from '@/components/research/ShelfLifeTracker';

export const metadata: Metadata = {
  title: 'Reconstitution & Shelf Life',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface PickerCompound {
  slug: string;
  display_name: string;
  reconstitution_shelf_days: number | null;
}

export default async function ShelfLifePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase
    .from('compounds')
    .select('slug, display_name, reconstitution_shelf_days')
    .order('display_name', { ascending: true });

  const compounds: PickerCompound[] = (data ?? []).map((row) => ({
    slug: row.slug as string,
    display_name: row.display_name as string,
    reconstitution_shelf_days:
      typeof row.reconstitution_shelf_days === 'number' ? row.reconstitution_shelf_days : null,
  }));

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
      <header style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ margin: 0, color: '#FFFFFF', fontSize: '2rem', fontWeight: 800 }}>
          Reconstitution &amp; Shelf Life
        </h1>
        <p style={{ margin: 'var(--space-3) 0 0', color: '#A8B4C0', maxWidth: 640, lineHeight: 1.55 }}>
          Track When Each Vial Was Reconstituted And See How Many Days Of Shelf Life Remain. For
          Research Use Only. This Is A Lab-Prep Reference, Not Dosing Or Medical Advice.
        </p>
      </header>

      <ShelfLifeTracker compounds={compounds} />
    </div>
  );
}
