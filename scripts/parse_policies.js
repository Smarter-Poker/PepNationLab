const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

const policies = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  // Very rough parsing
  const regex = /CREATE POLICY\s+"?([^"]+)"?\s+ON\s+([a-zA-Z0-9_\.]+)(?:\s+AS\s+(PERMISSIVE|RESTRICTIVE))?\s+FOR\s+(SELECT|INSERT|UPDATE|DELETE|ALL)(?:\s+TO\s+([^W]+))?/gi;
  let match;
  while ((match = regex.exec(content)) !== null) {
    policies.push({
      file,
      name: match[1],
      table: match[2].toLowerCase().replace('public.', ''),
      type: match[3] ? match[3].toUpperCase() : 'PERMISSIVE', // default is PERMISSIVE
      command: match[4].toUpperCase(),
      roles: match[5] ? match[5].trim().split(/\s*,\s*/) : ['public']
    });
  }
}

const map = {};
for (const p of policies) {
  if (p.type !== 'PERMISSIVE') continue;
  for (const role of p.roles) {
    // extract role name up to space or newline or USING/WITH CHECK
    const cleanRole = role.split(/\s+(USING|WITH CHECK)/i)[0].trim().toLowerCase();
    const key = `${p.table} - ${p.command} - ${cleanRole}`;
    if (!map[key]) map[key] = [];
    map[key].push(p.name);
  }
}

for (const key in map) {
  if (map[key].length > 1) {
    console.log(`Multiple permissive policies on ${key}: ${map[key].join(', ')}`);
  }
}
