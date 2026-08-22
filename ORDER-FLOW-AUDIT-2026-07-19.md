# Order Processing & Notification Deep-Dive Audit — 2026-07-19

Scope: full line-by-line review of the order lifecycle — checkout (`/api/orders`, 1,663 lines), payment confirmation (`payment-proof`, `mark-paid`, `update-payment`), approval chain (`/api/agent/orders/approve`, `/api/admin/orders`), fulfillment/shipping (`shipping-webhook`, label flow), all notification infrastructure (`lib/notify.ts`, `lib/push-enqueue.ts`, `lib/email.ts`), every order-related cron, and the production database.

---

## PART 1 — HOW AN ORDER FLOWS TODAY

### Stage 1: Checkout (`POST /api/orders`)

The pipeline, in order: CSRF check → auth → rate limit (10 orders/min/user) → idempotency replay check → load buyer profile → resolve agent-of-record + super-agent (+ manufacturer store rules) → translate cart IDs → product validity/ban checks → local-vs-China fulfillment split per line → closed-loop catalog guard → storefront min-qty rules → pricing (one parallel batch: tiers, flash sale, overrides, custom retail, super-agent baselines, effective markup) → bundle/stack pricing → **atomic inventory reservation** (`reserve_inventory` RPC) → best-deal discount selection (coupon vs flash vs quantity — never stack) → live EasyPost shipping quote with flat-table fallback → velocity cap check → disclaimer gate (Layer 3 must exist, Layer 4 inserted) → **status determination** → order + order_items insert → manufacturer ledger → credit-line charge / prepaid deduction → label job enqueue → sub-agent commission accrual → abandoned-cart attribution → notifications → confirmation email.

Initial status lands in one of three places:

- `pending_customer_payment` — the default retail path (peer-to-peer payment model)
- `agent_approval_pending` — credit-eligible but needs a human in the chain, or manufacturer store
- `approved_ship` / `approved_pickup` — auto-approved on credit/prepaid within `max_auto_approve_limit`

The compensation engineering here is genuinely strong: hoisted `compensateOnThrow`, staged rollback closures (`releaseReservedInventory` → `rollbackPreOrder` → `compensateFailedAttempt`), idempotency-key race handling on the insert, and demotion to manual approval when a credit charge fails. This part of the codebase is in good shape.

### Stage 2: Payment confirmation (the P2P loop)

1. Buyer sees the agent's `payment_handles` (Zelle/CashApp/Venmo/etc.) on `/orders/[id]` and pays off-platform.
2. Buyer optionally uploads proof → `POST /api/researcher/payment-proof` → stored in `payment-proofs` bucket → messenger message to the agent + in-app notifications to agent **and** super-agent (or all admins for house orders).
3. Agent hits **Mark Paid** (`/api/agent/orders/mark-paid`) → status flips to `agent_approval_pending` → a single messenger message goes to the buyer.
4. Agent hits **Approve** (`/api/agent/orders/approve`) → inventory check, billing-chain check, atomic compare-and-swap claim, prepaid deduction or credit-line charge → `approved_*` (credit) or `admin_approval_pending` (prepaid) → in-app notification to **all admins**.
5. Admin releases via `/api/admin/orders` → buyer gets in-app + push; email only on shipped/delivered.
6. Label purchased manually → `notifyOrderShipped`; EasyPost webhook marks delivered → push + email to buyer.
7. A daily cron (`cancel-stale-pending`, 03:45 UTC) cancels `pending_customer_payment` orders older than 72h.

---

## PART 2 — THE NOTIFICATION MATRIX (what actually fires today)

| Event | Buyer | Agent | Super-Agent | Admin |
|---|---|---|---|---|
| Order placed | in-app + push + email* | in-app + push | **nothing** | **nothing** |
| Coupon redeemed | — | in-app + push | — | — |
| Payment proof uploaded | — | messenger + in-app | in-app | in-app (house orders only) |
| Agent marks paid | messenger msg only | — | **nothing** | **nothing** |
| Agent approves | **nothing** | — | **nothing** | in-app (all admins) |
| Sub-agent forwards for super approval | — | — | **nothing** | — |
| Admin approves/ships/delivers | in-app + push (+email on ship/deliver*) | **nothing** | — | — |
| Agent cancels order | **nothing** | — | — | — |
| Admin cancels order | in-app | **nothing** | — | — |
| 72h stale-payment auto-cancel | **nothing** | **nothing** | **nothing** | **nothing** |
| Delivered (webhook) | push + email* | — | — | — |
| Commission accrued | — | **never fires** | **never fires** | — |

\* Email only to a **verified** `contact_email`.

### Production reality check (live DB, ydsaqnnuwyvtyxgvrnys)

- 37 agent/super-agent accounts — **only 2 have a verified contact email**. Email as a sale-alert channel effectively reaches nobody today.
- 11 users have push enabled, 16 active push subscriptions. Push requires the user to have granted browser permission; `enqueuePush` **silently drops** when no `notification_preferences` row exists.
- Net effect: for most agents, the only reliable sale alert is the in-app bell — they find out about sales when they happen to open the dashboard.
- 25 orders in the last 30 days; push_outbox: 97 sent, 23 skipped.

### Dead code that proves the gaps

These are fully built and **never called from anywhere**:

- `notifyOrderApproved()` (lib/notify.ts:143) — buyer never told their order was approved by an agent
- `notifyOrderDelivered()`, `notifyOrderCancelled()` — unused (partially covered by other paths)
- `notifyCommissionEarned()`, `notifyCommissionPayout()` — commissions accrue in total silence
- `sendOrderApprovedEmail()` (lib/email.ts:627) — written, templated, never wired
- `sendOrderCancelledEmail()` (lib/email.ts:666) — same
- `payment_reminder` push event + notification type — infrastructure exists, **no cron ever sends one** (`/api/cron/reminders` is a deprecated no-op stub)

---

## PART 3 — EVERY GAP FOUND (ranked)

### P0 — Notification correctness (people are missing money-relevant events)

**1. Admins are blind until an agent approves.** No notification fires to any admin when an order is placed anywhere on the platform. If an agent is slow to act, the admin never knows the order exists. First admin touchpoint is `approve/route.ts:301-320`.

**2. Super-agents never see downline sales.** A researcher order through a sub-agent or child agent generates zero notification to the super-agent whose credit line ultimately backs it. Their only signal is the payment-proof event. `orders/route.ts:1556-1579` notifies `agentProfile.id` only.

**3. "Mark Paid" — the payment confirmation moment — is nearly silent.** `mark-paid/route.ts` sends one messenger message to the buyer and nothing else: no in-app/push/email to the buyer, nothing to super-agent or admin, no `payment_confirmed_at`/`confirmed_by` stamp on the order, and no link to the `payment_proofs.verified_at`/`verified_by` columns that exist for exactly this purpose. Worse, the message tells the buyer their order "Has Been Submitted To Fulfillment" when it has actually moved to `agent_approval_pending` — still awaiting approval.

**4. Buyer never notified when an agent approves.** The entire approve route notifies only admins. `notifyOrderApproved` + `sendOrderApprovedEmail` exist and just need wiring. (The buyer IS notified when an *admin* drives the transition — inconsistent.)

**5. Silent cancellations.**
- Agent-cancel path (`approve/route.ts:59-82`): buyer gets nothing.
- Stale-payment sweep (`cancel_stale_pending_orders`): confirmed zero notification inserts in the RPC. A buyer's order vanishes 72h after checkout with no warning before, and no notice after. The agent loses the sale silently too.

**6. Sub-agent → super-agent approval handoff is silent.** When `finalStatus` collapses to `agent_approval_pending` for the parent (`approve/route.ts:85-94`), the super-agent is never told an order is waiting in their queue. Orders can sit indefinitely.

**7. No payment reminders at all.** Between "order placed" and "silently cancelled at 72h" the buyer receives zero nudges. The `payment_reminder` event type, push template, and cron slot (daily 12:00 UTC, currently a no-op) all already exist.

### P1 — Channel coverage (alerts exist but don't reach people)

**8. Agents get no email on a sale**, and only 2/37 agents could receive one anyway. Two fixes: (a) add a sale-notification email using the existing `sendEmail` infra, (b) fall back to the **auth email** (`user.email` — already verified by OAuth/magic-link) instead of requiring the separate `contact_email` + verification loop, at minimum for agents.

**9. Push is default-deny.** No `notification_preferences` row → `enqueuePush` returns null silently. A prefs row is only created when the user subscribes to browser push. Consider seeding a prefs row at signup and pushing agents through push-enable during onboarding (it's their cash register bell).

**10. No SMS channel.** `lib/sms-enqueue.ts` is a tombstone ("no Twilio account"). For a 37-agent salesforce this is the highest-reach channel for "you just made a sale" — worth pricing out (Twilio ~$0.008/msg; at current volume that's pennies/month).

**11. No admin daily digest.** No aggregated "yesterday: N orders, $X GMV, M pending approval, K pending payment" email exists anywhere. All the queries already exist in the analytics routes.

### P2 — Process & code streamlining

**12. Dead label queue call.** `orders/route.ts:1489` still calls `shipping_enqueue_label_job` on auto-approved ship orders, but the label-jobs cron is retired (410 stub — "labels are manual/synchronous only"). Rows queue into a table nothing drains. Remove the call, or reinstate the worker if you want auto-labels back.

**13. Checkout monolith + sequential round trips.** ~10 sequential DB round trips happen before the parallel pricing batch (profile → agent → super-agent → agent_config → cart-ID resolution → products → inventory → visibility → slug fallback...). Collapsing profile/agent/super/config into one RPC or view would cut checkout latency meaningfully. Longer term, a `place_order` Postgres function would make reserve+redeem+deduct+insert genuinely atomic and delete ~200 lines of hand-rolled compensation code.

**14. Post-insert side effects run inline.** Manufacturer ledger, SACA accrual, cart attribution, notifications all block the buyer's response. Only the email uses `after()`. Moving the whole post-commit block into `after()` (or an `order_events` outbox processed by cron) shaves user-perceived checkout time.

**15. No unified order timeline.** Status changes are scattered across `updated_at`, `agent_approved_at`, `delivered_at`, admin_audit_log, and messenger messages. An `order_events` table (order_id, event, actor, payload, created_at) would give you: a customer-facing timeline UI, one single place to hang notification fan-out, and an audit trail for disputes. This is the single highest-leverage structural improvement — notifications become "subscribe to events" instead of hand-placed calls in 9 routes.

**16. Duplicated `findOrCreateDirectConversation`.** Copy-pasted in `payment-proof/route.ts` and `mark-paid/route.ts`. Extract to `lib/messenger/`.

**17. `notify()` and `enqueuePush()` overlap.** `notify()` re-implements push gating + outbox insert with a *different* row shape (no `event`, no `related_order_id`) than `enqueuePush`. Checkout calls both for the same event, double-fetching prefs and double-writing outbox-ish rows. Have `notify()` delegate to `enqueuePush()`.

**18. Admin orders list does search in memory.** `admin/orders/route.ts` pulls up to 5,000 rows then filters/searches in JS. Fine today at 25 orders/mo; push `ilike` filters into SQL before it isn't.

**19. Pending-payment email lacks the payment handle.** The confirmation email says which *method* to use but not the agent's actual Zelle/Venmo handle or a suggested memo (short order ID). The buyer must return to the site to find out where to send money — friction at the exact moment you want zero friction. Include handle + amount + "put #SHORTID in the memo."

**20. Mark-paid records no evidence.** No amount-vs-total confirmation, no `verified_by` stamp, no linkage to the uploaded proof. For a P2P platform, "who confirmed which payment when" is your dispute-resolution backbone.

---

## PART 4 — RECOMMENDED BUILD ORDER

**Phase 1 — wire what's already built (hours, not days):**
1. Call `notifyOrderApproved` + `enqueueOrderPush('order_approved')` + `sendOrderApprovedEmail` from the agent approve route.
2. Mark-paid: buyer in-app + push + email ("Payment Confirmed — $X for #SHORT"), notify super-agent + admins, stamp `payment_confirmed_at`/`confirmed_by`, fix the misleading "submitted to fulfillment" copy.
3. Add admin + super-agent fan-out to the checkout notification block (3 more `notificationTasks.push(...)` lines).
4. Notify buyer + agent on every cancel path (agent-cancel, and add inserts to the stale-pending sweep).
5. Notify the super-agent on the sub-agent approval handoff.

**Phase 2 — reach (1–2 days):**
6. Payment-reminder drip in the existing `reminders` cron slot: T+24h nudge, T+48h "cancels in 24h" warning. Attribute recovered orders like abandoned-cart does.
7. Agent sale email + auth-email fallback for agents; seed notification_preferences at signup; push-enable prompt in agent onboarding.
8. Admin daily digest (orders, GMV, stuck approvals, aging pending-payment).
9. Optional: Twilio SMS for agent sale alerts.

**Phase 3 — structure (a week, staged):**
10. `order_events` table + move all notification fan-out onto it.
11. Consolidate checkout's pre-pricing reads; move post-commit side effects into `after()`.
12. Remove dead `shipping_enqueue_label_job` call; extract shared conversation helper; merge `notify`/`enqueuePush`.
13. Longer term: `place_order` RPC for true atomicity.

---

*Everything in Phase 1 uses functions that already exist in the codebase — the templates, push plumbing, and notification types are all built; they're just not connected.*
