import { requireAdmin } from '@/lib/admin-auth';
import { redirect } from 'next/navigation';
import CronHealthClient from './CronHealthClient';

export const dynamic = 'force-dynamic';

export default async function CronHealthPage() {
  const gate = await requireAdmin();
  if (!gate.ok) redirect('/admin');

  return <CronHealthClient />;
}
