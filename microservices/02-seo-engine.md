# 🔍 seo-engine (Port 3101)
## SEO · Crawler · Rank Tracking · Backlinks · Local SEO · ASO

> **Tier 2 — Important.** Power user feature; high data volume; external API spend management is critical.

---

## 1. Service Identity

| Field | Value |
|---|---|
| **Service Name** | `seo-engine` |
| **Port** | 3101 |
| **Maturity Tier** | Tier 2 |
| **SLA** | 99.5% uptime |
| **On-Call** | Business hours |
| **Owning Team** | SEO Team |

**One-sentence purpose:** Discover keywords, track rankings, audit sites for technical SEO issues, monitor backlinks, manage local + app store listings.

**Bounded context:** Everything related to organic discoverability on Google, Bing, App Stores, and Google Maps. The single source of truth for "what keywords are we ranking for and how are we doing technically."

---

## 2. Responsibilities (DO / DON'T)

### ✅ This service IS responsible for:
- Keyword research (volume, difficulty, CPC, intent classification)
- Daily rank tracking (Google + Bing, desktop + mobile)
- Technical SEO audits (crawler) — broken links, missing meta, Core Web Vitals
- Backlink monitoring (new/lost backlinks; toxic link detection)
- SERP snapshots (featured snippets, People Also Ask)
- Google Search Console integration (import impressions/clicks)
- Local SEO: Google Business Profile management
- ASO (App Store Optimization) for iOS + Android
- Schema markup generation (JSON-LD)
- Competitor SEO data (their keywords, their backlinks)

### ❌ This service does NOT do:
- Generate content suggestions → **`content-ai`** (we provide briefs only)
- Run paid Google Ads → **`campaign-manager`**
- Calculate ROAS or business analytics → **`analytics-engine`**
- Send keyword rank alerts via email → publish events; **`notification-service`** sends them
- Compete with paid ad management → strict separation: organic only

---

## 3. Domain Model

### Tables Owned (10)

| Table | Purpose |
|---|---|
| `seo_keywords` | Workspace's tracked keywords with volume/difficulty/intent |
| `seo_rankings` | Daily position per keyword (partitioned by month) |
| `seo_clusters` | Topic pillar grouping for content strategy |
| `seo_backlinks` | Discovered backlinks pointing to workspace's domain |
| `seo_backlink_alerts` | Lost/gained/toxic backlink events |
| `seo_audits` | Audit job records (crawl progress + summary score) |
| `seo_audit_issues` | Individual issues found by crawler (per URL per issue type) |
| `seo_serp_snapshots` | Captured SERP results per keyword per day |
| `seo_local_listings` | Google Business Profile state per workspace location |
| `seo_app_listings` | App Store + Google Play listing state per app |

### Key Schemas

```sql
CREATE TABLE seo_keywords (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  keyword         VARCHAR(500) NOT NULL,
  search_volume   INT,
  difficulty      TINYINT,                          -- 0-100
  cpc             DECIMAL(6,2),
  intent          ENUM('informational','commercial','transactional','navigational'),
  country         CHAR(2),
  language        CHAR(5),
  source          ENUM('manual','ai_suggested','competitor_stolen','keyword_research'),
  cluster_id      CHAR(36),
  status          ENUM('tracking','paused','archived') DEFAULT 'tracking',
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  UNIQUE KEY uk_workspace_keyword (workspace_id, keyword, country, language),
  INDEX idx_workspace (workspace_id),
  INDEX idx_cluster (cluster_id)
) ENGINE=InnoDB;

CREATE TABLE seo_rankings (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  keyword_id      CHAR(36) NOT NULL,
  workspace_id    CHAR(36) NOT NULL,
  domain          VARCHAR(255) NOT NULL,
  position        TINYINT,                       -- 1-100, NULL = not ranking top 100
  prev_position   TINYINT,
  url             VARCHAR(2048),
  search_engine   ENUM('google','bing') DEFAULT 'google',
  device          ENUM('desktop','mobile') DEFAULT 'desktop',
  date            DATE NOT NULL,
  INDEX idx_keyword_date (keyword_id, date),
  INDEX idx_workspace_date (workspace_id, date)
) ENGINE=InnoDB
PARTITION BY RANGE (TO_DAYS(date)) (
  PARTITION p_2026_q2 VALUES LESS THAN (TO_DAYS('2026-07-01')),
  PARTITION p_2026_q3 VALUES LESS THAN (TO_DAYS('2026-10-01')),
  PARTITION p_future   VALUES LESS THAN MAXVALUE
);

CREATE TABLE seo_audits (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36) NOT NULL,
  domain          VARCHAR(255) NOT NULL,
  status          ENUM('queued','running','completed','failed') DEFAULT 'queued',
  overall_score   TINYINT,
  pages_crawled   INT DEFAULT 0,
  pages_total     INT,                            -- discovered URLs
  issues_critical INT DEFAULT 0,
  issues_warning  INT DEFAULT 0,
  issues_info     INT DEFAULT 0,
  started_at      DATETIME,
  completed_at    DATETIME,
  error_message   TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  INDEX idx_workspace (workspace_id),
  INDEX idx_status (status)
) ENGINE=InnoDB;

CREATE TABLE seo_audit_issues (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  audit_id        CHAR(36) NOT NULL,
  workspace_id    CHAR(36) NOT NULL,
  url             VARCHAR(2048),
  issue_type      VARCHAR(100),                   -- 'missing_meta_description', 'slow_lcp'
  severity        ENUM('critical','warning','info') NOT NULL,
  description     TEXT,
  recommendation  TEXT,
  auto_fixable    TINYINT(1) DEFAULT 0,
  fixed           TINYINT(1) DEFAULT 0,
  fixed_at        DATETIME,
  INDEX idx_audit_severity (audit_id, severity),
  INDEX idx_workspace_type (workspace_id, issue_type)
) ENGINE=InnoDB;

CREATE TABLE seo_backlinks (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36) NOT NULL,
  source_url      VARCHAR(2048) NOT NULL,
  target_url      VARCHAR(2048) NOT NULL,
  anchor_text     VARCHAR(500),
  source_domain   VARCHAR(255),
  domain_authority INT,
  domain_rating   INT,
  do_follow       TINYINT(1) DEFAULT 1,
  toxic_score     TINYINT,
  status          ENUM('active','lost','broken') DEFAULT 'active',
  first_seen      DATE,
  last_checked    DATE,
  deleted_at      DATETIME NULL,
  UNIQUE KEY uk_source_target (source_url(255), target_url(255)),
  INDEX idx_workspace (workspace_id),
  INDEX idx_source_domain (source_domain)
) ENGINE=InnoDB;
```

### Invariants

- A keyword cannot be tracked twice for same (workspace, country, language)
- Audit must have at least one URL crawled before completing
- Backlink unique per source-target pair
- Rankings only stored for tracked keywords (FK to seo_keywords)

---

## 4. API Contract

### Endpoint Catalogue

| Method | Path | Permission | Idempotency |
|---|---|---|---|
| GET | `/keywords` | `seo_keywords:r` | — |
| POST | `/keywords` | `seo_keywords:c` | Yes |
| POST | `/keywords/bulk` | `seo_keywords:c` | Yes |
| GET | `/keywords/:id` | `seo_keywords:r` | — |
| DELETE | `/keywords/:id` | `seo_keywords:d` | No |
| POST | `/keywords/research` | `seo_keywords:c` | Yes |
| GET | `/keywords/:id/rankings` | `seo_keywords:r` | — |
| POST | `/keywords/clusters` | `seo_keywords:c` | Yes |
| GET | `/audits` | `seo_audits:r` | — |
| POST | `/audits` | `seo_audits:c` | Yes |
| GET | `/audits/:id` | `seo_audits:r` | — |
| GET | `/audits/:id/issues` | `seo_audits:r` | — |
| POST | `/audits/:id/issues/:issue_id/fix` | `seo_audits:u` | Yes |
| GET | `/backlinks` | `seo_backlinks:r` | — |
| GET | `/backlinks/alerts` | `seo_backlinks:r` | — |
| POST | `/backlinks/disavow` | `seo_backlinks:u` | Yes |
| GET | `/serp/:keyword_id` | `seo_keywords:r` | — |
| POST | `/local/gmb/connect` | `seo_local:c` | Yes |
| GET | `/local/listings` | `seo_local:r` | — |
| PATCH | `/local/listings/:id` | `seo_local:u` | Yes |
| POST | `/local/listings/:id/post` | `seo_local:u` | Yes |
| GET | `/aso/listings` | `seo_aso:r` | — |
| PATCH | `/aso/listings/:id` | `seo_aso:u` | Yes |
| POST | `/schema/generate` | `seo_audits:c` | Yes |
| GET | `/internal/keywords/:id` | (service JWT) | — |

### Sample: `POST /audits` (run a technical SEO audit)

```http
POST /api/v1/seo/audits HTTP/1.1
Authorization: Bearer eyJ...
Idempotency-Key: audit-pizzapalace-2026-05-28

{
  "domain": "pizzapalace.london",
  "max_pages": 500,
  "include_subdomains": false,
  "respect_robots_txt": true
}
```

**Response 202:**
```json
{
  "id": "aud_01H...",
  "status": "queued",
  "estimated_duration_seconds": 600,
  "stream_url": "/api/v1/seo/audits/aud_01H.../stream"
}
```

Audit runs async via `mkt-seo-crawler` queue. Client can stream progress via SSE at `stream_url`.

---

## 5. Async Events

### Published
| Event | When |
|---|---|
| `seo.audit.completed` | Audit finishes (success or fail) |
| `seo.ranking.changed` | Keyword position changes by ≥3 vs yesterday |
| `seo.ranking.top10_entered` | Keyword enters top 10 first time |
| `seo.ranking.top10_lost` | Keyword falls out of top 10 |
| `seo.backlink.gained` | New backlink discovered |
| `seo.backlink.lost` | Previously-tracked backlink missing |
| `seo.backlink.toxic_detected` | High toxic score backlink found |
| `seo.local.review_received` | New Google review |

### Consumed
| Event | From | Action |
|---|---|---|
| `core.workspace.cancelled` | marketing-core | Pause all crons for this workspace |

### Bull Queues

| Queue | Purpose | Schedule | Concurrency |
|---|---|---|---|
| `mkt-seo-crawler` | Crawl site for technical audit | On-demand | 5 (Puppeteer = memory-heavy) |
| `mkt-rank-tracker` | Daily SERP position check | Daily 02:00 UTC | 20 |
| `mkt-backlink-monitor` | Check backlink status | Daily 03:00 UTC | 10 |
| `mkt-keyword-research` | Discover new keywords | On-demand | 3 |
| `mkt-gsc-sync` | Import Google Search Console data | Daily 04:00 UTC | 5 |
| `mkt-aso-sync` | Refresh App Store rankings | Daily 05:00 UTC | 3 |

---

## 6. Dependencies

### Upstream (calls)
- `marketing-core` — workspace status, plan features (cached)
- `content-ai` — for AI meta tag rewrites + content brief generation
- `notification-service` — alert delivery on ranking changes (via async event)

### External APIs
| Provider | Rate Limit | Handling |
|---|---|---|
| **DataForSEO** | 30 req/sec | Bull queue throttle; per-workspace cost cap |
| **Google Search Console** | 1,200 req/min per project | OAuth per workspace; cache 1 hour |
| **Google PageSpeed Insights** | 25,000 queries/day | Per-URL caching 24h |
| **Google Business Profile** | 5 QPS per account | OAuth per workspace; webhook for reviews |
| **App Store Connect API** | 200 req/hour | JWT auth; cache 12h |
| **Google Play Developer API** | Standard | OAuth; cache 12h |

### Redis Keys
| Key | TTL |
|---|---|
| `mkt:seo:serp:<keyword_id>:<date>` | 24h |
| `mkt:seo:pagespeed:<url_hash>` | 24h |
| `mkt:seo:gmb_token:<workspace_id>` | 50min (refresh before 60min Google expiry) |
| `mkt:seo:crawl_lock:<workspace_id>` | 1h (prevent concurrent crawls per workspace) |

---

## 7. Folder Structure

```
services/seo-engine/
├── _services/
│   ├── keyword.service.js
│   ├── keyword-research.service.js     # DataForSEO integration
│   ├── rank-tracker.service.js
│   ├── crawler.service.js              # cheerio + puppeteer
│   ├── audit.service.js
│   ├── backlink.service.js
│   ├── serp.service.js
│   ├── gsc.service.js                  # Google Search Console
│   ├── gmb.service.js                  # Google Business Profile
│   ├── aso.service.js
│   ├── schema-generator.service.js
│   └── dataforseo-client.service.js    # Generic client with retry + cost tracking
├── crawler/
│   ├── cheerio-crawler.js              # Fast static-page crawler
│   ├── puppeteer-crawler.js            # JS-rendered fallback
│   ├── robots-parser.js
│   ├── sitemap-parser.js
│   └── extractors/
│       ├── title-meta.extractor.js
│       ├── headings.extractor.js
│       ├── images.extractor.js
│       ├── links.extractor.js
│       ├── schema-markup.extractor.js
│       └── core-web-vitals.extractor.js
├── cron/
│   ├── seo-crawler.cron.js
│   ├── rank-tracker.cron.js
│   ├── backlink-monitor.cron.js
│   └── ...
├── (standard folders: routes/, controllers/, middleware/, models/, migrations/, events/, test/)
└── app.js
```

---

## 8. Configuration

```bash
# Service Identity
SERVICE_NAME=seo-engine
NODE_ENV=production
PORT=3101

# Database (dual dialect — MySQL dev, PostgreSQL prod)
DB_DIALECT=mysql
DATABASE_URL=mysql://app_write:****@primary:3306/marketing?ssl-mode=REQUIRED
DATABASE_READ_URL=mysql://app_read:****@replica:3306/marketing?ssl-mode=REQUIRED
DB_POOL_MAX=10
DB_POOL_MIN=2

# Redis (queues + caching)
REDIS_URL=rediss://****@redis-cluster:6379/0

# Search — v1 uses database FULLTEXT (MySQL) / tsvector (PostgreSQL)
# Elasticsearch DEFERRED to Phase 5+ — see tech.md "Search Engine"
# ELASTICSEARCH_URL=             # uncomment in Phase 5+
# ELASTICSEARCH_INDEX_KEYWORDS=seo_keywords

# Auth
JWT_SECRET=****
SERVICE_NAME_FOR_JWT=seo-engine
MASTER_DEK_HEX=****                                # for OAuth token encryption (GSC, GMB, ASO)

# DataForSEO (primary SEO data provider)
DATAFORSEO_LOGIN=****
DATAFORSEO_PASSWORD=****
DATAFORSEO_API_URL=https://api.dataforseo.com/v3

# Google
GSC_CLIENT_ID=****                                 # Google Search Console OAuth
GSC_CLIENT_SECRET=****
GSC_OAUTH_REDIRECT_URI=https://api.yourplatform.com/api/v1/seo/gsc/oauth/callback
PAGESPEED_API_KEY=****                             # PageSpeed Insights server key
GMB_CLIENT_ID=****                                 # Google Business Profile OAuth
GMB_CLIENT_SECRET=****
GMB_OAUTH_REDIRECT_URI=https://api.yourplatform.com/api/v1/seo/local/gmb/oauth/callback

# Apple App Store Connect
APPSTORE_CONNECT_KEY_ID=****
APPSTORE_CONNECT_ISSUER_ID=****
APPSTORE_CONNECT_PRIVATE_KEY_BASE64=****           # base64-encoded p8 key

# Google Play
GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_JSON_BASE64=****   # base64-encoded service account JSON

# Crawler
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
CRAWLER_MAX_PAGES_DEFAULT=500
CRAWLER_USER_AGENT=YourPlatformSEOBot/1.0 (+https://yourplatform.com/bot)
CRAWLER_TIMEOUT_MS=30000
CRAWLER_RESPECT_ROBOTS=true
CRAWLER_REQUEST_DELAY_MS=1000                      # rate limit per target domain

# Cost Caps
DATAFORSEO_DAILY_BUDGET_USD=50                     # platform-wide
DATAFORSEO_WORKSPACE_DAILY_CAP_USD=5

# Content-AI (for AI meta tag rewrites)
CONTENT_AI_URL=http://content-ai:3102

# Service URLs
MARKETING_CORE_URL=http://marketing-core:3100
NOTIFICATION_SERVICE_URL=http://notification-service:3112

# Observability
SENTRY_DSN=https://****
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
LOG_LEVEL=info

# Feature Flags
FEATURE_GSC_INTEGRATION_ENABLED=true
FEATURE_GMB_INTEGRATION_ENABLED=true
FEATURE_ASO_ENABLED=false                          # Phase 5
FEATURE_BACKLINK_MONITOR_ENABLED=true
```

---

## 9. Deployment

ECS task: 2 vCPU, 4 GB memory (Puppeteer is memory-hungry).
desiredCount: 2 minimum, 8 max.

Puppeteer Chromium pre-installed in Docker image via:
```dockerfile
RUN apk add chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

Health check includes DataForSEO heartbeat (cached 5min).

---

## 10. Observability

### Metrics
```
seo_keywords_tracked_total{workspace_tier}                Gauge
seo_ranking_checks_total{search_engine, device}           Counter
seo_ranking_changes_total{direction}                      Counter
seo_audit_runs_total{status}                              Counter
seo_audit_pages_crawled_total                             Counter
seo_crawler_duration_seconds{type}                        Histogram (cheerio/puppeteer)
seo_dataforseo_cost_usd_total{api_endpoint, workspace_tier}   Counter
seo_dataforseo_requests_total{status}                     Counter
seo_backlinks_gained_total                                Counter
seo_backlinks_lost_total                                  Counter
```

### Alerts
- `DataForSEODailyBudgetExceeded` (P2)
- `CrawlerWorkerStuck` — single audit taking > 1h (P3)
- `RankTrackerLag` — daily ranking job not done by 04:00 UTC (P2)

---

## 11. Security

### Permissions
- `seo_keywords` (CRUD)
- `seo_audits` (CRUD)
- `seo_backlinks` (R, U for disavow)
- `seo_local` (CRUD)
- `seo_aso` (CRUD)

### OAuth Tokens
- Google Search Console + GMB + Google Play tokens stored AES-encrypted via per-workspace KEK (see security.md)
- Apple App Store Connect private key encrypted similarly

### Crawler Security
- Strict user-agent identification
- Respect robots.txt (configurable; defaults true)
- Crawl rate limited: max 1 req/sec per target domain
- Never follow forms / submit data on customer domain (security risk)

---

## 12. Testing

- Unit: keyword scoring algorithm, schema generator output validation, robots.txt parser
- Integration: full audit flow (crawl 10-page mock site → verify all issue types caught)
- Mock DataForSEO with realistic responses; record real responses periodically to refresh fixtures
- Workspace isolation tests on all endpoints

### Load Targets
- `POST /audits` — 50 concurrent audits running, no degradation
- Rank tracker — process 10,000 keywords in 4-hour daily window

---

## 13. Local Development

```bash
yarn dev
```

Mock DataForSEO server included via `services/seo-engine/test/mock-dataforseo-server.js` — run locally with `yarn mock:dataforseo` to avoid burning API credits during dev.

Sample test domain: `localhost:3000` (the Vite dev server itself) — has known SEO issues for testing crawler.

---

## 14. Runbooks

### "DataForSEO costs spiked"
1. Check `seo_dataforseo_cost_usd_total` Grafana → which workspace?
2. Apply emergency cap: SET workspace's daily cap to £0 via admin endpoint
3. Investigate: legitimate usage (notify customer of plan tier) or bug/abuse (block + investigate)

### "Crawler stuck on one workspace"
1. Check Bull dashboard for `mkt-seo-crawler` queue
2. Find the stuck job ID, check logs for last URL crawled
3. Common cause: infinite redirect loop, malicious robots.txt, very large site
4. Kill stuck job, add domain to crawler's known-problematic list for next attempt

### "Mass keyword ranking drops detected"
1. Check Google Search Console for algorithm update notices
2. Communicate proactively: dashboard banner "Recent Google update detected; rankings may be unstable"
3. Hold off on automated rank-drop alerts for 48 hours to avoid customer panic
4. Re-enable alerts; provide analysis once dust settles
