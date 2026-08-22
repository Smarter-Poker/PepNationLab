# PepNationLab Admin Panel — Hardening & UX Report

**Date:** 2026-07-12
**Scope:** The full admin panel of pepnationlab.com — authentication/RBAC, order
management, product & inventory, user/customer management, cross-cutting security,
UX, and resilience.
**Codebase:** Next.js 16.2.6 (App Router) / React 19 / Supabase `ydsaqnnuwyvtyxgvrnys`.
**Method:** An 8-lens audit swarm read the actual route handlers, guards, DB
migrations, and client components; every finding below was traced to a real file
and line. High-value, low-regression fixes were implemented and type-checked
(`tsc --noEmit`, 0 errors in changed files); the remainder are documented with
ready-to-apply code.

> Note on posture: this is already a well-defended codebase. Prior audits landed —
> all 76 admin API routes carry an auth guard and a CSRF (`assertSameOrigin`)
> check, order cancellation and coupon redemption are atomic RPCs, RLS is on every
> table, and `proxy.ts` (Next 16's renamed middleware) enforces auth, an `is_active`
> kill-switch, and a `must_change_password` gate at the edge. The work here closes
> the residual gaps: money paths that were path-dependent, sensitive actions that
> left no audit trail, a role-escalation hole, and destructive UI actions with no
> confirmation.

---

## 1. Swarm Launch Confirmation

Eight specialized lenses ran against the admin surface:

- **ALPHA** — Authentication, RBAC, session, privilege escalation
- **BETA** — Order management: status changes, cancels, refunds, bulk actions, labels
- **GAMMA** — Product & inventory: CRUD, pricing, bulk edits, COA/lots, images
- **DELTA** — User/customer management: accounts, tiers, roles, impersonation, PII
- **EPSILON** — Cross-cutting security: CSRF, rate limiting, injection, audit coverage
- **ZETA** — UX: confirmations, feedback, loading states, information hierarchy
- **THETA** — Resilience: double-submit, races, optimistic vs pessimistic, error handling
- **OMEGA** — Coordination, prioritization by risk × daily impact, and implementation

---

## 2. Admin Critical Path Map (most used + highest risk)

| Rank | Surface | Why it matters daily | Risk class |
|------|---------|----------------------|------------|
| 1 | Admin auth / session (`proxy.ts`, `lib/admin-auth.ts`) | Gate for the entire panel | Full compromise |
| 2 | Order status / cancel / bulk (`/api/admin/orders*`) | Most-used daily workflow; moves money & inventory | Revenue, data integrity |
| 3 | Shipping labels (`orders/bulk` generate_labels, `shipping-provider/*`) | Billable EasyPost spend on click | Direct money loss |
| 4 | Pricing (`pricing-tiers`, `products` base_cost, `bulk-price`) | Cascades to every storefront's prices | Platform-wide money |
| 5 | Agent/user management (`agents/*`, `researchers`) | Roles, tiers, balances, passwords | Privilege & money |
| 6 | Manual balance / payments (`transactions`, `payments`) | Direct ledger mutation | Money integrity |
| 7 | Bulk product import (`products/bulk-import`) | Mass catalog/inventory writes | Catalog corruption |

---

## 3. Hardening Report (by severity × daily impact)

### CRITICAL

- **C1 — Backdoor admin creation via `account_role`.** `POST /api/admin/agents`
  wrote the caller-supplied `account_role` straight into `profiles.role` with no
  allowlist, so `account_role:'admin'` minted a new admin (persistence backdoor,
  no audit). **FIXED** — allowlisted to `agent | super_agent | researcher`.
- **C2 — Plaintext passwords stored and served.** `profiles.provisioned_password`
  holds admin-set cleartext passwords and was returned in list responses,
  including cross-role to agents for their whole downline (an agent could harvest
  every downline researcher's live login). **PARTIALLY FIXED** — removed from the
  agent-facing downline route (`/api/agent/agents/[id]`). Full remediation (drop
  the column / one-time-display only) is a product decision — see Remaining Risks.
- **C3 — Bulk CSV import silently resets omitted fields.** A price-only update CSV
  pushed through a full-row upsert, zeroing `inventory_count`, wiping
  descriptions/images/SKUs, and republishing deactivated drafts for every matched
  product. **DOCUMENTED with ready code** (sparse per-column update) — see
  Remaining Risks; not yet applied (touches the import commit path and warrants a
  focused test).

### HIGH

- **H1 — Bulk order approval skipped the credit-line charge.** Single-order
  approval calls `charge_order_credit_line`; the bulk path did not, so any order
  approved via bulk never consumed the agent's credit headroom — path-dependent
  revenue leakage. **FIXED**.
- **H2 — No optimistic locking on status transitions (TOCTOU).** Read-status →
  validate → unconditional UPDATE let a concurrent cancel be overwritten by a
  stale "mark shipped" (cancelled order shows shipped; inventory double-restored;
  agent ships unbilled). **FIXED** — conditional update on the validated status,
  409 on concurrent change (single + bulk routes).
- **H3 — Sensitive money/role actions left no audit trail.** `update-tier`,
  `super-upgrade`, `tier-override`, `update-password`, `update-agent`,
  `pricing-tiers`, `transactions`, and single-product create/update wrote no
  `admin_audit_log` row. **FIXED** — all now log via a shared `writeAuditLog`
  helper (`lib/admin-audit.ts`).
- **H4 — `update-agent` had no admin-target guard & bypassed the ledger.** One
  admin could deactivate a co-admin (or self) and rewrite any admin's money
  fields by id. **FIXED** — admin-target guard added + change is now audited.
  (Ledger-routing of `prepaid_balance` remains recommended — see Remaining Risks.)
- **H5 — `researchers` role-change / toggle_active had no admin-target guard.**
  Same admin-on-admin demotion / lockout risk. **FIXED** — admin-target guard on
  every mutating action.
- **H6 — Bulk price deltas were unbounded.** Only `set` was floored at 0;
  `percent_delta`/`flat_delta` accepted any value, driving prices to $0/negative
  catalog-wide (then charged at $0). **FIXED** — bounded all adjustment types on
  both the master and agent-product bulk-price routes.
- **H7 — `assertMfaRecent` always returned 403.** It read `session.amr`, which
  doesn't exist on the Supabase session, so the EasyPost connect/rotate/disconnect
  MFA gate was permanently broken (and a trap for a future "just delete the gate"
  fix). **FIXED** — uses `mfa.getAuthenticatorAssuranceLevel()`.
- **H8 — `/api/admin/**` had no role gate at the edge.** `proxy.ts` checked only
  authentication for API routes; role was enforced solely in-handler. **FIXED** —
  edge role gate for `/api/admin` (admin-only, with the two `requireOrdersAccess`
  fulfillment routes exempted for `shipping`) and `/shipping`.

### MEDIUM

- **M1 — Order cost basis leaked to the shipping role.** `orders/items` returned
  `*`, exposing `unit_cost_price` / `unit_super_agent_cost` (COGS, margin) to a
  fulfillment-only role. **FIXED** — non-admins get a fulfillment column subset.
- **M2 — Cancel audit insert was unguarded.** An audit-insert throw after a
  committed cancel would surface as a 500 and mislead the operator. **FIXED** —
  wrapped in try/catch like every other route.
- **M3 — Same-status re-save re-fired push + webhook.** `canTransition` returns
  true for `from === to`, so re-saving a shipped order re-notified the buyer and
  re-dispatched the webhook. **FIXED** — side-effects gated on an actual change.
- **M4 — Product PATCH validated only `base_cost`.** Negative `inventory_count`,
  negative `admin_bulk_price`, oversized `name`/`image_url` persisted silently.
  **FIXED** — non-negative integer/money bounds + length caps added.
- **M5 — Bulk labels bought postage for any status.** A mixed batch including a
  cancelled/unpaid order bought a real label and fired a bogus "shipped" push.
  **FIXED** — label purchase restricted to shippable statuses.
- **M6 — CSV formula injection in exports.** `escapeCSVCell` quoted per RFC 4180
  but didn't neutralize a leading `= + - @`, so a researcher named
  `=WEBSERVICE(...)` executed when an admin opened an export. **FIXED**.
- **M7 — Non-atomic manual balance writes.** `transactions` read-modify-writes
  `prepaid_balance` (last-writer-wins vs a concurrent debit). **AUDIT ADDED**;
  atomic RPC delivered as a paired migration to apply with deploy (see §8).

### LOW (documented, not all applied)

Impersonation session has no server-side TTL (cookie-only); admin payments route
has no idempotency key (replay double-credit risk); statements `mark_paid` has no
already-paid guard; verified COA file bytes can be replaced before the row-freeze
check; client-declared MIME trusted on image/COA uploads; CSP keeps
`script-src 'unsafe-inline'`; rate limiting is effectively per-instance without
Upstash in prod; `flash-sales` PATCH can invert its date window and stack below
cost. Each has a concrete fix in the per-domain findings and in §8.

---

## 4. Implemented Code Changes

25 files changed (24 edits + 1 new helper). All pass `tsc --noEmit` with zero
errors attributable to these changes.

**New**
- `lib/admin-audit.ts` — shared, best-effort `writeAuditLog()` so sensitive
  admin mutations log a uniform `admin_audit_log` row and an audit failure can
  never mask the action.

**Auth / edge / RBAC**
- `proxy.ts` — edge role gate for `/api/admin` (admin-only; `shipping` allowed on
  `orders` + `orders/items`) and `/shipping`.
- `lib/admin-auth.ts` — `assertMfaRecent` fixed to use the MFA assurance-level API.
- `app/api/admin/agents/route.ts` — `account_role` allowlist (kills backdoor-admin).

**Orders / money**
- `app/api/admin/orders/bulk/route.ts` — credit-line charge on bulk approve;
  optimistic-lock update; label purchase gated to shippable statuses; operator
  cancel reason threaded through + audited.
- `app/api/admin/orders/route.ts` — optimistic-lock update (409 on concurrent
  change); push + webhook gated on an actual status change.
- `app/api/admin/orders/[id]/cancel/route.ts` — audit insert wrapped in try/catch.
- `app/api/admin/orders/items/route.ts` — cost-basis columns stripped for non-admins.

**Pricing / catalog**
- `app/api/admin/products/route.ts` — PATCH numeric/length validation; audit on
  create and update.
- `app/api/admin/products/bulk-price/route.ts` and
  `app/api/admin/agent-products/bulk-price/route.ts` — bounded all delta types.
- `app/api/admin/pricing-tiers/route.ts` — audit with before→after multiplier.

**Users / agents**
- `app/api/admin/agents/update-tier|super-upgrade|tier-override|update-password/route.ts`
  — audit rows added.
- `app/api/admin/agents/update-agent/route.ts` — admin-target guard + audit.
- `app/api/admin/researchers/route.ts` — admin-target guard on all mutations.
- `app/api/admin/transactions/route.ts` — audit row (paired atomic RPC in §8).
- `app/api/agent/agents/[id]/route.ts` — `provisioned_password` removed from the
  agent-facing downline response.

**UX / resilience**
- `components/AdminAgents.tsx` — confirmation before an agent tier change (which
  silently re-prices the agent's whole storefront); no-op skip when unchanged.
- `app/admin/orders/page.tsx` — confirmation before bulk **Generate Labels**
  (billable) and bulk **Mark Delivered** (terminal).
- `app/admin/products/[id]/page.tsx` and `app/admin/products/new/page.tsx` —
  try/catch/finally around save so a network drop can't leave the button stuck
  on "Saving…" with no feedback.

**Utilities**
- `lib/export.ts` — CSV formula-injection neutralization.

---

## 5. UX Improvements Made

- Dangerous, money-spending, or irreversible actions now confirm before firing:
  agent tier change (global re-pricing), bulk Generate Labels (billable), bulk
  Mark Delivered (terminal). Cancel already had a modal; these close the rest of
  the gap.
- Product create/edit can no longer get stuck on "Saving…" — every failure path
  clears the spinner and surfaces a clear, Title-Case error.
- A stray click / arrow-key / mobile scroll on the tier `<select>` no longer
  silently re-prices a storefront; unchanged selections are a no-op.

## 6. Security Improvements Made

- Closed the role-escalation hole that let a crafted request mint an admin.
- Added an edge role wall in front of every `/api/admin` route (defense in depth
  over the existing in-handler guards).
- Repaired the MFA-recency gate so step-up auth on EasyPost key operations
  actually works.
- Stopped agents from reading their downline's plaintext passwords.
- Prevented spreadsheet formula injection via exported CSVs.
- Gave the sensitive money/role/pricing actions a uniform audit trail.
- Bounded price adjustments so a single edit can't zero or negate catalog pricing.
- Confined order cost basis to admins.
- Added optimistic locking so concurrent order actions can't corrupt state.

## 7. Final Admin Panel Score (Before → After)

**Before: 82 / 100.** Strong guards and CSRF everywhere, atomic money RPCs, RLS
throughout — held back by a role-escalation hole, path-dependent money bugs,
inconsistent audit coverage, and destructive UI with no confirmation.

**After implemented changes: ~92 / 100.** The escalation hole is closed, the
daily money paths (bulk approve, bulk labels, tier/price changes) are guarded and
audited, concurrent order actions are race-safe, and the riskiest UI actions
confirm. The remaining points are the items in §8 — chiefly the plaintext-password
decision, the CSV-import sparse-update fix, and the atomic balance RPC — plus ops
config (Upstash) and the CSP nonce migration.

---

## 8. Remaining Risks / Recommended Next (with ready code)

Apply-with-deploy and product decisions that were intentionally not force-shipped:

1. **Atomic manual balance RPC (M7).** Migration delivered at
   `_hardening/20260712000000_atomic_admin_balance_adjustment.sql`. Apply it, then
   swap the read-modify-write in `transactions/route.ts` for the RPC call (the
   audit insert already added stays). Same pattern for `update-agent` balance edits.
2. **Plaintext password store (C2).** Product decision: drop
   `provisioned_password` and show a one-time credential in the create response
   only, relying on `must_change_password`. Until then it remains a standing
   credential store; at minimum stop selecting it in the admin list responses
   (`agents`, `agents/researchers`, `researchers`) where it isn't displayed.
3. **Bulk CSV import sparse update (C3).** Change the update path to patch only
   the columns present in the CSV (full-row insert only for new rows). Prevents
   silent inventory/description/draft destruction on a partial-column update.
4. **Admin payments idempotency.** Wrap the `payments` POST in `withIdempotency`
   and send a per-intent `Idempotency-Key` from the page to prevent replay
   double-credits. (Catalog bulk-price and orders UIs should also send keys so
   the existing `withIdempotency` wrappers stop being no-ops.)
5. **Statements `mark_paid` guard.** Reject an already-paid statement and audit
   `generate` so payment evidence can't be overwritten.
6. **Verified COA byte-freeze.** In the COA POST/DELETE, return 409 when
   `coa_verified_at` is set *before* touching storage, mirroring the lot route.
7. **Upload MIME sniffing.** Route admin image/COA uploads through `sniffImageMime`
   (magic bytes) instead of trusting client `file.type`; cap size.
8. **Impersonation TTL.** Enforce `started_at + TTL` in `getImpersonationContext`
   (currently cookie-only) and sweep stale rows.
9. **CSP `script-src 'unsafe-inline'`.** Move to a nonce-based CSP to restore the
   XSS protection the CSP is meant to provide.
10. **Ops: confirm Upstash is set in production** so rate limiting is cluster-wide
    rather than per-instance in-memory. Add `npm audit` to CI.

**Environment note:** the unit test suite could not be executed here — the Mac's
`node_modules` is missing the `@rollup/rollup-linux-arm64-gnu` native binary (a
known npm optional-deps bug), which needs a `npm install` with network access.
Run `npm test` locally once deps are repaired to exercise the changed paths.

**Deploy note:** changes were written to the working copy and type-checked; they
were **not** committed, pushed, or deployed, and no database migration was applied
— per the platform's strict git-identity and ship rules, those steps are left to
you.
