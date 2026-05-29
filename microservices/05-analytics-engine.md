# 📊 analytics-engine (Port 3104)
## Events · A/B Testing · Multi-Touch Attribution · Funnels · Reports

> **Tier 1 — Critical.** Highest-volume service on the platform. Sustains 1,000+ events/sec. Dual-write to MySQL/PostgreSQL (operational) + ClickHouse (analytical).

---

## 1. Service Identity

| Field | Value |
|---|---|
| **Service Name** | `analytics-engine` |
| **Port** | 3104 |
| **Maturity Tier** | Tier 1 |
| **SLA** | 99.9% uptime; 99.99% on `/track` ingestion |
| **On-Call** | 24/7 |
| **Owning Team** | Data Team |

**One-sentence purpose:** Ingest, store, query, and report on every analytics event across customer websites — visits, conversions, A/B tests, funnels, attribution.

**Bounded context:** Every form of measurement. Web events, conversion goals, A/B tests, multi-touch attribution, funnels, heatmaps, custom reports, predictive analytics (LTV/churn).

---

## 2. Responsibilities (DO / DON'T)

### ✅ DO
- High-volume event ingestion (`POST /track` — 1,000+ req/sec)
- Dual-write to MySQL/PostgreSQL (30-day operational) + ClickHouse (long-term analytical)
- Real-time dashboard aggregations (materialised views)
- Multi-touch attribution (first-click, last-click, linear, time-decay, data-driven)
- Conversion funnel analysis
- A/B test management + chi-squared significance testing
- Custom report builder + scheduled delivery (PDF via pdfkit)
- Predictive analytics (LTV regression, churn risk cohorts)
- Heatmap session recording storage (S3 + metadata)
- UTM-source attribution
- Tracking script delivery (`cdn.yourplatform.com/track.js`)

### ❌ DON'T
- Compute marketing ROI directly → we provide raw data; UI calculates rollups
- Send dashboard emails → publish events; `notification-service` sends digests
- Track competitor sites → `intelligence` does competitive
- Provide raw event data to customers → `integration-service` proxies queries with permission checks
- A/B test ad creatives → `campaign-manager` defines tests; we measure

---

## 3. Domain Model

### Tables Owned (10 + ClickHouse)

| Table | Purpose | Storage |
|---|---|---|
| `analytics_events` | Operational event log (30-day TTL, partitioned) | MySQL/PostgreSQL |
| `core_outbox` | Outbox pattern — ensures ClickHouse write | MySQL/PostgreSQL |
| `analytics_reports` | Saved report definitions | MySQL/PostgreSQL |
| `analytics_conversion_goals` | Per-workspace conversion goals | MySQL/PostgreSQL |
| `analytics_funnels` | Funnel definitions (multi-step) | MySQL/PostgreSQL |
| `analytics_funnel_steps` | Steps per funnel | MySQL/PostgreSQL |
| `analytics_heatmap_sessions` | Session recording metadata; binary in S3 | MySQL/PostgreSQL + S3 |
| `analytics_ab_tests` | Test definitions | MySQL/PostgreSQL |
| `analytics_ab_assignments` | Visitor → variant mapping | MySQL/PostgreSQL |
| `analytics_predictions` | LTV / churn predictions per contact | MySQL/PostgreSQL |
| `analytics_events_ch` | ClickHouse analytical events (unbounded) | **ClickHouse** |
| `analytics_events_hourly` | Materialised aggregation view | **ClickHouse** |

### Key Schemas

```sql
CREATE TABLE analytics_events (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  visitor_id      VARCHAR(36),
  session_id      VARCHAR(36),
  user_id         CHAR(36),                       -- if identified
  event_type      VARCHAR(50)  NOT NULL,
  url             VARCHAR(2048),
  referrer        VARCHAR(2048),
  utm_source      VARCHAR(100),
  utm_medium      VARCHAR(100),
  utm_campaign    VARCHAR(100),
  utm_content     VARCHAR(100),
  utm_term        VARCHAR(100),
  country_code    CHAR(2),
  city            VARCHAR(100),
  device_type     ENUM('desktop','mobile','tablet'),
  browser         VARCHAR(50),
  os              VARCHAR(50),
  custom_data     JSON,
  revenue         DECIMAL(12,2),
  created_at      DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_workspace_time (workspace_id, created_at),
  INDEX idx_session (session_id),
  INDEX idx_utm (utm_campaign, utm_source)
) ENGINE=InnoDB
PARTITION BY RANGE (TO_DAYS(created_at)) (
  PARTITION p_2026_w22 VALUES LESS THAN (TO_DAYS('2026-06-01')),
  ... (weekly partitions for 30 days, then dropped)
);
```

```sql
-- ClickHouse
CREATE TABLE analytics_events_ch (
  workspace_id    UUID,
  event_id        UUID,
  event_type      LowCardinality(String),
  session_id      String,
  visitor_id      String,
  user_id         Nullable(UUID),
  url             String,
  referrer        Nullable(String),
  utm_source      Nullable(String),
  utm_medium      Nullable(String),
  utm_campaign    Nullable(String),
  utm_content     Nullable(String),
  utm_term        Nullable(String),
  country_code    LowCardinality(FixedString(2)),
  city            LowCardinality(String),
  device_type     LowCardinality(String),
  browser         LowCardinality(String),
  os              LowCardinality(String),
  custom_data     String,    -- JSON serialised
  revenue         Nullable(Decimal(12,2)),
  created_at      DateTime64(3)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (workspace_id, created_at, event_type)
TTL created_at + INTERVAL 5 YEAR;

CREATE MATERIALIZED VIEW analytics_events_hourly ENGINE = SummingMergeTree()
ORDER BY (workspace_id, hour, event_type, utm_source, country_code)
AS SELECT
  workspace_id,
  toStartOfHour(created_at) AS hour,
  event_type,
  utm_source,
  country_code,
  count() AS events,
  uniqExact(session_id) AS sessions,
  uniqExact(user_id) AS users,
  sum(revenue) AS revenue
FROM analytics_events_ch
GROUP BY workspace_id, hour, event_type, utm_source, country_code;

CREATE MATERIALIZED VIEW analytics_events_daily ENGINE = SummingMergeTree()
ORDER BY (workspace_id, day, event_type)
AS SELECT
  workspace_id,
  toDate(created_at) AS day,
  event_type,
  count() AS events,
  uniqExact(session_id) AS sessions,
  uniqExact(user_id) AS users,
  sum(revenue) AS revenue
FROM analytics_events_ch
GROUP BY workspace_id, day, event_type;
```

```sql
CREATE TABLE analytics_ab_tests (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36) NOT NULL,
  name            VARCHAR(255),
  variants        JSON,                          -- [{name:'A',weight:50},{name:'B',weight:50}]
  metric          VARCHAR(100),                  -- 'conversion_rate','click_rate','revenue'
  min_sample_size INT DEFAULT 100,               -- per variant
  status          ENUM('draft','running','concluded','cancelled') DEFAULT 'draft',
  winner          VARCHAR(50),
  confidence      DECIMAL(5,2),                  -- 95.42 etc
  started_at      DATETIME,
  concluded_at    DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  INDEX idx_workspace_status (workspace_id, status)
) ENGINE=InnoDB;
```

---

## 4. API Contract

| Method | Path | Auth |
|---|---|---|
| **POST** | **`/track`** | API key (workspace) |
| GET | `/analytics/overview` | JWT + `analytics:r` |
| GET | `/analytics/realtime` | JWT + `analytics:r` |
| GET | `/analytics/attribution` | JWT + `analytics:r` |
| GET | `/analytics/funnel/:id` | JWT + `analytics:r` |
| GET | `/conversion-goals` | JWT + `analytics:r` |
| POST | `/conversion-goals` | JWT + `analytics:c` |
| POST | `/funnels` | JWT + `analytics:c` |
| GET | `/ab-tests/:id/result` | JWT + `analytics:r` |
| POST | `/ab-tests/:id/assign` | (public — visitor SDK) |
| GET | `/reports` | JWT + `reports:r` |
| POST | `/reports` | JWT + `reports:c` |
| POST | `/reports/:id/generate` | JWT + `reports:c` (async PDF) |
| GET | `/heatmaps/:url_hash` | JWT + `analytics:r` |
| POST | `/sessions/record` | API key (high-volume) |
| GET | `/predictions/contact/:id` | JWT + `analytics:r` |

### Sample: `POST /track` (the highest-volume endpoint)

```http
POST /api/v1/analytics/track HTTP/1.1
Host: track.yourplatform.com
Content-Type: application/json
X-Workspace-Token: wts_pub_01H...        // public workspace tracking token

{
  "events": [
    {
      "event_type": "page_view",
      "url": "https://pizzapalace.london/menu",
      "referrer": "https://google.com/",
      "visitor_id": "vid_01H...",
      "session_id": "sid_01H...",
      "user_id": null,
      "utm": { "source": "google", "medium": "cpc", "campaign": "summer-2026" },
      "device": { "type": "mobile", "browser": "Safari", "os": "iOS" },
      "custom": {},
      "ts": 1716893700123
    },
    {
      "event_type": "form_submit",
      "url": "https://pizzapalace.london/menu",
      "session_id": "sid_01H...",
      "custom": { "form_id": "newsletter" },
      "ts": 1716893712456
    }
  ]
}
```

**Response 204** (no content; sent within 50ms; processing async).

### `/track` Processing
1. CORS check (origin must be on workspace's allowlist)
2. Rate limit (1000 req/sec per workspace tier)
3. Bot filtering (user-agent + behavioural heuristics)
4. Validate event batch (max 100 events; Joi schema)
5. Enrich (IP → country via MaxMind; truncate IP to /24)
6. INSERT into `analytics_events` (MySQL/PostgreSQL) within a single transaction
7. INSERT into `core_outbox` (same transaction)
8. Return 204
9. **Async worker** `mkt-clickhouse-flush` reads outbox, batches 1000 rows, INSERTs into ClickHouse
10. Materialised views auto-update

---

## 5. Async Events

### Published
| Event | When |
|---|---|
| `analytics.conversion_goal_hit` | Conversion event matches a defined goal |
| `analytics.anomaly_detected` | Traffic/conversion anomaly via nightly analysis |
| `analytics.ab_test.winner_declared` | A/B test reaches statistical significance |
| `analytics.report.generated` | Custom report PDF ready |
| `analytics.session.replay_ready` | Heatmap session uploaded to S3 |
| `analytics.prediction.computed` | LTV/churn prediction computed for a contact |

### Consumed
| Event | From | Action |
|---|---|---|
| `crm.contact.created` | crm-automation | Initialise prediction stub |
| `crm.contact.activity` | crm-automation | Feed into LTV model |
| `campaign.launched` | campaign-manager | Associate UTM attributions to campaign |

### Bull Queues
| Queue | Purpose | Schedule | Concurrency |
|---|---|---|---|
| `mkt-clickhouse-flush` | Outbox → ClickHouse batch insert | Every 5s | 5 |
| `mkt-ab-significance-check` | Run chi-squared test on active A/B tests | Hourly | 5 |
| `mkt-report-generator` | Generate scheduled reports | Configurable per report | 5 |
| `mkt-pdf-report` | Render PDF via pdfkit | On-demand | 3 |
| `mkt-predictive-analytics` | Nightly LTV + churn computation | 01:00 UTC | 1 |
| `mkt-anomaly-detector` | Detect traffic anomalies | Hourly | 5 |
| `mkt-session-replay-upload` | Upload session recording to S3 | On-demand | 5 |

---

## 6. Dependencies

### Upstream
- `marketing-core` (workspace status, plan limits)

### Downstream (callers)
- ALL services emit events → consumed by `mkt-clickhouse-flush` indirectly via outbox
- Frontend — dashboard, reports, A/B test UI
- `integration-service` — proxies aggregated analytics for customer API

### External APIs
- **MaxMind GeoIP** — IP → country/city (local DB; 30-day refresh)
- **Google Analytics 4** — optional import of GA4 data for unified view

### Storage
- **MySQL/PostgreSQL** — operational, 30-day TTL
- **ClickHouse** — analytical, 5-year TTL
- **Elasticsearch** — for full-text search across reports
- **S3** — heatmap/session recording binaries

---

## 7. Folder Structure

```
services/analytics-engine/
├── _services/
│   ├── event-ingestor.service.js        # /track endpoint
│   ├── outbox.service.js                 # outbox pattern impl
│   ├── clickhouse-client.service.js
│   ├── attribution.service.js            # 4 attribution models
│   ├── funnel.service.js
│   ├── ab-test.service.js
│   ├── statistical.service.js            # chi-squared, t-test
│   ├── report-builder.service.js
│   ├── pdf-renderer.service.js
│   ├── predictive.service.js             # LTV regression + churn cohorts
│   ├── anomaly-detector.service.js
│   ├── session-recorder.service.js
│   └── bot-filter.service.js
├── tracking-script/
│   ├── track.js                          # served via cdn.yourplatform.com
│   ├── build.js
│   └── README.md
├── (standard folders)
└── app.js
```

---

## 8. Configuration

```bash
# Service Identity
SERVICE_NAME=analytics-engine
NODE_ENV=production
PORT=3104

# Database — operational events (MySQL dev / PostgreSQL prod)
DB_DIALECT=mysql
DATABASE_URL=mysql://app_write:****@primary:3306/marketing?ssl-mode=REQUIRED
DATABASE_READ_URL=mysql://app_read:****@replica:3306/marketing?ssl-mode=REQUIRED
DB_POOL_MAX=20                                    # higher pool — ingestion volume
DB_POOL_MIN=5

# ClickHouse (analytical store — production only; dev can use mock)
CLICKHOUSE_URL=https://****@clickhouse-cluster:8443
CLICKHOUSE_DB=mkt_analytics
CLICKHOUSE_USER=app
CLICKHOUSE_PASSWORD=****
CLICKHOUSE_FLUSH_BATCH_SIZE=1000
CLICKHOUSE_FLUSH_INTERVAL_MS=5000

# Redis (queues + caching dashboards)
REDIS_URL=rediss://****@redis-cluster:6379/0

# Search across events — v1 uses ClickHouse `LIKE` / database queries
# Elasticsearch DEFERRED to Phase 5+ — see tech.md "Search Engine"
# ELASTICSEARCH_URL=             # uncomment in Phase 5+
# ELASTICSEARCH_INDEX_PREFIX=mkt_

# Auth
JWT_SECRET=****
TRACKING_TOKEN_SECRET=****                        # for workspace public tracking tokens

# GeoIP (MaxMind GeoLite2 — free; updated monthly)
MAXMIND_DB_PATH=/data/GeoLite2-City.mmdb
MAXMIND_LICENSE_KEY=****                          # to download updates

# Tracking
TRACKING_DOMAIN=track.yourplatform.com
TRACKING_SCRIPT_CDN=https://cdn.yourplatform.com/track.js
TRACKING_BATCH_MAX_EVENTS=100
TRACKING_RATE_LIMIT_PER_WORKSPACE=1000           # events/sec per workspace tier (Pro)

# A/B Testing
AB_TEST_MIN_SAMPLE_SIZE=100
AB_TEST_SIGNIFICANCE_THRESHOLD=0.05

# Predictive Analytics
PREDICTION_MIN_HISTORY_DAYS=30
PREDICTIVE_MODEL_RETRAIN_DAILY_HOUR=01

# Anomaly Detection
ANOMALY_DETECTION_SENSITIVITY=2.0                 # standard deviations
ANOMALY_DETECTION_MIN_BASELINE_DAYS=14

# Session Replay
SESSION_REPLAY_ENABLED=true
SESSION_REPLAY_RETENTION_DAYS=90
# Storage of session replay binaries uses the pluggable storage driver:
#   path prefix: workspace/<id>/analytics/sessions/...

# Reports
REPORT_PDF_TEMPLATE_DIR=/app/templates/reports
REPORT_DEFAULT_TIMEZONE=Europe/London
# Generated PDF reports stored via pluggable storage driver:
#   path prefix: workspace/<id>/analytics/reports/...

# File Storage (PLUGGABLE — see storage-strategy.md)
# Set STORAGE_DRIVER=s3 (cloud) OR STORAGE_DRIVER=local (on-prem)
# All file vars defined ONCE in packages/shared-config and inherited here.
# Service does NOT define its own bucket; uses shared STORAGE_DRIVER + S3_BUCKET / LOCAL_STORAGE_PATH

# Service URLs
MARKETING_CORE_URL=http://marketing-core:3100
NOTIFICATION_SERVICE_URL=http://notification-service:3112

# Observability
SENTRY_DSN=https://****
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
LOG_LEVEL=info

# Feature Flags
FEATURE_CLICKHOUSE_ENABLED=true                   # false = MySQL-only mode (Phase 1-3)
FEATURE_SESSION_REPLAY_ENABLED=true
FEATURE_PREDICTIVE_LTV_ENABLED=false              # Phase 4+
```

| Variable | Local | Staging | Production |
|---|---|---|---|
| `DB_DIALECT` | mysql | mysql | postgres |
| `FEATURE_CLICKHOUSE_ENABLED` | false | true | true |
| `TRACKING_RATE_LIMIT_PER_WORKSPACE` | 100 | 500 | 1000+ |
| `LOG_LEVEL` | debug | info | warn |

---

## 9-14. (Deployment, Observability, Security, Testing, Local Dev, Runbooks)

### Critical Metrics
```
mkt_track_events_received_total{workspace_tier}     Counter   (1000+/sec)
mkt_track_events_dropped_total{reason}              Counter
mkt_clickhouse_flush_lag_seconds                    Gauge     (alert if > 60s)
mkt_outbox_pending_count                            Gauge     (alert if > 100k)
mkt_ab_tests_running_count                          Gauge
mkt_reports_generated_total{format}                 Counter
```

### Runbooks

**"ClickHouse lag growing"**
1. Check `mkt_outbox_pending_count` — should be < 10k
2. Check ClickHouse cluster health
3. Scale flush workers temporarily
4. If ClickHouse down: events still safe in MySQL/PostgreSQL outbox; replay when recovered

**"Anomaly false-positive flood"**
1. Adjust `ANOMALY_DETECTION_SENSITIVITY`
2. Workspace-specific suppression list for known seasonal patterns

**"Heavy customer overwhelming /track"**
1. Identify workspace via metrics by `workspace_tier`
2. Enable sampling for that workspace (10% of events)
3. Notify customer; offer Enterprise plan with higher capacity
