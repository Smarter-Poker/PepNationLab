# PepNationLab Enhancement & Upgrade Roadmap

**Date:** 2026-07-11
**Method:** 4 parallel scout agents surveyed the whole platform (storefront, agent tooling, admin/ops, cross-cutting). Findings are grounded in the actual code.
**Platform state (live DB):** pre-launch — 0 orders, 111 active products, 2,848 agent listings, 24 agents, 11 researchers. Full catalog and deep tooling exist; transaction volume has not started.

## The one theme that matters

This codebase is far more mature than its docs suggest. Across all four domains the same pattern appears: **the hard machinery already exists but dead-ends before it reaches a user.** The recommendation engine is computed but never shown to shoppers; the agent home screen throws away the live KPIs it's handed; the `agent_invitations` recruiting system is fully schema'd with RLS but has zero code; reorder suggestions compute a cart nobody can click; downline-notify is locked to coupons; profit data sits unused in `order_items`; and there is no runtime feedback loop (no web-vitals, unverified error tracking, a Lighthouse budget that never runs).

So the highest-ROI work is **surface, connect, and instrument** — not net-new systems. And because a concurrent session owns the Shippo→EasyPost shipping refactor and the COA workflow, the safest sequencing favors isolated new routes/tables/components over edits to the hot files (`AgentStorefrontGrid.tsx` 4,117 lines, `CheckoutForm.tsx` 1,492 lines, `AgentOverview.tsx`, `lib/shipping.ts`, `app/admin/coa/*`).

## Sequenced roadmap (impact × safety)

### Phase A — Launch-critical growth (do first; pre-launch state makes these the priority)

1. **Agent invitation / downline recruiting** *(FLAGSHIP — building now)*. Wire the orphaned `agent_invitations` table: mint shareable invite links + QR, manage/revoke, public redeem → account creation. Core to the multi-tier GMV model; `/invite` and `/api/agent-invitations/redeem` are already reserved in middleware. NEW isolated routes/UI — low collision.
2. **Live agent Action Center.** Replace the static-PNG `AgentOverview` (which ignores the live KPI props it receives) with real data: today/week revenue, orders needing approval, low-stock, unpaid balance, action list. High impact; MEDIUM collision (hot dashboard files) — sequence when main is clean.
3. **Storefront conversion kit.** Featured/hero product curation + shareable read-only store preview link so agents can QA and promote before launch. Mostly isolated.

### Phase B — Demand capture & conversion (as traffic starts)

4. **Back-in-stock & price-drop alerts.** "Notify Me" on OOS/wishlist → cron dispatch via existing push/email infra. NEW isolated table + cron.
5. **Checkout cross-sell / smart cart upsell.** Surface the already-built `/api/cart/recommendations` engine as "Frequently Bought Together." Deliver as a self-contained `<CartUpsell>` component to drop into the checkout rewrite.
6. **Verified-purchase reviews & ratings** (compliance-safe: quality/reconstitution/packaging/shipping, not efficacy). Biggest missing trust lever. Backend isolated; card badge is a late, tiny edit.
7. **Live social-proof badges** ("12 sold this week") from the `storefront/events` data already collected but never surfaced.

### Phase C — Retention & recurring revenue

8. **Subscribe & Save auto-refill** — graduate the existing manual refill hub + `refill-reminders` cron into true recurring orders. (Sequence after the order-route refactor lands.)
9. **Researcher referral program** (buyer→buyer), reusing the credit/ledger + `referrals-fulfil` plumbing.
10. **Researcher broadcast center** for agents — generalize the coupon-only `notify-downline` into stock/announcement broadcasts.

### Phase D — Operations & financial control (as orders flow)

11. **Pricing "what-if" preview** before a tier-multiplier change shows the blast radius (rows repriced, avg delta, any SKU at/below cost). Highest financial-safety gap.
12. **Profit & margin dashboard** — `order_items` already stores cost + retail + super-agent cost; surface true P&L by SKU/agent/period. (Empty until orders exist — hence Phase D.)
13. **Unified admin alert center + cron dead-man's-switch** — consolidate the excellent-but-scattered detection (integrity, balances, inventory, COA, failed crons) into one decision surface and alert when a cron silently stops firing.
14. **AR aging & payment reconciliation**, **fraud/abuse monitoring**, **bulk catalog operations**, **inventory reconciliation**.

### Phase E — Platform quality (continuous)

15. **Runtime feedback loop (do early, it's cheap):** wire `useReportWebVitals` (RUM), verify the Sentry DSN in prod, and connect the existing-but-never-run `lighthouserc.js` to a CI workflow with an LCP budget. You can't manage perf you can't see.
16. **Fix mobile LCP** — the homepage is a single 1.9 MB portrait raster; add `preconnect` + blur placeholder now (S), rebuild as real HTML/CSS later (L, also a big a11y/SEO win). Mobile LCP is ~7.8s vs 2.5s target.
17. **Accessibility baseline** (Lighthouse never ran the a11y category; ESLint is disabled), **skeleton `loading.tsx`** for checkout/orders/account/products, **PWA raster icons**, and incremental **nonce-CSP** to drop `script-src 'unsafe-inline'`.

## Collision map (why the sequencing)

- **Safe to build now (isolated):** invitations, back-in-stock, referral, broadcast, web-vitals/RUM, Lighthouse CI, skeleton loaders, PWA icons, fraud/AR/alert-center (new routes+tables+pages).
- **Wait for main to settle (hot files):** Action Center, cart upsell, review badges, free-ship nudge (touch `AgentStorefrontGrid`/`CheckoutForm`/`AgentOverview`); COA surfacing (actively contended); admin RBAC and nonce-CSP (cross-cutting `admin-auth`/`middleware`/`next.config`).

---
*Flagship (item 1) is implemented in this session as new, isolated files — see the invitation system routes, `components/AgentInvitations.tsx`, and `app/invite/[token]/`.*
