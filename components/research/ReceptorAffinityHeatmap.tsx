'use client';

/**
 * ReceptorAffinityHeatmap -- bar chart of pChEMBL values per target.
 * Research use only.
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Binding {
  target_name: string;
  standard_type: string | null;
  standard_value: number | null;
  standard_units: string | null;
  pchembl_value: number | null;
}

interface Props {
  bindings: Binding[];
}

function colorFor(v: number): string {
  if (v >= 9) return '#00C4BC';
  if (v >= 7) return '#68D391';
  if (v >= 5) return '#F6AD55';
  return '#A8B4C0';
}

export default function ReceptorAffinityHeatmap({ bindings }: Props) {
  if (!bindings || bindings.length === 0) {
    return (
      <div className="card-glass" style={{ padding: 16, borderRadius: 12, color: '#A8B4C0', fontSize: 14 }}>
        No Binding Affinity Rows Are Yet Indexed For This Target. ChEMBL Sync Will Populate.
      </div>
    );
  }
  const data = bindings.map((b) => ({
    name: b.target_name.length > 18 ? b.target_name.slice(0, 16) + '...' : b.target_name,
    full: b.target_name,
    pchembl: b.pchembl_value ?? 0,
    detail: `${b.standard_type ?? ''} ${b.standard_value ?? ''} ${b.standard_units ?? ''}`.trim(),
  }));

  return (
    <div>
      <div style={{ width: '100%', height: Math.max(240, data.length * 32 + 80) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 30 }} layout="vertical">
            <CartesianGrid stroke="rgba(168,180,192,0.15)" />
            <XAxis type="number" tick={{ fill: '#A8B4C0', fontSize: 12 }} label={{ value: 'pChEMBL', position: 'insideBottom', offset: -6, fill: '#A8B4C0', fontSize: 12 }} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#A8B4C0', fontSize: 12 }} width={140} />
            <Tooltip contentStyle={{ background: '#162230', border: '1px solid rgba(168,180,192,0.25)', color: '#FFFFFF' }} />
            <Bar dataKey="pchembl">
              {data.map((d, i) => (
                <Cell key={i} fill={colorFor(d.pchembl)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p style={{ marginTop: 10, fontSize: 11, color: '#A8B4C0', fontStyle: 'italic' }}>
        Data From ChEMBL. Higher pChEMBL Indicates Stronger Binding. Research Use Only.
      </p>
    </div>
  );
}
