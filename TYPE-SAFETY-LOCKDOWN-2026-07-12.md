# Type Safety + Zod Contract Lockdown -- 2026-07-12

SENTINEL-Omega-TYPES sweep of pepnationlab.com. Six-agent audit swarm (ALPHA
frontend, BETA fetch contracts, GAMMA backend validation, DELTA shared
schemas, EPSILON database layer, ZETA business objects folded into
GAMMA/EPSILON coverage) followed by an implementation and verification pass.

## 1. Swarm Launch Confirmation

Six specialized agents swept the codebase in parallel (909k tokens, 212 tool
calls, 18 minutes). 72 deduplicated findings: 3 critical, 28 high, 29 medium,
12 low. All 3 criticals and every high on the money/auth priority paths are
fixed in this pass.

## 2. Type Safety Risk Map (Before)

Where invalid data could enter:

- POST /api/orders response parsed untyped; a drifted shape fabricated the
  manual-payment "Amount Due" from client math (CheckoutForm.tsx).
- Coupon UI sent `min_subtotal`; every route reads `min_order_amount` -- the
  minimum was silently dropped and coupons were redeemable on any order. The
  edit/toggle calls also used PUT against a PATCH-only route (405 on every
  coupon edit).
- PATCH /api/agent/products wrote `sale_price` raw; NaN passed every
  MAP/cost-floor guard (NaN comparisons are always false) into a column
  checkout pricing reads directly.
- PATCH/POST /api/admin/products validated only `base_cost`; every other
  money/inventory field was copied raw into the products table.
- POST /api/agent/super-agent/pricing accepted NaN baselines
  (`typeof NaN === 'number'`), silently corrupting sub-agent billing.
- POST /api/agent/orders/new: unbounded quantities, unvalidated
  paymentMethod/buyer/address fields.
- Password routes called `.length` on untyped values; a non-string JSON
  password bypassed both length bounds (storefront register, admin
  update-password).
- profiles.cart_state round-trip: write side hand-sanitized, read side
  adopted the JSONB blob under a blind `CartItem[]` annotation; by-name add
  and quick-add inserted untyped server items (with prices) into the cart.
- /api/auth/resolve `email` fed straight into signInWithPassword untyped;
  /api/storefront/register `username` interpolated into the internal auth
  email untyped.
- Coupon-validate and shipping-preview responses trusted blind (`Number(x)
  || 0` turned malformed rates into $0 shipping).
- Agent/admin money forms (store products, sub-agent pricing, tier override,
  manual order) type-erased with `as any` and unguarded Number()/parseFloat.
- Reconstitution calculator accepted negative vial mass via bare parseFloat.

## 3. Critical Findings (All Fixed)

1. CheckoutForm order-response trust (money) -- fixed with
   OrderCreateResponseSchema; on shape drift the buyer is sent to /orders
   for the authoritative total instead of being shown fabricated math.
2. Coupon min_subtotal/min_order_amount drift plus PUT-vs-PATCH mismatch
   (money) -- field renamed everywhere, method corrected, shared
   CouponInputSchema created; minimums now persist and display.
3. agent_products.sale_price NaN bypass (money) -- schema-locked PATCH body;
   MAP/cost-floor guards now run whenever a sale price is set and are
   written fail-closed (`!(x >= floor)`).

## 4. Implemented Shared Zod Schemas (lib/schemas/)

- common.ts -- money/quantity primitives (all `finite()`), shared
  ShippingAddressSchema, ApiErrorSchema envelope.
- payment.ts -- PaymentMethodEnum derived from lib/payment-method-labels.ts
  (label map and validator can no longer drift; varo added).
- cart.ts -- StoredCartItemSchema + sanitizeStoredCart used identically by
  the sync route (write), the sync GET (read), and the client restore;
  ResolvedCartItemSchema, CartRefreshItemSchema for the add paths.
- order.ts -- CheckoutSchema (single source shared by route and client),
  OrderCreateResponseSchema, ManualOrderInputSchema,
  ShippingPreviewResponseSchema.
- coupon.ts -- CouponInputSchema (percent 1-90, fixed 1-500 with
  minimum-order rules), CouponRowSchema, CouponValidateResponseSchema.
- product.ts -- AdminProductCreateSchema, AdminProductPatchSchema,
  AgentProductPatchSchema, SubAgentPricingSchema (all money fields
  finite + range-bounded, raw per-10-pack units documented).
- auth.ts -- PasswordSchema (string, 8-128), StorefrontRegisterSchema,
  ChangePasswordSchema, AdminUpdatePasswordSchema, AuthResolveResponseSchema.
- calculator.ts -- ReconstitutionInputSchema, DilutionSeriesInputSchema,
  parsePositiveNumber (fail-closed free-text numeric parsing).
- http.ts -- server-only parseJsonBody(request, schema) returning the
  platform-standard `{ error, details? }` 400 envelope.
- index.ts -- client-safe barrel.

lib/fetch-json.ts gained an optional `schema` option: 2xx bodies that fail
validation return `{ ok: false, error: 'Unexpected Server Response.' }`.

## 5. Code Changes

New: lib/schemas/* (10 files), __tests__/schemas.test.ts (27 tests).

Server routes: api/orders (shared CheckoutSchema), api/cart/sync (shared
sanitizer both directions), api/agent/products (schema + fail-closed sale
guards), api/admin/products (POST/PATCH schema-locked), api/agent/orders/new
(ManualOrderInputSchema), api/storefront/register (StorefrontRegisterSchema),
api/admin/agents/update-password (AdminUpdatePasswordSchema),
api/agent/super-agent/pricing (SubAgentPricingSchema).

Client: CheckoutForm (order/coupon/shipping responses schema-parsed),
CartContext (restore + resolve-name + quick-add validated), AgentCoupons
(field + method drift fixed, PATCH sends only changed fields),
AgentStoreProducts (typed EditFormState, `as any` removed from all money
paths, fail-closed guards, schema-validated payload), AgentSubAgents
(pricing payload schema-validated -- NaN no longer clears bulk baselines),
AdminTierOverrideControl (markup range guard), AgentManualOrder (shipping
clamp mirrors server), ReconstitutionCalculator (parsePositiveNumber --
negative mass rejected), login + AgentStorefrontLogin (resolve response
schema), signup (username schema before auth-email interpolation),
payment-method-labels (varo + tuple typing for z.enum).

Concurrent-work note: another session modified CheckoutForm, CartContext,
AgentCoupons, login, signup, and payment-method-labels on this machine while
the sweep ran (idempotency-key persistence, fetchJson adoption, a11y pass,
varo labels). All changes here were three-way merged onto those newer
versions -- nothing was overwritten.

## 6. Type Safety Improvements Summary

- Every priority-path mutation route now zod-validates its body; money
  fields reject NaN/Infinity/strings/negatives at the boundary.
- Request AND response of order creation are contract-locked on both sides
  from one schema module.
- One cart-line contract shared by write, read, restore, and add paths.
- Passwords are schema-typed strings everywhere they are accepted.
- Fail-closed comparison style (`!(x >= floor)`) on money guards.
- 27 new regression tests lock the fail-closed behavior.

## 7. Final Type Safety Score

Before: 5.5/10 -- strong checkout core, but drift-prone hand-rolled
validation, ~70% of body-consuming routes without schema validation, blind
response trust on money paths, NaN-permeable guards.

After: 8/10 -- all critical and high money/auth boundaries schema-locked
with a single-source shared schema layer, verified by typecheck, 222 unit
tests, and a clean production build.

## 8. Remaining Type Risks (Honest Tail)

- ~200 body-consuming routes outside the priority paths still validate
  ad hoc; migrate them to parseJsonBody incrementally.
- No generated Supabase Database type: `.from()` results are still untyped
  at compile time (biggest remaining lever -- run
  `supabase gen types typescript` and thread the Database generic through
  lib/supabase/*).
- RPC signatures (deduct_prepaid_balance et al.) have no compile-time
  contract; drift there remains a live hazard.
- The tenths-vs-dollars price-unit split (retail_price / 10) is documented
  in the schemas but not yet a branded type; call sites can still divide
  twice or not at all.
- orders.shipping_address JSONB has residual shape variants across three
  UI surfaces (ShippingAddressSchema exists; adoption incomplete).
- The coupon PATCH route intentionally does not accept
  code/discount_type/discount_value changes, but the edit UI still offers
  them; alignment is a product decision.
- Admin order status mutations and the long-tail admin routes were audited
  but not all remediated in this pass.

## Verification

- npx tsc --noEmit: 0 errors (the only failures are in map_body.tsx, a
  pre-existing scratch fragment at the repo root, untouched by this work).
- npm test: 222/222 passing (195 pre-existing + 27 new schema tests).
- npm run build (production, Next.js 16.2.6): compiled successfully.
