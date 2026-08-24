const fs = require('fs');
let code = fs.readFileSync('components/AgentOrders.tsx', 'utf8');

// 1. Add timeFilter state
code = code.replace(
  /const \[currentPage, setCurrentPage\] = useState\(1\);/,
  `const [currentPage, setCurrentPage] = useState(1);
  const [timeFilter, setTimeFilter] = useState('all');
  
  const filteredOrders = React.useMemo(() => {
    if (timeFilter === 'all') return orders;
    const now = Date.now();
    let cutoff = 0;
    if (timeFilter === '7d') cutoff = now - 7 * 24 * 60 * 60 * 1000;
    else if (timeFilter === '30d') cutoff = now - 30 * 24 * 60 * 60 * 1000;
    else if (timeFilter === '90d') cutoff = now - 90 * 24 * 60 * 60 * 1000;
    else if (timeFilter === '1y') cutoff = now - 365 * 24 * 60 * 60 * 1000;
    return orders.filter(o => new Date(o.created_at).getTime() >= cutoff);
  }, [orders, timeFilter]);`
);

// 2. Replace orders.length with filteredOrders.length for pagination
code = code.replace(
  /const totalPages = Math\.ceil\(orders\.length \/ PAGE_SIZE\);/,
  `const totalPages = Math.ceil(filteredOrders.length / PAGE_SIZE);`
);

// 3. Replace orders.slice with filteredOrders.slice
code = code.replace(
  /const paginatedOrders = orders\.slice\(\(safeCurrentPage - 1\) \* PAGE_SIZE, safeCurrentPage \* PAGE_SIZE\);/,
  `const paginatedOrders = filteredOrders.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE);`
);

// 4. Update the "Completed Sales & Profit" header to include the dropdown
code = code.replace(
  /<div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'flex-end' }}>/,
  `<div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
          <select 
            className="sa-month-select" 
            style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--grey-900)', border: '1px solid var(--grey-800)', color: 'var(--white)', fontSize: '0.85rem' }}
            value={timeFilter} 
            onChange={(e) => { setTimeFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="all">All Time</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last Year</option>
          </select>`
);

fs.writeFileSync('components/AgentOrders.tsx', code);
