import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Navbar from '@/components/Navbar';
import LabToolsCalculators from '@/components/LabToolsCalculators';

export const metadata = {
  title: 'Lab Tools Calculator | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default async function LabToolsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--black)', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <div style={{ height: 60 }} />

      <main className="container" style={{ flex: 1, padding: 'var(--space-6) var(--space-4)', maxWidth: 760 }}>
        <h1 className="animated-gradient-text" style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 'var(--space-2)', color: 'var(--white)', fontFamily: 'var(--font-brand)' }}>
          Lab Tools
        </h1>
        <p style={{ color: 'var(--silver)', fontSize: '0.92rem', marginBottom: 'var(--space-6)' }}>
          Calculators for reconstitution and draw volume math.
        </p>
        
        <LabToolsCalculators />
      </main>
    </div>
  );
}
