import { redirect } from 'next/navigation';
import { getCachedUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Dashboard auth guard.
 *
 * Wraps every /dashboard/* route and only requires a signed-in user. The
 * guided setup wizard at /onboarding is now OPTIONAL -- it no longer gates
 * dashboard access, so agent-type accounts (super agent / agent / sub-agent)
 * land on their dashboard immediately and can visit /onboarding later if they
 * choose. Researchers, admins, and shipping are unaffected.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // auth.getUser() is a network call to Supabase Auth; deduped per-request
  // with the page below, which also needs the user.
  const { user } = await getCachedUser();

  if (!user) {
    redirect('/login');
  }

  return <>{children}</>;
}
