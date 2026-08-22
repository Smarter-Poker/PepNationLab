# Agent Git Identity And Account Usage -- Canonical Rule

This is a hard platform rule with zero exceptions. It applies to EVERY agent and
EVERY environment (Cowork, Antigravity, Claude Code, CI bots, GitHub Actions, or
any other). It is mirrored as the first rule in `CLAUDE.md`.

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
- `cowork-oneshot` / `oneshot@users.noreply.github.com` (GitHub org `oneshot`).
- `github-actions[bot]` / `41898282+github-actions[bot]@users.noreply.github.com`
  and any `*-bot` name paired with it (e.g. `comparetool-toast-bot`,
  `seo-layers-bot`, `coa-nav-rename-bot`).
- Any personal email or any identity not listed above.

## GitHub Actions / CI workflows that commit (the #1 cause of Blocked deploys)

Every recurring wave of Blocked deployments has come from one-shot / self-deleting
GitHub Actions workflows that push a commit whose author is a bot. A workflow's
commit author is whatever `git config` the runner has, so any workflow that
commits MUST set the team identity explicitly:

```yaml
      - name: Commit and push (MUST use the team identity)
        run: |
          git config user.name "Smarter-Poker"
          git config user.email "254329056+Smarter-Poker@users.noreply.github.com"
          git add -A
          git commit -m "..."
          git pull --rebase origin main
          git push origin main
```

Do NOT set `user.name`/`user.email` to `github-actions[bot]`, a `*-bot` name, or
`cowork-oneshot`. If you copy an existing `.github/workflows/apply-*.yml` as a
template, fix its `git config` lines to the Smarter-Poker identity first.

Prefer committing small changes directly through the team-authenticated API
(which is already authored as `Smarter-Poker`) instead of spawning a
commit-and-self-delete workflow; reserve the workflow pattern for edits too large
to round-trip through the API.

## Do NOT add new users to clear a block

Never add a member to the Vercel team or the GitHub org to make a blocked commit
deploy, and never change the Vercel Git author-authorization setting. The fix is
ALWAYS to re-commit the same changes under the approved `Smarter-Poker` identity
above. Adding or changing accounts is a security decision reserved for the repo
owner and must never be done by an agent.
