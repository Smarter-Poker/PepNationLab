const fs = require('fs');
let code = fs.readFileSync('components/AgentSales.tsx', 'utf8');

// 1. Remove the old `view` state
code = code.replace(/const \[view, setView\] = useState<string>\('30'\);/, '');

// 2. Modify chartData to use timeFilter instead of view
code = code.replace(
  /const chartData = useMemo\(\(\) => \{[\s\S]*?\}, \[view, a\]\);/,
  `const chartData = useMemo(() => {
    if (timeFilter === '7d') return a.series7;
    if (timeFilter === '30d') return a.series30;
    if (timeFilter === '90d') return a.series90;
    if (timeFilter === '1y') return a.series90; // Fallback or could add series365
    if (timeFilter === 'all') return a.series90; 
    return a.series30;
  }, [timeFilter, a]);`
);

// 3. Remove the old chart selector buttons and month dropdown
code = code.replace(
  /<div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>[\s\S]*?<\/div>/,
  ``
);

// 4. Move the timeFilter dropdown to the very absolute top, BEFORE the <style> tag so it's visually at the top
code = code.replace(
  /<div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-16px' }}>[\s\S]*?<\/div>/,
  ``
);

code = code.replace(
  /<div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>/,
  `<div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <select 
          className="sa-month-select" 
          style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--grey-900)', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--white)', fontSize: '0.95rem', fontWeight: 800 }}
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
