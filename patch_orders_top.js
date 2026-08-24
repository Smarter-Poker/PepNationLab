const fs = require('fs');
let code = fs.readFileSync('components/AgentOrders.tsx', 'utf8');

// Remove it from the current position
code = code.replace(
  /<div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>\s*<select[\s\S]*?<\/select>/m,
  `<div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'flex-end' }}>`
);

// Add it to the top level of the component's render
code = code.replace(
  /<h3\s*className="metal-text"\s*style={{[\s\S]*?}}[\s\S]*?>\s*Completed Sales & Profit\s*<\/h3>/m,
  `<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: '16px' }}>
        <h3 className="metal-text" style={{ fontSize: '1.25rem', fontFamily: 'var(--font-brand)', margin: 0 }}>
          Completed Sales & Profit
        </h3>
        <select 
          className="sa-month-select" 
          style={{ padding: '6px 12px', borderRadius: '8px', background: 'var(--grey-900)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--white)', fontSize: '0.85rem' }}
          value={timeFilter} 
          onChange={(e) => { setTimeFilter(e.target.value); setCurrentPage(1); }}
        >
          <option value="all">All Time</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
          <option value="1y">Last Year</option>
        </select>
      </div>`
);

fs.writeFileSync('components/AgentOrders.tsx', code);
