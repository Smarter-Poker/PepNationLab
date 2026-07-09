# Antigravity Handoff — 2026-07-09 (Cowork session)

Read `CLAUDE.md` in full first. Its hard rules (no emojis, Title Case, Omega Protocol,
4-layer disclaimer gate, ship-at-end-of-build, zero cross-contamination) are non-negotiable.

> Note: `ANTIGRAVITY-HANDOFF.md` is an older (2026-06-14) security-pass handoff. This file
> supersedes it for the current state of the tree.

---

## 1. THE URGENT TASK: push 17 commits that are stuck locally

The Cowork agent worked in a **network-isolated sandbox** — `git` there cannot resolve
`github.com` (verified), so it could commit but never push. There are **17 commits on local
`main` that have never reached the remote.**

```
Local HEAD:  532c59c1
Status:      17 ahead / 0 behind the locally-tracked origin/main (1431d509)
tsc:         exit 0, zero errors
```

**The locally-tracked `origin/main` ref is STALE.** The real remote has moved on (other agents
and bots kept pushing). So:

```bash
git fetch origin
git rebase origin/main        # should apply cleanly - see conflict surface below
npx tsc --noEmit              # MUST be exit 0 before you push
git push origin main
```

Then confirm Vercel builds, and verify on `https://pepnationlab.com` (never localhost).

**Conflict surface:** these commits touch find-a-peptide, observability, admin, lab-journal, and
chart lazy-loading. They do **not** overlap the checkout / login / city / SEO work the remote
landed separately, so the rebase should be clean. One of the 17 (`830e5907`, social autoposter)
is *another agent's* work the sync committed locally — push it too.

---

## 2. READ BEFORE ANY `git add -A` — a hazard that already destroyed HEAD once

Commit `830e5907` **silently deleted 9 files and reverted others**, leaving HEAD unbuildable:
`app/admin/page.tsx` imported `LazyAdminAnalytics` which no longer existed, `app/layout.tsx` lost
`GlobalErrorReporter`, and `lib/email.ts` lost 80 lines of *another agent's* work.

**Root cause:** commits were made with an alternate index (`GIT_INDEX_FILE=...`). That produces
correct commits but leaves the **real `.git/index` stale** — newly-created files stay untracked in
it, so the real index reports them as staged **deletions (`D`)**. The next plain `git commit`
against the real index then commits those deletions.

Repaired in `28e1d61c` + `532c59c1`, and the real index has been reconciled
(`git reset --mixed HEAD`). **It is currently clean.** Keep it that way:

- After any commit: `git status --short` must show **no `D ` entry** for a file that exists on disk.
- If you see `D <file>` **and** `?? <file>` for the same path, the index is lying.
  Run `git reset --mixed HEAD` before committing anything else.

`.github/workflows/apply-comparetool-toast.yml` and `_to_delete/` are on disk but **intentionally
untracked** — that workflow is a self-deleting one-shot and committing it could re-trigger it.

---

## 3. Database — ALREADY APPLIED to prod. Do not re-run blindly.

Applied directly to Supabase `ydsaqnnuwyvtyxgvrnys` (live now, independent of git):

| Migration | What it did |
|---|---|
| `20260708193000_client_error_events.sql` | `client_error_events` table + RLS (admin-read only, service-role writes) + indexes |
| `20260708200000_db_hygiene_dup_indexes_fk_index_search_path.sql` | Indexed the `client_error_events` FK; dropped 12 duplicate indexes; pinned `search_path` on 3 functions |

Both are idempotent (`IF NOT EXISTS` / `IF EXISTS` / `ALTER`), so a rebuild is safe. Supabase
assigned its own ledger timestamps, which differ from the filenames — expected.

**Never** run PepNationLab migrations against `cupnhfdwveouenutnveg` (PepNationRX) or
`kuklfnapbkmacvwxktbh` (Smarter.Poker).

---

## 4. What the 17 commits contain

**find-a-peptide (Match Me / Let Us Guide You)**
- Both buttons were dead — they just pushed to `/store`. Fixed, and **verified live in-browser**.
- The 7 quick-select goal tiles now jump straight to their research area instead of reopening the
  generic "Browse By Research Area" popup.
- Match failures now render a "Something Went Wrong / Try Again" panel instead of silently closing
  the drawer or showing a misleading "0 Matches Found".
- **Keyword false positives:** short tokens (`gh`, `gi`, `fat`, `age`) matched as substrings, so
  "weight loss" false-triggered the GH/muscle goal (`gh` inside "wei**gh**t"). Now word-boundary
  matched in both `ai-match` and `match-engine`. 16/16 logic tests pass.
- Oversell guard (`inventory_count ?? 999`), real `in_stock` derivation, half-life parser
  (`"1.5 hours"` / `"8-hour"` leaked past the long-half-life filter), case-insensitive
  stack-partner detection, `server-only` guard on `compounds-server`, glossary word-boundary fix.
- **Single-call match:** goal parsing extracted to `lib/goal-nlp.ts`; `/api/research/match` now
  additively accepts a raw `{prompt}`. A typed search is one round trip instead of two. The
  structured `{input}` path and `/ai-match` are unchanged.
- `MatchResultsDrawer` + `GuidedDiscoveryWizard` extracted into their own lazy chunks
  (`StorefrontDiscovery.tsx`: 1,720 → 612 lines), latch-mounted on first open.

**Observability (new, global)**
- `client_error_events` table + hardened `/api/observability/client-error` (same-origin,
  rate-limited, all fields clamped, always returns 204).
- `GlobalErrorReporter` in the root layout → uncaught errors + unhandled promise rejections
  captured across **all 147 routes**.
- Admin viewer at **`/admin/errors`** (no nav link yet — reachable by URL).
- **Most important:** `/api/disclaimer-log` for the mandatory layer-3 `add_to_cart` gate was
  `.catch(() => {})`. A failed compliance-audit write was completely invisible. Still
  non-blocking, now reported. Also wired: live shipping-rate fallback (was silently charging an
  *estimated* rate), saved-address load, cart add failures, mermaid render, QR generation.
  `AbortError` is filtered so effect cleanups don't flood the sink.

**Performance / bundle**
- `recharts` (~400 KB) removed from every route's initial bundle: admin overview + analytics,
  agent dashboard, admin sales, sales page, Lab Journal, research by-target. Note the Lab
  Journal's default tab (`bundles`) renders **no charts**, yet shipped recharts on every visit.
  `AreaProductGrid` had a completely dead recharts import.
- `mermaid` (~1 MB, the heaviest dep) was statically bundled into every `/research/area/*` page —
  now dynamically imported when a diagram renders. `qrcode` made dynamic in two client files.
- Verified: **0 of 147 routes** eagerly load `recharts`, `mermaid`, or `qrcode`.

---

## 5. Deliberate decisions — do NOT "fix" these

- **`framer-motion` stays on the global path.** It is imported by `CartContext`, whose
  `AddToCartAcknowledgment` **is the layer-3 RUO disclaimer gate** (its `onAccept` fires
  `/api/disclaimer-log` and only then commits the addition). Lazy-loading it would add a
  chunk-fetch failure mode to a compliance gate. Not worth ~80 KB.
- **`shared_research_protocols` (plus `social_*`, `messenger_link_previews`,
  `email_verification_codes`) have RLS enabled with no policy — this is CORRECT.** They are read
  only via the service role (see `app/(storefront)/[agentSlug]/shared/[protocolId]/page.tsx`).
  Adding a public `SELECT` policy would let anyone enumerate every shared research protocol.
- **Do not drop indexes from the 147 `unused_index` advisories.** Young, low-traffic tables;
  Postgres simply has not recorded scans yet.
- **Do not consolidate the 461 `multiple_permissive_policies`.** Misleading
  (table x role x action) cross-product, individually low-impact, and there is no representative
  test environment.
- The 96 `SECURITY DEFINER executable` warnings are the `is_admin()` / `get_user_role()` RLS
  helpers. They are *designed* to be callable by anon/authenticated.
- ~347 bare `catch {}` blocks were **intentionally not** instrumented — they guard
  `localStorage` / clipboard / toast where failure is fine. Wiring them would drown the signal.

---

## 6. Open items

### Must do after deploy — live verification
The drawer/wizard extraction is tsc-clean and the code was moved verbatim, but it has **not been
runtime-verified live**. If anything is off, `git revert e4cea8fd` is the isolated fix.

1. `/find-a-peptide` → **Match Me** opens the results drawer; **Let Us Guide You** opens the wizard.
2. A typed search returns correct matches in **one** request, and "weight loss" no longer returns
   GH/muscle compounds.
3. Lab Journal charts (Doses + Biometrics tabs) render after their lazy chunk loads.
4. Admin overview / admin sales / agent dashboard charts render.
5. `/research/area/<area>` mermaid diagram renders.
6. Force a client error; confirm a row lands in `/admin/errors`.

### Nice to have
- `public/images/research/store-hero.png` is a **525 KB PNG** used as a CSS `background-image` on
  the highest-traffic page. Convert to WebP/AVIF + `image-set()`. (Sandbox had no `cwebp`/`sharp`
  and no network to install them.)
- Add a nav link to `/admin/errors` in the admin sidebar.
- Dead follow-up flow in `MatchResultsDrawer`: `followUp` is never set to non-null,
  `submitFollowUp` never fires, one render branch is unreachable. Delete ~40 lines or wire it.
- Match score breakdown sums to 110 but clamps to 100.
- Drawer result image/name are not keyboard-focusable (the "View Details" button is, so it is a
  degradation, not a blocker).

### Decision needed (not a code change)
Storage buckets `product-coas`, `product-images`, and `avatars` allow **anonymous
listing/enumeration**. On a research-use-only platform where COAs are the compliance artifact,
confirm this is intentional before changing it — flipping bucket settings can break public image
loading.

---

## 7. Sanity commands

```bash
npx tsc --noEmit                                        # must be exit 0
git status --short | grep '^D '                         # must be empty (phantom-deletion check)
grep -rl "from 'recharts'" app | grep -v node_modules   # must be empty (no route bundles recharts)
```
