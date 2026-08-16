import { redirect } from 'next/navigation';
import { createClient, createServiceClient, createAdminClient } from '@/lib/supabase/server';
import NetworkDashboardClient from './NetworkDashboardClient';
import Navbar from '@/components/Navbar';
import { generateQrDataUrl } from '@/lib/qr';
import { buildDownlineTree, collectAgentIds } from '@/lib/downline';

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

  // Get Full Downline Tree
  const admin = createAdminClient();
  const tree = await buildDownlineTree(admin, user.id);
  const agentIds = tree ? collectAgentIds(tree) : [];
  
  // Flatten tree for the client component
  const agentsMap = new Map<string, any>();
  if (tree) {
    const walk = (node: any) => {
      if (node.id !== user.id) {
        agentsMap.set(node.id, {
          id: node.id,
          username: node.username,
          fullName: node.full_name,
          role: node.role,
          isSuperAgent: node.is_super_agent,
          isActive: node.is_active,
          slug: node.slug,
          displayName: node.display_name,
        });
      }
      node.children.forEach(walk);
    };
    walk(tree);
  }
  
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

  // We need additional profile details not included in the standard DownlineTree model
  const { data: profilesData } = await service
    .from('profiles')
    .select('id, commission_pct, tier, account_type, created_at')
    .in('id', agentIds);
  
  const profilesMap = new Map((profilesData ?? []).map(p => [p.id, p]));

  const agents = Array.from(agentsMap.values()).map((a) => {
    const p = (profilesMap.get(a.id) || {}) as any;
    return {
      id: a.id,
      username: a.username,
      fullName: a.fullName,
      role: a.role,
      isSuperAgent: a.isSuperAgent,
      isActive: a.isActive,
      commissionPct: p.commission_pct ?? null,
      tier: p.tier ?? null,
      accountType: p.account_type ?? null,
      createdAt: p.created_at ?? null,
      slug: a.slug ?? null,
      displayName: a.displayName ?? null,
      gmv30d: gmvMap[a.id] ?? 0,
    };
  });

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
