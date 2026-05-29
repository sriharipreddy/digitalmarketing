# 🔑 marketing-core (Port 3100)
## Auth · Workspaces · Billing · Audit · SSO · Custom Domains

> **Tier 1 — Critical.** Everything else in the platform depends on this service for authentication, permissions, billing, and workspace identity.

---

## 1. Service Identity

| Field | Value |
|---|---|
| **Service Name** | `marketing-core` |
| **Port** | 3100 |
| **Maturity Tier** | Tier 1 — Critical |
| **SLA** | 99.9% uptime |
| **On-Call** | 24/7 |
| **Owning Team** | Platform Team |
| **Repository Path** | `services/marketing-core/` |

**One-sentence purpose:** Owns the identity, billing, and configuration of every workspace on the platform.

**Bounded context:** All concerns about *who can access what* and *who pays for what*. Authentication, authorization, billing, workspace management, audit logging, enterprise SSO, custom domain SSL.

---

## 2. Responsibilities (DO / DON'T)

### ✅ This service IS responsible for:
- User registration, login, password reset, email verification
- JWT issuance, refresh token rotation, session management
- Workspace CRUD + team member management + role assignment
- Permissions system (`core_permissions` per `core_roles`)
- Stripe subscription lifecycle (create, update, cancel, dunning)
- Plan + feature flag enforcement
- Audit logging (every state change recorded)
- Enterprise SAML / OIDC SSO connections
- Agency white-label settings + custom domain provisioning (ACME)
- 2FA setup, verification, step-up auth
- Support ticket creation
- Soft delete + hard delete (RTBF) orchestration of workspaces

### ❌ This service does NOT do:
- Send marketing emails → **`email-hub`** (only transactional auth emails like verification)
- Track web analytics → **`analytics-engine`**
- Provide public REST API → **`integration-service`** (proxies through to internal APIs)
- Generate AI content → **`content-ai`**
- Manage social accounts (their OAuth tokens) → **`social-hub`**
- Run cron jobs that touch business data (campaigns, posts, etc.) → respective services

### Examples of correct placement
- ❌ Wrong: "Create a campaign endpoint" in marketing-core → ✅ `campaign-manager`
- ❌ Wrong: "Send weekly digest emails" in marketing-core → ✅ `notification-service`
- ✅ Right: "Update workspace billing details" in marketing-core
- ✅ Right: "Invite team member endpoint" in marketing-core

---

## 3. Domain Model

### Tables Owned (15)

| Table | Purpose |
|---|---|
| `core_users` | Platform identity (email, password, type, status) |
| `core_workspaces` | One row per business — the tenancy boundary |
| `core_workspace_members` | User ↔ workspace association with role |
| `core_roles` | Per-workspace customisable roles (extends defaults) |
| `core_permissions` | Role → module → CRUD access map |
| `core_auth_sessions` | Refresh tokens with device info |
| `core_plans` | Subscription tiers (Free/Starter/Pro/Agency/Enterprise) |
| `core_subscriptions` | Per-workspace Stripe subscription state |
| `integ_api_keys` | API keys for the public API (managed via integration-service but owned here) |
| `core_agency_settings` | White-label branding (logo, colours, custom domain) |
| `core_agency_domains` | Custom domain verification + SSL cert state |
| `core_audit_log` | Every state change (append-only, partitioned by month) |
| `core_sso_connections` | SAML / OIDC config per workspace |
| `core_feature_flags` | Per-workspace + global feature toggles |
| `core_support_tickets` | In-app support ticket creation |

### Key Schema

```sql
CREATE TABLE core_users (
  id                CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  full_name         VARCHAR(255) NOT NULL,
  user_email        VARCHAR(255) NOT NULL UNIQUE,
  password_hash     VARCHAR(255),                          -- NULL if SSO-only
  google_id         VARCHAR(255),
  avatar_url        VARCHAR(500),
  type              ENUM('platform_admin','agency_owner','client_owner','team_member') NOT NULL,
  status            ENUM('active','suspended','invited','pending_verify') DEFAULT 'pending_verify',
  email_verified    TINYINT(1)   DEFAULT 0,
  verify_token      VARCHAR(255),
  verify_token_exp  DATETIME,
  totp_secret       VARCHAR(255),
  totp_required     TINYINT(1)   DEFAULT 0,
  webauthn_credentials JSON,
  backup_codes_hash JSON,
  last_2fa_at       DATETIME,
  trusted_devices   JSON,
  preferred_locale  CHAR(5)      DEFAULT 'en',
  last_login_at     DATETIME,
  created_at        DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        DATETIME     NULL,
  INDEX idx_email (user_email),
  INDEX idx_type_status (type, status)
) ENGINE=InnoDB;

CREATE TABLE core_workspaces (
  id                CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  name              VARCHAR(255) NOT NULL,
  slug              VARCHAR(100) UNIQUE,                   -- URL-safe identifier
  domain            VARCHAR(255),                          -- their primary website
  industry          VARCHAR(100),
  country           CHAR(2),
  timezone          VARCHAR(50)  DEFAULT 'Europe/London',
  business_address  JSON,                                  -- required for CAN-SPAM
  logo_url          VARCHAR(500),
  owner_id          CHAR(36)     NOT NULL,
  agency_id         CHAR(36),                              -- NULL if direct client
  plan_id           CHAR(36),
  status            ENUM('trial','active','past_due','suspended','cancelled','pending_deletion','deleted') DEFAULT 'trial',
  trial_ends_at     DATETIME,
  cancelled_at      DATETIME,
  settings          JSON,
  ip_allowlist      JSON,
  region            VARCHAR(20)  DEFAULT 'eu-west-2',
  created_at        DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        DATETIME     NULL,
  INDEX idx_owner (owner_id),
  INDEX idx_agency (agency_id),
  INDEX idx_status (status)
) ENGINE=InnoDB;

CREATE TABLE core_workspace_members (
  id                CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id      CHAR(36)     NOT NULL,
  user_id           CHAR(36)     NOT NULL,
  role              ENUM('owner','editor','analyst','viewer') NOT NULL,
  invited_by        CHAR(36),
  invite_token      VARCHAR(255),
  invite_expires_at DATETIME,
  joined_at         DATETIME,
  status            ENUM('active','invited','suspended') DEFAULT 'invited',
  created_at        DATETIME     DEFAULT CURRENT_TIMESTAMP,
  deleted_at        DATETIME     NULL,
  UNIQUE KEY uk_workspace_user (workspace_id, user_id),
  INDEX idx_workspace (workspace_id),
  INDEX idx_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE core_permissions (
  id            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  role_id       CHAR(36)     NOT NULL,
  module_name   VARCHAR(100) NOT NULL,
  access        JSON         NOT NULL,    -- {"c":true,"r":true,"u":false,"d":false}
  UNIQUE KEY uk_role_module (role_id, module_name)
) ENGINE=InnoDB;

CREATE TABLE core_audit_log (
  id            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id  CHAR(36),
  actor_id      CHAR(36),
  actor_type    ENUM('user','system','admin_impersonation') NOT NULL,
  impersonated_user_id CHAR(36),
  action        VARCHAR(100) NOT NULL,    -- 'workspace.created', 'campaign.launched'
  resource_type VARCHAR(50),
  resource_id   CHAR(36),
  before_state  JSON,
  after_state   JSON,
  ip_address    VARCHAR(45),
  user_agent    VARCHAR(500),
  request_id    VARCHAR(50),
  occurred_at   DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_workspace_time (workspace_id, occurred_at),
  INDEX idx_actor (actor_id),
  INDEX idx_action (action)
) ENGINE=InnoDB
PARTITION BY RANGE (TO_DAYS(occurred_at)) (
  PARTITION p_2026_q2 VALUES LESS THAN (TO_DAYS('2026-07-01')),
  PARTITION p_2026_q3 VALUES LESS THAN (TO_DAYS('2026-10-01')),
  PARTITION p_future   VALUES LESS THAN MAXVALUE
);

CREATE TABLE core_agency_settings (
  id                CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id      CHAR(36)     NOT NULL UNIQUE,
  brand_name        VARCHAR(255),
  brand_logo_url    VARCHAR(500),
  brand_colour      CHAR(7),
  brand_favicon_url VARCHAR(500),
  reply_to_email    VARCHAR(255),
  support_url       VARCHAR(255),
  hide_powered_by   TINYINT(1)   DEFAULT 0,
  report_footer     TEXT,
  created_at        DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        DATETIME     NULL
) ENGINE=InnoDB;

CREATE TABLE core_agency_domains (
  id                  CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id        CHAR(36)     NOT NULL,
  domain              VARCHAR(255) NOT NULL UNIQUE,
  verification_token  VARCHAR(100),
  domain_verified_at  DATETIME,
  tls_cert_pem_encrypted TEXT,                  -- AES-encrypted via per-workspace KEK
  tls_key_pem_encrypted  TEXT,
  cert_issued_at      DATETIME,
  cert_expires_at     DATETIME,
  status              ENUM('pending_verify','verifying','active','expired','disabled') DEFAULT 'pending_verify',
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at          DATETIME NULL,
  INDEX idx_workspace (workspace_id),
  INDEX idx_expiry (cert_expires_at)
) ENGINE=InnoDB;
```

### Invariants (this service enforces)

- A workspace always has exactly one `owner_id` (FK to `core_users`)
- Email verification required before workspace creation
- 2FA mandatory for `platform_admin` + `agency_owner` types
- Workspace transitions follow the state machine (see clients.md → workspace lifecycle)
- Audit log entries are immutable (no UPDATE / DELETE)

### State Machines

**Workspace lifecycle:** see `clients.md` → Workspace Lifecycle State Machine (8 states, 13 transitions).

**Auth session lifecycle:**
```
active → revoked (via logout or admin force)
active → expired (after 30 days)
```

---

## 4. API Contract (REST)

### Endpoint Catalogue

| Method | Path | Auth | Permission | Idempotency |
|---|---|---|---|---|
| POST | `/auth/register` | — | — | No |
| POST | `/auth/login` | — | — | No |
| POST | `/auth/google` | — | — | No |
| POST | `/auth/saml/:workspace_id/initiate` | — | — | No |
| POST | `/auth/saml/:workspace_id/callback` | — | — | No |
| POST | `/auth/logout` | JWT | — | No |
| POST | `/auth/refresh-token` | Refresh cookie | — | No |
| POST | `/auth/verify-email` | — | — | No |
| POST | `/auth/forgot-password` | — | — | No |
| POST | `/auth/reset-password` | — | — | No |
| POST | `/auth/2fa/setup` | JWT | — | No |
| POST | `/auth/2fa/verify` | JWT | — | No |
| GET | `/users/me` | JWT | — | — |
| PATCH | `/users/me` | JWT | — | Yes |
| DELETE | `/users/me` | JWT + 2FA | — | No |
| GET | `/workspaces` | JWT | — | — |
| POST | `/workspaces` | JWT | — | Yes |
| GET | `/workspaces/:id` | JWT | `workspace:r` | — |
| PATCH | `/workspaces/:id` | JWT + 2FA | `workspace:u` | Yes |
| DELETE | `/workspaces/:id` | JWT + 2FA | `workspace:d` | No |
| GET | `/workspaces/:id/members` | JWT | `members:r` | — |
| POST | `/workspaces/:id/members/invite` | JWT | `members:c` | Yes |
| PATCH | `/workspaces/:id/members/:user_id` | JWT | `members:u` | Yes |
| DELETE | `/workspaces/:id/members/:user_id` | JWT | `members:d` | No |
| GET | `/workspaces/:id/roles` | JWT | `roles:r` | — |
| POST | `/workspaces/:id/roles` | JWT | `roles:c` | Yes |
| PATCH | `/roles/:id/permissions` | JWT | `roles:u` | Yes |
| POST | `/billing/subscribe` | JWT + 2FA | `billing:c` | Yes |
| POST | `/billing/portal` | JWT | `billing:r` | — |
| POST | `/billing/webhook` | Stripe signature | — | Built-in |
| GET | `/billing/usage` | JWT | `billing:r` | — |
| POST | `/billing/topup/ai-credits` | JWT + 2FA | `billing:c` | Yes |
| GET | `/audit-log` | JWT | `audit_log:r` | — |
| POST | `/sso/connections` | JWT (agency_owner) | `sso:c` | Yes |
| PATCH | `/sso/connections/:id` | JWT (agency_owner) + 2FA | `sso:u` | Yes |
| POST | `/agency/settings` | JWT (agency_owner) | `agency:u` | Yes |
| POST | `/agency/domains` | JWT (agency_owner) + 2FA | `agency:c` | Yes |
| POST | `/agency/domains/:id/verify` | JWT (agency_owner) | `agency:u` | No |
| GET | `/feature-flags` | JWT | — | — |
| POST | `/support/tickets` | JWT | — | Yes |
| GET | `/health` | — | — | — |
| GET | `/ready` | — | — | — |
| GET | `/live` | — | — | — |
| GET | `/metrics` | Internal-only | — | — |

### Sample Endpoint: `POST /auth/login`

```http
POST /api/v1/core/auth/login HTTP/1.1
Host: api.yourplatform.com
Content-Type: application/json

{
  "email": "sarah@pizzapalace.london",
  "password": "Sup3rSecur3!"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGc...",   /* 15-minute JWT */
  "expires_in": 900,
  "token_type": "Bearer",
  "user": {
    "id": "usr_01H...",
    "name": "Sarah Smith",
    "email": "sarah@pizzapalace.london",
    "avatar_url": "https://...",
    "type": "client_owner",
    "preferred_locale": "en"
  },
  "workspace": {
    "id": "ws_01H...",
    "name": "Pizza Palace",
    "plan": "pro",
    "role": "owner",
    "permissions": [
      { "module_name": "seo_keywords", "access": { "c": true, "r": true, "u": true, "d": true } },
      ...
    ]
  }
}
```

Sets HTTP-only cookie:
```
Set-Cookie: refresh_token=<hex>; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/core/auth; Max-Age=2592000
```

**Errors:**
- `401 authentication_required` — wrong credentials
- `423 locked` — account suspended (Redis cache check)
- `429 rate_limit_exceeded` — 5+ failed attempts within 1 hour
- `400 validation_failed` — malformed input

### Sample Endpoint: `POST /workspaces/:id/members/invite`

```http
POST /api/v1/core/workspaces/ws_01H.../members/invite HTTP/1.1
Authorization: Bearer eyJhbGc...
Content-Type: application/json
Idempotency-Key: invite-jane-2026-05-28

{
  "email": "jane@pizzapalace.london",
  "role": "editor"
}
```

**Response (201):**
```json
{
  "id": "wm_01H...",
  "email": "jane@pizzapalace.london",
  "role": "editor",
  "status": "invited",
  "invite_expires_at": "2026-05-30T10:00:00Z"
}
```

Side effects:
- INSERT into `core_workspace_members` (status=invited, invite_token=...)
- Send invitation email via `email-hub` transactional channel
- Publish `core.member.invited` event
- Audit log entry

---

## 5. Async Events (Pub/Sub)

### Events Published

| Event | When | Consumers |
|---|---|---|
| `core.user.signed_up` | New registration completed | notification-service, analytics-engine |
| `core.user.email_verified` | Email verification clicked | notification-service |
| `core.workspace.created` | Workspace creation finalised | analytics-engine, integration-service, notification-service |
| `core.workspace.upgraded` | Plan upgraded | analytics-engine, notification-service |
| `core.workspace.downgraded` | Plan downgraded | analytics-engine, notification-service |
| `core.workspace.cancelled` | Cancellation triggered | ALL services (must respect read-only mode) |
| `core.workspace.deleted` | Hard delete complete | ALL services (final cleanup) |
| `core.workspace.suspended` | Non-payment suspension | ALL services |
| `core.member.invited` | Team member invitation sent | notification-service |
| `core.member.joined` | Invitation accepted | notification-service |
| `core.member.removed` | Member removed from workspace | ALL services (token revocation) |
| `core.member.role_changed` | Role updated | ALL services (permission cache refresh) |
| `core.subscription.payment_succeeded` | Stripe paid invoice | notification-service |
| `core.subscription.payment_failed` | Stripe failed invoice | notification-service |
| `core.audit.logged` | High-severity action (every export, delete, billing change) | (internal — for SIEM in Phase 4) |

### Events Consumed

| Event | Source | Action |
|---|---|---|
| (all events) | (all services) | Audit log entry (for SOC 2 evidence) |

### Bull Queues Owned

| Queue | Purpose | Schedule | Concurrency | Retry |
|---|---|---|---|---|
| `mkt-billing-dunning` | Past-due reminder emails | Daily 09:00 UTC | 1 | 3 retries |
| `mkt-cert-renewal` | Renew Let's Encrypt certs expiring < 14 days | Daily 02:00 UTC | 2 | 5 retries |
| `mkt-workspace-deletion` | Hard delete after grace period | Daily 04:00 UTC | 1 | 3 retries |
| `mkt-audit-log-flush` | Buffered batch insert (30s batches) | Every 30s | 1 | 3 retries |
| `mkt-elasticsearch-sync` | Sync workspace/user changes to ES | Every 1m | 2 | 5 retries |
| `mkt-stripe-event` | Process Stripe webhooks asynchronously | On-demand | 5 | 5 retries |
| `mkt-2fa-cleanup` | Remove expired 2FA backup codes | Daily 01:00 UTC | 1 | 3 retries |
| `mkt-rtbf-purge` | Coordinate RTBF deletion across services | On-demand | 1 | 3 retries (then alert) |

---

## 6. Dependencies

### Upstream Sync REST Calls
None — this is foundational. Calls only external APIs.

### Downstream (services that call marketing-core sync)
- **ALL 13 other services** call marketing-core for:
  - `GET /internal/users/:id/permissions` (cached in Redis 5min TTL)
  - `GET /internal/workspaces/:id/plan-features` (cached)
  - `GET /internal/workspaces/:id/status` (cached for adminStatusGuard pattern)
- Frontend calls marketing-core for all auth + workspace operations

### External APIs

| Provider | Used For | Rate Limit Handling |
|---|---|---|
| **Stripe** | Subscriptions, payments, Connect (affiliate payouts) | 100 req/sec; retry on 429 with `Retry-After` |
| **SendGrid** | Transactional emails (verify, invite, reset, dunning) | Plan-dependent; queued in `mkt-stripe-event` |
| **AWS KMS** | Master DEK for per-workspace KEK derivation | High limits; circuit breaker if down (block writes) |
| **Let's Encrypt (ACME)** | Custom domain SSL certs | 50 certs/week per domain; tracked in audit |
| **Cloudflare API** | DNS-01 challenge for ACME | 1200 req/5min; sparingly used (cert renewals) |
| **Google OAuth** | Google SSO | 10k req/sec; standard handling |
| **HaveIBeenPwned** | Password breach check | 1500 req/sec free; k-anonymity model |

### Shared Database Tables (read-only access from other services)
- Other services may read `core_users`, `core_workspaces`, `core_workspace_members`, `core_permissions` **only via internal API** (not direct DB) to maintain bounded context

### Redis Keys

| Key Pattern | TTL | Purpose |
|---|---|---|
| `mkt:session:<refresh_token>` | 30 days | Refresh token lookup |
| `mkt:user_perms:<user_id>:<workspace_id>` | 5 min | Cached permission set |
| `mkt:workspace_status:<workspace_id>` | 1 min | Cached workspace status (admin guard) |
| `mkt:rate_limit:login:<email>` | 1 hour | Failed login attempts |
| `mkt:rate_limit:register:<ip>` | 1 hour | Anti-bot signup throttle |
| `mkt:dsar_token:<token>` | 24 hours | DSAR email verification token |
| `mkt:invite_token:<token>` | 48 hours | Member invitation token |
| `mkt:cert_renewal_lock:<domain>` | 10 min | Prevent concurrent ACME renewals |

### Inter-Service Authentication
Internal endpoints (`/internal/*`) require service JWT:
```
type: 'service'
from: <calling-service>
to: 'marketing-core'
exp: now + 5 min
```

---

## 7. Folder Structure

```
services/marketing-core/
├── _config/
│   ├── db.config.js          # Sequelize MySQL/PostgreSQL
│   ├── redis.config.js
│   ├── passport.config.js    # JWT + Google + SAML strategies
│   ├── stripe.config.js
│   └── index.js
├── _helpers/
│   ├── redis.js              # initQueue() Bull factory
│   ├── email-templates.js    # Handlebars templates for transactional
│   ├── totp.js               # otplib helpers
│   ├── webauthn.js
│   ├── kms-kek.js            # Per-workspace KEK derivation
│   └── acme-client.js        # Let's Encrypt ACME v2
├── _services/
│   ├── auth.service.js       # register/login/logout/refresh
│   ├── workspace.service.js
│   ├── member.service.js
│   ├── role.service.js
│   ├── permission.service.js
│   ├── billing.service.js    # Stripe subscriptions
│   ├── audit.service.js
│   ├── sso.service.js        # SAML/OIDC
│   ├── agency.service.js
│   ├── domain.service.js     # Custom domain provisioning
│   ├── twofa.service.js
│   ├── support.service.js
│   └── feature-flag.service.js
├── controllers/
│   ├── auth.controller.js
│   ├── workspace.controller.js
│   ├── ...
├── routes/
│   ├── auth.routes.js
│   ├── workspaces.routes.js
│   ├── billing.routes.js
│   ├── internal.routes.js    # /internal/* — service-to-service
│   └── index.js
├── middleware/
│   ├── stripe-webhook-verify.js
│   ├── admin-status-guard.js  # Redis-cached workspace status check
│   ├── two-fa-required.js     # Step-up auth for sensitive actions
│   └── audit-logger.js        # Auto-log state changes
├── models/
│   ├── user.model.js
│   ├── workspace.model.js
│   ├── workspace-member.model.js
│   ├── role.model.js
│   ├── permission.model.js
│   ├── auth-session.model.js
│   ├── plan.model.js
│   ├── subscription.model.js
│   ├── api-key.model.js
│   ├── agency-settings.model.js
│   ├── agency-domain.model.js
│   ├── audit-log.model.js
│   ├── sso-connection.model.js
│   ├── feature-flag.model.js
│   ├── support-ticket.model.js
│   └── index.js
├── migrations/
│   ├── 20260101000001-create-mkt-users.js
│   ├── 20260101000002-create-mkt-workspaces.js
│   └── ...
├── cron/
│   ├── billing-dunning.cron.js
│   ├── cert-renewal.cron.js
│   ├── workspace-deletion.cron.js
│   └── audit-log-flush.cron.js
├── events/
│   ├── publish.js            # Event emitter wrapper
│   └── subscribers/          # (empty — this service only publishes)
├── test/
├── openapi.yaml
├── Dockerfile
├── package.json
├── README.md
└── app.js
```

---

## 8. Configuration

### Required `.env` Variables

```bash
# Service Identity
SERVICE_NAME=marketing-core
NODE_ENV=production
PORT=3100

# Database (DUAL DIALECT — MySQL in dev, PostgreSQL in production)
# Local/staging:  DB_DIALECT=mysql      DATABASE_URL=mysql://...:3306/marketing
# Production:     DB_DIALECT=postgres   DATABASE_URL=postgres://...:5432/marketing
DB_DIALECT=mysql                                  # 'mysql' (dev) | 'postgres' (prod)
DATABASE_URL=mysql://app_write:****@primary-rds:3306/marketing?ssl-mode=REQUIRED
DATABASE_READ_URL=mysql://app_read:****@replica-rds:3306/marketing?ssl-mode=REQUIRED
DB_POOL_MAX=10
DB_POOL_MIN=2
DB_SSL_REJECT_UNAUTHORIZED=true                   # production only

# Redis
REDIS_URL=rediss://****@redis-cluster:6379/0

# Auth
JWT_SECRET=****                              # min 64 chars; same as existing platform for SSO
JWT_ACCESS_TOKEN_LIFETIME=15m
JWT_REFRESH_TOKEN_LIFETIME=30d
BCRYPT_ROUNDS=10
COOKIE_DOMAIN=.yourplatform.com
COOKIE_SECURE=true

# Encryption
MASTER_DEK_HEX=****                          # 32-byte hex; rotated via KMS
KMS_KEY_ARN=arn:aws:kms:eu-west-2:****       # Phase 3+ for KMS-backed rotation

# Stripe
STRIPE_SECRET_KEY=sk_live_****
STRIPE_PUBLISHABLE_KEY=pk_live_****
STRIPE_WEBHOOK_SECRET=whsec_****
STRIPE_CONNECT_CLIENT_ID=ca_****

# SendGrid (transactional only — marketing emails via email-hub)
SENDGRID_API_KEY=SG.****
TRANSACTIONAL_FROM_EMAIL=noreply@yourplatform.com
TRANSACTIONAL_FROM_NAME=YourPlatform

# Google OAuth
GOOGLE_CLIENT_ID=****
GOOGLE_CLIENT_SECRET=****
GOOGLE_REDIRECT_URI=https://api.yourplatform.com/api/v1/core/auth/google/callback

# ACME / Let's Encrypt
ACME_DIRECTORY_URL=https://acme-v02.api.letsencrypt.org/directory
ACME_ACCOUNT_EMAIL=ops@yourplatform.com
CLOUDFLARE_DNS_API_TOKEN=****

# Have I Been Pwned (free, no key)
HIBP_USER_AGENT=YourPlatform-Auth/1.0

# Observability
SENTRY_DSN=https://****
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
LOG_LEVEL=info

# Feature Flags
FEATURE_SAML_SSO_ENABLED=true
FEATURE_WHITE_LABEL_ENABLED=true
```

### Environment Differences

| Variable | Local | Staging | Production |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | sk_test_* | sk_test_* | sk_live_* |
| `JWT_SECRET` | dev-secret | from Vault | from Vault |
| `DATABASE_URL` | local docker | staging RDS | prod RDS Multi-AZ |
| `ACME_DIRECTORY_URL` | staging LE | staging LE | production LE |
| `LOG_LEVEL` | debug | info | warn |

---

## 9. Deployment & Operations

### Dockerfile (multi-stage)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=false
COPY . .
RUN yarn build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=2 \
  CMD wget -q --spider http://localhost:3100/health || exit 1
CMD ["node", "dist/app.js"]
```

### ECS Task Definition

```yaml
cpu: 1024              # 1 vCPU
memory: 2048           # 2 GB
desiredCount: 2        # always min 2 (HA across AZs)
autoScaling:
  min: 2
  max: 10
  cpuThreshold: 70%
  requestsPerTargetThreshold: 1000   # scale at 1k req/min per task
stopTimeout: 30s
healthCheckGracePeriod: 60s
```

### Required Infrastructure

- PostgreSQL RDS access (primary + replicas)
- Redis ElastiCache access
- AWS KMS access (for KEK derivation)
- Cloudflare API access (for DNS-01)
- Outbound HTTPS to Stripe, SendGrid, Google, Let's Encrypt, HIBP

### Health Check

`GET /health` checks:
- MySQL/PostgreSQL SELECT 1 (timeout 1s)
- Redis PING (timeout 500ms)
- Stripe heartbeat (cached 30s; checks `customer.list` with limit=1)

Returns `503` if MySQL/PostgreSQL or Redis down (critical); `200` with `degraded` status if Stripe slow.

---

## 10. Observability

### Required Log Fields
All logs include: `request_id`, `workspace_id`, `user_id`, `actor_type`, `action`.

### Service-Specific Metrics

```
mkt_signups_total{plan}                                  Counter
mkt_signup_completed_total{plan}                         Counter   (after email verify)
mkt_login_total{method, status}                          Counter   (method=password/google/saml)
mkt_token_refresh_total{status}                          Counter
mkt_workspace_created_total{plan, is_agency_client}      Counter
mkt_workspace_cancelled_total{plan, reason}              Counter
mkt_mrr_usd_gauge                                         Gauge
mkt_arr_usd_gauge                                         Gauge
mkt_active_workspaces_gauge{tier}                         Gauge
mkt_audit_log_writes_total{action}                       Counter
mkt_cert_renewals_total{status}                          Counter
mkt_failed_login_total{reason}                           Counter
mkt_2fa_setup_total                                      Counter
mkt_2fa_verify_total{status}                             Counter
```

### OpenTelemetry Spans

- `marketing-core.login.full-flow`
- `marketing-core.workspace.create`
- `marketing-core.billing.subscribe`
- `marketing-core.stripe-webhook.process`
- `marketing-core.acme.renew-cert`

### Alerts Owned

| Alert | Severity | Runbook |
|---|---|---|
| `MarketingCoreDown` | P1 | `runbooks/service-down.md` |
| `HighFailedLoginRate` | P2 | `runbooks/credential-stuffing.md` |
| `StripeWebhookFailures` | P2 | `runbooks/stripe-webhook-failures.md` |
| `CertRenewalFailed` | P3 | `runbooks/cert-renewal-failed.md` |
| `AuditLogBacklog` | P3 | `runbooks/audit-log-backlog.md` |

### Grafana Dashboards

- "Marketing Core — Service Health"
- "Marketing Core — Auth Flow"
- "Marketing Core — Billing State"
- "Marketing Core — Active Workspaces by Tier"

---

## 11. Security

### Authentication
- Most endpoints require Passport JWT
- Public endpoints: `/auth/register`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email`, `/billing/webhook`
- 2FA step-up required for: workspace deletion, billing changes, member removal, SSO configuration, custom domain provisioning, data export

### Permissions Registered

Module names registered with the central permission system:
- `workspace` (CRUD)
- `members` (CRUD + `invite`)
- `roles` (CRUD)
- `billing` (CRUD)
- `audit_log` (R only — no write)
- `sso` (CRUD)
- `agency` (CRUD)
- `feature_flags` (CRUD — admin only)

### PII Handled
- `core_users.user_email`, `core_users.full_name`, `core_users.avatar_url`, `core_users.totp_secret`
- `core_workspaces.business_address`
- `core_audit_log.actor_id`, `core_audit_log.ip_address`, `core_audit_log.user_agent`

**Retention:** see `compliance.md` Data Retention Schedule.

### OAuth Tokens Handled
- Google OAuth tokens (login only — not stored long-term; profile fetched at login)
- ACME account key (encrypted in DB, derived from master KEK)

### Webhook Signatures Verified
- Stripe: HMAC-SHA256 via `stripe.webhooks.constructEvent()`

### Threat Model Specific

- **Credential stuffing** — rate limit per email + per IP; CAPTCHA after 3 failures
- **JWT theft** — short access token (15min); refresh token bound to device fingerprint (Phase 4)
- **Refresh token replay** — single-use refresh tokens with rotation (each refresh issues a new one)
- **Session fixation** — new session token on every login; old sessions optionally revoked via "logout all"
- **Workspace privilege escalation** — `requirePermission` middleware enforced at route level; auto-tests verify
- **Custom domain abuse** — verification token must be present in DNS TXT record before cert issuance
- **Stripe webhook spoofing** — signature verification mandatory; timestamp replay protection

---

## 12. Testing

### Unit Test Focus
- Password hashing/verification round-trip
- JWT signing/verification with various claims
- Permission resolution algorithm
- TOTP code generation + verification (otplib)
- ACME challenge construction
- Stripe webhook signature verification

### Integration Tests Required
- Full registration → email verify → login → JWT validation flow
- Workspace CRUD with permission checks
- Member invite → accept → role enforcement
- Stripe subscription create → webhook → state update
- Billing webhook idempotency (replay same event = no double-process)
- Audit log writes on every state change
- 2FA setup + step-up auth flow

### Workspace Isolation Tests
- User A cannot list / get / modify / delete workspace B's resources
- Agency owner can access linked client workspaces
- Agency owner cannot access non-linked workspaces
- Platform admin can access all with audit log entry

### E2E Flow Tests (Playwright)
- Signup → onboarding → first dashboard view
- Invite team member → accept invite → access workspace
- Upgrade plan flow
- Cancel subscription flow

### Mock Strategy
- Stripe: `nock` to mock API; replay webhook events from JSON fixtures
- SendGrid: log-only mock (don't send real email)
- ACME: mock LE staging directory

### Load Test Targets
- `POST /auth/login` — 100 req/sec sustained, P95 < 500ms
- `GET /users/me` — 1000 req/sec sustained, P95 < 100ms (cached)
- `GET /internal/users/:id/permissions` — 5000 req/sec (heavily cached)

---

## 13. Local Development

### Start the service
```bash
cd services/marketing-core
yarn install
cp .env.example .env.local
docker compose up mysql redis          # local dev = MySQL (production uses PostgreSQL via DATABASE_URL switch)
yarn migrate
yarn seed                              # seeds plans, default roles, test admin user
yarn dev                               # nodemon + babel
```

### Test data seeded
- Platform admin: `admin@yourplatform.local` / `AdminDev1234!`
- Test agency: workspace `Test Agency` with owner `agency@test.local` / `TestPass1234!`
- Test client: workspace `Test Pizza` with owner `client@test.local` / `TestPass1234!`
- All Stripe plans created in test mode

### Common Gotchas
- ACME challenges fail locally — use `ACME_DIRECTORY_URL=https://acme-staging-v02.api.letsencrypt.org/directory` and a real DNS-controlled subdomain, OR set `FEATURE_CUSTOM_DOMAIN_ENABLED=false`
- Stripe webhooks need `stripe listen --forward-to localhost:3100/api/v1/core/billing/webhook` running
- Google OAuth requires `localhost:3000` added as authorized redirect URI in Google Cloud Console
- 2FA flow blocks dev iteration — use `FEATURE_2FA_REQUIRED=false` to disable in local

### Useful Debug Endpoints (dev only)
- `GET /debug/jwt/verify?token=...` — decode + validate any JWT
- `GET /debug/cache/clear?key=...` — clear specific Redis key
- `POST /debug/simulate-stripe-event` — fire any Stripe event from fixture

---

## 14. Runbooks

### "marketing-core is down"
1. Check Sentry for errors in last 5 min
2. Check `/health` from internal network — which dependency is failing?
3. If MySQL/PostgreSQL: check RDS health, consider failover to replica (auto if Multi-AZ)
4. If Redis: services degrade but should not crash (warn-level log; fall back to no cache)
5. If both healthy: check ECS task health → roll back if recent deploy

### "Mass failed logins"
1. Grafana: check `mkt_failed_login_total{reason}` spike
2. Identify pattern: single email targeted (account takeover attempt) vs many emails (credential stuffing)
3. Single email: lock the account temporarily; email owner; force password reset
4. Many emails: Cloudflare rate limit + bot fight mode; raise CAPTCHA threshold
5. Audit log review for successful logins from suspicious IPs

### "Stripe webhook backlog"
1. Check Bull dashboard for `mkt-stripe-event` queue depth
2. If > 1000 jobs: scale up workers temporarily (ECS service desiredCount × 2)
3. Check Sentry for processing errors — common cause: schema drift between Stripe API version and our code
4. Replay failed jobs from Stripe Dashboard once underlying issue fixed

### "Custom domain SSL renewal failed"
1. Check `mkt-cert-renewal` queue for failed job
2. Common cause: Cloudflare API token expired or DNS-01 propagation slow
3. Check DNS: `dig TXT _acme-challenge.<domain>`
4. Manually re-trigger renewal: `POST /admin/domains/:id/renew`
5. If multiple failures: pause renewals, investigate ACME rate limits (50/week per registered domain)

### "Mass workspace cancellation event"
1. Check `core.workspace.cancelled` event rate via Grafana
2. If anomalous spike: pause `mkt-workspace-deletion` cron (operator override)
3. Investigate: billing system issue? Marketing site issue (broken signup)? Adversarial cancellation?
4. Communicate with customers if false positive
5. Manually undo cancellations once cause identified

### "RTBF (Right to be Forgotten) request stuck"
1. Check `mkt-rtbf-purge` queue → find failed sub-jobs (one per service)
2. Common cause: one service can't delete (FK constraint, S3 cleanup failing)
3. Fix root cause, manually retry from DLQ
4. SLA: complete within 30 days of approval — escalate if approaching 25 days
