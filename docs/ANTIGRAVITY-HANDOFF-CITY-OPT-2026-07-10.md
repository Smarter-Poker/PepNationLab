# Antigravity Handoff — City-Page & Build Optimization (2026-07-10)

**Read `docs/AGENT-PUSH-PUBLISH-GUIDE.md` first.** (The Cowork sandbox shell cannot reach
github.com; pushes/deploys/SQL go through the GitHub / Vercel / Supabase MCP connectors.
This handoff lists the work that needs a *local build*, *network*, or edits to *large /
contended files* the connector can't safely carry.)

## Already shipped this session (do NOT redo)
- **Build fix (the big one):** `STATIC_CITY_LIMIT` 2000 → **24** in
  `app/peptides/[stateSlug]/[citySlug]/page.tsx` (commit `2d08ffb6`). The ~950-city long
  tail now renders via ISR instead of at build time. The build compiles ~24 pages instead
  of ~991 (and generates ~24 OG images + 24 Top-10 DB fetches instead of ~991). This is
  the fix for the exponential Vercel build time.
- `docs/AGENT-PUSH-PUBLISH-GUIDE.md` (commit `c5e77f13`).
- All 15 research-area hubs given Mermaid pathway diagrams (`lib/research-area-content.ts`,
  local commit `ef367d2e` — see task 1).
- Earlier: global JS diet (`experimental.optimizePackageImports` + `DeferredGlobals`),
  storefront code-split, 51 `/research/compare` pages, and NY(77)+NJ(66) city build-outs.

## Tasks that need YOU (local build / network / large or contended files)

### 1. Push the pending research-area commit
`ef367d2e` (Mermaid diagrams in `lib/research-area-content.ts`, ~75 KB) is committed
locally but unpushed — too large to hand-inline via the connector. Run:
`git fetch origin && git rebase origin/main && npx tsc --noEmit && git push origin main`.
Confirm the Vercel deploy is green.

### 2. Convert the city page to a Server Component (big load win)
`app/peptides/[stateSlug]/[citySlug]/CityPage.tsx` is marked `'use client'` on line 1 but
has **zero** client interactivity — verified: no `useState/useEffect/useRef/onClick/
onChange/useRouter`; all hovers are CSS in its `<style>` block, FAQs are native
`<details>`, the footer's `new Date()` is fine in an RSC. **Delete line 1 (`'use client';`).**
That removes the client-JS bundle from every city page (faster hydration, smaller payload,
better mobile TBT). **Run `next build` locally to confirm** (a stray client-only API would
fail the build; none expected). If green, push. This is the single biggest remaining
city-page *load* win.

### 3. Own + finish the state build-out (COORDINATE FIRST)
`lib/cities/cities-data.ts` is being edited by MULTIPLE agents at once (observed live: total
swung 745 → 823 → 991 within minutes; California jumped 31 → 103; Georgia went to 0
mid-write). **Assign this one file to a single agent** or you will keep clobbering work.
Fully-built states so far (county + ZIPs + region + tier + population + a unique local blurb
on every city): **TX 267, FL 132, IL 119, CA 103, NY 77, NJ 66.** Next high-value states:
Georgia, finish Arizona, Colorado, Washington, Massachusetts, Virginia, North Carolina,
Pennsylvania, Ohio, Michigan, Tennessee. Match the exact object shape of existing entries.
After each state, validate: parse the `CITIES` array, assert **0 duplicate `stateSlug/slug`
routes**, every entry has all required fields, every ZIP matches `^\d{5}$`, and
`npx tsc --noEmit` is clean.

### 4. (Recommended refactor) Split cities-data.ts into per-state files
The single ~300 KB `cities-data.ts` is (a) too big to push via the connector and (b) a
constant multi-agent merge collision. Split into `lib/cities/data/<state>.ts` files that a
thin barrel `cities-data.ts` imports and concatenates into `CITIES`. Then each agent owns
one state file — zero collisions, small diffs, connector-pushable. Build-verify that
`CITIES.length`, routes, and the sitemap are unchanged.

### 5. Measure post-deploy
Confirm the Vercel build time dropped sharply after `2d08ffb6`. Run PageSpeed on a city
page (e.g. `/peptides/new-york/manhattan`) and a storefront (`/<agentSlug>`); report LCP /
TBT / CLS so the next optimization pass has real numbers.

## Guardrails (do NOT)
- Do **NOT** raise `STATIC_CITY_LIMIT` to pre-render the whole catalog — that is exactly
  what caused the exponential build times.
- Do **NOT** move the city pages to a subdomain or a separate domain. Their SEO value comes
  from living at `pepnationlab.com/peptides` (a subdirectory consolidates domain authority;
  a subdomain is treated as a separate site and dilutes it). ISR already removes the build
  cost, so there is no reason to split them off the main domain.
