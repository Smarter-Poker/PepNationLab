'use client';

/**
 * All recharts-backed visualizations for the Lab Journal, extracted out of
 * LabJournalClient so recharts (~400KB) can be code-split.
 *
 * This matters: the Lab Journal's default tab is 'bundles', which renders no
 * charts at all. Previously recharts shipped with the route regardless, so most
 * visits downloaded 400KB they never used. Each chart is now dynamically imported
 * by the parent and only fetched when its tab actually renders.
 *
 * Chart markup is moved verbatim -- only the closed-over locals became props.
 */
import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
  ResponsiveContainer, ComposedChart, Bar, ReferenceLine, Area, AreaChart,
  Scatter, RadialBar, RadialBarChart,
} from 'recharts';

/* eslint-disable @typescript-eslint/no-explicit-any */

export function BiometricTrendChart({
  data, metric, goal, doseDays, yMin, yMax,
}: {
  data: any[];
  metric: string;
  goal: number | null | undefined;
  doseDays: string[];
  yMin: number;
  yMax: number;
}) {
  return (
    <div style={{ width: '100%', height: '100%' }} role="img" aria-label={`Trend Chart Of ${metric} Readings Over Time${goal != null && !isNaN(goal) ? ` With A Goal Line At ${goal}` : ''}`}>
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${metric.replace(/\W/g, '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00E5FF" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#00E5FF" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="label" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'var(--silver)', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis domain={[Math.floor(yMin * 0.97), Math.ceil(yMax * 1.03)]} stroke="rgba(255,255,255,0.3)" tick={{ fill: 'var(--silver)', fontSize: 10 }} tickLine={false} axisLine={false} />
        <RechartsTooltip contentStyle={{ backgroundColor: '#1A202C', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8 }} itemStyle={{ color: '#fff', fontSize: '0.85rem' }} labelStyle={{ color: 'var(--silver)' }} />
        {goal != null && !isNaN(goal) && <ReferenceLine y={goal} stroke="var(--teal)" strokeDasharray="5 4" label={{ value: `Goal ${goal}`, fill: 'var(--teal)', fontSize: 10, position: 'insideTopRight' }} />}
        {doseDays.map(dd => {
          const pt = data.find(d => d.label === dd);
          return pt ? <ReferenceLine key={dd} x={dd} stroke="rgba(246,173,85,0.25)" strokeWidth={1} /> : null;
        })}
        <Area type="monotone" dataKey="trend" stroke="none" fill={`url(#grad-${metric.replace(/\W/g, '')})`} />
        <Scatter dataKey="raw" fill="rgba(208,218,228,0.55)" />
        <Line type="monotone" dataKey="trend" name="Trend" stroke="#00E5FF" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
      </ComposedChart>
    </ResponsiveContainer>
    </div>
  );
}

export function BiometricDoseOverlayChart({
  chartData, metric, goal, compoundsPresent, colors,
}: {
  chartData: any[];
  metric: string;
  goal: number | null | undefined;
  compoundsPresent: string[];
  colors: string[];
}) {
  return (
    <div style={{ width: '100%', height: '100%' }} role="img" aria-label={`Combined Chart Overlaying ${metric} Readings With Dose Bars For ${compoundsPresent.join(', ') || 'Logged Compounds'}`}>
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" tick={{fill: 'var(--silver)', fontSize: 11}} tickLine={false} axisLine={false} />
        <YAxis yAxisId="left" stroke="rgba(255,255,255,0.3)" tick={{fill: 'var(--silver)', fontSize: 11}} tickLine={false} axisLine={false} />
        <YAxis yAxisId="right" orientation="right" stroke="rgba(255,255,255,0.3)" tick={{fill: 'var(--silver)', fontSize: 11}} tickLine={false} axisLine={false} />
        <RechartsTooltip
          contentStyle={{ backgroundColor: '#1A202C', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8 }}
          itemStyle={{ color: '#fff', fontSize: '0.9rem' }}
          labelStyle={{ color: 'var(--silver)', marginBottom: 4 }}
        />
        <Legend wrapperStyle={{ paddingTop: 10, fontSize: '0.85rem', color: 'var(--silver)' }} />

        {goal && <ReferenceLine yAxisId="left" y={goal} stroke="var(--teal)" strokeDasharray="4 4" />}

        {metric !== 'Doses Only' && (
          <Line yAxisId="left" type="monotone" name={`${metric} Trend`} dataKey={metric} stroke="var(--white)" strokeWidth={3} dot={{r: 4, fill: '#1A202C', stroke: 'var(--white)', strokeWidth: 2}} activeDot={{r: 6}} connectNulls />
        )}

        {compoundsPresent.map((cmp, idx) => (
          <Bar key={cmp} yAxisId={metric !== 'Doses Only' ? "right" : "left"} name={`${cmp} Dose`} dataKey={cmp} fill={colors[idx % colors.length]} opacity={0.6} radius={[4,4,0,0]} barSize={20} />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
    </div>
  );
}

export function AdherenceRing({ adherence }: { adherence: number | null | undefined }) {
  return (
    <div style={{ width: '100%', height: '100%' }} role="img" aria-label={`Adherence Ring Showing ${Math.round(adherence ?? 0)} Percent Dose Adherence`}>
    <ResponsiveContainer width="100%" height="100%">
      <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ v: adherence ?? 0, fill: 'var(--teal)' }]} startAngle={90} endAngle={-270}>
        <RadialBar background={{ fill: 'rgba(255,255,255,0.08)' }} dataKey="v" cornerRadius={20} />
      </RadialBarChart>
    </ResponsiveContainer>
    </div>
  );
}

export function ActiveInSystemChart({
  data, compounds, colors,
}: {
  data: any[];
  compounds: string[];
  colors: readonly string[];
}) {
  return (
    <div style={{ width: '100%', height: '100%' }} role="img" aria-label={`Area Chart Of Estimated Active Levels In System Over Time For ${compounds.join(', ') || 'Logged Compounds'}`}>
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
        <defs>
          {compounds.map((c, i) => (
            <linearGradient key={c} id={`ais-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors[i % colors.length]} stopOpacity={0.35} />
              <stop offset="100%" stopColor={colors[i % colors.length]} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="label" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'var(--silver)', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={28} />
        <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: 'var(--silver)', fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
        <RechartsTooltip contentStyle={{ backgroundColor: '#1A202C', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8 }} itemStyle={{ fontSize: '0.8rem' }} labelStyle={{ color: 'var(--silver)' }} />
        <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
        <ReferenceLine x={new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })} stroke="rgba(255,255,255,0.35)" strokeDasharray="4 4" label={{ value: 'Now', fill: 'var(--silver)', fontSize: 10, position: 'top' }} />
        {compounds.map((c, i) => (
          <Area key={c} type="monotone" dataKey={c} name={c} stroke={colors[i % colors.length]} strokeWidth={2} fill={`url(#ais-${i})`} dot={false} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
    </div>
  );
}

export function MetricSparkline({ spark, metric }: { spark: any[]; metric: string }) {
  return (
    <div style={{ width: '100%', height: '100%' }} role="img" aria-label={`Sparkline Of Recent ${metric} Readings`}>
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={spark} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`sp-${metric.replace(/\W/g, '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00E5FF" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#00E5FF" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke="#00E5FF" strokeWidth={1.5} fill={`url(#sp-${metric.replace(/\W/g, '')})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
    </div>
  );
}
