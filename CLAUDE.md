> **Note:** Secret values in this document have been replaced with env-var references
> (`${VAR_NAME}`). For the actual values, see the Vercel project settings or your
> team's secret store. This sanitized copy is checked into the public repo so any
> session has a single authoritative reference; the live unredacted file remains
> gitignored locally.

# PepNationLab -- Agent and AI Rules + Full Project Handoff

> **Last updated:** 2026-05-28 (post-audit revision)
> **Purpose:** Everything an AI agent needs to work on PepNationLab and PepNationRX.
> Read this file IN FULL before writing any code.

---

# PART 1: HARD PLATFORM RULES

These are non-negotiable. Every agent session MUST follow them without exception.

---

## MANDATORY: No Emojis Anywhere -- Zero Exceptions

**This is a hard platform rule with zero exceptions.**

Emojis are NEVER allowed and are strictly PROHIBITED anywhere inside this project.

### Scope (everything -- no exceptions):
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

## MANDATORY: Title Case Capitalization -- ALL Pages

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
- All page headings (h1-h6)
- All error messages shown to users
- All toast / notification text
- All footer text

### Technical Enforcement:
CSS `text-transform: capitalize` is applied globally in `globals.css` as a CSS-layer backup, but the TEXT IN SOURCE CODE must also be written in Title Case -- CSS capitalize does not handle all edge cases.

### Exceptions (do NOT capitalize):
- Email addresses in form values / inputs
- URLs
- Database column names and code identifiers
- Legal disclaimer body text where sentence-case is legally required
- SQL / code blocks

---

## MANDATORY: The Omega Protocol for External Links

**This is a hard platform rule with zero exceptions.**

PepNationLab strictly forbids navigating users away from the `pepnationlab.com` domain. Any external link (e.g., PubMed research articles, FDA documents, DrugBank profiles, COAs) MUST be rendered inside the app using the `IframeModal` component.

### Implementation:
- **Component**: Always use `<IframeModal url={externalUrl} title={optionalTitle} onClose={handler} />`.
- **Legacy Components**: DO NOT use `<InAppBrowserProvider>` internals to render iframes manually. `<InAppBrowserProvider>` is now just a context wrapper that delegates to `IframeModal`.
- **Proxy Requirement**: `IframeModal` natively routes the URL through `/api/proxy?url=...` to bypass `X-Frame-Options` blocks using a server-side extraction fallback. Never attempt to put an external URL directly into an `<iframe>` src.
- **Styling constraints**: The `IframeModal` must be true full-screen. It uses `height: 100dvh` and `z-index: 999999` to ensure mobile Safari bottom-bars do not clip the content. Do not alter these properties.

---

## MANDATORY: Ship At The End Of Every Build -- No Local-Only Commits

**This is a hard platform rule with zero exceptions. It applies to EVERY agent
working in this repo (Claude, Cowork, Antigravity, or any other).**

Never end a build session with work sitting in an uncommitted or local-only
state. Every build MUST finish with the full ship sequence:

1. **Commit** all completed work with a descriptive message.
2. **Push to `main`** -- Vercel auto-deploys on push. A build is not done until
   it is pushed and publishing.
3. **Apply any SQL** written during the build against the CORRECT Supabase
   project (`ydsaqnnuwyvtyxgvrnys` for PepNationLab, `cupnhfdwveouenutnveg` for
   PepNationRX) at the end of the build, and commit the migration file.
4. **Verify** the deploy on the live production URL, never localhost.

"Commit locally and wait" is never acceptable. If multiple agents are working
concurrently, pull/rebase before pushing rather than holding work back.

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
`github.com/Smarter-Software-PIQ/pepnationrx`. Its live Supabase database is project
`cupnhfdwveouenutnveg` (project name: pepnationrx). Never run PepNationRX
migrations against `ydsaqnnuwyvtyxgvrnys` -- that ref is the PepNationLab
storefront database, not the telehealth backend.

The `pepnationrx/` subdirectory in this repo is a local working copy only.
Push PepNationRX changes to `Smarter-Software-PIQ/pepnationrx`, NOT to this repo.

---

## MANDATORY: PepNationRX Deployment Workflow

**Before pushing or publishing ANY PepNationRX change, every Claude session and
every Antigravity agent MUST read and follow `pepnationrx/DEPLOYMENT-WORKFLOW.md`.**

PepNationRX is a SPLIT deployment, not a single host:
- Frontend (`pepnationrx/frontend/`) is published by VERCEL -- it auto-deploys on
  every push to `main` of `Smarter-Software-PIQ/pepnationrx`.
- Backend API (`pepnationrx/backend/`) runs on the HETZNER server `5.161.252.33`
  and is deployed by SSH.
- Database is Supabase project `cupnhfdwveouenutnveg`.

Do NOT scp the frontend to Hetzner -- the public domain is served by Vercel.
Always verify a publish by hitting `https://pepnationrx.com`, never localhost or
the Hetzner IP. The full workflow and pre-publish checklist are in
`pepnationrx/DEPLOYMENT-WORKFLOW.md` -- that file is authoritative and overrides
any older note or assumption.

---

## Research-Only Compliance -- 4-Layer Disclaimer

The 4-layer disclaimer gate is mandatory and must never be removed:
1. **Site Entry** -- DisclaimerGate overlay (records `layer = 'site_entry'`)
2. **Registration** -- 3-checkbox acknowledgment (records `layer = 'registration'`)
3. **Add-to-Cart** -- inline warning, recorded once per session via the cart
   provider (records `layer = 'add_to_cart'`); this was previously a gap and is
   now wired end-to-end into `disclaimer_acceptances`
4. **Checkout** -- final confirmation, audited BEFORE the order insert; if the
   audit row fails, the order is refused (records `layer = 'checkout'`)

Public researcher registration is permanently disabled: `/register` redirects
to `/login` via middleware and `POST /api/auth/register` returns 410 Gone.
Researchers can only enter the system through the storefront self-register
flow (`POST /api/storefront/register`, rate-limited) or by admin/agent
provisioning.

Never remove, bypass, or weaken these gates.

---

## Pricing Architecture

Three agent tiers -- multipliers are set in `pricing_tiers` table (current values as of 2026-07-06):
- Tier 1: 2.5x base cost (best pricing)
- Tier 2: 3.0x base cost
- Tier 3: 3.5x base cost (entry pricing)

All multipliers are admin-configurable via dashboard. Never hardcode prices.

`pricing_tiers.multiplier` is kept in lockstep with `house_tiers.markup`
(markup = multiplier - 1, tier_N maps to level N) by the
`trg_sync_house_tiers_from_pricing_tiers` trigger, and every
`agent_products.retail_price` is auto-recomputed (preserving each row's
`margin_percent`) whenever the admin changes tier multipliers, house markups,
product base costs, or an agent's assigned tier
(migration `20260706120000_tier_pricing_global_alignment.sql`). Assigning a
tier to an agent locks them to that tier's pricing (`fixed_scale_override`,
`locked_tier_level`) and clears any stale flat `custom_markup_override`.

---

## Payment Rules

No credit card processing on this platform. All payments via:
- Zelle
- Venmo
- Cash App
- Apple Pay

Agents either: (a) have a line of credit squared up weekly, or (b) maintain a prepaid balance.

---

## Next.js Version Warning

This project uses **Next.js 16.2.6** with React 19. APIs and conventions may differ from training data. Read `node_modules/next/dist/docs/` before writing code. Heed deprecation notices.

---
---

# PART 2: PLATFORM OVERVIEW

## What Is PepNationLab?

PepNationLab is a wholesale research peptide distribution platform. It is NOT a direct-to-consumer store. It operates through a multi-tier agent model:

- **Admin** manages the master product catalog, pricing tiers, agents, and weekly billing
- **Super Agents** onboard and manage sub-agents, see aggregated financials
- **Agents** run individual storefronts (e.g., `pepnationlab.com/midway`) and sell to researchers
- **Researchers** (customers) browse agent storefronts and place orders

## What Is PepNationRX?

PepNationRX is a separate telehealth Management Services Organization (MSO) platform at `pepnationrx.com`. It has its own repo, its own database, and its own deployment topology. A local working copy lives inside the PepNationLab repo at `pepnationrx/`, but changes MUST be pushed to the PepNationRX repo, never to PepNationLab's repo.

## Live URLs

| Platform | URL |
|---|---|
| PepNationLab (storefront) | https://pepnationlab.com |
| PepNationLab (alternate domains redirect) | pepnationlabs.com, www.pepnationlab.com, www.pepnationlabs.com |
| PepNationRX (telehealth) | https://pepnationrx.com |
| PepNationRX API | https://api.pepnationrx.com |

---
---

# PART 3: CREDENTIALS AND SECRETS

## PepNationLab -- Supabase

| Key | Value |
|---|---|
| Supabase Project Ref | `ydsaqnnuwyvtyxgvrnys` |
| Supabase URL | `https://ydsaqnnuwyvtyxgvrnys.supabase.co` |
| Anon Key | `${NEXT_PUBLIC_SUPABASE_ANON_KEY}` |
| Service Role Key | `${SUPABASE_SERVICE_ROLE_KEY}` |
| Supabase Dashboard | https://supabase.com/dashboard/project/ydsaqnnuwyvtyxgvrnys |

## PepNationLab -- Vercel

| Key | Value |
|---|---|
| Vercel Team | `smarter-poker` (ID: `team_SVD8r7AOPH065G3usBxVvrBc`) |
| Vercel Project | `pepnationlab` (ID: `prj_gIhHh2EZWczze8m5li2tE7uNPHfP`) |
| Production URL | https://pepnationlab.com |
| Deploy trigger | Auto-deploy on push to `main` |
| Vercel Dashboard | https://vercel.com/smarter-poker/pepnationlab |

## PepNationLab -- GitHub

| Key | Value |
|---|---|
| Repo | `Smarter-Poker/PepNationLab` |
| URL | https://github.com/Smarter-Poker/PepNationLab |
| Branch | `main` (only branch) |
| Clone URL | `https://github.com/Smarter-Poker/PepNationLab.git` |

## PepNationLab -- Environment Variables (Production on Vercel)

```
NEXT_PUBLIC_SUPABASE_URL=https://ydsaqnnuwyvtyxgvrnys.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<see Supabase table above>
SUPABASE_SERVICE_ROLE_KEY=<see Supabase table above>
NEXT_PUBLIC_APP_URL=https://pepnationlab.com
NEXT_PUBLIC_APP_NAME=Pep Nation Lab
NEXT_PUBLIC_DISCLAIMER_VERSION=v1.0
RESEND_API_KEY=<set in Vercel dashboard>
RESEND_FROM_EMAIL=research@pepnationlab.com
CRON_SECRET=<SET in Vercel production 2026-07-11 - secret; value lives ONLY in the Vercel dashboard. Do NOT ask Dan for it again and NEVER commit it - this repo is public>
PAYER_EIN=<SET in Vercel production 2026-07-11 - PIQ Training Inc federal EIN; value in Vercel dashboard only>
PAYER_LEGAL_NAME=<SET in Vercel production 2026-07-11 - PIQ TRAINING INC>
```

> **Note:** Transactional email is ENABLED via a zero-dependency HTTP sender in
> `lib/email.ts` (calls the Resend API over `fetch`; no `resend` npm package
> required). It is configured through Vercel env vars (`EMAIL_PROVIDER`,
> `RESEND_API_KEY`, `EMAIL_FROM`, optional `EMAIL_REPLY_TO`). When no provider or
> key is set, every send is a safe no-op that logs and returns `{ skipped: true }`,
> so flows never break when email is unconfigured.

---

## PepNationRX -- Supabase

| Key | Value |
|---|---|
| Supabase Project Ref | `cupnhfdwveouenutnveg` |
| Supabase URL | `https://cupnhfdwveouenutnveg.supabase.co` |
| Anon Key | `${PNRX_SUPABASE_ANON_KEY}` |
| Service Role Key | `${PNRX_SUPABASE_SERVICE_ROLE_KEY}` |
| Database Password | `${PNRX_DB_PASSWORD}` |
| Direct DB URL | `postgresql://postgres:${PNRX_DB_PASSWORD}@db.cupnhfdwveouenutnveg.supabase.co:5432/postgres` |
| Pooler URL | `postgresql://postgres.cupnhfdwveouenutnveg:${PNRX_DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres` |

## PepNationRX -- Vercel

| Key | Value |
|---|---|
| Vercel Project | `pepnationrx` (ID: `prj_GbrD7FROlzdrcA7PsSbUPN1say50`) |
| Team | `team_SVD8r7AOPH065G3usBxVvrBc` (same team as PepNationLab) |
| Auto-deploy | Push to `main` of `Smarter-Software-PIQ/pepnationrx` |

## PepNationRX -- GitHub

| Key | Value |
|---|---|
| Repo | `Smarter-Software-PIQ/pepnationrx` |
| URL | `git@github.com:Smarter-Software-PIQ/pepnationrx.git` |
| Branch | `main` |

## PepNationRX -- Hetzner Server (Backend)

| Key | Value |
|---|---|
| Server IP | `5.161.252.33` |
| SSH User | `root` |
| SSH Key Location | `.pnrx-deploy-key` in PepNationLab repo root (gitignored) |
| Backend path on server | `/opt/pepnationrx/backend` |
| Systemd service | `pepnationrx` |
| Port | 4000 (Express) |
| Nginx config | `/etc/nginx/sites-available/api.pepnationrx.com` |
| TLS cert | Let's Encrypt at `/etc/letsencrypt/live/api.pepnationrx.com/` |

## PepNationRX -- Third-Party Services

| Service | Key | Value |
|---|---|---|
| **Stripe** | Secret Key | `${STRIPE_SECRET_KEY}` |
| | Publishable Key | `${STRIPE_PUBLISHABLE_KEY}` |
| | Webhook Secret | `${STRIPE_WEBHOOK_SECRET}` |
| | Webhook Thin | `${STRIPE_WEBHOOK_SECRET_THIN}` |
| | Platform Account | `acct_1Tbol7LAJpIRftwS` |
| **Twilio** | Account SID | `${TWILIO_ACCOUNT_SID}` |
| | Auth Token | `${TWILIO_AUTH_TOKEN}` |
| | Messaging SID | `${TWILIO_MESSAGING_SID}` |
| | Sender Phone | `+16195361280` |
| **SendGrid** | API Key | `${SENDGRID_API_KEY}` |
| | From | `PepNationRX <hello@pepnationrx.com>` |
| **Sentry** | Backend DSN | `${SENTRY_DSN_BACKEND}` |
| | Browser DSN | `${NEXT_PUBLIC_SENTRY_DSN_FRONTEND}` |
| **JWT** | Access Secret | `${JWT_ACCESS_SECRET}` |
| | Refresh Secret | `${JWT_REFRESH_SECRET}` |
| | Access TTL | 900s (15 min) |
| | Refresh TTL | 30 days |
| **PHI Encryption** | Key (AES-256-GCM) | `${PHI_ENCRYPTION_KEY}` |

---
---

# PART 4: TECH STACK

## PepNationLab (Storefront)

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.6 (App Router) |
| React | 19.2.4 |
| Language | TypeScript 5 |
| Node Engine | `>=20.0.0` (pinned in `package.json` `engines`) |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| Auth | Supabase Auth (email + password), extended with username login |
| Styling | Vanilla CSS (design system in `app/globals.css`) |
| Font | Inter (Google Fonts) |
| Icons | lucide-react `^0.474.0` |
| Animation | framer-motion 12.40 |
| Charts | recharts 3.8 |
| Toasts | sonner 2.0 |
| Shipping | Shippo SDK 2.18 |
| Email | Enabled -- zero-dependency HTTP sender in `lib/email.ts` (Resend API via `fetch`, no npm package); safe no-op when unconfigured |
| QR Codes | qrcode 1.5 |
| Validation | zod 4.4 |
| Hosting | Vercel |
| Package Manager | npm |

## PepNationRX (Telehealth)

| Layer | Technology |
|---|---|
| Backend | Node.js + Express.js (long-lived server) |
| Frontend | Vanilla JavaScript (ES6+), Web Components, static HTML/CSS |
| Database | Supabase (PostgreSQL) |
| Auth | Custom JWT (access + refresh tokens, bcrypt hashing) |
| PHI | AES-256-GCM envelope encryption |
| Payments | Stripe Connect (tri-party split) |
| SMS | Twilio |
| Email | SendGrid |
| Monitoring | Sentry |
| Frontend hosting | Vercel |
| Backend hosting | Hetzner VPS (5.161.252.33) |
| DNS | Namecheap |

---
---

# PART 5: REPOSITORY MAP

## PepNationLab Repo Structure

```
pepnationlab/
  .env.local              # Local dev env (Supabase keys + app config)
  .env.local.example      # Template for new devs
  CLAUDE.md               # THIS FILE -- authoritative rules + handoff
  AGENTS.md               # Next.js version warning
  middleware.ts            # Auth middleware, route protection, registration lockdown
  next.config.ts          # Domain redirects (pepnationlabs.com -> pepnationlab.com)
  vercel.json             # Cron jobs configuration
  package.json            # Dependencies

  app/
    layout.tsx            # Root layout: CartProvider + Toaster
    page.tsx              # Home -> redirect(/login) (site is locked)
    globals.css           # Full design system (810 lines, teal/black/silver palette)

    login/                # Auth: login page
    register/             # Auth: registration (DISABLED, redirects to /login)
    forgot-password/      # Auth: password reset
    become-agent/         # Public: agent application form
    about/                # Public: about page
    terms/                # Public: terms of service
    privacy/              # Public: privacy policy
    compliance/           # Public: compliance info
    disclaimer/           # Disclaimer content

    [agentSlug]/          # Dynamic: public agent storefronts (e.g., /midway)

    admin/                # Admin dashboard (role-gated)
      page.tsx            # Admin overview
      layout.tsx          # Admin layout with sidebar
      agents/             # Manage agents
      orders/             # All orders
      pricing/            # Pricing tier config
      products/           # Master product catalog
      researchers/        # User management
      sales/              # Sales analytics
      statements/         # Weekly billing statements
      store-preview/      # Preview agent stores
      transactions/       # Transaction ledger

    dashboard/            # Agent dashboard
      page.tsx            # Agent overview (role-gated)
      agent/              # Agent-specific views

    checkout/             # Order checkout flow
    orders/               # Order history
    products/             # Product browsing
    messages/             # In-app messaging
    shipping/             # Shipping management

    api/
      auth/
        register/         # POST: new user registration
        resolve/          # POST: resolve user session
        signout/          # POST: sign out
      admin/
        agents/           # CRUD agents
        cart-reminders/   # Trigger abandoned cart reminders
        orders/           # Manage orders
        pricing/          # Manage pricing
        pricing-tiers/    # Manage tier multipliers
        products/         # Manage products
        researchers/      # Manage researchers
        sales/            # Sales data
        statements/       # Weekly statements
        transactions/     # Transaction data
      agent/
        create-researcher/  # Agent creates researcher account
        inventory/          # Agent inventory management
        ledger/             # Agent financial ledger
        orders/             # Agent order management
        products/           # Agent storefront products
        promote-subagent/   # Promote sub-agent
        restock/            # Restock inventory
        sales/              # Agent sales data
        shipping/           # Agent shipping
        sub-agents/         # Manage sub-agents
        super-agent/        # Super agent operations
      cart/                 # Cart operations
      coupons/              # Coupon validation
      cron/
        invoices/           # Weekly invoice generation (Sun 11:59pm UTC)
        reminders/          # Daily cart reminders (12pm UTC)
      disclaimer-log/       # Disclaimer acceptance logging
      messages/             # Messaging API
      orders/               # Order creation and management
      shipping/             # Shipping rate calculation

  components/               # 31 React components (see Part 8 for full list)

  lib/
    admin-auth.ts           # requireAdmin(), requireAgent(), requireOrdersAccess()
    coupons.ts              # Coupon validation logic
    email.ts                # Transactional email (Resend HTTP API via fetch; no-op when unconfigured)
    statements.ts           # Weekly statement computation and persistence
    supabase/
      client.ts             # Browser Supabase client (createBrowserClient)
      server.ts             # Server Supabase client + service role client

  supabase/
    migrations/             # 28 SQL migrations (see Part 6 for full list)

  public/
    logo.svg, logo.jpg      # Brand assets
    logo-mark.svg            # Favicon/icon mark
    images/                  # Additional images

  pepnationrx/              # LOCAL WORKING COPY of PepNationRX (separate repo!)
```

---
---

# PART 6: DATABASE ARCHITECTURE

## PepNationLab Database (Supabase: `ydsaqnnuwyvtyxgvrnys`)

### Core Tables (current as of 2026-05-28)

| Table | Purpose |
|---|---|
| `profiles` | User accounts (linked to `auth.users`). Fields include: `role`, `tier`, `referring_agent_id`, `parent_agent_id`, `account_type`, `prepaid_balance`, `credit_limit`, `username`, `is_active`, `cart_state`, `cart_updated_at`, `last_cart_reminder_at`, `disclaimer_v1_accepted`, `disclaimer_accepted_at`, `is_super_agent` |
| `agent_profiles` | Agent storefront config: `slug`, `display_name`, `tagline`, `bio`, `colors`, `logo`, `qr_code_data`, payment handles, `warehouse_address` (JSONB), `shippo_api_key`, `bundles_config` (JSONB) |
| `products` | Master product catalog: `name`, `slug`, `category`, `base_cost`, `weight_oz`, `inventory_count`, `admin_bulk_price`, `admin_bulk_threshold`, `is_active`, `is_banned`, `sku` |
| `agent_products` | Agent storefront catalog: links to products, custom naming, `retail_price`, `is_on_sale`, `sale_price`, visibility |
| `pricing_tiers` | Admin-configurable multipliers: Tier 1 (5x), Tier 2 (6x), Tier 3 (7x). Now gated read-only to agents+admin (no public read) |
| `product_tier_overrides` | Per-product custom multiplier overrides. Now gated read-only to agents+admin |
| `orders` | Orders: `buyer_id`, `agent_id`, `status`, `payment_method`, `fulfillment_method`, `shipping_address`, `shipping_cost`, `subtotal`, `discount_amount`, `coupon_code`, `total`, `is_wholesale_restock`, `idempotency_key UUID UNIQUE`, `buyer_name`, `buyer_email`, `label_url` |
| `order_items` | Line items: product snapshot, quantity, `unit_retail_price`, `unit_cost_price`, `unit_super_agent_cost` |
| `weekly_statements` | Agent billing: week range, COGS, shipping, total_owed, status |
| `statement_orders` | Links orders to statements |
| `coupons` | Agent coupon codes: type (percent/fixed), limits, expiry, atomic `uses_count` |
| `internal_messages` | In-app messaging between users. Replaces the old `messages` table (dropped). Read receipts via `mark_message_read()` |
| `disclaimer_acceptances` | Audit log for 4-layer disclaimer system. `layer` enum: `site_entry | registration | add_to_cart | checkout`. WITH CHECK enforces `auth.uid()` on insert |
| `shipping_rates` | Weight-based shipping tiers |
| `balance_transactions` | Append-only ledger of prepaid balance moves. Admins/service can insert via `deduct_prepaid_balance()`; no updates or deletes |
| `super_agent_pricing` | Super agent → sub-agent baseline costs per product. WITH CHECK on writes binds the row to the calling super_agent |
| `sub_agent_invoices` | Weekly invoices a super agent issues to their sub-agents |
| `agent_inventory` | Per-agent local stock counts. No longer publicly readable; only the owning agent + admin can read |
| `admin_audit_log` | NEW. Records sensitive admin actions (tier overrides, balance adjustments, agent (de)activation, etc.) |
| `cron_runs` | NEW. Idempotency log for cron jobs — keyed by run name + week/day so a re-trigger inside the same window short-circuits |

### Key Enums

```sql
user_role: 'researcher', 'agent', 'super_agent', 'admin'
agent_tier: 'tier_1', 'tier_2', 'tier_3'
account_type: 'credit', 'prepaid'
order_status: 'pending_customer_payment', 'agent_approval_pending', 'approved_ship',
              'approved_pickup', 'in_fulfillment', 'shipped', 'delivered', 'cancelled'
payment_method: 'zelle', 'cashapp', 'venmo', 'apple_pay'
discount_type: 'percent', 'fixed'
statement_status: 'open', 'pending_payment', 'paid'
```

### Key Database Features

- **RLS (Row Level Security):** Enabled on ALL tables. Helper functions: `is_admin()`, `is_agent_or_above()`, `get_user_role()`. Audit pass on 2026-05-28 hardened the following:
  - `agent_inventory` is no longer publicly readable; only the owning agent (and admin) can read
  - `pricing_tiers` and `product_tier_overrides` are gated to authenticated agents+admin; researchers cannot enumerate platform multipliers
  - `balance_transactions` is append-only for admin/service (no UPDATE, no DELETE policy)
  - `super_agent_pricing` has `WITH CHECK` so a super_agent cannot write rows attributed to another super_agent
  - `disclaimer_acceptances` insert policy uses `WITH CHECK (auth.uid() = user_id)` to prevent attribution forgery
- **Auto-profile creation:** Trigger `on_auth_user_created` creates a `profiles` row with role `researcher` on signup (used now only by admin/storefront-created accounts, since public registration is closed).
- **Inventory system:** Strict inventory tracking with atomic deduction (rejects negative writes via trigger).
- **Super Agent hierarchy:** `parent_agent_id` on profiles links sub-agents to super agents (single-hop).
- **Username login:** Added in migration 008; sanitized via the shared `lib/usernames.ts` helper everywhere a username is accepted.
- **Banned products:** `is_banned` flag on products with a trigger that prevents sale and a checkout-time re-check.
- **Idempotency:** `orders.idempotency_key` has a unique partial index; the order route returns the existing row on replay.

### Key SECURITY DEFINER Functions

- `redeem_coupon(p_code, p_agent_id, p_order_subtotal)` -- atomically validates expiry, limits, and min-subtotal then increments `uses_count` in a single transaction. Returns `(coupon_id, discount_amount)`.
- `deduct_prepaid_balance(p_agent_id, p_amount, p_order_id, p_description)` -- atomic balance debit + balance_transactions insert.
- `cancel_stale_pending_orders(p_hours)` -- sweeps `pending_customer_payment` orders older than the threshold and cancels them with a reason.
- `mark_message_read(p_message_id)` -- updates read receipts on `internal_messages`.
- `agent_inventory_in_stock(p_agent_id, p_product_id)` -- safe accessor that respects RLS for the storefront grid.

### Pricing Engine Detail

```
Agent Wholesale Cost = base_cost * tier_multiplier
  - Tier 1: 2.5x (best, for top agents)
  - Tier 2: 3.0x (standard)
  - Tier 3: 3.5x (entry)
  - Retail Price = Agent Cost * (1 + margin_percent / 100), default margin 50%
  - Per-product overrides possible via product_tier_overrides table

Super Agent Flow:
  - Super Agent cost = base_cost * super_agent_tier_multiplier
  - Sub-Agent cost = super_agent_baseline (set by super agent)
  - Researcher pays = agent_product.retail_price
  - Agent billed = sub-agent cost
  - Super Agent billed = super agent cost
  - Admin billed = COGS (base_cost)
```

### Migrations (28 total, in `supabase/migrations/`)

```
20260521000001_initial_schema.sql              -- Full schema, RLS, enums, triggers
20260521000002_product_inventory.sql           -- Inventory tracking
20260521000003_fix_trigger_admin.sql           -- Admin trigger fixes
20260521000004_deduct_inventory.sql            -- Inventory deduction function
20260521000005_order_coupons.sql               -- Coupon-order linking
20260521000006_statement_orders_rls.sql        -- Statement RLS
20260527000007_balance_transactions.sql        -- Balance/transaction tracking
20260527000008_username_login.sql              -- Username column
20260527000009_agent_products_triggers.sql     -- Agent product triggers
20260527000010_shipping_role.sql               -- Shipping role
20260528000002_revert_rx_roles.sql             -- Revert telehealth roles
20260528000003_strict_inventory.sql            -- Strict inventory enforcement
20260528000004_phase7_additions.sql            -- Phase 7 features
20260528000005_super_agents.sql                -- Super agent system
20260528000006_phase15_messaging_inventory.sql -- Messaging + inventory
20260528000007_update_inventory_trigger.sql
20260528000008_bulk_pricing.sql                -- Bulk pricing
20260528000009_wholesale_restock.sql           -- Wholesale restock system
20260528000010_shippo_api_key.sql              -- Shippo integration
20260528000011_order_label_url.sql             -- Shipping label URL
20260528000012_trigger_username.sql            -- Username trigger
20260528000013_fix_rls_recursion.sql           -- RLS recursion fix
20260528000014_fix_super_agent_recursion.sql
20260528033557_atomic_deduct_balance.sql       -- Atomic balance deduction
20260528045244_delete_test_users.sql           -- Cleanup test data
20260528060000_agent_bundles.sql               -- agent_profiles.bundles_config JSONB + bundle pricing
20260528100000_audit_p0_hardening.sql          -- AUDIT P0: idempotency_key, cron_runs, admin_audit_log,
                                               --          redeem_coupon RPC, deduct_prepaid_balance,
                                               --          cancel_stale_pending_orders, balance ledger
                                               --          append-only, agent_inventory RLS lock-down,
                                               --          super_agent_pricing WITH CHECK
20260528100001_audit_messaging_storage_view.sql -- AUDIT messaging: drop legacy `messages` table,
                                               --          internal_messages everywhere, mark_message_read RPC
20260528140000_fix_tier_type_mismatch.sql      -- Cast fix on tier enum vs text mismatch
```

---
---

# PART 7: USER ROLES AND AUTH

## Authentication Flow

1. Supabase Auth handles email/password (+ username login)
2. Middleware (`middleware.ts`) checks auth on every request
3. Public routes: `/login`, `/forgot-password`, `/become-agent`, `/about`, `/terms`, `/privacy`, `/compliance`, API auth endpoints, agent storefronts (`/[slug]`)
4. `/register` is **permanently disabled** -- redirects to `/login`
5. Logged-in users on `/login` redirect to `/admin` (if admin) or `/dashboard` (otherwise)

## Roles

| Role | Access | Features |
|---|---|---|
| `admin` | Full platform access | Manage products, agents, orders, pricing, statements, researchers |
| `super_agent` | Own store + sub-agents | Manage sub-agents, see aggregated financials, set sub-agent pricing |
| `agent` | Own storefront | Products, orders, coupons, messaging, inventory, QR codes |
| `researcher` | Browse + order | Browse agent storefronts, place orders, view order history |
| `shipping` | Order fulfillment | View/update order shipping status |

## Auth Guards (in `lib/admin-auth.ts`)

```typescript
requireAdmin()        // Admin only
requireAgent()        // Agent, super_agent, or admin
requireOrdersAccess() // Admin or shipping role
```

---
---

# PART 8: API ROUTE MAP AND COMPONENT INVENTORY

## API Routes

### Auth (`/api/auth/`)
- `POST /api/auth/register` -- Register new user (currently disabled via middleware)
- `POST /api/auth/resolve` -- Resolve current session
- `POST /api/auth/signout` -- Sign out

### Admin (`/api/admin/`) -- All require `requireAdmin()`
- `/agents` -- CRUD agents
- `/cart-reminders` -- Trigger abandoned cart reminders
- `/orders` -- Manage all orders
- `/pricing` -- Pricing configuration
- `/pricing-tiers` -- Tier multiplier management
- `/products` -- Master product catalog CRUD
- `/researchers` -- Researcher management
- `/sales` -- Sales analytics data
- `/statements` -- Weekly statement management
- `/transactions` -- Transaction ledger

### Agent (`/api/agent/`) -- All require `requireAgent()`
- `/create-researcher` -- Agent creates a researcher account
- `/inventory` -- Inventory management
- `/ledger` -- Financial ledger
- `/orders` -- Agent orders
- `/products` -- Agent storefront products
- `/promote-subagent` -- Promote user to sub-agent
- `/restock` -- Restock inventory
- `/sales` -- Agent sales data
- `/shipping` -- Shipping management
- `/sub-agents` -- Sub-agent management
- `/super-agent` -- Super agent operations

### Public/Mixed
- `/api/cart` -- Cart operations
- `/api/coupons` -- Coupon validation
- `/api/disclaimer-log` -- Log disclaimer acceptances
- `/api/messages` -- Messaging
- `/api/orders` -- Order creation
- `/api/shipping` -- Shipping rate calculation

### Cron Jobs (Vercel Cron, configured in `vercel.json`)
- `GET /api/cron/reminders` -- Daily at 12:00 UTC
- `GET /api/cron/invoices` -- Weekly Sunday at 23:59 UTC

## Component Inventory (31 files in `components/`)

### Admin Components
| Component | File | Purpose |
|---|---|---|
| AdminAgents | `AdminAgents.tsx` | Agent CRUD, tier assignment, activation |
| AdminAnalytics | `AdminAnalytics.tsx` | Platform-wide analytics with recharts |
| AdminCartRemindersTrigger | `AdminCartRemindersTrigger.tsx` | Manual cart reminder trigger |
| ProductTierOverrides | `ProductTierOverrides.tsx` | Per-product pricing overrides |

### Agent Components
| Component | File | Purpose |
|---|---|---|
| AgentOverview | `AgentOverview.tsx` | Dashboard home |
| AgentOrders | `AgentOrders.tsx` | Order management |
| AgentInventory | `AgentInventory.tsx` | Inventory tracking |
| AgentCoupons | `AgentCoupons.tsx` | Coupon CRUD |
| AgentSales | `AgentSales.tsx` | Sales analytics |
| AgentLedger | `AgentLedger.tsx` | Financial ledger |
| AgentManualOrder | `AgentManualOrder.tsx` | Create orders manually |
| AgentStoreProducts | `AgentStoreProducts.tsx` | Storefront product config |
| AgentStorefrontConfig | `AgentStorefrontConfig.tsx` | Store settings (slug, colors, bio) |
| AgentStorefrontGrid | `AgentStorefrontGrid.tsx` | Public storefront product grid |
| AgentStorefrontLogin | `AgentStorefrontLogin.tsx` | Storefront login form |
| AgentSubAgents | `AgentSubAgents.tsx` | Sub-agent management |
| AgentMessages | `AgentMessages.tsx` | Agent messaging |
| AgentInbox | `AgentInbox.tsx` | Inbox view |
| AgentAnalytics | `AgentAnalytics.tsx` | Agent-level analytics |

### Shared Components
| Component | File | Purpose |
|---|---|---|
| CartContext | `CartContext.tsx` | React Context for cart state |
| DisclaimerGate | `DisclaimerGate.tsx` | Full-screen disclaimer modal |
| SiteDisclaimerGate | `SiteDisclaimerGate.tsx` | Site-entry disclaimer wrapper |
| Navbar | `Navbar.tsx` | Navigation bar with auth state |
| FooterSection | `FooterSection.tsx` | Site footer |
| HeroSection | `HeroSection.tsx` | Landing page hero |
| HowItWorksSection | `HowItWorksSection.tsx` | Landing page explainer |
| LegalDocument | `LegalDocument.tsx` | Legal page layout |
| Messaging | `Messaging.tsx` | Messaging UI |
| PageShell | `PageShell.tsx` | Page wrapper |
| ProductsPreview | `ProductsPreview.tsx` | Product preview grid |
| QRCodeGenerator | `QRCodeGenerator.tsx` | QR code generation |

---
---

# PART 9: DEPLOYMENT WORKFLOWS

## PepNationLab Deployment

1. **Develop locally**: `npm run dev` at `http://localhost:3000`
2. **Commit and push to `main`** on `Smarter-Poker/PepNationLab`
3. **Vercel auto-deploys** to `pepnationlab.com`
4. **Database migrations**: Apply via Supabase dashboard or MCP against `ydsaqnnuwyvtyxgvrnys`

## PepNationRX Deployment (SPLIT Architecture)

**CRITICAL:** Read `pepnationrx/DEPLOYMENT-WORKFLOW.md` before ANY PepNationRX change.

```
pepnationrx.com (Namecheap DNS -> Vercel)
       |
       |  A records -> Vercel
       v
  VERCEL (project: pepnationrx)        <-- Frontend (static HTML/CSS/JS)
       |  /api/* proxied to
       v
  HETZNER 5.161.252.33                  <-- Backend (Node/Express on :4000)
       |
       v
  Supabase project cupnhfdwveouenutnveg <-- Database
```

### Frontend Deploy
1. Push to `main` on `Smarter-Software-PIQ/pepnationrx`
2. Vercel auto-builds and deploys
3. Verify at `https://pepnationrx.com` (NOT Hetzner IP)
4. **NEVER scp frontend files to Hetzner**

### Backend Deploy
1. Push to `main` on GitHub
2. SSH deploy to Hetzner:
   ```bash
   chmod 600 .pnrx-deploy-key
   rsync -avz --delete --exclude 'node_modules' --exclude '.env' \
     backend/src root@5.161.252.33:/opt/pepnationrx/backend/
   ssh root@5.161.252.33 "systemctl restart pepnationrx && systemctl is-active pepnationrx"
   ```
3. Verify: `curl https://api.pepnationrx.com/api/health`

### Database Deploy
- Supabase MCP `apply_migration` against `cupnhfdwveouenutnveg` ONLY
- Migrations in `pepnationrx/database/migrations/`

---
---

# PART 10: PEPNATIONRX ARCHITECTURE SUMMARY

PepNationRX is a telemedicine MSO platform. Completely separate from PepNationLab.

- **Frontend:** Vanilla JS Web Components, served by Vercel
- **Backend:** Node/Express on Hetzner, with:
  - JWT auth (access + refresh tokens with rotation)
  - PHI encryption (AES-256-GCM)
  - Triad integrations: Medical Network (Wheel/SteadyMD), 503A Pharmacy, Stripe Connect
  - Audit logging for HIPAA compliance
  - Scheduled jobs (refill reminders, billing sweep, payout runs)
- **Frontend aesthetic:** Futuristic metal -- 3D depth, layered shadows, brushed-metal, teal/blue neon on black
- **Color palette:** Teal, Blue, White, Silver Grey, Black ONLY
- **No React:** Pure Vanilla JS, Web Components, standard HTML/CSS

### PepNationRX Build Status

Phases 1-6 are complete (schema, auth, triage form, catalog, dashboards, jobs, audit, cert review). Production launch gated on:
- LegitScript Healthcare Merchant Certification
- HIPAA Security Risk Assessment
- Signed BAAs
- Legal/compliance counsel review
- Penetration test

### PepNationRX Key API Endpoints

```
GET  /api/health                 -- Liveness probe
POST /api/auth/register          -- User registration
POST /api/auth/login             -- Login (returns JWT pair)
POST /api/auth/refresh           -- Token refresh
POST /api/auth/logout            -- Logout
GET  /api/auth/me                -- Current user
POST /api/intake                 -- Clinical triage submission
GET  /api/intake/:id             -- Get intake details
GET  /api/patient/dashboard      -- Patient dashboard data
GET  /api/affiliate/dashboard    -- Affiliate dashboard data
GET  /api/affiliate/referral-link -- Get referral link
```

---
---

# PART 11: CROSS-CONTAMINATION REFERENCE

| Rule | PepNationLab | PepNationRX | Smarter.Poker |
|---|---|---|---|
| GitHub repo | `Smarter-Poker/PepNationLab` | `Smarter-Software-PIQ/pepnationrx` | NEVER TOUCH |
| Supabase ref | `ydsaqnnuwyvtyxgvrnys` | `cupnhfdwveouenutnveg` | `kuklfnapbkmacvwxktbh` -- NEVER USE |
| Vercel project | `pepnationlab` | `pepnationrx` | NEVER TOUCH |

---
---

# PART 12: CURRENT STATE

### Site State
- **Site is locked:** Home page redirects to `/login`. Only authenticated users can access most pages.
- **Registration disabled:** `/register` permanently redirects to `/login` via middleware; `POST /api/auth/register` returns 410 Gone.
- **Email enabled:** Transactional email sends via a zero-dependency HTTP sender in `lib/email.ts` (Resend API over `fetch`; `resend` is intentionally not an npm dependency). Configured via `EMAIL_PROVIDER` / `RESEND_API_KEY` / `EMAIL_FROM`; every send is a safe no-op returning `{ skipped: true }` when unconfigured.
- **Robots:** `index: false, follow: false` in metadata (not indexed by search engines).
- **Storefront onboarding:** Public researcher signup happens only on agent storefronts at `/[slug]` via the rate-limited `POST /api/storefront/register`.

### 2026-05-28 Audit Pass

A full repository + database audit on 2026-05-28 addressed:
- 28 P0 findings (data loss / security / payment correctness)
- 36 P1 findings (broken or unsafe user flows)
- 80+ P2 findings (UX, accessibility, performance, observability)
- 100+ style violations (emoji removal, Title Case enforcement)
- The full breakdown lives in `AUDIT-2026-05-28.md` (gitignored, kept locally).

Highlights now in production:
- **Security headers** on every response via `next.config.ts`: HSTS, CSP, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- **CSRF same-origin check** (`lib/csrf.ts` -> `assertSameOrigin`) on every state-changing API route. Skipped in development so curl-based smoke tests keep working.
- **Liveness probe** at `GET /api/health` for uptime monitoring.
- **Error boundaries**: `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`.
- **Shared pagination** component used across all admin list pages (orders, transactions, statements, researchers).
- **Shared `lib/usernames.ts`** for `sanitizeUsername` / `validateUsername`, used by every entry point that accepts a username.
- **Shared `lib/agent-auth.ts`** with `isAgentAncestorOf` for super_agent → sub_agent ownership checks.
- **Order idempotency** via `orders.idempotency_key UUID UNIQUE` and the unique-violation replay path in `POST /api/orders`.
- **Atomic coupon redemption** via SECURITY DEFINER RPC (`redeem_coupon`) — no more last-redemption race.
- **Disclaimer layer 3** (add-to-cart) is now recorded via `disclaimer_acceptances` once per cart session.

### Design System Quick Reference
- **Primary color:** Teal (`#00C4BC`)
- **Background:** Black (`#050A0F`)
- **Surfaces:** `#0F1923`, `#162230`, `#1D2D3E`
- **Text:** White (`#FFFFFF`), Silver (`#A8B4C0`, `#D0DAE4`)
- **Danger/Warning:** Red (`#E53E3E`) -- warnings and disclaimers ONLY
- **Font:** Inter (all weights 300-900)
- **Card styles:** `.card`, `.card-glass`, `.card-metal`
- **Button styles:** `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`

### Recent Git History
```
7fed728 Fix signout 405 error and agent overview mobile scaling
6a5c094 Fix storefront 404, modal overlay, and zero font
105f5c3 Add signout to fallback storefront view
3099cbb Make agent dashboard sidebar a drawer menu on desktop
a204a41 Move hamburger menu to left side in agent dashboard header
2d487fb AUDIT: Fix checkout schema mismatch, shipping auth, null crashes, CSS gaps
da087a8 CRITICAL: Fix storefront login auth, middleware signout, admin role gate
9389a7f Implement final UI fixes, new peptides batch insert, QR code reliability
63cf8fc Deploy Phase 16-21: Username Login, Shippo Integration, etc
```

### Cron Jobs
- `/api/cron/reminders` -- Daily at 12:00 UTC (abandoned cart reminders)
- `/api/cron/invoices` -- Weekly Sunday at 23:59 UTC (generate weekly statements)
