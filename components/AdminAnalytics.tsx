'use client';
import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { ShieldAlert, TrendingUp } from 'lucide-react';

export default function AdminAnalytics({ statements, agents }: { statements: any[], agents: any[] }) {
  // Aggregate revenue by week
  const weeklyData = statements.reduce((acc, stmt) => {
    const week = stmt.week_start.slice(5, 10);
    if (!acc[week]) {
      acc[week] = { name: week, TotalBilled: 0, TotalPaid: 0 };
    }
    acc[week].TotalBilled += Number(stmt.total_owed);
    if (stmt.status === 'paid') {
      acc[week].TotalPaid += Number(stmt.total_owed);
    }
    return acc;
  }, {});

  const chartData = Object.values(weeklyData).sort((a: any, b: any) => a.name.localeCompare(b.name));

  // Find agents with negative balance
  const agentsInDebt = agents.filter(a => Number(a.prepaid_balance || 0) < 0)
    .sort((a, b) => Number(a.prepaid_balance) - Number(b.prepaid_balance))
    .slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
      <div className="lg:col-span-2 bg-slate-800 rounded-lg p-6 border border-slate-700 h-[400px]">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-slate-100">Global Revenue (Wholesale)</h3>
          <TrendingUp className="h-5 w-5 text-teal-500" />
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorBilled" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00C4BC" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#00C4BC" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }} />
              <Legend />
              <Area type="monotone" dataKey="TotalBilled" stroke="#00C4BC" fillOpacity={1} fill="url(#colorBilled)" />
              <Area type="monotone" dataKey="TotalPaid" stroke="#10b981" fillOpacity={0.3} fill="#10b981" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500">No Revenue Data</div>
        )}
      </div>

      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 h-[400px] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-amber-500 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" /> Ledger Warnings
          </h3>
        </div>
        {agentsInDebt.length > 0 ? (
          <div className="space-y-4">
            {agentsInDebt.map(agent => (
              <div key={agent.id} className="p-3 bg-slate-900 rounded border border-amber-900/50">
                <div className="text-sm font-medium text-slate-200">{agent.full_name || agent.email}</div>
                <div className="text-xl font-bold text-red-400 mt-1">
                  ${Number(agent.prepaid_balance).toFixed(2)}
                </div>
                <div className="text-xs text-slate-500 mt-1">Past Due Master Ledger</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 text-emerald-500">
            All agents are squared up!
          </div>
        )}
      </div>
    </div>
  );
}
