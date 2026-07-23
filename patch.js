const fs = require('fs');
let content = fs.readFileSync('components/AgentResearcherCRMv2.tsx', 'utf8');

// Replace table view
content = content.replace(
  /<span style=\{\{ color: lastLogin \? '#B0B8C4' : '#EF4444', fontSize: '0\.75rem', fontStyle: lastLogin \? 'normal' : 'italic' \}\}>\s*\{daysAgo\(lastLogin\)\}\s*<\/span>/,
  `<span style={{ color: lastLogin ? '#B0B8C4' : 'var(--grey-500)', fontSize: '0.75rem', fontStyle: lastLogin ? 'normal' : 'italic' }}>
          {lastLogin ? new Date(lastLogin).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never Logged In'}
        </span>`
);

// Replace detail grid view
content = content.replace(
  /\{ label: 'Last Login', value: daysAgo\(lastLogin\), warn: \!lastLogin \},/,
  `{ label: 'Last Login', value: lastLogin ? new Date(lastLogin).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never Logged In', warn: !lastLogin },`
);

// Replace the warn color in detail grid view (so 'Never Logged In' isn't red)
content = content.replace(
  /<div style=\{\{ fontSize: '0\.84rem', color: warn \? '#EF4444' : '#FFFFFF', fontWeight: 600 \}\}>\{value\}<\/div>/,
  `<div style={{ fontSize: '0.84rem', color: warn ? 'var(--grey-500)' : '#FFFFFF', fontWeight: 600, fontStyle: warn ? 'italic' : 'normal' }}>{value}</div>`
);

fs.writeFileSync('components/AgentResearcherCRMv2.tsx', content);
