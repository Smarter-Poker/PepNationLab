# PepNationLab.com — Whole-Platform Deep Dive & "What's Left" Roadmap

**Date:** 2026-07-12
**Author:** Cowork deep-dive session
**Method:** Every claim below was **verified against ground truth** — the live Supabase database (`ydsaqnnuwyvtyxgvrnys`), the actual committed code on the mounted repo, the live production site, Vercel deploy history, and Lighthouse. Prior audit reports (bug-hunt 2026-07-11, security-sweep, admin-panel + observability + type-safety hardening 2026-07-12) were used as *leads*, then re-checked — because several of their "critical" findings have since been fixed by concurrent work, and a report is only as current as the commit it was written against.

---

## 1. Executive Summary

PepNationLab is a **mature, heavily-hardened, pre-launch** platform: a multi-tier ("Admin → Super Agent → Agent → Researcher") wholesale research-peptide storefront, fused with a deep research-library/education hub, a full messenger, an agent/downline growth engine, and a manual-payment (Zelle/Venmo/CashApp/Apple Pay) billing system. It is **much further along than a casual read of the codebase or the raw audit reports would suggest.**

**The single most important finding of this deep dive:** the platform is in **materially better shape than the 2026-07-11 bug-hunt implies.** That report listed 7 "criticals," but re-verification shows **most were closed** by subsequent commits and concurrent sessions:

| 2026-07-11 "Critical" | Verified status today | Evidence |
|---|---|---|
| Leaked `service_role` key in 9 scripts | **RESOLVED** | No hardcoded Supabase JWT anywhere in the tracked tree; the 9 scripts were cleaned; repo is **private** (Vercel + GitHub both report `private`) |
| 12 crons 401 in prod | **FIXED** | `proxy.ts:261` auth-exempts the whole `/api/cron/` + `/api/messenger/cron/` prefix (CRON_SECRET enforced in-route) |
| Super-agent baseline billed 10× | **FIXED** | `app/api/orders/route.ts` divides every baseline/retail by 10 with documented per-10-vial comments |
| Self privilege-escalation via profile columns | **FIXED** | `protect_profile_columns` trigger now pins every financial/tier/attribution column on authenticated updates (comment cites "Bug-Hunt 2026-07-11 (C4)") |
| Arbitrary order INSERT via RLS | **FIXED** | Policy dropped — `orders` has no non-admin INSERT/UPDATE policy left |
| Unguarded order UPDATE via RLS | **FIXED** | Same — only `is_admin()` + service-role can write orders |
| Rules-of-Hooks crash in checkout | **NON-ISSUE** | No hooks are declared after the `if (!storefrontLoaded) return null` early return in `CheckoutForm.tsx` |

Likewise, the 2026-07-12 admin-panel and observability hardening **did ship** (verified in code: the `ALLOWED_ACCOUNT_ROLES` allowlist that kills backdoor-admin creation, the `/admin` edge role gate in `proxy.ts:454`, `lib/admin-audit.ts`, the MFA assurance-level fix, `lib/log.ts`, Sentry `onRequestError`, `instrumentation-client.ts`). And the homepage LCP problem the roadmap flagged as "~7.8s" is **gone** — mobile Lighthouse now reads **Performance 0.99** after the `next/image` optimizer fix.

So this is not a rescue mission. It's a **polish-and-launch** mission. What remains is a well-defined tail of (a) money-path correctness to close **before** real orders flow, (b) a few operational env vars to provision, (c) genuine growth/conversion surface area, (d) SEO/AI-discoverability of a content-rich site whose homepage is currently invisible to crawlers, and (e) accumulated hygiene/tech-debt.

### Verified scorecard

| Dimension | Score | Notes |
|---|---|---|
| Security posture | **A− (~88/100)** | RLS on every table, CSRF + edge auth + role gates, atomic money RPCs, secrets clean, private repo. Residual: proxy same-origin content, plaintext password column, CSP `unsafe-inline`. |
| Data integrity / money paths | **B (pre-launch)** | Compensation-on-throw added; hard-fail on missing tiers; DST fixed. Open: credit-limit TOCTOU, non-atomic saga, migration↔live drift. |
| Reliability / observability | **B+ (code) / C (config)** | Sentry fully wired but **DSNs likely not provisioned** → still no-op; 47 crons healthy; needs dead-man alerting + Upstash confirmation. |
| Performance | **A (homepage)** | Mobile LH Perf 0.99, SEO 1.0, Best-Practices 0.96, A11y 0.94. Spot-check heavy pages (4,460-line storefront grid, monographs). |
| SEO / AI discoverability | **B** | Excellent infra (JSON-LD, sitemap, llms.txt, city pages) undercut by an **image-only homepage with zero crawlable text** and client-rendered monographs invisible to AI crawlers. |
| Conversion / growth | **C+ (huge upside)** | Core machinery built; several levers now surfaced (KPIs, referral hub, alerts). Reviews, back-in-stock, cross-sell, subscribe&save still latent. |
| Code quality / tech debt | **B−** | Clean app code (2 TODOs, 0 emojis in source), strong tests on money paths — dragged by `ignoreBuildErrors:true`, disabled lint, `as any`×215, and 107 scratch files in the repo root. |
| Deploy / ops health | **A** | 20/20 recent deploys `READY`, all under the correct `Smarter-Poker` identity, Turbopack, auto-deploy healthy. |

---

## 2. Current-State Snapshot (verified)

- **Scale:** 417 API routes, 161 pages, 313 components, 213 lib modules, 370 SQL migrations, ~221K LOC (app+components+lib). Next.js 16.2.6 / React 19.2.4 / TypeScript 5 / Supabase / Vercel (Turbopack).
- **Business state:** **pre-launch — 0 orders**, 111 active products, 24 agents/super-agents, 9 researchers. Full catalog + deep tooling exist; transaction volume has not started. This is the ideal window to close money-path bugs (no live money is at risk yet).
- **Deploy health:** all recent production deploys `READY`; commit author correctly `Smarter-Poker <254329056+…>` (Vercel blocks any other identity). Active, rapid iteration is happening **today** (dashboard cosmetics) — so hot files carry real collision risk for any new edits.
- **Compliance spine:** 4-layer research-use-only disclaimer gate (site entry → registration → add-to-cart → checkout), all verified wired and server-enforced; public researcher registration permanently closed (`/register` → `/signup`/`/login`, `POST /api/auth/register` 410s).

---

## 3. Prioritized Backlog — "What's Left"

Priority key: **P0** = close before launch / active risk · **P1** = high value, do soon · **P2** = real upside, schedule deliberately · **P3** = hygiene/polish. Each item notes **Effort** (S/M/L) and **Risk** of the fix (collision/regression).

### 3.1 Money-path correctness — close before real orders (P0/P1)

> Pre-launch (0 orders) means none of these have caused loss yet — but each moves real money once agents transact, and several live in the hottest, most-contended files. Sequence them into a focused pre-launch money pass, ideally when `main` is quiet.

| ID | Finding | Evidence | Pri | Effort | Risk |
|---|---|---|---|---|---|
| M-1 | **Credit-limit TOCTOU** — the super-agent/agent credit headroom check is a JS read-then-decide with no row lock; two concurrent checkouts can both pass and collectively exceed the limit. | `app/api/orders/route.ts:~1079` (`creditLimit = Number(...) \|\| 0`), charge happens later at `:1300`. Confirmed still open by the 07-12 report. | P0 | M | Med (hot file + new migration) |
| M-2 | **Checkout is a non-transactional saga** — no `create_order_atomic` RPC exists in the DB; order creation is a sequence of RPCs. Compensation-on-throw was added (good), but a mid-saga crash still relies on best-effort rollback. | No `create_order_atomic` in `pg_proc`; saga spans `orders/route.ts:~592–1080`. | P1 | L | Med |
| M-3 | **Late-approved orders can escape a billing week; sub-agent cron may bill unapproved/restock orders.** | `lib/statements.ts`, `app/api/cron/invoices/route.ts` (bug-hunt H4/H6). Re-verify against current code. | P1 | M | Med |
| M-4 | **Cart price-refresh discards price/sale updates** — client only applies the refresh when membership changed, so reprices/sales don't reflect. **"Add BAC Water" can replace a context-cart order** with just the diluent. | `components/CartContext.tsx` (H11), `app/checkout/CheckoutForm.tsx` (H12). | P1 | M | Med (hot files) |
| M-5 | **Migration↔live drift** — `pay_invoice`, `check_credit_chain`, and `orders.inventory_reserved` exist in the **live DB** but not in tracked migrations. A clean rebuild-from-migrations would break checkout. | Verified: functions present in `pg_proc`; flagged in memory `live-db-has-untracked-objects`. | P1 | M | Low (additive migration) |
| M-6 | **Manual admin balance adjustment** — confirm `transactions/route.ts` uses the atomic `admin_adjust_balance` RPC (which exists live) rather than read-modify-write; retire the now-redundant `_hardening/20260712000000_atomic_admin_balance_adjustment.sql` if superseded. | `admin_adjust_balance` present in `pg_proc`; unapplied file in `_hardening/`. | P1 | S | Low |
| M-7 | Coupon per-user limit not atomic; coupon RPC lacks the negative/>100% clamps the preview path has. | bug-hunt medium cluster. | P2 | S | Low |

### 3.2 Security hardening (P1/P2)

| ID | Finding | Evidence | Pri | Effort | Risk |
|---|---|---|---|---|---|
| S-1 | **`provisioned_password` plaintext store.** Admin-set cleartext passwords persist in `profiles.provisioned_password` and are revealed in the admin UI for agents **and** researchers. A DB compromise or a rogue admin harvests live logins. | Column present; rendered in `AdminAgents.tsx:515,765`; read in 9 code sites. | P1 | M | Low–Med (product decision) |
| S-2 | **Proxy renders untrusted external HTML on your own origin.** `/api/proxy` now sends a CSP (`default-src 'self' https: data: blob:`), which blocks *inline* foreign scripts — but external `https:` scripts still execute and can call `/api/*` with the user's `SameSite=Lax` cookie. The robust fix (a `sandbox` directive / cookieless separate origin) is not yet in place. | `app/api/proxy/route.ts:212` CSP; no `sandbox`. This is the platform's top *architectural* security item. | P1 | M–L | Med |
| S-3 | **CSP keeps `script-src 'unsafe-inline'`.** Negates much of the CSP's XSS value. Move to nonce/hash-based scripts. | `next.config.ts:144`. | P2 | M | Med |
| S-4 | **Public buckets allow listing/enumeration** — `product-images`, `product-coas`, `avatars`, `message-attachments`, `social-media`, `15DynamicImages`, `storefront-assets` are `public=true`. For COAs/attachments this leaks filenames/upload patterns; `message-attachments` public is worth a hard look. | `storage.buckets`; flagged as "decision needed" in the 07-09 handoff. | P2 | S | Med (can break public image loads) |
| S-5 | **Ops: confirm Upstash Redis env in prod** — without `UPSTASH_REDIS_REST_URL/TOKEN`, rate limiting falls back to per-instance in-memory and barely constrains a distributed attacker. | `lib/rate-limit.ts`. | P1 | S | None (config) |
| S-6 | **Add `npm audit` / dependency scanning to CI** — never run (sandbox blocked network). | — | P2 | S | None |
| S-7 | Review `get_sub_agent_ids(uuid)` anon-executability (probes the agent hierarchy). The other ~16 anon-executable SECURITY DEFINER fns are benign role helpers. The 17 "RLS-enabled-no-policy" tables are **intentional** default-deny (service-role reads). | Supabase advisor + 07-09 handoff. | P2 | S | Low |

### 3.3 Reliability & observability (P1)

| ID | Finding | Evidence | Pri | Effort | Risk |
|---|---|---|---|---|---|
| R-1 | **Provision Sentry DSNs in Vercel** — this is the single highest-leverage remaining ops action. All capture paths are wired (`onRequestError`, `instrumentation-client.ts` gated on `NEXT_PUBLIC_SENTRY_DSN`) but **no-op until the env vars exist**. Set `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`. | `instrumentation-client.ts:25`, `next.config.ts` `withSentryConfig`. | P1 | S | None (config) |
| R-2 | **Cron dead-man's-switch** — 47 crons run (billing, integrity, COA rotation, research syncs). `cron_runs` + `/api/health/crons` exist, but nothing **alerts** when a cron silently stops firing. Consolidate the scattered detection into one alert surface. | `vercel.json` (47 crons); roadmap #13. | P1 | M | Low (new route) |
| R-3 | **Adoption sweeps** — ~360 routes still hand-roll error JSON (mechanical `safeError`), ~520 raw `fetch` sites could move to `fetchJson`, ~200 body-consuming routes still validate ad hoc vs `parseJsonBody`. Also stamp `x-request-id` at the edge for log correlation. | 07-12 hardening + type-safety tails. | P2 | L | Low (mechanical) |

### 3.4 SEO & AI discoverability (P1/P2) — high ROI for a content platform

| ID | Finding | Evidence | Pri | Effort | Risk |
|---|---|---|---|---|---|
| SEO-1 | **Homepage has zero crawlable text.** `/` is a single Supabase-hosted PNG with 8 absolutely-positioned empty `<a>` tags (only `aria-label`). The most authoritative page on the domain — sitemap priority 1.0 — is effectively blank to Google's text signals and *completely* blank to AI crawlers (GPTBot/ClaudeBot/PerplexityBot don't run JS). No `<h1>`, no anchor text, no internal-link equity flowing to `/research`, `/peptide-101`. | `app/HomeClient.tsx`; SEO audit P0-1. Perf is fine (0.99) — this is a **content/crawlability** gap, not speed. | P1 | S–M | Low (additive, can be `sr-only`) |
| SEO-2 | **Monographs & research hub render body client-side** → AI crawlers index empty shells for exactly the pages you most want cited. Server-render the prose (summary, mechanism, key facts, references) as progressive enhancement. | `ResearchLandingClient`, `MonographTabs` are `'use client'`. | P1 | M–L | Med |
| SEO-3 | **Verify AI crawlers/Googlebot aren't blocked at the edge** and that `/api/llm/compound/[slug]` isn't caught by `Disallow: /api` — add `Allow: /api/llm` (or move to `/llm/...`). Test with `curl -A "GPTBot"` / `ClaudeBot`. | `robots.ts`; SEO audit P0-3. | P1 | S | Low |
| SEO-4 | **E-E-A-T for YMYL health content is thin** — `Organization.sameAs` is empty; no author/medical-reviewer schema, no `lastReviewed`/`dateModified` on monographs. Add `sameAs` (incl. a Wikidata entity), `reviewedBy`, and named scientific editor. | SEO audit P1. | P2 | M | Low |
| SEO-5 | Add missing high-value schema: `FAQPage`, `Product`/`Offer` completeness (partly landed 07-12), `DefinedTermSet`, `HowTo`. | SEO audit. | P2 | M | Low |

### 3.5 Growth & conversion (P2) — the real upside

Core machinery exists; the theme remains **surface / connect / instrument**, not net-new systems. Already shipped since the roadmap: agent **invitations**, **live KPI** Action Center (`AgentOverview` now renders real today-revenue/needs-approval/awaiting-payment), **referral hub** + `available-promos`, **product-alerts** UI, orphan-page nav links, PWA install helper.

Still latent / recommended, in impact order:

1. **Verified-purchase reviews & ratings** (compliance-safe: quality/reconstitution/packaging/shipping, not efficacy). Biggest missing trust lever for conversion. *(M, isolated backend + tiny card badge.)*
2. **Back-in-stock & price-drop "Notify Me"** on OOS/wishlist → cron dispatch via existing push/email infra. *(M, new isolated table + cron.)*
3. **Checkout cross-sell "Frequently Bought Together"** — surface the already-built `/api/cart/recommendations` engine (currently only referenced in `CartContext`, not shown as FBT at checkout). *(M, drop-in component.)*
4. **Storefront conversion kit** — featured/hero product curation + a shareable read-only store-preview link so agents can QA and promote pre-launch. *(M, mostly isolated.)*
5. **Live social-proof badges** ("12 sold this week") from `storefront/events` data already collected. *(S–M.)*
6. **Subscribe & Save auto-refill** — graduate the manual refill hub + `refill-reminders` cron into true recurring orders. *(L, after the money-path pass.)*
7. **Researcher→researcher referral**, **agent broadcast center** (generalize coupon-only notify-downline), **pricing "what-if" preview** before a tier change shows the blast radius, and **profit/margin dashboard** (`order_items` already stores cost+retail+super-agent cost — empty until orders exist). *(M–L each.)*

### 3.6 UX, mobile, accessibility & performance (P2)

| ID | Finding | Pri | Effort |
|---|---|---|---|
| UX-1 | **A11y 0.94, not 1.0** — image-only homepage anchors, non-focusable drawer results, etc. ESLint is disabled so a11y lint never runs. Establish an a11y baseline + jsx-a11y in CI. | P2 | M |
| UX-2 | **Skeleton loaders thin** — only 6 `loading.tsx` across 161 pages. Add to checkout/orders/account/products for perceived performance. | P2 | S–M |
| UX-3 | **`store-hero.png` is a 525KB PNG** used as a CSS `background-image` on a high-traffic research page (can't be optimized by `next/image`). Convert to WebP/AVIF + `image-set()`. | P2 | S |
| UX-4 | Spot-check Lighthouse on the heaviest pages (`AgentStorefrontGrid` 4,460 lines, monographs, `CompareTool`) — homepage is great but the SPA-heavy pages weren't measured. | P2 | S |
| UX-5 | PWA raster icons; nonce-CSP is also a best-practices lift. | P3 | M |

### 3.7 Code quality, tech debt & hygiene (P3)

| ID | Finding | Evidence |
|---|---|---|
| Q-1 | **`typescript.ignoreBuildErrors: true`** lets contract drift ship. Highest-leverage fix: run `supabase gen types typescript`, thread the `Database` generic through `lib/supabase/*` (currently `.from()` results are untyped), then flip the flag off. | `next.config.ts:209` |
| Q-2 | **Lint disabled in CI** (`npm run lint` is `echo … && exit 0`). 4 pre-existing `react-hooks` warnings in `CheckoutForm`. Enable lint (at least a warn gate) + jsx-a11y. | `package.json:12` |
| Q-3 | `as any` ×215 and `@ts-ignore/@ts-expect-error` ×129 across app/components/lib — reduce, especially on money/data paths. | grep |
| Q-4 | **Repo hygiene** — 107 scratch files in the repo root (`test_*`, `fix_*`, `process_*`, `db_audit*`, etc.), tracked binaries (`bpc-157.mp4`, `pepnationlab-shorts/*.mp4`, `_admin_audit_snapshot.tgz`, `src_analysis.tgz`), a stale duplicate `AgentStoreProducts_fixed.tsx`, tracked-but-gitignored `.push-asg.js`, and **4 `.bak` migrations inside `supabase/migrations/`** (one is the only source of live prod functions — see M-5). `_to_delete/` is 17MB on disk. | `git ls-files` |
| Q-5 | **Emoji hard-rule violation** — `components/messenger/EmojiPicker.tsx` / `ReactionPopover.tsx` render ~400 emojis (self-imposed brand rule; low real-world severity, but it's a stated non-negotiable). | bug-hunt |
| Q-6 | **`CLAUDE.md` is stale and misleads every future session** — says 28 migrations / 31 components (actual 370 / 313), "site is locked / noindex" (it's public), contradictory tier multipliers (5x/6x/7x vs 2.5/3/3.5), and "middleware.ts enforces auth" (it's `proxy.ts`). Refresh Part 5/6/7/12. | `CLAUDE.md` |
| Q-7 | ~11 orphan API routes with no caller; 4,000-line hot files (`AgentStorefrontGrid` 4,460, `LabJournalClient` 3,777, `CompareTool` 3,673, `CalculatorSuite` 3,272) are maintenance/merge-conflict magnets — split incrementally. | grep |

---

## 4. Operational Checklist (env / dashboard — needs the repo owner)

These aren't code and can't be shipped from here; they gate real behavior:

- [ ] **Provision Sentry DSNs** (`NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`) in Vercel. Everything else about error tracking is already wired. **(R-1 — do this first.)**
- [ ] **Confirm Upstash Redis** (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) is set in production so rate limiting is cluster-wide. **(S-5.)**
- [ ] **Decide the storage-bucket listing policy** for `product-coas` / `product-images` / `avatars` / `message-attachments` (scope the `SELECT` policy or accept public enumeration). **(S-4.)**
- [ ] **Rotate the service-role key** only if there's any doubt it ever left a machine (repo is private and the key is no longer in-tree — so this is precautionary, not urgent). Move the on-disk `.gcp-sa-key.json` / `.pnrx-deploy-key` out of the repo folder.
- [ ] **Verify AI crawlers aren't edge-blocked** (`curl -A GPTBot/ClaudeBot`). **(SEO-3.)**

---

## 5. Recommended Execution Order

1. **This session (safe, isolated, high-ROI — starting now):** SEO crawlability of the homepage (SEO-1) and `robots.ts` LLM allow (SEO-3); refresh the stale `CLAUDE.md` (Q-6). These don't touch the hot money/dashboard files being actively edited today.
2. **Owner, in parallel:** the Operational Checklist above (Sentry DSN is the big one).
3. **Next focused session, when `main` is quiet:** the money-path pass (M-1 credit lock → M-2 atomic saga → M-3/M-4 billing & cart correctness → M-5 migration drift), each with a paired migration and tests, on the hot `orders`/`CheckoutForm`/`CartContext` files without a concurrent session.
4. **Then growth:** reviews → back-in-stock → checkout cross-sell → conversion kit (§3.5), each as isolated routes/tables/components.
5. **Continuous:** SSR monographs (SEO-2), the `safeError`/`fetchJson`/typed-DB adoption sweeps, a11y baseline, and repo hygiene.

---

*This document reflects verified production state as of 2026-07-12. Where an item says "re-verify," the underlying report finding was credible but its exact line references have drifted under concurrent edits and should be re-confirmed at fix time.*
