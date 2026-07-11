# Deploy Notes

## Vercel Commit Author Rule (Private Repo)

Since this repo became PRIVATE, Vercel BLOCKS any production deployment
whose git commit author is not a member of the `smarter-poker` Vercel
team. Blocked deployments show state "Blocked" in the Vercel dashboard
and never build.

Rules for every agent and human committing here:

1. Commit as the team identity:
   `git config user.name "Smarter-Poker"`
   `git config user.email "254329056+Smarter-Poker@users.noreply.github.com"`
   (Already applied to the local working copy on 2026-07-14.)
2. GitHub API pushes (MCP push_files) and github-actions bot commits are
   always accepted.
3. If a deployment shows Blocked: the commit content is NOT live. Land a
   team-authored commit on top (any small change) to redeploy HEAD -
   Vercel deploys the full tree, so the blocked commit's content ships
   with it.
4. Do not add personal GitHub accounts to the Vercel team just to clear
   a block unless Dan approves the seat.

History: commits 5bc08c05 and a59bbbce (authored as Dan
<danbek4545@gmail.com>) were blocked on 2026-07-14; their content
shipped via the next team-authored commit.
