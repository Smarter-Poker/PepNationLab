const fs = require('fs');

const targetFiles = [
  'app/dashboard/agent/activity/page.tsx',
  'app/dashboard/agent/analytics/page.tsx',
  'app/dashboard/agent/broadcasts/page.tsx',
  'app/dashboard/agent/downline/page.tsx',
  'app/dashboard/agent/invitations/page.tsx',
  'app/dashboard/agent/invoices/page.tsx',
  'app/dashboard/agent/referrals/page.tsx',
  'app/dashboard/agent/sales-v2/page.tsx',
  'app/dashboard/agent/sales/page.tsx',
  'app/dashboard/agent/sub-agents/page.tsx'
];

for (const file of targetFiles) {
  let content = fs.readFileSync(file, 'utf8');

  if (!content.includes('<Navbar')) {
    content = content.replace(/return \(\s*(<div[^>]*>)/, "return (\n    <>\n      <Navbar />\n      $1");
    // Also we need to close the Fragment. But wait, we can just put it inside the existing div if it's a full page div.
    // Or just wrap in <>...</>.
    // A better way is to insert <Navbar /> right after the first `return (\n    <div` inside the default exported function.
  }

  fs.writeFileSync(file, content);
}
