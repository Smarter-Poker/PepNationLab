# Agent Git Identity And Account Usage -- Canonical Rule

This is a hard platform rule with zero exceptions. It applies to EVERY agent and
EVERY environment (Cowork, Antigravity, Claude Code, CI bots, or any other). It
is mirrored as the first rule in `CLAUDE.md`.

## Why

The repo is PRIVATE. Vercel BLOCKS any production deployment whose git commit
author is not a member of the Smarter-Poker Vercel team. A commit authored under
the wrong identity deploys as **Blocked**, never reaches production, and strands
its content on `main` until someone re-commits it under an approved identity.

## The ONLY git identity any agent may commit under

- Name: `Smarter-Poker`
- Email: `254329056+Smarter-Poker@users.noreply.github.com`
- GitHub account: `Smarter-Poker` (id `254329056`)

Set it in every environment BEFORE committing:

```
git config user.name "Smarter-Poker"
git config user.email "254329056+Smarter-Poker@users.noreply.github.com"
```

## NEVER commit or deploy under any of these -- they are BLOCKED by Vercel

- `daniel@bekavactrading.com` (author name "Cowork Audit" or "Dan")
- The `SmarterPoker` GitHub account (id `253155403`) -- note: no hyphen. This is
  a DIFFERENT account from the team account `Smarter-Poker` (id `254329056`).
- Any personal email or any identity not listed above.

## Do NOT add new users to clear a block

Never add a member to the Vercel team or the GitHub org to make a blocked commit
deploy, and never change the Vercel Git author-authorization setting. The fix is
ALWAYS to re-commit the same changes under the approved `Smarter-Poker` identity
above. Adding or changing accounts is a security decision reserved for the repo
owner and must never be done by an agent.
