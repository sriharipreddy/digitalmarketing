# 🔌 integration-service (Port 3113)
## Public REST API · Outbound Webhooks · Zapier · Data Import/Export

> **Tier 1 — Enterprise critical.** No public API = no enterprise sales. Highest customer-facing surface area.

---

## 1. Service Identity

| Field | Value |
|---|---|
| **Service Name** | `integration-service` |
| **Port** | 3113 |
| **Maturity Tier** | Tier 1 |
| **SLA** | 99.9% uptime |
| **On-Call** | 24/7 |
| **Owning Team** | API Team |

**One-sentence purpose:** Single gateway for everything customers do programmatically — public REST API, outbound webhooks, Zapier integration, data imports/exports.

**Bounded context:** Customer-facing programmatic surface. All `/api/v2/` endpoints. All outbound webhooks. All customer integrations (Zapier, HubSpot import, etc.).

---

## 2. Responsibilities (DO / DON'T)

### ✅ DO
- Host `/api/v2/*` public REST API (proxies to internal services)
- API key issuance + revocation + scopes management
- OAuth 2.0 server for third-party apps (Zapier, custom integrations)
- Outbound webhook subscription management
- Webhook delivery (with signing, retry, DLQ)
- Webhook event catalog
- Zapier app integration (triggers + actions + searches)
- Data import workflows (HubSpot, Mailchimp, Klaviyo, ActiveCampaign, ConvertKit, CSV)
- Data export workflows (DSAR-grade JSON+CSV exports)
- Per-API-key rate limiting
- API documentation hosting (`docs.yourplatform.com` — OpenAPI 3.1)
- SDK distribution (JavaScript, Python — auto-generated from OpenAPI)

### ❌ DON'T
- Implement business logic — proxy to the right service
- Authenticate users via password → marketing-core
- Send marketing emails → email-hub
- Be the system-of-record — we are an adapter only

---

## 3. Domain Model

### Tables Owned (8)

| Table | Purpose |
|---|---|
| `integ_api_keys` | API keys per workspace per user |
| `integ_oauth_apps` | Third-party OAuth apps (Zapier, custom) |
| `integ_oauth_tokens` | Issued OAuth tokens per (user, app) |
| `integ_webhooks` | Customer webhook subscriptions |
| `integ_webhook_events` | Master event catalog (definitions) |
| `integ_webhook_deliveries` | Per-delivery record (high volume; partitioned) |
| `integ_data_imports` | Import job records |
| `integ_data_import_rows` | Per-row import status |
| `integ_data_exports` | Export job records |
| `integ_zapier_subscriptions` | Zapier REST Hook subscriptions |

### Key Schemas

```sql
CREATE TABLE integ_api_keys (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  user_id         CHAR(36)     NOT NULL,
  name            VARCHAR(100) NOT NULL,
  key_prefix      VARCHAR(20),                    -- first 10 chars for identification
  key_hash        VARCHAR(255) NOT NULL,          -- bcrypt
  scopes          JSON,                            -- ['read:contacts','write:campaigns']
  mode            ENUM('live','test') DEFAULT 'live',
  last_used_at    DATETIME,
  expires_at      DATETIME,                        -- NULL = never
  ip_allowlist    JSON,
  status          ENUM('active','revoked','expired') DEFAULT 'active',
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  INDEX idx_workspace (workspace_id),
  INDEX idx_key_prefix (key_prefix)
) ENGINE=InnoDB;

CREATE TABLE integ_webhooks (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36) NOT NULL,
  url             VARCHAR(2048) NOT NULL,
  events          JSON,                            -- subscribed events
  secret          VARCHAR(255),                    -- HMAC secret (encrypted at rest)
  description     VARCHAR(255),
  status          ENUM('active','disabled','failing') DEFAULT 'active',
  consecutive_failures INT DEFAULT 0,
  last_success_at DATETIME,
  last_failure_at DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  INDEX idx_workspace (workspace_id),
  INDEX idx_status (status)
) ENGINE=InnoDB;

CREATE TABLE integ_webhook_deliveries (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  webhook_id      CHAR(36) NOT NULL,
  workspace_id    CHAR(36) NOT NULL,
  event_id        CHAR(36),
  event_type      VARCHAR(100),
  attempt         INT,
  request_url     VARCHAR(2048),
  request_body    JSON,
  response_status INT,
  response_body   TEXT,
  duration_ms     INT,
  status          ENUM('pending','succeeded','failed','retrying','dlq'),
  next_retry_at   DATETIME,
  delivered_at    DATETIME,
  created_at      DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_webhook_time (webhook_id, created_at),
  INDEX idx_status (status, next_retry_at)
) ENGINE=InnoDB
PARTITION BY RANGE (TO_DAYS(created_at)) (
  PARTITION p_2026_q2 VALUES LESS THAN (TO_DAYS('2026-07-01')),
  ...
);

CREATE TABLE integ_data_imports (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36) NOT NULL,
  source          ENUM('csv','hubspot','mailchimp','klaviyo','activecampaign','convertkit','salesforce','google_sheets'),
  target          ENUM('contacts','companies','deals','subscribers'),
  config          JSON,                            -- mapping + options
  total_rows      INT,
  processed_rows  INT DEFAULT 0,
  succeeded_rows  INT DEFAULT 0,
  failed_rows     INT DEFAULT 0,
  status          ENUM('queued','running','completed','failed','cancelled') DEFAULT 'queued',
  started_at      DATETIME,
  completed_at    DATETIME,
  error_csv_url   VARCHAR(500),                    -- S3 URL for failed-rows download
  created_by      CHAR(36),
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_workspace (workspace_id),
  INDEX idx_status (status)
) ENGINE=InnoDB;
```

---

## 4. API Contract

### Internal management endpoints (under `/api/v1/integrate/`)

| Method | Path | Auth |
|---|---|---|
| GET | `/api-keys` | JWT |
| POST | `/api-keys` | JWT |
| DELETE | `/api-keys/:id` | JWT + 2FA |
| GET | `/webhooks` | JWT |
| POST | `/webhooks` | JWT |
| DELETE | `/webhooks/:id` | JWT |
| GET | `/webhooks/:id/deliveries` | JWT |
| POST | `/webhooks/:id/deliveries/:delivery_id/replay` | JWT |
| GET | `/imports` | JWT |
| POST | `/imports` | JWT |
| GET | `/imports/:id/status` | JWT |
| GET | `/imports/:id/failed-rows` | JWT |
| POST | `/exports` | JWT |
| GET | `/exports/:id/status` | JWT |
| GET | `/zapier/auth` | (Zapier OAuth) |
| POST | `/zapier/subscribe` | API key (Zapier) |

### Public REST API endpoints (under `/api/v2/`)

Full surface — see `public-api.md` for complete spec.

### Sample: Public API authentication

```http
GET /api/v2/contacts?limit=50 HTTP/1.1
Host: api.yourplatform.com
Authorization: Bearer mkt_live_AbCdEfGh...
```

This service:
1. Validates API key (bcrypt match against `integ_api_keys.key_hash`)
2. Extracts workspace_id + scopes from API key record
3. Checks rate limit
4. Issues a short-lived service JWT
5. Proxies request to `crm-automation`'s internal endpoint
6. Returns response

---

## 5. Async Events

### Consumed (ALL events — fans out to subscribed customer webhooks)

Every event published by any service is consumed here. For each event:
1. Find matching active webhook subscriptions
2. Sign payload with subscription's HMAC secret
3. Enqueue delivery in `mkt-webhook-delivery`

### Bull Queues

| Queue | Purpose | Schedule | Concurrency |
|---|---|---|---|
| `mkt-webhook-delivery` | Send signed webhook POSTs | Every 30s | 20 |
| `mkt-webhook-retry` | DLQ; manual replay | On-demand | 5 |
| `mkt-data-import` | Bulk import workers | On-demand | 5 |
| `mkt-data-export` | DSAR + custom exports | On-demand | 3 |
| `mkt-api-rate-limit-decay` | Token bucket refill | Continuous | 1 |

---

## 6. Dependencies

### Upstream (this service calls every other service via internal API)
- All 13 other services

### External
- **HubSpot API** — data import
- **Mailchimp API** — data import
- **Klaviyo API** — data import
- **ActiveCampaign / ConvertKit / Salesforce** — data import
- **Zapier platform** — REST Hooks + manual polling

---

## 7. Folder Structure (standard)

## 8. Configuration

```bash
SERVICE_NAME=integration-service
NODE_ENV=production
PORT=3113

# Database
DB_DIALECT=mysql
DATABASE_URL=mysql://app_write:****@primary:3306/marketing?ssl-mode=REQUIRED
DB_POOL_MAX=15
DB_POOL_MIN=3

# Redis (high-volume rate limiting + queues)
REDIS_URL=rediss://****@redis-cluster:6379/0

# Auth
JWT_SECRET=****
API_KEY_HASH_SALT_ROUNDS=10                       # bcrypt rounds for API key hashing
OAUTH_AUTHORIZATION_CODE_TTL_MIN=10
OAUTH_ACCESS_TOKEN_TTL_HOURS=1
OAUTH_REFRESH_TOKEN_TTL_DAYS=90

# Public API
PUBLIC_API_DOMAIN=api.yourplatform.com
PUBLIC_API_SANDBOX_DOMAIN=api-sandbox.yourplatform.com
PUBLIC_API_RATE_LIMIT_FREE_PER_MIN=30
PUBLIC_API_RATE_LIMIT_STARTER_PER_MIN=100
PUBLIC_API_RATE_LIMIT_PRO_PER_MIN=1000
PUBLIC_API_RATE_LIMIT_AGENCY_PER_MIN=5000

# Outbound Webhooks
WEBHOOK_DELIVERY_TIMEOUT_MS=10000
WEBHOOK_MAX_RETRIES=7
WEBHOOK_RETRY_BACKOFF=exponential                 # 1m, 5m, 30m, 2h, 6h, 12h, 24h
WEBHOOK_AUTO_DISABLE_CONSECUTIVE_FAILURES=50
WEBHOOK_USER_AGENT=YourPlatform-Webhooks/2.0

# Zapier
ZAPIER_OAUTH_CLIENT_ID=****
ZAPIER_OAUTH_CLIENT_SECRET=****

# Data Import Providers
HUBSPOT_OAUTH_CLIENT_ID=****
HUBSPOT_OAUTH_CLIENT_SECRET=****
MAILCHIMP_OAUTH_CLIENT_ID=****
MAILCHIMP_OAUTH_CLIENT_SECRET=****
KLAVIYO_OAUTH_CLIENT_ID=****
KLAVIYO_OAUTH_CLIENT_SECRET=****
SALESFORCE_OAUTH_CLIENT_ID=****
SALESFORCE_OAUTH_CLIENT_SECRET=****

# Import limits
IMPORT_MAX_ROWS_FREE=500
IMPORT_MAX_ROWS_STARTER=5000
IMPORT_MAX_ROWS_PRO=50000
IMPORT_MAX_ROWS_AGENCY=250000
IMPORT_BATCH_SIZE=1000

# File Storage (PLUGGABLE — see storage-strategy.md)
# Set STORAGE_DRIVER=s3 (cloud) OR STORAGE_DRIVER=local (on-prem)
# All file vars defined ONCE in packages/shared-config and inherited here.
# Path prefixes used by this service:
#   workspace/<id>/exports/...     (DSAR + custom exports)
#   workspace/<id>/imports/...     (HubSpot/Mailchimp/Klaviyo CSVs)
# Service does NOT define its own bucket; uses shared STORAGE_DRIVER + S3_BUCKET / LOCAL_STORAGE_PATH
EXPORT_URL_EXPIRY_DAYS=7                            # signed URL expiry (both drivers)

# OpenAPI spec
OPENAPI_SPEC_URL=https://docs.yourplatform.com/openapi.yaml

# Service URLs (proxied destinations for /api/v2/*)
MARKETING_CORE_URL=http://marketing-core:3100
SEO_ENGINE_URL=http://seo-engine:3101
CONTENT_AI_URL=http://content-ai:3102
CAMPAIGN_MANAGER_URL=http://campaign-manager:3103
ANALYTICS_ENGINE_URL=http://analytics-engine:3104
SOCIAL_HUB_URL=http://social-hub:3105
EMAIL_HUB_URL=http://email-hub:3106
INTELLIGENCE_URL=http://intelligence:3107
AFFILIATE_HUB_URL=http://affiliate-hub:3108
INFLUENCER_HUB_URL=http://influencer-hub:3109
CRM_AUTOMATION_URL=http://crm-automation:3110
MEDIA_HUB_URL=http://media-hub:3111
NOTIFICATION_SERVICE_URL=http://notification-service:3112

# Observability
SENTRY_DSN=https://****
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
LOG_LEVEL=info

# Feature Flags
FEATURE_PUBLIC_API_ENABLED=true                   # gated rollout
FEATURE_ZAPIER_INTEGRATION_ENABLED=false          # Phase 5 marketplace approval
FEATURE_HUBSPOT_IMPORT_ENABLED=true
FEATURE_MAILCHIMP_IMPORT_ENABLED=true
FEATURE_KLAVIYO_IMPORT_ENABLED=false              # Phase 5
FEATURE_SALESFORCE_IMPORT_ENABLED=false           # Phase 5+
```

---

## 9-14. (Deployment, Observability, Security, Testing, Local Dev, Runbooks)

### Critical Metrics
```
mkt_api_v2_requests_total{path, method, status, workspace_tier}    Counter
mkt_api_v2_duration_seconds{path}                                  Histogram
mkt_api_keys_active_gauge                                          Gauge
mkt_webhook_deliveries_total{status}                               Counter
mkt_webhook_delivery_duration_seconds                              Histogram
mkt_webhook_subscriptions_active                                   Gauge
mkt_data_imports_total{source, status}                             Counter
mkt_data_export_size_bytes                                         Histogram
```

### Runbooks

**"Public API latency high"**
1. Check which path: usually CRM or analytics queries (large datasets)
2. Confirm pagination is applied (max 100/page enforced)
3. Check downstream service health (we proxy; bottleneck is downstream)
4. Consider read-replica routing for heavy read endpoints

**"Webhook delivery failures rising"**
1. Check `integ_webhook_deliveries{status='failed'}` per webhook
2. If single customer: their endpoint is down — auto-disable after 50 consecutive failures
3. If many customers: our outbound network has issue → check NAT gateway, DNS

**"Data import stuck"**
1. Check `integ_data_imports.status='running'` for stale (no progress in 30 min)
2. Common cause: source API rate limit; CSV too large; auth expired
3. Manual investigation; possibly cancel + retry with smaller batches

**"API key compromise suspected"**
1. Revoke the key immediately (`POST /api-keys/:id/revoke`)
2. Audit `mkt_api_v2_requests_total` for that key
3. Notify customer; force-roll all their API keys
4. Investigate: how was it leaked? Public repo? Logs?
