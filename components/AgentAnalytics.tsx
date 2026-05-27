import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { DollarSign, FileText, CheckCircle, TrendingUp } from 'lucide-react';

export default function AgentAnalytics({ statements, balance }: { statements: any[], balance: number }) {
  // Map statements to chart format
  const chartData = [...statements]
    .sort((a, b) => new Date(a.week_start).getTime() - new Date(b.week_start).getTime())
    .map(stmt => ({
      name: stmt.week_start.slice(5, 10), // MM-DD
      Owed: Number(stmt.total_owed),
      Status: stmt.status === 'paid' ? 'Paid' : 'Pending'
    }));

  const totalBilled = statements.reduce((acc, curr) => acc + Number(curr.total_owed), 0);
  const totalPaid = statements.filter(s => s.status === 'paid').reduce((acc, curr) => acc + Number(curr.total_owed), 0);
  const totalPending = totalBilled - totalPaid;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400 font-medium">Running Balance</h3>
            <DollarSign className="h-5 w-5 text-teal-500" />
          </div>
          <div className={`text-3xl font-bold ${balance < 0 ? 'text-red-500' : 'text-slate-100'}`}>
            ${balance.toFixed(2)}
          </div>
          <p className="text-sm text-slate-500 mt-2">Master Ledger Balance</p>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400 font-medium">Total Billed</h3>
            <TrendingUp className="h-5 w-5 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-slate-100">${totalBilled.toFixed(2)}</div>
          <p className="text-sm text-slate-500 mt-2">All Time Statements</p>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400 font-medium">Total Paid</h3>
            <CheckCircle className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="text-3xl font-bold text-emerald-500">${totalPaid.toFixed(2)}</div>
          <p className="text-sm text-slate-500 mt-2">Cleared Statements</p>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400 font-medium">Pending Payments</h3>
            <FileText className="h-5 w-5 text-amber-500" />
          </div>
          <div className="text-3xl font-bold text-amber-500">${totalPending.toFixed(2)}</div>
          <p className="text-sm text-slate-500 mt-2">Awaiting Clearing</p>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 h-[400px]">
        <h3 className="text-lg font-bold text-slate-100 mb-6">Statement History (Last 12 Weeks)</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData.slice(-12)}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                itemStyle={{ color: '#00C4BC' }}
              />
              <Legend />
              <Bar dataKey="Owed" fill="#00C4BC" name="Total Owed ($)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500">
            No Statement Data Available Yet.
          </div>
        )}
      </div>
    </div>
  );
}
