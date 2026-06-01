# PepNationLab Mobile Spec (Round 23)
The locked-in mobile spec (22 rounds of iteration on /messenger, plus site-wide sweep).
This spec governs CSS and layout decisions for mobile viewports across the site.

## 1. Inputs & Forms (iOS Zoom Fix)
- All `input`, `textarea`, and `select` elements must have a font size of `16px` or greater on mobile to prevent iOS Safari auto-zoom.
- Use `!important` on mobile media queries to beat any inline styles like `0.88rem` that might shrink inputs below 16px.

## 2. Touch Targets (a11y)
- Minimum `44px x 44px` touch targets on coarse pointers (`@media (pointer: coarse)`).
- Ensure checkbox and switch rows maintain a `44px` min-height.
- Use `:not()` guards where necessary to keep certain tight UI elements (like messenger composer pill icons) slim if the 44px rule breaks their layout, but generally enforce 44px.

## 3. Padding & Layout
- **Defensive nav-offset padding:** Elements like `.account-page-wrapper`, `[data-account-page]`, and orphan `<main>` / `.pnl-page:not(.pnl-page-with-navbar)` must self-pad to prevent content from hiding under sticky/fixed navbars.
- **Card Padding Clamp:** Clamp card padding on screens `< 480px` so that cards do not bleed off the edges.
- **Modal padding:** Always include `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` for overlays and modals.

## 4. Tables
- **Universal table overflow-x:** Every `<table>` must become a block element with horizontal scrolling (`overflow-x: auto`) on mobile to prevent horizontal page scrolling.

## 5. Typography & Text
- **Legal docs:** Use `overflow-wrap: anywhere`, `min-height: 1.6`, and a minimum `0.95rem` body font size to ensure readability on small screens.
- **Footer:** Disclaimer text should have a minimum font size of `0.85rem`.
- **Inline Font Size Floor:** Any tiny inline text (e.g. `0.62rem` - `0.78rem`) must be floored to `0.82rem` on mobile for legibility.

## 6. Component-Specific
- **Hero polishing:** Hide the orbit decoration on mobile to save space. Ensure stats wrap correctly and fix `min-height` calc.
- **Storefront Nav (`.sf-nav .dashboard-icon`):** Size should be `130px` on screens `<=768px`, and `100px` on screens `<=380px` (overriding any inline 158px styles).

## 7. JSX Standards
- **No Emoji Icons:** Do not use raw emojis (like a pencil emoji) for actions. Use inline SVGs (like `lucide-react` icons).
- **Text over Glyphs:** Prefer clear text over cryptic glyphs for actions like "Close" or status updates like "Link Copied" where possible.
- **Title Case:** Ensure all buttons and action text use proper Title Case (e.g., "Back To Store", "Continue To Payment").
- **Security:** Ensure `console.log` never outputs tokens (like `access_token`) which would leak secrets into the browser console.
