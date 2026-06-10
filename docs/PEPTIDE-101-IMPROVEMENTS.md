# Peptide 101 — Exhaustive Improvement Backlog

A jam-packed, organized list of every way to make the course better: data, depth, visuals, interactivity, UI/UX, learning science, gamification, personalization, AI, accessibility, mobile, performance, analytics, credibility, and platform integration. Followed by per-module ideas and a prioritized quick-win list.

Status legend: `[LIVE]` already shipped · `[NEXT]` high-value quick win · `[BIG]` ambitious / multi-step.

---

## 1. Content & Data Depth

- `[NEXT]` Add a real "How Long It Lasts" half-life **decay curve** chart per peptide (concentration vs time), not just a bar.
- `[NEXT]` Pull live numbers from the `compounds` table into modules (half-life, MW, route, year discovered, citation count) so content is always current and never drifts from the Research Library.
- `[NEXT]` Add a **glossary that grows with the learner** — auto-link every jargon term in body text to a hover/tap definition (already partial via v3 tooltips; extend coverage to 100%).
- `[BIG]` Add **citations/sources** under each factual claim (PubMed IDs, ClinicalTrials.gov), shown in the in-app reference modal (Omega Protocol iframe already exists).
- Add a "Peptide of the Day" rotating spotlight card sourced from the catalog.
- Add **unit conversion helpers** inline (mcg↔mg, mL↔units) wherever numbers appear.
- Add real **molecular weights, amino-acid sequences, and structure thumbnails** for marquee peptides (BPC-157, TB-500, etc.).
- Add a **timeline of peptide research history** (discovery → first trial → today) as a scrollable module or s0 feature.
- Add **"common mistakes / myths"** callouts to every module, not just Module 10.
- Add **regional/legal nuance** data (research-use-only status varies by country) pulled from `compounds.regulatory`.
- Add **evidence-tier badges** (preclinical / early human / approved) to every peptide mention so learners gauge confidence.

## 2. Visuals & Animation

- `[NEXT]` Animated **lock-and-key binding** (key sliding in, lock rotating, signal cascade) — upgrade the current tap demo to a smooth SVG/Lottie animation.
- `[NEXT]` **Half-life decay animation** (vial emptying / curve drawing) tied to the selected peptide.
- `[NEXT]` **Reconstitution animation**: powder + water → swirl → liquid, synced to the calculator inputs.
- Animated **syringe fill** that physically moves the plunger to the unit mark (current visual is static fill).
- **Body map** highlighting where each peptide family acts (gut, pituitary, skin, brain) — interactive hotspots.
- **Peptide vs protein vs steroid** size-scale animation (relative molecule sizes).
- **Amino-acid chain builder** upgrade: show the water molecule "popping out" on each bond, and fold the chain into a 3D ribbon at length 51+.
- Subtle **scroll-reveal** animations on cards (respecting `prefers-reduced-motion`).
- **Progress ring** micro-animation when a module completes (confetti-lite, tasteful).
- Replace flat icons with consistent **duotone/animated icons** for module headers.
- 3D molecule viewer (e.g., 3Dmol.js) for peptides with PDB IDs in the catalog.

## 3. Interactivity & Hands-On

- `[LIVE]` AI "Ask A Question" tutor at the bottom of every module.
- `[LIVE]` Reconstitution calculator + syringe visual; half-life explorer; storage tabs; chain builder; Peptide Explorer.
- `[NEXT]` **Interactive dosing scheduler**: pick a peptide → see a visual weekly calendar of when it would be used (research framing).
- `[NEXT]` **"Build a research stack" sandbox**: drag two peptides together → AI/logic explains if/why they're complementary (ties into existing ai-stack-analysis).
- **Drag-to-bind** lock-and-key mini-game (drag the correct key onto the receptor).
- **Spot-the-red-flag** interactive COA: show a sample certificate, let learners tap the suspicious parts.
- **Half-life matching game**: match peptides to "use it daily / weekly / nightly."
- **Sortable, filterable** everything (dosing table already sorts; add filters by family, route, half-life).
- **Inline mini-quizzes** between sections (not just one per module) with instant feedback.
- **Flashcard mode** for the glossary (spaced repetition).

## 4. UI / UX & Navigation

- `[LIVE]` Locked header (nav + progress + tabs) that no longer slides over content.
- `[NEXT]` **Persistent "resume where you left off"** banner on entry (progress is account-bound; surface a one-tap resume).
- `[NEXT]` **Table of contents / module switcher** drawer reachable from anywhere (the course-nav tabs are a subset; add a full 13-module list).
- `[NEXT]` **Reading progress bar within a long module** (separate from course progress).
- **Estimated time remaining** that counts down as you scroll/complete.
- **"Mark as understood" per section**, not just per module.
- **Sticky mini-nav** showing the current module name + Next on long pages.
- **Dark/light toggle** (currently dark-only) — optional, brand permitting.
- **Font-size / dyslexia-friendly** reading controls.
- **Breadcrumbs** (Course > Module 5 > Storage).
- Smooth **section anchors** with scroll-margin so headings never hide under the fixed header.
- **Keyboard navigation**: left/right arrows already move screens; add `?` shortcut overlay and tab-trap in modals.
- **Print/share** per-module summaries (cheat sheet exists for the whole course; add per-module).

## 5. Learning Science & Pedagogy

- `[NEXT]` **Pre-assessment / "test out"**: a quick diagnostic that lets experienced users skip ahead and tailors emphasis.
- `[NEXT]` **Spaced-repetition review**: resurface missed quiz questions a day later (progress already stores quiz state).
- **Learning objectives** stated at the top of each module ("By the end you'll be able to…").
- **Recap card** at the end of each module (already have Key Takeaways; add a 1-line TL;DR at the top too).
- **Difficulty levels / tracks**: "Just the basics" vs "Go deeper" toggle that shows/hides the optional science.
- **Scenario-based questions** ("A vial arrives with no COA — what do you do?").
- **Confidence rating** after each quiz ("How sure were you?") to improve metacognition.
- **Adaptive content**: if a learner misses the half-life question, auto-surface a deeper explainer.

## 6. Gamification & Motivation

- `[NEXT]` **Badges** for milestones (Finished Basics, Calculator Pro, Perfect Quiz, Explorer — viewed 10 peptides).
- `[NEXT]` **Streaks** (days returned) and a **completion percentage ring** on the dashboard.
- **XP / points** per module + quiz, with a personal best.
- **Leaderboard** (optional, anonymized) among researchers.
- **Unlockables**: completing the course unlocks an advanced "Peptide 201" or a printable certificate (cert exists — gate it behind real completion).
- **Shareable achievement cards** (social-image generation already exists elsewhere on platform).
- **"Course complete" celebration** screen with stats (time spent, quiz score, peptides explored).

## 7. Personalization

- **Goal-based onboarding**: "What are you researching?" → reorder/emphasize relevant modules and Explorer results (ties into existing match engine).
- **Saved questions & answers**: let learners save AI tutor answers to a personal notebook (lab-journal already exists on platform).
- **Bookmarks / highlights** within modules.
- **Personalized recap email/notification** (push prefs already exist) summarizing what they learned.
- **"Continue your research"** CTA linking the modules they finished to relevant storefront/Research Library pages.

## 8. AI Features (beyond the tutor)

- `[LIVE]` Per-module "Ask A Question" tutor (Gemini, research-only guardrails).
- `[NEXT]` **Suggested follow-up questions** generated from the learner's last question (keep the conversation going).
- **AI-generated per-learner summary** of the whole course in their words.
- **AI quiz generator**: endless practice questions per module.
- **AI "explain like I'm 5 / 15 / expert"** toggle on any paragraph (ai-summary endpoint already does ELI5).
- **Voice questions** (speech-to-text) and **read-aloud** answers for accessibility.
- **Conversation memory** within a session so follow-ups have context.

## 9. Accessibility (WCAG 2.2 AA)

- `[LIVE]` ARIA roles/labels on injected widgets, live regions on dynamic answers.
- `[NEXT]` Full **screen-reader pass** on all 13 rebuilt modules + the AI answer flow.
- **Color-contrast audit** (teal-on-dark, muted text) against AA.
- **Focus-visible** styles on every interactive element; logical tab order.
- **Reduced-motion** honored everywhere (partially done).
- **Captions/transcripts** if any video is ever added.
- **Touch targets ≥ 44px** verified on mobile (mostly done).

## 10. Mobile

- `[NEXT]` Live device pass on the rebuilt modules (verified via headless DOM + responsive primitives, not a physical device yet).
- **Bottom-sheet** AI tutor on mobile instead of inline (more native feel).
- **Swipe** between modules.
- **Collapsible long sections** by default on small screens.
- **Sticky "Ask / Next"** action bar at the bottom on mobile.

## 11. Performance & Architecture

- `[NEXT]` Consolidate the v3–v10 engine stack into a **single bundled file** (currently 8 scripts injected at runtime) to cut requests and avoid any header-lock flash.
- Move the runtime-injected content into the **static HTML build** for first-paint speed and SEO (course is currently enhanced client-side).
- **Cache AI answers** for identical common questions (reduce Gemini cost/latency).
- **Lazy-load** the Explorer's 51-card grid and heavy SVGs.
- Add a **service-worker** offline mode for the course (platform already uses `sw.js`).

## 12. Analytics & Admin

- `[LIVE]` Admin completion-funnel dashboard (`/admin/course-101`) off `course_progress`.
- `[NEXT]` Track **per-question quiz accuracy** and **AI question topics** to find where learners struggle.
- **Drop-off heatmap** (which module/section loses people).
- **Most-asked AI questions** report → feed back into content improvements.
- **Time-on-module** analytics.
- **A/B test** content variants.

## 13. Credibility & Compliance

- `[LIVE]` Research-use-only framing throughout; AI guardrails (no medical/dosing advice).
- **"Last reviewed" date + reviewer** on each module.
- **Citations** on factual claims (see Content section).
- **Versioned content** with a changelog learners can see.
- **Clearer disclaimer styling** so it reads as protective, not boilerplate.

## 14. Platform Integration

- `[LIVE]` Explorer cards deep-link to `/research/{slug}`; "Find This Peptide" link; shelf-life tracker link.
- `[NEXT]` Cross-link finished modules to the **storefront** ("see suppliers"), **lab journal**, and **AI match** flows.
- **Single source of truth**: drive module data from the same DB the Research Library uses.
- **Certificate** recorded on the researcher profile + surfaced to agents/admin.
- **Notifications**: nudge learners to finish the course (push prefs exist).

---

## Per-Module Specific Ideas

### Module 1 — What Is A Peptide `[LIVE: rich rebuild]`
- Add an animated peptide-vs-protein size comparison.
- Add a "peptides in everyday life" interactive (tap insulin/oxytocin/collagen for a 1-liner).
- Add a 30-second animated intro ("a peptide is a text message for your cells").

### Module 2 — What Peptides Do `[LIVE]`
- Animate the half-life table into a decay curve.
- "Messenger relay" animation: peptide → receptor → cell action.
- Keep the optional science collapsible; add the 20-amino grid there with the water-pop animation.

### Module 3 — The Lock And Key `[LIVE]`
- Upgrade to drag-to-bind with wrong-key feedback ("this key doesn't fit").
- Show agonist vs antagonist as two animated keys (one turns, one blocks).
- Add a real receptor-signaling cascade mini-animation.

### Module 4 — What Peptides Are Studied For `[LIVE]`
- Make each research area expandable with 2–3 real study summaries + citations.
- Add a body-map hotspot view of where each area acts.
- Link each area's example peptides straight to the Explorer filtered by family.

### Module 5 — Handling & Storage `[LIVE]`
- Add a temperature/time **degradation simulator** (slider: how much potency is left after X days at Y temp).
- Animate freeze-thaw damage (ice crystals tearing the chain).
- Tie the shelf-life tracker example to a live worked date.

### Module 6 — Peptide Families `[LIVE]`
- Interactive family tree / sunburst chart of all families and members.
- "Guess the family" quick game.
- Live counts per family pulled from the catalog.

### Module 7 — Stacking & Protocols `[LIVE]`
- Drag-two-peptides sandbox with AI synergy explanation.
- Animate the GH-axis diagram (two doors opening → bigger pulse).
- Show 2–3 named research protocol templates with timelines.

### Module 8 — Reconstitution Calculator `[LIVE: enriched]`
- Animate the syringe plunger to the exact unit mark.
- Add a "common vial presets" gallery.
- Add a reconstitution **step-by-step animation** synced to inputs.

### Module 9 — Dosing Reference `[LIVE: enriched]`
- Add filters (family, route, half-life) and column visibility toggles.
- Visual "frequency" column (dots for daily/weekly).
- Link each row to its monograph and to the calculator pre-filled.

### Module 10 — What Peptides Are NOT `[LIVE: enriched]`
- Keep the comparison table; make it interactive (tap a row to expand).
- "Myth vs Fact" flip cards.
- Quick "is this a peptide, steroid, or protein?" sorting game.

### Module 11 — Why Injected `[LIVE: enriched]`
- Animate the stomach digesting a swallowed peptide vs sub-Q surviving.
- Show the few exceptions (nasal/topical) with why they work.

### Module 12 — Safety, Purity & Sourcing `[LIVE: enriched]`
- Interactive sample COA with tappable red flags.
- HPLC purity visual (chromatogram with the main peak vs impurities).
- "Score this source" checklist tool.

### Module 13 — Legality & Research Use `[LIVE: enriched]`
- Region selector showing general research-use context.
- Plain-language "what research use only means for you" checklist.

---

## Prioritized Quick Wins (do these next)

1. **Decay-curve + binding + reconstitution animations** (high wow, reuses existing data).
2. **Resume banner + within-module reading progress** (retention).
3. **Badges + completion celebration** (motivation, cheap to add).
4. **Pre-assessment / test-out + spaced-repetition review** (real learning lift).
5. **Suggested AI follow-up questions** (extends the tutor you just shipped).
6. **Filters on the dosing table + interactive COA** (depth where it matters).
7. **Bundle the v3–v10 engines into one file** (performance + no header flash).
8. **Live mobile + screen-reader pass** (polish + accessibility).

---

## Big Swings (ambitious)

- **Peptide 201 / advanced track** unlocked on completion.
- **3D molecule viewer** for catalogued peptides.
- **Full conversational AI tutor** with memory + voice across the whole course.
- **Personalized research path** driven by the match engine and goals.
- **Static-render the course** for instant load + SEO while keeping the interactivity.
