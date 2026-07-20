const fs = require('fs');
const path = require('path');

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

  // Skip if already has Navbar
  if (!content.includes('Navbar')) {
    // 1. Add Navbar import
    if (!content.includes('import Navbar')) {
      content = content.replace(/(import .*;\n)(?!(import .*;\n))/, "$1import Navbar from '@/components/Navbar';\n");
    }

    // 2. Add Navbar to the main return
    content = content.replace(/return \(\s*<div([^>]*)>/, "return (\n    <div$1>\n      <Navbar />");
  }

  // 3. Add BackButton import and replace <Link> with BackButton
  if (!content.includes('import BackButton')) {
    content = content.replace(/(import .*;\n)(?!(import .*;\n))/, "$1import BackButton from '@/components/ui/BackButton';\n");
  }

  // Replace link
  content = content.replace(/<Link href="[^"]*"[^>]*>\s*(.*?Back.*?)\s*<\/Link>/is, (match, label) => {
    // clean up label (remove &larr; or arrow icons)
    const cleanLabel = label.replace(/<ArrowLeft[^>]*>|&larr;|←/g, '').trim();
    return `<BackButton label="${cleanLabel}" />`;
  });

  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
}
