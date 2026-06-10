import AdminAvailabilityClient from './AdminAvailabilityClient';
import { requireAdmin } from '@/lib/admin-auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminAvailabilityPage() {
  const gate = await requireAdmin();
  if (!gate.ok) redirect('/login');
  return <AdminAvailabilityClient />;
}
