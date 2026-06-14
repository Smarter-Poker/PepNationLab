# Antigravity Handoff -- Security Hardening + Bug Sweep Follow-Ups

> Created 2026-06-14 by the Cowork security pass. This file lists work that the
> Cowork agent could NOT safely do itself (dashboard-only actions, changes that
> need the live local working tree, or items deliberately deferred), plus the
> verified findings from a deep bug/wiring sweep. No emojis per platform rule.

---

## 0. READ FIRST -- Local working tree is divergent from origin

The Cowork agent pushes file changes directly to `origin/main` via the GitHub
API (the sandbox has no SSH/token for `git push`). As a result:

- `origin/main` already contains the security commits from this pass
  (SSRF guard, header hardening, RLS/test-table drops, the `temp_run_sql`
  P0 drop, function `search_path` pinning, `safeError` on research routes,
  iframe sandbox, durable proxy rate limit, Dependabot, plus the two CSRF
  fixes below).
- The LOCAL working tree at `/Users/smarter.poker/Documents/pepnationlab` is
  BEHIND `origin/main` (local HEAD was `9c00b52`) and has 30+ uncommitted
  modified files from concurrent local work.

**Action (do this before anything else):**
1. `git stash` (or commit to a WIP branch) the local uncommitted changes so they
   are not lost.
2. `git fetch origin && git log --oneline origin/main -15` to see what landed.
3. Reconcile: rebase/merge local work onto `origin/main`, resolving any overlap
   in the files this pass touched (see Section 4 for the exact list).
4. Re-apply the stashed local work and re-test.

Until this reconciliation happens, the local tree does NOT reflect production.

---

## 1. Supabase Auth settings (dashboard only -- no API/MCP toggle)

In the Supabase dashboard for project `ydsaqnnuwyvtyxgvrnys`
(Authentication -> Policies / Providers / settings):

1. **Enable leaked-password protection** (HaveIBeenPwned check). Off by default.
2. **Set a minimum password length** (>= 8, recommend 10+).
3. **Enable TOTP MFA** as an available factor. The app already has MFA enrollment
   UI at `/account/security` and `assertMfaRecent()` in `lib/admin-auth.ts`; the
   factor type just needs to be enabled server-side.

These cannot be changed from code or the Supabase MCP tools; an owner must click
them in the dashboard.

---

## 2. Content-Security-Policy: remove 'unsafe-inline' / 'unsafe-eval' (deferred)

`next.config.ts` ships a CSP whose `script-src` still allows `'unsafe-inline'`
and `'unsafe-eval'`, which weakens XSS defense. The correct fix is a nonce-based
CSP (per-request nonce injected in `proxy.ts` middleware + `'nonce-...'`
`'strict-dynamic'` in `script-src`, dropping the unsafe tokens).

This was deliberately NOT done from Cowork: on a live Next.js 16 app with many
inline scripts (hydration, injected styles), a wrong nonce wiring breaks the
entire site, and it cannot be fully validated headlessly. Do this in a branch
with a real preview deploy and click-through QA. Verify Stripe/LiveKit/Sentry/
Supabase still load and that no console CSP violations appear.

---

## 3. Independent penetration test

Automated review (this pass) covered OWASP-style classes -- SSRF, RLS, authz,
injection, secrets, headers, rate limiting, CSRF. Before any major launch, a
third-party pentest is still warranted, especially for the multi-tier
agent/super-agent money flows and the public agent storefronts.

---

## 4. CSRF: finish the same-origin batch on authenticated mutating routes

`lib/csrf.ts -> assertSameOrigin(req)` is the platform's defense-in-depth CSRF
guard (no-op in dev; 403 on cross-origin in prod). SameSite=Lax cookies already
block the classic vector, so these are P2 consistency fixes, not emergencies.

DONE this pass (already on origin/main):
- `app/api/agent/agents/route.ts` (POST -- creates agent accounts)
- `app/api/researcher/notes/route.ts` (POST/PATCH/DELETE)

TODO -- add the same guard. These use `NextRequest`, so it is a 2-line add at the
top of each mutating handler:

```ts
import { assertSameOrigin } from '@/lib/csrf';
// ...inside POST/PUT/PATCH/DELETE, first line:
const csrf = assertSameOrigin(req);
if (csrf) return csrf;
```

- `app/api/researcher/biometrics/route.ts` (POST, DELETE)
- `app/api/researcher/doses/route.ts` (POST, DELETE)
- `app/api/researcher/comparisons/route.ts` (POST, DELETE)
- `app/api/researcher/ai-protocol/route.ts` (POST)

TODO -- these two use a plain `Request` param. `assertSameOrigin` reads
`req.nextUrl`, so FIRST change the handler signature `Request` -> `NextRequest`
(import from `next/server`), then add the guard:

- `app/api/account/avatar/route.ts` (POST -- avatar upload)
- `app/api/researcher/orders/update-payment/route.ts` (POST -- payment state)

Lower priority (telemetry, currently unauthenticated POST): `app/api/analytics/
faq-click/route.ts`, `app/api/analytics/missed-search/route.ts`. Only add if you
want to reject cross-origin event spam.

---

## 5. Frontend robustness: one unguarded fetch().json()

`components/CartContext.tsx` is locally modified, so the Cowork agent did not
touch it (clobber risk). In the BAC-water calculator effect (around line 464),
the chain `.then(r => r.json()).then((data: BacWaterResult) => setResult(data))`
does not check `r.ok`, so a 500 JSON error body would be rendered as a result.
Add a guard:

```ts
.then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
```

Note: the SmartRecommendationStrip fetch in the same file (around line 681) is
already safe -- it uses `data.recommendations ?? []`. The admin
`pricing-tiers` fetches in `app/admin/products/new` and `.../[id]` are also safe
(they guard with `Array.isArray(data)`).

---

## 6. Repo cleanup (tracked clutter, not secrets)

Root-level dev scratch files are tracked but are NOT part of the production build
(they live outside `app/`/`lib/`/`components/`). Several reference DB objects that
were dropped for security, which is harmless (they never run) but confusing:

- `get_rpc2.ts` references the dropped `temp_run_sql`
- `test_realtime_dummy.js` references the dropped `test_realtime_dummy` table
- `test-db-4.js`, `test-vector.js`, `test_replica.js`, `check_trigger.js`,
  `get_rpc.ts`, `get_func.ts`, `test_policy.ts` -- assorted one-off DB probes

Recommend `git rm` the root-level `test_*.js`, `check_*.js`, `get_*.ts`,
`query_*.js`, `fix_*.js`, `test-*.js` scratch files (review first). Also purge the
two already-gitignored junk files from history:

```bash
git rm --cached cookies.txt .r8-push.json && git commit -m "chore: untrack local junk"
```

---

## 7. Database tech-debt (works today, worth tidying)

Verified against live DB `ydsaqnnuwyvtyxgvrnys`:

1. **`deduct_prepaid_balance` is overloaded** -- two functions exist:
   `(agent_id uuid, amount numeric)` and
   `(p_agent_id uuid, p_amount numeric, p_order_id uuid, p_description text)`.
   App calls use `{ agent_id, amount }`, which uniquely resolves to the 2-arg
   version, so it WORKS. But two overloads is fragile with PostgREST. Consolidate
   to one signature (the 4-arg, with the extra args defaulted) and update the two
   callers: `app/api/orders/route.ts:718`,
   `app/api/agent/orders/approve/route.ts:176`.

2. **`unreedeem_coupon` is misspelled** in the DB (double "e"). Code matches the
   typo at `app/api/orders/route.ts` (4 call sites), so it works. Optional: add a
   migration renaming to `unredeem_coupon` and update the callers together.

3. **`test_realtime_rls` leftover table** -- RLS is ENABLED with 1 policy (not a
   security hole), 1 row. Leftover from realtime testing. Drop it if unused:
   `DROP TABLE IF EXISTS public.test_realtime_rls;` (verify nothing references it
   first).

---

## 8. Sweep result summary (what was checked and cleared)

A deep bug/gap/wiring sweep ran across all ~360 API routes, ~261 components, and
the live DB object inventory. Most machine-flagged "P0s" were verified as FALSE
POSITIVES and need no action:

- `deduct_prepaid_balance` / `recalculate_agent_product_prices` /
  `unreedeem_coupon` RPC calls all match the live function signatures
  (named-arg resolution confirmed). Not broken.
- Admin `pricing-tiers` fetches and `AgentTierLadder` are guarded
  (`Array.isArray` / `.catch` default). Not broken.
- No broken `@/lib` imports; cron routes all enforce `CRON_SECRET`; the Shippo
  webhook validates its shared secret; no service-role client is exposed on an
  unauthenticated public route.

Genuine, actioned or listed-here items: the CSRF batch (Section 4), the one
CartContext fetch guard (Section 5), cleanup (Sections 6-7), and the
dashboard/deferred security items (Sections 1-3).
