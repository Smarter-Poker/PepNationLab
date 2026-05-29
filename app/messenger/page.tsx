import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
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

  return <MessengerShell userId={user.id} />;
}
