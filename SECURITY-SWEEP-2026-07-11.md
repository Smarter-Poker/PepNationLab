# PepNationLab Security Sweep — 2026-07-11

Report-only audit. No code was changed. Scope: PepNationLab storefront (Next.js
16.2.6 / React 19 / Supabase `ydsaqnnuwyvtyxgvrnys`), priority areas first —
auth, API routes, database/RLS, and config. PepNationRX was out of scope by
request.

Methodology: static review of core auth/config files, a delegated sweep of all
399 API route handlers, the live Supabase security advisors (118 lints), git
history inspection for secret exposure, and targeted reads of the proxy, CSRF,
rate-limit, and Supabase client layers.

---

## 1. Executive Summary

**Overall posture before this sweep: strong.** This is a well-defended codebase.
The prior 2026-05-28 audit clearly landed: auth guards are applied consistently,
service-role usage re-checks authorization in code, ownership (IDOR) checks are
present on the object-scoped routes reviewed, RLS is enabled on every public
table (zero ERROR-level database findings), secrets are correctly gitignored and
never committed, and the security-header/CSP baseline is above average.

The residual risk is concentrated in one architectural feature — the same-origin
external-content proxy (the "Omega Protocol") — plus some hygiene and
defense-in-depth gaps. Nothing found is a trivially-exploitable, unauthenticated
data breach; the top item requires luring an authenticated user to a crafted
link.

Risk rating: **Before: Low–Moderate. After recommended fixes: Low.**

### Top 5 findings

1. **`/api/proxy` runs untrusted third-party HTML/JS on your own origin** (High) —
   proxied external scripts execute as `pepnationlab.com` and can call `/api/*`
   with the victim's session cookies.
2. **`/api/proxy` is excluded from the global CSP and security headers** (High,
   same root cause) — the one route serving foreign content is the one route
   with no `default-src`/`script-src` protection.
3. **Unescaped reflection in the proxy fallback HTML** (Medium) — the `url` query
   param and external JSON are interpolated into HTML without encoding →
   reflected XSS on the proxy origin.
4. **`script-src 'unsafe-inline'` in the CSP** (Medium) — negates a large share
   of the CSP's XSS value; a single injected `<script>` or inline handler runs.
5. **No `middleware.ts` exists, yet the docs/comments claim one enforces auth**
   (Medium) — protection currently rests entirely on per-layout/per-route guards;
   a route added without a guard has zero edge fallback, and the drift is a trap
   for the next engineer.

---

## 2. Vulnerability Report (by severity)

### HIGH

#### H-1. Same-origin proxying of untrusted external HTML/JS
**File:** `app/api/proxy/route.ts` (GET handler, esp. lines 269–288)
**Class:** Insecure design / stored-reflected XSS surface / session-riding CSRF

The proxy fetches an arbitrary external URL and returns its HTML back to the
browser with `content-type: text/html; charset=utf-8` from the
`https://pepnationlab.com` origin (line 281–284). Any `<script>` in that foreign
page therefore executes **in your origin's security context**. Because the app's
Supabase session cookie is `SameSite=Lax`, requests the proxied script makes to
`/api/*` are same-origin and carry the user's credentials. The SSRF guard
(`isSsrfTarget` + `safeFetch`, lines 120–122, 154–165) correctly stops the server
from reaching internal hosts, but it does nothing about what the returned page
does once it is running on your origin in the user's browser.

Practical impact: an attacker who gets a logged-in user to open
`/api/proxy?url=https://attacker.example/x.html` obtains script execution as
`pepnationlab.com` with that user's session — able to read/modify anything the
user's API session can, exfiltrate data, place orders, change settings, etc. The
`?url=` value is fully attacker-chosen (only internal/loopback hosts are blocked).

Why it matters here specifically: the whole point of the Omega Protocol is to
render third-party pages (PubMed, FDA, DrugBank, COAs) in-app, so untrusted HTML
flowing through this route is the normal case, not an edge case.

**Recommended remediation (defense in depth — apply more than one):**
- Serve proxied content from a **separate, cookieless sandbox origin** (e.g.
  `proxy.pepnationlab-content.com`) so foreign scripts never share an origin with
  the authenticated app. This is the robust fix.
- Failing a separate origin, render the proxied document inside an
  `<iframe sandbox="allow-popups allow-forms">` **without** `allow-same-origin`,
  and/or send a hard document CSP on the proxy response:
  `Content-Security-Policy: sandbox; default-src 'none'; img-src data: https:; style-src 'unsafe-inline'; ...` — the `sandbox` directive alone forces the response into an opaque origin so it cannot touch `pepnationlab.com` cookies or APIs.
- Keep the existing session gate and rate limit.

#### H-2. `/api/proxy` is carved out of the global security headers
**File:** `next.config.ts:103` — `source: "/((?!api/proxy).*)"`

The `headers()` block that applies HSTS, `X-Frame-Options: DENY`, the full CSP,
COOP, etc. is applied to every path **except** `api/proxy`. The proxy sets its own
headers, but only `X-Frame-Options: SAMEORIGIN` and
`Content-Security-Policy: frame-ancestors 'self'` (lines 277–279). `frame-ancestors`
controls who may frame the proxy — it does **not** restrict what the proxied
document may load or execute. So the single route that serves foreign HTML is the
single route with no `default-src`/`script-src`/`object-src` policy. This is the
enabling condition for H-1.

**Remediation:** send a restrictive document CSP on every proxy response (see
H-1), including `sandbox`, `default-src 'none'`, `object-src 'none'`,
`base-uri 'none'`, `form-action` limited to the proxy, and no `script-src` (or an
empty one) so foreign inline scripts cannot run. If some scripts are genuinely
needed for rendering, that is the strongest argument for the separate-origin
approach.

### MEDIUM

#### M-1. Unescaped reflection in proxy fallback pages
**File:** `app/api/proxy/route.ts` — lines 207–229 (PubMed reader) and 244–255
(generic fallback)

The raw `url` query parameter is interpolated into HTML attributes without
encoding: `href="${url}"` (lines 225, 252). `url` comes straight from
`searchParams.get('url')` (line 101) and is decoded, so it can contain `"`, `<`,
`>`. Likewise `title`, `authors`, `journal`, and `abstract` are pulled from the
external PubTator JSON response and injected unescaped (lines 208, 221–223). A URL
or upstream response crafted to include `"><script>...` breaks out of the
attribute/element → reflected (and, for the JSON path, effectively stored-from-
third-party) XSS on the proxy response. This is lower severity than H-1 only
because H-1 already implies script execution; fixing H-1/H-2 with a `sandbox` CSP
also neutralizes this, but the reflected values should still be HTML-escaped.

**Remediation:** HTML-entity-encode every interpolated value
(`title`, `authors`, `journal`, `abstract`, and use `encodeURI`/attribute-encode
for `url`). A tiny `escapeHtml()` helper applied at each `${...}` site is enough.

#### M-2. CSP allows `script-src 'unsafe-inline'`
**File:** `next.config.ts:140` — `script-src 'self' 'unsafe-inline';`

`'unsafe-inline'` in `script-src` means any successfully-injected inline script or
inline event handler (`onerror=`, `onclick=`, injected `<script>`) executes. It
removes most of the XSS mitigation a CSP is meant to provide. The comment notes it
is retained for inline `<style>`/JSON-LD blocks — but that is `style-src`; JSON-LD
lives in `<script type="application/ld+json">` which is data, not executable, and
does not require `'unsafe-inline'` in `script-src`. `'unsafe-eval'` has already
been correctly removed, which is good.

**Remediation:** move to a nonce- or hash-based CSP for scripts. Next.js supports
per-request nonces; generate one, attach it to first-party `<script>` tags, and
replace `'unsafe-inline'` with `'nonce-<value>' 'strict-dynamic'`. JSON-LD blocks
can carry the nonce or be hashed. This is a moderate refactor but materially
raises the XSS bar.

#### M-3. Missing `middleware.ts` contradicts documentation and removes the edge auth layer
**Files:** repository has **no** `middleware.ts` (nor `src/middleware.ts`);
`CLAUDE.md` Parts 5 & 7, and the comment in `app/register/page.tsx:5-7`, all
describe a middleware that gates auth, protects routes, and redirects `/register`.

Current protection is real but rests entirely on server-component guards in each
`layout.tsx`/`page.tsx` (`app/admin/layout.tsx`, `app/dashboard/layout.tsx`, the
`/register` stub) and on the per-route `requireAdmin/requireAgent/...` helpers.
That pattern works, and the double-guarding on `/admin` (both layout and page) is
good defense in depth. The risks are: (a) there is **no edge fallback** — a new
sensitive page or route added without its own guard is simply unprotected; and (b)
the documentation/comments assert a control that does not exist, which will
mislead future work ("middleware already redirects, so this stub is just backup"
is now false).

**Remediation:** either reintroduce a thin `middleware.ts` that enforces
authentication on protected path prefixes (`/admin`, `/dashboard`, `/checkout`,
etc.) as a belt-and-suspenders layer, or update `CLAUDE.md` and the code comments
to state plainly that auth is enforced at the layout/route level and every new
protected surface **must** add its own guard. Do one of these — the current
docs-vs-reality gap is itself the hazard. (Note: Next 16.2.6 is past the
CVE-2025-29927 middleware-bypass fix, so reintroducing middleware is safe.)

#### M-4. Rate limiting is effectively a no-op without Upstash on serverless
**File:** `lib/rate-limit.ts` (in-memory fallback, lines 43–82, 157–163)

When `UPSTASH_REDIS_REST_URL/TOKEN` are unset, the limiter falls back to a
per-process in-memory `Map` on `globalThis`. On Vercel serverless each request may
hit a different (or cold) instance, and instances are ephemeral, so per-process
counters barely constrain a distributed or even a single determined attacker.
Combined with the deliberate fail-open on Upstash errors (lines 112–119, 139–143),
the protection on auth/register/order/proxy endpoints is only as strong as the
Upstash configuration.

Confirm `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set in Vercel
production. If they are, this is a non-issue and the design is sound; if not, the
rate limits advertised in the code comments are not actually enforced in prod.

**Remediation:** verify the Upstash env vars are present in production; consider
alerting if the limiter falls back to memory in a non-dev environment.

### LOW

#### L-1. CSRF fallback allows header-less cross-origin JSON POSTs
**File:** `lib/csrf.ts` (fallback branch, ~lines 82–94)

When neither `Origin` nor `Referer` is present, the request is allowed if it is
JSON or carries `sec-fetch-mode: cors|same-origin`. The code comment itself notes
anonymous endpoints like `/api/disclaimer-log` are thereby exposed.
Real-world exploitability is low: authenticated routes ride a `SameSite=Lax`
cookie (not sent cross-site) and browsers block cross-site JSON `fetch` without a
CORS opt-in. Worth documenting/tightening, not urgent.

#### L-2. 13 SECURITY DEFINER functions are executable by the `anon` role
**Source:** Supabase security advisor `0028_anon_security_definer_function_executable`

Unauthenticated callers can invoke these via `/rest/v1/rpc/...`. Most are benign:
role helpers (`is_admin`, `is_agent_or_above`, `is_super_agent`, `get_user_role`,
`fn_is_platform_admin`) evaluate the *caller's* identity and return false/null for
anon; `agent_inventory_for_storefront`, `lookup_coa_by_lot`, `coa_coverage_gaps`
appear intentionally public for storefronts. Review `get_sub_agent_ids(uuid)`
specifically — it takes an arbitrary UUID and could let an anon caller probe the
agent hierarchy. Revoke `EXECUTE FROM anon/authenticated` on any of these that do
not need public/self-serve access.
Remediation: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable

#### L-3. Three public storage buckets allow full object listing
**Source:** advisor `0025_public_bucket_allows_listing` — `avatars`,
`product-coas`, `product-images`

The broad `SELECT` policy on `storage.objects` lets any client enumerate every
file in these buckets, not just fetch known URLs. For `product-coas` and
`avatars` that can leak filenames/upload patterns. Public **read of known object
URLs** does not require a listing policy, so scope the policy to specific object
access or move listing behind auth.
Remediation: https://supabase.com/docs/guides/database/database-linter?lint=0025_public_bucket_allows_listing

#### L-4. Secret-adjacent files live in the working tree (not committed)
**Files:** `.gcp-sa-key.json`, `.pnrx-deploy-key`, and 7 `.env*` variants in the
repo root

All are correctly gitignored and **were never committed** (verified against full
git history) — good. The residual risk is operational: a real GCP service-account
key and a Hetzner root SSH key sit in the working directory, so any accidental
zip/copy/backup of the folder leaks them. The proliferation of `.env`, `.env.local`,
`.env.production`, `.env.production.local`, `.env.vercel`, `.env.vercel.prod`,
`.env.vercel.production` also widens the surface for a mistaken commit.
**Remediation:** move the GCP and SSH keys out of the repo tree (e.g. `~/.secrets`),
consolidate the `.env*` sprawl, and rotate the `.pnrx-deploy-key` and GCP key if
there is any doubt about prior exposure.

#### L-5. Stale/committed scratch artifacts
**Files:** `.push-asg.js` (tracked), `cookies.txt` and `.r8-push.json` (in history)

`.push-asg.js` is committed despite being gitignored (gitignore does not untrack).
It reads a GitHub token from env/argv — no hardcoded secret — so it is harmless
content-wise, but a push script living in the repo is clutter. `cookies.txt` and
`.r8-push.json` exist in git history; inspection found **no** Supabase auth tokens
in `cookies.txt` (0 matches) — low risk, but a history scrub (`git filter-repo`)
would remove the ambiguity.
**Remediation:** `git rm --cached .push-asg.js`; optionally purge `cookies.txt`
and `.r8-push.json` from history.

#### L-6. `escapeIlike` leaves `)` unescaped in storefront search
**File:** `app/api/storefront/search/route.ts:86`

Strips commas and escapes `% _ [ \` before a PostgREST `.or(...)` but leaves `)`,
so a `)` in the term can prematurely close the `or=(...)` group → malformed query
(400/500). No cross-tenant disclosure (query is still `.eq('agent_id', ...)`
scoped and commas are stripped). Escape/strip parentheses for parity with the
stricter sanitizers in `messages/search` and `admin/audit`.

---

## 3. What Was Checked and Found Clean

- **API access control (399 routes):** no confirmed Critical/High IDOR, missing
  auth, mass assignment, or injection. Guards (`requireAdmin/Agent/OrdersAccess/
  Session/AgentOrAdmin`) resolve roles via the service client so RLS visibility
  can't spoof them; `requireAgent` correctly excludes admins to preserve
  `agent_id = callerId` ownership. Money/downline routes verify
  `parent_agent_id === caller`. Service-role routes re-check authz in code.
- **Injection sinks:** `admin/audit`, `researcher/ai-stack-analysis`,
  `messages/search`, `availability` all sanitize or whitelist inputs; no raw SQL
  interpolation and no `.rpc()` with concatenated input anywhere.
- **Database/RLS:** 0 ERROR-level advisors. RLS enabled on all public tables; no
  SECURITY DEFINER views; no `auth.users`/PII exposure. The 11
  "RLS-enabled-no-policy" tables are default-deny.
- **Secrets:** `.env*`, `.gcp-sa-key.json`, `.pnrx-deploy-key` never committed; no
  hardcoded JWTs, `sk_`, `ghp_`, `AKIA`, or PEM keys in tracked source.
- **Security headers (non-proxy paths):** HSTS w/ preload, `X-Frame-Options: DENY`,
  `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP, `object-src 'none'`,
  `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`,
  `upgrade-insecure-requests`, and `'unsafe-eval'` removed. Strong.
- **SSRF:** `/api/proxy` is session-gated, rejects non-http(s), blocks
  private/loopback/metadata hosts, and re-validates every redirect hop.
- **Dependencies:** Next 16.2.6 / React 19.2.4 / @supabase/ssr 0.10.3 are current
  (a live `npm audit` was blocked by the sandbox network allowlist — run it in CI:
  see §5).

---

## 4. Suggested Fix Priority

1. **H-1 / H-2 together** — sandbox the proxy (separate origin or a hard
   `sandbox; default-src 'none'` document CSP). Single most valuable change.
2. **M-1** — HTML-escape reflected values in the proxy fallback pages.
3. **M-3** — decide middleware-vs-layout and make docs match reality.
4. **M-2** — nonce-based CSP to drop `script-src 'unsafe-inline'`.
5. **M-4** — confirm Upstash is configured in production.
6. **L-1 … L-6** — hygiene and hardening as capacity allows.

---

## 5. Remaining Risks / Needs Human Action

- **Run `npm audit` / dependency scanning in CI.** The sandbox blocked network
  access, so transitive-dependency CVEs could not be enumerated here. Add
  `npm audit --omit=dev` (or Dependabot/Snyk) to the pipeline.
- **Secret rotation** if there is any doubt about the GCP key or `.pnrx-deploy-key`
  ever having left the machine.
- **PepNationRX** was excluded from this pass. It handles PHI under HIPAA and has a
  split Vercel/Hetzner topology and its own Supabase project — it warrants its own
  dedicated review (advisors, backend Express routes, PHI encryption, BAAs, the
  pending pen test already noted in CLAUDE.md).
- **Penetration test** for the proxy sandboxing fix specifically, once implemented.
- This was a **static/config review**. It cannot prove the absence of every bug;
  it prioritized the highest-likelihood, highest-impact classes.

---

## 6. Final Security Score

**Current: 82 / 100.** A genuinely well-secured storefront held back from the 90s
by one high-impact architectural feature (same-origin proxy) and a few
defense-in-depth gaps. Implementing H-1/H-2, M-1, and M-2 would put it at roughly
**93 / 100**.
