# 🎯 campaign-manager (Port 3103)
## PPC Ads · One-Click Market Capture · UTM · Retargeting · Webinars

> **Tier 1 — The Flagship.** Owns the One-Click Market Capture feature. Without this service, the platform has no differentiator.

---

## 1. Service Identity

| Field | Value |
|---|---|
| **Service Name** | `campaign-manager` |
| **Port** | 3103 |
| **Maturity Tier** | Tier 1 |
| **SLA** | 99.9% uptime |
| **On-Call** | 24/7 |
| **Owning Team** | Campaigns Team |

**One-sentence purpose:** Orchestrate multi-channel marketing campaigns end-to-end — from One-Click AI generation to launching live ads on Google, Meta, LinkedIn, TikTok.

**Bounded context:** Anything called a "campaign", anything related to paid advertising, anything related to multi-channel coordination, UTM links, landing pages, A/B test definitions, webinars.

---

## 2. Responsibilities (DO / DON'T)

### ✅ DO
- Campaign CRUD with status state machine (draft → active → paused → completed)
- **One-Click Market Capture** (the 11-step AI pipeline)
- Multi-channel orchestration (call content-ai, seo-engine, email-hub, social-hub, crm-automation)
- Google Ads campaign creation + management
- Meta Ads (Facebook + Instagram) campaign creation
- LinkedIn Ads + TikTok Ads
- UTM link builder + short link service
- Retargeting pixel management (install + serve snippets)
- Landing page generation (HTML stored; served via the `landing-renderer` Express SSR app at `pages.yourplatform.com/p/<slug>`)
- A/B test definitions (analytics-engine measures results)
- Webinar pages + registration

### ❌ DON'T
- Generate AI content directly → `content-ai`
- Send the campaign emails → `email-hub`
- Post the social content → `social-hub`
- Track analytics for campaigns → `analytics-engine` (we trigger goals; they measure)
- Manage influencers → `influencer-hub`

---

## 3. Domain Model

### Tables Owned (10)

| Table | Purpose |
|---|---|
| `campaign_campaigns` | Top-level campaign with goal + budget + status |
| `campaign_channels` | One row per channel within a campaign (Google Ads, Meta, email, etc.) |
| `campaign_metrics` | Daily metrics per channel (impressions, clicks, conversions, spend) |
| `campaign_ad_creatives` | Individual ad copy + image variants |
| `campaign_landing_pages` | Generated landing pages (HTML + JSON design) |
| `campaign_utm_links` | UTM-tagged short links + click tracking |
| `campaign_retargeting_pixels` | Pixel snippets installed per platform |
| `analytics_ab_tests` | A/B test definitions (variants + traffic split) |
| `campaign_webinars` | Webinar pages + scheduling |
| `campaign_webinar_registrants` | Registrations per webinar |
| `campaign_oneclick_jobs` | One-Click Capture orchestration state |
| `campaign_oneclick_steps` | Per-step output (for SSE resume + idempotency) |

### Key Schemas

```sql
CREATE TABLE campaign_campaigns (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  name            VARCHAR(255) NOT NULL,
  type            ENUM('seo','ppc','email','social','multi_channel','aso','webinar') NOT NULL,
  status          ENUM('draft','active','paused','completed','archived') DEFAULT 'draft',
  objective       ENUM('awareness','traffic','leads','sales','retention','app_installs'),
  budget          DECIMAL(12,2),
  budget_period   ENUM('daily','weekly','monthly','total'),
  start_date      DATE,
  end_date        DATE,
  goal_type       VARCHAR(100),                    -- 'leads','revenue','signups'
  goal_value      DECIMAL(12,2),                   -- target number
  ai_generated    TINYINT(1) DEFAULT 0,
  oneclick_job_id CHAR(36),
  metadata        JSON,
  created_by      CHAR(36),
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  INDEX idx_workspace_status (workspace_id, status),
  INDEX idx_dates (start_date, end_date)
) ENGINE=InnoDB;

CREATE TABLE campaign_channels (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36) NOT NULL,
  campaign_id     CHAR(36) NOT NULL,
  channel         ENUM('google_ads','meta','linkedin','twitter','tiktok','email','sms','push','organic_seo','organic_social','influencer') NOT NULL,
  status          ENUM('draft','pending','active','paused','completed','failed') DEFAULT 'draft',
  budget_allocated DECIMAL(12,2),
  spent           DECIMAL(12,2) DEFAULT 0,
  external_id     VARCHAR(255),                    -- Google Ads campaign ID, Meta campaign ID
  config          JSON,                            -- channel-specific settings
  last_synced_at  DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  INDEX idx_campaign (campaign_id)
) ENGINE=InnoDB;

CREATE TABLE campaign_oneclick_jobs (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36) NOT NULL,
  initiated_by    CHAR(36),
  input_url       VARCHAR(2048),
  input_description TEXT,
  industry_hint   VARCHAR(100),
  status          ENUM('queued','running','completed','failed','cancelled') DEFAULT 'queued',
  current_step    TINYINT,                         -- 1-11
  total_credits_used INT DEFAULT 0,
  total_cost_usd  DECIMAL(8,2) DEFAULT 0,
  campaign_id     CHAR(36),                        -- output campaign created
  started_at      DATETIME,
  completed_at    DATETIME,
  failure_reason  TEXT,
  idempotency_key VARCHAR(100),
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_workspace (workspace_id),
  INDEX idx_status (status),
  INDEX idx_idempotency (idempotency_key)
) ENGINE=InnoDB;

CREATE TABLE campaign_oneclick_steps (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  job_id          CHAR(36) NOT NULL,
  step_num        TINYINT NOT NULL,
  step_name       VARCHAR(100),
  status          ENUM('pending','running','completed','failed','skipped') DEFAULT 'pending',
  input           JSON,
  output          JSON,
  duration_ms     INT,
  credits_used    INT,
  cost_usd        DECIMAL(8,4),
  started_at      DATETIME,
  completed_at    DATETIME,
  failure_reason  TEXT,
  UNIQUE KEY uk_job_step (job_id, step_num),
  INDEX idx_job (job_id)
) ENGINE=InnoDB;

CREATE TABLE campaign_utm_links (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36) NOT NULL,
  campaign_id     CHAR(36),
  original_url    VARCHAR(2048) NOT NULL,
  utm_source      VARCHAR(100),
  utm_medium      VARCHAR(100),
  utm_campaign    VARCHAR(100),
  utm_content     VARCHAR(100),
  utm_term        VARCHAR(100),
  short_code      VARCHAR(20) UNIQUE,             -- for /go/:short_code redirect
  clicks          INT DEFAULT 0,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  INDEX idx_workspace (workspace_id),
  INDEX idx_short_code (short_code)
) ENGINE=InnoDB;
```

---

## 4. API Contract

| Method | Path | Permission |
|---|---|---|
| GET | `/campaigns` | `campaigns:r` |
| POST | `/campaigns` | `campaigns:c` |
| GET | `/campaigns/:id` | `campaigns:r` |
| PATCH | `/campaigns/:id` | `campaigns:u` |
| DELETE | `/campaigns/:id` | `campaigns:d` |
| POST | `/campaigns/:id/launch` | `campaigns:u` |
| POST | `/campaigns/:id/pause` | `campaigns:u` |
| GET | `/campaigns/:id/metrics` | `campaigns:r` |
| **POST** | **`/campaigns/one-click-capture`** | `campaigns:c` + `one_click` feature flag |
| **GET** | **`/campaigns/one-click-capture/:job_id/stream`** | `campaigns:r` (SSE) |
| GET | `/campaigns/one-click-capture/:job_id` | `campaigns:r` |
| POST | `/campaigns/one-click-capture/:job_id/launch-all` | `campaigns:u` |
| POST | `/campaign-channels/:id/launch` | `campaigns:u` |
| POST | `/ad-creatives` | `campaigns:c` |
| GET | `/utm-builder` | `campaigns:r` |
| POST | `/utm-links` | `campaigns:c` |
| GET | `/go/:short_code` | (public — redirects) |
| POST | `/landing-pages` | `campaigns:c` |
| GET | `/landing-pages/:slug` | (public — serves HTML) |
| POST | `/retargeting-pixels` | `campaigns:c` |
| GET | `/retargeting-pixels/:id/snippet` | `campaigns:r` |
| POST | `/ab-tests` | `campaigns:c` |
| POST | `/webinars` | `campaigns:c` |
| GET | `/webinars/:slug/register` | (public — registration page) |
| POST | `/webinars/:slug/register` | (public — register attendee) |

### THE FLAGSHIP: `POST /campaigns/one-click-capture`

```http
POST /api/v1/campaigns/one-click-capture HTTP/1.1
Authorization: Bearer eyJ...
Idempotency-Key: oneclick-pizzapalace-2026-05-28

{
  "url_or_description": "https://pizzapalace.london",
  "industry_hint": "restaurants",        // optional
  "target_market": "London locals",      // optional
  "channels": ["google_ads","meta","email","social","seo"]  // optional; default = all
}
```

**Response 202:**
```json
{
  "job_id": "ocj_01H...",
  "status": "queued",
  "estimated_duration_seconds": 120,
  "stream_url": "/api/v1/campaigns/one-click-capture/ocj_01H.../stream"
}
```

**SSE Stream:**
```
event: step_started
data: {"step": 1, "name": "Business Analysis"}

event: step_completed
data: {"step": 1, "name": "Business Analysis", "output": {...IndustryProfile...}, "duration_ms": 4200}

event: step_started
data: {"step": 2, "name": "SEO Strategy"}

...

event: completed
data: {
  "campaign_id": "cmp_01H...",
  "total_duration_seconds": 118,
  "total_cost_usd": 0.94,
  "estimated_kpis": {...},
  "launch_recommendation": [...]
}
```

### One-Click 11-Step Pipeline

| # | Step | Calls Service | Duration |
|---|---|---|---|
| 1 | Business Analysis (scrape URL → industry profile) | content-ai (puppeteer + GPT-4o) | ~5s |
| 2 | SEO Strategy (30 keywords + clusters) | seo-engine | ~15s |
| 3 | PPC Campaign Setup (RSA copy + Meta + LinkedIn) | content-ai | ~20s |
| 4 | Content Plan (12 blog drafts + 30 social posts) | content-ai (parallel) | ~30s |
| 5 | Email Sequences (welcome + re-engagement drips) | content-ai → email-hub | ~10s |
| 6 | Social Media Plan (schedule 30 posts) | social-hub | ~5s |
| 7 | CRM Workflow (form + automation + scoring rules) | crm-automation | ~3s |
| 8 | Influencer Shortlist (10 micro-influencers) | influencer-hub | ~8s |
| 9 | Video Content Briefs (3 YouTube + 5 Shorts + 4 images) | media-hub | ~15s |
| 10 | Affiliate Setup Recommendations | affiliate-hub | ~2s |
| 11 | Package Assembly (UTM links, KPI estimates, launch order) | self | ~5s |

**Total budget:** ~120 seconds wall-clock; ~$1-2 in AI cost.

**Idempotency:** Same `idempotency_key` within 5 minutes returns cached job. Re-running same URL within 60 minutes prompts user to confirm (cost protection).

**Resume:** SSE disconnect → frontend re-fetches `/one-click-capture/:job_id` → catches up to last completed step.

---

## 5. Async Events

### Published
| Event | When |
|---|---|
| `campaign.created` | New campaign created |
| `campaign.launched` | Campaign status → active |
| `campaign.paused` | Campaign paused |
| `campaign.completed` | End date reached or goal achieved |
| `campaign.channel.launched` | Individual channel went live |
| `campaign.channel.failed` | Channel launch failed (API error) |
| `oneclick.job.started` | Job started |
| `oneclick.step.completed` | Each step done (consumed by SSE worker) |
| `oneclick.job.completed` | Full 11-step pipeline done |
| `oneclick.job.failed` | Pipeline failed |
| `utm_link.clicked` | Short link clicked (high volume) |
| `landing_page.viewed` | Landing page page view |
| `webinar.registered` | Attendee registered |
| `ab_test.created` | New A/B test |

### Consumed
| Event | From | Action |
|---|---|---|
| `content.ai_generation.completed` | content-ai | Update One-Click step status |
| `analytics.conversion_goal_hit` | analytics-engine | Update campaign metrics |
| `core.workspace.suspended` | marketing-core | Pause all active campaigns |

### Bull Queues
| Queue | Purpose | Concurrency |
|---|---|---|
| `mkt-oneclick-orchestrator` | Coordinates 11-step pipeline | 5 (limit concurrent flagship runs) |
| `mkt-campaign-channel-launch` | Async launch on Google/Meta/LinkedIn/TikTok | 10 |
| `mkt-campaign-metrics-sync` | Pull metrics from ad platforms hourly | 5 |
| `mkt-utm-click-tracker` | High-volume click event recording | 20 |
| `mkt-webinar-reminder` | Send webinar emails | 5 |

---

## 6. Dependencies

### Upstream (calls)
- `content-ai` — all AI generation
- `seo-engine` — keyword research, content briefs
- `crm-automation` — workflow setup, form creation
- `email-hub` — drip sequence setup
- `social-hub` — schedule posts
- `media-hub` — image generation, video briefs
- `influencer-hub` — influencer shortlist
- `analytics-engine` — fetch campaign metrics, A/B test results
- `marketing-core` — feature flag check (`one_click` for Pro+)

### External APIs
| Provider | Use | Rate Limit |
|---|---|---|
| Google Ads API | Search/Shopping/PMax campaigns | 15k ops/day per dev token; queued |
| Meta Marketing API | Facebook + Instagram campaigns | 200 calls/hour/user |
| LinkedIn Marketing API | Sponsored content | 500 calls/day/user |
| TikTok for Business | Campaign management | 100 QPS |

---

## 7. Folder Structure

```
services/campaign-manager/
├── _services/
│   ├── campaign.service.js
│   ├── oneclick-orchestrator.service.js     # THE flagship orchestrator
│   ├── oneclick-step-runner.service.js
│   ├── google-ads.service.js
│   ├── meta-ads.service.js
│   ├── linkedin-ads.service.js
│   ├── tiktok-ads.service.js
│   ├── ad-creative.service.js
│   ├── utm-builder.service.js
│   ├── short-link.service.js
│   ├── landing-page.service.js
│   ├── retargeting-pixel.service.js
│   ├── ab-test.service.js
│   └── webinar.service.js
├── oneclick/                            # One-Click implementation details
│   ├── steps/
│   │   ├── 01-business-analysis.step.js
│   │   ├── 02-seo-strategy.step.js
│   │   ├── 03-ppc-setup.step.js
│   │   ├── 04-content-plan.step.js
│   │   ├── 05-email-sequences.step.js
│   │   ├── 06-social-plan.step.js
│   │   ├── 07-crm-workflow.step.js
│   │   ├── 08-influencer-shortlist.step.js
│   │   ├── 09-video-briefs.step.js
│   │   ├── 10-affiliate-setup.step.js
│   │   └── 11-package-assembly.step.js
│   ├── sse-streamer.js
│   ├── resume-handler.js
│   └── cost-tracker.js
├── (standard folders)
└── app.js
```

---

## 8. Configuration

```bash
# Service Identity
SERVICE_NAME=campaign-manager
NODE_ENV=production
PORT=3103

# Database (dual dialect)
DB_DIALECT=mysql                                  # mysql (dev) | postgres (prod)
DATABASE_URL=mysql://app_write:****@primary:3306/marketing?ssl-mode=REQUIRED
DATABASE_READ_URL=mysql://app_read:****@replica:3306/marketing?ssl-mode=REQUIRED
DB_POOL_MAX=10
DB_POOL_MIN=2

# Redis (queues + cache)
REDIS_URL=rediss://****@redis-cluster:6379/0

# Auth (service-to-service JWT)
JWT_SECRET=****
SERVICE_NAME_FOR_JWT=campaign-manager

# Service URLs (internal)
MARKETING_CORE_URL=http://marketing-core:3100
CONTENT_AI_URL=http://content-ai:3102
SEO_ENGINE_URL=http://seo-engine:3101
EMAIL_HUB_URL=http://email-hub:3106
SOCIAL_HUB_URL=http://social-hub:3105
CRM_AUTOMATION_URL=http://crm-automation:3110
MEDIA_HUB_URL=http://media-hub:3111
INFLUENCER_HUB_URL=http://influencer-hub:3109
ANALYTICS_ENGINE_URL=http://analytics-engine:3104

# Google Ads
GOOGLE_ADS_DEVELOPER_TOKEN=****
GOOGLE_ADS_CLIENT_ID=****
GOOGLE_ADS_CLIENT_SECRET=****
GOOGLE_ADS_LOGIN_CUSTOMER_ID=****                # MCC manager ID

# Meta (Facebook + Instagram) Marketing API
META_APP_ID=****
META_APP_SECRET=****
META_API_VERSION=v20.0

# LinkedIn Marketing API
LINKEDIN_CLIENT_ID=****
LINKEDIN_CLIENT_SECRET=****

# TikTok for Business
TIKTOK_APP_ID=****
TIKTOK_APP_SECRET=****

# One-Click Capture caps (cost protection)
ONECLICK_MAX_COST_USD_PER_RUN=5.00
ONECLICK_MAX_DURATION_SECONDS=180
ONECLICK_IDEMPOTENCY_WINDOW_MINUTES=5

# UTM Short Link
SHORT_LINK_DOMAIN=go.yourplatform.com
SHORT_LINK_LENGTH=8

# Landing Pages
LANDING_PAGE_DOMAIN=pages.yourplatform.com

# Observability
SENTRY_DSN=https://****
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
LOG_LEVEL=info

# Feature Flags
FEATURE_ONECLICK_ENABLED=true
FEATURE_TIKTOK_ADS_ENABLED=false                 # gated until Phase 5
```

| Variable | Local | Staging | Production |
|---|---|---|---|
| `DB_DIALECT` | mysql | mysql | postgres |
| `ONECLICK_MAX_COST_USD_PER_RUN` | 1.00 | 2.00 | 5.00 |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | test token | test | production |
| `LOG_LEVEL` | debug | info | warn |

---

## 9-14. (Deployment, Observability, Security, Testing, Local Dev, Runbooks)

### Key metrics
```
campaign_launches_total{channel, status}                   Counter
mkt_oneclick_runs_total{status}                                Counter
mkt_oneclick_duration_seconds                                  Histogram (p50/95/99 targets: 60s/120s/180s)
mkt_oneclick_step_duration_seconds{step_num, status}          Histogram
mkt_oneclick_cost_usd_total                                    Counter
mkt_utm_clicks_total{utm_source}                              Counter
mkt_ad_spend_usd_total{channel, workspace_tier}               Counter
mkt_ad_roas_gauge{channel}                                     Gauge
```

### Runbooks

**"One-Click Capture stuck"**
1. Check `campaign_oneclick_jobs` table — find job_id with status='running' > 5 min
2. Check `campaign_oneclick_steps` — which step is hung?
3. Check downstream service logs (content-ai usually the bottleneck due to AI provider)
4. Mark job as failed, refund credits to workspace, retry manually
5. Frontend will show user a "We had a hiccup, your credits are back" notice

**"Google Ads campaign failed to launch"**
1. Check `campaign_channels` for failure_reason
2. Common causes: developer token insufficient, MCC not linked, ad policy violation
3. Surface error to user with actionable guidance
4. Retry button in UI; auto-retry not enabled (could spam ads)

**"AI cost spike during One-Click"**
1. Check `campaign_oneclick_jobs.total_cost_usd` distribution
2. Identify outlier — usually a customer with very large competitor sites pulling huge context
3. Apply cost cap; revise prompt to constrain context size
