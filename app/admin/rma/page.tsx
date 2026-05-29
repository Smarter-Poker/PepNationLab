import type { Metadata } from 'next';
import AdminRmaClient from './AdminRmaClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Returns | Admin',
  robots: { index: false, follow: false },
};

export default function AdminRmaPage() {
  return (
    <div style={{ padding: 'var(--space-4)' }}>
      <h1 style={{ color: 'var(--white)', fontSize: '1.5rem', fontFamily: 'var(--font-brand)', marginBottom: 'var(--space-4)' }}>
        Returns Oversight
      </h1>
      <AdminRmaClient />
    </div>
  );
}
