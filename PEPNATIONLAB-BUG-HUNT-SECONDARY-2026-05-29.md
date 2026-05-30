# PepNationLab Secondary Bug Hunt

**Date:** 2026-05-29 (after first-pass `PEPNATIONLAB-BUG-HUNT-2026-05-29.md`)
**HEAD:** `a674041` (latest), prod aliased at `d0b8e131`
**Method:** Five fresh parallel analysts, each given a different lens, told to find what the first pass missed. ~570K tokens of analyst work.
**Scope:** Same 69 pages / 196 API routes / 89 components / 33 lib files / 65 migrations, but explored along orthogonal axes — state machines and concurrency, cross-role data contracts, error/observability, corner-input edge cases, DB integrity deep dive.

This is the second-pass deliverable. Every finding is NEW relative to the first pass — duplicates were eliminated. Items below are sorted by severity and cite exact file + line.

---

# TOP NEW P0 FINDINGS

The first pass surfaced the obvious surface bugs. These secondary findings are deeper, more dangerous, and were quietly hiding under "shipped" features.

## P0-NEW-1. 10X SUBSCRIPTION / WISHLIST / RECENTLY-VIEWED OVERCHARGE

**The most damaging bug in the codebase.** `agent_products.retail_price` is stored as a **10-pack price** (per migration `20260527000009_agent_products_triggers.sql:9` which computes `p.base_cost * 10`). The order creation route `POST /api/orders:184` correctly divides by 10 to display a per-vial price.

But the subscription cron, subscription create, wishlist, and recently-viewed paths consume `retail_price` raw — they do NOT divide by 10:

| File | Line | Symptom |
|---|---|---|
| `app/api/cron/subscriptions-process/route.ts` | 193 | Every auto-replenish run charges ~10x the price the buyer saw at checkout |
| `app/api/researcher/subscriptions/route.ts` | 174 | Subscription create writes 10x unit price into `items_snapshot.unit_retail_price` |
| `app/api/researcher/wishlist/route.ts` | 58 | Wishlist UI shows 10-pack price as per-vial |
| `app/api/researcher/recently-viewed/route.ts` | 58 | Same |

A researcher creates a $99 subscription thinking it's the retail price; the cron actually charges $990 every cycle. **Existing subscriptions in production are wrong.** Need to (a) centralize per-vial conversion in a `lib/pricing.ts#perVialPrice(ap)` helper, (b) backfill all `items_snapshot.unit_retail_price` rows, (c) pause subscriptions until re-authorized to the corrected price.

## P0-NEW-2. shipping_address JSON SHAPE DRIFT — RECEIPT PDF RENDERS BLANK ROWS

Three writers, three different shapes:

| Writer | Shape |
|---|---|
| `app/checkout/CheckoutForm.tsx:512-520` | `{ fullName, street, suite, city, state, zip, phone }` |
| `app/api/agent/orders/new/route.ts:86` | `{ street, city, state, zipCode, country }` (note `zipCode`, no full_name) |
| `cron/subscriptions-process` (via `saved_addresses`) | `{ full_name, street1, street2, city, state, zip, country }` |

The readers assume the canonical shape:
- `app/api/account/orders/[id]/receipt/route.ts:120-122` reads `shippingAddr.full_name`, `street1`, `street2`. **Every retail checkout receipt renders blank rows.**
- `app/orders/[id]/page.tsx:220` and downstream code dereferences `addr.street1`, `addr.city`, `addr.zip`. Blank rows on the order detail page.
- `lib/shippo.ts:77-80` and `lib/shippo-returns.ts:105-108` are the only readers that coalesce both shapes (`addr.street || addr.street1`, `addr.zipCode || addr.zip`). Everywhere else breaks silently.

Fix: normalize at the API edge inside `POST /api/orders` BEFORE insert — accept either shape, persist the canonical `full_name/street1/street2/city/state/zip/country/phone`.

## P0-NEW-3. INVENTORY TRIGGER SILENTLY SWALLOWS OVERSELLS

`supabase/migrations/20260528000007_update_inventory_trigger.sql:38` uses `GREATEST(0, stock_count - q)`. Two concurrent approvals when stock=1 both succeed and floor stock to 0. No error raised. Buyer expects the product; agent has nothing to ship.

Fix: replace with `UPDATE agent_inventory SET stock_count = stock_count - q WHERE agent_id=... AND product_id=... AND stock_count >= q` and `RAISE EXCEPTION 'insufficient_stock'` on `FOUND = false`.

## P0-NEW-4. INVENTORY TRIGGER DOUBLE-DECREMENTS ON STATE TRANSITION

`deduct_inventory_on_order_approval`:
- Guard 1: `IF NEW.status NOT IN ('approved_ship','approved_pickup','in_fulfillment') THEN RETURN NEW`
- Guard 2: `IF OLD.status = NEW.status THEN RETURN NEW`

But an order moving `approved_ship -> in_fulfillment` passes BOTH guards because the new status is still in the allowed set and the status DID change. **Inventory decrements a second time on the natural progression to fulfillment.**

Fix: add `orders.inventory_deducted_at TIMESTAMPTZ` column and short-circuit when set; or restrict the trigger to fire only when `OLD.status IN ('pending_customer_payment','agent_approval_pending')`.

## P0-NEW-5. balance_transactions, weekly_statements, statement_orders ARE NOT ACTUALLY APPEND-ONLY

CLAUDE.md and the audit migration claim these are append-only. Live `pg_policies` query shows otherwise:

- `balance_transactions` policy `"Admin full access to balance_transactions"` is `cmd='ALL'`. Admins can UPDATE and DELETE rows in the ledger.
- `weekly_statements` policy `"Admin can manage all statements"` is `cmd='ALL'`. Admin can DELETE a paid statement.
- `statement_orders` policy `"Admin can manage all statement orders"` is `cmd='ALL'`. Admin can decouple orders from statements after the fact.
- All three: **service role bypasses RLS** anyway. There is no `BEFORE UPDATE/DELETE` trigger raising `'append-only'`.

An admin (or anyone with the service role key via a compromised env var) can rewrite financial history silently. Fix: drop the `ALL` policies, replace with explicit `SELECT` + `INSERT` only; add `BEFORE UPDATE OR DELETE` triggers raising `'append-only'` so even the service role is blocked.

## P0-NEW-6. ZERO captureError CALLS IN 198 API ROUTES

`grep -rn 'captureError\|captureException' app/api lib` returns ZERO matches. Only `app/error.tsx:14` and `app/global-error.tsx:14` call `captureError` — i.e., only React render-time exceptions reach Sentry.

Every server crash, every cron failure, every webhook delivery failure, every silently-default-to-zero tax quote — invisible to Sentry. The platform is "healthy" in production because the monitoring is structurally absent.

The most damaging silent failures within this gap:
- `app/api/orders/route.ts:524` — tax quote failure defaults to `taxAmount=0` and continues. **State audit risk** ("we logged a warning and charged $0 tax").
- `app/api/orders/route.ts:705` — store credit redemption failure continues. Credit may be debited while order discount is missing.
- `app/api/admin/products/[id]/lots/[lotId]/coa/route.ts:78,152` — storage delete `.catch(() => null)`. Orphan paid bytes forever.
- `app/api/agent-invitations/redeem/route.ts:177,201,214` — profile upsert / storefront insert / mark-redeemed failure -> response still says success. **Token used, partial state.**
- Every cron's `finishCronRun('failed', message)` — no Sentry capture before the call.

Fix: add `import { captureError } from '@/lib/sentry'` to every catch block. Top priority: orders, agent/orders/*, cron/*, agent/shipping/purchase.

## P0-NEW-7. FILE UPLOADS ACCEPT SPOOFED MIME TYPES

All 5 upload routes read `file.type` directly from the multipart envelope (client-supplied):

- `app/api/researcher/payment-proof/route.ts:85`
- `app/api/researcher/tax-exemption/route.ts:73`
- `app/api/researcher/rma/[id]/upload/route.ts:64`
- `app/api/admin/products/[id]/lots/[lotId]/coa/route.ts:52`
- `app/api/admin/products/bulk-images/route.ts:80`

An executable with `Content-Type: image/png` bypasses every gate. No magic-byte sniffing.

Fix: read first 16 bytes, compare against declared MIME, reject mismatch. Use a small helper like `lib/file-type.ts`.

## P0-NEW-8. PRICING TIERS ACCEPT multiplier = 0 (FREE ORDERS)

`app/api/admin/pricing-tiers/route.ts:28` has no positive check. An admin who saves `multiplier=0` for tier_2 makes every order on that tier free. Same on `product_tier_overrides.custom_multiplier`.

Fix: server-side `z.number().positive()` and DB `CHECK (multiplier > 0)`.

## P0-NEW-9. BUNDLES ROUTE LACKS CSRF, OWNERSHIP CHECK, SIZE CAP — AND bundles_config IS NEVER READ BY STOREFRONT

`agent_profiles.bundles_config` is written by `/api/agent/bundles/route.ts:36, 83, 120` (no `assertSameOrigin`, no validation that `product_ids` exist on the writing agent's `agent_products`, no upper bound on bundle count). It is read **NOWHERE**: `grep -rn bundle app/[agentSlug]/ app/api/storefront app/api/orders app/api/cart` returns empty.

Task #29 "bundles end-to-end" is not actually wired. Agents author bundles that researchers never see and checkout never honors. Same dead-wiring pattern as `coupons.stacking_policy` flagged in the first pass.

Fix decision: either build the storefront read path (display bundles on `/[agentSlug]`, honor bundle pricing at checkout) or remove `/api/agent/bundles` and the related UI.

## P0-NEW-10. cancel_order RPC DOES NOT REJECT SHIPPED/DELIVERED

`supabase/migrations/20260529100001_refunds_store_credit.sql:142` — `cancel_order` accepts any `order_id` and writes `status='cancelled'`. It does NOT check current status before doing so. A buyer/agent who triggers cancel on an already-shipped order silently turns it into a cancelled order in DB, while the buyer still receives the package.

Fix: `IF v_order.status IN ('shipped','delivered','cancelled') THEN RAISE EXCEPTION` at the top of the RPC.

## P0-NEW-11. ADMIN AUDIT ROUTE 500s ON EVERY QUERY (DEEPER CONFIRMATION)

First pass found `app/admin/audit/page.tsx` selects nonexistent columns. Second pass confirms `app/api/admin/audit/route.ts:24` ALSO references the nonexistent `summary` column. Every query to the audit API throws 500 — not just empty rows. The viewer is fully broken at both server and client layers.

Fix: rewrite both to read `actor_id, action, entity_type, entity_id, changes, ip_address, user_agent, created_at`.

## P0-NEW-12. WEBHOOK + PUSH DISPATCH HAS NO FOR UPDATE SKIP LOCKED

`app/api/cron/webhooks-dispatch/route.ts` and `app/api/cron/push-dispatch/route.ts` claim pending rows via simple `SELECT ... LIMIT N` followed by per-row UPDATE. If two cron invocations overlap (Vercel retries on transient failure), both fetch the same rows and both attempt delivery — duplicate sends to partners and duplicate notifications to users.

Fix: claim batch atomically with `UPDATE webhook_deliveries SET status='dispatching' WHERE id IN (SELECT id FROM webhook_deliveries WHERE status='pending' AND next_attempt_at <= now() ORDER BY created_at LIMIT N FOR UPDATE SKIP LOCKED) RETURNING id`.

## P0-NEW-13. WEBHOOK ENDPOINTS NEVER AUTO-DISABLE

`webhook_endpoints.failure_count` increments forever. `lib/webhook-dispatch.ts` does NOT flip `is_active=false` after sustained failures. Dead receiver endpoints continue to receive retries indefinitely, consuming dispatcher budget.

Fix: `if (failure_count > 50) set is_active=false; insert admin_audit_log`.

## P0-NEW-14. SHIPPING ROLE IS SCOPE-BLIND ACROSS ALL AGENTS

First pass flagged shipping role missing CSRF + webhook fan-out. Secondary confirms: `app/api/shipping/orders/route.ts:30-49` queries `service.from('orders').in('status', [...])` across **all agents** with no scope check. Shipping role can mutate any agent's order tracking and status. Plus no `is_active` re-check, plus no `admin_audit_log` row.

## P0-NEW-15. SUPER-AGENT CANNOT VIEW OWN SUB-AGENT STOREFRONT

`app/api/auth/verify-agent-access/route.ts:56-58` only matches `profile.role === 'agent' && profile.parent_agent_id === agent.id`. Super-agents have `role='super_agent'` so the check fails. CLAUDE.md says super-agents have full downline visibility. Fix: `role IN ('agent','super_agent')`.

## P0-NEW-16. ILIKE WILDCARD INJECTION STILL ALIVE

First pass flagged the storefront search. Secondary confirms three additional sites:

- `app/api/messages/search/route.ts:16` — strips `[.,()]` but not `%` or `_`
- `app/api/admin/researchers/route.ts:24` — strips most punctuation but not `_`
- `app/api/admin/audit/route.ts:24` — no escaping (and references nonexistent column — see P0-NEW-11)

A search for `100%` matches every row containing `100`. A search for `a_b` matches every row containing `a<anything>b`. Centralize via `lib/sql.ts#escapeIlike`.

## P0-NEW-17. /api/health RETURNS 200 UNCONDITIONALLY

8-line handler with no DB check. Uptime monitors think the app is healthy when Supabase is gone. The richer check exists at `/api/status` but most monitoring stacks ping `/api/health`. Either delete `/api/health` or have it call a fast `select 1`.

## P0-NEW-18. MATERIALIZED VIEWS HAVE RLS OFF AND MAY BE ANON-READABLE

`product_copurchase_pairs`, `product_popular_60d`:
- RLS cannot be applied to matviews directly (`rls_enabled=false`).
- No explicit `REVOKE` from `anon`/`authenticated`, so default Supabase permissions apply.
- No `pg_cron` extension installed -> the refresh function exists but the scheduler binding may not be in place.

Anonymous scrapers can read full co-purchase pairs and 60-day popularity. Fix: `REVOKE SELECT ON product_copurchase_pairs, product_popular_60d FROM anon, authenticated; GRANT SELECT TO service_role`. Confirm the recommendations cron actually runs (or install pg_cron).

## P0-NEW-19. CSRF GAPS ON FOUR ADDITIONAL ROUTES

First pass listed ~46. Secondary found these were missed:

- `app/api/shipping/orders/route.ts` POST
- `app/api/agent/orders/approve/route.ts` POST
- `app/api/agent/orders/new/route.ts` POST
- `app/api/agent/shipping/purchase/route.ts` POST

All four are high-blast-radius (financial state mutations).

## P0-NEW-20. NULLABLE FK COLUMNS ON FINANCIAL TABLES

Live query confirmed:

- `orders.buyer_id` NULLable, `orders.agent_id` NULLable -> orphan orders silently lose attribution. Statements/commissions queries drop them.
- `order_items.product_id` NULLable, `order_items.agent_product_id` NULLable -> inventory deduction trigger short-circuits silently.

Backfill nulls then `ALTER COLUMN ... SET NOT NULL`.

---

# P1 NEW FINDINGS

## P1-NEW-1. SUBSCRIPTION SAFETY GAPS

- `cron/subscriptions-process` does not check `buyer.is_active` before placing an order. Deactivated researchers continue to receive auto-replenish orders.
- Subscription `shipping_address` is a JSONB snapshot, not an FK to `saved_addresses`. Deleting a saved address does NOT propagate. UI nowhere indicates "this address is a snapshot."
- `processOne` order_items insert failure leaves orphan order with `status='pending_customer_payment'` and non-zero `total`. The stale-pending sweeper eventually cancels but `weekly_statements` includes the $0-COGS in the meantime. Wrap order + items in a single RPC.
- `cadence_days` arithmetic uses wall-clock ms; DST boundary drifts by 1h. Use `date-fns-tz` for calendar-day cadence.

## P1-NEW-2. CART WIRING CAN CHECK OUT ON-VACATION AGENT

`POST /api/orders` does not check `agent.is_active` or any vacation toggle. A researcher with a stale cart can complete checkout against an agent who has paused their storefront.

## P1-NEW-3. COUPONS LACK SERVER-SIDE BOUNDS

- `discount_value` has no server check and no DB `CHECK` constraint. Direct POST with `value=999999, type='percent'` is accepted.
- Coupon `max_uses_per_user` is checked in `lib/coupons.ts:60` outside the atomic RPC; two checkouts in the same second by the same user race past.
- No `starts_at` column -> admins cannot pre-publish coupons. Once `is_active=true` the code is live regardless of intent.
- `coupons (agent_id, code)` is case-sensitive — admin can create `Welcome10` and `WELCOME10` as distinct coupons; lookup uses `UPPER`.

## P1-NEW-4. ORDER QUANTITY UNBOUNDED SERVER-SIDE

The DB `order_items_quantity_cap` CHECK (1–10000) was added in a recent hotfix migration. Server-side Zod schema in `POST /api/orders` does NOT enforce this — only the DB throws. The error response surfaces as a generic Postgres constraint message rather than a clean UX rejection.

## P1-NEW-5. ADMIN BULK ROUTE PARTIAL-FAILURE LEAVES HALF-DEBITED AGENTS

`/api/admin/orders/bulk/route.ts` runs balance debits sequentially with no transaction batching. A partial batch failure leaves N agents debited and M not. No rollback.

## P1-NEW-6. STATEMENT REGENERATE HAS TOCTOU

`lib/statements.ts` weekly statement math: between `compute(week)` and `persist(week)`, new orders can be approved and miss the statement. Statement regeneration overwrites existing rows but readers may see partial state mid-write. Wrap in single transaction or snapshot order IDs first.

## P1-NEW-7. NOTIFICATION CHAIN GAPS (PER TRANSITION)

Beyond first-pass shipping role + delivered/refund pushes:

| Transition | Missing |
|---|---|
| Order created | No agent push or in-app — agent doesn't know to approve |
| Admin cancel | Push map at `admin/orders/route.ts:130-137` has no `cancelled` entry — buyer silent |
| Admin refund | No push, no in-app — buyer silent |
| Admin store credit grant | Buyer never told |
| Statement marked paid | Agent never told their billing reconciled |
| Cart abandonment | In-app only; `PushEvent='marketing'` exists but is never invoked |
| Internal message send | `PushEvent='message'` enum exists but never invoked |
| Sub-agent revoke | Demoted user gets no notification |

## P1-NEW-8. ON DELETE CASCADE WIPES FINANCIAL HISTORY

Deleting a profile (which can happen via auth.users cascade) wipes:
- `balance_transactions.agent_id ... CASCADE`
- `agent_commissions.agent_id ... CASCADE` + `order_id ... CASCADE`
- `super_agent_pricing.super_agent_id ... CASCADE`
- `sub_agent_invoices.super_agent_id ... CASCADE`
- `refunds.order_id ... CASCADE` — deleting an order erases the refund record
- `webhook_endpoints.owner_id ... CASCADE`
- `payment_proofs.uploader_id ... CASCADE` — buyer-delete erases proof of payment
- `subscriptions.researcher_id ... CASCADE`

Fix: convert to `ON DELETE SET NULL` or `RESTRICT` with a separate "redacted" flag for GDPR/CCPA.

## P1-NEW-9. EMPTY CHART STATES CRASH

`components/AgentAnalytics.tsx:120` and `AdminAnalytics.tsx:234` render `AreaChart` without gating on `data.length > 0`. New agents and empty date ranges see broken axis grids.

## P1-NEW-10. WISHLIST HAS NO LIMIT

`app/api/researcher/wishlist/route.ts:23` has no `.limit()`. A user with thousands of favorites loads them all. Same shape problem in `app/api/agent/bundles/route.ts` — JSONB rewrite of entire array on every PATCH.

## P1-NEW-11. ADMIN ORDERS / RESEARCHERS HAVE NO PAGINATION

`/api/admin/orders/route.ts` has NO `.limit()`. `/api/admin/researchers/route.ts` same. At scale, both fail. `Pagination.tsx` exists client-side but the underlying endpoints don't accept cursor params.

## P1-NEW-12. RATE LIMIT WINDOW DOES NOT SLIDE — STUCK BURSTS

`lib/rate-limit.ts:127` — Upstash path does `INCR + EXPIRE`. When the EXPIRE fires AFTER the INCR, a burst attacker can extend the window indefinitely (each INCR resets EXPIRE). Should use a sorted-set sliding window (`ZADD`+`ZREMRANGEBYSCORE`+`ZCARD`).

Also: only 1 of 11 rate-limited routes returns `Retry-After` (`/api/storefront/recommendations:58`). The other 10 return generic 429 with no header.

## P1-NEW-13. ZOD SCHEMAS NEVER USE .strict()

`grep -rn '\.strict()' app/api lib` returns ZERO hits. Every Zod object accepts arbitrary extra fields. A POST with `{ ..., role: 'admin' }` rides through unvalidated. Add `.strict()` to every money/role/auth-touching schema.

## P1-NEW-14. 21 ROUTES READ req.json() WITHOUT ZOD

The 76 `.catch(() => ({}))` sites include 21 state-mutating routes where the destructured body goes straight into a Supabase call. Each is a Type-confusion vector:

- `admin/transactions:52`, `admin/pricing-tiers:28`, `admin/coupons:34,140`, `admin/agents:38`, `admin/agents/update-password:10`, `admin/statements:48`, `admin/researchers:45`, `admin/orders:*`, plus equivalents on agent.

## P1-NEW-15. JSONB COLUMNS HAVE NO SHAPE CHECK

`coupons.stacking_policy`, `agent_profiles.bundles_config`, `agent_profiles.colors`, `subscriptions.items_snapshot`, `orders.shipping_address` — none have a CHECK constraint. A malformed insert is accepted and crashes the consumer.

Fix: `CHECK (jsonb_typeof(shipping_address)='object' AND shipping_address ? 'state' AND shipping_address ? 'zip')` and similar.

## P1-NEW-16. ENUM DRIFT

- `agent_commissions.status` text+check; admin code may emit different casing.
- `refunds.status` allows `pending|completed|failed|reversed`; cancel/refund flow may persist `cancelled`.
- `subscriptions.status` is `active|paused|cancelled`; `subscription_runs.status` is `succeeded|failed|skipped`. Mismatched vocabularies.
- `sub_agent_invoices.status` is `varchar(50)` with NO CHECK constraint — free-text.
- `messenger_messages.status` has no `failed`.

## P1-NEW-17. UNIQUE CONSTRAINT GAPS

- `agent_profiles.slug` is case-sensitive UNIQUE; recommendation/events routes use `.toLowerCase()`, search uses `.ilike()`. Three different patterns; centralize via `lib/slug.ts#findAgentBySlug`.
- `coupons (agent_id, code)` case-sensitive — same agent can have `Welcome10` and `WELCOME10`.
- `webhook_endpoints` has NO uniqueness on `(owner, url, event)` — duplicate deliveries possible.
- `subscriptions` no unique on `(researcher_id, agent_id, items_snapshot_hash)` — N identical subscriptions -> N x replenishment.
- `agent_storefront_events` no idempotency unique on `order_complete` per `order_id` — analytics inflate when client double-fires.

## P1-NEW-18. TRIGGER CORRECTNESS GAPS

- `check_banned_product` only fires on INSERT to `agent_products`. Banning a product after agent_product rows exist doesn't propagate. Add UPDATE trigger on `products.is_banned`.
- `handle_new_user` swallows all exceptions via `RAISE WARNING`. A failed profile insert leaves an auth user without a profile row; every subsequent `is_admin()` returns NULL for them. At minimum log to admin_audit_log.
- `trim_recently_viewed` runs `DELETE ... NOT IN (subquery LIMIT 50)` AFTER every insert with no lock. Race under concurrent inserts can delete the wrong rows.
- `fn_mm_after_insert` updates `unread_count` without checking participant `muted` flag.
- `trg_sync_product_stock` fires only on INSERT not UPDATE. Direct admin update of `inventory_count` to 0 leaves `in_stock` boolean stale.

## P1-NEW-19. FUNCTION VOLATILITY: is_admin/is_agent_or_above/is_super_agent MARKED VOLATILE

They read `auth.uid()` (STABLE) and query `profiles` (no writes). Should be `STABLE` to allow planner caching across a single query. Currently they re-execute per row in RLS evaluation — top contributor to the 510 multiple-permissive-policy perf lints.

## P1-NEW-20. DUPLICATE deduct_prepaid_balance OVERLOAD

Two function rows with different ACLs (`{=X/postgres,...service_role}` vs no public X). Two overloads exist. Risk of caller resolving the wrong one. Drop the older signature.

## P1-NEW-21. ANON-EXECUTABLE FN_* CONVERSATION FUNCTIONS

`fn_find_direct_conversation`, `fn_get_user_conversations` have PUBLIC EXECUTE — anon can probe the messenger graph. Add `REVOKE EXECUTE FROM anon`.

## P1-NEW-22. ALERT() AND CONFIRM() IN PRODUCTION COMPONENTS

Native browser modals in `AgentCoupons:124,134`, `AgentStoreProducts:141,147,156,169`, `ProductTierOverrides:98`, `AgentBundles:128`, `AgentWebhooks:134,161`, `SubscriptionsClient:204-208`. Replace with `sonner` `toast.error` / `<ConfirmDialog>`.

## P1-NEW-23. TOLOCALESTRING IN JSX RENDERS DIFFERENT SERVER vs CLIENT

11 components render dates with `toLocaleString()` directly in JSX with no `{timeZone:'UTC'}` option. Server uses Vercel's locale (UTC); client uses browser locale. Hydration mismatch. List:
`AgentCoupons:322`, `AgentCommissions:195,257`, `AgentPaymentProofs:60`, `AgentSubAgents:219,437`, `AgentWebhooks:48`, `AgentLedger:35,92,139`, `AgentOrders:281,563`, `ResearcherDashboard:196,270`, `AgentSubscriptions:39`, `Messaging:255,258,259`.

## P1-NEW-24. SUPABASE STORAGE ORPHAN LEAK ON DELETE

`app/api/admin/products/[id]/lots/[lotId]/coa/route.ts:78,152` and `.../route.ts:112` — `.storage.from('product-coas').remove([key]).catch(() => null)`. Storage delete failures are swallowed. Paid bytes accumulate forever.

## P1-NEW-25. ADDRESS API DUPLICATION -> STATE-CODE VALIDATION DIVERGES

Two parallel routes write the same `saved_addresses` table:
- `/api/account/addresses` (Zod `state: z.string().min(1).max(60)`) — accepts non-US strings
- `/api/researcher/addresses` (`isValidStateCode` US-only)

A row written via `account/addresses` with `state='Ontario'` is unreadable via the checkout-mounted endpoint. Pick one.

## P1-NEW-26. STOREFRONT FALLBACK SHOWS WHOLESALE PRICE TO ORPHAN BUYERS

`app/api/storefront/recommendations/route.ts:162` — when a researcher's `referring_agent_id` is NULL, the recommendation strip falls back to master `base_cost`. Anonymous browsing of a storefront via the recommendations API can show wholesale COGS.

## P1-NEW-27. INVENTORY OUT-OF-STOCK FALSE POSITIVE

`app/api/storefront/search/route.ts:248-257` falls back to MASTER `inventory_count` when the agent has no inventory row. Researcher sees "in stock" based on admin warehouse stock; order fails at agent approval. UX bug masquerading as success.

## P1-NEW-28. /api/admin/agent-invitations/route.ts:39 AND OTHERS HARDCODE pepnationlab.com

Production URLs hardcoded:
- `app/api/admin/agent-invitations/route.ts:39`
- `app/api/admin/agents/route.ts:8`
- `app/status/page.tsx:23`
- `app/sitemap.ts:3`
- `app/layout.tsx:20`
- `app/dashboard/agent/AgentDashboardClient.tsx:194` — falls back to `http://localhost:3000` in browser

Staging environments leak prod links in invitation tokens and metadata. Either fail closed when `NEXT_PUBLIC_APP_URL` is unset or remove fallbacks.

## P1-NEW-29. TAX EXEMPTION EXPIRY NOT ENFORCED BY A JOB

`lib/tax.ts:65-84` checks `expires_at >= today` correctly. But no cron flips `status='expired'` once the date passes. Admin UI still shows "approved" for expired exemptions, creating compliance/audit gaps.

## P1-NEW-30. RMA mark_received DOES NOT REQUIRE return_label_url

`/app/api/agent/rma/[id]/route.ts:211-222` accepts a `mark_received` action without `return_label_url IS NOT NULL`. Agent can short-circuit the workflow.

---

# P2 NEW FINDINGS (POLISH)

- `localStorage` reads inside `useState` initializer in `StaleBrowserBanner.tsx:11-29` and `CartContext.tsx:132` cause SSR/hydration mismatch.
- `Number(x)` parsing without `Number.isFinite` checks in researcher balance adjust, invoice pay, tax amount math.
- Postgres `TEXT` columns unbounded at API edge: bundle name/desc, coupon code/desc, tier name, slug, transaction reason.
- Filename sanitization missing on uploads — raw `file.name` stored in metadata.
- CSV import accepts header-only file as 0-row success.
- Subscription `next_run_at` uses ms arithmetic; DST drift.
- Unicode-only usernames rejected with misleading error.
- Slug accepts non-ASCII (reaches DB; unreachable in browser).
- Storefront SSR snapshot doesn't subscribe to realtime stock; tab open 10 min shows stale.
- No `pg_cron` extension; recommendation refresh binding unverified.
- No fresh-DB CI replay test exists.
- `cron_runs` has no TTL purge — grows unbounded.
- `agent_profiles.colors` and `bundles_config` and `payment_handles` written client-side via direct Supabase (bypasses server validation).
- `MessageComposer.tsx:142` calls `crypto.randomUUID()` in render path -> breaks React reconciliation on every re-render.
- Statement weekly schedule UTC vs agent local week boundary.
- Subscription buyer deactivation not surfaced in researcher UI.
- 68 `as any` casts across the codebase.
- Logging hygiene: `app/api/orders/route.ts:683` logs full `itemsToInsert` JSON; `app/api/agent/restock/route.ts:227-247` logs full Postgres error with row params.

---

# SUMMARY METRICS — NEW FINDINGS THIS PASS

- **NEW P0 findings:** 20 (excluded duplicates of first pass)
- **NEW P1 findings:** 30
- **NEW P2 findings:** 17
- **Total new sites worth a code change:** ~67

The most damaging single bug: **P0-NEW-1 (10x subscription overcharge)** — every auto-replenish order charges 10x the per-vial price the buyer authorized.

The most damaging single architectural gap: **P0-NEW-6 (zero captureError calls)** — the platform's observability stack is structurally absent; "production is healthy" is unfalsifiable.

The most damaging compliance gap: **P0-NEW-5 (balance_transactions / weekly_statements / statement_orders not append-only)** — admins (and anyone with the service role key) can rewrite financial history without trace.

---

# RECOMMENDED SECONDARY EXECUTION ORDER

## Money emergency (1 session, P0)

P0-NEW-1 (10x overcharge), P0-NEW-3 (inventory oversell), P0-NEW-4 (double-decrement), P0-NEW-2 (shipping_address shape), P0-NEW-10 (cancel_order rejects shipped), P0-NEW-12 (SKIP LOCKED), P0-NEW-13 (auto-disable webhook), P0-NEW-8 (multiplier > 0 CHECK).

## Audit and ledger lockdown (1 session, P0)

P0-NEW-5 (append-only triggers + drop ALL policies), P0-NEW-20 (NOT NULL on FK columns), backfill nulls, P1-NEW-8 (CASCADE -> SET NULL on financial tables).

## Observability emergency (1 session, P0)

P0-NEW-6 (captureError everywhere), P0-NEW-17 (real /api/health), Sentry release + PII scrub + onRequestError hook, structured logging.

## Security + admin viewer fix (1 session, P0)

P0-NEW-11 (audit viewer schema), P0-NEW-7 (file MIME sniffing), P0-NEW-9 (bundles CSRF + ownership), P0-NEW-14 (shipping role scope), P0-NEW-15 (super_agent verify-access), P0-NEW-16 (ILIKE escaping), P0-NEW-18 (matviews REVOKE), P0-NEW-19 (4 CSRF gaps).

## DB integrity (1 session, P1)

P1-NEW-3 (coupons bounds + starts_at), P1-NEW-4 (server quantity check), P1-NEW-15 (JSONB shape CHECK), P1-NEW-16 (enum drift), P1-NEW-17 (unique constraints), P1-NEW-18 (trigger correctness), P1-NEW-19 (function STABLE), P1-NEW-20 (drop dup overload), P1-NEW-21 (REVOKE fn_*).

## Wiring + UX pass (1 session, P1)

P1-NEW-1 (subscription safety), P1-NEW-2 (vacation agent), P1-NEW-5 (bulk partial-failure rollback), P1-NEW-6 (statement TOCTOU), P1-NEW-7 (notification chain), P1-NEW-9..14 (charts, pagination, rate limit slide, Zod strict, JSONB validation), P1-NEW-22..30.

---

*Generated by 5-analyst parallel secondary deep-dive on 2026-05-29. Production HEAD `a674041`.*
