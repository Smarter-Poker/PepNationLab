# PepNationLab — Agent & AI Rules

## 🔤 MANDATORY: Title Case Capitalization — ALL Pages

**This is a hard platform rule with zero exceptions.**

Every word on every user-facing page, component, button, label, badge, heading, nav link, error message, placeholder, and tooltip MUST start with a capital letter.

### What This Means:
- ✅ "Create Researcher Account"
- ✅ "Research Use Only"
- ✅ "Sign In To Your Account"
- ✅ "Browse The Catalog"
- ❌ "create researcher account"
- ❌ "research use only"
- ❌ "sign in to your account"

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

## 🚫 Zero Cross-Contamination With Smarter.Poker

PepNationLab is a 100% isolated platform. Never:
- Import from or reference Smarter-Poker-World-Hub paths
- Use Smarter.Poker Supabase credentials (`kuklfnapbkmacvwxktbh`)
- Use Smarter.Poker Vercel project names or env vars
- Add PepNationLab code to the Smarter-Poker-World-Hub repo

PepNationLab Supabase ref: `ydsaqnnuwyvtyxgvrnys`
PepNationLab GitHub: `github.com/Smarter-Poker/PepNationLab`
PepNationLab Vercel: `smarter-poker/pepnationlab`

---

## ⚠️ Research-Only Compliance — 4-Layer Disclaimer

The 4-layer disclaimer gate is mandatory and must never be removed:
1. **Site Entry** — DisclaimerGate overlay
2. **Registration** — 3-checkbox acknowledgment
3. **Add-to-Cart** — inline warning
4. **Checkout** — final confirmation

Never remove, bypass, or weaken these gates.

---

## 💰 Pricing Architecture

Three agent tiers — multipliers are set in `pricing_tiers` table:
- Tier 1: 5× base cost (best pricing)
- Tier 2: 6× base cost
- Tier 3: 7× base cost (entry pricing)

All multipliers are admin-configurable via dashboard. Never hardcode prices.

---

## 💳 Payment Rules

No credit card processing on this platform. All payments via:
- Zelle
- Venmo
- Cash App
- Apple Pay

Agents either: (a) have a line of credit squared up weekly, or (b) maintain a prepaid balance.
