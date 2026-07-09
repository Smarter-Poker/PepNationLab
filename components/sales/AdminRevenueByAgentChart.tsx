'use client';

/**
 * Revenue-by-agent bar chart, extracted out of app/admin/sales/page.tsx so the
 * page can load recharts (~400KB) lazily instead of bundling it up front.
 * Chart markup is unchanged.
 */
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface AgentRevenueRow {
  full_name: string;
  total_revenue: number | string;
}

export default function AdminRevenueByAgentChart({ agents }: { agents: AgentRevenueRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={agents.map((a) => ({ ...a, total_revenue: Number(a.total_revenue) || 0 }))}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="full_name" stroke="#7B8794" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="#7B8794" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
        <Tooltip
          cursor={{ fill: 'rgba(0,196,188,0.08)' }}
          contentStyle={{ backgroundColor: '#0F1923', border: '1px solid #1D2D3E', borderRadius: 8 }}
          itemStyle={{ color: 'var(--silver)' }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Revenue']}
          labelStyle={{ color: 'var(--grey-400)', marginBottom: 4 }}
        />
        <Bar dataKey="total_revenue" fill="#C0B8A8" radius={[4, 4, 0, 0]} maxBarSize={72} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
