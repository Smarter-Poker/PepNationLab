# PepNationLab SEO Health — 2026-08-08

Weekly automated check (scheduled task: pepnationlab-weekly-seo-healthcheck).
This file is the stored baseline for next week's delta comparison. Do not commit; keep local like the other audit files.

## Results

| # | Check | Status | Note |
|---|---|---|---|
| 1a | /peptides crawlability | PASS | H1 "Research Peptides By City", 2445 cities, all 50 state links, stats, RUO copy render server-side |
| 1b | /peptides/arizona/scottsdale crawlability | PASS | H1, city copy, Top 10 compounds w/ prices, 6-question FAQ, related-city links all render |
| 1c | COA guide article | PASS | Full article body + Key Takeaways + Related Guides render. WARN-note: "Accessing Library / Connecting..." loading text appears in SSR body before article; "Compounds Referenced" section not observed in fetched body |
| 2a | robots.txt | PASS | Allows /, /peptides, /research; names GPTBot, ClaudeBot, PerplexityBot (+ OAI-SearchBot, ChatGPT-User, Claude-Web, anthropic-ai, Google-Extended, Applebot-Extended, CCBot, meta-externalagent); Sitemap: line present |
| 2b | sitemap.xml | WARN | Live fetch returns 200 with Content-Type application/xml, but fetch tool could not render XML body, so URL count unverified. Source (app/sitemap.ts) generates static paths + compounds + guides + 2445 city pages + tier-3 pilot pages (~2,500+ expected URLs) |
| 3 | llms.txt | PASS | Lists Research Guides section (39 guides), 62 compound monographs w/ /api/llm markdown links, city directory, AI compliance note. Cache-bust param blocked by fetch tool; plain URL fetched fresh |
| 4 | Meta/indexability | PASS | All three pages: meta-robots "index, follow", correct self-canonical, unique titles/descriptions |
| 5 | Entity graph | PASS (via source) | JSON-LD stripped by fetch; verified in repo app/layout.tsx: sameAs includes wikidata.org/wiki/Q140460136 + X, YouTube, Instagram, Facebook, Crunchbase, Reddit, Bing, Trustpilot, TikTok, Pinterest |

## Key metrics snapshot
- Cities covered: 2445 (50 states)
- Research guides in llms.txt: 39
- Compound monographs in llms.txt: 62
- Homepage title: "Pep Nation Lab | Premium Research Peptide Distribution"
- Deploy: dpl_APgF2zqvxWQmxeueJjdGmCYvuKzK (city pages) / dpl_8xS4x9NBoxDvXC7QJHgaEmhs7vsu (guide page assets)

## Changes since last week
- First run with stored baseline — no prior weekly report existed (only SEO-AUDIT-2026-07-07 one-off audits). All deltas start next week.

## Recommended actions
- WARN (2b): sitemap.xml content unverifiable via fetch tool (XML body not rendered). No action needed unless GSC shows sitemap errors; optionally verify count manually in a browser.
- WARN-note (1c): SSR body of guide pages includes the "Accessing Library / Connecting to Pep Nation Lab's research database..." loading placeholder before the article. Content is fully crawlable so not a regression, but the placeholder text is indexed with the page. Low priority cleanup.
- Reminder: review Google Search Console Performance + Enhancements and Bing Webmaster manually — out of scope for the automated check.
