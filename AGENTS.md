<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:deployment-rules -->
# Hard Deployment Law

After EVERY code change or fix — no exceptions:
1. Write any required SQL migration files to `supabase/migrations/` and apply them via `npx supabase db push` (or note if Supabase CLI is unavailable and provide the raw SQL).
2. Commit ALL changed files with `git add -A && git commit -m "..."`.
3. Push to production with `git push` (Vercel auto-deploys on push).
4. Only AFTER push is confirmed, give the user a report.

Never give a report without first deploying. This is a hard law.
<!-- END:deployment-rules -->

<!-- BEGIN:iframe-omega-protocol -->
# MANDATORY: The Omega Protocol for External Links

**This is a hard platform rule with zero exceptions.**
PepNationLab strictly forbids navigating users away from the `pepnationlab.com` domain. Any external link MUST be rendered inside the app using the `IframeModal` component.
- Always use `<IframeModal url={externalUrl} title={optionalTitle} onClose={handler} />`.
- `IframeModal` natively routes the URL through `/api/proxy?url=...` to bypass `X-Frame-Options`. Never attempt to put an external URL directly into an `<iframe>` src.
- The `IframeModal` must be true full-screen, utilizing `height: 100dvh` and `z-index: 999999`. Do not alter these properties.
<!-- END:iframe-omega-protocol -->


<!-- BEGIN:peptide-101-module-image-convention -->
# Peptide 101 — Dynamic Image Module Convention

Each module in the Peptide 101 course (`#s1`–`#s14`) starts life as JS-SVG content
rendered by `peptide-101.mN.js` via the v14 stepper engine.
Over time, each module is **upgraded** to full dynamic images stored in
`public/images/course/modN_pg1.png … modN_pgX.png` and wired up in `public/peptide-101.html`.

## The ONE Rule When Upgrading a Module to Dynamic Images

Add `data-v14="1"` to that module's `<div id="sN">` in `public/peptide-101.html`:

```html
<div class="screen" id="s3" data-v14="1" style="padding:0;background:transparent;">
```

**That single attribute is the entire migration.** The v14 engine checks for it before
calling `buildStepper()` and skips the overwrite automatically. No changes needed to
`peptide-101.v14.js` or `peptide-101.mN.js`.

## Current Status (update this table as each module ships)

| Screen | Module | Status |
|--------|--------|--------|
| `#s1`  | Module 1 — What Is A Peptide? | ✅ Dynamic images (`mod1_pg1–6.png`) |
| `#s2`  | Module 2 — Building A Peptide | ✅ Dynamic images (`mod2_pg1–6.png`) |
| `#s3`  | Module 3 | 🔄 JS-SVG (next to upgrade) |
| `#s4`  | Module 4 | 🔄 JS-SVG |
| `#s5`  | Module 5 | 🔄 JS-SVG |
| `#s6`  | Module 6 | 🔄 JS-SVG |
| `#s7`  | Module 7 | 🔄 JS-SVG |
| `#s8`  | Module 8 | 🔄 JS-SVG |
| `#s9`  | Module 9 | 🔄 JS-SVG |
| `#s10` | Module 10 | 🔄 JS-SVG |
| `#s11` | Module 11 | 🔄 JS-SVG |
| `#s12` | Module 12 | 🔄 JS-SVG |
| `#s13` | Module 13 | 🔄 JS-SVG |
| `#s14` | Module 14 | 🔄 JS-SVG |

**Never re-generate or overwrite JS-SVG content for a module already marked ✅.**
<!-- END:peptide-101-module-image-convention -->

