'use client';

import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AgentAnalytics({ agentId, orders }: { agentId: string, orders: any[] }) {
  const [salesData, setSalesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Generate real agent sales data for the last 14 days
    const generateData = () => {
      const data = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = 13; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const nextDay = new Date(d);
        nextDay.setDate(nextDay.getDate() + 1);

        // Find all orders created on this day
        const dayOrders = orders.filter(o => {
          const orderDate = new Date(o.created_at);
          return orderDate >= d && orderDate < nextDay;
        });

        // Sum the totals
        const dayTotal = dayOrders.reduce((sum, o) => sum + (o.total || 0), 0);
        
        data.push({
          date: d.toISOString().split('T')[0].substring(5),
          sales: dayTotal,
          commission: dayTotal * 0.15 // Example 15% commission, adjust as needed
        });
      }
      return data;
    };

    if (orders) {
      setSalesData(generateData());
      setLoading(false);
    }
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
