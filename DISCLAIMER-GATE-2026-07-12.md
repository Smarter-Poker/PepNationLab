# Disclaimer Gate Relocation -- 2026-07-12

**This note SUPERSEDES the "Site Entry" bullet (layer 1) of CLAUDE.md's
"MANDATORY: Research-Only Compliance -- 4-Layer Disclaimer" section.** That
bullet still reads "DisclaimerGate overlay"; the on-arrival overlay was
intentionally removed on 2026-07-12 (details below). The other three layers are
unchanged.

## What changed

The full-screen "Mandatory Research-Only Acknowledgment" (the `DisclaimerGate`
that `SiteDisclaimerGate` used to paint over the first route a visitor hit) NO
LONGER appears on arrival. On an agent QR scan a guest was bounced to the house
store and then hit that overlay, so the first thing a new visitor saw was a wall
of legal text over a half-loaded store -- it read as a broken / dead site.

`components/SiteDisclaimerGate.tsx` is now a transparent passthrough
(`return <>{children}</>`). **Do NOT reinstate the on-arrival overlay.** Shipped
by the site owner's direction (commit `b516fb8`), verified live in a browser.

## The acknowledgment is NOT weakened

The "never remove, bypass, or weaken these gates" rule still holds -- only layer
1's *trigger* moved off page-arrival. The acknowledgment is still enforced,
independently, at every point that legally matters:

- **Sign-up** -- three required checkboxes (`app/signup/page.tsx`), logs `layer = 'registration'`.
- **Add-to-cart** -- blocking modal in `components/CartContext.tsx`, logs `layer = 'add_to_cart'`.
- **Checkout** -- three required checkboxes (`app/checkout/CheckoutForm.tsx`) plus
  `/api/orders` hard-refusing any order missing the acknowledgment, logs `layer = 'checkout'`.
- **Landing "Continue As Guest"** -- `app/HomeClient.tsx` shows the same
  `DisclaimerGate` before a guest enters the store, logs `layer = 'site_entry'`.
  Log In and Create Account pass straight through (sign-up carries its own gate).

## Related storefront change (same commit)

`app/[agentSlug]/page.tsx`: a GUEST on a non-house agent storefront now
`redirect('/')` (home / sign-up page) instead of to the house store. The house
store `researchstore` (`DEFAULT_STORE_SLUG`) still renders directly for guests
AND anonymous crawlers (stays indexable; it is where "Continue As Guest" lands).
Signed-in users see their own storefront untouched. There is no `middleware.ts`
in this repo -- the storefront server component is the sole guest-redirect
chokepoint.

`public/sw.js` was bumped to cache `v11` so returning `/research*` visitors
(including `/researchstore`, whose slug starts with "research") evict the
stale-while-revalidate HTML and pick up the change immediately. New / QR
visitors were already unaffected -- the home page and agent-store URLs are not
service-worker-intercepted.
