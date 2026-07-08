# Antigravity Handoff Prompt — Connect All Social Accounts To The Autoposter

Copy everything in the fenced block below into Antigravity as the task prompt.

---

```
ROLE
You are connecting Pep Nation Lab's social media accounts to the autoposter that
is ALREADY BUILT and deployed on pepnationlab.com. You are NOT building the
posting engine — it exists. Your job is: create the OAuth developer apps,
configure credentials, run the connect flow to capture tokens, and VERIFY a real
post lands in each account. Do not claim a platform is "done" until you have seen
a real post appear in that account's feed.

AUTHORITATIVE CONTEXT (read first, in full)
- /CLAUDE.md — platform rules, repo/Supabase/Vercel coordinates, hard rules
  (no emojis, Title Case, ship-at-end, no cross-contamination).
- /SOCIAL-AUTOPOSTER-HANDOFF.md — the autoposter design + Section B per-platform
  developer-portal steps. The "BUILD STATUS" banner at the top confirms the
  engine is implemented.

WHAT ALREADY EXISTS (do not rebuild)
- Supabase (project ydsaqnnuwyvtyxgvrnys), tables:
  * social_posts    — publish queue (drained hourly).
  * social_accounts — one row per provider holding the OAuth tokens + platform
                      ids. RLS: service-role only.
- lib/social/* — compliance gate, token resolver/refresher, per-platform posters
  (X, YouTube, Instagram, Facebook, Pinterest), dispatchPost router.
- app/api/social/oauth/[provider]/start   — begins the connect flow (admin only, PKCE).
- app/api/social/oauth/[provider]/callback — stores tokens into social_accounts.
- app/api/cron/social-autopost — hourly queue drain. Auth: CRON_SECRET Bearer.
  Gated by SOCIAL_AUTOPOST_ENABLED (must be exactly "true" to post anything).
- app/api/admin/social/enqueue — admin endpoint to add a queue row (compliance-checked).

PROVIDER KEYS (used in the connect URLs and env var names)
  x = X/Twitter | google = YouTube | meta = Instagram + Facebook Page | pinterest = Pinterest
  Callback URLs to register in each developer portal:
    X:         https://pepnationlab.com/api/social/oauth/x/callback
    YouTube:   https://pepnationlab.com/api/social/oauth/google/callback
    Meta:      https://pepnationlab.com/api/social/oauth/meta/callback
    Pinterest: https://pepnationlab.com/api/social/oauth/pinterest/callback

ENV VARS TO SET (Vercel → project "pepnationlab" → Settings → Environment Variables,
Production scope). NEVER commit secrets to git.
  Global:
    SOCIAL_AUTOPOST_ENABLED   -> keep "false" until a platform is fully connected AND verified
    CRON_SECRET               -> may already be set (shared with other crons); reuse it
  X:         X_CLIENT_ID, X_CLIENT_SECRET
  YouTube:   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET   (optional: YOUTUBE_CHANNEL_ID)
  Meta:      META_APP_ID, META_APP_SECRET
             (META_PAGE_ID / META_PAGE_TOKEN / IG_BUSINESS_ID are captured
              AUTOMATICALLY by the callback — do not hand-set unless the auto-capture fails)
  Pinterest: PINTEREST_APP_ID, PINTEREST_APP_SECRET, PINTEREST_BOARD_ID
             (PINTEREST_BOARD_ID is REQUIRED before authorizing — the poster needs a target board)

DIVISION OF LABOR (important — some steps are the human owner's, not yours)
  The account OWNER (Dan) must, while logged into the BRAND account:
    - create/approve each developer app and paste in the callback URL + scopes,
    - click "Authorize"/"Allow" on the provider consent screen,
    - submit Meta App Review (takes days) and, for X, confirm the paid API tier.
  YOU (the agent) do everything else:
    - walk Dan through each portal step precisely (exact scopes below),
    - set the env vars in Vercel,
    - trigger/observe the connect flow and confirm tokens landed in social_accounts,
    - set PINTEREST_BOARD_ID / YOUTUBE_CHANNEL_ID,
    - run the end-to-end verification and report per-platform status.

SCOPES (request exactly these)
  X:         tweet.read tweet.write users.read offline.access
  YouTube:   https://www.googleapis.com/auth/youtube.upload
  Meta:      pages_show_list, pages_read_engagement, pages_manage_posts,
             instagram_basic, instagram_content_publish
  Pinterest: boards:read, pins:read, pins:write

RECOMMENDED ORDER (do the no-app-review platforms first)
  1) Pinterest, 2) YouTube  — no app-review wait, fastest to a first real post.
  3) X (confirm paid tier).  4) Meta (start App Review EARLY — it takes days).
  Do NOT automate Reddit or TikTok direct posting here (Reddit = manual only;
  TikTok = defer to a scheduler unless Dan asks).

CONNECT FLOW (per platform, once the dev app + env vars exist)
  a) Dan opens, while signed in as admin on pepnationlab.com:
       https://pepnationlab.com/api/social/oauth/{provider}/start
     (provider = pinterest | google | x | meta)
  b) He approves on the provider screen; the callback stores tokens and redirects
     to /admin?social={provider}_connected.
  c) Confirm the row exists and is populated:
       select provider, display_label, account_ref,
              (access_token is not null) as has_token,
              (refresh_token is not null) as has_refresh, expires_at
       from social_accounts where provider = '{provider}';
     For meta, account_ref must contain page_id + ig_business_id.
     For pinterest, account_ref must contain board_id (set PINTEREST_BOARD_ID first).

END-TO-END VERIFICATION (the part that actually matters — do this per platform)
  1) Put a public test asset URL on hand (an image in the Supabase "social-media"
     public bucket for Pinterest/IG/FB image posts, or a public MP4 for a YouTube Short).
  2) Insert ONE test queue row (service role), e.g.:
       insert into social_posts (platform, media_url, media_type, caption, link, scheduled_for, source)
       values ('pinterest', '<public_image_url>', 'image',
               'Peptide research reference. For in vitro laboratory research use only.',
               'https://pepnationlab.com/research', now(), 'connect-test');
  3) Temporarily set SOCIAL_AUTOPOST_ENABLED=true (Production) and redeploy if needed.
  4) Fire the cron manually:
       curl -H "Authorization: Bearer $CRON_SECRET" https://pepnationlab.com/api/cron/social-autopost
     Expect JSON summary { processed, summary, results } with outcome "posted".
  5) OPEN THE ACTUAL ACCOUNT and confirm the post is visibly live. Capture the
     platform_post_id / platform_url from the social_posts row.
  6) Only after a verified live post: mark that platform done. If a caption trips
     the compliance gate it becomes status "blocked" (expected safety behavior) —
     that is NOT a failure of the connection.

GUARDRAILS (hard rules)
  - Keep SOCIAL_AUTOPOST_ENABLED=false until at least one platform is connected
    AND verified; never leave it "true" with a half-configured platform.
  - NEVER weaken or bypass the compliance gate in lib/social/compliance.ts. It is
    what keeps the accounts from being banned.
  - NEVER commit tokens/secrets to git. They live in Vercel env + the
    social_accounts table only.
  - Do not touch storefront/checkout/auth/research code — the autoposter is
    additive and isolated. If you must edit proxy.ts or vercel.json, keep diffs minimal.
  - Follow CLAUDE.md ship rules: commit + push to main, apply any SQL to
    ydsaqnnuwyvtyxgvrnys, verify on the live production URL (never localhost).

DELIVERABLE
  A per-platform status table: platform | dev app created | env vars set |
  tokens captured | test post id/URL | LIVE-verified (yes/no). Plus any platform
  still blocked on App Review, with what remains.
```

---

**Note for Dan:** the two "human-only" steps in this are logging into each brand account and clicking **Authorize** on the consent screen — Antigravity can prep everything up to that point, but those clicks are yours. Start with Pinterest or YouTube (no app-review wait) to get a first live post fastest.
