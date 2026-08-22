You are working in a Smarter-Poker repo. Before anything else, read
AGENT-PLAYBOOK.md at the repository root. It is byte-identical in all seven
repos and estate-integrity checks hourly that it still is. Your always-on rule
.agents/rules/00-agent-playbook.md is the summary; the playbook is the source.

HOW YOU SHIP. Every time, no exceptions:

  eval "$(bash scripts/agent-workspace.sh <your-agent-name> fix/<short-slug>)"
  # ...do the work...
  git add -A && git commit -m "fix(scope): what changed"
  git push -u origin HEAD && gh pr create --fill
  # STOP. You are done.

Agent Autopilot enables squash auto-merge within seconds and GitHub merges it
when the required checks go green. YOU NEVER MERGE. If a PR is not merging,
read the failing check and fix the code — never reach for a flag that makes the
check stop applying.

STEP 1 IS THE ONE THAT MATTERS MOST. Three to five agents work in these repos
at once and a working tree has exactly one HEAD, one index, one set of
uncommitted files. Committing in the shared clone puts your work in the path of
the next agent's checkout. .husky/pre-commit now REFUSES that commit and prints
the exact command above. Do not work around it.

WORK THROUGH THE CLI AND THE API. NEVER THE BROWSER UI.
git, gh, the Supabase MCP, HTTP. Not clicking. A click leaves no audit trail,
and every guard here reasons about repository state through the API — an action
taken outside it is invisible to all of them. Reading a rendered page to check
production looks right is fine; performing a git, deploy or database operation
there is not.

The GitHub UI shows things that are NOT signals. The "had recent pushes —
Compare & pull request" banner persists for about a day AFTER the branch has
merged or been deleted. Ask the API instead:
  gh pr list --state all --head <branch>

NEVER:
  gh pr merge --admin              (bypasses checks; red code reached main 4x)
  gh pr merge --merge / --rebase   (disabled; fails SILENTLY while you report success)
  git push or --force to main      (blocked; a force-push once dropped 4 live commits)
  git pull --rebase origin main    (strands the clone; use scripts/git-unstick.sh)
  --no-verify                      (skips every hook, each one exists because something was lost)
  --ours / --theirs on a whole file (how a leaderboard RPC vanished while its signature survived)
  any polling / wait-and-merge script (Autopilot already does this, server-side)
  writing a migration and not applying it (apply with the Supabase MCP apply_migration —
                                          otherwise it fails 42703 into a catch block
                                          and NOTHING goes red)
  vercel deploy / vercel --prod / any deploy hook
  asking a human to push, merge, deploy or approve anything

CREDENTIALS — you are not missing them, you are looking in the wrong place. No
secret value is written in any file in these repos; several are public.
  - Merges and publishing: GitHub App "Smarter-Poker-Autopilot", id 4680372,
    via vars.AUTOPILOT_APP_ID + secrets.AUTOPILOT_APP_PRIVATE_KEY in all 7
    repos. Workflows mint a fresh token per run. It cannot expire.
  - GH_PAT is a legacy fallback only, expiring 2026-11-19.
  - GITHUB_TOKEN is for issue writes only. NEVER merge with it: a merge made
    with it does not trigger downstream workflows, so the commit lands and
    never publishes.
  - Supabase / Vercel / Hetzner: repo secrets in CI, .env.local locally
    (gitignored). smarter.poker is kuklfnapbkmacvwxktbh. PepNationLab is
    ydsaqnnuwyvtyxgvrnys. Never cross them.
If a credential is genuinely dead, the workflow that needs it says so by name
and opens an issue. Do not guess and do not ask for a secret to be pasted.

IF YOU THINK YOU HAVE LOST WORK — you almost certainly have not:
  bash scripts/agent-trees-audit.sh            # what is at risk right now
  bash scripts/agent-trees-snapshot.sh --list  # what was captured
  git checkout -b rescue refs/wip/<ref>        # recover it
.husky/reference-transaction refuses any ref update that would orphan local
commits and SAVES them to refs/wip/orphan-guard/ first. A snapshot of every
working tree runs every ten minutes.

BEFORE YOU SAY IT IS DONE, ask production — not the exit code:
  curl -s https://smarter.poker/hub/club-arena/build-info.json   # Club Arena
  curl -s https://smarter.poker/api/health                        # World Hub
Compare to main. A green tick answers "did it merge". Only production answers
"did it ship", and every failure this estate has had hid behind something that
reported success.
