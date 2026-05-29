# PepNationLab Comprehensive Gap Report

**Date:** 2026-05-29
**Scope:** pepnationlab.com (62 pages, 179 API routes, 86 components, 59 local migrations, 30 lib files, 10 crons)
**Commit Reviewed:** `4eb4b14` on `main`
**Method:** Four parallel read-only deep-dive passes — Frontend/UX, Backend/API, Database/RLS, Operations/Compliance

---

## Executive Summary

The platform is feature-complete across the planned phases. The audit found:

- **1 active compliance regression** (Layer 1 site-entry disclaimer is orphaned)
- **1 active data-corruption bug** (inventory deduction trigger fires twice on every order approval)
- **~40 P0 security/compliance/financial gaps** that should ship before next material release
- **~60 P1 correctness / coverage holes** (missing webhook/push emissions, missing CSRF on admin routes, broken cron cadence, unindexed hot queries)
- **~80 P2 UX, a11y, mobile, style, and dead-code items**
- **Several outstanding feature gaps** worth deciding on as a roadmap

Nothing here threatens uptime today — the site works. But the disclaimer regression alone makes the legal posture weaker than it was a week ago, and the double-deduct trigger is silently miscounting stock on every approval.

---

# P0 — Critical (Compliance / Security / Data Integrity)

## P0.1 Layer 1 Disclaimer Gate Is Not Mounted

**Symptom:** `components/SiteDisclaimerGate.tsx` is fully built but no longer imported by `app/layout.tsx`. The site-entry gate that records `disclaimer_acceptances.layer = 'site_entry'` and `age_verified = true` is not running in production. The `verified_age = 21` row has not been written for any user since the wrapper was removed.

**Fix:** In `app/layout.tsx`, restore:

```tsx
import SiteDisclaimerGate from '@/components/SiteDisclaimerGate';
...
<SiteDisclaimerGate>
  <CartProvider>{children}</CartProvider>
</SiteDisclaimerGate>
```

## P0.2 Inventory Deducts Twice On Every Order Approval

**Symptom:** Both `trg_deduct_inventory_on_approval` and `trg_deduct_inventory_on_order_approval` are attached to `orders` AFTER UPDATE, both EXECUTE `deduct_inventory_on_order_approval()`. Every approval pulls 2 units from stock per item.

**Origin:** `supabase/migrations/20260521000004_deduct_inventory.sql` plus `20260528000007_update_inventory_trigger.sql` did not DROP the prior trigger.

**Fix:** Drop one trigger and reconcile the current `agent_inventory.stock_count` values against `order_items` deductions since the second trigger was added.

## P0.3 `agent_inventory` Is World-Readable

**Symptom:** The audit hardening migration claimed to lock `agent_inventory` down, but the original `Public can read agent inventory` policy with `USING (true)` was never dropped. Permissive policies are OR-ed, so anonymous PostgREST callers can still enumerate per-agent stock counts.

**Fix:** `DROP POLICY "Public can read agent inventory" ON public.agent_inventory;` and consolidate the four duplicate SELECT policies on this table into one role-scoped policy.

## P0.4 `product_tier_overrides` Multipliers Are Researcher-Readable

**Symptom:** `Authed users can view tier overrides` is still present alongside the role-gated policy. Researchers can enumerate per-product platform margins.

**Fix:** Drop the broad policy; keep only the agent+admin scoped one.

## P0.5 Users Can Update Their Own `role`, `tier`, `prepaid_balance`

**Symptom:** `profiles` UPDATE policy uses `USING (auth.uid() = id)` with no `WITH CHECK`. Via direct PostgREST, a researcher can PATCH their own profile and rewrite `role` to `admin`, lift `prepaid_balance`, or change `referring_agent_id`.

**Fix:** Add `WITH CHECK` that pins `role`, `tier`, `is_active`, `is_super_agent`, `prepaid_balance`, `credit_limit`, `parent_agent_id`, `referring_agent_id` to OLD values for non-admin callers, OR drop the UPDATE policy entirely and route all profile changes through service-role API.

## P0.6 Same `WITH CHECK` Gap On Other Core Tables

Identical issue, exploitable via PostgREST:

| Table | Risk |
|---|---|
| `orders` UPDATE | Agent can change `agent_id` and migrate ownership of an order |
| `agent_products` ALL | Agent can INSERT/UPDATE rows with another agent's `agent_id` |
| `agent_inventory` UPDATE | Agent can re-attribute stock to another agent |
| `agent_profiles` ALL | Agent can mutate another agent's storefront |
| `coupons` ALL | Agent can mint coupons attributed to another agent |
| `super_agent_pricing` ALL | Older permissive policy bypasses the new `WITH CHECK` |

**Fix:** Add `WITH CHECK` clauses that match the `USING` predicate on every one of these; drop older permissive `ALL` policies that overlap a per-cmd policy.

## P0.7 `deduct_prepaid_balance` (4-arg) Is Callable By `anon`

**Symptom:** The 2-arg overload was revoked; the 4-arg overload that the production code actually uses is still callable by anonymous PostgREST clients.

**Fix:** `REVOKE EXECUTE ON FUNCTION public.deduct_prepaid_balance(uuid, numeric, uuid, text) FROM PUBLIC, anon, authenticated;`

## P0.8 Other Definer RPCs Exposed To `anon`

Verified via `has_function_privilege`: `agent_inventory_in_stock`, `mark_message_read`, `redeem_coupon`, `fn_find_direct_conversation`, `fn_get_user_conversations`, `fn_mm_after_insert`, `fn_mm_cleanup_pins_on_delete` are all anon-callable. `redeem_coupon` alone lets a scraper burn a limited-use coupon to zero remaining uses.

**Fix:** `REVOKE EXECUTE` from `anon` (and `authenticated` where the function should only be invoked from server routes).

## P0.9 `messenger_link_previews` Has `WITH CHECK (true)`

**Symptom:** Any authed user can poison link metadata for any conversation. Flagged by Supabase advisor as `rls_policy_always_true`.

**Fix:** Gate by conversation participation.

## P0.10 `auth/verify-agent-access` Trusts `userId` From The Body

**Symptom:** `POST /api/auth/verify-agent-access` reads `userId` from the request body. No session is resolved. Combined with no rate limit, this is a downline-structure enumeration oracle.

**Fix:** Use `supabase.auth.getUser()` and ignore the body's `userId`. Add `rateLimit('verify-agent-access', '20/min')`.

## P0.11 45 State-Changing Routes Have No CSRF Guard

97 of 142 POST/PATCH/PUT/DELETE handlers call `assertSameOrigin`. The 45 unprotected routes include the highest-blast-radius ones:

- `admin/agents/update-password` — admin force-resets any agent's password
- `admin/agents/super-upgrade` — promotes agent to super_agent
- `admin/pricing-tiers/*` — platform multiplier change
- `admin/products`, `admin/orders`, `admin/transactions`, `admin/statements`, `admin/researchers`
- `agent/orders/approve`, `agent/orders/new`, `agent/inventory`, `agent/restock`, `agent/shipping/purchase`, `agent/update-password`, `agent/promote-subagent`, `agent/storefront-slug`, `agent/super-agent/invoices/pay`, `agent/bundles`
- All `messages/*` routes (`broadcast`, `edit`, `archive`, `reactions`, `templates`)
- `invoices/route.ts`, `invoices/remind/route.ts`

**Fix:** Add `assertSameOrigin(req)` at the top of each.

## P0.12 Admin Password Reset Is Not Audit-Logged

`admin/agents/update-password` rewrites any user's password and writes no `admin_audit_log` row. Same for: `admin/agents/super-upgrade`, `admin/agents/update-contact`, `admin/pricing-tiers/*`, `admin/researchers/route.ts` (direct `prepaid_balance` writes bypass the `balance_transactions` ledger), `admin/products`, `admin/statements`, `admin/transactions`.

**Fix:** Insert an `admin_audit_log` row in every one of these handlers.

## P0.13 21+ Age Gate Is Currently Not Recorded Anywhere

Even ignoring P0.1: `disclaimer_acceptances.age_verified` and `verified_age` columns are only written by `SiteDisclaimerGate` (orphaned), never by registration, never by checkout, never by add-to-cart. The 21+ representation in the audit trail is empty since the wrapper was unmounted.

**Fix:** After restoring SiteDisclaimerGate (P0.1), thread `age_verified: true` into the `add_to_cart` and `checkout` POST bodies, and require a 21+ checkbox in `app/api/storefront/register/route.ts`.

## P0.14 `error.message` Leaks To Browser In Production

`app/error.tsx` renders `error.message` directly. In production this can include SQL fragments and table names.

**Fix:** Show only `error.digest` in production; gate `error.message` behind `process.env.NODE_ENV !== 'production'`.

## P0.15 Sentry Is CSP-Blocked

`next.config.ts` CSP `connect-src` does not include the Sentry ingest host. When `SENTRY_DSN` is configured the browser SDK requests are blocked, so frontend errors silently never reach Sentry.

**Fix:** Add `https://*.sentry.io` (or the org-specific subdomain) to `connect-src`.

## P0.16 Storage Bucket `message-attachments` Has An Overly Broad INSERT Policy

`Users message attachments upload` (broad authenticated INSERT) coexists with the folder-scoped `message-attachments sender write`. Permissive policies OR; any authed user can drop files anywhere.

**Fix:** Drop the broad policy.

## P0.17 `messenger_media` Bucket Lists Publicly And Lets Anyone Upload To Any Folder

`public_bucket_allows_listing` lint plus INSERT has no folder scope.

**Fix:** Make the bucket private (signed URLs) and add `AND (storage.foldername(name))[1] = auth.uid()::text` to the INSERT policy.

## P0.18 Migration Collision On Disk

Two files share timestamp `20260530500000`: `disclaimer_order_fk_qty_cap.sql` and `recommendations.sql`. `supabase db push` will fail. Three other disk-only migrations have never been applied to production (the DB was loaded under different filenames).

**Fix:** Rename the colliding file to a new timestamp; reconcile disk vs DB by removing duplicates and adding any genuinely missing one to production.

## P0.19 HaveIBeenPwned Leaked-Password Check Is Disabled

Supabase advisor lint `auth_leaked_password_protection`.

**Fix:** Enable in Auth settings.

---

# P1 — High (Half-Built / Broken / Missing Coverage)

## Backend Coverage

- **`order.cancelled` webhook is not emitted from `admin/orders/[id]/cancel`** — admin-initiated cancellations skip the webhook.
- **`order.shipped` webhook + push is not emitted from `shipping/orders/route.ts`** — when the shipping operator marks an order shipped, the buyer hears nothing. This is the most common transition in the system.
- **`price.changed` webhook is declared but never emitted** — missing from `apply-price-changes` cron, `admin/products/bulk-price`, `admin/agent-products/bulk-price`, `agent/products/bulk-margin`, `agent/products/route.ts`, `admin/pricing-tiers/route.ts`, `admin/pricing-tiers/overrides/route.ts`.
- **Push notifications missing on:** subscription auto-orders, RMA resolve, refund issued, abandoned-cart recovery, admin cancellation, admin refund. Add `order_cancelled` and `order_refunded` event types to `lib/push-enqueue.ts`.
- **`order.created` not emitted from `agent/orders/new` (manual order) or `agent/restock`** — webhook subscribers miss the event.

## Cron Cadence Bugs

- **`push-dispatch` cron runs every 5 minutes but partitions hourly** (`fivemPartitionKey()` uses `slice(0,13)`). 11 of 12 invocations short-circuit. Same bug in **`webhooks-dispatch`**. Either change schedule to `0 * * * *` or change partition to `slice(0,15)`.
- **No cron calls `cancel_stale_pending_orders()`** — pending payment orders never auto-cancel.

## MFA Scope Is Too Narrow

`mfaRequiredRoles = { admin, super_agent }`. Regular `agent` has order approval, restock, payment-collection, sub-agent promotion, and password-reset authority over researchers. `shipping` can transition orders. Both should be in the MFA set. The `/api/auth/*` bypass is also too broad — narrow to an explicit whitelist of signout/resolve/MFA routes.

## Auth / Rate-Limit Gaps

- Missing rate limits on: `cart/refresh`, `shipping-preview`, `auth/verify-agent-access`, `messenger/*` (link-preview, gif-search, upload-media, send, start, report), `messages/broadcast`, `coupons/validate`, `researcher/payment-proof`, `researcher/rma/[id]/upload`, `user/activity`, `researcher/referrals/apply`, `push/test`, `push/subscribe`, `orders` (CLAUDE.md claims 10/min/user but no limiter in code).
- Admin list routes have no rate limit — `admin/sales`, `admin/transactions`, `admin/products` run heavy queries with no per-IP cap.

## Data Quality

- **`shipping-preview` returns `{ rate: 12.00 }` with HTTP 200 on any error** — checkout silently bills $12 every time Supabase hiccups. Return 503 on error.
- **`user/activity` POST never awaits/checks the update error** — returns `success: true` always.
- Many routes use `await req.json().catch(() => ({}))` then destructure without Zod — bad bodies surface as raw Postgres errors. Zod-validate every body.

## Materialized Views Exposed To `anon`

`product_copurchase_pairs` and `product_popular_60d` are selectable by `anon`/`authenticated`. Lint `materialized_view_in_api`. Scrapers can de-anonymize buying patterns.

**Fix:** Move to a non-API schema or restrict to the existing `get_copurchase_recommendations` RPC only.

## Missing Indexes On Hot Queries

| Table | Column | Effect |
|---|---|---|
| `agent_products` | `is_visible` | Storefront filter scans full table |
| `balance_transactions` | `(agent_id, created_at DESC)` | Ledger paging |
| `disclaimer_acceptances` | `(layer, created_at)` | Compliance reporting |
| `internal_messages` | `(receiver_id, created_at DESC)` | Inbox |
| `messenger_messages` | `(conversation_id, created_at DESC)` | Chat scroll |
| `webhook_deliveries` | `(status, next_attempt_at)` | Dispatch worker |

## Uncapped List Endpoints

`admin/researchers`, `admin/agents`, `admin/orders`, `admin/sales`, `admin/coupons`, `admin/statements`, `admin/restock`, `admin/commissions`, `admin/referrals`, `admin/rma`, `admin/store-credits`, `admin/refunds`, `admin/tax-rules`, `agent/commissions`, messenger `list-*` routes — all return full tables with no cap or cursor.

**Fix:** Cap at 100/200 + cursor pagination across all of them.

## Inconsistent Response Envelopes

At least 8 different keys in use: `{ data }`, raw array, `{ items }`, `{ orders }`, `{ messages }`, `{ rmas }`, `{ referrals }`, `{ products }`, `{ favorites }`. The same admin/products route returns `{ data: [...] }` on list and raw `data` on detail.

**Fix:** Add `lib/api-response.ts` with `respond(data, opts)` returning `{ data, page?, total?, next_cursor? }` and convert.

## Webhook Signing Has No Timestamp Header

`X-PNL-Signature: sha256=<hex>` signs the body but no separate `X-PNL-Timestamp` header. Receivers cannot enforce a 5-minute tolerance without parsing JSON. No receiver-side verification example in repo.

**Fix:** Stripe-style `X-PNL-Timestamp` + signature input `${timestamp}.${body}`; document verification.

## CHECK Constraints Missing

`products.weight_oz >= 0`, `products.inventory_count >= 0`, `agent_products.sale_price >= 0`, `orders.{subtotal,discount_amount,shipping_cost,total} >= 0`, `order_items.unit_*_price >= 0`, `pricing_tiers.multiplier > 0`, `product_tier_overrides.multiplier > 0`, `coupons.discount_value >= 0`, `shipping_rates.min_weight_oz <= max_weight_oz`, `webhook_endpoints.event_types <> '{}'`. Negative numbers and bad bounds slip in via direct DB writes.

## Frontend Coverage

- **No global Navbar** — each role has a separate header pattern; logout placement is inconsistent.
- **`/account` hub is orphaned** from the researcher dashboard and Navbar — users can't reach it without typing the URL.
- **`app/admin/messenger/` page exists with no admin nav entry.**
- **`app/admin/layout.tsx` sidebar is non-responsive on mobile.**
- **22 raw `<img>` tags bypass `next/image`** — wasted bandwidth + bad LCP.
- **`components/Messaging.tsx` contains emoji arrays (`EMOJI_QUICK`, `EMOJI_FULL`)** — this is the largest direct violation of the "no emojis anywhere" rule.
- **Emoji rule violations also in:** `app/admin/messages/page.tsx`, `app/shipping/page.tsx`, `app/dashboard/page.tsx`, `components/AdminAnalytics.tsx`, `components/ResearcherDashboard.tsx`, `app/api/invoices/remind/route.ts`. Roughly 50+ instances total.

## Dead / Orphan Routes

- `app/api/cron/sms-dispatch/route.ts` — 410 tombstone, not in `vercel.json`. Delete.
- `lib/twilio.ts`, `lib/sms-enqueue.ts` — throw-on-import stubs. Confirm no imports remain, then delete.
- `app/api/preferences/notifications/route.ts` — superseded by `app/api/account/notifications/route.ts`. Pick one.
- `RESEND_API_KEY`/`RESEND_FROM_EMAIL` still in `.env.local.example` — stale (email is disabled).

---

# P2 — Medium (UX, A11y, Mobile, Performance, Style)

## Style / Compliance Violations

- ~50+ emoji instances across the files listed above. CLAUDE.md hard rule.
- Several admin/agent pages have non-Title-Case strings in placeholders, toasts, and error messages.
- Hardcoded `noreply@pepnationlab.com` in `lib/shippo.ts` and `lib/shippo-returns.ts` as Shippo address-block placeholder; `payments@pepnationlab.com` in `CheckoutForm.tsx`. Should be agent-configurable.

## Performance

- Most policies still call raw `auth.uid()` and `is_admin()`. Wrap in `(SELECT auth.uid())` / `(SELECT is_admin())` so the planner caches per statement.
- 4 duplicate SELECT policies on `agent_inventory`, 2 on `internal_messages`, 2 on `archived_conversations`, etc. — duplicate permissive policies multiply scan cost.
- Two `agent_commissions.payout_id` FK constraints (`agent_commissions_payout_id_fkey` + `fk_commission_payout`) — drop one.
- Two refresh functions (`refresh_recommendation_views` and `refresh_recommendation_views_plain`) — pick one and drop the other.

## A11y

- Many storefront product cards have no `alt` text on `<img>`.
- Modal overlays (Cart, DisclaimerGate when mounted) trap focus inconsistently.
- Color contrast on `#A8B4C0` silver text against `#0F1923` is below WCAG AA in some places — verify.
- No skip-to-content link.

## Mobile

- Admin sidebar — already noted, non-responsive.
- Checkout form is dense on iPhone SE width; state-dropdown overflows on landscape.
- Messenger lacks gesture handling.

## Operations

- `/api/health` returns OK without checking Supabase or cron lag — Vercel monitors stay green during Supabase outages.
- No `pushsubscriptionchange` handler in `public/sw.js` — Chrome key rotation breaks subscriptions silently.
- No startup env-var assertion module — misconfigured production looks green while features silently no-op.
- `.env.local.example` is out of sync with reality — missing `TENOR_API_KEY`, `LIVEKIT_*`, `UPSTASH_*`, `VAPID_*`, `SENTRY_*`, `CRON_SECRET`; still lists `RESEND_*`.
- No `.github/workflows/` — no CI lint, no `tsc --noEmit` gate, no `npm audit` gate.

---

# Outstanding Feature Gaps (Roadmap Decisions)

Items that are NOT bugs but are clearly absent vs the platform model:

1. **Account / Addresses screen** — saved addresses only manageable inline in checkout; no `/account/addresses` page even though `saved_addresses` table exists.
2. **Notification bell in Navbar** — no surface for the push/messages center.
3. **Self-serve subscription management UI for researchers** — subscriptions table exists, no `/account/subscriptions` page (or it's stubbed).
4. **Self-serve RMA tracking for researchers** — `/account/returns` viewing the RMA timeline.
5. **Agent storefront analytics for the agent themselves** (not just admin) — pageviews, conversion, top-search-term breakdown.
6. **Super-agent dashboard rollup** — aggregate revenue + commissions across all downline agents in one screen.
7. **Coupon-stacking rules engine** — current model is one coupon per order; bundle + coupon combinability is implicit.
8. **Researcher saved-card-substitute for repeat orders** — since no credit cards, a "default payment method" selector (Zelle / Venmo / etc.) per researcher would shave a step.
9. **Audit-log viewer UI** — `admin_audit_log` rows exist but no admin page renders them.
10. **Webhook receiver verification example** — JS + Node snippet in docs for partners.
11. **API key rotation flow** for agents (Shippo key, webhook secret) — currently silent overwrites.
12. **A signed receipt artifact** that agents can hand researchers (PDF? HTML?) — would be useful for prepaid-balance receipts.
13. **In-app banner for stale browsers** that don't support `Notification` / service worker.
14. **Status page** with real DB ping + cron lag, public at `/status`.
15. **Backup posture documentation** — Supabase PITR retention is invisible from the repo.

---

# Recommended Sequence

If you want a single concrete plan:

**Hotfix sprint (1 session):** P0.1, P0.2, P0.18, P0.14, P0.15, plus restore push/webhook cadence (P1 cron fixes).

**Security pass (1 session):** P0.5–P0.12, P0.16, P0.17, plus expanding MFA scope and adding CSRF to the 45 unprotected routes.

**Compliance + observability pass (1 session):** Audit-log writes (P0.12), 21+ recording (P0.13), enable HIBP (P0.19), wire Sentry breadcrumbs into the top-10 risky routes, real `/api/health`, add CI workflow.

**Coverage pass (1 session):** Missing webhook emissions, missing push emissions, missing indexes, response-envelope normalization, list pagination.

**Polish pass (1 session):** Emoji rule violations, Title-Case sweep, raw `<img>` migration, mobile sidebar, account-page wiring, `/account/addresses`, `/account/subscriptions`, notification bell, audit-log viewer.

After each pass: build → audit → fix → push → verify prod (per the existing per-phase rule).

---

*Generated by parallel analyst pass on 2026-05-29.*
