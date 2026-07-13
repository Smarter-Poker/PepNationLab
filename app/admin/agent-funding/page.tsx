import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-auth';
import AdminAgentFunding from '@/components/AdminAgentFunding';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Agent Funding & Debt | Admin' };

export default async function AdminAgentFundingPage() {
  const gate = await requireAdmin();
  if (!gate.ok) redirect('/login');

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <AdminAgentFunding />
    </div>
  );
}
