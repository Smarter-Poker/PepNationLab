const fs = require('fs');
let code = fs.readFileSync('components/AgentSales.tsx', 'utf8');

// 1. Add timeFilter state
code = code.replace(
  /const \[view, setView\] = useState<string>\('30'\);/,
  `const [view, setView] = useState<string>('30');
  const [timeFilter, setTimeFilter] = useState('all');
  
  const filteredOrders = useMemo(() => {
    if (timeFilter === 'all') return orders;
    const now = Date.now();
    let cutoff = 0;
    if (timeFilter === '7d') cutoff = now - 7 * 24 * 60 * 60 * 1000;
    else if (timeFilter === '30d') cutoff = now - 30 * 24 * 60 * 60 * 1000;
    else if (timeFilter === '90d') cutoff = now - 90 * 24 * 60 * 60 * 1000;
    else if (timeFilter === '1y') cutoff = now - 365 * 24 * 60 * 60 * 1000;
    return orders.filter((o: any) => new Date(o.created_at).getTime() >= cutoff);
  }, [orders, timeFilter]);`
);

// 2. Change `const a = useMemo(() => { ... })` to use filteredOrders for standard metrics, but keep lifetime from `orders`
code = code.replace(
  /const all = \(orders \|\| \[\]\) as any\[\];/,
  `const all = (filteredOrders || []) as any[];
    const absoluteAll = (orders || []) as any[];
    const absoluteCollected = absoluteAll.filter((o) => COLLECTED.has(o.status));
    const absoluteLifetimeRevenue = sum(absoluteCollected, 'total');`
);

// 3. Update milestone logic to use absoluteLifetimeRevenue
code = code.replace(
  /const nextMilestone = MILESTONES\.find\(\(m\) => a\.lifetimeRevenue < m\.amount\) \|\| null;/g,
  `const nextMilestone = MILESTONES.find((m) => a.absoluteLifetimeRevenue < m.amount) || null;`
);
code = code.replace(
  /const achievedMilestones = MILESTONES\.filter\(\(m\) => a\.lifetimeRevenue >= m\.amount\);/g,
  `const achievedMilestones = MILESTONES.filter((m) => a.absoluteLifetimeRevenue >= m.amount);`
);
code = code.replace(
  /const hit = a\.lifetimeRevenue >= m\.amount;/g,
  `const hit = a.absoluteLifetimeRevenue >= m.amount;`
);

code = code.replace(
  /<span>\{fmt\(a\.lifetimeRevenue\)\} \/ \{fmt\(nextMilestone\.amount\)\}<\/span>/g,
  `<span>{fmt(a.absoluteLifetimeRevenue)} / {fmt(nextMilestone.amount)}</span>`
);
code = code.replace(
  /width: \`\$\{Math\.min\(100, \(a\.lifetimeRevenue \/ nextMilestone\.amount\) \* 100\)\}\%\`/g,
  `width: \`\$\{Math.min(100, (a.absoluteLifetimeRevenue / nextMilestone.amount) * 100)}%\``
);

// Don't forget to export absoluteLifetimeRevenue from `a`
code = code.replace(
  /return \{[\s\S]*?monthRevenue,/,
  match => match.replace('return {', 'return { absoluteLifetimeRevenue,')
);

// 4. Change labels
code = code.replace(
  /label="Collected Revenue"/,
  `label={timeFilter === 'all' ? "Lifetime Revenue" : "Revenue"}`
);
code = code.replace(
  /label="Lifetime Orders"/,
  `label={timeFilter === 'all' ? "Lifetime Orders" : "Orders"}`
);

// 5. Add dropdown to UI
code = code.replace(
  /<div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>/,
  `<div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-16px' }}>
        <select 
          className="sa-month-select" 
          style={{ padding: '6px 12px', borderRadius: '8px', background: 'var(--grey-900)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--white)', fontSize: '0.85rem' }}
          value={timeFilter} 
          onChange={(e) => { setTimeFilter(e.target.value); }}
        >
          <option value="all">All Time</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
          <option value="1y">Last Year</option>
        </select>
      </div>`
);

fs.writeFileSync('components/AgentSales.tsx', code);
