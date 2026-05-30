# Messenger Test Scripts (Phase 15)

This directory ships the three regression artifacts that gate the messenger
hardening pass:

1. `smoke.sh` — unauthenticated reachability + auth-gate test against every
   messenger route in production.
2. `../../__tests__/messenger-rls.test.sql` — structural RLS regression suite.
3. `../../__tests__/messenger-sanitize.test.ts` — unit test for the
   dangerous-scheme filter.

---

## Smoke Script

Run against production:

```bash
bash scripts/messenger/smoke.sh
```

Or against an alternative host:

```bash
BASE_URL=https://staging.pepnationlab.com bash scripts/messenger/smoke.sh
```

Exit code equals the failure count, so it composes cleanly with CI: zero is a
clean run.

The script hits every messenger route (49 user routes plus 5 admin routes
plus 3 crons plus the two SPA pages) without credentials and asserts:

- All user routes return **401 Unauthorized**.
- All admin routes return **401 Unauthorized**.
- All cron routes return **401 Unauthorized** (Bearer-gated).
- `/messenger` and `/admin/messenger` return **307** (middleware redirect to
  login).
- `/api/health` returns **200**.

A 401 from every gated route confirms the Phase 15 rate limiter did NOT
break the auth ordering (CSRF -> session -> rate-limit -> zod). A 429
appearing in this run would itself be a bug, since the limiter only fires
after session resolution and an unauthenticated caller never gets past 401.

---

## RLS Regression Suite (Structural)

Apply via the Supabase MCP:

```text
execute_sql project_id=ydsaqnnuwyvtyxgvrnys query=<contents of
__tests__/messenger-rls.test.sql>
```

The query returns a single `summary` JSONB row:

```json
{
  "total": 108,
  "passed": 108,
  "failed": 0,
  "failures": []
}
```

It verifies, for every `messenger_*` table:

- The table exists in the public schema.
- Row Level Security is enabled.
- A SELECT (or ALL) policy is defined.
- An INSERT (or ALL) policy is defined.
- Every INSERT / UPDATE / ALL policy carries a non-null `WITH CHECK` clause
  (the safeguard against attribution forgery).
- No policy carries an unjustified `USING (true)` clause. The only exception
  whitelisted is `messenger_link_previews` SELECT, which is a deliberately
  shared cache (vetted in Audit 8).

### What This Test Does NOT Cover

The script is a STRUCTURAL test. It confirms the **shape** of the policies,
not their behavioral enforcement under live auth.

A full BEHAVIORAL RLS test would need:

- A Node harness that signs Supabase Auth JWTs for four synthetic personas
  (participant A, participant B, admin, outsider) per messenger_* table.
- For each table, 4 operations (SELECT / INSERT / UPDATE / DELETE) per
  persona, asserting the expected allow/deny matrix.
- Cleanup of all synthetic users and conversations at end of run.

That harness is **deferred** — it requires either a dedicated Supabase Auth
test project or service-role token mutation magic that we deliberately keep
out of production. The structural test was chosen for Phase 15 because:

- It is the only signal that survives migration drift without test
  infrastructure.
- It can be re-run with one MCP call.
- It catches the regressions Audit 8 actually found (missing WITH CHECK,
  stray `USING (true)`).

Track the deferred behavioral harness under a follow-up task (
"messenger-rls behavioral harness").

---

## Sanitize Tests

The sanitizer test is a `node:test` suite that depends only on Node 20+ and
the standard `tsx` loader for TypeScript transpilation on the fly.

Run:

```bash
npx tsx --test __tests__/messenger-sanitize.test.ts
```

Expected output: 13 tests pass, 0 fail.

The suite covers:

- Rejection of `javascript:` / `data:` / `vbscript:` / `file:` schemes.
- Case-insensitive scheme detection (`JaVaScRiPt:` etc).
- Mid-string scheme matches ("Click here: javascript:alert(1)").
- Plain text / `http(s)://` URLs passing through unchanged.
- Control-character stripping (NUL, BEL, BS, VT, FF, ESC, DEL).
- CRLF normalization to LF.
- Trailing-whitespace collapse on each line.
- `null` / `undefined` / non-string runtime guard.
- Empty-string preservation (the route handler — not the sanitizer —
  decides whether an empty body is allowed).
