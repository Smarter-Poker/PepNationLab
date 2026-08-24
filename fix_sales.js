const fs = require('fs');
let code = fs.readFileSync('components/AgentSales.tsx', 'utf8');

code = code.replace(
  /<div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>/,
  `<div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-2)' }}>
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
