# Security Policy

## Reporting

If you discover a security vulnerability, email security@pepnationlab.com or open
a private issue. Do not disclose publicly until we have shipped a fix.

## Accepted Risks (Documented)

### PostCSS Stringify XSS — GHSA-qx2v-qp2m-jg93 (Moderate)

**Status:** Accepted. `npm audit fix` cannot resolve this without breaking the
application.

**Why:** The vulnerable `postcss` version is a transitive dependency of
`next@16.x`. The only path `npm audit fix` offers is downgrading Next.js to
`next@9.3.3`, which would regress the entire App Router platform and undo
years of upstream security patches.

**Why this is not exploitable in our build:**
- PostCSS is used at **build time** by Next.js to preprocess project CSS.
- Our CSS sources (`app/globals.css`, component-level styles) are author-
  controlled — there is no path where untrusted user input gets injected
  into PostCSS's stringify output at build time.
- At runtime, the compiled CSS is served as static assets; there is no
  runtime PostCSS invocation on user content.

**Compensating controls:**
- All HTML output is wrapped in a strict Content Security Policy (`next.config.ts`).
- `X-Content-Type-Options: nosniff` is set on every response.
- `Referrer-Policy: strict-origin-when-cross-origin` limits leakage.

**Trigger to revisit:** When Next.js publishes a release with the patched
`postcss`, run `npm update next && npm audit` and remove this entry.

## Production Hardening Checklist

- HSTS: enabled (`max-age=63072000; includeSubDomains; preload`)
- CSP: enforced on every response (see `next.config.ts`)
- X-Frame-Options: `DENY`
- X-Content-Type-Options: `nosniff`
- Referrer-Policy: `strict-origin-when-cross-origin`
- Permissions-Policy: camera/microphone/geolocation denied
- Rate limit: Upstash REST when env vars set, in-memory fallback otherwise
- CSRF: same-origin check on every state-mutating route
- Auth: Supabase Auth + MFA enforced for `admin` and `super_agent` roles
- SQL: RLS enabled on every table; SECURITY DEFINER RPCs reviewed
- Storage: `payment-proofs` bucket private; per-order RLS on `storage.objects`
- Inventory: strict trigger w/ `SELECT FOR UPDATE` + `RAISE EXCEPTION`
- Coupons: atomic `redeem_coupon` RPC eliminates TOCTOU
- Balance: `deduct_prepaid_balance` writes append-only `balance_transactions`
- Idempotency: `orders.idempotency_key UUID UNIQUE`
- Cron: `cron_runs` table prevents replay duplication
- Audit: `admin_audit_log` table for sensitive admin actions
- Disclaimer: 4-layer pipeline (site_entry, registration, add_to_cart, checkout)
  with WITH CHECK enforcing `user_id = auth.uid()`

## Manual Steps (Dashboard-Only — Not Automatable)

These require Supabase dashboard interaction by a project owner:

- [ ] Enable **HaveIBeenPwned leaked-password protection**:
      Supabase Dashboard → Authentication → Policies → Password Security →
      toggle "Check passwords against HaveIBeenPwned"
- [ ] Review **MFA enrollment** for each admin / super_agent
      (they will be redirected to `/account/security?reason=mfa_required`
      on first login until enrolled)
- [ ] Configure Vercel env vars:
      `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`,
      `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
      `CRON_SECRET`, `NEXT_PUBLIC_DISCLAIMER_VERSION`
