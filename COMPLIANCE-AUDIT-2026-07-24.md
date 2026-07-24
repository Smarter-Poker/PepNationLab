# PepNationLab — Compliance & Legal Content Audit

**Prepared:** July 24, 2026
**Scope:** Full site (177 page routes), storefront, tools, research library, marketing/email, legal pages, physical labels, and all images.
**Method:** Page-by-page and line-by-line review of the source at `Documents/pepnationlab`, plus the live Supabase content the pages render.

> **Not legal advice.** I'm not a lawyer and this isn't legal advice. This is a practical, prioritized list of the language, features, and images that most commonly trigger FDA (unapproved-new-drug / misbranding under the FDCA), FTC (deceptive-marketing / "intended use"), and consumer-protection problems for a research-peptide business — organized so you and an actual attorney can act on it efficiently.

---

## The one thing to understand first

Your **disclaimers are strong and well-drafted** — the four-layer acceptance gate, the 21+ attestation, the checkout attestation log, the RUO banners. That is not the problem.

The problem is that the site **ships features and copy that only make sense if a human is dosing, injecting, and tracking results in their own body.** A "Research Use Only" label sitting directly next to an injection-site body map, a 12-week dosing-protocol generator, a syringe-draw calculator, "Ozempic" as a product nickname, and "Buy semaglutide in Dallas" pages is exactly the contradiction that FDA and FTC treat as proof of intended use. **Disclaimers do not cure intended-use content — the content itself has to be removed or de-humanized.**

Because of that, this report leads with **whole features/pages to delete** (Part A), then the **page-by-page edits** (Part B), then the **global image & label list** (Part C), then **legal-page gaps** (Part D), and finally **what's already done right and must be kept** (Part E).

---

# PART A — Whole Features & Sections To Remove (Highest Exposure)

These are not "edit a line" items. Each one is, in substance, a human-use tool or a consumer drug-sales funnel. Ranked by exposure.

### A1. `/lab-journal` — the entire personal injection/dose/results tracker  **[CRITICAL — remove end to end]**
`app/lab-journal/LabJournalClient.tsx` (3,788 lines). This is a personal drug-cycle diary for RUO chemicals. It contains, all of which directly contradict "not for human use":
- **Injection-site body map** on a human body image (`/images/injection-site-body.jpg`) with L/R shoulder, tricep, abdomen targets, a site-rotation "rest the tissue" tracker, and a `Log Dose To {site}` button that *blocks logging until you pick an injection site* (lines 2663, 2738–2816).
- **Syringe-pull calculator** — "Pull Syringe To {N} Units (IU)… assuming standard U-100 syringe" (2340–2392).
- **Cycle on/off scheduler** — "On-cycle (wks) / Off-cycle (wks)", 8-week lifecycle timeline, daily dose reminders/push notifications ("Dose Due: … Log your dose") (122–142, 312–347, 1819).
- **AI 12-week protocol generator** keyed to body metrics — "Subject Metrics… e.g. 180lbs, 15% body fat, age 35 male", experience level "First Time Researcher / 1–3 Years / 3+ Years" (2462–2513).
- **Biometric + symptom + progress-photo tracking** — Weight, Body Fat %, Waist, BP, glucose; side-effect severity log (Headache, Nausea, Water Retention, Mood Shift…); before/after photo comparison slider tied to the cycle (96–108, 3299–3360).
- **Built-in human dosing templates** — "GLP-1 Starter (Tirzepatide) … 2.5 mg Once Weekly", "Ipamorelin/CJC-1295 Anti-Aging … 5 Days On, 2 Off" (60–68).

**Fix:** Delete the page, its client, the backing API routes (`app/api/researcher/{doses,biometrics,protocols,progress-photos,symptoms,ai-protocol,ai-stack-analysis}`), and the DB tables/columns (`researcher_doses` incl. `injection_site`, `researcher_scheduled_protocols`, `researcher_biometrics`, `researcher_symptoms`, `researcher_progress_photos`). This feature flatly contradicts your own DisclaimerGate promise that the platform "never sells needles/syringes" and forbids human use — the two cannot coexist.

### A2. Product "popular name" nickname map — drug & disease equivalence on public cards  **[CRITICAL — delete file]**
`lib/peptide-popular-names.ts`, rendered on public storefront cards (`AgentStorefrontGrid.tsx:2489,3946`), order pages, and the store editor. These are treatment/brand-equivalence claims sitting right next to Add-to-Cart:
- Approved-drug equivalence: `semaglutide → 'Ozempic'`, `tirzepatide → 'Mounjaro'`.
- Controlled-substance comparisons: `semax → 'Adderall In A Bottle'`, `selank → 'The Russian Xanax'`.
- Disease/cure nicknames: `tesamorelin → 'The Belly Fat Killer'`, `aod9604 → 'The Anti-Obesity Fragment'`, `5-amino-1mq → 'The Fat Cell Killer'`, `tb500 → 'The Injury Eraser'`, `ara290 → 'The Nerve Healer'`, `vip → 'The Mold Illness Peptide'`, `kpv → 'The Gut Soother'`.
- Cosmetic/lifestyle: `ghk-cu → "Nature's Botox"`, `snap-8 → 'The Botox Alternative'`, `pt-141 → 'The Libido Peptide'`, `epithalon → 'The Immortality Peptide'`, `bpc-157 → "God's Peptide"`.

**Fix:** Delete the map and all four render sites, or replace values with neutral chemical-class descriptors only (e.g. "GLP-1 receptor agonist").

### A3. Local-SEO drug "doorway" pages — `/peptides/{state}/{city}/{compound}`  **[CRITICAL — remove the compound-city layer]**
`app/peptides/[stateSlug]/[citySlug]/[compoundSlug]/page.tsx` + `lib/cities/*`. These are consumer "buy the drug near me" landing pages built around FDA-regulated weight-loss drugs:
- Titles/meta lead with **"Buy research-grade {compound} ({Ozempic / Wegovy}) … in {city}"** (page.tsx:97–98).
- Live commercial **`Product`/`Offer` JSON-LD** with price, `availability: InStock`, `priceValidUntil`, `seller` for named unapproved drugs (184–209).
- FAQ schema answers **"How should peptides be stored after delivery"** and reconstitution with **"bacteriostatic water or sterile saline"** (city-content.ts:174–195) — human injection-prep guidance.
- "Discreet, lab-appropriate packaging" + same-day local fulfillment framing (page.tsx:55–77).
- **Indexing is deliberately turned ON** for the tier-1/2 drug-city pages (`indexable = city.tier <= 2`), and `robots.ts` explicitly invites GPTBot/ClaudeBot/PerplexityBot — i.e. the "locked, noindex" storefront is fronted by a large public, AI-discoverable, drug-purchase-intent surface.

**Fix:** Remove the entire `[compoundSlug]` compound-city route and drop Semaglutide/Tirzepatide/Retatrutide/GLP-1 from `CITY_COMPOUNDS`; noindex the compound-city layer; delete Product/Offer schema and the reconstitution/storage FAQs. This is the single largest combined FDA + FTC exposure on the site and it contradicts your own Compliance Policy (see D3).

### A4. Public dosing chart on every compound page — `DoseFrequencyPanel` + `dose-profiles.ts`  **[CRITICAL — remove]**
`lib/research/dose-profiles.ts` + `components/research/DoseFrequencyPanel.tsx`, rendered at `app/research/[slug]/page.tsx:345`. A full human posology database for ~60 compounds: Typical Dose, Frequency, Cycle On/Off, Route (SC/IM), and titration text — e.g. BPC-157 "250–500 mcg, once or twice daily, split into AM/PM injections near the site of injury"; semaglutide "0.25 mg/week × 4 weeks → 0.5 mg/week…"; PT-141 "1–2 hours before desired effect… spontaneous erection and flushing." The "Research Reference Only" banner does not cure "split the daily dose into AM/PM injections." **Fix:** Delete the file, the panel, and the button asset; do not serve dose/frequency/cycle/route data publicly.

### A5. Stack/protocol builders — auto-generated "12-Week Dosing Protocols"  **[CRITICAL — remove the generators]**
- `/research/stacks` markets **"Auto-Generate 12-Week Dosing Protocols"** (page.tsx:79); `StackBuilder.tsx` builds a 12-week × 7-day editable dose grid (defaults BPC 250 mcg, TB 2 mg), Mon/Wed/Fri schedule, "monitor test subjects daily," **iCal/calendar export**, and an AI "protocol refinement" call to `/api/researcher/ai-protocol` (203–291).
- `components/research/ProtocolScheduler.tsx` — "Suggested Administration Schedule… a theoretical research schedule to maintain stable blood serum levels" (30–53), also surfaced on the public shared-protocol page `/(storefront)/[agentSlug]/shared/[protocolId]`.
- `SmartStackBuilder.tsx` — AI "Synergy Score" + combined-use "safety warnings" + "Add Stack to Cart."

**Fix:** Remove the protocol-grid generator, dose editing, iCal export, ProtocolScheduler, and the `ai-protocol` / `ai-stack-analysis` endpoints. A non-dosing "which compounds are studied together" info view can remain — but no doses, no schedule, no calendar, no synergy/safety verdicts.

### A6. Efficacy-score charts on monographs — `EfficacyScoreChart` + `efficacy_scores`  **[CRITICAL — remove]**
`MonographTabs.tsx:520–533` renders 0–100 per-benefit efficacy bar charts. DB values are human-outcome ratings — retatrutide `weight_loss:99, appetite_suppression:97`; follistatin `muscle_hypertrophy:92`; cerebrolysin `dementia:78, alzheimers:80`; glutathione `skin_brightening:85`. These are quantified efficacy claims for diseases/benefits. **Fix:** Remove the Efficacy tab/chart and stop serving the `efficacy_scores` column (`lib/compounds-server.ts:51`).

### A7. Human-benefit product categorization & goal quizzes  **[HIGH — recategorize / remove goal framing]**
The catalog is organized by human health outcome, which is intended-use evidence:
- Storefront category cards: "Weight Loss & Metabolism", "Muscle Growth & Performance", "Sexual Health & Hormones", "Anti-Aging & Longevity", "Skin, Hair & Cosmetics" (`AgentStorefrontGrid.tsx:181–187`).
- Symptom→product search maps "erectile", "insomnia", "diabetes", "type2", "belly fat", "libido" to buy buttons (1183–1249).
- Goal quizzes: `StorefrontDiscovery`/`GuidedDiscoveryWizard` ("Describe Your Goal → We Match Compounds", weight_management/sexual_health/muscle_growth), `MatchForm` ("What Is Your Primary Research Goal?", "I want to research weight loss compounds"), `HelpMeChooseWizard` ("Fat Loss", "Anti-Aging", "Sleep" tiles + "Preferred Administration Route?"), `/lab-journal` GOAL_MAPPINGS.

**Fix:** Recategorize by mechanism/research area ("Metabolic Research", "Tissue-Repair Research", "Incretin-Pathway Research"); remove the symptom/disease search synonyms; remove "your goal / administration route" personal framing from every wizard.

### A8. Calculator suite — syringe/injection tooling  **[CRITICAL/HIGH — strip injection features]**
`components/research/CalculatorSuite.tsx` (and duplicate `ReconstitutionCalculator.tsx`, `LabToolsCalculators.tsx`). Keep the legitimate lab chemistry (serial dilution, molarity, Arrhenius stability, HPLC/MS, SPPS cost). Remove:
- Draggable **syringe visualizer** — "To Draw A Dose Of {x}, Pull Liquid To {N} Units" + needle graphic (277–399).
- **"Needle Gauge & Subcutaneous Injection Guidelines"** — "injections are placed into the fat layer below the skin… 4mm to 8mm… 31G minimal discomfort" (814–872).
- **U-40 (veterinary) / U-80 / U-100** insulin-syringe selector (723–727).
- Per-compound **dose presets** (BPC 250 mcg, Semaglutide 0.25 mg, PT-141 1 mg) and **"Cost Per Dose / Doses Per Week"** monthly/annual supply projections (255–265, 1626–1672).
- Page **metadata + HowTo JSON-LD** advertising "dosing by body weight… injection site scheduling… insert the needle" (page.tsx:11–131).

**Fix:** Rewrite the page to in-vitro-only; keep concentration math, remove all draw-volume/needle/dose-preset/per-week features.

### A9. Peptide 101 course — dosing & injection modules  **[HIGH — remove those modules + audit the JS]**
`app/peptide-101/page.tsx` syllabus lists **"Module 9: Dosing Reference"** and **"Module 11: Why Peptides Are Injected."** The actual lesson content is served from static `public/peptide-101.v14.js` (not in the code I could read) — **this needs to be pulled and audited separately; expect human dosing/injection instruction inside.** **Fix:** Remove those modules and de-humanize the course engine.

### A10. `/help` payment guidance that tells buyers to waive buyer protection  **[CRITICAL — delete this copy]**
`lib/help-faq.ts:294–303`: **"Always Send As Friends And Family (Toggle Off Goods & Services). Goods & Services Triggers Buyer Protection That Conflicts With Research-Only Sales And May Cause Reversal."** Coaching consumers to disable chargeback/buyer protection is an unfair/deceptive practice and reads as an admission you expect disputes. **Fix:** Remove all "friends and family / toggle off goods & services / avoid buyer protection" instructions everywhere.

---

# PART B — Page-By-Page Edits (Keep The Page, Fix The Content)

### Storefront & commerce
- **`/[agentSlug]` storefront grid** — Rename outcome-branded bundles ("The Appetite Crusher Stack", "Shred Stack", "Furnace Stack", "Lipolysis Stack", "Wolverine Stack") to neutral compound-list labels (`AgentStorefrontGrid.tsx:142–165`). **[MED]** Verify the "MSRP … YOU SAVE $X" strike-through price is a bona fide substantiated market price, or remove it (FTC deceptive-pricing) (2534–2552). **[LOW]**
- **Product detail modal** (`ProductModalEnhancements.tsx`) — Remove "Administration Route… nasal spray as an alternative to injection" (538–553) **[HIGH]**; relabel the reconstitution "Dose" selector to "Working Concentration" (585–682). **[MED]**
- **`/account/refills`** (`RefillsClient.tsx`) — "Refill" on a fixed 21-day cadence ("Time To Refill", "Refill Due") implies personal consumption. Rename to "Reorder/Restock" and drop the 21-day "due" logic (24, 194–270). Same for the 21-day "Time To Restock?" push in `lib/notify.ts:388`. **[HIGH]**
- **Checkout** (`CheckoutForm.tsx`) — No refund/return or payment-risk statement anywhere, while all rails are irreversible P2P (Zelle/Cash App/Venmo/Apple Pay). Add a clear refund/return + dispute policy and disclose payments are non-reversible. **[MED]** (The 3-checkbox attestation + pre-insert audit log is good — keep it.)

### Research library (keep these pages; scrub the data they render)
- **`/research/[slug]` monograph** (`MonographTabs.tsx`) — Remove the `eli5_summary` render (second-person benefit copy: BPC-157 "the ultimate 'Fix-It' mechanic for your body"; semaglutide "leading to massive weight loss"; PT-141 "flip on the switch for sexual desire") **[CRITICAL]**; remove "Typical Frequency" (human injection schedules) **[HIGH]**; reframe the Handling tab's "Injection Is The Established Route For This Compound" to "route studied in the literature" **[HIGH]**; purge consumer-benefit tags ("fat burning", "weight loss", "libido") from `studied_for` **[HIGH]**; downgrade `MedicalSubstance`/`adverseOutcome` JSON-LD to `ChemicalSubstance`/`Dataset` **[MED]**.
- **`plain_summary` field** (shown on cards, QuickView, monograph) — reword purpose phrasing: "A growth-hormone fragment **for fat loss**" (aod9604), "**for muscle growth**" (follistatin) → "studied in models of…" **[MED]**.
- **`/research/area/[area]` + `AreaProductGrid`** — Remove the fabricated default efficacy scores `{Fat Loss:8, Muscle Growth:7, Healing:9}` (page.tsx:133) and stop rendering eli5/efficacy/frequency on browse cards. **[HIGH]**
- **`lib/research-area-content.ts` / `/research/about-areas`** — Neutralize "therapeutics"/"fat-loss compound" positioning and the "combine TB-500 with BPC-157" protocol example. **[MED]**
- **`/research/[slug]/spec`** — Rename "Administration Route" → "Route Studied In Literature." **[MED]**
- **Clean, keep as-is:** `/research` hub, a-z, areas index, by-class/half-life/mechanism/mw/target, catalog (minus the wizard), compare, correlated, data, discontinued, evidence, in-pipeline, most-cited, most-studied-2026, new-additions, orphan-drugs, timeline, approved-drugs, intranasal-peptides, faq, glossary, methodology, learn, references, api-docs, guides, reading-queue, saved, subscriptions, search, and the `[slug]/references|regulatory|structure` subpages. These carry consistent RUO framing.

### City SEO (for whatever survives A3)
- **`/peptides/{state}/{city}`** — Delete reconstitution + post-delivery storage FAQs; remove named-drug callouts from FAQ/meta; **fix the false claim** "major credit cards, bank transfers… accepted" (you don't take cards) (`city-content.ts:143,187`) **[HIGH]**; remove the hidden `clip:rect(0,0,0,0)` "answer-engine bait" text block (cloaking) (`CityPage.tsx:455–493`) **[MED]**; soften "prices unavailable anywhere else / discreet packaging" **[MED]**.
- **`/peptides/{state}`** — Remove or soften the blanket "Yes, research peptides are legally available in {state}" FAQ (legal overclaim) (page.tsx:79). **[MED]**
- **`/peptides` hub + footer** — Remove `data-nosnippet` from the RUO strip so the disclaimer is snippet-visible; reconsider promoting "Reconstitution Calculators" in the footer. **[LOW/MED]**

### Marketing, agents, referrals
- **`lib/email.ts`** — `POSTAL_ADDRESS = process.env.EMAIL_POSTAL_ADDRESS || ''`; if unset, marketing emails ship **without a physical address (CAN-SPAM violation).** Hardcode/require a verified postal address before any marketing send. **[MED]** (Unsubscribe + List-Unsubscribe headers + RUO footer are good — keep.)
- **`/account/referrals`** — Incentivized referral program with no instruction that referrers must disclose the paid connection (FTC Endorsement Guides). Add referrer disclosure guidance + program terms. **[MED]**
- **`/become-agent`** — "Top-Performing Agents Earn The Best Margins" implies income; add an earnings/results-vary disclaimer. **[LOW]**
- **`AdvertisingHub` / `/admin/social`** — Free-text creative upload with no claim-linting is the vector by which agents introduce before/after and drug-comparison claims. Add upload-time claim guidance/review. **[LOW-vector]**
- **Clean:** SMS is fully removed (no TCPA exposure); coupons/flash-sales/signup-promos have no sweepstakes/lottery mechanics or "free vial" framing; the social autoposter enforces "no dosing/therapeutic/human-use language, #RUO."

---

# PART C — Global Image & Label List (Change Or Remove)

> Note: most bitmaps live in `/public/images/...` and Supabase buckets and weren't in the code bundle, so image-content items below are flagged by filename + where they're displayed and marked "review" where the binary couldn't be opened. The 126 physical label PNGs in `product-labels/` were inspected directly.

## Images to remove/replace
- **`/images/injection-site-body.jpg`** — human body used as an injection-site map on `/lab-journal`. The single most direct human-injection depiction on the site. **Remove with the feature (A1).** **[HIGH]**
- **`/images/products/semaglutide.png · tirzepatide.png · retatrutide.png · liraglutide.png` + `lib/categoryImage.ts` brand aliases** — `PRODUCT_IMAGE_MAP` maps trademarked brand queries to vial images (`ozempic → semaglutide.png`, `wegovy → semaglutide.png`, `victoza → liraglutide.png`). Trademark + misbranding exposure. **Remove all brand-name→image aliases;** keep only the generic INN with a neutral vial render. **[HIGH]**
- **`/images/areas/*.png` benefit-category artwork** — `weight_management.png`, `performance.png`, `sexual_health.png`, `cosmetic.png`, `sleep.png`, plus longevity/metabolic/healing/tissue_repair/pain_inflammation/gut_health/bone_joint/cognitive/immune/mitochondrial, and `areas_header.png`. Any that depict human bodies/physiques/lifestyle scenes market human benefit. **Replace with abstract molecular/mechanism renders; retitle to research targets.** (weight/performance/sexual = **[HIGH]**; rest **[MED-review]**.)
- **`/images/badges/*`** — Remove `badge_approved_drug.png`, `badge_investigational_drug.png` (assert drug/approval status on RUO chemicals) **[MED]**; replace `badge_glp1.png` with a neutral mechanism label **[MED]**; review `badge_cosmetic/angio_alert/preclinical` wording **[LOW]**. Keep neutral badges (research_compound, in/low/out-of-stock, price_drop, cold_chain, premixed).
- **`/images/buttons/dose-and-frequency-btn.png`** — remove with the DoseFrequencyPanel (A4). **[MED]**
- **Hero/landing artwork — review, replace any human/clinical/before-after/syringe imagery:** `/images/city-hero-peptide.jpg`, `/researcher-menu.jpg`, `/images/research/store-hero.png`, `/images/store_discovery_hero_v3.png`, `/images/researcher_calculators_hero.png`, `/images/city-sections/bg-*.jpg`, `storefront-assets/landing/pep-nation-landing.png`, `storefront-assets/about/pep-nation-about.png`. **[MED-review]**
- **Clean, keep:** logo/nav/messenger/payment icons, cart/back-arrow/hamburger, molecule & vial placeholders, stock/status badges, and the generated `opengraph-image.tsx` routes (text/molecule only).

## Physical label templates — mandatory elements missing  **[HIGH — misbranding]**
The 126 PNGs in `product-labels/` (mirrored to Supabase `print-labels` and `print-labels/savage`) are flattened static art; the print code (`PrintLabelsClient.tsx`, `savage-labels/LabelGenerator.tsx`) only tiles them and **overlays no text** — so whatever is missing from the PNG is missing from the printed label. Every label currently shows only: brand mark, product name, "RESEARCH COMPOUND" subtitle, category color. Missing from **all 126** templates and both brand variants:

| Required element | Present? | Action |
|---|---|---|
| RUO caution — "For Research Use Only. Not For Human Use." | **No** ("Research Compound" is a name, not the caution) | Add the full caution statement to every template |
| Lot / batch number | **No** | Add per-batch lot (needs dynamic generation, not fixed PNG) |
| Net quantity / contents (mass + fill) | **No** (strength only in filename/UI) | Add net contents to the label face |
| Responsible party (distributor legal name + place of business) | **No** (logo only) | Add distributor legal name + address |

**Savage Brands relabel** (`savage-labels`) swaps in a Savage-branded PNG and **strips the only origin identifier (the Pep Nation logo)** while adding none of the four required elements — classic private-label misbranding. Both brand variants must carry the full required set and must name the actual distributor of record; the white-label swap must not remove the responsible party.

---

# PART D — Legal / Policy Page Gaps (Missing Or Contradictory)

### D1. Terms (`app/terms/page.tsx`)
- **Governing law/venue is unnamed** — "the state in which Pep Nation Lab LLC is organized," but that state is never disclosed anywhere. Name the state + venue. **[HIGH]**
- **No refund/return policy** in the binding Terms, even though the Help Center documents a real 7-day RMA + restocking-fee + refund program and a wallet-refund ledger exist. Add a Returns & Refunds section mirroring actual practice. **[HIGH]**
- **No auto-renewal/subscription terms** despite an "Auto-Replenish / Subscribe & Replenish" feature (CA ARL / FTC negative-option rules). Add billing cadence + cancellation terms. **[HIGH]**
- No arbitration clause / class-action waiver (absence, not a defect) — decide and state a dispute mechanism given the unnamed forum. **[MED]** No business address/entity number. **[MED]** Contact address inconsistency: Terms use `support@`, footer uses `research@`. **[LOW]**
- Present and adequate: 21+ eligibility, RUO buyer covenant, liability cap, indemnification, warranty disclaimer.

### D2. Privacy (`app/privacy/page.tsx`)
- Claims **"GDPR and CCPA aligned"** but provides **no CCPA/CPRA rights mechanism** (no right-to-know/delete, no "Do Not Sell or Share" link, no categories table) and separately says "intended for users in the United States" (contradicts GDPR). Either drop the alignment claims or add the actual rights + Do-Not-Sell link. **[HIGH]**
- "We do not use third-party analytics" while the stack uses **Sentry** (telemetry) and **Resend** (email) — disclose subprocessors or reconcile. **[MED]**
- Disclosed payments (Zelle/Venmo/Cash App/Apple Pay) don't match Help's PayPal/Wise/Chime/Apple Cash instructions. Reconcile. **[MED]** Phone numbers collected but SMS use never addressed. **[LOW]**

### D3. Compliance (`app/compliance/page.tsx`)
- **Self-incriminating contradiction:** the policy says "Marketing, product descriptions, and storefront content **must never describe or imply human or animal use, dosing, or therapeutic benefit**" — yet the city/compound pages, dose panels, nicknames, and benefit categories do exactly that. Until Parts A–B are done, this page reads as an admission the site is out of its own policy. Fixing A–B resolves it. **[HIGH]** The page's own text does not overclaim ("fully FDA compliant") — good.

### D4. Shipping — there is no public shipping policy
`/shipping` is the internal agent fulfillment dashboard (auth-gated), but `/help` links to it as "Shipping Details." No restricted-states / hazmat / international disclosures exist anywhere. Build a real public Shipping Policy. **[MED]**

### D5. Help Center (`lib/help-faq.ts`)
- The "friends and family / disable buyer protection" instruction — see **A10 [CRITICAL].**
- Documents returns/refunds with no counterpart in Terms — reconcile (see D1). **[HIGH]**
- "Email Notifications Are Currently Disabled Platform-Wide" while email is enabled — accuracy drift. **[LOW]**

### D6. About (`app/about/page.tsx`)
- The visible page is a single raster image with the real copy present only as visually-hidden `srOnly` text plus ~25 invisible click-zones over the artwork — accessibility + cloaking concern. Render the copy as real visible text. **[MED]**

### D7. Clean legal pages
`/disclaimer`, `/accept-disclaimer`, `/account/compliance`, `/contact`, `/status` (admin-only, noindex) — consistent with the RUO framework. Minor: `/disclaimer` says the gate fires "at site entry" while `SiteDisclaimerGate` is now a passthrough (wording only).

---

# PART E — Already Done Right (Do NOT Touch)

These are genuine compliance controls; keep them intact.
- **DisclaimerGate** — 3 mandatory checkboxes, 7 warranties (in-vitro only, not FDA-approved, **21+ attestation**, no human/animal use, "never sells needles/syringes", indemnification), non-dismissible, focus-trapped.
- **Add-to-Cart RUO acknowledgment** — per-session modal logged as `layer:'add_to_cart'` to `disclaimer_acceptances`.
- **Checkout attestation** — 3-checkbox certification audited *before* the order insert (order refused if the audit row fails).
- **Email compliance basics** — one-click unsubscribe with HMAC token + `List-Unsubscribe`/`List-Unsubscribe-Post` headers, transactional mail correctly excluded, RUO + "not evaluated by the FDA" email footer.
- **SMS fully removed** — no TCPA/consent exposure.
- **COA handling** and the internal **`/admin/catalog-risk`** SKU risk-scoring tool (use it to action the catalog nicknames above).
- **Storefront RUO banner**, and the strong per-page RUO footers throughout the `/research` library.

---

# Suggested Order Of Execution

1. **Batch 1 (clear-cut deletions, low regret):** A1 lab-journal, A2 nickname map, A4 dose panel, A5 protocol generators, A6 efficacy charts, A8 syringe tooling, A10 buyer-protection copy. These kill the biggest contradictions and are pure removals.
2. **Batch 2 (SEO layer):** A3 compound-city pages + indexing/robots alignment + the city-page FAQ fixes.
3. **Batch 3 (recategorization):** A7 storefront categories/wizards, Part B monograph/data scrubs, refills → reorder.
4. **Batch 4 (labels & images):** Part C — rebuild the label template with the 4 required elements (dynamic lot/net-qty), fix the Savage relabel, swap the flagged images.
5. **Batch 5 (attorney-approved wording):** Part D — Terms (governing law, returns, subscription), Privacy (CCPA/subprocessors/payments), public Shipping Policy, CAN-SPAM address. **Get counsel to approve the exact language before shipping these.**

I can start implementing Batch 1 and 2 immediately on your say-so; I'd hold Batch 5 for your/your attorney's wording sign-off.
