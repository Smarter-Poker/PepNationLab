import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Navbar from '@/components/Navbar';
import SignupPromoManager from '@/components/SignupPromoManager';
import BackButton from '@/components/ui/BackButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Signup Promo Codes', robots: { index: false, follow: false } };

export default async function SuperAgentPromosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/dashboard/agent/promos');
  const { data: profile } = await supabase
    .from('profiles').select('role, is_super_agent').eq('id', user.id).maybeSingle();
  const isSuper = !!profile && (profile.role === 'super_agent' || profile.is_super_agent === true || profile.role === 'admin');
  if (!isSuper) redirect('/dashboard/agent');

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--black)' }}>
      <Navbar title="Signup Promos" />
      <div className="container" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-12)', maxWidth: 960 }}>
        <div style={{ marginBottom: "var(--space-4)" }}><BackButton label="Back" /></div>
        <SignupPromoManager endpoint="/api/agent/signup-promos" heading="Signup Promo Codes" />
      </div>
    </div>
  );
}
