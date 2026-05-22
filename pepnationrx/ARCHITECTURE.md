# PepNationRX.com - Architecture Blueprint

Telemedicine Management Services Organization (MSO) platform.

## Hard Constraints

1. No emojis in any code, comment, or document.
2. No React, Next.js, or any React-based framework. Frontend is pure Vanilla
   JavaScript (ES6+), Web Components, and standard HTML/CSS.
3. Color palette restricted to: Teal, Blue, White, Silver Grey, Black.
4. Aesthetic: futuristic metal - 3D depth, layered shadows, brushed-metal
   finishes, high-contrast teal/blue neon accents on black.

## I. System Architecture and Topology

- Backend: Node.js with Express.js (REST + webhook receivers).
- Database: PostgreSQL 15+ (relational integrity for medical and financial records).
- Frontend: Vanilla JS, Web Components, custom CSS variables (no build framework).
- Auth: JWT access tokens (short-lived) plus server-stored refresh tokens.

### Hosting and HIPAA traffic

- Cloud: AWS (primary recommendation) or Google Cloud.
- Edge: Application Load Balancer terminating TLS 1.2+, routing only to private
  subnets. The Node API runs in an Auto Scaling Group across at least two
  availability zones behind the load balancer.
- Data: PostgreSQL on managed RDS (Multi-AZ) in private subnets, encryption at
  rest enabled, automated backups and point-in-time recovery.
- Secrets: AWS Secrets Manager / KMS. PHI is encrypted at the application layer
  with a KMS-managed data key before it reaches the database.
- A signed Business Associate Agreement (BAA) is required with every vendor that
  touches PHI (cloud provider, medical network, pharmacies, email/SMS).
- All inbound/outbound PHI access is recorded in the `audit_log` table.

## II. Backend Folder Structure (Node.js / Express)

```
backend/
  package.json
  src/
    server.js                 Express app bootstrap, middleware mounting
    config/
      env.js                  Typed environment loader and validation
      database.js             PostgreSQL connection pool
      constants.js            Enums, fee splits, protocol catalog
    routes/
      index.js                Route table aggregator
      auth.routes.js          Register, login, refresh, logout
      intake.routes.js        Clinical triage submission endpoints
      subscription.routes.js  Plan selection and lifecycle
      prescription.routes.js  Patient-facing prescription reads
      checkout.routes.js      Stripe Connect checkout
      patient.routes.js       Patient dashboard data
      affiliate.routes.js     Affiliate dashboard and referral links
      admin.routes.js         Internal operations
    controllers/              Request handlers (thin; delegate to services)
      auth.controller.js
      intake.controller.js
      subscription.controller.js
      prescription.controller.js
      checkout.controller.js
      patient.controller.js
      affiliate.controller.js
    services/                 Business logic (the Triad orchestration)
      medical-network/
        client.js             Wheel / SteadyMD HTTP client
        intake-mapper.js      Intake answers -> secure JSON payload
        prescription-sync.js  Apply signed Rx data from webhook
      pharmacy/
        client.js             503A pharmacy B2B HTTP client
        order-router.js       Route approved scripts to pharmacy
        tracking-sync.js      Sync cold-chain FedEx tracking
      stripe/
        connect.js            Tri-party split routing logic
        subscription.js       Recurring billing management
        payout.js             Affiliate revenue-share transfers
      audit.service.js        Writes audit_log entries
      encryption.service.js   KMS envelope encrypt/decrypt for PHI
    middleware/
      authenticate.js         JWT verification
      authorize.js            Role-based access control
      audit.middleware.js     Records PHI access
      validate.js             Request schema validation
      error-handler.js        Centralized error responses
      rate-limit.js           Abuse protection
    webhooks/
      medical-network.webhook.js   Receives signed prescriptions
      pharmacy.webhook.js          Receives shipping/tracking updates
      stripe.webhook.js            Receives payment/subscription events
      verify-signature.js          Per-source signature verification
    models/                   Data-access layer (one module per table)
      user.model.js
      medical-profile.model.js
      subscription.model.js
      prescription.model.js
      affiliate.model.js
      ... (one per schema table)
    db/
      pool.js                 Shared pg pool
      query.js                Parameterized query helper
    jobs/
      refill-reminders.job.js  Monthly check-in scheduling
      billing-sweep.job.js     Renewal and dunning
      payout-run.job.js        Periodic affiliate payouts
    validators/               Request payload schemas
    utils/                    Logger, date, id, formatting helpers
  tests/
    unit/
    integration/
```

## III. Frontend Folder Structure (Vanilla JS)

```
frontend/
  index.html                  Application shell (single entry point)
  css/
    variables.css             Design tokens (delivered in Phase 1)
    base/                     Reset, typography, layout primitives
    components/               Per-component styles
    themes/                   Optional theme overrides
  js/
    app.js                    Bootstraps the shell and router
    core/
      router.js               History API client-side routing
      component.js            Base HTMLElement class for Web Components
      shell.js                Persistent chrome (header, footer, nav)
      events.js               Application event bus
    components/               Web Components (custom elements)
      pnrx-hero.js            Split-funnel landing module
      pnrx-triage-form.js     Multi-step branching intake questionnaire
      pnrx-checkout.js        Stripe Elements checkout
      pnrx-patient-dashboard.js
      pnrx-affiliate-dashboard.js
      pnrx-metal-button.js    Shared brushed-metal control
      pnrx-field.js           Shared form field
    services/
      api.js                  Fetch wrapper, JWT attach, refresh
      auth.service.js
      intake.service.js
      checkout.service.js
    store/
      state.js                Central app state container
      session.js              JWT/session persistence
    utils/                    Validation, formatting, dom helpers
  assets/
    images/
    fonts/
    icons/
```

## IV. Database

- Full schema dump: `database/schema.sql`.
- Forward migrations live in `database/migrations/`.
- Seed/reference data lives in `database/seeds/`.

Core tables: `users`, `medical_profiles`, `subscriptions`, `prescriptions`,
`affiliates`. Supporting tables: `addresses`, `providers`, `pharmacies`,
`intake_submissions`, `pharmacy_orders`, `transactions`, `affiliate_referrals`,
`affiliate_payouts`, `monthly_checkins`, `consents`, `webhook_events`,
`refresh_tokens`, `audit_log`.

## V. Compliance Disclosure

Hardcoded in the app shell footer and presented as a mandatory checkout consent:

> PepNationRX is a technology platform and management services organization.
> We do not provide medical advice or care. All clinical services are provided
> by independent, licensed medical practitioners. All compounded medications
> are fulfilled by licensed, independent 503A compounding pharmacies. By
> proceeding, you acknowledge that PepNationRX acts solely as the designated
> billing agent.

The platform is engineered to support LegitScript Healthcare Merchant
Certification. Certification and HIPAA posture must be validated by qualified
legal and compliance counsel before production launch.

## VI. Phase 1 Deliverables (complete)

1. `database/schema.sql` - complete PostgreSQL schema dump.
2. Backend and frontend folder structures - outlined above and scaffolded on disk.
3. `frontend/css/variables.css` - foundational design tokens.

## VII. Phase 2 Deliverables (complete)

Backend foundation and the JWT authentication surface, under `backend/`:

1. Project files: `package.json`, `.env.example`, `.gitignore`.
2. Config: `src/config/env.js` (typed, fail-fast environment loader) and
   `src/config/constants.js` (enum mirrors, MSO disclosure text).
3. Database: `src/db/pool.js` (shared pg pool, startup verification, graceful
   close) and `src/db/query.js` (parameterized query and transaction helpers).
4. Utilities: `logger.js` (dependency-free structured JSON logger),
   `errors.js` (typed `AppError` set), `jwt.js` (access/refresh sign and
   verify), `tokens.js` (opaque token generation, SHA-256 hashing).
5. Services: `encryption.service.js` (AES-256-GCM PHI envelope encryption),
   `audit.service.js` (append-only `audit_log` writer), `auth.service.js`
   (register, login, refresh-token rotation with reuse detection, logout).
6. Models: `user.model.js`, `refresh-token.model.js`.
7. Middleware: `error-handler.js`, `authenticate.js`, `authorize.js`,
   `rate-limit.js`, `validate.js`.
8. Endpoints: `POST /api/auth/register`, `POST /api/auth/login`,
   `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`,
   plus the `GET /api/health` liveness probe.
9. `src/server.js` - Express bootstrap with helmet, CORS, cookie parsing,
   rate limiting, and SIGINT/SIGTERM graceful shutdown.

Refresh tokens are signed JWTs stored server-side as SHA-256 hashes, which
enables single-use rotation, revocation, and reuse detection.

## Next Phases

- Phase 3: Clinical triage form Web Component with branching logic.
- Phase 4: Triad service integrations (medical network, pharmacy, Stripe Connect).
- Phase 5: Patient and affiliate dashboards.
- Phase 6: Webhook receivers, jobs, audit hardening, certification review.
