'use client';

import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface Product {
  name: string;
  revenue_cents: number;
  profit_cents: number;
  units: number;
}

const fmt = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format((Number(cents) || 0) / 100);

// PepNationLab brand palette — teal, green, silver family only
const COLORS = [
  '#00C4BC', // teal primary
  '#2ed573', // profit green
  '#C0B8A8', // silver
  '#009990', // deep teal
  '#22b85c', // dark green
  '#a8a098', // warm silver
  '#007a74', // darker teal
  '#1a9e4e', // darker green
  '#8a8278', // warm grey
  '#005f5a', // deep teal
];

export default function AdminTopProductsChart({ products }: { products: Product[] }) {
  const data = [...products]
    .sort((a, b) => b.revenue_cents - a.revenue_cents)
    .slice(0, 10)
    .map((p) => ({
      name: p.name.length > 22 ? p.name.slice(0, 22) + '…' : p.name,
      fullName: p.name,
      revenue: Number(p.revenue_cents) / 100,
      profit: Number(p.profit_cents) / 100,
      units: p.units,
    }));

  return (
    <div role="img" aria-label="Top 10 products by revenue">
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 38)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 80, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
          <XAxis
            type="number"
            stroke="var(--grey-500)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
          />
          <YAxis
            dataKey="name"
            type="category"
            width={150}
            stroke="var(--grey-400)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0A1520',
              border: '1px solid rgba(192,184,168,0.15)',
              borderRadius: 8,
              fontSize: 13,
            }}
            cursor={{ fill: 'rgba(0,196,188,0.06)' }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(((value: any, name: any, entry: any) => {
              const v = Number(value) || 0;
              if (name === 'revenue') {
                return [
                  `${fmt(v * 100)} (Profit: ${fmt(entry.payload.profit * 100)}, Units: ${entry.payload.units})`,
                  entry.payload.fullName,
                ];
              }
              return [fmt(v * 100), String(name)];
            }) as any)}
            labelFormatter={() => ''}
          />
          <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={24} isAnimationActive={false}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
