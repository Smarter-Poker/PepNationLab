'use client';

/**
 * PKChart -- Recharts LineChart approximating plasma concentration over 24 h
 * using a two-compartment absorption-then-first-order-elimination model.
 *
 * Research use only. Modeled from published parameters.
 */

import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  tmaxHours?: number | null;
  halfLifeHours?: number | null;
  cmaxNgMl?: number | null;
  hoursToPlot?: number;
}

export default function PKChart({ tmaxHours, halfLifeHours, cmaxNgMl, hoursToPlot = 24 }: Props) {
  const data = useMemo(() => {
    const tmax = tmaxHours && tmaxHours > 0 ? tmaxHours : 1;
    const t12 = halfLifeHours && halfLifeHours > 0 ? halfLifeHours : 4;
    const cmax = cmaxNgMl && cmaxNgMl > 0 ? cmaxNgMl : 100;

    const ka = Math.log(2) / Math.max(0.25, tmax / 3);
    const ke = Math.log(2) / t12;

    const points: Array<{ t: number; c: number }> = [];
    const steps = 96;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * hoursToPlot;
      let c: number;
      if (Math.abs(ka - ke) < 1e-6) {
        c = cmax * t * Math.exp(-ke * t);
      } else {
        c = (cmax * (Math.exp(-ke * t) - Math.exp(-ka * t))) / (Math.exp(-ke * tmax) - Math.exp(-ka * tmax));
      }
      points.push({ t: Number(t.toFixed(2)), c: Math.max(0, Number(c.toFixed(3))) });
    }
    return points;
  }, [tmaxHours, halfLifeHours, cmaxNgMl, hoursToPlot]);

  return (
    <div>
      <h3 style={{ margin: 0, color: '#FFFFFF', fontSize: 16, fontWeight: 800 }}>Predicted Pharmacokinetic Profile</h3>
      <p style={{ margin: '4px 0 12px', color: '#A8B4C0', fontSize: 12 }}>Modeled From Published Parameters. Two-Compartment Approximation.</p>
      <div style={{ width: '100%', height: 280 }} role="img" aria-label={`Line Chart Of Predicted Plasma Concentration In Nanograms Per Milliliter Over ${hoursToPlot} Hours`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 10 }}>
            <CartesianGrid stroke="rgba(168,180,192,0.15)" />
            <XAxis dataKey="t" tick={{ fill: '#A8B4C0', fontSize: 12 }} label={{ value: 'Hours', position: 'insideBottom', offset: -6, fill: '#A8B4C0', fontSize: 12 }} />
            <YAxis tick={{ fill: '#A8B4C0', fontSize: 12 }} label={{ value: 'ng/mL', angle: -90, position: 'insideLeft', fill: '#A8B4C0', fontSize: 12 }} />
            <Tooltip contentStyle={{ background: '#162230', border: '1px solid rgba(168,180,192,0.25)', color: '#FFFFFF' }} />
            <Line type="monotone" dataKey="c" stroke="#00C4BC" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p style={{ marginTop: 10, fontSize: 11, color: '#A8B4C0', fontStyle: 'italic' }}>
        Research Use Only. Not Intended As Medical Advice Or Human Dosing.
      </p>
    </div>
  );
}
