# PepNationLab SEO Health — 2026-08-19

Weekly automated check (scheduled task: pepnationlab-weekly-seo-healthcheck).
This file is the stored baseline for next week's delta comparison. Keep local like the other audit files.

## Results

| # | Check | Status | Note |
|---|---|---|---|
| 1a | /peptides crawlability | PASS | H1 "Research Peptides By City", 2445-city claim, all 50 state links, stat blocks and RUO copy render server-side. No disclaimer gate in SSR body |
| 1b | /peptides/arizona/scottsdale crawlability | PASS | H1, at-a-glance table, Top 10 compounds w/ prices, 6-question FAQ, nearby-city links all render. meta-robots index, follow |
| 1c | COA guide article | WARN | Article body + Key Takeaways + all 4 sections + RUO block + Related Guides render. "Frequently Asked Questions" and "Compounds Referenced" do NOT render — confirmed in source: lib/research/guides.ts entry for this slug has no `faqs` and no `compounds` array. Content gap, not a rendering regression. "Accessing Library / Connecting to Pep Nation Lab's research database..." placeholder still appears in the SSR body above the article |
| 2a | robots.txt | PASS | Allows /, /peptides, /research; per-agent blocks for GPTBot, ClaudeBot, PerplexityBot (+ OAI-SearchBot, ChatGPT-User, Claude-Web, anthropic-ai, Google-Extended, Applebot-Extended, CCBot, meta-externalagent). `Sitemap: https://pepnationlab.com/sitemap.xml` present |
| 2b | sitemap.xml | PASS (partial verify) | HTTP 200, Content-Type application/xml, well-formed. Fetch tool truncated the body at ~68 KB / 2,300 lines; 383 `<loc>` entries observed in that window, including /peptides, all 50 state hubs, 39 /research/guides/ URLs, and compound + subpage URLs. City URLs are appended last in app/sitemap.ts and fell outside the truncated window — count verified from source instead: 190 indexable cities |
| 3 | llms.txt | PASS | Research Guides section present (39 guides). 61 compound monographs each with /api/llm/compound/{slug} markdown link. Local coverage directory (50 state entries) + AI compliance note present. Cache-bust `?v=` param blocked by the fetch tool's provenance rule; plain URL fetched fresh |
| 4 | Meta / indexability | PASS | /peptides, /peptides/arizona/scottsdale, COA guide: all meta-robots "index, follow", correct self-canonical, unique titles/descriptions. Long-tail city pages are now deliberately "noindex, follow" (see deltas) |
| 5 | Entity graph | PASS (via source) | JSON-LD stripped by fetch tool. Verified in app/layout.tsx: Organization sameAs includes wikidata.org/wiki/Q140460136 plus X, YouTube, Instagram, Facebook, Crunchbase, Reddit, Bing Places, Trustpilot, TikTok, Pinterest. A distinct editorial-team author/reviewer entity is also declared for YMYL E-E-A-T |

## Key metrics snapshot
- Cities live: 2445 (50 states) — unchanged
- Cities SEO-indexable / sitemapped: **190** (population >= 150,000, plus florida/delray-beach)
- Research guides in llms.txt: 39
- Compound monographs in llms.txt: 61
- Sitemap `<loc>` entries observed before truncation: 383 (total higher; city block not reached)
- Deploy IDs seen: dpl_D5SieWutyKgqUfAFLZa5Mk1MgAMi (Fountain Hills), dpl_APgF2zqvxWQmxeueJjdGmCYvuKzK (Scottsdale), dpl_8xS4x9NBoxDvXC7QJHgaEmhs7vsu (guide assets)

## Changes since last week (baseline 2026-08-08)

1. **Major, intentional: city indexing footprint cut from 2,445 to 190.** A 2026-08-14 SEO audit introduced `lib/cities/seo-tier.ts`. Only cities with population >= 150,000 (plus florida/delray-beach, the one page Google had actually indexed) are indexable and sitemapped. The other ~2,255 city pages stay live and keep their internal-link mesh but are now `noindex, follow`. Verified live: /peptides/arizona/scottsdale is `index, follow`; /peptides/arizona/fountain-hills is `noindex, follow`. Rationale recorded in source: the long tail was a scaled-content quality liability that never earned clicks.
2. **Compound-city layer (/peptides/{state}/{city}/{compound}) is now noindex across the board** and excluded from the sitemap. The tier-3 pilot URLs were removed from the sitemap on 2026-08-14.
3. **Sitemap check upgraded WARN -> PASS.** Last week the XML body could not be rendered at all; this week it returned readable, well-formed XML (still truncated by the fetch tool's size cap, so the count is partial).
4. **COA guide check downgraded PASS -> WARN.** Same page content as last week, but this run explicitly checked for the FAQ block as well as "Compounds Referenced" and confirmed both are absent, with the cause traced to missing `faqs`/`compounds` data on that guide entry.
5. **llms.txt monograph count: 61 this week vs 62 recorded last week.** One fewer entry. Guide count unchanged at 39. Low confidence on whether this is a real removal or a prior-week counting error — worth a glance next run.
6. No new FAIL. No page lost `index, follow` unintentionally. No robots.txt or entity-graph regressions.

## Recommended actions

- **WARN (1c) — COA guide missing FAQ + Compounds Referenced.** The page template renders both sections conditionally; this guide's data entry in `lib/research/guides.ts` simply has neither. Adding an `faqs` array would make the guide eligible for FAQ rich results, and a `compounds` array would strengthen internal linking into the monographs. Content addition, not a bug. Not actioned — flagging for approval.
- **Low priority — "Accessing Library / Connecting to Pep Nation Lab's research database..." placeholder is in the SSR body of guide pages**, above the article, so it is indexed with the page. Carried over from last week. Cosmetic, but it is the first text a crawler sees on a guide URL.
- **Low priority — Scottsdale is still served from deploy `dpl_APgF2zqvxWQmxeueJjdGmCYvuKzK`** while Fountain Hills serves `dpl_D5SieWutyKgqUfAFLZa5Mk1MgAMi`. Suggests a stale ISR cache on the older city-page route. Harmless for SEO today; worth confirming a revalidation fires if city-page copy changes.
- **Verify next week:** llms.txt monograph count (61 vs 62).
- **Manual, out of scope for this check:** review Google Search Console Performance + Enhancements and Bing Webmaster Tools. Especially relevant this month — the 2026-08-14 noindex cut should show a large drop in indexed URLs in GSC's Page Indexing report. That drop is expected and is not a regression; what matters is whether impressions and clicks on the retained 190 city pages hold or improve.

## No code changes made
This run was monitoring only. Nothing was committed, pushed, or deployed.
