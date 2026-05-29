# 📐 Microservice Standards
## The Constitution — Rules Every Service Obeys

> This document defines how all 14 microservices behave consistently. Every service-specific document (01-14) inherits these rules.

---

## 📋 Table of Contents

1. [Bounded Context Discipline](#1-bounded-context-discipline)
2. [API Versioning](#2-api-versioning)
3. [Database Conventions](#3-database-conventions)
4. [Sequelize Conventions](#4-sequelize-conventions)
5. [Error Handling](#5-error-handling)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Inter-Service Communication](#7-inter-service-communication)
8. [Event Naming & Schema](#8-event-naming--schema)
9. [Bull Queue Standards](#9-bull-queue-standards)
10. [Webhook Reception Pattern](#10-webhook-reception-pattern)
11. [Logging Standards](#11-logging-standards)
12. [Metrics Standards](#12-metrics-standards)
13. [Health Check Contract](#13-health-check-contract)
14. [Graceful Shutdown](#14-graceful-shutdown)
15. [Configuration Standards](#15-configuration-standards)
16. [Folder Structure](#16-folder-structure)
17. [Code Style](#17-code-style)
18. [Testing Requirements](#18-testing-requirements)
19. [Pull Request Standards](#19-pull-request-standards)
20. [Documentation Requirements](#20-documentation-requirements)

---

## 1. Bounded Context Discipline

Each service owns a **bounded context** — a clearly-defined slice of the business domain.

### Rules

- **One service = one bounded context.** Never split a context across services.
- A service owns its tables exclusively (logically — physically shared MySQL/PostgreSQL in Phase 1).
- Other services **read this service's data only via its API**, never via direct DB access.
- If a feature spans contexts, model it as an **async event** triggering changes in each context.

### "Where Should This Feature Live?" Decision Tree

```
Is this about a customer's marketing identity (account, workspace, billing)?
  → marketing-core
Is this about ranking on Google?
  → seo-engine
Is this about generating content with AI?
  → content-ai
Is this about launching paid ads or orchestrating campaigns?
  → campaign-manager
Is this about tracking visitor behaviour or measuring success?
  → analytics-engine
Is this about social media organic posting/listening?
  → social-hub
Is this about delivering messages (email/SMS/push/WhatsApp)?
  → email-hub
Is this about competitor data?
  → intelligence
Is this about an affiliate program?
  → affiliate-hub
Is this about an influencer marketing campaign?
  → influencer-hub
Is this about contacts, lead scoring, automation workflows?
  → crm-automation
Is this about YouTube, video, or image generation?
  → media-hub
Is this an in-app notification or weekly digest?
  → notification-service
Is this a customer-facing API or third-party integration?
  → integration-service
```

### Anti-Patterns to Avoid

| ❌ Wrong | ✅ Right |
|---|---|
| `seo-engine` writes to `crm_contacts` table | `seo-engine` publishes `seo.ranking.changed` → `crm-automation` enriches contact |
| `email-hub` calls `marketing-core` DB directly | `email-hub` calls `marketing-core` REST API |
| Adding a "campaigns" feature in `social-hub` | Belongs in `campaign-manager`; `social-hub` consumes `campaign.launched` event |
| AI generation logic duplicated in `media-hub` | Goes through `content-ai` (the AI gateway) |

---

## 2. API Versioning

### Internal API (between services + frontend)

- Path: `/api/v1/<service-slug>/...`
- Versioning: services may break v1 with frontend coordination
- Breaking changes require synchronised frontend + backend deploy

### Public API (customers)

- Path: `/api/v2/...` (hosted by `integration-service`)
- Strict semver:
  - **Patch** (v2.0.1 → v2.0.2): bug fix only
  - **Minor** (v2.0 → v2.1): additive changes (new fields/endpoints/optional params)
  - **Major** (v2 → v3): breaking changes
- Deprecation: `Deprecation` + `Sunset` HTTP headers + `Link: <docs-url>; rel="deprecation"`
- Old major version supported minimum **12 months** after deprecation announced
- New customers default to latest stable version

### Breaking Change Examples

| Allowed (Minor) | Breaking (Major) |
|---|---|
| Add new endpoint | Remove endpoint |
| Add optional request field | Make optional field required |
| Add response field | Remove response field |
| Add new event type | Rename event type |
| Add error code for new condition | Change error code for existing condition |
| Loosen rate limit | Tighten rate limit |

---

## 3. Database Conventions

### Database Strategy: Dual Dialect (MySQL dev → PostgreSQL prod)

The platform uses **MySQL 8 in local + staging environments** and **PostgreSQL 15+ in production**. Sequelize abstracts the dialect via a single env var (`DB_DIALECT`).

**Why dual dialect?**
- **MySQL for dev**: matches the existing LicensedTaxi platform pattern (most engineers already know MySQL); cheap shared-resource testing
- **PostgreSQL for production**: better for analytics-style queries, native JSONB indexing, partial indexes, mature partitioning, better concurrent-write performance, `pgvector` for embeddings (ai-platform.md), `pg_partman` for time-series partitioning

**Engineering rules to maintain dual-dialect compatibility:**
1. **Never use vendor-specific syntax**:
   - ❌ MySQL only: `ENGINE=InnoDB`, `AUTO_INCREMENT`, `LIMIT x OFFSET y` (Postgres also supports it but prefer Sequelize methods), `ON DUPLICATE KEY UPDATE`, `MEDIUMINT`
   - ❌ Postgres only: `JSONB`, `CITEXT`, `tsvector`, `RETURNING` clauses, `INTERVAL` literals
2. **Use Sequelize abstractions** — `DataTypes.JSON` (works in both), `DataTypes.UUID`, `DataTypes.TEXT('long')`, query builder, transactions, `op.iLike` (mapped per dialect)
3. **SQL examples in this documentation use MySQL syntax** for readability; production migrations must use Sequelize migration helpers that abstract dialect
4. **For dialect-divergent migrations**, branch on `queryInterface.sequelize.getDialect()`:
   ```javascript
   if (queryInterface.sequelize.getDialect() === 'postgres') {
     await queryInterface.sequelize.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
     // use gen_random_uuid()
   } else {
     // use UUID() in MySQL
   }
   ```
5. **Test on both**: CI runs the integration test suite against both MySQL 8 and PostgreSQL 15 via two parallel jobs
6. **Partitioning** — MySQL uses `PARTITION BY RANGE`; PostgreSQL uses `pg_partman` for time-series; the partition creation script is dialect-specific but lives in `migrations/<service>/partitions/`

**Connection string examples:**
```bash
# Local dev (MySQL)
DB_DIALECT=mysql
DATABASE_URL=mysql://app:****@localhost:3306/marketing

# Staging (managed MySQL e.g. RDS MySQL or PlanetScale)
DB_DIALECT=mysql
DATABASE_URL=mysql://app:****@staging-mysql.rds:3306/marketing?ssl=true

# Production (PostgreSQL e.g. RDS PostgreSQL or Aurora)
DB_DIALECT=postgres
DATABASE_URL=postgres://app:****@prod-pg.rds:5432/marketing?sslmode=require
```

**Cutover plan:**
- Phase 1–3: MySQL everywhere (dev + staging + early prod beta)
- Phase 4: production switches to PostgreSQL via `pg_dump`-style migration of MySQL → Postgres using `pgloader`
- Local dev stays on MySQL forever (or switches to local Postgres if developer prefers; both work)

### Table Naming
- **Format:** `<service-slug>_<plural-noun>` — table name reveals which service owns it (no global `mkt_` umbrella prefix; each service's prefix stands alone)
- **Examples:**
  - `core_users`, `core_workspaces` (marketing-core)
  - `seo_keywords`, `seo_rankings`, `seo_backlinks` (seo-engine)
  - `content_pieces`, `content_brand_voices` (content-ai)
  - `campaign_campaigns`, `campaign_ad_creatives`, `campaign_oneclick_jobs` (campaign-manager)
  - `analytics_events`, `analytics_ab_tests` (analytics-engine)
  - `social_accounts`, `social_posts` (social-hub)
  - `email_lists`, `email_subscribers`, `email_drip_sequences` (email-hub)
  - `intel_competitors`, `intel_ai_usage` (intelligence)
  - `affiliate_programs`, `affiliate_clicks` (affiliate-hub)
  - `influencer_profiles`, `influencer_contracts` (influencer-hub)
  - `crm_contacts`, `crm_workflows`, `crm_deals` (crm-automation)
  - `media_videos`, `media_image_generations` (media-hub)
  - `notify_notifications`, `notify_prefs` (notification-service)
  - `integ_api_keys`, `integ_webhooks` (integration-service)
- **Plural noun:** `crm_contacts` not `crm_contact`
- **Snake_case:** `email_drip_enrollments` not `email_dripEnrollments`
- **Service prefix list:** `core`, `seo`, `content`, `campaign`, `analytics`, `social`, `email`, `intel`, `affiliate`, `influencer`, `crm`, `media`, `notify`, `integ`
- See [database-schema.md](../database-schema.md) for the complete list of 131 tables

### Note on `mkt_` prefix
- **Tables** do NOT use a `mkt_` prefix — only the service prefix (`core_`, `seo_`, etc.)
- **Prometheus metrics** DO use `mkt_` as the platform namespace (`mkt_signups_total`, `mkt_emails_sent_total`) — this matches Prometheus convention of a platform namespace at the metric level
- **Bull queue names** use `mkt-` prefix (`mkt-email-sender`, `mkt-oneclick-orchestrator`) — distinguishes our queues on shared Redis from any other tenant
- **Customer-facing API keys** issued via integration-service use `mkt_live_*` / `mkt_test_*` prefix — product branding for the issued credentials

### Required Columns (every table)
```sql
id            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID())
workspace_id  CHAR(36)     NOT NULL                              -- on workspace-scoped tables
created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP
updated_at    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
deleted_at    DATETIME     NULL                                  -- soft delete on EVERY table
INDEX idx_workspace (workspace_id)                               -- always indexed for isolation
```

### Soft Delete Rule
**Never `DELETE FROM` in production code.** Always set `deleted_at = NOW()`. Hard deletes happen only via:
- `mkt-workspace-deletion` cron (post-cancellation grace)
- `mkt-rtbf-purge` cron (GDPR Article 17 erasure)

Every Sequelize query must filter `WHERE deleted_at IS NULL`. Use Sequelize's `paranoid: true` option to make this automatic.

### Primary Key Strategy
- `CHAR(36) DEFAULT (UUID())` — matches existing LicensedTaxi pattern
- Never auto-increment integers (predictable, exposes record counts)
- `workspace_id` is also CHAR(36) — supports multi-tenant scaling

### JSON Columns
- Use `JSON` type for flexible config (settings, metadata, custom fields)
- Validate JSON shape in application code (Joi schemas)
- Index specific JSON paths only where performance demands it

### Partitioning
High-volume time-series tables partition by month:
```sql
PARTITION BY RANGE (TO_DAYS(created_at)) (
  PARTITION p_2026_q2 VALUES LESS THAN (TO_DAYS('2026-07-01')),
  PARTITION p_2026_q3 VALUES LESS THAN (TO_DAYS('2026-10-01')),
  PARTITION p_future   VALUES LESS THAN MAXVALUE
);
```

Partitioned tables: `analytics_events`, `intel_ai_usage`, `core_audit_log`, `integ_webhook_deliveries`.

### Migration Rules
- Migrations are sequential, versioned by timestamp (`20260528120000-add-lifetime-value.js`)
- **Never edit a migration after merge** — write a new migration
- Migrations must be **reversible** (`up` + `down`)
- Large table changes use **expand-migrate-contract** pattern (see infrastructure-prod.md)
- Migrations run via `sequelize-cli db:migrate` before container starts

---

## 4. Sequelize Conventions

### Model Definition Pattern

```javascript
// services/<service>/models/contact.model.js
const { DataTypes } = require('sequelize');
const paginate = require('sequelize-paginate');

module.exports = (sequelize) => {
  const Contact = sequelize.define('Contact', {
    id:           { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
    email:        { type: DataTypes.STRING(255), allowNull: false, validate: { isEmail: true } },
    first_name:   { type: DataTypes.STRING(100) },
    last_name:    { type: DataTypes.STRING(100) },
    lifecycle_stage: {
      type: DataTypes.ENUM('subscriber','lead','mql','sql','customer','evangelist'),
      defaultValue: 'subscriber'
    },
    lead_score:    { type: DataTypes.INTEGER, defaultValue: 0 },
    custom_fields: { type: DataTypes.JSON },
    tags:          { type: DataTypes.JSON },
  }, {
    tableName: 'crm_contacts',
    timestamps: true,         // created_at, updated_at
    paranoid: true,           // soft delete via deleted_at
    underscored: true,        // snake_case columns
    indexes: [
      { fields: ['workspace_id'] },
      { fields: ['workspace_id', 'email'], unique: true, where: { deleted_at: null } },
      { fields: ['workspace_id', 'lifecycle_stage'] },
      { fields: ['workspace_id', 'lead_score'] },
    ]
  });

  paginate(Contact);
  return Contact;
};
```

### Hooks Discipline
- **Use sparingly** — hooks are invisible side effects
- Acceptable hooks: `beforeCreate` (set defaults), `afterCreate` (emit event), `beforeUpdate` (validation)
- Forbidden hooks: anything that does network calls (use service layer instead)

### Query Patterns
```javascript
// ✅ ALWAYS scope by workspace_id
await Contact.findAll({ where: { workspace_id: req.workspaceId, lifecycle_stage: 'mql' } });

// ✅ Use paginate helper
const result = await Contact.paginate({
  where: { workspace_id: req.workspaceId },
  page: req.query.page || 1,
  paginate: req.query.limit || 20,
});

// ❌ NEVER fetch without workspace_id
await Contact.findAll({ where: { email: 'x@y.com' } });  // cross-tenant leak risk

// ✅ Transactions for multi-row writes
await sequelize.transaction(async (t) => {
  await Contact.create({...}, { transaction: t });
  await ContactActivity.create({...}, { transaction: t });
});
```

### Eager Loading
Prefer explicit `include` over N+1 queries. Watch for memory on large workspaces.

---

## 5. Error Handling

### Standard Error Envelope

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Email address is required",
    "details": {
      "email": ["Field is required", "Must be a valid email"]
    },
    "request_id": "01H8X..."
  }
}
```

### Error Code Catalog

| Code | HTTP | Meaning |
|---|---|---|
| `validation_failed` | 400 | Joi validation error |
| `authentication_required` | 401 | Missing or invalid token |
| `permission_denied` | 403 | Token valid but insufficient permission |
| `not_found` | 404 | Resource does not exist (or workspace isolation hides it) |
| `conflict` | 409 | Duplicate resource (e.g., email already in list) |
| `payment_required` | 402 | Feature requires plan upgrade |
| `quota_exceeded` | 402 | Workspace usage cap reached (emails/AI/etc.) |
| `rate_limit_exceeded` | 429 | Too many requests |
| `upstream_failure` | 502 | External provider (OpenAI/Stripe/Meta) failed |
| `service_unavailable` | 503 | Maintenance or capacity issue |
| `internal_error` | 500 | Unexpected bug |

### Error Middleware

```javascript
// shared-middleware/error-handler.js
module.exports = (err, req, res, next) => {
  const status = err.status || 500;
  const code = err.code || 'internal_error';
  const message = err.expose ? err.message : 'Internal server error';

  logger.error({
    request_id: req.id,
    workspace_id: req.workspaceId,
    error_code: code,
    status,
    err,
  }, message);

  if (status >= 500) Sentry.captureException(err, { contexts: { request: { request_id: req.id } } });

  res.status(status).json({
    error: { code, message, details: err.details || undefined, request_id: req.id }
  });
};
```

### Retry Semantics
- **4xx errors:** NEVER retry (client bug, won't fix itself)
- **5xx errors:** retry with exponential backoff (1s, 5s, 30s, 2m, 6m)
- **429 errors:** retry after `Retry-After` header
- **Network errors:** retry with backoff

---

## 6. Authentication & Authorization

### JWT Validation Middleware
Every protected route uses `passport.authenticate('jwt', { session: false })` — same pattern as existing LicensedTaxi platform.

### Permission Middleware
```javascript
// shared-middleware/require-permission.js
const requirePermission = (module_name, action) => (req, res, next) => {
  const perm = req.user.permissions.find(p => p.module_name === module_name);
  if (!perm || !JSON.parse(perm.access)[action]) {
    return res.status(403).json({
      error: { code: 'permission_denied', message: `Required: ${action} on ${module_name}` }
    });
  }
  next();
};

// Usage:
router.post('/keywords', requirePermission('seo_keywords', 'c'), keywordController.create);
```

### Workspace Isolation Guard
Every authenticated route gets `req.workspaceId` automatically:
```javascript
// shared-middleware/workspace-guard.js
const workspaceGuard = async (req, res, next) => {
  if (req.user.type === 'platform_admin') {
    // Platform admin can target any workspace via header or fall back to no scope
    req.workspaceId = req.headers['x-admin-workspace'] || null;
  } else {
    req.workspaceId = req.user.workspace_id;
  }

  // Reject URL param mismatches (unless agency owner accessing client workspace — see clients.md)
  if (req.params.workspace_id && req.params.workspace_id !== req.workspaceId) {
    if (req.user.type !== 'agency_owner' || !(await isAgencyClient(req.workspaceId, req.params.workspace_id))) {
      return res.status(403).json({ error: { code: 'permission_denied' }});
    }
    req.workspaceId = req.params.workspace_id;
  }
  next();
};
```

### Service-to-Service Authentication
Services calling each other use **short-lived service JWTs** signed with the same secret, with `type='service'`:
```javascript
const serviceToken = jwt.sign(
  { type: 'service', from: 'campaign-manager', to: 'content-ai', workspace_id },
  process.env.JWT_SECRET,
  { expiresIn: '5m' }
);
```

The receiving service validates the `to` claim matches its own service name.

---

## 7. Inter-Service Communication

### Decision Tree: Sync vs Async

```
Does the caller need the result immediately to respond to the user?
├─ YES → Synchronous REST call
│        Examples:
│        • Frontend → marketing-core: get user profile (sync)
│        • campaign-manager → content-ai: generate ad copy (sync)
│        • integration-service → crm-automation: create contact via public API (sync)
│
└─ NO  → Asynchronous Event
         Examples:
         • crm-automation → email-hub: enrol contact in drip (async event)
         • marketing-core → notification-service: workspace created (async event)
         • email-hub → crm-automation: subscriber opened email (async event)
```

### Sync REST Rules

- **Timeout:** 10 seconds default; 30s for AI calls; 60s for One-Click Capture
- **Retries:** 3 retries on 5xx + 429, exponential backoff
- **Circuit breaker:** open after 5 consecutive failures, half-open after 60s
- **Trace context:** propagate `traceparent` header (auto-handled by OpenTelemetry)
- **Service JWT:** required on every inter-service call

### Async Event Rules

- Events delivered via Redis Pub/Sub (Phase 1-3) → migrate to NATS/Kafka if volume warrants
- Subscribers run in Bull queues for retry safety
- Events are **immutable facts** — never modified or replayed in production
- Idempotency keys on every event (consumer dedups via `core_idempotency_keys`)

---

## 8. Event Naming & Schema

### Event Name Format

```
<service>.<noun>.<verb_past_tense>
```

Examples: `crm.contact.created`, `email.message.bounced`, `social.post.published`, `core.workspace.cancelled`.

### Event Payload Schema

```json
{
  "event_id":     "01H8X...",                // ULID
  "event_type":   "crm.contact.created",
  "occurred_at":  "2026-05-28T10:00:00.123Z",
  "workspace_id": "ws_01H...",
  "actor": {
    "type": "user",
    "id":   "usr_01H..."
  },
  "data": {
    "contact": { /* full resource */ }
  },
  "metadata": {
    "request_id":     "01H8X...",
    "schema_version": "v1"
  }
}
```

### AsyncAPI Catalog
Every service publishes its event schema to a shared AsyncAPI 3.0 spec at `packages/shared-events/asyncapi.yaml`.

### Schema Evolution
- Additive changes (new optional fields) = no version bump
- Breaking changes (remove field, change type) = new event type with `v2` suffix; old continues for 6 months

---

## 9. Bull Queue Standards

### Naming Convention
```
mkt-<service-slug>-<purpose>     OR     mkt-<purpose>
```
Examples: `mkt-email-sender`, `mkt-social-publish`, `mkt-oneclick-orchestrator`.

### Queue Configuration

```javascript
const queue = new Bull('mkt-email-sender', {
  redis: redisClient,
  limiter: {
    max: 50,             // max 50 jobs
    duration: 60000,     // per 60 seconds
  },
  defaultJobOptions: {
    attempts: 5,         // 5 retries before DLQ
    backoff: {
      type: 'exponential',
      delay: 60000,      // 1m, 5m, 25m, 2h5m, 10h25m
    },
    removeOnComplete: { count: 1000, age: 86400 },  // keep last 1000 or 24h
    removeOnFail: false, // keep failed jobs forever (until manually purged) for debugging
    timeout: 300000,     // 5-minute max execution
  }
});

queue.on('failed', (job, err) => {
  if (job.attemptsMade >= job.opts.attempts) {
    dlqClient.add('mkt-email-sender-dlq', { ...job.data, originalError: err.message });
    metrics.counter('bull_job_dlq_total').inc({ queue: 'mkt-email-sender' });
  }
});
```

### Idempotency
Every job carries an `idempotency_key`. Workers check `core_idempotency_keys` before processing to prevent double work on retry.

### Dead Letter Queue (DLQ)
After max retries, job moves to `<queue-name>-dlq`. Admin UI surfaces DLQ contents for manual replay or investigation.

### Per-Workspace Fairness
Use Bull priority + per-workspace counters in Redis to prevent one workspace from monopolising workers:
```javascript
const recentJobsForWorkspace = await redis.incr(`queue_throttle:${queue}:${workspace_id}`);
await redis.expire(`queue_throttle:${queue}:${workspace_id}`, 60);
const priority = Math.max(1, 10 - Math.floor(recentJobsForWorkspace / 10));  // lower priority for greedy workspaces

await queue.add(jobData, { priority });
```

### Concurrency Limits
```javascript
// Worker setup
queue.process(10, async (job) => { /* worker logic */ });  // 10 concurrent jobs per worker instance
```
Concurrency tuned per queue based on external API rate limits (see per-service docs).

---

## 10. Webhook Reception Pattern

Every inbound webhook from an external provider follows this **exact pattern**:

```javascript
router.post('/<provider>/webhook',
  express.raw({ type: 'application/json' }),       // raw body for signature verification
  async (req, res) => {
    // 1. Verify signature (provider-specific)
    let event;
    try {
      event = verifyAndParseProviderEvent(req);
    } catch (err) {
      logger.warn({ err }, 'Invalid webhook signature');
      return res.status(400).send('Invalid signature');
    }

    // 2. Timestamp replay protection (5-minute window)
    if (Math.abs(Date.now()/1000 - event.timestamp) > 300) {
      return res.status(400).send('Event too old');
    }

    // 3. Idempotency check
    const idempotencyKey = `webhook:${provider}:${event.id}`;
    const seen = await redisClient.set(idempotencyKey, '1', 'NX', 'EX', 86400);
    if (!seen) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    // 4. Quick ack + queue for async processing
    await BullQueue.add(`mkt-${provider}-event`, { event_id: event.id, data: event });
    return res.status(200).json({ received: true });

    // 5. Worker handles event with full error handling + retry
  }
);
```

### Signature Verification Per Provider

| Provider | Header | Algorithm | Secret env var |
|---|---|---|---|
| Stripe | `stripe-signature` | HMAC-SHA256 | `STRIPE_WEBHOOK_SECRET` |
| SendGrid | `X-Twilio-Email-Event-Webhook-Signature` | ECDSA P-256 | `SENDGRID_WEBHOOK_PUBLIC_KEY` |
| Meta | `X-Hub-Signature-256` | HMAC-SHA256 | `META_APP_SECRET` |
| Twitter | `X-Twitter-Webhooks-Signature` | HMAC-SHA256 | `TWITTER_CONSUMER_SECRET` |
| Twilio | `X-Twilio-Signature` | HMAC-SHA1 | `TWILIO_AUTH_TOKEN` |

---

## 11. Logging Standards

### Library: pino

```javascript
// shared-middleware/logger.js
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: process.env.SERVICE_NAME, env: process.env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization', 'req.headers.cookie',
      'req.body.password', 'req.body.refresh_token', 'req.body.access_token',
      'req.body.oauth_access_token', '*.api_key', '*.stripe_*', '*.totp_secret',
    ],
    censor: '[REDACTED]',
  },
});
```

### Required Fields on Every Request Log

```javascript
logger.info({
  request_id:   req.id,             // ULID per request (via middleware)
  workspace_id: req.workspaceId,
  user_id:      req.user?.id,
  method:       req.method,
  path:         req.path,
  status:       res.statusCode,
  duration_ms:  Date.now() - req.startTime,
  ip:           req.ip,
}, 'request_completed');
```

### Log Levels
- `fatal` — process about to crash
- `error` — request failed
- `warn` — recovered failure (retried OpenAI call, fell back to claude)
- `info` — significant business event (signup, campaign launch, payment)
- `debug` — verbose flow (off in production)

### What NEVER to Log
- Passwords, JWTs, refresh tokens, OAuth tokens, API keys
- Email subscriber lists (PII at scale)
- Stripe webhook secrets
- AI prompts containing customer brand info (log hashes if needed)

---

## 12. Metrics Standards

### Required Metrics (every service)

```javascript
// Default per-service metrics auto-emitted by shared middleware
http_request_duration_seconds{method, path, status, service}   (Histogram)
http_requests_total{method, path, status, service}             (Counter)
db_query_duration_seconds{operation, table, service}           (Histogram)
db_pool_connections_used{service}                              (Gauge)
db_pool_connections_max{service}                               (Gauge)
bull_jobs_processed_total{queue, status, service}              (Counter)
bull_job_duration_seconds{queue, service}                      (Histogram)
bull_queue_waiting_count{queue, service}                       (Gauge)
external_api_call_duration_seconds{provider, method, status}   (Histogram)
external_api_calls_total{provider, status}                     (Counter)
```

### Service-Specific Business Metrics
Each service-specific document lists its custom metrics. Examples:
- `marketing-core`: `mkt_signups_total`, `mkt_mrr_usd_gauge`
- `content-ai`: `mkt_ai_tokens_used_total{provider, model, workspace_id}`
- `campaign-manager`: `mkt_oneclick_capture_duration_seconds`

### Cardinality Rules
**NEVER** include high-cardinality labels (`workspace_id` per call ≠ ok; in aggregate counters ok).
Workspace-scoped metrics use `workspace_tier` (free/starter/pro/agency/enterprise) instead.

### Metrics Endpoint
Every service exposes Prometheus metrics at `GET /metrics` (internal — not routed via Nginx).

---

## 13. Health Check Contract

Every service exposes three endpoints:

### `GET /health` — Comprehensive (for ALB / human checks)
```json
{
  "status": "healthy",
  "service": "marketing-core",
  "version": "1.4.2",
  "uptime_seconds": 86400,
  "dependencies": {
    "database":     { "status": "healthy", "latency_ms": 5 },
    "redis":        { "status": "healthy", "latency_ms": 1 },
    "stripe":       { "status": "healthy", "latency_ms": 124 }
  }
}
```

Returns `200` if all critical dependencies healthy, `503` if any critical dependency down.

### `GET /ready` — Readiness (for Kubernetes / ECS)
Returns `200` if the service is ready to accept traffic. Different from `/health` — a service may be unhealthy (degraded) but still ready (accepting traffic).

### `GET /live` — Liveness (for Kubernetes / ECS)
Returns `200` if the process is alive. Should ONLY return non-200 if the process is in an unrecoverable state (deadlock, OOM imminent) — used to trigger container restart.

### Implementation Pattern
```javascript
// shared-middleware/health.js
router.get('/health', async (req, res) => {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    ...serviceSpecificChecks(),
  ]);
  const healthy = checks.every(c => c.status === 'fulfilled' && c.value.status === 'healthy');
  res.status(healthy ? 200 : 503).json({ ... });
});

router.get('/ready', (req, res) => res.status(app.isReady ? 200 : 503).end());
router.get('/live', (req, res) => res.status(200).end());
```

---

## 14. Graceful Shutdown

When ECS sends SIGTERM (during deploy/scale-down), the service must:

```javascript
// app.js — bottom of file
const server = app.listen(PORT);

let isShuttingDown = false;
async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info('shutdown_initiated');

  // 1. Stop accepting new requests
  app.isReady = false;
  server.close();

  // 2. Wait for in-flight HTTP requests to complete (max 25s; ECS waits 30s)
  await new Promise(resolve => setTimeout(resolve, 25000));

  // 3. Close Bull queues — wait for current jobs to finish, reject new
  await Promise.all(allQueues.map(q => q.close()));

  // 4. Close DB pool
  await sequelize.close();

  // 5. Close Redis
  await redisClient.quit();

  // 6. Flush logs + Sentry
  await Sentry.close(2000);
  await logger.flush();

  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

### ECS Configuration
- `stopTimeout: 30` seconds
- Health check grace period during deploy: 60s

---

## 15. Configuration Standards

### Environment Variables

- **Type-validate at startup** using `joi`/`envalid`. Crash on missing required vars.
- **Never use `process.env.X` directly in code** — wrap in a typed config module:

```javascript
// config/index.js
const { cleanEnv, str, port, num, bool } = require('envalid');

module.exports = cleanEnv(process.env, {
  NODE_ENV:        str({ choices: ['development', 'staging', 'production'] }),
  PORT:            port({ default: 3100 }),
  SERVICE_NAME:    str(),
  DATABASE_URL:    str(),
  REDIS_URL:       str(),
  JWT_SECRET:      str(),
  STRIPE_SECRET_KEY: str(),
  LOG_LEVEL:       str({ default: 'info' }),
  // ... etc
});
```

### Secrets vs Config
- **Config** (non-sensitive: PORT, LOG_LEVEL, FEATURE_X_ENABLED) → `.env` files
- **Secrets** (DB credentials, JWT_SECRET, OAuth client secrets, API keys) → AWS Secrets Manager / HashiCorp Vault → injected at runtime

### Per-Environment Files
```
.env.example       → committed (no values, just keys + comments)
.env.local         → gitignored (dev)
.env.staging       → in Vault → fetched by deploy script
.env.production    → in Vault → fetched by deploy script
```

### Never Commit
- Real API keys, passwords, JWT secrets
- Production database URLs
- Webhook secrets
- KMS keys

`gitleaks` runs in CI to enforce.

---

## 15.5. File Storage Abstraction (mandatory)

> See [storage-strategy.md](../storage-strategy.md) for the full design.

### Rule: NEVER call AWS SDK directly from a service

❌ **Forbidden:**
```javascript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
const s3 = new S3Client({...});
await s3.send(new PutObjectCommand({...}));
```

✅ **Required:**
```javascript
import { storage } from '@marketing/shared-storage';
await storage.upload(buffer, `workspace/${ws}/content/image.png`, { contentType: 'image/png' });
```

### Why
The platform supports two storage drivers — `s3` (cloud) and `local` (on-prem) — selected by `STORAGE_DRIVER` env var. Services calling AWS SDK directly break the local-disk deployment.

### Rules

1. **All file I/O goes through `@marketing/shared-storage`** — no exceptions
2. **Every key starts with `workspace/<workspace_id>/`** — the storage service rejects keys without this prefix (enforces tenant isolation + simplifies RTBF deletion)
3. **No key contains `..`** — path traversal blocked at the abstraction layer
4. **Public URLs** are obtained via `storage.getPublicUrl(key)` or `storage.getSignedDownloadUrl(key, { expiresIn })` — never construct URLs manually
5. **Workspace deletion** calls `storage.deletePrefix('workspace/' + workspaceId + '/')` — works on both drivers
6. **MIME-type verification** via magic bytes (not just extension) — provided by the storage upload pipeline
7. **Size limits** enforced per file type via env vars — see `storage-strategy.md`
8. **Integration tests** must pass against BOTH drivers — CI matrix runs `STORAGE_DRIVER=s3` and `STORAGE_DRIVER=local` jobs in parallel

### Per-service implementation
- Service `_services/` business code uses `storage.upload()` / `storage.download()` / `storage.delete()` / `storage.deletePrefix()`
- Service routes that receive file uploads use the shared `multer` config from `packages/shared-middleware/upload.js`
- Service tests use the mock storage driver from `@marketing/shared-storage/test-utils`

### Migration safety
The storage abstraction means a customer can deploy the same image:
- On AWS with `STORAGE_DRIVER=s3` + `S3_BUCKET=...`
- On-premise with `STORAGE_DRIVER=local` + `LOCAL_STORAGE_PATH=/var/lib/marketing/files`
- On Cloudflare R2 with `STORAGE_DRIVER=s3` + `S3_ENDPOINT=...`

Migration between drivers uses `scripts/migrate-storage.js` (see storage-strategy.md).

---

## 16. Folder Structure

Every backend service uses this **exact** structure (mirrors existing LicensedTaxi pattern):

```
services/<service-name>/
├── _config/                # Configuration modules
│   ├── db.config.js        # Sequelize connection
│   ├── redis.config.js     # Redis client
│   ├── passport.config.js  # JWT strategy
│   └── index.js
├── _helpers/               # Reusable utilities
│   ├── redis.js            # initQueue() Bull factory
│   ├── sms.js
│   └── email.js
├── _services/              # Business logic layer (NOT HTTP)
│   ├── contact.service.js
│   ├── workflow.service.js
│   └── ...
├── controllers/            # HTTP handlers (thin — delegate to _services)
│   ├── contact.controller.js
│   └── ...
├── routes/                 # Express route definitions + Joi validation
│   ├── contact.routes.js
│   └── index.js
├── middleware/             # Service-specific middleware (use shared first)
│   ├── webhook-verify.js
│   └── ...
├── models/                 # Sequelize models
│   ├── contact.model.js
│   ├── company.model.js
│   └── index.js            # imports all + sequelize.define
├── migrations/             # SQL schema migrations (sequelize-cli)
│   ├── 20260101000001-create-mkt-contacts.js
│   └── ...
├── cron/                   # node-cron + Bull queue processors
│   ├── workflow-processor.cron.js
│   └── ...
├── events/                 # Async event publishers + subscribers
│   ├── publish.js
│   └── subscribers/
│       └── on-email-opened.js
├── test/                   # Test files mirror source structure
│   ├── _services/
│   ├── controllers/
│   └── fixtures/
├── openapi.yaml            # API contract (auto-deployed to docs)
├── Dockerfile
├── package.json
├── README.md               # Service-specific README (link to microservices/NN-...md)
└── app.js                  # Entry point: bootstrap Express, middleware, routes, queues, server
```

### File Naming Conventions
- Services: `*.service.js`
- Controllers: `*.controller.js`
- Routes: `*.routes.js`
- Models: `*.model.js`
- Middleware: `*.middleware.js`
- Cron jobs: `*.cron.js`
- Test files: `*.test.js`
- One concept per file. Files > 500 lines should be split.

---

## 17. Code Style

### ESLint + Prettier

```bash
yarn lint       # eslint --max-warnings 0
yarn format     # prettier --write
```

Shared config in `packages/eslint-config-marketing/`.

### Rules
- `'use strict'` not needed (ES Modules via Babel)
- `async/await` only, no callbacks or raw Promise chains
- `const` preferred; `let` only when reassignment needed; never `var`
- No `console.log` — use `logger`
- No unused vars (prefix with `_` if intentional)
- Max line length: 120 chars
- Indent: 2 spaces
- Semicolons: required
- Trailing commas: `all` (improves git diffs)

### Async Patterns
```javascript
// ✅ Good
async function getContact(id) {
  const contact = await Contact.findByPk(id);
  if (!contact) throw new NotFoundError();
  return contact;
}

// ❌ Bad — callback hell, no error handling
function getContact(id, cb) {
  Contact.findByPk(id).then(c => cb(null, c)).catch(e => cb(e));
}
```

### Naming
- camelCase for variables, functions, methods
- PascalCase for classes, models
- SCREAMING_CASE for constants and env vars
- snake_case for DB columns and API JSON fields

---

## 18. Testing Requirements

### Coverage Targets
- Unit tests: 80% lines, 70% branches (CI fails below)
- Integration tests: every route has at least one happy-path test
- Isolation tests: every endpoint with `workspace_id` scope (auto-generated from OpenAPI)
- E2E tests: critical flows only (see testing.md)

### Test Discipline
- Tests for new code REQUIRED in same PR
- Tests for bug fixes REQUIRED (regression prevention)
- Test files alongside source: `services/foo.service.js` → `services/foo.service.test.js`
- Mock external services in unit tests; use real DB in integration tests
- Run `yarn test:isolation` before every push

### Critical Test: Workspace Isolation
Every list/get/update/delete endpoint must have:
```javascript
test('user from workspace B cannot access workspace A resource', async () => {
  const tokenB = await loginAs('userB@example.com');  // workspace B
  const resourceIdInA = await createInWorkspaceA();
  const res = await request(app).get(`/api/v1/foo/${resourceIdInA}`).set('Authorization', `Bearer ${tokenB}`);
  expect(res.status).toBe(403);  // or 404 — never 200
});
```

---

## 19. Pull Request Standards

### Required Checks (CI)
- [ ] Lint passes
- [ ] TypeScript / type check passes
- [ ] All tests pass
- [ ] Isolation tests pass
- [ ] Coverage doesn't drop
- [ ] Security scan (Snyk) — no high/critical
- [ ] gitleaks — no secrets committed
- [ ] OpenAPI spec valid

### Required Reviewers
- 1 code owner per affected service
- 1 SRE review if Dockerfile, IaC, or migration changed
- 1 security review if auth, RBAC, or PII handling changed

### PR Description Template
```markdown
## What
<one sentence>

## Why
<link to ticket / customer request>

## How
<key implementation decisions>

## Testing
<how to manually verify>

## Risk
<what could go wrong; rollback plan>

## Migration?
<yes/no; if yes, link to migration file>

## Breaking?
<yes/no; if yes, link to deprecation plan>
```

### Merge Requirements
- Squash merges only (clean main history)
- Branch must be up to date with main
- All checks green
- All review comments resolved or acknowledged
- No `wip:` or `[draft]` in title

---

## 20. Documentation Requirements

### Per-Service Requirements

Every service must maintain:
1. `services/<name>/README.md` — quick reference + link to `microservices/NN-<name>.md`
2. `services/<name>/openapi.yaml` — full API contract (auto-published to docs.yourplatform.com)
3. `microservices/NN-<name>.md` — complete service doc (this folder)
4. Inline JSDoc on public service methods (`_services/*.js`)

### Documentation Update Trigger
Documentation update is REQUIRED in the same PR when:
- Adding/removing an endpoint
- Adding/removing/renaming an event
- Adding/removing a table or column
- Adding a new env var
- Changing a Bull queue name or behaviour
- Adding a runbook scenario

### "Docs as Code"
- Markdown lives in repo, not Notion/Confluence
- PR reviews include doc changes
- `docs.yourplatform.com` rebuilt on push to main

---

## Service Maturity Tiers

Each service is classified by criticality:

| Tier | SLA | On-call | Test coverage | Examples |
|---|---|---|---|---|
| **Tier 1** | 99.9% uptime | 24/7 | 90%+ | marketing-core, content-ai, campaign-manager, email-hub, crm-automation, analytics-engine, integration-service |
| **Tier 2** | 99.5% uptime | Business hours | 80%+ | seo-engine, social-hub, affiliate-hub, media-hub, notification-service |
| **Tier 3** | Best effort | Next business day | 70%+ | intelligence, influencer-hub |

Tier determines:
- Alerting urgency
- Required test coverage
- Required redundancy
- DR priority

---

## Anti-Patterns Forbidden Across All Services

1. **Cross-service DB writes** — services own their tables; others use the API
2. **Hard deletes in production code** — soft delete only
3. **Logging PII/secrets** — redaction enforced at logger level
4. **Direct `process.env.X` reads** — use typed config module
5. **Callbacks** — async/await only
6. **Global state** — services are stateless; state in DB/Redis
7. **Sync calls to slow external APIs without timeout** — every external call has a timeout
8. **`console.log` in production code** — use `logger`
9. **Unbounded queries** — always paginate
10. **Token storage in plaintext** — AES-GCM with per-workspace KEK
11. **Workspace_id from request body** — always from JWT
12. **Migrations editing past migration files** — write new migration instead

---

## Where Each Standard Maps in the Existing LicensedTaxi Pattern

This platform leverages the existing platform's proven patterns. Direct mappings:

| Standard | Existing Pattern Reference |
|---|---|
| Sequelize models | `/api/login/models/user.model.js` |
| `_services/` business logic layer | `/api/login/_services/auth.service.js` |
| `_helpers/redis.js` Bull factory | `/api/login/_helpers/redis.js` |
| Passport JWT setup | `/api/login/_config/passport.config.js` |
| Encryption middleware | `/api/login/middleware/encryptionMiddleWare.js` |
| Rate limiter | `/api/login/middleware/ratelimit.middleware.js` |
| `app.js` entry point | `/api/login/app.js` |
| Babel + nodemon dev setup | `/api/booking/package.json` |

When in doubt, **copy the pattern from the existing platform**. Consistency > novelty.
