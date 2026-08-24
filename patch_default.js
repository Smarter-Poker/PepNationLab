const fs = require('fs');

// Patch AgentSales.tsx
let sales = fs.readFileSync('components/AgentSales.tsx', 'utf8');
sales = sales.replace(/useState\('all'\)/g, "useState('7d')");
fs.writeFileSync('components/AgentSales.tsx', sales);

// Patch AgentOrders.tsx
let orders = fs.readFileSync('components/AgentOrders.tsx', 'utf8');
orders = orders.replace(/useState\('all'\)/g, "useState('7d')");
fs.writeFileSync('components/AgentOrders.tsx', orders);

