'use client';

import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AgentAnalytics({ agentId }: { agentId: string }) {
  const [salesData, setSalesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Generate mock agent sales data for demonstration. 
    // In production, this would query orders where agent_id = agentId or downline sales.
    const generateData = () => {
      const data = [];
      let baseline = 50;
      for (let i = 14; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        baseline += Math.floor(Math.random() * 30) - 10;
        if (baseline < 10) baseline = 10;
        
        data.push({
          date: d.toISOString().split('T')[0].substring(5),
          sales: baseline,
          commission: Math.floor(baseline * 0.15)
        });
      }
      return data;
    };

    setSalesData(generateData());
    setLoading(false);
  }, [agentId]);

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
