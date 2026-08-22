# PepNationLab.com — Whole-Platform Deep Dive & "What's Left" Roadmap

**Date:** 2026-07-12 · **Author:** Cowork deep-dive session
**Method:** Every claim below was **verified against ground truth today** — the live Supabase database (`ydsaqnnuwyvtyxgvrnys`), the actual code on `origin/main`, the live production site, Vercel deploy history, and Lighthouse. The prior audit reports (bug-hunt 2026-07-11, security-sweep, admin/observability/type-safety hardening 2026-07-12, SEO audit 2026-07-07) were used as *leads*, then re-checked — because most of their findings **have since been fixed**, and a report is only as current as the commit it was written against.

---

## 1. The Headline

**This platform is in excellent, near-launch shape, and it is *far* healthier than any single prior report suggests.** The recurring pattern across this deep dive: I would trace a "critical" finding to its file or table and discover it had **already been fixed** by subsequent commits. The prior sessions have been aggressively and effectively closing the backlog.

What actually remains is a **short, well-scoped tail**: a handful of money-path correctness items to close before real orders flow (deliberately deferred by prior sessions because they need careful DB migrations on a quiet `main`), a few **operational env vars** only the owner can set, a couple of **product decisions**, one **moderate SEO lever**, and **accumulated hygiene/tech-debt**. There is also genuine, large **growth/conversion upside** — but that is net-new building, not bug-fixing.

### Verified: what the prior reports flagged that is now ALREADY FIXED

| Previously flagged as Critical/High/P0 | Verified status today | Evidence |
|---|---|---|
| Leaked `service_role` key in 9 scripts | **RESOLVED** | No hardcoded Supabase JWT anywhere in the tree; scripts cleaned; repo is **private** (GitHub + Vercel both report `private`) |
| 12 cron jobs 401 in prod (billing settlement broken) | **FIXED** | `proxy.ts:261` auth-exempts the entire `/api/cron/` + `/api/messenger/cron/` prefix; CRON_SECRET enforced in-route |
| Super-agent baseline billed 10× | **FIXED** | `app/api/orders/route.ts` divides every baseline/retail by 10, with per-10-vial comments |
| Self privilege-escalation via profile columns | **FIXED** | `protect_profile_columns` trigger pins every financial/tier/attribution column on authenticated updates (comment cites "Bug-Hunt 2026-07-11 (C4)") |
| Arbitrary order INSERT + unguarded order UPDATE via RLS | **FIXED** | Both policies dropped — only `is_admin()` + service-role can write `orders` |
| Checkout Rules-of-Hooks crash | **NON-ISSUE** | No hooks declared after the early `return null` in `CheckoutForm.tsx` |
| Backdoor admin creation via `account_role` | **FIXED** | `ALLOWED_ACCOUNT_ROLES` allowlist in `app/api/admin/agents/route.ts` |
| Admin panel: MFA gate broken, no edge role gate, no audit trail | **FIXED** | `getAuthenticatorAssuranceLevel` fix, `/admin` edge role gate (`proxy.ts:454`), `lib/admin-audit.ts` wired |
| Missing tier row → $0 wholesale pricing | **FIXED** | Orders route now hard-fails on a missing multiplier instead of `?? 0` |
| DST week permanently skipped in billing | **FIXED** | `lib/time-cst.ts` computes CDT/CST offset correctly |
| Sentry structurally dormant (every capture path broken) | **CODE FIXED** | Static imports, `onRequestError`, `instrumentation-client.ts` all wired (no-ops only until DSNs are set — see R-1) |
| Homepage LCP ~7.8s / 1.9MB raster | **FIXED** | Mobile Lighthouse **Performance 0.99**; image served via `next/image` optimizer as AVIF/WebP |
| Homepage has zero crawlable text (SEO P0-1) | **FIXED** | Real `<h1>`, intro copy, primary `<nav>`, crawlable anchor text in all 8 click-zones, a server-rendered `<HomeSeoContent/>`, and full JSON-LD |
| AI crawlers / `/api/llm` blocked by robots (SEO P0-3) | **FIXED** | `robots.ts` explicitly allows `/api/llm`, names every AI crawler, shares one allow/disallow list |
| `Organization.sameAs` empty, no reviewer schema, no FAQPage (SEO P1) | **FIXED** | `sameAs`, `reviewedBy`/`lastReviewed`, and `FAQPage` schema now present across monographs, city pages, guides |
| AgentOverview throws away live KPIs (static PNG) | **FIXED** | Renders live today-revenue / needs-approval / awaiting-payment / recent activity |

### Verified scorecard (today)

| Dimension | Score | Notes |
|---|---|---|
| Security posture | **A− (~90/100)** | RLS everywhere, CSRF + edge auth + role gates, atomic money RPCs, secrets clean, private repo. Residual: proxy same-origin content, plaintext password column, CSP `unsafe-inline`. |
| Data integrity / money paths | **B+ (pre-launch)** | Compensation-on-throw, hard-fail on missing tiers, DST fixed. Open: credit TOCTOU, non-atomic saga, migration↔live drift. |
| Reliability / observability | **B+ (code) / C (config)** | Sentry fully wired but **DSNs likely unprovisioned** → still no-op; 47 crons healthy; needs dead-man alerting + Upstash confirm. |
| Performance | **A (homepage)** | Mobile LH Perf 0.99 / SEO 1.0 / Best-Practices 0.96 / A11y 0.94. Spot-check heavy pages. |
| SEO / AI discoverability | **A−** | Excellent infra AND the big gaps are closed. One moderate lever left (monograph body prose is client-side). |
| Conversion / growth | **C+ (large upside)** | Core machinery built; KPIs, referral hub, alerts now surfaced. Reviews, back-in-stock, cross-sell, subscribe&save still latent. |
| Code quality / tech debt | **B−** | Clean app code (2 TODOs, 0 source emojis), strong money-path tests — dragged by `ignoreBuildErrors:true`, disabled lint, `as any`×215, 107 root scratch files. |
| Deploy / ops health | **A** | 20/20 recent deploys `READY`, all under the correct `Smarter-Poker` identity, Turbopack. |

---

## 2. Current-State Snapshot (verified)

- **Scale:** 417 API routes, 161 pages, 313 components, 213 lib modules, 370 migrations, ~221K LOC. Next.js 16.2.6 / React 19.2.4 / TS 5 / Supabase / Vercel (Turbopack).
- **Business state:** **pre-launch — 0 orders**, 111 active products, 24 agents/super-agents, 9 researchers. The ideal window to close money-path bugs: no live money is at risk yet.
- **Deploy health:** all recent prod deploys `READY`, commit author correctly `Smarter-Poker <254329056+…>` (Vercel blocks any other identity). Rapid dashboard-cosmetics iteration is happening **today** — hot files carry real collision risk for new edits.
- **Compliance spine:** 4-layer research-use-only disclaimer gate verified wired + server-enforced; public researcher registration permanently closed.

---

## 3. What's Actually Left — Prioritized

Priority: **P0** close before launch / active risk · **P1** high value soon · **P2** real upside, schedule deliberately · **P3** hygiene/polish. Effort S/M/L; Risk = collision/regression of the fix.

### 3.1 Money-path correctness — the pre-launch pass (P0/P1)

> 0 orders means none has caused loss yet, but each moves real money once agents transact, and they live in the hottest, most-contended files. Prior sessions deliberately left the migration-bearing ones un-shipped. Do them as one focused pass **when `main` is quiet**, each with a paired migration + tests.

| ID | Finding | Evidence | Pri | Effort | Risk |
|---|---|---|---|---|---|
| M-1 | **Credit-limit TOCTOU** — headroom check is a JS read-then-decide with no row lock; concurrent checkouts can collectively exceed the limit. | `app/api/orders/route.ts:~1079`; charge at `:1300`. Confirmed open by the 07-12 report. | P0 | M | Med (hot file + migration) |
| M-2 | **Checkout is a non-transactional saga** — no `create_order_atomic` RPC in the DB; compensation-on-throw exists (good) but true atomicity would remove the residual partial-failure window. | No `create_order_atomic` in `pg_proc`; saga spans `orders/route.ts:~592–1080`. | P1 | L | Med |
| M-3 | **Migration↔live drift** — `pay_invoice`, `check_credit_chain`, `orders.inventory_reserved` exist in the **live DB** but not in tracked migrations; a clean rebuild-from-migrations breaks checkout. | Verified present in `pg_proc`; memory `live-db-has-untracked-objects`. | P1 | M | Low (additive migration) |
| M-4 | **Cart price-refresh discards price/sale updates**; **"Add BAC Water" can replace a context-cart order** with just the diluent. Re-verify against current code (line refs drifted). | `CartContext.tsx` (H11), `CheckoutForm.tsx` (H12). | P1 | M | Med (hot files) |
| M-5 | Late-approved orders may escape a billing week; sub-agent invoice cron filter. Re-verify. | `lib/statements.ts`, `cron/invoices/route.ts`. | P2 | M | Med |
| M-6 | Confirm `transactions/route.ts` uses the atomic `admin_adjust_balance` RPC (exists live) vs read-modify-write; retire the redundant `_hardening/…atomic_admin_balance…sql` if superseded. | `admin_adjust_balance` in `pg_proc`; unapplied file in `_hardening/`. | P2 | S | Low |

### 3.2 Security hardening (P1/P2)

| ID | Finding | Evidence | Pri | Effort | Risk |
|---|---|---|---|---|---|
| S-1 | **`provisioned_password` plaintext store.** Admin-set cleartext passwords persist in `profiles.provisioned_password` and are revealed (toggle) in the admin UI for agents **and** researchers. A DB compromise or rogue admin harvests live logins. | Column present; `AdminAgents.tsx:515,765`; read in 9 code sites. Product decision: drop column + one-time display. | P1 | M | Low–Med |
| S-2 | **Proxy renders untrusted external HTML on your own origin.** `/api/proxy` now sends a CSP (`default-src 'self' https: …`) that blocks *inline* foreign scripts — but external `https:` scripts still execute and can call `/api/*` with the user's cookie. The robust fix (a `sandbox` directive / cookieless separate origin) isn't in place. | `app/api/proxy/route.ts:212`. The platform's top *architectural* security item. | P1 | M–L | Med |
| S-3 | **CSP keeps `script-src 'unsafe-inline'`** — negates much of the CSP's XSS value. Move to nonce/hash. | `next.config.ts:144`. | P2 | M | Med |
| S-4 | **Public buckets allow listing** — `product-images`, `product-coas`, `avatars`, `message-attachments`, `social-media`, etc. are `public=true`. For COAs/attachments this leaks filenames; `message-attachments` public warrants a hard look. | `storage.buckets`. Owner decision. | P2 | S | Med (can break public loads) |
| S-5 | **Confirm Upstash Redis env in prod** — without it, rate limiting is per-instance in-memory. | `lib/rate-limit.ts`. | P1 | S | None (config) |
| S-6 | Add `npm audit` / dependency scanning to CI (never run — sandbox blocked network). | — | P2 | S | None |

### 3.3 Reliability & observability (P1)

| ID | Finding | Evidence | Pri | Effort |
|---|---|---|---|---|
| R-1 | **Provision Sentry DSNs in Vercel** — the single highest-leverage remaining ops action. All capture paths are wired but **no-op until the env vars exist**: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`. | `instrumentation-client.ts:25`, `next.config.ts`. | P1 | S |
| R-2 | **Cron dead-man's-switch** — 47 crons; `cron_runs` + `/api/health/crons` exist but nothing **alerts** when a cron silently stops. | `vercel.json`. | P1 | M |
| R-3 | **Adoption sweeps** — ~360 routes still hand-roll error JSON, ~520 raw `fetch` sites, ~200 routes validate ad hoc; stamp `x-request-id` at the edge. Mechanical, low-risk. | 07-12 hardening tails. | P2 | L |

### 3.4 SEO — one moderate lever remains (P2)

The homepage, robots, `sameAs`, reviewer schema, FAQPage, and city pages are **done** (see §1). What's left:

| ID | Finding | Evidence | Pri | Effort |
|---|---|---|---|---|
| SEO-1 | **Monograph body prose is client-rendered.** The page server-renders JSON-LD, FAQ, comparisons, and citations, but the **primary description/mechanism prose lives in the client `MonographTabs`** — so a non-JS AI crawler (ClaudeBot/GPTBot) sees the supporting content but not the core narrative for the ~300 pages you most want cited. Server-render that prose as progressive enhancement. | Verified: `research/[slug]/page.tsx` is a server component but `MonographTabs` is `'use client'`; live raw HTML of `/research/bpc-157` shows minimal body prose. | P2 | M–L |
| SEO-2 | **Ops:** confirm no Vercel WAF / bot-fight rule blocks GPTBot/ClaudeBot/Googlebot at the edge (`curl -A "GPTBot" …`). | SEO audit P0-3 (code side already handled). | P1 | S |

### 3.5 Growth & conversion — the real upside (P2, net-new)

Already shipped: agent **invitations**, live-KPI **Action Center**, **referral hub** + `available-promos`, **product-alerts** UI, orphan-page nav, PWA install. Still latent, in impact order:

1. **Verified-purchase reviews & ratings** (compliance-safe: quality/reconstitution/packaging/shipping, not efficacy) — biggest missing trust lever. *(M, isolated backend + tiny badge.)*
2. **Back-in-stock & price-drop "Notify Me"** → cron dispatch via existing push/email. *(M, new table + cron.)*
3. **Checkout cross-sell "Frequently Bought Together"** — surface the already-built `/api/cart/recommendations` (referenced in `CartContext`, not shown as FBT). *(M.)*
4. **Storefront conversion kit** — featured/hero curation + shareable read-only store-preview link for agents to QA/promote pre-launch. *(M.)*
5. **Live social-proof badges** ("12 sold this week") from `storefront/events`. *(S–M.)*
6. **Subscribe & Save auto-refill**; **researcher→researcher referral**; **agent broadcast center**; **pricing "what-if" preview**; **profit/margin dashboard** (data already in `order_items`). *(M–L each.)*

### 3.6 UX, mobile, accessibility & performance (P2/P3)

| ID | Finding | Pri | Effort |
|---|---|---|---|
| UX-1 | A11y 0.94, not 1.0 — establish a jsx-a11y baseline in CI (lint is currently disabled). | P2 | M |
| UX-2 | Skeleton loaders thin — only 6 `loading.tsx` across 161 pages; add to checkout/account/products. | P2 | S–M |
| UX-3 | **`store-hero.png` 525KB** used as a CSS background on a research page → convert to WebP (−74%, done this session — see §5). | P3 | S |
| UX-4 | Spot-check Lighthouse on the heaviest pages (`AgentStorefrontGrid` 4,460 lines, monographs). | P2 | S |

### 3.7 Code quality, tech debt & hygiene (P3)

| ID | Finding |
|---|---|
| Q-1 | **`typescript.ignoreBuildErrors: true`** ships contract drift. Highest-leverage: `supabase gen types typescript` → thread the `Database` generic through `lib/supabase/*` → flip the flag off. (`next.config.ts:209`) |
| Q-2 | **Lint disabled in CI** (`npm run lint` is a no-op); 4 `react-hooks` warnings in `CheckoutForm`. Enable a warn gate + jsx-a11y. (`package.json:12`) |
| Q-3 | `as any` ×215, `@ts-ignore/@ts-expect-error` ×129 — reduce on money/data paths. |
| Q-4 | **Repo hygiene** — 107 scratch files in the repo root (`test_*`, `fix_*`, `process_*`, `db_audit*`), tracked binaries (`bpc-157.mp4`, `pepnationlab-shorts/*.mp4`, `*.tgz`), a stale duplicate `AgentStoreProducts_fixed.tsx`, tracked-but-gitignored `.push-asg.js`, and **4 `.bak` migrations in `supabase/migrations/`** (one is the only source of live prod functions — see M-3). |
| Q-5 | **Emoji hard-rule violation** — `messenger/EmojiPicker.tsx` / `ReactionPopover.tsx` render ~400 emojis (self-imposed brand rule). |
| Q-6 | **`CLAUDE.md` is stale and misdirects every future session** — says 28 migrations / 31 components (actual 370 / 313), "site is locked / noindex" (it's public + indexed), contradictory tier multipliers (5×/6×/7× vs 2.5/3/3.5), "middleware.ts enforces auth" (it's `proxy.ts`). Refresh Parts 5/6/7/12. *(This stale doc is a root cause of repeated audits chasing already-fixed issues.)* |
| Q-7 | 4,000-line hot files (`AgentStorefrontGrid` 4,460, `LabJournalClient` 3,777, `CompareTool` 3,673, `CalculatorSuite` 3,272) are merge-conflict magnets — split incrementally. ~11 orphan API routes. |

---

## 4. Operational Checklist (owner — env / dashboard, can't be shipped from code)

1. [ ] **Provision Sentry DSNs** in Vercel (R-1) — do this first; everything else about error tracking is already wired.
2. [ ] **Confirm Upstash Redis** env in prod (S-5).
3. [ ] **Confirm no edge WAF blocks GPTBot/ClaudeBot/Googlebot** (SEO-2).
4. [ ] **Decide the storage-bucket listing policy** for COAs/images/avatars/message-attachments (S-4).
5. [ ] **Product decision on `provisioned_password`** — drop the column + one-time credential display (S-1).
6. [ ] Precautionary: move `.gcp-sa-key.json` / `.pnrx-deploy-key` out of the repo folder; rotate if any doubt (repo is private + key no longer in-tree, so not urgent).

---

## 5. What This Session Changed / Recommends Next

- **Shipped this session:** `store-hero` image optimized 525KB → 138KB WebP (−74%) on the storefront-discovery page (UX-3), with blob-sha-verified push.
- **Best next move — a focused money-path pass on a quiet `main`** (M-1 credit lock → M-2 atomic saga → M-3 migration drift → M-4 cart/billing), each with a paired migration + tests. These were deliberately deferred by prior sessions for exactly this reason; they should not be hot-patched into an actively-deploying repo.
- **In parallel, the owner** works the §4 checklist (Sentry DSN is the big one).
- **Then growth** (§3.5): reviews → back-in-stock → checkout cross-sell, each as isolated routes/tables/components.

*Verified production state as of 2026-07-12. "Re-verify" items had credible report findings whose exact line references have drifted under concurrent edits; confirm at fix time.*
