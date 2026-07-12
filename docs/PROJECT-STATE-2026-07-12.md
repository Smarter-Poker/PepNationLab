# PepNationLab -- Verified Project State (2026-07-12 Addendum To CLAUDE.md)

Read this alongside `CLAUDE.md`. CLAUDE.md's Parts 5/6/7/12 are stamped 2026-05-28
and are now STALE. Where they conflict with this file, THIS FILE is authoritative --
every statement here was verified on 2026-07-12 against the live Supabase database
(`ydsaqnnuwyvtyxgvrnys`), `origin/main`, and the production site.

## Corrections To CLAUDE.md

- **The site is PUBLIC and INDEXED.** The homepage is a public landing page (not a
  redirect to `/login`); root metadata is `robots: { index: true }`. CLAUDE.md Part 12
  "site is locked / noindex" is obsolete.
- **Scale:** ~370 migrations, ~313 components, 417 API routes, 161 pages, ~221K LOC.
  CLAUDE.md's "28 migrations / 31 components" is obsolete.
- **The auth middleware is `proxy.ts`** (the Next.js 16 rename), NOT `middleware.ts`.
  It enforces auth, an `is_active` kill-switch, a `must_change_password` gate, a
  cron-prefix auth exemption (`/api/cron/`, `/api/messenger/cron/`), and an `/admin`
  edge role gate.
- **Tier multipliers are Tier 1 = 2.5x, Tier 2 = 3.0x, Tier 3 = 3.5x.** CLAUDE.md's
  "Tier 1 (5x) / Tier 2 (6x) / Tier 3 (7x)" table is wrong; the 2.5/3.0/3.5 values
  elsewhere in the doc are correct.
- **Registration:** `/register` redirects to `/signup` (public storefront signup is
  live). `POST /api/auth/register` still returns 410.

## Verified FIXED -- Do NOT Re-Audit These As Open

The 2026-07-11 bug-hunt criticals and 2026-07-07 SEO P0s are CLOSED (verified today):
no hardcoded `service_role` key anywhere in the tree (repo is private); all crons
auth-exempt by prefix in `proxy.ts`; super-agent 10x overbilling divided by 10 in the
orders route; self privilege-escalation blocked by the `protect_profile_columns`
trigger (pins every financial/tier/attribution column); the arbitrary order
INSERT/UPDATE RLS policies dropped; admin backdoor / MFA gate / audit trail hardened;
homepage and compound monographs BOTH server-render crawlable prose
(`HomeSeoContent`, `MonographSeoContent`) with full JSON-LD; `robots.ts` allows
`/api/llm` and every named AI crawler; Sentry is fully wired (no-ops only until DSNs
are provisioned); mobile Lighthouse Performance is 0.99.

## Genuinely OPEN (verified 2026-07-12)

**Money-path (pre-launch, 0 orders -- close before real orders flow):**
- Credit-limit TOCTOU: the orders route reads credit headroom in JS and decides
  without a row lock; concurrent checkouts can collectively exceed the limit. Needs a
  `SECURITY DEFINER` RPC with `SELECT ... FOR UPDATE`.
- Checkout is a non-transactional saga (no `create_order_atomic` RPC). Compensation-
  on-throw is in place; true atomicity would remove the residual partial-failure window.
- `pay_invoice`, `check_credit_chain`, and `orders.inventory_reserved` exist in the
  LIVE database but not in any tracked migration -- a clean rebuild-from-migrations
  would break checkout. Backfill them into tracked migrations.

**Security:**
- `profiles.provisioned_password` stores admin-set cleartext passwords and reveals them
  in the admin UI (agents + researchers) -- product decision to drop the column +
  one-time display.
- `/api/proxy` renders untrusted external HTML same-origin; a CSP is set but not a hard
  `sandbox` -- external `https:` scripts can still run and call `/api/*` with the
  user's cookie.
- CSP keeps `script-src 'unsafe-inline'` -- move to a nonce/hash-based policy.

**Ops (owner -- env/dashboard, not code):**
- Provision Sentry DSNs in Vercel (`NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`,
  `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`) -- highest-leverage remaining action; all
  capture paths are already wired.
- Confirm Upstash Redis env in production (else rate limiting is per-instance).
- Decide the storage-bucket listing policy (`product-coas`, `product-images`,
  `avatars`, `message-attachments` are public).
- Confirm no edge WAF rule blocks GPTBot / ClaudeBot / Googlebot.

**Hygiene / tech debt:**
- `typescript.ignoreBuildErrors: true` in `next.config.ts` (generate Supabase DB types,
  thread the `Database` generic, then flip off).
- Lint disabled in CI (`npm run lint` is a no-op).
- ~107 scratch files tracked in the repo root; 4 `.bak` migrations inside
  `supabase/migrations/` (one is the only source of the live-only functions above).

See `PEPNATIONLAB-DEEP-DIVE-2026-07-12.md` for the full prioritized roadmap and evidence.

---
Maintenance note: fold these corrections into CLAUDE.md Parts 5/6/7/12, or add a
one-line pointer to this file at the top of CLAUDE.md, so future sessions stop
re-auditing already-closed issues.
