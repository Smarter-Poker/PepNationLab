# Multi-Agent Deploy Runbook — many agents, zero deploy storm (free-plan design)

Goal: many agents push and publish **at the same time**, with **no** Blocked and
**no** Error production deployments, and **no** serialization. Branch protection
and native auto-merge require a paid GitHub plan on a private repo, so this design
uses **GitHub Actions** (free on private repos) to gate what reaches PRODUCTION
instead of what reaches `main`.

## The two failure modes

- **Blocked** = the commit's git author is not a Vercel team member (a private-repo
  rule). Came from `cowork-oneshot` / `github-actions[bot]` one-shot workflows and
  `daniel@bekavactrading.com`.
- **Error** = the commit does not compile and was pushed straight to `main`, which
  auto-deployed to production.

## The model: gate PRODUCTION, not `main`

1. Agents keep pushing to `main` freely and concurrently — nothing changes for them.
2. Vercel's **Production Branch is set to `production`** (one-time setting), so a
   push to `main` no longer deploys production by itself.
3. `.github/workflows/promote-to-production.yml` runs on every push to `main`:
   - **author gate** — HEAD must be authored by the approved team identity.
   - **build gate** — runs the real Turbopack production build.
   - If BOTH pass, it fast-forwards the `production` branch to that commit.
4. Vercel deploys `production`. Therefore every production deploy is green AND
   team-authored. A broken or bot-authored commit is simply **not promoted**;
   production holds the last good commit until a green, correctly-authored one lands.

Concurrency is untouched: all agents push to `main` whenever they want. The gate
only decides what is safe to promote; the newest green commit always wins.

## One-time setup (repo owner)

### 1. Vercel — point production at the gated branch
Vercel > Project `pepnationlab` > Settings > Git > **Production Branch** = `production`
(currently `main`). This is the only required change; it is a single dropdown.

### 2. GitHub Actions secrets — DONE
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` are set so the build gate builds exactly like Vercel.

### 3. Nothing else
No branch protection, no auto-merge, no plan upgrade, no PRs required.

## Agent workflow (unchanged)
Agents keep committing and pushing to `main` under the team identity:
```
git config user.name  "Smarter-Poker"
git config user.email "254329056+Smarter-Poker@users.noreply.github.com"
git commit -am "..."
git pull --rebase origin main
git push origin main
```
That is all. If a push is green and team-authored it is promoted automatically,
usually within a couple of minutes. If it fails a gate, the Actions run goes red
(the agent sees exactly what to fix) and production is untouched.

## Notes / troubleshooting

- The gate workflow only reads, builds, and moves the `production` ref forward. It
  never edits app code, so it cannot itself create a Blocked/Error deploy.
- Preview deployments of `main` and feature branches still build in Vercel; if one
  is bot-authored it may show "Blocked", but that is cosmetic — it does not affect
  `production`. Fix it by committing under the team identity (see
  `docs/AGENT-GIT-IDENTITY.md`, mirrored as the first rule in `CLAUDE.md`).
- Optional: `.github/workflows/pr-gate.yml` provides the same two checks on PRs for
  teams that also use PRs. It is not required by this design.
- If you later upgrade the GitHub plan, you can additionally turn on branch
  protection requiring these checks for defense in depth, but it is not necessary.
