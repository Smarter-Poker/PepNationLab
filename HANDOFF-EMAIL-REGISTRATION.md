# Antigravity Handoff: Turn On Email + Finish The Verified-Registration System

You are picking up a feature that is **built, committed, deployed, and live** on
`pepnationlab.com`, but is running in a **graceful "email-not-configured" mode**.
Your job is to supply the email sender credential, fix email DNS, verify the full
flow end to end, then complete the follow-on wiring. Do NOT rebuild what already
exists — read this fully first.

Follow all platform rules in `CLAUDE.md` (no emojis anywhere, Title Case on all
user-facing text, PepNationLab/PepNationRX/Smarter.Poker isolation, and the
mandatory ship-at-end-of-build sequence: commit, push to `main`, apply SQL to the
correct Supabase project, verify on the live production URL).

Note: multiple agents commit to this repo concurrently. Pull/rebase before
pushing; stage only the specific files you change.

---

## What already exists (do not rebuild)

A username-based account system now also collects and verifies a **real email**
via a single-use 6-digit code. Login stays username-based
(`auth.users.email` remains `<username>@internal.auth`); the real email lives on
`profiles.contact_email` + `profiles.email_verified`.

Files (all on `main`, all TypeScript-clean):

- `lib/email.ts` — zero-dependency, `fetch`-based transactional sender. Provider
  is Resend via REST (`POST https://api.resend.com/emails`). Exposes
  `emailConfigured()`, `sendEmail()`, and templates: `sendWelcomeEmail`,
  `sendOrderConfirmationEmail`, `sendPasswordResetEmail`,
  `sendVerificationCodeEmail`. Safe no-op (`{ skipped: true }`) when unconfigured.
- `lib/verification.ts` — 6-digit code generation, email-bound salted SHA-256
  hashing (`hashCode`), validation, 10-minute expiry, 5-attempt cap.
- `app/api/auth/request-code/route.ts` — public, IP + per-email rate-limited.
  Issues + emails a code. Returns `verification_required:false` when the sender
  is not configured so signup still works.
- `app/api/storefront/register/route.ts` — public signup creator. Requires a
  valid email; when the sender is live it requires + consumes a valid code and
  sets `email_verified=true`; otherwise stores the email unverified. Fires
  `sendWelcomeEmail` best-effort.
- `app/signup/page.tsx` — email field + two-step 6-digit code UI (resend,
  change-email), with a graceful direct-create path.
- `proxy.ts` — `/api/auth/request-code` added to `PUBLIC_ROUTES`.
- `supabase/migrations/20260707223000_email_verification_and_contact_email.sql`
  — ALREADY APPLIED to PepNationLab prod.

Database (PepNationLab prod, Supabase ref `ydsaqnnuwyvtyxgvrnys`):
- `profiles.contact_email TEXT`, `profiles.email_verified BOOLEAN DEFAULT false`.
- `email_verification_codes` (id, email, code_hash, purpose, attempts, consumed,
  expires_at, created_at). Codes are HASHED only. RLS is deny-all
  (service-role only) — do not add anon/authenticated policies.

### The activation contract
`emailConfigured()` returns true only when `EMAIL_PROVIDER=resend` AND
`RESEND_API_KEY` is set. The instant that is true in production, the full 6-digit
verification path turns on automatically with no code change. Until then, signups
still work and emails are captured unverified.

---

## Your tasks

### 1. Choose and configure the email sender (REQUIRED — this is the unlock)

The domain email is **Google Workspace** (MX = Google). Two valid paths:

**Path A — Resend (recommended; the code is already built for it).**
1. Create a Resend account and add + verify the sending domain `pepnationlab.com`
   (Resend gives you exact DKIM/SPF/return-path DNS records).
2. In the Vercel project `pepnationlab`
   (id `prj_gIhHh2EZWczze8m5li2tE7uNPHfP`, team `team_SVD8r7AOPH065G3usBxVvrBc`),
   add Production env vars:
   - `EMAIL_PROVIDER=resend`
   - `RESEND_API_KEY=<the key>`
   - `EMAIL_FROM=Pep Nation Lab <research@pepnationlab.com>`
   - (optional) `EMAIL_REPLY_TO=support@pepnationlab.com`
   - (optional) `EMAIL_CODE_PEPPER=<random 32+ char secret>` (otherwise the
     service role key is used as the pepper — fine, but a dedicated pepper is
     cleaner).
3. Redeploy so the env vars take effect.

**Path B — Google Workspace SMTP (uses the existing mailboxes).**
Mailboxes: `research@pepnationlab.com`, `support@pepnationlab.com` (Google
Workspace). IMPORTANT: the normal mailbox password does NOT work for SMTP —
Google requires a per-account **App Password** (2-Step Verification must be ON;
the Workspace admin must not have disabled App Passwords). If you take this path:
1. Add `nodemailer` to `package.json` dependencies (the sandbox may block
   `npm install`; Vercel installs it on build).
2. Add an SMTP branch to `sendEmail()` in `lib/email.ts` guarded by
   `EMAIL_PROVIDER=smtp`, using `smtp.gmail.com:587` with `SMTP_USER` +
   `SMTP_PASS` (the App Password). Update `emailConfigured()` to return true for
   `smtp` when `SMTP_USER`/`SMTP_PASS` are set.
3. Set Vercel env vars: `EMAIL_PROVIDER=smtp`, `SMTP_USER`, `SMTP_PASS`,
   `EMAIL_FROM`. Note the ~2,000/day Workspace cap.

Path A is preferred: better deliverability, no App-Password/2FA friction, no new
npm dependency, and the code already supports it.

### 2. Fix email deliverability DNS (REQUIRED regardless of path)

The domain currently has NO SPF and NO DKIM (only a `google-site-verification`
TXT). Mail will land in spam without these. DNS is at Namecheap (Advanced DNS):
- SPF (TXT on `@`): `v=spf1 include:_spf.google.com ~all` (if you also send via
  Resend, use their exact SPF/return-path records instead of or alongside this).
- DKIM: enable in Google Admin (Apps > Google Workspace > Gmail > Authenticate
  email) and/or add Resend's DKIM CNAME/TXT records.
- DMARC (TXT on `_dmarc`): `v=DMARC1; p=none; rua=mailto:support@pepnationlab.com`.

### 3. Verify the full flow end to end (REQUIRED)

1. On production `https://pepnationlab.com/signup`, enter a real email you control.
2. Confirm a 6-digit code email arrives (check spam too — SPF/DKIM matter here).
3. Enter the code; confirm the account is created and you are signed in.
4. In Supabase (`ydsaqnnuwyvtyxgvrnys`) confirm the new `profiles` row has
   `contact_email` set and `email_verified=true`, and that the used row in
   `email_verification_codes` is `consumed=true`.
5. Confirm the welcome email arrives.
6. Negative checks: wrong code is rejected and increments `attempts`; expired
   code is rejected; more than 5 attempts is blocked.

### 4. Follow-on wiring (after email is verified working)

- Wire `sendOrderConfirmationEmail` into the order-creation flow
  (`app/api/orders/route.ts`) using the buyer's `contact_email`.
- Wire `sendPasswordResetEmail` into the password-reset flow.
- Existing username-only users have no `contact_email`. Add an optional "Add /
  verify your email" prompt in account settings (reuse `/api/auth/request-code`
  + a small verify endpoint) so the back catalog becomes emailable.
- The abandoned-cart-recovery cron can now use email once the sender is live.

---

## Verification / acceptance criteria

- `GET https://pepnationlab.com/api/auth/request-code` returns `405` (route
  exists, public, POST-only). Already true.
- With the sender configured: a real signup receives a code, verifies, and the
  resulting `profiles` row has `email_verified=true`.
- `npx tsc -p tsconfig.json` is clean; production deploy is READY on Vercel.
- No emoji anywhere; all new user-facing strings are Title Case.
- Do not weaken `email_verification_codes` RLS (must stay deny-all /
  service-role-only). Do not change the username login model.

## Key references

- PepNationLab Supabase (prod): `ydsaqnnuwyvtyxgvrnys`. NEVER touch
  `cupnhfdwveouenutnveg` (PepNationRX) or `kuklfnapbkmacvwxktbh` (Smarter.Poker).
- Vercel project `pepnationlab` (`prj_gIhHh2EZWczze8m5li2tE7uNPHfP`), team
  `team_SVD8r7AOPH065G3usBxVvrBc`. Auto-deploys on push to `main`.
- GitHub: `Smarter-Poker/PepNationLab`, branch `main`.
