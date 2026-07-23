import { redirect } from 'next/navigation';
import { isEffectiveAdmin } from '@/lib/platform-admins';
import { createClient, createAdminClient } from '@/lib/supabase/server';
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
  // ── Step 1: get the authenticated user from their session cookie ──────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // ── Step 2: role lookup via SERVICE CLIENT (bypasses RLS) ─────────────────
  // This is the SAME path used by requireAdmin() in all admin API routes.
  // The user-scoped client can behave differently due to RLS policies; using
  // the service client ensures the gate is consistent with the API layer.
  const service = createAdminClient();
  const { data: profile } = await service
    .from('profiles')
    .select('role, full_name, is_admin_account')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role === 'shipping') {
    redirect('/shipping');
  }

  // Two independent pathways to admin access:
  // 1. isEffectiveAdmin: role='admin' OR user ID in PLATFORM_ADMIN_IDS allowlist
  // 2. is_admin_account=true: DB flag set directly on the profile (e.g. Savage Brands)
  if (!isEffectiveAdmin(user.id, profile?.role) && profile?.is_admin_account !== true) {
    redirect('/dashboard');
  }

  return (
    <AdminLayoutClient adminName={profile?.full_name || 'Admin'}>
      {children}
    </AdminLayoutClient>
  );
}
