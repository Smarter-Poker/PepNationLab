#!/usr/bin/env node
/**
 * payment-confirmation-guard - build-blocking invariants for the per-order
 * payment confirmation chain (buyer sent -> agent received -> upline
 * received, 12-hour reminders, ship gate).
 *
 * WHY THIS EXISTS. This system regressed twice in one day before it was
 * finished: two different confirmations shared one column (whichever fired
 * first 409-blocked the other forever), and the agent's confirm button was
 * gated to a status most orders never pass through - so every live order sat
 * approved with no confirmation recorded. Both were single-line edits any
 * well-meaning refactor could reintroduce. This guard runs as part of
 * `prebuild`, so a build that breaks an invariant does not ship.
 *
 * Style mirror of checkout-diluent-guard.mjs: read files, match patterns,
 * fail loudly with an explanation of WHY the invariant matters.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const MARK_PAID = 'app/api/agent/orders/mark-paid/route.ts';
const CONFIRM_DOWNLINE = 'app/api/agent/orders/confirm-downline-payment/route.ts';
const PAYMENT_SENT = 'app/api/researcher/orders/payment-sent/route.ts';
const APPROVE = 'app/api/agent/orders/approve/route.ts';
const REMINDER_CRON = 'app/api/cron/payment-confirmations/route.ts';
const HEALTH_CRON = 'app/api/cron/payment-confirmation-health/route.ts';
const AGENT_ORDERS = 'components/AgentOrders.tsx';
const DASH_PAGE = 'app/dashboard/agent/page.tsx';
const BUYER_PAGE = 'app/orders/[id]/page.tsx';
const VERCEL = 'vercel.json';
const MIGRATIONS_DIR = 'supabase/migrations';

const failures = [];
const fail = (title, why) => failures.push({ title, why });

const read = (p) => {
  if (!existsSync(p)) {
    fail(`${p} is MISSING`, 'This file is part of the payment confirmation chain. It must exist.');
    return null;
  }
  return readFileSync(p, 'utf8');
};

// ---- 1. The three confirmations write THREE DIFFERENT columns ------------
const markPaid = read(MARK_PAID);
if (markPaid) {
  if (!markPaid.includes('payment_confirmed_at: nowIso')) {
    fail('mark-paid no longer stamps payment_confirmed_at',
      'This is the agent\'s "I Received Payment" confirmation. The ship gate,\n' +
      'the reminder loop, and the health canary all key off this column.');
  }
  if (!markPaid.includes(".is('payment_confirmed_at', null)")) {
    fail('mark-paid lost its compare-and-swap on payment_confirmed_at',
      'Two concurrent confirms (agent on two devices, agent + upline) must not\n' +
      'both win and double-notify. Keep the .is(..., null) CAS guard.');
  }
  if (markPaid.includes('upline_payment_confirmed_at:')) {
    fail('mark-paid writes upline_payment_confirmed_at',
      'That column belongs to confirm-downline-payment. Sharing one column\n' +
      'between two confirmations is exactly the collision this chain fixed:\n' +
      'whichever fired first blocked the other forever.');
  }
}

const confirmDownline = read(CONFIRM_DOWNLINE);
if (confirmDownline) {
  if (!confirmDownline.includes('upline_payment_confirmed_at: nowIso')) {
    fail('confirm-downline-payment no longer stamps upline_payment_confirmed_at',
      'The upline settlement acknowledgment must live in its OWN column.');
  }
  if (!confirmDownline.includes(".is('upline_payment_confirmed_at', null)")) {
    fail('confirm-downline-payment lost its compare-and-swap',
      'First caller wins; keep the .is(..., null) CAS guard.');
  }
  if (/update\(\{\s*payment_confirmed_at/.test(confirmDownline)) {
    fail('confirm-downline-payment writes payment_confirmed_at again',
      'THE column collision. payment_confirmed_at means "agent received the\n' +
      'BUYER\'s payment"; the upline acknowledgment is a different fact.');
  }
}

const paymentSent = read(PAYMENT_SENT);
if (paymentSent) {
  if (!paymentSent.includes('buyer_payment_sent_at: nowIso')) {
    fail('payment-sent no longer stamps buyer_payment_sent_at',
      'The buyer\'s "I Sent Payment" confirmation drives the agent nudge and\n' +
      'stops the buyer\'s reminders.');
  }
  if (!paymentSent.includes(".is('buyer_payment_sent_at', null)")) {
    fail('payment-sent lost its compare-and-swap', 'Double-tap safety.');
  }
}

// ---- 2. The ship gate exists in the route AND the database ---------------
const approve = read(APPROVE);
if (approve) {
  // The literal 'payment_confirmation_required' also appears in the DB-error
  // mapping, so checking for it alone could not fail when the route-level
  // gate was deleted. Anchor on the gate block itself.
  if (!approve.includes('PAYMENT-BEFORE-SHIPMENT GATE')) {
    fail('approve route lost the payment-before-shipment gate block',
      'A ship order whose buyer pays per order must not reach approved_ship\n' +
      'unconfirmed. The route-level gate (marked PAYMENT-BEFORE-SHIPMENT\n' +
      'GATE) must run before the status CAS.');
  }
  if (!approve.includes("code: 'payment_confirmation_required'")) {
    fail('approve route no longer returns the payment_confirmation_required code',
      'The UI and callers key off this code to show the confirm-first message.');
  }
}
let triggerFound = false;
if (existsSync(MIGRATIONS_DIR)) {
  for (const f of readdirSync(MIGRATIONS_DIR)) {
    if (!f.endsWith('.sql')) continue;
    const sql = readFileSync(`${MIGRATIONS_DIR}/${f}`, 'utf8');
    if (sql.includes('enforce_payment_confirmation_before_ship')) { triggerFound = true; break; }
  }
}
if (!triggerFound) {
  fail('DB ship-gate trigger migration is missing',
    'enforce_payment_confirmation_before_ship is the defense-in-depth layer\n' +
    'that catches every OTHER path into approved_ship (admin release, bulk\n' +
    'updates, future routes). Its migration must stay in the repo.');
}

// ---- 3. The 12-hour reminder loop is wired and per-role ------------------
const cron = read(REMINDER_CRON);
if (cron) {
  for (const clock of ['buyer_sent_reminder_at', 'agent_received_reminder_at', 'upline_received_reminder_at']) {
    // The clock must be WRITTEN (claimed), not merely selected - the names
    // all appear in the SELECT string, so an includes() check could never
    // fail even with every reminder update deleted.
    if (!new RegExp('update\\(\\{ ' + clock + ': nowIso \\}\\)').test(cron)) {
      fail(`payment-confirmations cron no longer CLAIMS the ${clock} clock`,
        'Each nudge must claim its per-role clock with a conditional update\n' +
        'BEFORE notifying, or a crashed run double-sends and roles collide.');
    }
  }
  if (!cron.includes('sendPaymentActionReminderEmail')) {
    fail('payment-confirmations cron lost its email fallback',
      'Most staff accounts have no push device (see /admin/push-health);\n' +
      'without the email fallback the loop is invisible to them.');
  }
}
const health = read(HEALTH_CRON);
if (health) {
  if (!health.includes("job_name', 'payment_confirmations")) {
    fail('health cron no longer checks reminder-loop liveness',
      'If the reminder cron dies silently, this is the only alarm.');
  }
  if (!health.includes('notifyAdmins')) {
    fail('health cron no longer alerts admins', 'A watchdog that tells no one is not a watchdog.');
  }
}

const vercel = read(VERCEL);
if (vercel) {
  if (!vercel.includes('/api/cron/payment-confirmations')) {
    fail('vercel.json no longer schedules /api/cron/payment-confirmations',
      'Without the schedule the 12-hour loop never fires and every\n' +
      'unconfirmed order goes silent.');
  }
  if (!vercel.includes('/api/cron/payment-confirmation-health')) {
    fail('vercel.json no longer schedules /api/cron/payment-confirmation-health',
      'The runtime watchdog (gate bypasses, cron liveness, stuck orders)\n' +
      'must fire daily.');
  }
}

// ---- 4. The UI can actually answer the questions --------------------------
const agentOrders = read(AGENT_ORDERS);
if (agentOrders) {
  if (!agentOrders.includes('handleMarkPaid')) {
    fail('AgentOrders lost handleMarkPaid', 'The agent must be able to answer "Did You Receive Payment?".');
  }
  if (!agentOrders.includes('handleConfirmDownlinePayment')) {
    fail('AgentOrders lost handleConfirmDownlinePayment',
      'The upline must be able to confirm a prepaid downline\'s settlement\n' +
      'right on the order (the notification deep-links here).');
  }
  if (!/Did You Receive Payment/.test(agentOrders)) {
    fail('AgentOrders lost the "Did You Receive Payment" prompt', 'The question is the product.');
  }
}
const dashPage = read(DASH_PAGE);
if (dashPage) {
  for (const col of ['payment_confirmed_at', 'buyer_payment_sent_at', 'upline_payment_confirmed_at']) {
    if (!dashPage.includes(col)) {
      fail(`dashboard order query no longer selects ${col}`,
        'Without the column the buttons/badges silently never render - the\n' +
        'exact "button gated to a status nothing reaches" regression.');
    }
  }
}
const buyerPage = read(BUYER_PAGE);
if (buyerPage && !buyerPage.includes('ConfirmPaymentSentButton')) {
  fail('Buyer order page lost the "I Sent Payment" button',
    'The buyer\'s reminders deep-link to this page; without the button the\n' +
    'notification is a dead end.');
}

// ---- report ---------------------------------------------------------------
if (failures.length === 0) {
  console.log('payment-confirmation-guard: OK (confirmation chain invariants hold)');
  process.exit(0);
}
console.error('\n✖ payment-confirmation-guard FAILED - ' + failures.length + ' invariant(s) violated\n');
for (const f of failures) {
  console.error('  • ' + f.title);
  console.error('    ' + f.why.split('\n').join('\n    ') + '\n');
}
process.exit(1);
