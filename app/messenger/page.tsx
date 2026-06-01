import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import MessengerShell from '@/components/messenger/MessengerShell';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Messenger | Pep Nation Lab',
  description: 'Direct Messaging Across Pep Nation Lab.',
  robots: { index: false, follow: false },
};

export default async function MessengerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/messenger');

  const svc = await createServiceClient();
  const { data: prof } = await svc
    .from('profiles')
    .select('is_active')
    .eq('id', user.id)
    .maybeSingle();
  if (prof && prof.is_active === false) redirect('/login?redirect=/messenger');

  // fix-46.2: Suspense boundary required for MessengerShell's useSearchParams()
  // (Next.js App Router rule; matches the codebase pattern in admin/orders,
  // admin/researchers, etc.). The fallback is empty because the shell renders
  // its own loading state via the conversation list.
  return (
    <Suspense fallback={null}>
      <MessengerShell userId={user.id} />
    </Suspense>
  );
}
