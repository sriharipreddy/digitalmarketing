# 🕵️ intelligence (Port 3107)
## Competitor Analysis · Ad Spy · Price Monitor · Market Share · AI Autopilot

> **Tier 3 — Best-effort.** Read-mostly service. Tolerates degradation gracefully. Heavy external scraping; budget-managed.

---

## 1. Service Identity

| Field | Value |
|---|---|
| **Service Name** | `intelligence` |
| **Port** | 3107 |
| **Maturity Tier** | Tier 3 |
| **SLA** | Best effort |
| **On-Call** | Next business day |
| **Owning Team** | Data Team |

**One-sentence purpose:** Surface competitor and market intelligence — ads they run, keywords they rank for, prices they charge, mentions they get, and AI-driven autopilot recommendations.

**Bounded context:** Everything competitor- and market-related. AI Marketing Autopilot recommendations (cross-cuts multiple services but synthesis lives here).

---

## 2. Responsibilities (DO / DON'T)

### ✅ DO
- Competitor profile management (workspace's tracked competitors)
- Ad spy (Meta Ad Library, Google Ads Transparency, LinkedIn Ad Library)
- Keyword gap analysis (their keywords ranking; ours not)
- Price monitoring (scrape competitor pricing pages)
- Brand mention aggregation
- Market share / share-of-voice tracking
- AI cost aggregation (per-workspace AI spend rollup)
- AI Marketing Autopilot weekly recommendations
- Competitor traffic estimation (SimilarWeb integration optional)

### ❌ DON'T
- Track customer's own analytics → `analytics-engine`
- Manage their campaigns → `campaign-manager`
- Do social listening for brand mentions → `social-hub` (we read their data via event)
- Generate content recommendations → `content-ai`

---

## 3. Domain Model

### Tables Owned (6)

| Table | Purpose |
|---|---|
| `intel_competitors` | Workspace's tracked competitors |
| `intel_competitor_ads` | Captured competitor ad creatives |
| `intel_price_monitors` | Watched competitor pricing pages |
| `intel_brand_mentions` | Aggregated mentions (cross-platform) |
| `intel_market_share` | Monthly share-of-voice snapshots |
| `intel_autopilot_recommendations` | AI-generated weekly recommendations |

### Key Schemas

```sql
CREATE TABLE intel_competitors (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  domain          VARCHAR(255) NOT NULL,
  name            VARCHAR(255),
  industry        VARCHAR(100),
  manually_added  TINYINT(1) DEFAULT 0,
  ai_discovered   TINYINT(1) DEFAULT 0,
  monthly_traffic_estimate INT,
  traffic_sources JSON,                          -- {organic: 45, paid: 20, social: 15, ...}
  top_keywords    JSON,
  tech_stack      JSON,                          -- detected via wappalyzer-like
  last_analysed   DATETIME,
  status          ENUM('active','archived') DEFAULT 'active',
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  UNIQUE KEY uk_workspace_domain (workspace_id, domain),
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB;

CREATE TABLE intel_competitor_ads (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  competitor_id   CHAR(36) NOT NULL,
  workspace_id    CHAR(36) NOT NULL,
  platform        ENUM('meta_ad_library','google_transparency','linkedin_ad_library','tiktok_ad_library'),
  ad_external_id  VARCHAR(255),
  headline        VARCHAR(500),
  body            TEXT,
  cta             VARCHAR(100),
  landing_url     VARCHAR(2048),
  asset_urls      JSON,                          -- screenshots / images
  format          ENUM('image','video','carousel','text'),
  first_seen      DATE,
  last_seen       DATE,
  active          TINYINT(1) DEFAULT 1,
  metadata        JSON,
  INDEX idx_competitor (competitor_id),
  INDEX idx_platform_seen (platform, last_seen)
) ENGINE=InnoDB;

CREATE TABLE intel_price_monitors (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36) NOT NULL,
  competitor_id   CHAR(36),
  url             VARCHAR(2048) NOT NULL,
  product_name    VARCHAR(255),
  css_selector    VARCHAR(500),                  -- where to find price
  current_price   DECIMAL(12,2),
  currency        CHAR(3) DEFAULT 'GBP',
  prev_price      DECIMAL(12,2),
  changed_at      DATETIME,
  last_checked_at DATETIME,
  check_frequency_min INT DEFAULT 60,
  status          ENUM('active','paused','failing') DEFAULT 'active',
  failure_count   INT DEFAULT 0,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB;

CREATE TABLE intel_autopilot_recommendations (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36) NOT NULL,
  category        ENUM('seo','ppc','content','social','email','crm','general'),
  priority        ENUM('high','medium','low'),
  title           VARCHAR(255),
  description     TEXT,
  recommended_action JSON,
  estimated_impact JSON,                         -- {revenue_increase_pct, traffic_increase_pct}
  status          ENUM('new','viewed','accepted','dismissed','expired') DEFAULT 'new',
  generated_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at      DATETIME,
  acted_on_at     DATETIME,
  INDEX idx_workspace_status (workspace_id, status)
) ENGINE=InnoDB;
```

---

## 4. API Contract

| Method | Path | Permission |
|---|---|---|
| GET | `/competitors` | `intelligence:r` |
| POST | `/competitors` | `intelligence:c` |
| GET | `/competitors/:id` | `intelligence:r` |
| DELETE | `/competitors/:id` | `intelligence:d` |
| POST | `/competitors/:id/analyse` | `intelligence:u` (trigger re-analysis) |
| GET | `/ad-spy` | `intelligence:r` |
| GET | `/keyword-gap` | `intelligence:r` |
| GET | `/price-monitor` | `intelligence:r` |
| POST | `/price-monitor` | `intelligence:c` |
| GET | `/market-share` | `intelligence:r` |
| GET | `/autopilot/recommendations` | `intelligence:r` |
| POST | `/autopilot/recommendations/:id/accept` | `intelligence:u` |
| POST | `/autopilot/recommendations/:id/dismiss` | `intelligence:u` |
| POST | `/internal/ai-cost/record` | (service JWT — called by content-ai) |
| GET | `/internal/ai-cost/usage/:workspace_id` | (service JWT) |

---

## 5. Async Events

### Published
| Event | When |
|---|---|
| `intelligence.competitor.new_ad_detected` | New ad found in spy |
| `intelligence.price.changed` | Competitor price moved |
| `intelligence.autopilot.recommendation_generated` | New recommendation |
| `intelligence.ai_cost.cap_exceeded` | Workspace exceeded hourly cap |
| `intelligence.market_share.changed` | Monthly share-of-voice shift |

### Consumed
| Event | From | Action |
|---|---|---|
| (all AI-generation events) | content-ai, media-hub | Aggregate to `intel_ai_usage` |
| `seo.ranking.changed` | seo-engine | Feed into competitive analysis |
| `social.mention.detected` | social-hub | Add to brand mentions |

### Bull Queues
| Queue | Purpose | Schedule |
|---|---|---|
| `mkt-price-monitor` | Puppeteer-scrape competitor prices | Hourly |
| `mkt-competitor-analysis` | Full competitor refresh | Weekly Sunday 02:00 UTC |
| `mkt-ad-spy-sync` | Pull from Meta Ad Library / Google Transparency | Daily 04:00 UTC |
| `mkt-ai-cost-aggregator` | Per-workspace AI spend rollup | Every 5 min |
| `mkt-autopilot-recommender` | Generate weekly recommendations | Weekly Friday 09:00 workspace TZ |

---

## 6. Dependencies

### External APIs
- **Meta Ad Library API** — public, no auth, rate-limited
- **Google Ads Transparency Center** — scraping (Cheerio)
- **LinkedIn Ad Library** — scraping
- **SimilarWeb API** — optional ($100s/mo) for traffic estimates
- **DataForSEO** — competitor keyword data (via seo-engine API; we don't call directly)

### Tooling
- Puppeteer for price scraping
- Playwright fallback for Cloudflare-protected pages

---

## 7. Folder Structure (standard — see 00-standards.md)

## 8. Configuration

```bash
# Service Identity
SERVICE_NAME=intelligence
NODE_ENV=production
PORT=3107

# Database
DB_DIALECT=mysql
DATABASE_URL=mysql://app_write:****@primary:3306/marketing?ssl-mode=REQUIRED
DB_POOL_MAX=10
DB_POOL_MIN=2

# Redis
REDIS_URL=rediss://****@redis-cluster:6379/0

# Auth
JWT_SECRET=****
SERVICE_NAME_FOR_JWT=intelligence

# DataForSEO (competitor keyword data — uses seo-engine cache; we don't call directly)
SEO_ENGINE_URL=http://seo-engine:3101

# SimilarWeb (optional — paid traffic estimates)
SIMILARWEB_API_KEY=                               # optional
SIMILARWEB_ENABLED=false

# Meta Ad Library (free public API)
META_AD_LIBRARY_API_URL=https://graph.facebook.com/v20.0/ads_archive
META_ACCESS_TOKEN=****                            # app access token

# Scraping
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
SCRAPER_USER_AGENT=YourPlatformBot/1.0 (+https://yourplatform.com/bot)
SCRAPER_RESPECT_ROBOTS=true
PLAYWRIGHT_ENABLED=true                           # fallback for Cloudflare-protected pages

# Price Monitor
PRICE_MONITOR_DEFAULT_CHECK_FREQUENCY_MIN=60
PRICE_MONITOR_MAX_FAILURE_COUNT=5

# AI Cost Aggregation
CONTENT_AI_URL=http://content-ai:3102             # for cost recording
MEDIA_HUB_URL=http://media-hub:3111
AI_SPEND_AGGREGATION_INTERVAL_MIN=5
AI_WORKSPACE_DAILY_BUDGET_DEFAULT_USD=50

# Autopilot
AUTOPILOT_RUN_DAY=friday
AUTOPILOT_RUN_HOUR_WORKSPACE_TZ=9
AUTOPILOT_MIN_HISTORY_DAYS=30

# Marketing-core
MARKETING_CORE_URL=http://marketing-core:3100

# Observability
SENTRY_DSN=https://****
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
LOG_LEVEL=info

# Feature Flags
FEATURE_AUTOPILOT_ENABLED=false                   # Phase 4
FEATURE_AD_SPY_ENABLED=true
FEATURE_PRICE_MONITOR_ENABLED=true
```

---

## 9-14. (Deployment, Observability, Security, Testing, Local Dev, Runbooks)

### Runbooks

**"Price monitor failing on a workspace"**
1. Check `intel_price_monitors.failure_count` — if >5, status auto-set to 'failing'
2. Common cause: competitor site changed structure (CSS selector broken)
3. Surface in UI: "We can't read this page anymore — please update the selector"
4. Offer AI-assisted selector finder

**"Autopilot recommendations stale"**
1. Check `mkt-autopilot-recommender` cron — running Fridays?
2. Check workspace has enough data history (need ≥30 days)
3. Recommendation engine: ensure ≥3 active per workspace; surface oldest first
