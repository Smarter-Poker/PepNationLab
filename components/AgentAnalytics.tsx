'use client';

import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SalesRecord {
  id: string;
  status?: string;
  created_at?: string;
  total?: number | string;
  shipping_cost?: number | string;
  discount_amount?: number | string;
  profit?: number | string;
  items?: Array<{
    quantity?: number | string;
    unit_retail_price?: number | string;
    unit_cost_price?: number | string;
  }>;
}

export default function AgentAnalytics({ agentId, orders }: { agentId: string, orders: any[] }) {
  const [salesData, setSalesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Pull real per-order profit from the sales API so the chart matches
      // the ledger (profit = retail − cost − shipping). Falls back to a
      // local compute if the API call fails so the chart still renders.
      let salesRecords: SalesRecord[] = [];
      try {
        const res = await fetch('/api/agent/sales');
        if (res.ok) {
          const json = await res.json();
          salesRecords = (json?.data?.sales as SalesRecord[]) ?? [];
        }
      } catch {
        salesRecords = [];
      }

      const computeOrderProfit = (rec: SalesRecord): number => {
        const supplied = Number(rec.profit);
        if (Number.isFinite(supplied)) return supplied;
        let retail = 0;
        let cost = 0;
        for (const it of rec.items ?? []) {
          const qty = Number(it.quantity) || 0;
          retail += (Number(it.unit_retail_price) || 0) * qty;
          cost += (Number(it.unit_cost_price) || 0) * qty;
        }
        const discount = Number(rec.discount_amount) || 0;
        const ship = Number(rec.shipping_cost) || 0;
        return retail - discount - cost - ship;
      };

      const recordsByDate = new Map<string, SalesRecord[]>();
      for (const rec of salesRecords) {
        if (rec.status === 'cancelled') continue;
        if (!rec.created_at) continue;
        const day = new Date(rec.created_at);
        if (Number.isNaN(day.valueOf())) continue;
        day.setHours(0, 0, 0, 0);
        const key = day.toISOString().split('T')[0];
        const bucket = recordsByDate.get(key);
        if (bucket) bucket.push(rec);
        else recordsByDate.set(key, [rec]);
      }

      const data: Array<{ date: string; sales: number; profit: number }> = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = 13; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];

        const dayRecords = recordsByDate.get(key) ?? [];
        const dayTotal = dayRecords.reduce(
          (sum, r) => sum + (Number(r.total) || 0),
          0
        );
        const dayProfit = dayRecords.reduce(
          (sum, r) => sum + computeOrderProfit(r),
          0
        );

        data.push({
          date: key.substring(5),
          sales: Math.round(dayTotal * 100) / 100,
          profit: Math.round(dayProfit * 100) / 100,
        });
      }

      if (!cancelled) {
        setSalesData(data);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [agentId, orders]);

  if (loading) {
    return <div className="skeleton" style={{ height: 250, width: '100%', borderRadius: 16 }} />;
  }

  return (
    <div className="card-metal" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
      <h3 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-brand)', color: 'var(--white)', marginBottom: 'var(--space-4)' }}>
        14-Day Sales Performance
      </h3>
      <div style={{ height: 250, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={salesData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <defs>
              <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--teal)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="var(--teal)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="date" stroke="var(--grey-400)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--grey-400)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
            <Tooltip 
              contentStyle={{ background: 'var(--black-2)', border: '1px solid var(--border-teal)', borderRadius: 8 }}
              itemStyle={{ color: 'var(--white)' }}
            />
            <Area type="monotone" dataKey="sales" stroke="var(--teal)" fillOpacity={1} fill="url(#colorSales)" strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
