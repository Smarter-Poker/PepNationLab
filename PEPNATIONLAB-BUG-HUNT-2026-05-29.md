# PepNationLab Comprehensive Bug Hunt

**Date:** 2026-05-29 (post-Phase F roadmap merge, HEAD `cb3f8030`)
**Scope:** 69 pages, 196 API routes, 89 components, 33 lib files, 65 migrations
**Method:** 7 parallel read-only analysts — Public/Auth, Researcher, Agent, Admin, Messenger, Shipping/Cron/Middleware, Lib/API/DB. Plus live Supabase advisor and policy queries.

This report is line-by-line and merciless. Each finding cites the exact file and lines so it can be fixed without re-discovery.

---

## How to read this

Findings are prioritized P0 (ship before next release), P1 (next sprint), P2 (polish). They are grouped first by domain (compliance / financial / security / UX) then by surface area. The most damaging surfaces are at the top.

---

# COMPLIANCE-BLOCKING ITEMS (CLAUDE.md hard rules)

These violate explicit hard rules in `CLAUDE.md` Part 1. Zero exceptions allowed.

## P0-A. Emojis still present in production source

| File | Lines |
|---|---|
| `app/dashboard/page.tsx` | 117 (microscope), 134 (party) — researcher landing |
| `app/shipping/page.tsx` | 54, 122, 157, 164–167, 181, 201, 306–307, 337 — shipping role landing |
| `components/Messaging.tsx` | 26 (`EMOJI_QUICK` array of 6), 27 (`EMOJI_FULL` array of 24), 293, 440, 484, 559, 580, 586, 608, 627, 643, 680 |
| `app/admin/messages/page.tsx` | 244, 245, 263, 338, 342, 378, 397, 419, 420, 471, 584, 617 |
| `components/AdminAnalytics.tsx` | 191, 201 |

Fix: replace every literal with a `lucide-react` icon or remove. `Messaging.tsx` becomes deletable once the legacy `/api/messages/*` consolidation lands (see P0-C below).

## P0-B. Title Case violations on user-facing strings

Sentence-case strings in places CLAUDE.md says must be Title Case:

- `app/forgot-password/page.tsx:125` — "Please contact your Research Agent…"
- `app/checkout/CheckoutForm.tsx:399, 658, 741` — error/info copy
- `app/admin/messages/page.tsx:617` — "Sending..."
- `app/shipping/page.tsx:69, 75, 85` — toast strings
- `components/AgentInventory.tsx:54, 57, 94, 97` — toast/error strings
- `components/AgentSubAgents.tsx:60, 61, 77` — toast strings
- `app/api/agent/restock/route.ts:56, 80, 259` — server-returned errors
- `app/about/page.tsx:84-91` — body prose is sentence-case (terms/privacy/compliance follow same pattern — explicit prose-exemption decision needed if intentional)

---

# COMPLIANCE-BLOCKING ITEMS (audit + age verification)

## P0-C. Dual messaging systems collide — invoices land in dead system

Task #30 declared the legacy `messages` table dropped, but parallel infrastructure still ships:

- `app/api/messages/*` (route, archive, edit, search, templates, export, broadcast, analytics) still serves and writes to `internal_messages`.
- `app/admin/messages/page.tsx` still renders the legacy UI alongside `app/admin/messenger/page.tsx` — two admin views, two sources of truth.
- `components/AgentMessages.tsx`, `components/ResearcherDashboard.tsx`, `components/Messaging.tsx` all consume the legacy API.
- **`app/api/invoices/route.ts:17, 55, 66`** writes invoice notifications into `internal_messages` only. Recipients never see them in `/messenger`. This is a money-touching delivery failure — invoice reminders are invisible.
- `middleware.ts:72` still whitelists `/messages` as protected prefix.

Net effect: anything sent via the agent dashboard, researcher dashboard, or admin "Messages" page is ghost data, invisible in the new `/messenger`.

## P0-D. Audit Log Viewer is broken (schema mismatch — entire feature non-functional)

- `app/admin/audit/page.tsx:31-37` and `AdminAuditClient.tsx:8-13` SELECT and render columns that do not exist on `admin_audit_log`.
  - Page asks for: `actor_email, target_type, target_id, summary, metadata`
  - Table actually has: `actor_id, action, entity_type, entity_id, changes, ip_address, user_agent, created_at`
- `.ilike('summary', …)` throws a PostgREST error. The viewer is the only thing on the platform that uses this fictitious shape — every emitter writes the correct columns.
- **Net effect: clicking "Audit Log" in the sidebar produces an error or empty page.** The audit-viewer roadmap item that shipped in Phase D is not actually functional.

Fix: rewrite the page to read `actor_id, action, entity_type, entity_id, changes, ip_address, user_agent, created_at`, join `profiles` for the actor email, switch the search to `or('action.ilike.%X%,entity_type.ilike.%X%,changes::text.ilike.%X%')`.

## P0-E. Sensitive admin actions still skip audit AND CSRF

These mutate user accounts, balances, or platform pricing but neither call `assertSameOrigin` nor insert `admin_audit_log` rows:

| Route | Risk |
|---|---|
| `app/api/admin/agents/super-upgrade/route.ts` | Promotes agent to super_agent (controls billing + commission math) |
| `app/api/admin/agents/update-password/route.ts` | Force-resets any user's password — full account takeover via CSRF |
| `app/api/admin/agents/update-contact/route.ts` | Changes auth.users email — silently moves password-reset destination |
| `app/api/admin/researchers/route.ts` `toggle_active` / `adjust_balance` / role/tier | Deactivates users, directly UPDATEs `prepaid_balance` (bypasses `deduct_prepaid_balance` RPC — ledger drift), changes roles. **No audit row anywhere.** |
| `app/api/admin/pricing-tiers/route.ts` POST | Tier multiplier change (the platform's pricing baseline) |
| `app/api/admin/pricing-tiers/overrides/route.ts` POST + DELETE | Per-product overrides |
| `app/api/admin/products/route.ts` POST + PATCH | Master catalog mutations |
| `app/api/admin/statements/route.ts` POST | `generate` and `mark_paid` financial events |
| `app/api/admin/transactions/route.ts` POST | Direct `balance_transactions` insert by `agent_id` (second admin path to mutate prepaid balances without audit) |
| `app/api/admin/orders/route.ts` POST | Admin order state mutations (sends pushes + webhooks) |
| `app/api/admin/orders/bulk/route.ts` | Bulk approve/ship/cancel for up to 200 orders — only per-order status row, no admin_audit_log summary |

Fix pattern: `if (!gate.ok) return gate.response;` then `assertSameOrigin(req)` then perform the action then `await svc.from('admin_audit_log').insert({ actor_id: user.id, action: '<action>', entity_type, entity_id, changes })`.

## P0-F. Researcher balance edits bypass the ledger RPC

`app/api/admin/researchers/route.ts:60-79` `action: 'adjust_balance'` does a raw `UPDATE profiles SET prepaid_balance = X` then a hand-rolled `balance_transactions` insert. The append-only ledger guard depends on `deduct_prepaid_balance` RPC for atomicity. Direct UPDATE makes balance and ledger drift possible AND leaves no audit row. Same issue in `app/api/admin/transactions/route.ts:47-88`.

Fix: route both surfaces through `deduct_prepaid_balance(p_agent_id, p_amount, p_order_id, p_description)`.

## P0-G. Layer 1 disclaimer trusts client-supplied `verified_age`

`app/api/disclaimer-log/route.ts:35-43` accepts `verified_age` from the request body. `components/SiteDisclaimerGate.tsx:39` passes `21`, but a malicious client could send `0` or `99`. Compliance log integrity depends on client honesty. The gate cannot be passed without ticking three 21-plus checkboxes — so the server should infer `age_verified=true, verified_age=21` and ignore the body.

## P0-H. Storefront SSR storefront does not block banned products

`/api/storefront/search/route.ts:185` correctly filters `products.is_banned=false`. The SSR storefront `app/[agentSlug]/page.tsx:62-87` does not. If an admin bans a product but the per-agent `agent_products.is_visible` row stays `true`, banned products still render and can be added to cart.

---

# FINANCIAL CORRECTNESS

## P0-I. Webhook signing scheme does not match the partner docs

- `lib/webhook-dispatch.ts:106-110, 192-200` signs `bodyJson` only and sends `X-PNL-Signature` with no `X-PNL-Timestamp`.
- `docs/WEBHOOK-VERIFICATION.md:11-15, 32-35` and the in-app page at `app/dashboard/agent/webhooks/verify/page.tsx:18-39, 117-120` tell partners to verify `HMAC(secret, "<X-PNL-Timestamp>.<raw_body>")` and reject deliveries without a fresh timestamp.
- **Every partner who implements the docs will reject every delivery.** No replay protection either.

Fix: add `X-PNL-Timestamp: ${Math.floor(Date.now()/1000)}` and sign `${ts}.${bodyJson}`.

## P0-J. Webhook event-type typos silently drop deliveries

Grep shows call sites with `event: 'order_approved'` and `event: 'order_shipped'` (underscored) at `enqueueWebhook`. The dispatcher filters `endpoint.event_types.includes(event)` — subscribers configured for `order.approved` never receive them. Verify every emit site uses dot-notation.

## P0-K. `price.changed` webhook declared but never emitted

`lib/webhook-dispatch.ts` declares the event. `app/api/cron/apply-price-changes/route.ts`, `app/api/admin/products/bulk-price/route.ts`, `app/api/admin/agent-products/bulk-price/route.ts`, `app/api/admin/products/route.ts` PATCH, `app/api/admin/pricing-tiers/*` — none emit it. Agent integrations subscribed to `price.changed` will never receive anything.

## P0-L. Shipping role POST never fans out webhooks or push

`app/api/shipping/orders/route.ts:55-114` updates `orders.status` (including to `shipped`) with NO `enqueueWebhook('order.shipped')`, NO `enqueueOrderPush({event:'order_shipped'})`, NO CSRF guard, NO `canTransition` state-machine check, no `shipped_at` timestamp, and no tracking-length validation. Admin/agent paths fan out correctly — the dedicated shipping role is the silent gap. This is the most common transition in the system and the buyer hears nothing.

## P0-M. `coupons.stacking_policy` is dead wiring

Phase A migration added the JSONB column (`{allow_with_bundles, allow_with_sale_items, exclude_codes, max_stack}`). `grep -RE stacking_policy app lib` returns ZERO matches. Coupons never honor bundle/sale-item exclusions or stack caps. Either wire `lib/coupons.ts` and `redeem_coupon` to consume the policy or remove the column.

## P0-N. Coupon `max_uses_per_user` race

`app/api/coupons/validate/route.ts:35` only invokes `validateCoupon` (read-only). The atomic `redeem_coupon` RPC only checks `max_uses` total, not `max_uses_per_user`. A researcher who validates first can race past the per-user cap. Fix: move the per-user count check inside the RPC.

## P0-O. Manual orders miss idempotency, webhook fan-out, and attribution

`app/api/agent/orders/new/route.ts` has:
- No `idempotency_key` — a double-click on "Create Order" inserts two orders.
- No `enqueueWebhook('order.created' | 'order.approved')` — subscribers miss every manual order.
- `buyer_id: null` (manual orders are anonymous).
- `is_wholesale_restock` not explicitly set — relies on DB default.
- Statements and commissions key off `agent_id + is_wholesale_restock`; this miscounts silently.

## P0-P. Illegal status transitions in agent routes

- `app/api/agent/orders/approve/route.ts:41` writes `status: 'cancelled'` directly via Supabase update — bypasses `lib/order-states.ts canTransition`, allowing illegal transitions from `delivered`/`shipped`.
- `app/api/agent/shipping/purchase/route.ts:118` writes `status: 'shipped'` without `canTransition`.

## P0-Q. Checkout success screen shows wrong payment handle

`app/checkout/CheckoutForm.tsx:572-588` hardcodes `payments@pepnationlab.com`, `$PepNationLab`, etc. For agent-storefront orders the **agent's** handles should apply (the order detail page at `app/orders/[id]/page.tsx:111-122` does this correctly). Researchers on agent storefronts are pointed at the platform Venmo/Zelle account, not their agent's.

## P0-R. Checkout tax preview uses wrong shipping base

`app/checkout/CheckoutForm.tsx:309-314` computes the tax preview using hardcoded shipping brackets, while `app/api/orders/route.ts` uses DB rates via Shippo. Tax preview will diverge from the server total whenever an admin edits a shipping rate.

## P0-S. Agent self-buy 10-vial floor is client-only

`CheckoutForm.tsx:455-463` enforces the 10-vial minimum client-side. `app/api/orders/route.ts:396-407` silently drops to retail rather than rejecting. A replay-style request can place a sub-10-vial agent order at retail pricing by bypassing the client check.

---

# SECURITY HARDENING

## P0-T. `/api/auth/verify-agent-access` is a downline-enumeration oracle

`app/api/auth/verify-agent-access/route.ts:14-73` accepts `userId` from the POST body and looks up `profiles.referring_agent_id / parent_agent_id` via service role. Never calls `auth.getUser()`. Anyone authenticated can probe `{userId, agentSlug}` pairs to map the entire downline graph. No rate limit. No CSRF.

Fix: derive `userId` server-side from session; drop body param.

## P0-U. Invite redemption is racy (double-spend)

`app/api/agent-invitations/redeem/route.ts:93-215` reads `redeemed_at` then UPDATEs unconditionally at the end. Two parallel requests both pass the check, both create auth users, both upsert the profile, both create storefront rows. Token entropy is high so chance of in-the-wild double-spend is low, but defence-in-depth fails.

Fix: atomic `UPDATE agent_invitations SET redeemed_at=now() WHERE token=$1 AND redeemed_at IS NULL RETURNING *`. Gate the rest of the flow on whether the UPDATE returned a row.

## P0-V. Storefront API leaks master COGS and inventory to anonymous callers

- `app/api/storefront/recommendations/route.ts:189` returns `base_cost: Number(p.base_cost ?? 0)` — master COGS.
- `app/api/storefront/search/route.ts:151-185` returns `inventory_count`, `admin_bulk_price`, `admin_bulk_threshold` to anon.

Fix: strip these fields from the public payload.

## P0-W. Messenger `send-message` has no block check

`app/api/messenger/send-message/route.ts:1-127` has zero `isBlocked` calls. A blocked user can still write into any conversation where they were a participant before the block. `start-conversation`, `add-participant`, `call-signal`, `livekit-token` all gate on blocks; the actual send path doesn't.

## P0-X. Messenger has zero rate limiting

`grep rateLimit app/api/messenger` returns zero hits. None of `send-message`, `link-preview` (SSRF/burst), `gif-search` (Tenor quota burn), `upload-media` (storage spam), `start-conversation`, `report-message`, `react-message` are rate-limited.

## P0-Y. Messenger crons currently fail every minute

`vercel.json` schedules `/api/messenger/cron/{process-scheduled,fire-reminders,expire-messages}` at `* * * * *` and `*/5 * * * *`. `middleware.ts:11-64` does NOT include any of those paths in `PUBLIC_ROUTES`. Vercel cron invocations carry no session cookie — middleware returns 401 every minute. Phase 13 reminders, scheduled-send, and message expiry are completely broken in production.

Additionally: `lib/messenger/server.ts:122-130` uses `header !== Bearer ${secret}` (non-constant-time, leaks length and content). The three messenger crons never call `claimCronRun`, so Vercel retries could fire reminders/process scheduled messages multiple times.

## P0-Z. CSP missing critical hosts

`next.config.ts:45` `connect-src` does NOT include:
- `wss://*.livekit.cloud` (or the org-specific LiveKit URL) — Phase 11 calls don't work in production.
- `https://tenor.googleapis.com` — GIF picker blocked.

Also `Permissions-Policy: camera=(), microphone=(), geolocation=()` blocks Phase 11 audio/video and voice memo recording outright.

## P0-AA. RPCs callable by anon include payment-critical functions

Verified live with `has_function_privilege`:

| RPC | anon | authenticated |
|---|---|---|
| `deduct_prepaid_balance(uuid, numeric, uuid, text)` | YES | YES |
| `redeem_coupon` | YES | YES |
| `agent_inventory_in_stock` | YES | YES |
| `mark_message_read` | YES | YES |
| `fn_find_direct_conversation`, `fn_get_user_conversations` | YES | YES |
| `fn_mm_after_insert`, `fn_mm_cleanup_pins_on_delete` (trigger-only!) | YES | YES |
| `get_sub_agent_ids`, `get_user_role`, `is_admin`, `is_agent_or_above`, `is_super_agent` | YES | YES |

Anyone can iterate coupon codes from a script. Anyone can mark random messages read. The 4-arg `deduct_prepaid_balance` is the overload the production code actually uses.

## P0-AB. 35 RLS policies have NULL `WITH CHECK`

Live `pg_policies` query confirms. Highest-risk holes:

- `profiles` UPDATE `Users can update own profile` — no WITH CHECK. Researcher can PATCH their own row and rewrite `role`, `tier`, `prepaid_balance`, `referring_agent_id`, `parent_agent_id`.
- `orders` UPDATE — agent can change `agent_id` to migrate ownership.
- `agent_products` ALL — agent can attribute rows to another `agent_id`.
- `agent_inventory` UPDATE — same.
- `agent_profiles` ALL — agent can mutate another agent's storefront.
- `coupons` ALL — agent can mint coupons attributed to another `agent_id`.
- `super_agent_pricing` ALL — older permissive policy bypasses the gated one.
- `messenger_link_previews` INSERT + UPDATE — WITH CHECK true (any authed user can poison link metadata for any conversation).
- `messenger_admin_messages` INSERT — WITH CHECK true.
- `agent_storefront_events.storefront_events_anon_insert` — WITH CHECK true (anon can spam telemetry with arbitrary `agent_slug`, `session_id`, `amount_cents`).

## P0-AC. Materialized views exposed to anon

`product_copurchase_pairs`, `product_popular_60d` selectable by anon plus authenticated. Scrapers can de-anonymize buying patterns. Move behind `get_copurchase_recommendations` RPC.

## P0-AD. Layer 1 disclaimer write fires AFTER state mutation

`components/SiteDisclaimerGate.tsx:30-41` sets `localStorage` and `setAccepted(true)` BEFORE posting to `/api/disclaimer-log`. Same anti-pattern in `CartContext.tsx:216-235` for Layer 3 (`add_to_cart`). If POST fails, the catch swallows; user is recorded locally as accepted but no DB row exists. CLAUDE.md mandates "audited BEFORE the order insert" — this is a compliance gap.

---

# CSRF GAPS (still open)

The analyst pass enumerated ~46 mutating routes without `assertSameOrigin`. The highest-blast-radius ones:

**Admin:** `admin/agents/update-password`, `admin/agents/super-upgrade`, `admin/agents/update-contact`, `admin/pricing-tiers/*`, `admin/products`, `admin/orders`, `admin/orders/bulk`, `admin/statements`, `admin/transactions`, `admin/researchers` (toggle_active / adjust_balance / role branches), `admin/cart-reminders`.

**Agent:** `agent/products`, `agent/products/{reorder, bulk-margin}`, `agent/promote-subagent`, `agent/shipping/purchase`, `agent/update-password`, `agent/storefront-slug`, `agent/super-agent/{invoices, invoices/pay, pricing}`, `agent/inventory`, `agent/restock`, `agent/orders/{approve, new}`, `agent/bundles`.

**Shipping:** `shipping/orders` PATCH.

**Researcher:** `preferences/notifications`, `messages/*`, `user/activity`, `cart/refresh`.

**Public/anon:** `auth/register` (returns 410 but still no Origin gate), `auth/resolve`, `auth/verify-agent-access`, `agent-invitations/redeem`, `disclaimer-log`, `storefront/{register, events}`, `shipping-preview`, `invoices`, `invoices/remind`.

---

# BROKEN LINKS, ORPHANED PAGES, DEAD CODE

## P0-AE. Three new roadmap pages are unreachable through UI

The Phase D and E roadmap shipped these pages but no nav entry links them:

- `/dashboard/agent/analytics` — agent storefront analytics
- `/dashboard/agent/super-rollup` — super-agent rollup
- `/dashboard/agent/webhooks/verify` — webhook verification docs

`grep -RIn "super-rollup|webhooks/verify|/dashboard/agent/analytics" components app` returns zero results. Reachable only by typing the URL.

Fix: add entries to `MENU_ITEMS` in `AgentDashboardClient.tsx:456-475`. Specifically: Analytics tab near "Sales & Carts"; Super-Rollup gated by `is_super_agent` near "My Sub-Agents"; a link from `AgentWebhooks.tsx` header.

## P0-AF. Shippo key rotation endpoint is orphaned

`app/api/agent/storefront-config/shippo-key/rotate/route.ts` exists with audit logging but no UI button calls it. `grep -RI "shippo-key/rotate" components app` returns zero hits. Add a "Rotate" button to `AgentStorefrontConfig`.

## P0-AG. `/admin/messenger` is in the codebase but missing from sidebar

`app/admin/messenger/page.tsx` renders `AdminMessengerClient` (full moderation surface) but `app/admin/layout.tsx` NAV (lines 17-148) has no entry. Admins cannot reach it through the UI.

## P0-AH. Researcher dashboard "Browse Catalog" link is broken

`app/dashboard/page.tsx:117` links to `/products`, which hard-redirects to `/` (`app/products/page.tsx:5`), which then `redirect('/login')`s. The researcher's primary "Browse Catalog" CTA always lands on login.

Fix: link to the referring-agent storefront (`/${profile.referring_agent.slug}`) when one exists.

## P1-AI. `/become-agent` has no application form

`app/become-agent/page.tsx` is purely marketing copy ending with a `mailto:research@pepnationlab.com` link. No table, no API, no form. Visitors land here expecting to apply, and leave email instead.

Decision: either build the form (writes to a new `agent_applications` table) or rename the page "Agent Program" and drop "Ready To Apply" language.

## P1-AJ. `/forgot-password` has 120 lines of dead form code

`app/forgot-password/page.tsx:14-43` defines a fully-wired `handleSubmit` calling `supabase.auth.resetPasswordForEmail()`. None of it renders. Only the static "Please contact your Research Agent" text shows. Delete the dead code or wire the form.

## P1-AK. `/login` "Forgot Password?" opens an inline static modal

Instead of linking to `/forgot-password`. Two paths show the same dead message. Replace with `<Link href="/forgot-password">`.

## P1-AL. Dead landing components

`components/HeroSection.tsx`, `HowItWorksSection.tsx`, `ProductsPreview.tsx` — `grep` shows no mount anywhere. Reference `/become-agent` plus `/products`. Bundle bloat only; delete.

## P2-AM. `/admin/sms` tombstone has no nav link

The page correctly serves the "SMS Log Has Been Removed" notice but no NAV entry points at it. Either delete the route or leave the tombstone for any straggler bookmark.

---

# WIRING / STATE / RACE BUGS

## P0-AN. Two parallel address APIs writing the same table

- `AddressesClient.tsx` (account hub) calls `/api/account/addresses` (PATCH/DELETE plus POST `:id/default`)
- `CheckoutForm.tsx:173` calls `/api/researcher/addresses` (PATCH/DELETE via body.id)

Validation differs: only the researcher route validates US state codes and ZIP regex. Default-flipping logic differs. Pick one, retire the other.

## P0-AO. `AgentStorefrontConfig` writes Shippo key client-side

`components/AgentStorefrontConfig.tsx:147-177, 101-107` calls `supabase.from('agent_profiles').update({ shippo_api_key, warehouse_address, payment_handles, is_active, primary_color })` from the browser. RLS-only authorization. No server validation. No audit log for vacation toggle. The new rotate API is the right pattern — move all writes to a server route.

## P0-AP. Cart Layer-3 disclaimer is fire-and-forget

`CartContext.tsx:225` POSTs `/api/disclaimer-log` with `.catch()` swallowing errors. If the route 5xxs, the cart still commits and no DB row exists. Combined with P0-AD, the compliance audit trail can have silent gaps. Sentry capture in the catch at minimum.

## P0-AQ. Concurrent-call insert is not atomic

`app/api/messenger/call-signal/route.ts:95-115` SELECTs `.in('status', ['ringing','active'])` then INSERTs. Two simultaneous starts can both pass the dedupe SELECT and both INSERT. No unique index. Fix: `CREATE UNIQUE INDEX uq_messenger_calls_active ON messenger_calls(conversation_id) WHERE status IN ('ringing','active');`

## P0-AR. Scheduled-send idempotency missing

`app/api/messenger/cron/process-scheduled/route.ts:78-103` sets `status='sent'` before insert. If insert fails the rollback sets it back to `pending` — two concurrent claims can result in double-send. Add unique idempotency key on the scheduled row carried into `messenger_messages.metadata`.

## P0-AS. Soft-delete cleanup leaves `messenger_reminders.message_preview`

`fn_mm_cleanup_pins_on_delete` (audit3 migration) wipes pins, reactions, link previews. Reminders keep a snapshot of the deleted text in `message_preview`. Add `UPDATE messenger_reminders SET message_preview=NULL WHERE message_id=NEW.id` to the trigger.

## P0-AT. Service worker has no `pushsubscriptionchange` handler

`public/sw.js` (40 lines) implements `install`, `activate`, `push`, `notificationclick`. Missing `pushsubscriptionchange`. When Chrome rotates the push endpoint, the SW must re-subscribe and POST the new keys to `/api/push/subscribe`. Without it, push silently dies after key rotation.

## P0-AU. Push event coverage gaps

`enqueueOrderPush` is only emitted for `order_approved` and `order_shipped`. Missing:
- `order_delivered` push — admin/bulk transitions to delivered emit the webhook but not the push.
- `payment_reminder` — declared in `EnqueueOrderPushArgs.event` union but never enqueued.
- `order_cancelled` — buyer never gets notified.
- `order_refunded` — buyer never gets notified.
- Subscription auto-orders — `cron/subscriptions-process` emits `subscription.run` webhook but no push for the buyer.
- RMA resolved — no push.
- Abandoned-cart recovery — in-app message only, no push.

---

# DB INTEGRITY

## P0-AV. Missing CHECK constraints

Live query (`has_check=false`):

| Table.Column | Risk |
|---|---|
| `products.weight_oz` | Negative weight breaks Shippo parcel calc |
| `products.inventory_count` | Negative inventory (only trigger-guarded; no constraint) |
| `agent_products.sale_price` | Negative leads to free orders |
| `orders.{subtotal, discount_amount, shipping_cost, total}` | Free or negative orders |
| `order_items.{unit_retail_price, unit_cost_price, unit_super_agent_cost}` | Negative line items |
| `pricing_tiers.multiplier` | Zero or negative breaks pricing |
| `product_tier_overrides.custom_multiplier` | Same |
| `coupons.discount_value` | Negative or over-100% discounts |
| `shipping_rates.{min_weight_oz, max_weight_oz}` | Min greater than Max — no rate matches |
| `super_agent_pricing.baseline_cost` | Free sub-agent orders |

## P0-AW. Migration drift / collision

Disk has 65 files, DB has 65 rows, but version IDs don't match. Disk uses ordinal suffixes (`000005..000014`); DB uses MCP apply-time timestamps. CLI db-push would re-run 19 migrations. **Two disk files share `20260530500000`** (`disclaimer_order_fk_qty_cap.sql` AND `recommendations.sql`) — a hard collision.

Fix: rename one of the colliding files; reconcile disk to DB ledger.

## P1-AX. Supabase Auth: HaveIBeenPwned disabled

`auth_leaked_password_protection` lint. Enable in Supabase Auth settings.

## P1-AY. Storage buckets allow public listing

`messenger_media`, `product-coas`, `product-images` SELECT policies are broad (`USING (bucket_id=…)` with no name predicate). Clients can enumerate. Lock `messenger_media` to private plus signed URLs.

## P1-AZ. Function without `search_path`

`payment_proof_order_id` is the only function missing `SET search_path`.

## P1-BA. Duplicate indexes

- `message_reactions`: `idx_message_reactions_message` and `idx_reactions_message`.
- `payment_proofs`: `payment_proofs_order_id_idx` and `payment_proofs_order_idx`.

Drop one of each.

## P1-BB. 66 unindexed foreign keys

Hot-path ones: `order_items.agent_product_id`, `orders.cancelled_by`, `orders.tax_exemption_id`, `agent_inventory.product_id`, `super_agent_pricing.product_id`, `webhook_deliveries.related_order_id`, `push_outbox.recipient_user_id`, `push_outbox.related_order_id`, `payment_proofs.uploader_id`, `payment_proofs.verified_by`. Plus 11 messenger FKs.

## P1-BC. 510 `multiple_permissive_policies` warnings

Top offenders (24 each): `agent_invitations`, `agent_products`, `agent_profiles`, `archived_conversations`, `coupons`, `message_templates`, `notification_preferences`, `subscriptions`, `super_agent_pricing`, `webhook_endpoints`. Each table has overlapping admin `ALL` and owner `ALL` policies — Postgres evaluates both per row. Replace with single combined policy using `OR` predicate, or split into per-cmd policies.

## P1-BD. 107 `auth_rls_initplan` warnings

Most policies still call raw `auth.uid()` and `is_admin()`. Wrap in `(SELECT auth.uid())` / `(SELECT is_admin())` so the planner caches the result per statement. Already done on `profiles`, `agent_products`, `orders`; remaining: `agent_inventory`, `super_agent_pricing`, `messenger_*`, `internal_messages`, `message_reactions`, `rma_requests`.

---

# UNCAPPED LIST ENDPOINTS

These return full tables (no `.limit()`, no cursor):

`admin/orders`, `admin/researchers`, `admin/statements`, `admin/coupons`, `admin/sales`, `admin/tax-rules`, `admin/restock` (capped at 100 hard, no cursor), `admin/refunds` (capped at 100 hard), `admin/commissions` (capped at 200 hard), `admin/transactions` (capped via query param), `admin/push` (capped at 200 hard), `admin/webhooks/[id]/deliveries` (capped at 100 hard).

`Pagination` component exists and is used on some pages but underlying endpoints don't accept cursor params — pagination is purely client-side over fully-fetched data.

## P1-BE. Response envelope inconsistency

At least 14 distinct top-level keys: `{data}`, `{items}`, `{messages}`, `{results}`, `{rmas}`, `{products,total}`, `{conversations}`, `{contacts}`, `{blocks}`, `{calls}`, `{bookmarks}`, `{endpoints}`, `{deliveries}`, `{commissions}`, plus mixed booleans (`{active}`, `{allowed}`, `{alreadyBookmarked}`). Typed clients have to fork by route.

Fix: introduce `lib/api-response.ts` with `respond(data, opts)` returning `{ data, meta?, error? }`.

---

# UX, A11Y, MOBILE

## P1-BF. Admin sidebar not responsive

`app/admin/layout.tsx:159-172` — `<aside>` is `position: sticky width: 240` with no mobile drawer. At less than 768px the sidebar consumes around 40% of horizontal space and is not collapsible. The agent dashboard has a hamburger drawer; admin doesn't.

## P1-BG. Agent dashboard drawer doesn't close on tab click

`AgentDashboardClient.tsx:482-525, 530` — each menu item's onClick sets `activeTab(item.id)` but does NOT call `setIsMobileMenuOpen(false)`. After selecting a tab the drawer remains over the content.

## P1-BH. `/account/credits` has no back-link or PageShell

`app/account/credits/page.tsx` is stranded — no PageShell, no "Back To Your Account" link. Inconsistent with every other account sub-page.

## P1-BI. `NotificationsClient.tsx:141` links back to `/dashboard` not `/account`

Every other account sub-page goes back to `/account`. Inconsistent.

## P1-BJ. Modal a11y gaps

- `app/login/page.tsx:78-128` forgot-password popup — no `role="dialog"`, no `aria-modal`, no focus trap, Esc doesn't close.
- `components/DisclaimerGate.tsx:9-171` — no `role="dialog"`, no `aria-modal`, no focus management on open. Checkboxes are `<div onClick>` not `<input type="checkbox">` — keyboard users cannot Tab/Space them. "I do not agree" hardcodes `window.location.href = 'https://www.google.com'`.
- Messenger overlays: `ReactionPopover`, `EmojiPicker`, `GifPicker`, `SearchResults`, `ScheduledMessageList`, `NewConversationDialog`, `GroupInfoDrawer`, `RemindersList`, `CallOverlay` — none close on Escape.

## P2-BK. Raw `<img>` tags

`components/ResearcherDashboard.tsx:382`, `app/account/wishlist/WishlistClient.tsx:101`, `app/[agentSlug]/page.tsx:198`, `app/dashboard/agent/AgentDashboardClient.tsx:486, 490`. Replace with `next/image`.

## P2-BL. StaleBrowserBanner false-positives

`components/StaleBrowserBanner.tsx:11-29` flags Safari Private Browsing (no SW), iOS Safari less than 16.4 (no PushManager), Instagram/Facebook in-app browsers, Brave with shields, and any user who disabled notifications. They see a full-bleed red banner saying their browser is broken.

## P2-BM. CartContext quantity buttons have no aria-label

`CartContext.tsx:480, 488`. Screen readers hear "button" only.

## P2-BN. Backdrop close has no role

`CartContext.tsx:412-414` — `<div onClick>` with no `role="button"` or `aria-label`. Keyboard users cannot dismiss.

## P2-BO. Subscription cancel uses synchronous `confirm()`

`SubscriptionsClient.tsx:204-208`. Mobile-poor and accessibility-poor.

## P2-BP. Status page is degraded on fresh deploy

`/api/status` returns `degraded` when `cron_runs` is empty. On a fresh deploy before any cron fires, the page looks broken. Threshold by job category or treat "no runs yet" as `ok` with a note.

---

# DEPLOYMENT / OPS

## P1-BQ. No central env-var assertion

Missing env vars silently disable features:
- `CRON_SECRET` missing — all 11 main crons return 401.
- `VAPID_*` missing — push outbox fills with `web_push_not_configured` failures.
- `UPSTASH_REDIS_REST_*` missing — in-memory fallback (per-instance only).
- `SENTRY_DSN` missing — silent.
- `SUPABASE_SERVICE_ROLE_KEY` missing — routes 500 per-request at runtime.
- `SHIPPO_API_KEY` (per-agent) missing — label purchase 500s.

Add `lib/env.ts` that asserts required vars at server boot via `instrumentation.ts`.

## P1-BR. Sentry needs PII scrub and release tag

`sentry.client.config.ts:8-28` — DSN-gated, but no `release` tag and no `beforeSend` to scrub researcher email/address/phone. PII reaches Sentry.

## P1-BS. MFA scope should include `agent` and `shipping`

`middleware.ts:186-217` `mfaRequiredRoles = {admin, super_agent}`. Regular `agent` has order approval, restock, payment-collection, sub-agent promotion, password-reset authority. `shipping` can transition orders. Both should be enforced.

## P1-BT. `cancel_stale_pending_orders` cron is co-tenant

Function exists. No dedicated cron. Called inline by `/api/cron/reminders/route.ts:113-117` once per day. If reminders cron fails or already-ran the sweep is skipped. Add a dedicated hourly cron.

## P2-BU. CSP `unsafe-eval` still present

`next.config.ts:45` `script-src 'self' 'unsafe-inline' 'unsafe-eval'`. Audit at next Next.js bump.

## P2-BV. PWA manifest has only one icon size

`app/manifest.ts` uses `/logo-mark.svg` for both `any` and `maskable`. Lighthouse will warn — needs separate 192/512 PNG icons.

---

# SHIPPO INTEGRATION

## P1-BW. Hardcoded `noreply@pepnationlab.com` in carrier payloads

`lib/shippo.ts:119, 128`, `lib/shippo-returns.ts:147, 157`. Buyers don't get carrier emails; agents lose return-status visibility. Should be `agent_profile.contact_email` per order.

## P1-BX. Shipping address shape drift

`lib/shippo.ts:77-81` and `lib/shippo-returns.ts:104-108` accept both `zipCode` and `zip` shapes. Canonical checkout writes one, fulfillment reads the other — silent label failures when a saved-address row used a different key. Normalize at the schema boundary.

## P1-BY. `shipping-preview` returns 200 with fallback rate on errors

Per the prior audit, on any error the route returns `{rate: 12.00}` HTTP 200. Checkout silently bills $12 every time. Return 503 on error.

---

# RECOMMENDED EXECUTION ORDER

## Compliance hotfix sprint (1 session)

P0-A (emojis), P0-B (Title Case), P0-D (audit viewer schema), P0-E plus P0-F (admin actions audit + CSRF), P0-AE (orphaned pages), P0-AH (researcher dashboard link), P0-AS (reminder text scrub).

## Financial integrity pass (1 session)

P0-I (webhook timestamp + sign), P0-J (event-type typos), P0-K (price.changed emit), P0-L (shipping role fan-out), P0-M (stacking_policy), P0-N (per-user coupon race), P0-O (manual orders), P0-P (illegal transitions), P0-Q (payment handle), P0-R (tax preview), P0-S (agent self-buy).

## Security pass (1 session)

P0-T (verify-agent-access), P0-U (invite race), P0-V (storefront leaks), P0-W (messenger block), P0-X (messenger rate limit), P0-Y (messenger crons + claimCronRun), P0-Z (CSP + Permissions-Policy), P0-AA (anon-callable RPCs), P0-AB (WITH CHECK), P0-AC (materialized views), P0-AD (Layer 1/3 order), CSRF backstop (~46 routes).

## Wiring + UX pass (1 session)

P0-AF (Shippo rotate UI), P0-AG (admin messenger NAV), P0-AN (address API duplication), P0-AO (storefront client write), P0-AP (cart Layer 3 capture), P0-AQ (call atomicity), P0-AR (scheduled-send idempotency), P0-AT (pushsubscriptionchange), P0-AU (push events).

## DB hardening pass (1 session)

P0-AV (CHECK constraints), P0-AW (migration drift), P1-AX (HIBP), P1-AY (buckets), P1-AZ (search_path), P1-BA (duplicate indexes), P1-BB (FK indexes), P1-BC (multiple permissive), P1-BD (initplan).

## Polish + ops (1 session)

UX/a11y/mobile items, response envelope normalization, env assertion module, Sentry release + PII scrub, MFA scope, dedicated stale-order cron, Shippo cleanups.

---

# SUMMARY METRICS

- **Compliance hard-rule violations:** ~70 emoji sites + ~10 Title Case sites
- **Audit-log gaps on sensitive admin actions:** 11+ routes
- **CSRF gaps on mutating routes:** ~46
- **Anon-callable RPCs that should be revoked:** 12+
- **RLS policies missing WITH CHECK:** 35
- **Webhook events declared but not emitted or typo'd:** 3 (`price.changed`, `payment_reminder`, underscored variants)
- **Orphaned pages or endpoints with no UI link:** 5
- **DB advisor lints — security:** 26 (mostly multi-permissive and DEFINER exposure)
- **DB advisor lints — performance:** 781
- **Missing CHECK constraints:** 10 columns
- **Missing FK indexes:** 66

This is the full picture. The next "fix it all" instruction can sequence against the execution order above.

---

*Generated by 7-analyst parallel deep-dive on 2026-05-29. Production HEAD `cb3f8030`.*
