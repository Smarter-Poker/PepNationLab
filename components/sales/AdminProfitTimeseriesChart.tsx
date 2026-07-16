'use client';

import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface Point {
  day: string;
  revenue_cents: number;
  profit_cents: number;
  orders: number;
}

const fmt = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format((Number(cents) || 0) / 100);

const tooltipStyle = {
  backgroundColor: '#0A1520',
  border: '1px solid rgba(192,184,168,0.15)',
  borderRadius: 8,
  fontSize: 13,
};

export default function AdminProfitTimeseriesChart({ points }: { points: Point[] }) {
  const data = points.map((p) => ({
    day: p.day.slice(5), // MM-DD
    revenue: Number(p.revenue_cents) / 100,
    profit: Number(p.profit_cents) / 100,
    orders: p.orders,
  }));

  return (
    <div role="img" aria-label="Area chart of daily revenue and profit">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00C4BC" stopOpacity={0.22} />
              <stop offset="95%" stopColor="#00C4BC" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2ed573" stopOpacity={0.22} />
              <stop offset="95%" stopColor="#2ed573" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="day"
            stroke="var(--grey-500)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke="var(--grey-500)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: 'var(--grey-400)', marginBottom: 4 }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={((value: any, name: any) => [fmt((Number(value) || 0) * 100), name === 'revenue' ? 'Revenue' : 'Profit']) as any}
          />
          <Legend
            formatter={(val) => (
              <span style={{ color: val === 'revenue' ? '#00C4BC' : '#2ed573', fontSize: 12, fontWeight: 600 }}>
                {val === 'revenue' ? 'Revenue' : 'Profit'}
              </span>
            )}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#00C4BC"
            strokeWidth={2}
            fill="url(#gradRevenue)"
            dot={false}
            activeDot={{ r: 4, fill: '#00C4BC' }}
          />
          <Area
            type="monotone"
            dataKey="profit"
            stroke="#2ed573"
            strokeWidth={2}
            fill="url(#gradProfit)"
            dot={false}
            activeDot={{ r: 4, fill: '#2ed573' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
