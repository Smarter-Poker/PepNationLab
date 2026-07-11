import { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin-auth';
import FlashSaleBuilder from '@/components/admin/FlashSaleBuilder';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Flash Sales | Admin',
};

export default async function FlashSalesAdminPage() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    redirect('/admin/login');
  }

  return (
    <div style={{ padding: 'var(--space-6)', minHeight: '100vh', background: '#000' }}>
      <FlashSaleBuilder />
    </div>
  );
}
