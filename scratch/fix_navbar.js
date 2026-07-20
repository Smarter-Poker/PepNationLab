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

  // Fix the fragment issue if it was introduced
  if (content.includes('    <>\n      <Navbar />\n      <div')) {
    // If we added `<>`, we need to add `</>` at the end.
    // Replace `return (\n    <>\n      <Navbar />\n      <div` with `return (\n    <>\n      <Navbar />\n      <div`
    // Wait, let's just find the last `</div>\n  );\n}` and replace it with `</div>\n    </>\n  );\n}`
    
    // First, check if it's already fixed
    if (!content.includes('</>\n  );')) {
       content = content.replace(/<\/div>\n  \);\n}/, '</div>\n    </>\n  );\n}');
    }
  }

  // If it didn't match the fragment replacement, meaning the previous script didn't do anything because of regex failure, we can manually do it.
  if (!content.includes('<Navbar')) {
     // match `return (\n    <div`
     content = content.replace(/return \(\s*<div/, "return (\n    <>\n      <Navbar />\n      <div");
     content = content.replace(/<\/div>\s*\);\s*}/, "</div>\n    </>\n  );\n}");
  }

  fs.writeFileSync(file, content);
}
