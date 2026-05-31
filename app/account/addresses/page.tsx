import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import AddressesClient from './AddressesClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Saved Addresses | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default async function AddressesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/account/addresses');

  const { data: addresses } = await supabase
    .from('saved_addresses')
    .select('id, label, full_name, street1, street2, city, state, zip, country, is_default, created_at, updated_at')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--black)', padding: 'var(--space-6) var(--space-4)' }}>
      <div className="container" style={{ maxWidth: 960 }}>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Link href="/account" style={{ fontSize: '0.85rem', color: 'var(--teal)', textDecoration: 'none' }}>
            Back To Your Account
          </Link>
        </div>
        <h1 className="animated-gradient-text" style={{ color: 'var(--white)', fontSize: '1.6rem', fontFamily: 'var(--font-brand)', marginBottom: 'var(--space-2)' }}>
          Saved Addresses
        </h1>
        <p style={{ color: 'var(--silver)', fontSize: '0.92rem', marginBottom: 'var(--space-5)' }}>
          Manage The Shipping Addresses You Use At Checkout. Your Default Address Is Pre-Selected For New Orders.
        </p>
        <AddressesClient initialAddresses={addresses ?? []} />
      </div>
    </div>
  );
}
