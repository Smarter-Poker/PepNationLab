import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Bell, ShieldCheck, CreditCard, Heart, History, MapPin, Package, RotateCcw, Gift, FileCheck, Wallet } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface NavCardProps {
  href: string;
  label: string;
  description: string;
  Icon: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
  index: number;
}

function NavCard({ href, label, description, Icon, index }: NavCardProps) {
  return (
    <Link
      href={href}
      className="card-metal hover-lift stagger-fade-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        padding: 'var(--space-5)',
        textDecoration: 'none',
        transition: 'transform 0.15s ease, border-color 0.15s ease',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 'var(--radius-lg)',
        animationDelay: `${0.1 + index * 0.1}s`,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: 'rgba(192,184,168,0.12)',
          color: 'var(--teal)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 'var(--space-1)',
        }}
      >
        <Icon size={18} aria-hidden />
      </div>
      <div style={{ color: 'var(--white)', fontWeight: 700, fontSize: '1rem' }}>{label}</div>
      <div style={{ color: 'var(--silver)', fontSize: '0.85rem', lineHeight: 1.5 }}>{description}</div>
    </Link>
  );
}

export default async function AccountHubPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--black)', padding: 'var(--space-6) var(--space-4)' }}>
      <div className="container" style={{ maxWidth: 1080 }}>
        <h1 className="animated-gradient-text" style={{ color: 'var(--white)', fontSize: '1.6rem', fontFamily: 'var(--font-brand)', marginBottom: 'var(--space-2)' }}>
          Your Account
        </h1>
        <p style={{ color: 'var(--silver)', fontSize: '0.92rem', marginBottom: 'var(--space-6)' }}>
          Manage Your Preferences, Saved Items, And Credits.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          <NavCard index={0} href="/account/wishlist" label="Wishlist" description="Products You Saved For Later." Icon={Heart} />
          <NavCard index={1} href="/account/recently-viewed" label="Recently Viewed" description="The Last 50 Products You Browsed." Icon={History} />
          <NavCard index={2} href="/orders" label="Orders" description="Track Past And Pending Orders." Icon={Package} />
          <NavCard index={3} href="/account/referrals" label="Referrals" description="Share Your Code And Earn Store Credit." Icon={Gift} />
          <NavCard index={4} href="/account/notifications" label="Notifications" description="Push And In-App Notification Preferences." Icon={Bell} />
          <NavCard index={5} href="/account/security" label="Security" description="Password, 2FA, And Login Sessions." Icon={ShieldCheck} />
          <NavCard index={6} href="/account/addresses" label="Saved Addresses" description="Manage Shipping Addresses Used At Checkout." Icon={MapPin} />
          <NavCard index={7} href="/account/payment-method" label="Default Payment Method" description="Pre-Select Zelle, Venmo, Cash App, Or Apple Pay." Icon={Wallet} />
        </div>
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Your Account | Pep Nation Lab',
  robots: { index: false, follow: false },
};
