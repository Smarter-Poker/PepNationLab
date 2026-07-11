#!/usr/bin/env node
/**
 * One-shot apply script (removed by its workflow in the same commit).
 *
 * Patches the two large files that cannot safely ship through the contents
 * API: components/OnboardingWizard.tsx (adds the PaymentStep, BillingStep,
 * ShareStep, and ComplianceStep components plus their routing) and
 * components/AgentInventory.tsx (credit-wall action on blocked restocks).
 *
 * Every replacement asserts its anchor appears exactly the expected number
 * of times, and the final files must hash to the git blob shas of the
 * locally tsc-verified results. Any mismatch aborts before commit.
 */
const fs = require('fs');
const { execSync } = require('child_process');

function repFile(file, reps) {
  let s = fs.readFileSync(file, 'utf8');
  for (const [from, to, expected] of reps) {
    const parts = s.split(from);
    if (parts.length - 1 !== expected) {
      console.error('ASSERTION FAILED in ' + file + ' (' + (parts.length - 1) + ' vs ' + expected + '): ' + JSON.stringify(from.slice(0, 80)));
      process.exit(1);
    }
    s = parts.join(to);
    console.log('OK ' + file + ': ' + JSON.stringify(from.slice(0, 60)));
  }
  fs.writeFileSync(file, s);
}

// The four new wizard step components, staged as plain text alongside this
// script so no YAML/JS quoting can mangle them.
const BLOCK = fs.readFileSync('scripts/onboarding-apply/wizard-block.txt', 'utf8');
const INFOROW_ANCHOR = 'function InfoRow({ icon: Icon, title, body }';

repFile('components/OnboardingWizard.tsx', [
  [
    "  CreditCard, Package, Wallet, ExternalLink,\n} from 'lucide-react';\nimport { isWebPushSupported, enablePush, notificationPermission } from '@/lib/push-client';",
    "  CreditCard, Package, Wallet, ExternalLink, QrCode, Copy,\n} from 'lucide-react';\nimport { isWebPushSupported, enablePush, notificationPermission } from '@/lib/push-client';\nimport QRCodeGenerator from '@/components/QRCodeGenerator';",
    1,
  ],
  [
    "  parent: { name: string | null; slug: string | null; commission_pct: number | null } | null;\n  progress: Record<string, unknown>;\n}",
    "  parent: { name: string | null; slug: string | null; commission_pct: number | null } | null;\n  billing?: { account_type: 'credit' | 'prepaid' | null; credit_limit: number; prepaid_balance: number } | null;\n  progress: Record<string, unknown>;\n}",
    1,
  ],
  [
    "      {currentKey === 'storefront' && <StorefrontStep state={state} onDone={completeStepAndAdvance} />}\n",
    "      {currentKey === 'storefront' && <StorefrontStep state={state} onDone={completeStepAndAdvance} />}\n      {currentKey === 'payment' && <PaymentStep onDone={completeStepAndAdvance} />}\n",
    1,
  ],
  [
    "      {currentKey === 'downstream' && <DownstreamStep state={state} onDone={completeStepAndAdvance} />}\n",
    "      {currentKey === 'downstream' && <DownstreamStep state={state} onDone={completeStepAndAdvance} />}\n      {currentKey === 'billing' && <BillingStep state={state} onDone={completeStepAndAdvance} />}\n      {currentKey === 'share' && <ShareStep state={state} onDone={completeStepAndAdvance} />}\n      {currentKey === 'compliance' && <ComplianceStep onDone={completeStepAndAdvance} />}\n",
    1,
  ],
  [INFOROW_ANCHOR, BLOCK + INFOROW_ANCHOR, 1],
]);

repFile('components/AgentInventory.tsx', [
  [
    "import { createClient } from '@/lib/supabase/client';",
    "import { createClient } from '@/lib/supabase/client';\nimport CreditWallAction from '@/components/wallet/CreditWallAction';",
    1,
  ],
  [
    "              {restockStatus && (\n                <p style={{ marginTop: 'var(--space-3)', fontSize: '0.85rem', color: restockStatus.includes('Error') ? '#FFAAAA' : '#00E5FF' }}>\n                  {restockStatus}\n                </p>\n              )}",
    "              {restockStatus && (\n                <p style={{ marginTop: 'var(--space-3)', fontSize: '0.85rem', color: restockStatus.includes('Error') ? '#FFAAAA' : '#00E5FF' }}>\n                  {restockStatus}\n                </p>\n              )}\n              {restockStatus.includes('Credit Limit') && <CreditWallAction />}",
    1,
  ],
]);

// Final byte-exactness gate: the applied files must hash to the blobs of the
// locally tsc-verified (tsc --noEmit clean) results. Any drift aborts.
const EXPECTED = {
  'components/OnboardingWizard.tsx': '147f74e3313ab0960079a6bdaa5ef0223fc79846',
  'components/AgentInventory.tsx': '8989842753a6bcef3678ed290fed4c0971f0f14e',
};
for (const [file, want] of Object.entries(EXPECTED)) {
  const got = execSync('git hash-object ' + file).toString().trim();
  if (got !== want) {
    console.error('SHA MISMATCH ' + file + ': ' + got + ' != ' + want);
    process.exit(1);
  }
  console.log('SHA OK ' + file + ' ' + got);
}
console.log('Done.');
