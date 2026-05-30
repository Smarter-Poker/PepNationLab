# PepNationLab Backup Posture

**Last reviewed:** 2026-05-29

## Database

PepNationLab's primary database is Supabase project `ydsaqnnuwyvtyxgvrnys`.

| Layer | Provider | Mechanism | Retention |
|---|---|---|---|
| Postgres data | Supabase (managed AWS RDS) | Daily automated snapshots | 7 days on the free tier; longer on paid tiers |
| Point-in-time recovery (PITR) | Supabase (paid tier) | WAL-based, restores to any second within retention window | Depends on plan; verify in Supabase dashboard |
| Storage buckets (object data: COA, payment proofs, RMA evidence, messenger media, product images, storefront assets) | Supabase Storage | Replicated to the same RDS cluster | Follows the DB snapshot policy |

**Verify retention** in the [Supabase dashboard](https://supabase.com/dashboard/project/ydsaqnnuwyvtyxgvrnys/settings/database).

## Application

| Layer | Provider | Mechanism |
|---|---|---|
| Source code | GitHub (`Smarter-Poker/PepNationLab`) | Distributed git, push-only `main` |
| Deployments | Vercel (`prj_gIhHh2EZWczze8m5li2tE7uNPHfP`) | Every push to `main` creates an immutable deployment. Previous deployments can be promoted from the Vercel dashboard within 30 days for instant rollback |
| Environment variables | Vercel project settings | Mirrored locally in `.env.local` (gitignored) |

## Recovery objectives

- **RPO (Recovery Point Objective):** less than or equal to 24 h for the free tier (last automated snapshot). less than or equal to 5 min with PITR enabled.
- **RTO (Recovery Time Objective):** less than or equal to 60 min for a full DB restore + frontend redeploy.

## Restore drill checklist

The following drill should be run in a Supabase preview branch every 90 days. Track the run timestamp at the bottom of this file.

1. From Supabase dashboard, choose **Restore database** for project `ydsaqnnuwyvtyxgvrnys`.
2. Pick a snapshot or PITR timestamp.
3. Restore into a preview branch (does **not** overwrite production).
4. Verify schema parity with `supabase db diff --linked`.
5. Run a smoke test: log in as a known researcher, place a test order, hit `/api/health` and `/api/status`.
6. Tear down the preview branch.
7. Update the "Last drill" line at the bottom of this file.

## What is NOT backed up automatically

- `.env.local` (developer-local secrets — store these in Vercel + a secure note manager).
- Build artifacts (regenerated on every deploy from `main`).
- Local migration files before they are pushed to `main`.

If a sensitive value is rotated (Supabase service role key, Sentry DSN, CRON_SECRET, VAPID keys, Upstash tokens, Shippo API key), update the Vercel project env vars AND the team's secret store the same hour.

## Off-platform fallback

If Supabase is fully down (P0 incident):

1. The read-only mirror of public marketing pages still serves from Vercel's CDN.
2. `/api/status` will return `503`, which is what `/status` renders.
3. Open a support ticket with Supabase and announce on the team channel.

## Last drill

- 2026-05-29 — Initial documentation captured. Next drill due 2026-08-27.
