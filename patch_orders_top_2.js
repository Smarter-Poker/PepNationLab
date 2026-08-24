const fs = require('fs');
let code = fs.readFileSync('components/AgentOrders.tsx', 'utf8');

// 1. Remove it from the header area
code = code.replace(
  /<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: '16px' }}>[\s\S]*?<select[\s\S]*?<\/select>\s*<\/div>/,
  `<h3 className="metal-text" style={{ fontSize: '1.25rem', fontFamily: 'var(--font-brand)', margin: 0, marginBottom: 'var(--space-6)' }}>
          Completed Sales & Profit
        </h3>`
);

// 2. Put it at the absolute top of the return block
code = code.replace(
  /<div className="glass-panel" style={{ marginBottom: 'var(--space-6)' }}>/,
  `<div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-4)' }}>
        <select 
          className="sa-month-select" 
          style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--grey-900)', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--white)', fontSize: '0.95rem', fontWeight: 800 }}
          value={timeFilter} 
          onChange={(e) => { setTimeFilter(e.target.value); setCurrentPage(1); }}
        >
          <option value="all">All Time</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
          <option value="1y">Last Year</option>
        </select>
      </div>
    <div className="glass-panel" style={{ marginBottom: 'var(--space-6)' }}>`
);

fs.writeFileSync('components/AgentOrders.tsx', code);
