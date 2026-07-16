'use client';

import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface TierEntry {
  tier: string;
  label: string;
  revenue_cents: number;
  orders: number;
}

const COLORS: Record<string, string> = {
  tier_1: '#00C4BC',
  tier_2: '#2ed573',
  tier_3: '#ffa502',
  direct: '#C0B8A8',
};

const fmt = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format((Number(cents) || 0) / 100);

export default function AdminTierDonutChart({ breakdown }: { breakdown: TierEntry[] }) {
  const data = breakdown.filter((b) => b.revenue_cents > 0);

  if (data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--grey-500)', fontSize: '0.83rem' }}>
        No data
      </div>
    );
  }

  return (
    <div role="img" aria-label="Revenue breakdown by agent tier">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="revenue_cents"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={78}
            paddingAngle={3}
            isAnimationActive={false}
          >
            {data.map((entry) => (
              <Cell
                key={entry.tier}
                fill={COLORS[entry.tier] ?? '#7B8794'}
                stroke="transparent"
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#0A1520',
              border: '1px solid rgba(192,184,168,0.15)',
              borderRadius: 8,
              fontSize: 12,
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(((val: any, _name: any, props: any) => [
              `${fmt(Number(val))} · ${props.payload.orders} orders`,
              props.payload.label,
            ]) as any)}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(val) => (
              <span style={{ color: 'var(--grey-400)', fontSize: 11 }}>{val}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
