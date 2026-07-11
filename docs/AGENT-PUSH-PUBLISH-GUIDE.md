# How To Push & Publish (For Claude / Cowork Agents)

**If you are an AI agent working on this repo from a Cowork/Claude sandbox, read this first.**

## The one thing to understand

Your **sandbox shell cannot reach the internet.** Both `device_bash` (the user's
local bridge VM) and the cloud `Bash` tool are network-isolated for git — `git push`
will fail with `Could not resolve host: github.com` or `403`. **This is expected. Do
not waste time fighting it.**

Pushing, deploying, and database changes all go through the **MCP connectors**, which
have their **own network access and credentials** — nothing to do with the shell.

| Task | Use this connector | Do NOT use |
|---|---|---|
| Push code to GitHub | `mcp__remote-devices__github__*` | `git push` in a shell |
| Deploy / check builds | `mcp__Vercel__*` (auto-deploys on push to `main`) | shell curl to Vercel |
| Database / SQL / migrations | `mcp__Supabase__*` | shell `psql` |

## Pushing code (GitHub connector)

Commit `main` is where production lives; a push to `main` triggers a Vercel deploy
automatically.

**Push one or more files in a single commit** (no SHA needed — the connector handles
create-or-update and bases the commit on current `main` HEAD):

```
mcp__remote-devices__github__push_files({
  owner:  "Smarter-Poker",
  repo:   "PepNationLab",
  branch: "main",
  message: "feat(x): short description",
  files: [
    { path: "lib/foo.ts", content: "<full file contents>" },
    { path: "docs/bar.md", content: "<full file contents>" }
  ]
})
```

- `mcp__remote-devices__github__create_or_update_file` — single file variant.
- `mcp__remote-devices__github__get_file_contents` — read the current file on a branch
  (use to confirm a push landed, or to fetch a blob SHA).
- `mcp__remote-devices__github__list_commits` — verify HEAD after pushing.

**Size / reproduction caveat:** `push_files` requires the **full file content inline**.
For small or new files (docs, config, a component) this is reliable. For **very large
source files** (e.g. `lib/cities/cities-data.ts`, hundreds of KB) do NOT hand-inline
them — you cannot reproduce that many bytes without risking corruption that breaks the
build. For large files: make the edit on disk, commit locally, and let the user's
auto-push pipeline carry it — OR split the change. Small/targeted → connector. Large →
pipeline.

## Deploying (Vercel connector)

Pushing to `main` auto-deploys. To watch or debug:

- `mcp__Vercel__list_deployments` / `mcp__Vercel__get_deployment` — status of the build.
- `mcp__Vercel__get_deployment_build_logs` — build failures.
- `mcp__Vercel__get_runtime_errors` / `get_runtime_logs` — post-deploy errors.
- `mcp__Vercel__deploy_to_vercel` — trigger a deploy manually if needed.

## Database / SQL (Supabase connector)

Write **all** SQL through the Supabase connector — never assume a shell DB client.

- `mcp__Supabase__list_tables` — inspect schema before changing it.
- `mcp__Supabase__apply_migration` — DDL / schema changes (creates a named migration).
- `mcp__Supabase__execute_sql` — queries / data changes.
- `mcp__Supabase__get_advisors` — security & performance lints (run after schema changes).
- `mcp__Supabase__get_logs` — debug.
- `mcp__Supabase__list_migrations` — see what's applied.

## Standing rules for this repo

1. **Push + publish everything pending every time you stop.** Don't leave work only in
   the working tree or in a local commit — get it to `main` via the GitHub connector so
   Vercel deploys it. Verify with `list_commits` / `get_file_contents`.
2. **Write any and all SQL as needed** through the Supabase connector, with a migration
   for schema changes.
3. **This is a multi-agent repo.** Several agents may edit in parallel. Before doing a
   big rewrite of a shared file (especially `lib/cities/cities-data.ts`), check it isn't
   being actively rewritten by another agent (compare counts / mtime a minute apart). If
   it is, coordinate — don't clobber.
4. **Stale `.git` locks:** the device-bridge mount can't delete files, so `git`
   operations leave stale `.git/index.lock`. Clear by moving it aside
   (`mv .git/index.lock _to_delete/`), never rely on `rm`.

## Quick reference: the shell CANNOT, the connectors CAN

- Shell (`device_bash`, cloud `Bash`): edit files, run `node`/`python`/`tsc`, `git
  add`/`git commit` locally. **No network for git/deploy/DB.**
- Connectors (`github`, `Vercel`, `Supabase`): the network + credentials. **Use these to
  push, deploy, and run SQL.**
