import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import AddressesClient from './AddressesClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Saved Addresses | Pep Nation Lab',
  robots: { index: false, follow: true },
};

export default async function AddressesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/account/addresses');

  const { data: addresses } = await supabase
    .from('saved_addresses')
    .select('id, label, full_name, street1, street2, city, state, zip, country, is_default, is_default_from, is_ship_to, is_ship_from, created_at, updated_at')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false });

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--black)', padding: 'var(--space-6) var(--space-4)' }}>
      <div className="container" style={{ maxWidth: 960 }}>
        <h1 className="animated-gradient-text" style={{ color: 'var(--white)', fontSize: '1.6rem', fontFamily: 'var(--font-brand)', marginBottom: 'var(--space-2)' }}>
          Saved Addresses
        </h1>
        <p style={{ color: 'var(--silver)', fontSize: '0.92rem', marginBottom: 'var(--space-5)' }}>
          Manage Your Ship-To Addresses (Where Orders Get Delivered) And Your Ship-From Addresses (Return Address On Outbound Labels When You Send Packages). Tap Save As Both To Reuse The Same Address For Either.
        </p>
        <AddressesClient initialAddresses={addresses ?? []} />
      </div>
    </div>
  );
}
