# Redeploy 2026-07-11 — Unblock Security + Billing Remediation

This file exists only to trigger a production deployment authored by the
Smarter-Poker Vercel-team identity.

## Why

- `main` HEAD (`0264f057`, security+billing remediation) and its parent
  `585ac701` (COA data for all 111 products) were committed, but the live
  production deployment was still `550d901`.
- `0264f057`'s production deploy was **Blocked** by Vercel's private-repo
  policy: the commit's git author was `SmarterPoker` / `daniel@bekavactrading.com`
  (GitHub id 253155403), which is not the Vercel-team member `Smarter-Poker`
  (GitHub id 254329056). Redeploying the same commit re-blocks it.
- This commit is authored by the team identity, so its production build is
  authorized. Because it sits on top of both prior commits, the build ships
  their content to production.

## The rule (do this, not the other thing)

The ONLY fix for a Blocked-by-author deployment is to re-commit the same changes
under the approved `Smarter-Poker` identity
(`254329056+Smarter-Poker@users.noreply.github.com`).

Do NOT add `daniel@bekavactrading.com` (or any other identity) to the Vercel
team or the GitHub org to clear a block, and do NOT change the Vercel Git
author-authorization setting. Adding or changing accounts is a security decision
reserved for the repo owner. The canonical rule lives in
`docs/AGENT-GIT-IDENTITY.md` and as the first hard rule in `CLAUDE.md`.
