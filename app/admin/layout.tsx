import { redirect } from 'next/navigation';
import { createClient, getCachedUser } from '@/lib/supabase/server';
import { AdminLayoutClient } from './AdminLayoutClient';

// This layout calls supabase.auth.getUser() (reads cookies) to gate admins, so
// the entire /admin segment must render per-request and must NEVER be statically
// prerendered at build. Without this, a fully-static child page (e.g. /admin/sms,
// a placeholder with no Supabase usage of its own) forces Next to prerender this
// layout at build time, which throws "@supabase/ssr: Your project's URL and API
// key are required to create a Supabase client" whenever the Supabase env vars
// are absent -- exactly the case for Vercel Preview deployments, so every preview
// build failed. Forcing the segment dynamic fixes it without depending on env.
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  // Deduped per-request with the admin page's auth check - getUser() is a
  // network call to Supabase Auth.
  const { user } = await getCachedUser();
  if (!user) redirect('/login');

  // maybeSingle() instead of single() so a fresh auth user without a profiles
  // row does not crash this layout with PGRST116 ("exactly one row expected").
  // If profile is null, the role check below treats it as non-admin and
  // redirects to /dashboard.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role === 'shipping') {
    redirect('/shipping');
  }

  if (profile?.role !== 'admin') {
    redirect('/dashboard');
  }

  return (
    <AdminLayoutClient adminName={profile?.full_name || 'Admin'}>
      {children}
    </AdminLayoutClient>
  );
}
