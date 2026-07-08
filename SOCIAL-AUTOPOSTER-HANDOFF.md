# Social Autoposter — Human Setup + Antigravity Handoff

**Prepared:** 2026-07-07
**Goal:** Fully automated social publishing (zero ongoing human input) of Claude-generated videos + images + captions across X, YouTube, Instagram, Facebook, Pinterest, (TikTok optional).

**The one irreducible human step:** each platform's posting API requires a one-time OAuth authorization by the account owner (Section B). There is NO compliant way to skip it — it is how the platforms are designed, and bypassing it (raw passwords, browser bots) is a ToS violation that gets accounts banned. **Budget ~45–90 min once.** After that, posting is 100% automatic forever.

---

## SECTION A — What is already built (by Cowork/Claude)

1. **Content generator** — `gen.py` (in the delivered `social-batch/` folder; also portable into the repo at `scripts/social/gen.py`). Renders branded 1080×1920 vertical video Shorts (Python/Pillow slides → ffmpeg) and 1080×1350 image pins/cards, all RUO-compliant, from the compound database + comparison set.
2. **A first finished batch** — 14 videos + 14 images (6 science Shorts, 8 compound-spotlight Shorts, 8 comparison pins, 6 glossary cards).
3. **Captions/calendar** — `social-content-30day-batch.csv` + `SOCIAL-CONTENT-SYSTEM.md`.
4. **Entity `sameAs`** — all 10 profiles wired into the site's Organization schema.

**Not built (blocked on Section B):** the autoposter that publishes. Spec is in Section C.

---

## SECTION B — HUMAN ONE-TIME SETUP (only the account owner can do this)

For each platform: create a developer app, grant it access to the brand account, and capture the resulting long-lived token. Store every value in **Vercel → pepnationlab project → Settings → Environment Variables** (names given per platform). Never commit tokens to git.

### B1. X / Twitter  (@PepNationLab)
1. Go to **developer.x.com** → sign in as the brand account → apply for a developer account (Basic tier; note: X's write API is a **paid** tier, ~$100/mo at time of writing — confirm current pricing).
2. Create a **Project + App**. In the app's **User authentication settings**, enable **OAuth 2.0**, type **Web App**, scopes **tweet.read tweet.write users.read offline.access**, callback `https://pepnationlab.com/api/social/oauth/x/callback`.
3. Copy **Client ID** + **Client Secret**.
4. Run the OAuth authorize flow once (the autoposter exposes `/api/social/oauth/x/start` — Antigravity builds it) → approve → the callback stores the **refresh token**.
5. Env vars: `X_CLIENT_ID`, `X_CLIENT_SECRET`, `X_REFRESH_TOKEN`.

### B2. YouTube  (channel UCvPX1ho_av0jxctz4yER0Og)
1. **console.cloud.google.com** → create a project → enable **YouTube Data API v3**.
2. **OAuth consent screen** → External → add the brand Google account as a test user (or publish).
3. **Credentials → OAuth client ID → Web application**, redirect `https://pepnationlab.com/api/social/oauth/google/callback`. Copy **Client ID + Secret**.
4. Authorize once with scope `https://www.googleapis.com/auth/youtube.upload` → store refresh token.
5. Env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`.

### B3. Instagram + Facebook Page  (Meta — one app covers both)
> Requires the Instagram account to be a **Business or Creator** account **linked to the Facebook Page** (61591787160330). Do that first in the IG app (Settings → Account type).
1. **developers.facebook.com** → Create App → type **Business**.
2. Add products **Facebook Login** and **Instagram Graph API**.
3. Request permissions: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`. (These need **App Review** for production — submit with screencasts; allow a few days.)
4. Redirect `https://pepnationlab.com/api/social/oauth/meta/callback`. Copy **App ID + Secret**.
5. Authorize once → capture a **long-lived Page access token** (60-day, auto-refreshable) + the **IG Business account ID** + **Page ID**.
6. Env vars: `META_APP_ID`, `META_APP_SECRET`, `META_PAGE_ID`, `META_PAGE_TOKEN`, `IG_BUSINESS_ID`.

### B4. Pinterest  (PepNationLab)
1. **developers.pinterest.com** → create an app (needs a Pinterest **business** account — convert if needed).
2. Scopes `boards:read pins:read pins:write`. Redirect `https://pepnationlab.com/api/social/oauth/pinterest/callback`.
3. Authorize once → store refresh token + the target **board ID**.
4. Env vars: `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET`, `PINTEREST_REFRESH_TOKEN`, `PINTEREST_BOARD_ID`.

### B5. TikTok  (optional — hardest)
- TikTok's **Content Posting API** requires app registration + audit approval and is restrictive. Recommend **deferring** TikTok to a scheduler (Metricool) rather than direct API. If pursued: developers.tiktok.com → app → `video.publish` scope → audit. Env: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REFRESH_TOKEN`.

### B6. Reddit — DO NOT automate
- Keep manual. Automated self-promo posting gets accounts shadowbanned. Participate genuinely.

---

## SECTION C — ANTIGRAVITY BUILD SPEC (the autoposter)

> **CRITICAL for the building agent:** Do NOT claim success until a real post has landed on a real (ideally test/secondary) account and been verified in that account's feed. Untested posting code that "compiles" is not done. Post to one platform end-to-end first, verify, then enable the rest.

### C1. Where assets live
The generator writes finished MP4/PNG files. Upload them to a public bucket (Supabase Storage `social-media` bucket, public read) so platform APIs can fetch them by URL. Store the public URL on each queue row.

### C2. Supabase — queue table (migration against `ydsaqnnuwyvtyxgvrnys`)
```sql
create table if not exists social_posts (
  id uuid primary key default gen_random_uuid(),
  platform text not null,            -- 'x' | 'youtube' | 'instagram' | 'facebook' | 'pinterest'
  media_url text,                    -- public URL to the MP4/PNG (null for text-only)
  media_type text,                   -- 'video' | 'image' | 'none'
  caption text not null,
  link text,
  scheduled_for timestamptz not null,
  status text not null default 'pending', -- 'pending'|'posted'|'failed'|'blocked'
  posted_at timestamptz,
  platform_post_id text,
  error text,
  compliance_checked boolean default false,
  created_at timestamptz default now()
);
create index on social_posts (status, scheduled_for);
-- RLS: service-role only (no public access).
alter table social_posts enable row level security;
```

### C3. Posting library — `lib/social/*.ts`
One function per platform, each taking `{ mediaUrl, caption, link }` and returning `{ id }`:
- `postX()` — OAuth2 refresh → `POST https://api.twitter.com/2/tweets` (media via v1.1 upload first if attaching).
- `postYouTube()` — refresh → resumable upload to `youtube.videos.insert` (Shorts = vertical <60s + `#Shorts` in title/desc).
- `postInstagram()` — Graph API: create media container (`/{ig_id}/media` with `video_url`/`image_url` + caption) → poll status → `/{ig_id}/media_publish`.
- `postFacebook()` — Graph API `/{page_id}/photos` or `/{page_id}/videos` with the page token.
- `postPinterest()` — `POST /v5/pins` with `board_id`, `media_source` (image URL), `link`.
Each: refresh the token, handle rate limits, return the platform post ID; throw on failure.

### C4. Compliance gate — `lib/social/compliance-check.ts`
Before posting, run a hard keyword/deny check on the caption (block: dose, dosage, mg per kg, "buy", "for weight loss/healing/anti-aging" as benefit, "cure", "treat", human-use verbs). Optionally call an LLM classifier. On fail → set status `'blocked'`, do not post. **This is the guardrail that keeps the accounts alive — do not skip it.**

### C5. Cron — `app/api/cron/social-autopost/route.ts`
- Guard with `CRON_SECRET` (Bearer header), like the other cron routes.
- Select `social_posts where status='pending' and scheduled_for <= now()` (limit ~10).
- For each: run compliance gate → call the platform function → update `status`, `posted_at`, `platform_post_id` or `error`.
- Add to `vercel.json` crons: `{ "path": "/api/cron/social-autopost", "schedule": "0 * * * *" }` (hourly) and add `/api/cron/social-autopost` to `proxy.ts` PUBLIC_ROUTES (the cron reaches it; CRON_SECRET enforced in-route). Add `/api/cron/social-autopost` to the rate-limit exempt prefixes.

### C6. Generator → queue wiring
A second cron (or the existing content pipeline) runs `gen.py` monthly, uploads assets to the `social-media` bucket, and inserts `social_posts` rows from `social-content-30day-batch.csv` (date → `scheduled_for`, platform, caption, link, media_url). After that, C5 posts them automatically.

### C7. Isolation / risk
- All new code is **additive** (new `lib/social/`, new `app/api/social/` + `app/api/cron/social-autopost/`, one migration, env vars). It does not touch storefront, checkout, auth, or research pages.
- The only shared-file edits: `proxy.ts` (add the two route allowances) and `vercel.json` (one cron). Keep those diffs minimal.
- Ship behind an env flag `SOCIAL_AUTOPOST_ENABLED` (default off) so a half-configured platform never posts garbage.

---

## SECTION D — Order of operations (recommended)
1. **You:** do Section B for **one** easy platform first — Pinterest or YouTube (no app-review wait). Capture tokens into Vercel env.
2. **Antigravity:** build C1–C5 for that one platform; post one test asset; **verify it appears in the account**; only then claim that platform done.
3. Repeat per platform. Meta (IG/FB) needs App Review — start that submission early since it takes days.
4. Turn on the monthly generator (C6). Steady state = zero human input.

---

## Honest summary
- **Generation (video/image/caption): built and verified today.** Reusable generator + a real 28-asset batch delivered.
- **Publishing: cannot be built to "done" until Section B tokens exist** — it's spec'd end-to-end here and is a ~1–2 day build for Antigravity once you complete the one-time OAuth. No post has been or can be published without that step.
