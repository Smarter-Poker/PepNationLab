const fs = require('fs');
let file = fs.readFileSync('app/api/agent/activity/route.ts', 'utf8');
file = file.replace(/generatedAt: new Date\(\)\.toISOString\(\),/g, 'generatedAt: new Date().toISOString(),\n    summary: { totalIn, totalOut, orderCount, alertCount },');
fs.writeFileSync('app/api/agent/activity/route.ts', file);
