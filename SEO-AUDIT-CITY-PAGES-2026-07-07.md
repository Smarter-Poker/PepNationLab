# City Landing Pages — Full SEO + AI-Search Audit
**Date:** 2026-07-07
**Scope:** /peptides, /peptides/[stateSlug], /peptides/[stateSlug]/[citySlug] (299 city pages), sitemap.ts, robots.ts, lib/cities/*

---

## What Exists Today (Verified)

- 299 cities across ~40 states, statically pre-rendered via generateStaticParams.
- Per-city metadata: unique title, description, canonical, keywords meta, robots index/follow.
- JSON-LD per city: BreadcrumbList + FAQPage (5 templated FAQs) + MedicalBusiness.
- State pages: BreadcrumbList + CollectionPage schema, tiered city grid.
- Hub page (/peptides): state grid, stats, CollectionPage schema.
- Dynamic OG image routes (opengraph-image.tsx) at state and city level.
- Sitemap includes hub, states, and cities. Robots.ts allows /peptides/ for all agents.
- Templated content engine: 3 rotating intros, 5 FAQs, shared value props, 10 featured peptide cards, nearby-cities strip, breadcrumbs.

The architecture is fundamentally sound. But one bug currently makes all of it invisible to search engines and AI crawlers.

---

## P0 — CRITICAL: Fix Before Anything Else

### 1. SiteDisclaimerGate Erases The Entire Page For Crawlers
`components/SiteDisclaimerGate.tsx` wraps every route in layout.tsx. On the server (and on first client render) `ready === false`, so it **returns null for every path except "/"**. Result:

- The server-rendered HTML of every /peptides page contains **zero body content** — no H1, no copy, no FAQs, no internal links, and no page-level JSON-LD (the Breadcrumb/FAQ/MedicalBusiness scripts are inside the gated tree and never render).
- **Verified live:** fetching https://pepnationlab.com/peptides returns meta tags only, empty body.
- AI crawlers (GPTBot, ClaudeBot, PerplexityBot, CCBot) do NOT execute JavaScript — they see a blank page. ChatGPT, Claude, Grok, and Perplexity literally cannot read these pages today.
- Googlebot renders JS, but localStorage is never "accepted," so it sees the DisclaimerGate modal instead of the city content.

**Fix:** exempt public marketing routes from the gate (e.g., pathname starts with /peptides, /research, /about, /peptide-101, /compliance, /disclaimer, /terms, /privacy, /become-agent, /contact) OR render children in the DOM with the gate as an overlay on top (never return null / never replace children). Legal layer 1 still fires for real users; crawlers get content. This one change is worth more than every other item combined. Note it also fixes the entire /research library, which has the same problem.

### 2. Page JSON-LD Must Survive SSR
After fixing item 1, confirm BreadcrumbList/FAQPage schema appears in view-source HTML. If any route remains gated, move the JSON-LD `<script>` out of the gated tree (it can be emitted from the server page regardless of the gate).

### 3. Sitemap Emits Every City Twice
`app/sitemap.ts` maps CITIES in staticPaths (priority 0.6) AND again in cityPages (tier-scored priority). 299 duplicate URLs with conflicting priority/changefreq. Remove the staticPaths block; keep the tier-scored one.

### 4. Dynamic Per-City OG Images Are Dead Code
generateMetadata sets `openGraph.images: ['/og-card.png']`, which **overrides** the file-based opengraph-image.tsx. Every city shares one generic card. Remove the explicit images entry (Next auto-wires the dynamic image) on city AND state pages.

### 5. Bug In opengraph-image.tsx
`CITIES.find((c) => c.citySlug === citySlug)` — the field is `slug`, not `citySlug`, so the lookup always fails and compound count falls back to 8. Also fetches the Inter font from fonts.gstatic.com per render; bundle the font file locally to avoid latency/failure.

---

## P1 — High Impact: Content Quality And Doorway-Page Risk

### 6. 299 Near-Identical Pages = Google Doorway-Page Exposure
Three rotating intros and the same 5 FAQs with the city name swapped is exactly the pattern Google's spam policies name ("doorway pages"). Mitigations, roughly in order of value:
- Use the data already in cities-data.ts (population, medianIncome, region, tier) to generate materially different copy per city, not just name substitution.
- Give Tier 1 cities genuinely bespoke sections (real shipping transit time from the actual warehouse origin, region-specific research demand notes, distinct featured-compound ordering).
- Expand the FAQ pool to 15–20 questions and select 5–6 per city deterministically, with answers that vary in structure, not just tokens.
- Vary the featured-peptides set per city (rotate 10 of 20 by slug hash) so pages differ in entities.
- Consider launching Tier 1 + Tier 2 indexed and holding Tier 3 as noindex until unique content exists — thin pages drag sitewide quality scores.

### 7. MedicalBusiness Schema Is Wrong And Risky
Pep Nation Lab is not a medical business and has no physical location in these cities; claiming a MedicalBusiness with a PostalAddress in each city is misleading structured data (manual-action risk, and AI assistants cross-check it). Replace with either:
- `Organization` (reference the sitewide #organization) plus `areaServed: { '@type': 'City' }`, or
- a `Service` node ("Research Peptide Supply") with `provider` → Organization and `areaServed` → City.
Drop `priceRange`. Keep FAQPage and BreadcrumbList.

### 8. Inconsistent Facts Across Surfaces
Meta description says "300+ more"; the city hero says "100+ Research Compounds"; value props say "100+"; the hub and OG image say "300+"; CITIES has 299 entries but the hub claims "300+ US cities." AI models penalize/skip sources with internally contradictory numbers. Pick canonical figures (ideally pulled from the compounds table at build time) and use them everywhere.

### 9. Image-Of-Text CTA Buttons
btn-access.png, btn-browse.png, etc. are screenshots of text. Replace with real `<a>` text buttons: crawlable anchor text, accessibility, faster paint, and AI extractors can read the CTAs. Keep the visual style in CSS.

### 10. Primary CTA Points To A Robots-Disallowed URL
Hero and final CTAs link to /login (disallowed in robots.ts) and /research. Point the primary conversion CTA at an indexable signup/storefront path or /research; keep /login as the secondary text link only.

### 11. Add Twitter Card + og:locale Per City
City/state pages define openGraph but no twitter metadata, so shares fall back to the root layout's generic title/image. Add per-page `twitter: { card: 'summary_large_image', title, description }` and `openGraph.locale: 'en_US'`.

### 12. Enrich Robots Meta
Add `googleBot: { 'max-snippet': -1, 'max-image-preview': 'large', 'max-video-preview': -1 }` to the metadata robots block so Google and AI overviews can use full snippets.

---

## P2 — Discoverability And Indexation Plumbing

### 13. Search Engine Submission + IndexNow
- Verify the domain in Google Search Console and Bing Webmaster Tools; submit sitemap.xml to both.
- Bing powers ChatGPT search and much of the AI-search ecosystem — Bing indexation is disproportionately important for "recommended by AI" visibility.
- Implement IndexNow (single key file + ping on deploy) to push all 299 URLs to Bing/Yandex instantly instead of waiting weeks for crawl.

### 14. Add llms.txt (And llms-full.txt)
Serve /llms.txt describing: what Pep Nation Lab is, RUO compliance posture, catalog scope, the /peptides city directory, /research library, and canonical fact snippets (states served, verification requirement). Emerging standard read by AI crawlers; currently 404.

### 15. Explicit AI-Crawler Rules In robots.ts
The wildcard rule already permits them, but add explicit `userAgent` entries for GPTBot, ClaudeBot, Claude-Web, PerplexityBot, Google-Extended, Applebot-Extended, CCBot, Bytespider with the same allow list. This is both a signal and insurance against future wildcard tightening.

### 16. Real lastModified Values
sitemap.ts stamps every URL with `new Date()` on each build, which teaches crawlers to ignore your lastmod. Store a content-version date per city (or derive from git) and only bump when content actually changes.

### 17. Sitewide Internal Links To The City Hub
Discovery currently depends on the sitemap plus the city pages' own footers. Add "Peptides By City" to the global site footer and the homepage (HomeClient) nav so link equity flows from the domain root. Add contextual links from /research compound pages ("Available to researchers in Scottsdale, Phoenix, …" rotating by relevance) to deep-link city pages.

### 18. ItemList Schema On Hub And State Pages
Add an `ItemList` of city links (name + URL) to /peptides and each state page. Helps both Google sitelinks and AI models enumerate coverage ("what cities does Pep Nation Lab serve?").

### 19. State Pages Need Their Own Content
State pages are pure link grids. Add 2–3 unique sentences per state (coverage summary, tier-1 markets, shipping note) and a small state-level FAQ so they earn their own rankings for "research peptides {state}".

### 20. Cross-State Nearby Links
NearbyStrip only links same-state cities. For metro areas that cross state lines (NYC/NJ/CT, Kansas City, DC/MD/VA), link across states by region label to strengthen the mesh.

---

## P3 — Performance, Accessibility, Trust (Indirect Ranking Inputs)

### 21. Core Web Vitals On City Pages
- Every image uses `unoptimized` — Next image optimization is bypassed sitewide on these pages. Remove `unoptimized`, serve AVIF/WebP, add `sizes`.
- Full-bleed hero JPG (city-hero-peptide.jpg) at 75 percent opacity plus three more full-bleed section backgrounds is heavy; compress aggressively or use CSS gradients for the low-opacity ones (at 0.06–0.18 opacity a gradient is visually identical and free).
- `priority` on the hero image is correct; verify LCP is the H1 or hero, not a button PNG.

### 22. Viewport Blocks Zoom
`maximumScale: 1, userScalable: false` in layout.tsx fails accessibility audits (Lighthouse penalty). Remove both; it applies sitewide.

### 23. Keywords Meta Tag
Google ignores it; keyword-stuffed values ("peptide clinic {city}", "anti-aging peptides") read as spam signals to reviewers and AI trust filters, and "peptide therapy/clinic" phrasing conflicts with the RUO positioning. Remove or trim to 3–4 neutral terms.

### 24. Title/Claim Compliance Consistency
Copy mixes "pharmaceutical-grade" with "not FDA approved" and RUO disclaimers. AI assistants evaluating whether to recommend a vendor cross-check claims; standardize on "research-grade" everywhere on these pages. (Also matches the platform's own compliance posture.)

### 25. E-E-A-T / Entity Grounding
- Organization schema `sameAs` is empty. Add real profiles (X/Twitter @pepnationlab if actually owned, LinkedIn, etc.) — this is a primary input AI models use to ground the brand entity.
- Add `contactPoint` (email) and, if available, a business address to the sitewide Organization node.
- Realistic expectation: without physical locations or Google Business Profiles, these pages can rank in organic web results but never in the local map pack. Do not add fake NAP data to chase it.

### 26. FAQPage Rich-Result Expectations
Google now shows FAQ rich results almost exclusively for government/health authority sites. Keep the markup (AI models still consume it heavily), but do not expect SERP FAQ snippets.

### 27. Breadcrumb Home Link
Breadcrumbs point to "/", a gated landing page. Fine after item 1 is fixed; verify "/" itself serves indexable content since it is the BreadcrumbList root.

### 28. Add An "At A Glance" Fact Box Per City
A short server-rendered summary block (city, state, ships-to status, processing time, verification requirement, catalog size) in plain HTML near the top. AI answer engines quote exactly this kind of dense, factual, self-contained block. This is the single best AEO content addition.

### 29. dateModified In Schema
Add `datePublished`/`dateModified` to the CollectionPage/Service nodes and keep them honest — freshness is a retrieval signal for both Google and AI search.

### 30. Monitor Indexation
After the P0 fixes ship: request indexing for the hub + 10 Tier 1 cities in GSC, then watch Coverage weekly. With 299 templated pages, expect Google to sample-index first; the content-uniqueness work in item 6 determines how many stick.

---

## Suggested Execution Order

1. Item 1 (disclaimer gate SSR fix) — everything else is moot until crawlers can see the pages.
2. Items 3, 4, 5, 11, 12 — quick mechanical fixes, one PR.
3. Items 13, 14, 15 (GSC/Bing/IndexNow/llms.txt) — same day.
4. Items 7, 8, 23, 24 (schema correction + claim consistency).
5. Item 6 (content uniqueness program) + 28 (fact boxes) — the ongoing work that determines rankings.
6. Items 17, 18, 19, 20 (internal link mesh), then P3 performance passes.
