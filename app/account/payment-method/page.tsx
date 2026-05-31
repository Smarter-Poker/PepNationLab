import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PaymentMethodClient from './PaymentMethodClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Default Payment Method | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default async function PaymentMethodPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/account/payment-method');

  const { data: profile } = await supabase
    .from('profiles')
    .select('default_payment_method')
    .eq('id', user.id)
    .maybeSingle();

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--black)', padding: 'var(--space-6) var(--space-4)' }}>
      <div className="container" style={{ maxWidth: 720 }}>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Link href="/account" style={{ fontSize: '0.85rem', color: 'var(--teal)', textDecoration: 'none' }}>
            Back To Your Account
          </Link>
        </div>
        <h1 className="animated-gradient-text" style={{ color: 'var(--white)', fontSize: '1.6rem', fontFamily: 'var(--font-brand)', marginBottom: 'var(--space-2)' }}>
          Default Payment Method
        </h1>
        <p style={{ color: 'var(--silver)', fontSize: '0.92rem', marginBottom: 'var(--space-5)' }}>
          Pre-Select The Payment Method To Use At Checkout. You Can Still Change It On Any Single Order. We Do Not Store Card Numbers — Payment Is Settled Via Zelle, Venmo, Cash App, Or Apple Pay With Your Agent.
        </p>
        <PaymentMethodClient initial={profile?.default_payment_method ?? null} />
      </div>
    </div>
  );
}
