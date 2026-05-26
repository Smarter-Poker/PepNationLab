# PepNationLab — Agent & AI Rules

## MANDATORY: No Emojis Anywhere — Zero Exceptions

**This is a hard platform rule with zero exceptions.**

Emojis are NEVER allowed and are strictly PROHIBITED anywhere inside this project.

### Scope (everything — no exceptions):
- All source code: `.tsx`, `.jsx`, `.ts`, `.js`, `.css` files
- All user-facing text: pages, components, buttons, labels, badges, headings, nav links, error messages, placeholders, tooltips, toasts
- All comments in code
- All documentation: `.md` files, including this file, `README.md`, and `AGENTS.md`
- All commit messages
- All SQL migrations and database content
- All config files

### What To Use Instead:
- For icons in the UI: use `lucide-react` components or premium inline SVG icons
- For status or emphasis markers in docs: use plain words ("Correct:", "Wrong:", "Note:", "Warning:")
- Never paste a Unicode emoji or emoji-style pictograph as a substitute

If any emoji is found anywhere in the project, it must be removed immediately.

---

## MANDATORY: Title Case Capitalization — ALL Pages

**This is a hard platform rule with zero exceptions.**

Every word on every user-facing page, component, button, label, badge, heading, nav link, error message, placeholder, and tooltip MUST start with a capital letter.

### What This Means:
- Correct: "Create Researcher Account"
- Correct: "Research Use Only"
- Correct: "Sign In To Your Account"
- Correct: "Browse The Catalog"
- Wrong: "create researcher account"
- Wrong: "research use only"
- Wrong: "sign in to your account"

### Scope:
- All `.tsx` / `.jsx` component text strings
- All button labels
- All form labels and placeholders
- All badge text
- All nav items
- All page headings (h1–h6)
- All error messages shown to users
- All toast / notification text
- All footer text

### Technical Enforcement:
CSS `text-transform: capitalize` is applied globally in `globals.css` as a CSS-layer backup, but the TEXT IN SOURCE CODE must also be written in Title Case — CSS capitalize does not handle all edge cases.

### Exceptions (do NOT capitalize):
- Email addresses in form values / inputs
- URLs
- Database column names and code identifiers
- Legal disclaimer body text where sentence-case is legally required
- SQL / code blocks

---

## Zero Cross-Contamination With Smarter.Poker

PepNationLab is a 100% isolated platform. Never:
- Import from or reference Smarter-Poker-World-Hub paths
- Use Smarter.Poker Supabase credentials (`kuklfnapbkmacvwxktbh`)
- Use Smarter.Poker Vercel project names or env vars
- Add PepNationLab code to the Smarter-Poker-World-Hub repo

PepNationLab Supabase ref: `ydsaqnnuwyvtyxgvrnys`
PepNationLab GitHub: `github.com/Smarter-Poker/PepNationLab`
PepNationLab Vercel: `smarter-poker/pepnationlab`

PepNationRX (the telehealth platform) has its own standalone repo at
`github.com/Smarter-Software/pepnationrx`. Its live Supabase database is project
`cupnhfdwveouenutnveg` (project name: pepnationrx). Never run PepNationRX
migrations against `ydsaqnnuwyvtyxgvrnys` — that ref is the PepNationLab
storefront database, not the telehealth backend.

The `pepnationrx/` subdirectory in this repo is a local working copy only.
Push PepNationRX changes to `Smarter-Software/pepnationrx`, NOT to this repo.

---

## MANDATORY: PepNationRX Deployment Workflow

**Before pushing or publishing ANY PepNationRX change, every Claude session and
every Antigravity agent MUST read and follow `pepnationrx/DEPLOYMENT-WORKFLOW.md`.**

PepNationRX is a SPLIT deployment, not a single host:
- Frontend (`pepnationrx/frontend/`) is published by VERCEL -- it auto-deploys on
  every push to `main` of `Smarter-Software/pepnationrx`.
- Backend API (`pepnationrx/backend/`) runs on the HETZNER server `5.161.252.33`
  and is deployed by SSH.
- Database is Supabase project `cupnhfdwveouenutnveg`.

Do NOT scp the frontend to Hetzner -- the public domain is served by Vercel.
Always verify a publish by hitting `https://pepnationrx.com`, never localhost or
the Hetzner IP. The full workflow and pre-publish checklist are in
`pepnationrx/DEPLOYMENT-WORKFLOW.md` -- that file is authoritative and overrides
any older note or assumption.

---

## Research-Only Compliance — 4-Layer Disclaimer

The 4-layer disclaimer gate is mandatory and must never be removed:
1. **Site Entry** — DisclaimerGate overlay
2. **Registration** — 3-checkbox acknowledgment
3. **Add-to-Cart** — inline warning
4. **Checkout** — final confirmation

Never remove, bypass, or weaken these gates.

---

## Pricing Architecture

Three agent tiers — multipliers are set in `pricing_tiers` table:
- Tier 1: 5× base cost (best pricing)
- Tier 2: 6× base cost
- Tier 3: 7× base cost (entry pricing)

All multipliers are admin-configurable via dashboard. Never hardcode prices.

---

## Payment Rules

No credit card processing on this platform. All payments via:
- Zelle
- Venmo
- Cash App
- Apple Pay

Agents either: (a) have a line of credit squared up weekly, or (b) maintain a prepaid balance.
