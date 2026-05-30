# PepNationLab Shippo Integration — Build Plan

**Date:** 2026-05-29
**Repo HEAD reviewed:** `95597d1`
**Method:** Three parallel deep-dive analysts: current code audit, Shippo API capabilities research, multi-tenant architecture design.
**Strategy (user direction):** Admin connects Shippo first. Every order ships under the platform account by default. Agents get the storefront with no Shippo setup required. Agent BYO Shippo is a Milestone 2 opt-in.

This document is the complete plan. Every file to create, every migration, every endpoint, every UI screen, every failure mode, every cost-recoupment path. Use it as the spec for the build.

---

# 1. CURRENT STATE — What exists today

## 1.1 Code surfaces (3 Shippo SDK calls in total)

| File | LOC | What it does |
|---|---|---|
| `lib/shippo.ts` | 194 | `purchaseLabelForOrder(supabase, {orderId, agentId, preferredServiceLevel})` — synchronous shipment + transaction. Cheapest rate. Updates `orders.tracking_number`, `label_url`, `status='shipped'` directly. |
| `lib/shippo-returns.ts` | 221 | `purchaseReturnLabel(supabase, {rmaId, agentId})` — mirrors the outbound helper with from/to swapped and `extra: { isReturn: true }`. |
| `app/api/agent/shipping/purchase/route.ts` | 159 | Per-order label-purchase button handler — duplicates `lib/shippo.ts` logic (the helper was added later for bulk admin use; this route was never refactored). No CSRF. |
| `app/api/agent/storefront-config/shippo-key/route.ts` | 29 | GET returns the unmasked Shippo key to the agent dashboard. POST/PATCH path is the client writing `agent_profiles.shippo_api_key` direct via supabase-js. |
| `app/api/agent/storefront-config/shippo-key/rotate/route.ts` | 35 | POST clears the key, writes `admin_audit_log` row. Has CSRF. |
| `app/api/agent/rma/[id]/return-label/route.ts` | — | Calls `purchaseReturnLabel`. |
| `app/api/admin/orders/bulk/route.ts` | — | `action='generate_labels'` runs `purchaseLabelForOrder` in a serial loop using each order's agent's key. |
| `app/api/shipping/orders/route.ts` | 114 | Shipping-role page POST. Pure manual: `save_tracking`, `mark_shipped`. No Shippo. No CSRF. No `canTransition`. No scope. |
| `app/api/shipping-preview/route.ts` | 41 | Checkout-time cost preview. Reads `shipping_rates` weight brackets. Never calls Shippo. Hardcoded $12 fallback on error. |
| `app/shipping/page.tsx` + `layout.tsx` | ~412 | Shipping-role "Fulfillment Center". Paste-tracking workflow. Emoji throughout (CLAUDE.md violation). |

That is the entirety of the integration. Three SDK methods (`shipments.create`, `transactions.create`, `transactions.create` again for returns). No address validation, no webhooks, no refunds, no manifests, no pickups, no batches, no carrier accounts, no insurance, no signature confirmation.

## 1.2 DB schema today

| Column | Type | Note |
|---|---|---|
| `agent_profiles.shippo_api_key` | TEXT NULLABLE | **Plaintext**. No encryption. RLS gates owner+admin read but Supabase service-role bypass exposes everything. |
| `agent_profiles.warehouse_address` | JSONB NULLABLE | One warehouse per agent. No `country/phone/email/company/is_residential`. No address book. |
| `orders.tracking_number` | TEXT | No carrier, no service level. |
| `orders.label_url` | TEXT | Raw Shippo CDN URL. Not cached in Supabase Storage. Expires. |
| `orders.shipping_cost` | NUMERIC | **The quote**, not actual Shippo billing. |
| `orders.shipping_address` | JSONB | Two competing shapes (`zip`/`zipCode`, `street`/`street1`). |
| `rma_requests.return_label_url / return_tracking_number / return_label_purchased_at` | — | Same pattern as orders. |
| `shipping_rates` | seeded 5 rows | $8–$28 weight brackets. **No admin UI to edit**. |

**Missing entirely:** `platform_shippo_credentials`, `shipping_origins`, `shipping_label_purchases` (audit), `label_jobs` (queue), `shipping_tracking_events`, `shipping_webhook_deliveries`, `shipping_manifests`, `shipping_batches`, `shippo_carrier_accounts`, `parcel_templates`.

## 1.3 UI surfaces today

- **Admin**: ZERO Shippo surface. No `/admin/shipping*`. No `/admin/settings/shipping`. Cannot connect Shippo. Cannot edit `shipping_rates`. Cannot see balance, manifests, tracking, or webhook log.
- **Agent**: Storefront Config tab has Shippo key field + warehouse address (one). Orders tab has per-row "Buy USPS Label (Shippo)" button. No bulk, no service-level pick, no refund.
- **Shipping role**: Manual tracking paste. Cannot purchase labels at all.
- **Researcher**: Sees `label_url` on order detail (privacy concern — that's the shipper's document). No tracking timeline.

## 1.4 Bugs in the existing Shippo code (12 confirmed)

1. **Hardcoded `noreply@pepnationlab.com`** in `lib/shippo.ts:119,128`, `lib/shippo-returns.ts:147,157`, `agent/shipping/purchase/route.ts:78–79`. Shippo emails the buyer about delivery; this domain doesn't even have outbound mail.
2. **Address shape coalescing** (`street||street1`, `zipCode||zip`) at `lib/shippo.ts:77–80` — two checkout shapes accepted, neither normalized at write time.
3. **`country: addr.country || 'US'`** at line 81 forces US even for Canadian buyers.
4. **Parcel dim guess by item count** (lines 104–106): 1–3 = `6x4x4`, 4–10 = `9x6x3`, >10 = `12x9x4`. Dimensional weight wrong above 1 lb.
5. **Parcel weight default 0.5 oz when `weight_oz` is null** (line 97). Null products silently fall to ~6 oz parcels regardless of actual content.
6. **Cheapest-rate-always picks regional sub-carriers** (Hermes Lite, UDS) — no `provider IN ('USPS','UPS','FedEx','DHL')` filter.
7. **No idempotency** — `Shippo-Idempotency-Key` header missing. Re-click double-buys.
8. **State-machine bypass** — `lib/shippo.ts:183` writes `status='shipped'` direct, no `canTransition()`.
9. **`async: false` blocks 5–15 s** — Vercel 60-s timeout cliff on any Shippo slowness.
10. **Inventory NOT deducted at label purchase** — only at order approval. Label purchase implies fulfillment but doesn't touch `agent_inventory`.
11. **Error leakage** — `err?.message` interpolated direct at lines 145, 167, 175, 193 (returns helper).
12. **Bulk admin loop is serial** — `app/api/admin/orders/bulk/route.ts:160` does N × ~3s synchronous calls. 50 labels = 2.5 min wall clock. Vercel kills it.

---

# 2. SHIPPO API — What's available, what we'll use

## 2.1 Authentication model — choose Platform Account

Shippo offers three multi-tenant models:

| Model | How | Right for us? |
|---|---|---|
| **Direct** (current) | One Shippo account per agent. Each agent stores their own `shippo_api_key`. | **NO** — what we have today. Brittle, no aggregation, no admin visibility. |
| **OAuth gray-label** | Each agent signs up with Shippo, OAuth grants PepNationLab a bearer token. Shippo bills agent. | **NO for M1** — requires Shippo to provision client_id/client_secret. Heavy setup. |
| **Platform Account (white-label)** | PepNationLab owns one master account. Each agent has a **Managed Shippo Account** (headless, no agent login). Every API call sets header `SHIPPO-ACCOUNT-ID: <managed_id>`. Shippo bills PepNationLab. We bill agents weekly. | **YES** — matches our model exactly. Carrier requirements for marketplaces (USPS Stamps.com, UPS, Canada Post) actually mandate this. |

**Decision:** Migrate to Platform Account in M1. Drop per-agent API keys. Single `SHIPPO_PLATFORM_TOKEN` lives in Vercel env. Each agent has `shippo_managed_account_id TEXT` in `agent_profiles`.

**Action item (do before code starts):** Contact Shippo sales (`platform@goshippo.com` or via dashboard) to enable Platform Account on our org. Confirm pricing model (per-label fee, monthly minimum). Get Webhook HMAC secret provisioned (10-business-day setup).

Reference: <https://docs.goshippo.com/docs/PlatformAccounts/platform_accounts.md>

## 2.2 Address validation

- `POST /addresses?validate=true` returns `validation_results.{is_valid, messages[], is_residential}`.
- US free. Non-US billed on live keys (test mode never charges).
- Hard-fail on `is_valid=false` and surface the suggested cleaned address.

## 2.3 Rates

- `POST /shipments` → `rates[]` with `provider`, `servicelevel.{token,name}`, `amount`, `estimated_days`, `arrives_by`, `attributes: ['CHEAPEST','BESTVALUE',...]`.
- Free.
- Rate objects valid ~7 days; persist `rate_id` on the order so quote → purchase later works.

## 2.4 Labels

- `POST /transactions` with `rate: <rate_id>` and `label_file_type: 'PDF_4x6' | 'PDF' | 'PNG' | 'ZPL_203'`.
- Returns `tracking_number, label_url, commercial_invoice_url, qr_code_url, object_id`.
- **No native Idempotency-Key header.** Best practice: persist `(shipment_id, rate_id)` and reject re-POST.

## 2.5 Tracking + webhooks

- Webhook events: `track_updated`, `transaction_created/updated`, `batch_created/purchased`.
- Signature: `Shippo-Auth-Signature: t=<ts>,v1=<sha256_hex>` HMAC-SHA256 over `${ts}.${body}`.
- Status enum: `PRE_TRANSIT → TRANSIT → DELIVERED | RETURNED | FAILURE | UNKNOWN`. Substatus codes for finer.
- **Not idempotent — handle duplicates.** Reply 2xx in ≤ 3 s.

## 2.6 Refunds

- `POST /refunds` with `transaction=<id>`. Status: `QUEUED → PENDING → SUCCESS | ERROR`. Up to **14 business days** to resolve.
- Time window: **90 days from purchase**. USPS labels must be used within 30 days.
- Negative line on next Shippo invoice.

## 2.7 Batches

- `POST /batches` for bulk-label PDF generation. Async — `VALIDATING → VALID|INVALID → PURCHASING → PURCHASED`.
- Up to 10,000 labels per batch.
- **Test mode does NOT support batches.**

## 2.8 Manifests + pickups

- `POST /manifests` for USPS SCAN form (optional but recommended for daily volume).
- `POST /pickups` for USPS daily pickup (one per warehouse per day).

## 2.9 Carrier accounts

- `POST /carrier_accounts/register/new` for Shippo-managed (USPS via Stamps.com — default, free).
- `POST /carrier_accounts` for customer-owned (UPS/FedEx negotiated rates).
- Future: tier-1 super-agents bring their own UPS account in M2/M3.

## 2.10 Rate limits

| Endpoint | Live | Test |
|---|---|---|
| Address/Shipment/Transaction/Refund/Manifest POST | 500/min | 50/min |
| GET single | 4000/min | 400/min |
| GET list | 50/min | 10/min |
| Batch | 50/min POST | 10/min |
| Tracking | 750/min POST | 50/min |

Wrap with exponential backoff on 429/5xx. Fail fast on 4xx.

---

# 3. TARGET ARCHITECTURE

## 3.1 Diagram

```
+------------------------------------------------------------------+
|                PepNationLab on Vercel                             |
|                                                                   |
|  Researcher        Agent              Admin           Shipping    |
|      |               |                  |                 |       |
|      v               v                  v                 v       |
|  /checkout    /dashboard/agent   /admin/settings    /shipping/    |
|  (live rate)  (order approve)    /shipping           queue        |
|      |               |                  |                 |       |
|      v               v                  v                 v       |
|  /api/shipping   /api/agent/      /api/admin/       /api/shipping |
|  /quote          orders/[id]/     shippo/           /orders       |
|                  approve          connect|test|     (mark         |
|                       |           rotate            shipped)      |
|                       v                                  |        |
|              label_jobs (queue)                          |        |
|                       |                                  |        |
|                       v                                  |        |
|        /api/cron/process-labels (every 60s)              |        |
|                       |                                  |        |
|                       v                                  v        |
|  +-------------------------------------------------------------+  |
|  |    lib/shippo.ts (refactored, with key resolver)             | |
|  |    getActiveKey(agent_id):                                   | |
|  |      1. agent_profiles.shippo_account_mode == 'byo'          | |
|  |         -> agent_shippo_credentials                          | |
|  |      2. else -> platform_shippo_credentials (active row)     | |
|  +-------------------------------------------------------------+  |
|                          |                                        |
+--------------------------|-----------------------------------------+
                           |
                           v
                  +------------------+
                  |    Shippo API    |
                  | rates / labels   |
                  | refunds / etc.   |
                  +------------------+
                           |
                tracking webhooks
                           |
                           v
         /api/webhooks/shippo (HMAC verified, dedupe)
                           |
                           v
       shipping_webhook_deliveries -> process-webhooks cron
                           |
                           v
       orders.status updates + buyer push/in-app
```

## 3.2 Three milestones

| Milestone | Goal | When done |
|---|---|---|
| **M1 — Admin-first platform Shippo** | Admin connects Shippo. Every order ships under platform account. Agent does nothing. Cost passes through to agent via weekly statement or prepaid debit. | All current `shippo_api_key` agents migrated. Address validation in checkout. Live rates in checkout. Webhook receiver live. RMA labels on platform account. Manual mode kill-switch wired. |
| **M2 — Agent BYO Shippo** | Tier-1 super-agents who have negotiated Shippo pricing connect their own key. Statement skips labels for those orders. | Per-agent connect UI. Encrypted at-rest. Auto-fallback to platform on key invalid. |
| **M3 — Full automation** | Tracking webhooks auto-advance status. Buyer push notifications. Automatic RMA labels. Batch print. Manifest close-out. Insurance + signature defaults. | End-of-day SCAN forms. Multi-warehouse support. Stuck-shipment alerts. |

---

# 4. MILESTONE 1 — DETAILED BUILD PLAN

## 4.1 Database — single migration `20260601000001_shippo_platform.sql`

```sql
-- =========================================================================
-- Platform-level Shippo credentials (single active row, admin-managed)
-- =========================================================================
CREATE TABLE public.platform_shippo_credentials (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode                  TEXT NOT NULL CHECK (mode IN ('test','live')),
  api_key_ciphertext    BYTEA NOT NULL,
  api_key_iv            BYTEA NOT NULL,
  api_key_tag           BYTEA NOT NULL,
  api_key_last4         TEXT  NOT NULL,
  webhook_secret_ciphertext BYTEA,
  webhook_secret_iv     BYTEA,
  webhook_secret_tag    BYTEA,
  is_active             BOOLEAN NOT NULL DEFAULT false,
  connected_by          UUID REFERENCES public.profiles(id),
  connected_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_validated_at     TIMESTAMPTZ,
  last_validation_error TEXT,
  rotated_from          UUID REFERENCES public.platform_shippo_credentials(id)
);
CREATE UNIQUE INDEX one_active_platform_shippo
  ON public.platform_shippo_credentials (is_active) WHERE is_active = true;

ALTER TABLE public.platform_shippo_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin only" ON public.platform_shippo_credentials FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =========================================================================
-- Master warehouse + address book
-- =========================================================================
CREATE TABLE public.shipping_origins (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label             TEXT NOT NULL,
  name              TEXT NOT NULL,
  company           TEXT,
  street1           TEXT NOT NULL,
  street2           TEXT,
  city              TEXT NOT NULL,
  state             TEXT NOT NULL,
  zip               TEXT NOT NULL,
  country           TEXT NOT NULL DEFAULT 'US',
  phone             TEXT NOT NULL,
  email             TEXT NOT NULL,
  is_default        BOOLEAN NOT NULL DEFAULT false,
  shippo_address_id TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_default_origin
  ON public.shipping_origins (is_default) WHERE is_default = true;
ALTER TABLE public.shipping_origins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin only" ON public.shipping_origins FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =========================================================================
-- Per-label audit (system of record)
-- =========================================================================
CREATE TABLE public.shipping_label_purchases (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  agent_id              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  origin_id             UUID NOT NULL REFERENCES public.shipping_origins(id),
  shippo_transaction_id TEXT NOT NULL UNIQUE,
  shippo_rate_id        TEXT,
  shippo_shipment_id    TEXT,
  carrier               TEXT NOT NULL,
  service_level         TEXT NOT NULL,
  tracking_number       TEXT NOT NULL,
  tracking_url_provider TEXT,
  label_url             TEXT NOT NULL,
  label_file_type       TEXT NOT NULL DEFAULT 'PDF_4x6',
  label_cost_cents      INTEGER NOT NULL CHECK (label_cost_cents >= 0),
  agent_charged_cents   INTEGER NOT NULL CHECK (agent_charged_cents >= 0),
  parcel_weight_oz      NUMERIC(8,2) NOT NULL CHECK (parcel_weight_oz > 0),
  parcel_template       TEXT,
  paid_by               TEXT NOT NULL CHECK (paid_by IN ('platform','agent_byo')),
  refunded              BOOLEAN NOT NULL DEFAULT false,
  refunded_at           TIMESTAMPTZ,
  refund_cents          INTEGER,
  shippo_refund_id      TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_label_purchases_order ON public.shipping_label_purchases(order_id);
CREATE INDEX idx_label_purchases_agent_time ON public.shipping_label_purchases(agent_id, created_at DESC);
CREATE INDEX idx_label_purchases_tracking ON public.shipping_label_purchases(tracking_number);
ALTER TABLE public.shipping_label_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner agent + admin + shipping" ON public.shipping_label_purchases FOR SELECT USING (
  agent_id = (SELECT auth.uid())
  OR public.is_admin()
  OR public.get_user_role() = 'shipping'
);
CREATE POLICY "no update" ON public.shipping_label_purchases FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "no delete" ON public.shipping_label_purchases FOR DELETE USING (false);

-- =========================================================================
-- Label-purchase job queue
-- =========================================================================
CREATE TABLE public.label_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued','processing','succeeded','failed','dead')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);
CREATE UNIQUE INDEX one_active_job_per_order ON public.label_jobs(order_id)
  WHERE status NOT IN ('succeeded','dead');
CREATE INDEX idx_label_jobs_next_attempt ON public.label_jobs(next_attempt_at)
  WHERE status IN ('queued','processing');

-- =========================================================================
-- Tracking event log
-- =========================================================================
CREATE TABLE public.shipping_tracking_events (
  id              BIGSERIAL PRIMARY KEY,
  order_id        UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  tracking_number TEXT NOT NULL,
  status          TEXT NOT NULL,
  substatus       TEXT,
  status_details  TEXT,
  location        JSONB,
  occurred_at     TIMESTAMPTZ NOT NULL,
  raw_payload     JSONB NOT NULL,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tracking_events_order ON public.shipping_tracking_events(order_id, occurred_at DESC);
ALTER TABLE public.shipping_tracking_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "buyer + agent + admin" ON public.shipping_tracking_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders o
    WHERE o.id = order_id
      AND (o.buyer_id = (SELECT auth.uid()) OR o.agent_id = (SELECT auth.uid()) OR public.is_admin()))
);

-- =========================================================================
-- Webhook deliveries (idempotency + dead-letter)
-- =========================================================================
CREATE TABLE public.shipping_webhook_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shippo_event_id TEXT UNIQUE,
  event_type      TEXT NOT NULL,
  signature_valid BOOLEAN NOT NULL,
  processed       BOOLEAN NOT NULL DEFAULT false,
  dead_lettered   BOOLEAN NOT NULL DEFAULT false,
  error_message   TEXT,
  payload         JSONB NOT NULL,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at    TIMESTAMPTZ
);
CREATE INDEX idx_webhook_unprocessed ON public.shipping_webhook_deliveries(received_at)
  WHERE NOT processed AND NOT dead_lettered;
ALTER TABLE public.shipping_webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin only" ON public.shipping_webhook_deliveries FOR SELECT USING (public.is_admin());

-- =========================================================================
-- Orders: shipping bookkeeping
-- =========================================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS label_cost_cents     INTEGER CHECK (label_cost_cents IS NULL OR label_cost_cents >= 0),
  ADD COLUMN IF NOT EXISTS agent_charged_cents  INTEGER CHECK (agent_charged_cents IS NULL OR agent_charged_cents >= 0),
  ADD COLUMN IF NOT EXISTS carrier              TEXT,
  ADD COLUMN IF NOT EXISTS service_level        TEXT,
  ADD COLUMN IF NOT EXISTS delivery_eta         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipped_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipping_paid_by     TEXT DEFAULT 'platform'
                                                CHECK (shipping_paid_by IN ('platform','agent_byo'));

-- =========================================================================
-- Agent profile: platform vs BYO mode + managed account id
-- =========================================================================
ALTER TABLE public.agent_profiles
  ADD COLUMN IF NOT EXISTS shippo_account_mode    TEXT NOT NULL DEFAULT 'platform'
                                                  CHECK (shippo_account_mode IN ('platform','byo')),
  ADD COLUMN IF NOT EXISTS shippo_managed_account_id TEXT,
  ADD COLUMN IF NOT EXISTS warehouse_origin_id    UUID REFERENCES public.shipping_origins(id);

CREATE TABLE IF NOT EXISTS public.legacy_agent_shippo_keys (
  agent_id    UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  api_key     TEXT NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

A separate one-shot data migration in app code copies `agent_profiles.shippo_api_key` rows into `legacy_agent_shippo_keys` before the column is dropped at the end of M1.

## 4.2 New environment variables (Vercel)

| Var | Used by | Notes |
|---|---|---|
| `SHIPPO_PLATFORM_TOKEN` | server only | One platform-account token. Live prefix `shippo_live_`. Validate on boot. |
| `SHIPPO_WEBHOOK_SECRET` | server only | HMAC verifier secret from Shippo. Required for webhooks; falls back to URL-token mode otherwise. |
| `SHIPPO_ENCRYPTION_KEY` | server only | 32-byte base64 — AES-256-GCM key for at-rest encryption of API tokens. |
| `SHIPPO_TEST_TOKEN` | preview env | Test mode token for Vercel previews. |
| `NEXT_PUBLIC_SHIPPO_MODE` | client | `'live'` or `'test'` for UI badge. |

## 4.3 New libraries

### `lib/shippo-crypto.ts` (~80 LOC)
- `encrypt(plaintext): {ciphertext, iv, tag}` — AES-256-GCM.
- `decrypt(ciphertext, iv, tag): plaintext`.
- Tamper detection via auth tag.

### `lib/shippo.ts` (rewrite, ~400 LOC)
- Drop `purchaseLabelForOrder` direct-update path. Replace with:
  - `getActiveKey(agentId): Promise<{token, accountScope?: string, mode: 'test'|'live'}>` — resolves platform vs BYO.
  - `validateAddress(addr): Promise<ValidationResult>` — wraps `POST /addresses?validate=true`.
  - `quoteRates(shipmentInput): Promise<RatesQuote>` — wraps `POST /shipments`. Returns sorted, filtered rates.
  - `buyLabel({rateId, shipmentId, orderId, agentId}): Promise<LabelPurchase>` — wraps `POST /transactions`. Idempotent: if `shipping_label_purchases.shippo_transaction_id` already exists for `(order_id)`, return it.
  - `refundLabel(transactionId): Promise<RefundResult>` — wraps `POST /refunds`.
  - `subscribeTracking(trackingNumber, carrier): Promise<void>` — wraps `POST /tracks/{carrier}/{tracking}`.
  - `getTracking(trackingNumber, carrier): Promise<TrackingState>`.
  - Internal `callShippo(method, path, body, scope?)` with retry/backoff + Sentry capture.

### `lib/shippo-returns.ts` (refactor, ~200 LOC)
- Move to `lib/shippo.ts:buyReturnLabel(rmaId)` so we share the resolver and audit row writer.

## 4.4 New API routes

| Route | Method | Gate | LOC | Notes |
|---|---|---|---|---|
| `/api/admin/shippo/connect` | POST | requireAdmin + MFA + CSRF | ~80 | Body: `{api_key, mode, webhook_secret?}`. Validate with `POST /addresses` (cheap), encrypt, insert, set active. Audit-log. |
| `/api/admin/shippo/test` | POST | requireAdmin + CSRF | ~40 | Body: `{address}`. Runs `validateAddress`. Returns result. |
| `/api/admin/shippo/rotate` | POST | requireAdmin + MFA + CSRF | ~70 | Atomic: deactivate old, insert new, set active. Audit-log. |
| `/api/admin/shippo/disconnect` | DELETE | requireAdmin + MFA + CSRF | ~40 | Sets `is_active=false`. Audit-log. Triggers admin-banner "Manual Mode". |
| `/api/admin/shippo/status` | GET | requireAdmin | ~30 | Returns `{connected, mode, last4, last_validated_at, balance}`. |
| `/api/admin/shipping-origins` | GET/POST | requireAdmin + CSRF | ~120 | List + create. Validates against Shippo on save. |
| `/api/admin/shipping-origins/[id]` | PATCH/DELETE | requireAdmin + CSRF | ~80 | Edit, mark default, soft-delete. |
| `/api/admin/shipping-rates` | GET/PATCH | requireAdmin + CSRF | ~70 | Edit the static `shipping_rates` fallback weight brackets (kept for degraded mode). |
| `/api/shipping/quote` | POST | researcher session + rate limit (60/min) | ~150 | Body: `{shipping_address, items}`. Calls `quoteRates` for the selected agent's origin. Returns top 3 rates. Falls back to `shipping_rates` brackets on Shippo down. |
| `/api/shipping/validate-address` | POST | researcher session + rate limit (60/min) | ~50 | Calls `validateAddress`. Returns `{is_valid, messages[], suggestion?}`. |
| `/api/shipping/labels/[id]/refund` | POST | requireAdmin OR shipping role + CSRF | ~80 | Calls `refundLabel`. Writes negative `balance_transactions` row. Marks `refunded=true`. |
| `/api/shipping/labels/[id]/reprint` | GET | gate by order ownership | ~40 | Re-fetches `label_url` via `GET /transactions/{id}` (Shippo URLs can expire). |
| `/api/cron/process-labels` | GET | assertCronAuth + claimCronRun | ~280 | Every 60s. Drain `label_jobs WHERE status='queued' AND next_attempt_at <= now()`. Exp backoff. Max 6 attempts. Dead-letter to admin in-app message. |
| `/api/webhooks/shippo` | POST | HMAC verify | ~200 | Verify signature, dedupe on `event_id`, insert into `shipping_webhook_deliveries`, return 200 in < 3 s. |
| `/api/cron/process-shipping-webhooks` | GET | assertCronAuth | ~180 | Every 30s. Drain unprocessed webhook rows. Update orders, emit buyer push + in-app. |
| `/api/cron/refresh-label-urls` | GET | assertCronAuth | ~60 | Weekly. Refresh any label URL > 60 days old (cache fresh PDF in Supabase Storage). |

Edit existing:
| Route | Change | LOC |
|---|---|---|
| `app/api/agent/orders/[id]/approve` (or `agent/orders/approve`) | After approval, INSERT `label_jobs` row idempotently. | ~30 |
| `app/api/agent/shipping/purchase/route.ts` | Replace direct Shippo call with `enqueueLabelJob(order_id)`. | ~40 |
| `app/api/admin/orders/bulk/route.ts` | `generate_labels` action posts to `label_jobs` in bulk, returns job IDs to poll. | ~50 |
| `app/api/shipping/orders/route.ts` | After `mark_shipped`, write `admin_audit_log` row with `actor_role='shipping'`. Add `assertSameOrigin`. Add `canTransition` guard. | ~30 |
| `lib/order-states.ts` | Add `label_printed` state if not present. | ~10 |

## 4.5 New UI screens

### Admin → Settings → Shipping (`/admin/settings/shipping`)

**1. Shippo Account**
- Disconnected: single "Connect Shippo" CTA with helper text linking to Shippo dashboard token-generation.
- Connect modal: paste `shippo_live_xxxx` or `shippo_test_xxxx`. Mode auto-detected from prefix. Webhook secret optional (can be added later via Rotate). Submit triggers MFA challenge.
- Connected: mode pill (LIVE green / TEST orange), `sk_..a7c2`, "Last Validated 2 minutes ago", buttons `Test`, `Rotate`, `Disconnect`.

**2. Warehouse Origins**
- Table: Label, Address, Default badge.
- "Add Origin" modal posts to `/api/admin/shipping-origins`. Validates via Shippo on submit (shows correction if needed).

**3. Shipping Defaults**
- Default service level dropdown (USPS Ground Advantage, USPS Priority Mail, USPS Priority Mail Express).
- Default carrier allowlist checkboxes (USPS, UPS, FedEx, DHL).
- Default label format (`PDF_4x6` for thermal printers, `PDF` letter-size).
- Default parcel template selector (small/medium/large with weight defaults).
- Insurance threshold (orders above auto-insure).
- Signature required threshold (orders above require ADULT signature).

**4. Rate Cards**
- Per-agent markup percentage (0–25%, default 0%).
- Max label cost guardrail in cents (alerts if Shippo quote exceeds).

**5. Webhook Status**
- Last received event timestamp.
- Last 10 events (type, status, processed).
- Link to dead-letter queue.

**6. Reconciliation**
- This-week's label cost summary (sum from `shipping_label_purchases`).
- Variance against `orders.shipping_cost` (quoted) — alerts on >5% drift.

### Admin → Orders (existing, edit)
- Add "Print Labels (Batch)" button. Calls `/api/admin/orders/bulk` with `action: 'generate_labels'`. Returns job IDs. UI shows toast "Buying 47 labels..." with poll.

### Agent → Storefront → Shipping (read-only banner)
> "Powered by PepNationLab Shipping. Labels are purchased centrally and billed to your weekly statement."

### Shipping role → Orders queue (`/shipping/queue`, replace `/shipping/page.tsx`)
- Scoped to `status IN ('approved_ship','in_fulfillment')`.
- Per-row actions: Print Label, Mark Shipped, Refund Label, Reprint.
- Bulk: multi-select → "Print N Labels" generates PDF via batch or sequence.
- Each action audit-logged with `actor_role='shipping'`.
- Remove emoji. Title Case everything.

### Researcher → checkout (`/checkout`)
- Address validation runs on field blur. Inline error or "Did you mean ...?" suggestion.
- Shipping cost is the live Shippo rate for the agent's origin → buyer's address.
- "Delivery estimate: 3–5 business days via USPS Ground Advantage" line.
- Fallback graceful: if Shippo down at quote, show static rate from `shipping_rates` brackets + "Estimated shipping. Final cost may adjust."

### Researcher → order detail (`/orders/[id]`)
- Tracking timeline from `shipping_tracking_events`.
- Tracking number is a link to carrier's tracking URL.
- "Expected delivery: 2026-06-04" badge.
- **Remove `label_url`** from researcher-visible response — that's the shipper's document.

## 4.6 Cost accounting model

**Decision: debit `prepaid_balance` at label purchase for prepaid agents; defer to weekly statement for credit agents.**

Flow inside `process-labels`:

1. Resolve key → call Shippo → label purchased. `label_cost_cents = 487`, `tracking_number`, etc.
2. Compute `agent_charged_cents = round(label_cost_cents * (1 + markup_pct))`. Markup defaults to 0% (pass-through).
3. Insert `shipping_label_purchases` row inside a transaction.
4. Branch by agent's `account_type`:
   - **prepaid**: call SECURITY DEFINER RPC `deduct_prepaid_balance(agent_id, agent_charged_cents, order_id, 'Shipping label')`. Writes `balance_transactions` atomically.
   - **credit**: do nothing now. Update `lib/statements.ts` to sum `shipping_label_purchases.agent_charged_cents` for the week in the next weekly statement.
5. Update `orders.label_cost_cents`, `agent_charged_cents`, `tracking_number`, `label_url` (display copy), `shipping_paid_by='platform'`, `shipped_at=now()`, `status='approved_ship'` → `'shipped'` via `canTransition()`.
6. Subscribe Shippo tracking webhook for that tracking number.
7. Emit `enqueueWebhook('order.shipped')` + `enqueueOrderPush({event:'order_shipped'})`.

**Refunds:** when a label is voided within 90 days, write a negative `balance_transactions` row (or credit to next statement), flip `refunded=true` on the purchase row.

## 4.7 Failure modes — handling matrix

| Scenario | Detection | Behavior | Audit |
|---|---|---|---|
| Shippo 5xx during quote | HTTP 5xx in `quoteRates` | Fall back to `shipping_rates` weight brackets. Show "Showing standard rates" badge. | `shippo.degraded` log |
| Shippo down during buy | Network/5xx in `buyLabel` | `label_jobs` retries with exp backoff (5min × 2^n, max 6 attempts). | Per-attempt error |
| Max attempts exceeded | `attempts >= 6` | Job → `dead`. Admin in-app message. Order stays `approved_ship`; shipping role can manual-mode. | `label_job.dead_letter` |
| Invalid platform key | Shippo 401 | Auto-disconnect, admin banner, all jobs paused. | `shippo.key_invalid` |
| Address rejected | `is_valid=false` at checkout | Block submit. Show suggested cleaned address. | `shippo.address_rejected` |
| Weight exceeds carrier max | Pre-flight check on parcel | Auto-split into multi-parcel (M3); for M1 fail-soft with admin alert. | `shippo.weight_exceeded` |
| Prohibited content (peptides flagged by SmartPost) | Rate quote excludes service | Skip flagged service; next-cheapest non-flagged auto-selected. | `shippo.service_filtered` |
| Refund window expired | Shippo 400 on `POST /refunds` | "This label is past the 90-day refund window." Manual write-off by admin. | `shippo.refund_denied` |
| Carrier declined at purchase | Shippo `messages` array with `error` | Auto-retry with next service in fallback list. After all exhausted, fail job. | `shippo.carrier_declined` |
| Webhook signature invalid | HMAC mismatch | Reply 401. Still record row with `signature_valid=false` for forensics. Admin alert if > 10 in 10min. | `shippo.webhook_bad_sig` |
| Webhook for unknown order | `tracking_number` not in `shipping_label_purchases` | Dead-letter. Admin weekly digest. | `shippo.orphan_webhook` |
| Duplicate webhook delivery | `event_id` UNIQUE conflict | Idempotent — skip. | none |

## 4.8 Security

- **Encryption at rest**: every API token stored as `ciphertext + iv + tag` via `lib/shippo-crypto.ts`. Plaintext never touches DB or logs.
- **Read access**: only `process-labels` cron + admin write routes call `decrypt`. Plaintext key is held in a request-scoped variable, never returned to any client.
- **Rotation**: `POST /admin/shippo/rotate` keeps the old row (`is_active=false`, `rotated_from` set). Never delete — forensic trail.
- **MFA**: connect/rotate/disconnect require `assertMfaRecent(req, maxAge=5m)` helper (add to `lib/admin-auth.ts`).
- **CSRF**: every state-changing endpoint uses `assertSameOrigin`.
- **Audit logging**: every Shippo call writes `admin_audit_log` row (connect, test, rotate, disconnect, purchase, refund, void, webhook-received-with-bad-sig). `actor_role` captured so shipping role mutations are distinguishable.
- **Service-role isolation**: webhook receiver writes via service role but only to `shipping_webhook_deliveries`. Order state changes happen in `process-shipping-webhooks` which validates `event_id` + `tracking_number` ownership before touching `orders`.
- **Webhook signing**: HMAC-SHA256 over `${ts}.${body}` using `SHIPPO_WEBHOOK_SECRET`. Constant-time compare. If HMAC setup is gated (Shippo's 10-day onboarding), fall back to URL-token via `/api/webhooks/shippo?token=<secret>` until HMAC is provisioned.
- **Idempotency**: `label_jobs` UNIQUE on `(order_id) WHERE status NOT IN ('succeeded','dead')` — at most one active job per order. `shipping_webhook_deliveries.shippo_event_id` UNIQUE — duplicate Shippo retries skipped.

## 4.9 Test vs live mode

- Mode inferred from key prefix: `shippo_test_*` → test, `shippo_live_*` → live.
- Admin UI shows mode pill prominently.
- Staging deploys (`NEXT_PUBLIC_ENV=staging`) refuse to attach a live key (the connect endpoint rejects).
- Test-mode purchases write `agent_charged_cents=0` and tag `balance_transactions.note='test mode'` so reconciliation is clean.

## 4.10 Implementation order — 12 tickets

Each ticket: one PR, audit-logged, fully tested, deployed before the next starts. Targets ≤ 300 LOC each so a single review session is enough.

| # | Ticket | Files | Audit | LOC |
|---|---|---|---|---|
| 1 | DB migration `20260601000001_shippo_platform.sql` | `supabase/migrations/...sql` | Schema log | 220 SQL |
| 2 | `lib/shippo-crypto.ts` AES-256-GCM helpers | new file | none | 90 |
| 3 | Rewrite `lib/shippo.ts` with key resolver + `validateAddress`/`quoteRates`/`buyLabel`/`refundLabel`/`subscribeTracking` | replace existing | every Shippo call | 420 |
| 4 | Admin connect/test/rotate/disconnect/status APIs (5 routes) | `app/api/admin/shippo/*` | `shippo.{connect,rotate,disconnect,test}` | 280 |
| 5 | Shipping origins CRUD + admin UI section | `app/api/admin/shipping-origins/*` + UI card | per-write | 260 |
| 6 | `/admin/settings/shipping` page with all 6 cards | `app/admin/settings/shipping/page.tsx` + client | none (read) | 480 |
| 7 | `/api/shipping/quote` + `/api/shipping/validate-address` + checkout wiring | new routes + CheckoutForm edits | rate limited | 280 |
| 8 | `label_jobs` queue + `/api/agent/orders/.../approve` enqueue + `/api/cron/process-labels` | new cron + route edits + vercel.json | per-purchase | 380 |
| 9 | `/api/webhooks/shippo` HMAC receiver + `/api/cron/process-shipping-webhooks` | new routes + vercel.json | per-event | 360 |
| 10 | Refund / reprint endpoints + shipping-role UI | `/api/shipping/labels/[id]/{refund,reprint}` + `app/shipping/queue/...` | per-refund | 320 |
| 11 | Migrate existing agent keys to `legacy_agent_shippo_keys`, drop `agent_profiles.shippo_api_key`, switch RMA return-label flow to platform | one-shot data migration script + edits | one-shot audit | 200 |
| 12 | Tracking timeline on `/orders/[id]` + buyer push fanout in webhook handler + reconciliation cron | edits + new cron | per-buyer-notification | 320 |

Total: ~3,800 LOC code + 220 SQL across 12 PRs.

## 4.11 Action items BEFORE code starts

1. **Contact Shippo sales** at `platform@goshippo.com` or via dashboard. Ask for:
   - Platform Account enablement on the existing PepNationLab org.
   - Webhook HMAC secret provisioning (allow 10 business days).
   - Volume pricing tier confirmation.
   - Carrier coverage confirmation (USPS Stamps.com is default; UPS / FedEx need separate enablement).
2. **Generate two API keys** in Shippo dashboard: one `shippo_test_*` and one `shippo_live_*`.
3. **Provision Vercel env vars**: `SHIPPO_PLATFORM_TOKEN`, `SHIPPO_WEBHOOK_SECRET`, `SHIPPO_ENCRYPTION_KEY` (`openssl rand -base64 32`), `NEXT_PUBLIC_SHIPPO_MODE`.
4. **Add admin warehouse address** information to a single doc the team can use for connect: name, street1/2, city, state, zip, phone, email.
5. **Snapshot existing agents' Shippo keys** for migration archive.

---

# 5. MILESTONE 2 — Agent BYO Shippo (after M1 stable for ~30 days)

## 5.1 Goal

Tier-1 super-agents with negotiated Shippo Commercial Plus pricing connect their own Shippo account. The platform-account is the fallback. Statement skips shipping for orders shipped on agent's own account (Shippo bills them directly).

## 5.2 DB changes

```sql
CREATE TABLE public.agent_shippo_credentials (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mode               TEXT NOT NULL CHECK (mode IN ('test','live')),
  api_key_ciphertext BYTEA NOT NULL,
  api_key_iv         BYTEA NOT NULL,
  api_key_tag        BYTEA NOT NULL,
  api_key_last4      TEXT NOT NULL,
  is_active          BOOLEAN NOT NULL DEFAULT false,
  connected_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_validated_at  TIMESTAMPTZ,
  last_validation_error TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_active_per_agent ON public.agent_shippo_credentials(agent_id) WHERE is_active=true;
ALTER TABLE public.agent_shippo_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent owner only" ON public.agent_shippo_credentials FOR ALL
  USING (agent_id = (SELECT auth.uid())) WITH CHECK (agent_id = (SELECT auth.uid()));
CREATE POLICY "admin read" ON public.agent_shippo_credentials FOR SELECT USING (public.is_admin());
```

## 5.3 Routes (7 tickets)

- `/api/agent/shippo/{connect,test,rotate,disconnect,status}` (5 routes ~180 LOC).
- Extend `getActiveKey(agent_id)` resolver (~40 LOC).
- Agent dashboard "Shipping" tab UI with toggle (~260 LOC).
- `process-labels` branch on `shippo_account_mode` (~50 LOC).
- Statement integration: skip BYO orders in shipping sum (~30 LOC).
- Auto-fallback logic + audit notification (~80 LOC).

---

# 6. MILESTONE 3 — Full automation (after M2)

## 6.1 Goals

- Tracking webhooks auto-advance `shipped → in_transit → delivered`.
- Buyer push + in-app at every state.
- Address validation gates checkout (already in M1).
- Automatic return labels on RMA approve.
- Batch print PDF for shipping role.
- End-of-day SCAN form (manifest) close-out.
- Stuck-shipment admin alerts (>5 days no scan).
- Multi-parcel split for oversized orders.

## 6.2 DB

```sql
CREATE TABLE public.shipping_manifests (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_id          UUID NOT NULL REFERENCES public.shipping_origins(id),
  carrier            TEXT NOT NULL,
  shippo_manifest_id TEXT UNIQUE,
  document_url       TEXT,
  closed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  label_count        INTEGER NOT NULL
);
CREATE TABLE public.shipping_batches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by  UUID NOT NULL REFERENCES public.profiles(id),
  pdf_url     TEXT,
  label_count INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'queued',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shipping_label_purchases
  ADD COLUMN IF NOT EXISTS manifest_id UUID REFERENCES public.shipping_manifests(id);
ALTER TABLE public.rma_requests
  ADD COLUMN IF NOT EXISTS return_purchase_id UUID REFERENCES public.shipping_label_purchases(id);
```

## 6.3 Routes (8 tickets)

- Address validation at checkout blur + corrections UX (~140).
- Push subscription endpoint + service worker integration (~180).
- Tracking webhook → buyer notification fan-out (~120).
- RMA auto-label on approve (~90).
- Batch label PDF generator (~220).
- Manifest close-out cron + UI (~140).
- Stuck-shipment admin alerts (~80).
- Delivery ETA computation from carrier service + cache (~70).

---

# 7. ROLLBACK PLAN

- Kill switch: `POST /admin/shippo/disconnect` flips `is_active=false`. `lib/shippo.ts` checks active row at request time; if none, all rate quotes fall back to `shipping_rates` weight brackets, all label-purchase calls return "manual mode" and orders go straight to `in_fulfillment` for the shipping role to handle out-of-band.
- Manual tracking entry preserved on the shipping role UI as a permanent escape hatch.
- Webhook endpoint stays mounted; events for in-flight labels still update status even after disconnect.
- Per-agent BYO keys can be disconnected one at a time via agent dashboard if M2 was shipped; falls back to platform automatically.

---

# 8. WHAT TO ASK SHIPPO SALES (CONFIRMATIONS)

1. Confirm we qualify for Platform Account (vs OAuth gray-label).
2. Confirm per-label fee for our volume (target: 50–500 labels/day across all agents).
3. Confirm HMAC webhook secret can be provisioned in < 10 business days.
4. Confirm USPS Stamps.com is enabled by default for new Managed Accounts.
5. Confirm UPS account onboarding for tier-1 agents (M2/M3 timeline).
6. Confirm rate limits for our tier (default 500/min POST is fine; ask if higher tier exists).
7. Confirm Shippo will accept research-peptide vials as shippable content (no carrier prohibits research-use peptides; flag only if a particular service tier surfaces a content restriction).
8. Confirm pricing for non-US address validation (we're US-only for M1 but ask for M3).
9. Confirm sandbox key has full address-validation, full rate-fetch, full label-buy (watermarked). Confirm batch/manifest test-mode behavior.
10. Confirm the right webhook URL format for production HMAC setup.

---

# 9. SUMMARY METRICS

| | Today | After M1 | After M2 | After M3 |
|---|---|---|---|---|
| Admin Shippo surface | none | full settings page | + BYO observability | + reconciliation dashboard |
| Agent setup steps | paste raw API key | **zero** | optional BYO opt-in | optional BYO + carrier accounts |
| Shipping role can buy labels? | no | yes | yes | yes + batch print + manifest close |
| Auto-status advance on delivery? | no | webhook receiver in place, advances orders | same | + buyer push at every status |
| Address validated at checkout? | no | yes (M1.7 ticket) | same | yes + inline suggestion UI |
| Cost reconciliation? | quoted only | actual cost stored, prepaid debited / statement summed | same + BYO skip | + weekly variance report |
| Refund unused label? | no | yes (M1.10) | yes | yes |
| RMA return labels? | per-agent key only | platform account | + BYO option | automatic on RMA approve |
| Webhook receiver? | no | yes with HMAC | yes | yes + dead-letter queue |
| Manifest close-out? | no | no | no | yes |
| Pickup scheduling? | no | no | no | yes |
| Batch print? | no | no (per-order via cron) | no | yes (true Shippo /batches) |
| Encryption at rest? | plaintext | AES-256-GCM | AES-256-GCM | AES-256-GCM |
| Audit log coverage? | rotate only | every Shippo call | + BYO connect/disconnect | + dead-letters & alerts |

**M1 is the line where PepNationLab actually becomes a shipping platform** instead of a thin API-key wrapper. Everything before that is single-purpose plumbing.

---

*Generated by 3-analyst parallel deep-dive on 2026-05-29. Repo HEAD `95597d1`.*
