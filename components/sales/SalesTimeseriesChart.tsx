'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function SalesTimeseriesChart({ points }: { points: any[] }) {
  const data = (points ?? []).map(p => ({
    day: p.day?.slice ? p.day.slice(5) : p.day,
    revenue: Number(p.revenue_cents) / 100,
    profit: Number(p.profit_cents) / 100,
  }));
  return (
    <div className="glass-panel">
      <div className="" style={{ padding: 12, height: 280 }}>
        <h3 style={{ color: 'var(--white)', fontSize: '0.95rem', margin: '0 0 8px' }}>Performance Trend</h3>
        <ResponsiveContainer width="100%" height="85%">
          <AreaChart data={data}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="day" stroke="var(--grey-500)" fontSize={11} />
            <YAxis stroke="var(--grey-500)" fontSize={11} />
            <Tooltip contentStyle={{ background: 'var(--grey-900)', border: '1px solid rgba(255,255,255,0.1)' }} />
            <Area type="monotone" dataKey="revenue" stroke="var(--teal)" fill="var(--teal)" fillOpacity={0.18} />
            <Area type="monotone" dataKey="profit" stroke="#2ed573" fill="#2ed573" fillOpacity={0.12} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
