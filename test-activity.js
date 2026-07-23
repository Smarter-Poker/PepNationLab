const http = require('http');
fetch('http://localhost:3000/api/agent/activity').then(r => r.text()).then(console.log).catch(console.error);
