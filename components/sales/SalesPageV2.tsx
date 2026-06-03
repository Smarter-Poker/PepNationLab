'use client';

import { useEffect, useState } from 'react';
import type { RangePreset } from '@/lib/sales-range';
import SalesFilterBar from './SalesFilterBar';
import SalesKPIStrip from './SalesKPIStrip';
import SalesTimeseriesChart from './SalesTimeseriesChart';
import GoalTracker from './GoalTracker';
import AutoInsightsCallouts from './AutoInsightsCallouts';
import SalesHeatmap from './SalesHeatmap';
import SubAgentRollupTable from './SubAgentRollupTable';
import AIWeeklySummary from './AIWeeklySummary';

export default function SalesPageV2() {
  const [preset, setPreset] = useState<RangePreset>('30d');
  const [kpis, setKpis] = useState<any>(null);
  const [points, setPoints] = useState<any[]>([]);

  async function load(p: RangePreset) {
    const [k, t] = await Promise.all([
      fetch(`/api/agent/sales/kpis-v2?range=${p}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
      fetch(`/api/agent/sales/timeseries-v2?range=${p}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
    ]);
    if (k) setKpis(k);
    if (t?.points) setPoints(t.points);
  }
  useEffect(() => { load(preset); }, [preset]);

  const revenueCents = Number(kpis?.current?.revenue_cents ?? 0);

  return (
    <div style={{ textTransform: 'capitalize', paddingTop: 'calc(var(--nav-offset, 60px) + 12px)', paddingRight: 12, paddingBottom: 12, paddingLeft: 12, minHeight: '100dvh', background: 'var(--black)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <header>
          <h1 style={{ fontSize: '1.6rem', color: 'var(--white)', margin: 0, fontFamily: 'var(--font-brand)' }}>Sales Performance</h1>
          <p style={{ color: 'var(--grey-400)', fontSize: '0.88rem', margin: '4px 0 0' }}>
            Live Analytics With Period-Over-Period Comparison
          </p>
        </header>

        <SalesFilterBar preset={preset} onChange={setPreset} />
        <AutoInsightsCallouts />
        <SalesKPIStrip data={kpis} />
        <SalesTimeseriesChart points={points} />
        <GoalTracker revenueCents={revenueCents} />
        <AIWeeklySummary />
        <SalesHeatmap preset={preset} />
        <SubAgentRollupTable preset={preset} />

        <div className="card-metal" style={{ padding: 14, borderRadius: 12 }}>
          <h3 style={{ color: 'var(--white)', fontSize: '0.95rem', marginTop: 0 }}>Exports</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href={`/api/agent/sales/export/tax?year=${new Date().getFullYear()}`} download
              style={{
                padding: '10px 14px', borderRadius: 8, minHeight: 44, textDecoration: 'none',
                background: 'rgba(255,255,255,0.05)', color: 'var(--white)',
                border: '1px solid rgba(255,255,255,0.1)', fontWeight: 700, fontSize: '0.85rem',
                display: 'inline-flex', alignItems: 'center',
              }}>Tax-Ready CSV ({new Date().getFullYear()})</a>
          </div>
        </div>
      </div>
    </div>
  );
}
