'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Point {
  date: string;
  revenue: number;
}

interface Props {
  data: Point[];
}

/**
 * 30-day sparkline of GMV used on the admin overview dashboard. Data is
 * grouped by day server-side and passed in via props so the chart is
 * cacheable across page navigations.
 */
export default function AdminOverviewSparkline({ data }: Props) {
  const total = data.reduce((acc, p) => acc + (Number(p.revenue) || 0), 0);
  const peak = data.reduce((acc, p) => Math.max(acc, Number(p.revenue) || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            30-Day Total
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--white)', marginTop: 2 }}>
            ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Peak Day
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--teal)', marginTop: 2 }}>
            ${peak.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="date"
            stroke="var(--grey-500)"
            tick={{ fontSize: 10 }}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke="var(--grey-500)"
            tick={{ fontSize: 10 }}
            tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
            width={48}
          />
          <Tooltip
            contentStyle={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: 'var(--silver)' }}
            itemStyle={{ color: 'var(--teal)' }}
            formatter={(v) => [`$${Number(v ?? 0).toFixed(2)}`, 'Revenue']}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="var(--teal)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: 'var(--teal)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
