import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  Bell, ShieldCheck, Heart, History, MapPin, Gift, Wallet, ChevronRight,
  User, RotateCcw, FileCheck, LifeBuoy,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface NavRowProps {
  href: string;
  label: string;
  description: string;
  Icon: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
  index: number;
}

function NavRow({ href, label, description, Icon, index }: NavRowProps) {
  return (
    <Link
      href={href}
      className="card-metal hover-lift stagger-fade-in"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-4) var(--space-5)',
        textDecoration: 'none',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 'var(--radius-lg)',
        transition: 'transform 0.15s ease, border-color 0.15s ease',
        animationDelay: `${0.06 + index * 0.06}s`,
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: 56,
          height: 56,
          borderRadius: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--teal)',
          background: 'linear-gradient(145deg, #20303f 0%, #0f1923 58%, #0a1118 100%)',
          border: '1px solid rgba(192,184,168,0.20)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -3px 6px rgba(0,0,0,0.55), 0 3px 8px rgba(0,0,0,0.45)',
        }}
      >
        <Icon size={26} aria-hidden />
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', color: 'var(--white)', fontWeight: 700, fontSize: '1.05rem' }}>
          {label}
        </span>
        <span style={{ display: 'block', color: 'var(--silver)', fontSize: '0.85rem', lineHeight: 1.5 }}>
          {description}
        </span>
      </span>

      <ChevronRight size={20} aria-hidden style={{ color: 'var(--silver)', opacity: 0.55, flexShrink: 0 }} />
    </Link>
  );
}

export default async function AccountHubPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const isResearcher = profile?.role === 'researcher';

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--black)', padding: 'var(--space-6) var(--space-4)' }}>
      <div className="container" style={{ maxWidth: 760 }}>
        <h1 className="animated-gradient-text" style={{ color: 'var(--white)', fontSize: '1.6rem', fontFamily: 'var(--font-brand)', marginBottom: 'var(--space-2)' }}>
          Your Account Settings
        </h1>
        <p style={{ color: 'var(--silver)', fontSize: '0.92rem', marginBottom: 'var(--space-6)' }}>
          Manage Your Preferences, Saved Items, And Credits.
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
          }}
        >
          <NavRow index={0} href="/account/profile" label="Profile" description="Your Name, Avatar, Username, And Contact Details." Icon={User} />
          <NavRow index={1} href="/account/wishlist" label="Wishlist" description="Products You Saved For Later." Icon={Heart} />
          <NavRow index={2} href="/account/recently-viewed" label="Recently Viewed" description="The Last 50 Products You Browsed." Icon={History} />
          <NavRow index={3} href="/account/refills" label="Refills & Reorders" description="Reorder A Past Protocol In One Tap." Icon={RotateCcw} />
          {isResearcher && (
            <NavRow index={4} href="/account/referrals" label="Referrals" description="Share Your Code And Earn Store Credit." Icon={Gift} />
          )}
          <NavRow index={5} href="/account/notifications" label="Notifications" description="Choose Which Alerts You Receive. The Bell In The Header Shows Your Live Feed." Icon={Bell} />
          <NavRow index={6} href="/account/security" label="Security" description="Password, Two-Factor, Active Sessions, And Sign-In Activity." Icon={ShieldCheck} />
          <NavRow index={7} href="/account/addresses" label="Saved Addresses" description="Ship-To And Ship-From Addresses Used At Checkout And On Outbound Labels." Icon={MapPin} />
          <NavRow index={8} href="/account/payment-method" label="Payment Methods" description="Default Method Plus Your Handle Or Contact For Each One You Use." Icon={Wallet} />
          <NavRow index={9} href="/account/compliance" label="Compliance & Disclaimers" description="Review And Re-Acknowledge The Research-Only Disclaimer." Icon={FileCheck} />
          <NavRow index={10} href="/account/help" label="Help & Support" description="Browse FAQs Or Send Our Team A Message." Icon={LifeBuoy} />
        </div>
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Your Account Settings | Pep Nation Lab',
  robots: { index: false, follow: false },
};
