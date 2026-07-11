# Multi-Agent Deploy Runbook — many agents, zero deploy storm

Goal: many agents push and publish **at the same time**, with **no** Blocked and
**no** Error production deployments, and **no** serialization (no "one agent at a
time"). This is achieved by moving the gate to **before** `main` instead of after.

## The two failure modes (and why they happened)

- **Blocked** = the commit's git author is not a Vercel team member. On a private
  repo Vercel refuses to build such commits. Every Blocked deploy came from a
  commit authored by `cowork-oneshot` / `oneshot@users.noreply.github.com`,
  `github-actions[bot]` (a one-shot CI workflow), or `daniel@bekavactrading.com`.
- **Error** = the commit does not compile (missing module/export, a parse error
  from heredoc-escaped source, etc.) and was pushed straight to `main`, so the
  broken build was the production build.

Both happened because agents pushed **directly to `main`**, which auto-deploys to
production. Any single agent could break production for everyone.

## The model: gate before `main`, merge in parallel

1. **No direct pushes to `main`.** Every agent works on its own branch and opens
   a Pull Request into `main`. Agents never wait on each other — each has its own
   branch and its own PR.
2. **Two required checks** run on every PR (`.github/workflows/pr-gate.yml`):
   - **build-gate** runs the real Turbopack production build. A PR that does not
     compile cannot merge. -> No more **Error** production deploys.
   - **author-gate** fails if any commit is not authored by the approved team
     identity. -> No more **Blocked** production deploys.
3. **Auto-merge** merges each PR the instant *its own* two checks pass. Ten agents
   with ten PRs = ten independent merges as each goes green. GitHub orders the
   actual merge commits for you (merge queue / up-to-date check); the agents
   themselves never block.
4. `main` stays green and correctly-authored **by construction**, so the existing
   "auto-deploy production on push to `main`" keeps working — every production
   deploy is now green and authorized.

Result: unlimited concurrent push + publish; broken or mis-authored work fails on
its own PR (visible only to that agent) and never touches production.

## One-time setup (repo owner)

These cannot be done by an agent through the API; do them once in the GitHub UI.

### 1. Add build secrets (repo Settings > Secrets and variables > Actions)
So `build-gate` can run the same build as Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

(Values are the PepNationLab production values already in the Vercel dashboard.)

### 2. Branch protection on `main` (Settings > Branches > Add rule, branch `main`)
- Require a pull request before merging. Do **not** require approvals (agents
  cannot review each other) — the checks are the gate, not humans.
- Require status checks to pass before merging; select **both**:
  - `Author identity gate`
  - `Production build gate`
- Require branches to be up to date before merging (or turn on the merge queue).
- Do not allow bypassing the above (applies to everyone, including admins/bots).

### 3. Enable auto-merge (Settings > General > Pull Requests)
- Turn on **Allow auto-merge**.
- Each agent, right after opening its PR, enables auto-merge on it (GitHub CLI:
  `gh pr merge --auto --squash`, or the "Enable auto-merge" button). The PR then
  merges itself the moment both checks are green.

### 4. Agent workflow (replaces "push straight to main")
```
git config user.name  "Smarter-Poker"
git config user.email "254329056+Smarter-Poker@users.noreply.github.com"
git checkout -b agent/<short-task-name>
# ...make changes...
git commit -am "..."
git push -u origin agent/<short-task-name>
gh pr create --fill --base main
gh pr merge --auto --squash   # merges automatically once checks pass
```

## Notes

- The gate workflow only reads/checks; it never commits, so it can never itself
  create a Blocked or Error deployment.
- If a legitimate new committer identity is added to the Vercel team later, add
  its no-reply email to `APPROVED_EMAIL` handling in `pr-gate.yml`.
- Identity rules also live in `CLAUDE.md` (first hard rule) and
  `docs/AGENT-GIT-IDENTITY.md`. The author-gate is the mechanical enforcement of
  those rules.
