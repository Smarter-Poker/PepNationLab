const fs = require('fs');
let code = fs.readFileSync('components/AgentSales.tsx', 'utf8');

code = code.replace(
  /<AgentOrders orders={orders} setOrders={setOrders} \/>/,
  `<AgentOrders orders={orders} setOrders={setOrders} timeFilterOverride={timeFilter} hideDropdown={true} />`
);

fs.writeFileSync('components/AgentSales.tsx', code);
