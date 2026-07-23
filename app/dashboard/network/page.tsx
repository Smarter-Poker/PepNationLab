import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import NetworkDashboardClient from './NetworkDashboardClient';
import Navbar from '@/components/Navbar';
import { generateQrDataUrl } from '@/lib/qr';

export const dynamic = 'force-dynamic';

/**
 * Admin-account command center. Dedicated dashboard for is_admin_account
 * accounts (super-agent admins, e.g. Savage Brands) -- separate from the
 * manufacturer dashboard. Manufacturers land on /dashboard/manufacturer;
 * everyone else on /dashboard.
 */
export default async function NetworkDashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login?redirect=/dashboard/network');
  }

  const service = await createServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('id, full_name, username, is_admin_account, is_manufacturer, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.is_active === false) {
    redirect('/dashboard');
  }
  // Manufacturers keep their own dashboard; only admin accounts land here.
  if (profile.is_admin_account !== true) {
    redirect(profile.is_manufacturer === true ? '/dashboard/manufacturer' : '/dashboard');
  }

  // Get Storefront Slug & QR Code
  const { data: agentProfile } = await service.from('agent_profiles').select('slug').eq('id', user.id).maybeSingle();
  let qr = null;
  if (agentProfile?.slug) {
     const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pepnationlab.com';
     try { qr = await generateQrDataUrl(`${APP_URL}/${agentProfile.slug}`); } catch {}
  }

  // Get Agents
  const { data: agentsData } = await service
    .from('profiles')
    .select(`
      id, username, full_name, role, is_super_agent, is_active,
      commission_pct, tier, account_type, created_at,
      agent_profiles ( slug, display_name )
    `)
    .in('role', ['agent', 'super_agent'])
    .order('created_at', { ascending: false });

  const agentIds = (agentsData ?? []).map(a => a.id);
  
  // Get Orders, GMV, and Sparkline
  let orderCount = 0;
  let gmvMap: Record<string, number> = {};
  let sparkline: { date: string; revenue: number }[] = [];
  
  if (agentIds.length > 0) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const { data: orders } = await service
      .from('orders')
      .select('id, agent_id, total, created_at, status')
      .in('agent_id', agentIds);
      
    orderCount = orders?.length ?? 0;
    
    const revenueByDate: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const iso = d.toISOString().split('T')[0];
        revenueByDate[iso] = 0;
    }

    for (const o of orders ?? []) {
      if (o.status === 'cancelled') continue;
      const orderDate = new Date(o.created_at);
      if (orderDate >= thirtyDaysAgo) {
         gmvMap[o.agent_id!] = (gmvMap[o.agent_id!] ?? 0) + Number(o.total || 0);
         const isoDate = orderDate.toISOString().split('T')[0];
         if (revenueByDate[isoDate] !== undefined) {
             revenueByDate[isoDate] += Number(o.total || 0);
         }
      }
    }
    
    for (const [date, revenue] of Object.entries(revenueByDate)) {
        sparkline.push({ date, revenue });
    }
    sparkline.sort((a, b) => a.date.localeCompare(b.date));
  } else {
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        sparkline.push({ date: d.toISOString().split('T')[0], revenue: 0 });
      }
  }

  const agents = (agentsData ?? []).map((a) => ({
    id: a.id,
    username: a.username,
    fullName: a.full_name,
    role: a.role,
    isSuperAgent: a.is_super_agent,
    isActive: a.is_active,
    commissionPct: a.commission_pct,
    tier: a.tier,
    accountType: a.account_type,
    createdAt: a.created_at,
    slug: Array.isArray(a.agent_profiles) ? a.agent_profiles[0]?.slug ?? null : (a.agent_profiles as any)?.slug ?? null,
    displayName: Array.isArray(a.agent_profiles) ? a.agent_profiles[0]?.display_name ?? null : (a.agent_profiles as any)?.display_name ?? null,
    gmv30d: gmvMap[a.id] ?? 0,
  }));

  const name = profile.full_name || profile.username || 'Admin';

  return (
    <div style={{ minHeight: '100dvh', background: '#050A0F' }}>
      <Navbar />
      {/* Spacer for the fixed navbar */}
      <div style={{ height: 'var(--nav-offset, 60px)' }} />
      <NetworkDashboardClient 
        initialName={name} 
        initialAgents={agents} 
        initialOrderCount={orderCount} 
        initialQr={qr} 
        sparkline={sparkline}
      />
    </div>
  );
}
