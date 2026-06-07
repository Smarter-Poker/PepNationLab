import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  Bell, ShieldCheck, Heart, History, MapPin, Gift, Wallet, ChevronRight,
  User, RotateCcw, FileCheck, LifeBuoy, FlaskConical, Clock,
  Store, CreditCard, Building,
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
      className="glass-panel hover-lift stagger-fade-in"
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

  // Built as a filtered array so the stagger animation index stays contiguous
  // (no timing gap) regardless of which role-gated rows are present.
  const rows: Array<{ href: string; label: string; description: string; Icon: NavRowProps['Icon'] }> = [
    { href: '/account/profile', label: 'Profile', description: 'Your Name, Avatar, Username, And Contact Details.', Icon: User },
    ...(isResearcher
      ? [{ href: '/account/referrals', label: 'Referrals', description: 'Share Your Code And Earn Store Credit.', Icon: Gift }]
      : []),
    ...(!isResearcher
      ? [
          { href: '/dashboard/agent?tab=Storefront+Config', label: 'Storefront Setup & Editing', description: 'Configure Your Public-Facing White-Label Storefront.', Icon: Store },
        ]
      : []),
    { href: '/account/notifications', label: 'Notifications', description: 'Choose Which Alerts You Receive. The Bell In The Header Shows Your Live Feed.', Icon: Bell },
    { href: '/account/security', label: 'Security', description: 'Password, Two-Factor, Active Sessions, And Sign-In Activity.', Icon: ShieldCheck },
    { href: '/account/addresses', label: 'Saved Addresses', description: 'Ship-To And Ship-From Addresses Used At Checkout And On Outbound Labels.', Icon: MapPin },
    { href: '/account/payment-method', label: 'Payment Methods', description: 'Default Method Plus Your Handle Or Contact For Each One You Use.', Icon: Wallet },
    { href: '/account/compliance', label: 'Compliance & Disclaimers', description: 'Review And Re-Acknowledge The Research-Only Disclaimer.', Icon: FileCheck },
    { href: '/account/help', label: 'Help & Support', description: 'Browse FAQs Or Send Our Team A Message.', Icon: LifeBuoy },
  ];

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
          {rows.map((r, i) => (
            <NavRow key={r.href} index={i} href={r.href} label={r.label} description={r.description} Icon={r.Icon} />
          ))}
        </div>
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Your Account Settings | Pep Nation Lab',
  robots: { index: false, follow: false },
};
