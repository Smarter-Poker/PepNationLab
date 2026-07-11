#!/usr/bin/env node
/**
 * One-shot apply script (removed by its workflow in the same commit).
 *
 * Integrates the OrderStageTimeline component (B3, already on main) into the
 * two large order-display files that cannot safely ship through the contents
 * API: app/orders/[id]/page.tsx (researcher order detail) and
 * components/AgentOrders.tsx (agent order detail modal).
 *
 * Safety gates, in order:
 *   1. Baseline git blob shas: both target files plus the already-pushed
 *      OrderStageTimeline.tsx must match the exact revisions this patch was
 *      authored and tsc-verified against. Any concurrent drift aborts.
 *   2. Every replacement asserts its anchor appears exactly once.
 *   3. Final git blob shas must equal the locally tsc --noEmit verified
 *      results. Any mismatch aborts before commit.
 */
const fs = require('fs');
const { execSync } = require('child_process');

function blobSha(file) {
  return execSync('git hash-object ' + JSON.stringify(file)).toString().trim();
}

function assertSha(file, want, label) {
  const got = blobSha(file);
  if (got !== want) {
    console.error(label + ' SHA MISMATCH ' + file + ': ' + got + ' != ' + want);
    process.exit(1);
  }
  console.log(label + ' SHA OK ' + file + ' ' + got);
}

function repFile(file, reps) {
  let s = fs.readFileSync(file, 'utf8');
  for (const [from, to] of reps) {
    const parts = s.split(from);
    if (parts.length - 1 !== 1) {
      console.error('ASSERTION FAILED in ' + file + ' (' + (parts.length - 1) + ' occurrences, expected 1): ' + JSON.stringify(from.slice(0, 90)));
      process.exit(1);
    }
    s = parts.join(to);
    console.log('OK ' + file + ': ' + JSON.stringify(from.slice(0, 60)));
  }
  fs.writeFileSync(file, s);
}

// 1. Baselines - the exact revisions this patch was authored against.
assertSha('components/OrderStageTimeline.tsx', 'f4dded99f5292b3ab426b158100695cbdd076c67', 'BASELINE');
assertSha('app/orders/[id]/page.tsx', '83c36ecefbbfeb376c7597e7b6e205f9c3d97766', 'BASELINE');
assertSha('components/AgentOrders.tsx', 'b24007e942693ea346a834ac688305c9303b1d36', 'BASELINE');

// 2. Researcher order detail page.
repFile('app/orders/[id]/page.tsx', [
  [
    `import OrderTrackingTimeline, { type TrackingEvent } from '@/components/OrderTrackingTimeline';\n`,
    `import OrderTrackingTimeline, { type TrackingEvent } from '@/components/OrderTrackingTimeline';\nimport OrderStageTimeline from '@/components/OrderStageTimeline';\n`,
  ],
  [
    `  tracking_number: string | null;\n  label_url: string | null;\n  shipping_address: any;\n`,
    `  tracking_number: string | null;\n  label_url: string | null;\n  shipped_at: string | null;\n  delivered_at: string | null;\n  updated_at: string | null;\n  shipping_address: any;\n`,
  ],
  [
    `      tracking_number, label_url, shipping_address, agent_id, buyer_id,\n`,
    `      tracking_number, label_url, shipped_at, delivered_at, updated_at, shipping_address, agent_id, buyer_id,\n`,
  ],
  [
    `          {/* Buyer + Shipping */}\n`,
    `          {/* Order Progress Timeline (B3): status enum mapped to human stages */}\n          <div className="glass-panel hover-lift stagger-fade-in" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-5)', animationDelay: '0.05s' }}>\n            <h2 style={{ fontSize: '0.95rem', color: 'var(--silver)', marginBottom: 'var(--space-4)' }}>\n              Order Progress\n            </h2>\n            <OrderStageTimeline\n              status={order.status}\n              fulfillmentMethod={order.fulfillment_method}\n              trackingNumber={order.tracking_number}\n              createdAt={order.created_at}\n              shippedAt={order.shipped_at}\n              deliveredAt={order.delivered_at}\n              updatedAt={order.updated_at}\n            />\n          </div>\n\n          {/* Buyer + Shipping */}\n`,
  ],
]);

// 3. Agent order detail modal.
repFile('components/AgentOrders.tsx', [
  [
    `import IframeModal from '@/components/ui/IframeModal';\n`,
    `import IframeModal from '@/components/ui/IframeModal';\nimport OrderStageTimeline from '@/components/OrderStageTimeline';\n`,
  ],
  [
    `                {STATUS_LABEL[detailOrder.status] || detailOrder.status.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}\n              </span>\n            </div>\n\n`,
    `                {STATUS_LABEL[detailOrder.status] || detailOrder.status.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}\n              </span>\n            </div>\n\n            {/* Order Progress Timeline (B3) */}\n            <div\n              style={{\n                marginBottom: 'var(--space-6)',\n                padding: 'var(--space-5)',\n                background: 'rgba(0,0,0,0.2)',\n                border: '1px solid rgba(255,255,255,0.05)',\n                borderRadius: '16px',\n              }}\n            >\n              <OrderStageTimeline\n                status={detailOrder.status}\n                fulfillmentMethod={detailOrder.fulfillment_method}\n                trackingNumber={detailOrder.tracking_number}\n                createdAt={detailOrder.created_at}\n              />\n            </div>\n\n`,
  ],
]);

// 4. Final byte-exactness gate: results must hash to the blobs of the
//    locally tsc --noEmit verified files.
assertSha('app/orders/[id]/page.tsx', '6ad9b1da72c24e27f6a1196d9681eedacfff2052', 'RESULT');
assertSha('components/AgentOrders.tsx', '64da7fcdaf4da67e30f2efa8444e1389f61edf0c', 'RESULT');
console.log('Done.');
