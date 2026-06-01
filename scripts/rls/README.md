# RLS Regression Smoke Suite (non-messenger)

Pairs with `scripts/messenger/smoke.sh` (which covers the messenger surface)
to give us a runnable check on every other RLS boundary that has actually
broken in production before. Run it before pushing migrations that touch
RLS, policies, or `SECURITY DEFINER` functions, and after any manual
schema change in the Supabase dashboard.

## What it tests

Eight boundaries, in order of historical pain:

1. **Anon × sensitive tables**. Anon JWT cannot read `profiles`, `orders`,
   `weekly_statements`, `balance_transactions`, `admin_audit_log`,
   `messenger_messages`. Each `SELECT` should return either an empty
   array (RLS hides the row) or a 401 (RLS denies the SELECT entirely).

2. **Anon × public storefront tables**. Anon JWT CAN read `agent_profiles`,
   `products`, `agent_products` — these power the unauthenticated `/[slug]`
   storefront. A regression that broke this would take the public
   storefront offline.

3. **Anon × pricing tables**. Anon cannot read `pricing_tiers` or
   `product_tier_overrides`. This is the audit-pass hardening that
   gated platform multipliers to agents+admin only — a regression
   would leak the wholesale multipliers to the public storefront.

4. **Researcher isolation**. A signed-in researcher cannot read another
   researcher's `profiles` row or `orders` row. Catches the
   `messenger_participants` recursion bug class that broke isolation
   during messenger phase work.

5. **Admin sanity**. A signed-in admin reading `orders` returns rows
   (service-role bypass works). Mostly a smoke test that the admin's
   JWT is being honored.

6. **list-contacts admin wiring** (fix-46). The admin's
   `/api/messenger/list-contacts` returns every active non-admin user.
   Catches the regression where the admin branch silently returned 0
   results.

7. **Global search admin gate** (fix-47). `/api/admin/global-search`
   returns 401 for a non-admin caller.

8. **Auto-conversation trigger** (fix-45). Every active non-admin user
   has a direct conversation with the admin. Verifies the backfill
   stayed intact and the trigger fires for new users.

## How to run

```bash
bash scripts/rls/run.sh
```

Reads credentials from `.env.local` if present, otherwise from the
environment. Required vars:

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key for REST calls |
| `TEST_ADMIN_EMAIL` | Admin credential (defaults to `daniel@bekavactrading.com`) |
| `TEST_ADMIN_PASSWORD` | Admin password |
| `TEST_AGENT_EMAIL` | Optional. If unset, the agent-side checks are skipped with a warning. |
| `TEST_AGENT_PASSWORD` | Same |
| `TEST_RESEARCHER_EMAIL` | Optional. If unset, the researcher-isolation checks are skipped. |
| `TEST_RESEARCHER_PASSWORD` | Same |
| `APP_URL` | Defaults to `https://pepnationlab.com`. Override for staging / local. |

The script exits with code `0` if every check passes, `1` if any check
fails. Each result line is prefixed with `PASS` or `FAIL` plus the test
name so you can grep the output.

## Adding a new check

New checks are bash functions inside `run.sh` that call the helper
`expect_status` (assert HTTP status code) or `expect_jq` (assert a jq
expression evaluates truthy). Add the function, then call it from the
`main` block at the bottom of the file. Keep each check focused on a
single RLS boundary so a failure points at one root cause.

## What it does NOT test

- Storage bucket RLS (avatars, payment_proofs, product images).
  Worth adding next — those have their own policy surface.
- The Realtime channel privacy regression (call-signal channels) —
  covered indirectly by manual call testing.
- Cron-only routes (`/api/cron/*`) which gate on `CRON_SECRET` rather
  than RLS.
