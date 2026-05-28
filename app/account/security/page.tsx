import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AccountSecurityClient from './AccountSecurityClient';

// /account/security
// Self-service MFA enrollment page. Every authenticated user can reach it,
// but it is REQUIRED for admin + super_agent roles (enforced by middleware).
//
// This is a Next.js App Router page (auto-loaded by filesystem routing).
// The matching client component renders the MFA enrollment workflow:
//   - listFactors() via the browser supabase client
//   - enroll({ factorType: 'totp' }) to start enrollment
//   - challengeAndVerify({ factorId, code }) to confirm the 6-digit TOTP code
//   - unenroll({ factorId }) to remove a verified factor
export default async function AccountSecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle();

  const params = await searchParams;
  const reason = params?.reason ?? null;

  return (
    <AccountSecurityClient
      userEmail={user.email ?? ''}
      role={profile?.role ?? 'researcher'}
      fullName={profile?.full_name ?? null}
      reason={reason}
    />
  );
}
