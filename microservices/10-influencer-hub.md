# 🌟 influencer-hub (Port 3109)
## Influencer Discovery · CRM · Briefs · Contracts · ROI

> **Tier 3 — Best-effort.** Read-mostly; relies on public social data + optional paid APIs.

---

## 1. Service Identity

| Field | Value |
|---|---|
| **Service Name** | `influencer-hub` |
| **Port** | 3109 |
| **Maturity Tier** | Tier 3 |
| **SLA** | Best effort |
| **On-Call** | Next business day |
| **Owning Team** | Growth Team |

**One-sentence purpose:** Discover relevant influencers, manage outreach + contracts + payments, track campaign ROI from each influencer's posts.

---

## 2. Responsibilities (DO / DON'T)

### ✅ DO
- AI-powered influencer discovery (search by niche, followers, engagement, location, platform)
- Fake-follower detection (engagement anomaly scoring)
- Influencer CRM (contact + relationship history + notes + past collaborations)
- Campaign brief generation (AI-drafted with do's / don'ts / hashtags)
- Personalised outreach (AI-generated DM/email per influencer's content style)
- Digital contract generation + e-signature workflow
- Content approval workflow (influencer submits draft → brand approves → publish)
- Performance tracking (UTM links + post URLs → reach/engagement/conversions)
- EMV (Earned Media Value) calculation
- ROI report per influencer
- Influencer payments (manual: outside Stripe; or via Stripe one-off)

### ❌ DON'T
- Run affiliate programs (different model) → `affiliate-hub`
- Send the outreach emails themselves → `email-hub`
- Generate the briefs end-to-end → `content-ai` does AI, we orchestrate

---

## 3. Domain Model

### Tables Owned (6)

| Table | Purpose |
|---|---|
| `influencer_profiles` | Discovered + tracked influencers (workspace-scoped CRM) |
| `influencer_campaigns` | Campaign-level wrapper (often linked to `campaign_campaigns`) |
| `influencer_contracts` | Per-influencer contract within a campaign |
| `influencer_posts` | Tracked posts from contracted influencers |
| `influencer_outreach` | Outreach messages sent |
| `influencer_payments` | Payment records (separate from Stripe Connect — these are direct payments) |

### Key Schema

```sql
CREATE TABLE influencer_profiles (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  platform        ENUM('instagram','youtube','tiktok','twitter','linkedin') NOT NULL,
  username        VARCHAR(255) NOT NULL,
  full_name       VARCHAR(255),
  email           VARCHAR(255),
  bio             TEXT,
  followers       INT,
  following       INT,
  avg_engagement_rate DECIMAL(6,4),               -- 0.0432 = 4.32%
  tier            ENUM('nano','micro','macro','mega'),  -- <10k/10-100k/100k-1M/1M+
  niche           JSON,                            -- ['food','restaurants','london']
  language        CHAR(5),
  country         CHAR(2),
  audience_authenticity_score TINYINT,             -- 0-100; lower = more suspicious
  contact_status  ENUM('discovered','contacted','negotiating','partnered','rejected','archived') DEFAULT 'discovered',
  notes           TEXT,
  external_profile_url VARCHAR(500),
  last_synced_at  DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  UNIQUE KEY uk_workspace_platform_username (workspace_id, platform, username),
  INDEX idx_workspace_tier (workspace_id, tier),
  INDEX idx_engagement (avg_engagement_rate)
) ENGINE=InnoDB;

CREATE TABLE influencer_contracts (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36) NOT NULL,
  campaign_id     CHAR(36) NOT NULL,
  influencer_id   CHAR(36) NOT NULL,
  fee_amount_gbp  DECIMAL(12,2),
  deliverables    JSON,                            -- [{type:'post',count:3,platform:'instagram'}]
  content_approval_required TINYINT(1) DEFAULT 1,
  ftc_disclosure_required TINYINT(1) DEFAULT 1,
  contract_url    VARCHAR(2048),                   -- S3 PDF
  signed_at       DATETIME,
  status          ENUM('draft','sent','signed','active','completed','cancelled') DEFAULT 'draft',
  start_date      DATE,
  end_date        DATE,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  INDEX idx_campaign (campaign_id),
  INDEX idx_influencer (influencer_id)
) ENGINE=InnoDB;

CREATE TABLE influencer_posts (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  contract_id     CHAR(36) NOT NULL,
  influencer_id   CHAR(36) NOT NULL,
  workspace_id    CHAR(36) NOT NULL,
  platform        VARCHAR(50),
  post_url        VARCHAR(500),
  posted_at       DATETIME,
  views           INT,
  likes           INT,
  comments        INT,
  shares          INT,
  saves           INT,
  reach           INT,
  impressions     INT,
  clicks          INT,                             -- via UTM link
  conversions     INT,
  revenue_attributed DECIMAL(12,2),
  emv_gbp         DECIMAL(12,2),                  -- Earned Media Value estimate
  last_synced_at  DATETIME,
  INDEX idx_contract (contract_id),
  INDEX idx_influencer_time (influencer_id, posted_at)
) ENGINE=InnoDB;
```

---

## 4. API Contract

| Method | Path | Permission |
|---|---|---|
| GET | `/influencers/discover` | `influencers:r` (search) |
| GET | `/influencers` | `influencers:r` |
| POST | `/influencers` | `influencers:c` |
| GET | `/influencers/:id` | `influencers:r` |
| PATCH | `/influencers/:id` | `influencers:u` |
| POST | `/influencers/:id/audit-followers` | `influencers:u` (fake-detection) |
| POST | `/campaigns/influencer` | `influencers:c` |
| GET | `/contracts` | `influencers:r` |
| POST | `/contracts` | `influencers:c` |
| POST | `/contracts/:id/send` | `influencers:u` |
| POST | `/contracts/:id/sign` | (influencer auth via magic link) |
| GET | `/outreach` | `influencers:r` |
| POST | `/outreach/send` | `influencers:c` (delegates to email-hub) |
| GET | `/posts/:contract_id` | `influencers:r` |
| GET | `/performance/:campaign_id` | `influencers:r` |

---

## 5. Async Events

### Published
| Event | When |
|---|---|
| `influencer.discovered` | New influencer added to workspace |
| `influencer.outreach.sent` | Outreach message sent |
| `influencer.contract.signed` | Contract signed |
| `influencer.post.detected` | Tracked post published |
| `influencer.fake_followers.flagged` | Audit detected fake-follower pattern |

### Consumed
| Event | From | Action |
|---|---|---|
| `email.opened`, `email.clicked` | email-hub | Track outreach engagement |
| `social.post.published` | social-hub | Detect if from contracted influencer |
| `analytics.conversion_goal_hit` | analytics-engine | Attribute conversion to influencer UTM |

### Bull Queues
| Queue | Purpose | Schedule |
|---|---|---|
| `mkt-influencer-discover` | Scrape public profiles per search | On-demand |
| `mkt-influencer-fake-check` | Run audience authenticity analysis | On-demand |
| `mkt-influencer-post-sync` | Pull post metrics from public APIs | Daily |
| `mkt-influencer-emv-calc` | Compute EMV monthly | Monthly |

---

## 6. Dependencies

### External APIs
- **Instagram public profile** (rate-limited; rely on public web data)
- **TikTok public** (rate-limited)
- **YouTube Data API** (existing — via media-hub or direct)
- **HypeAuditor / Modash** — optional paid for richer data ($100s/mo)

---

## 7. Folder Structure (standard)

## 8. Configuration

```bash
SERVICE_NAME=influencer-hub
NODE_ENV=production
PORT=3109

# Database
DB_DIALECT=mysql
DATABASE_URL=mysql://app_write:****@primary:3306/marketing?ssl-mode=REQUIRED
DB_POOL_MAX=8
DB_POOL_MIN=2

# Redis
REDIS_URL=rediss://****@redis-cluster:6379/0

# Auth
JWT_SECRET=****
INFLUENCER_MAGIC_LINK_SECRET=****                 # contract e-sign auth

# Public APIs for discovery (rate-limited public scraping)
INSTAGRAM_PUBLIC_API_USER_AGENT=YourPlatform/1.0
TIKTOK_PUBLIC_API_USER_AGENT=YourPlatform/1.0

# Optional paid services
HYPEAUDITOR_API_KEY=                              # optional
MODASH_API_KEY=                                   # optional
INFLUENCER_PAID_API_ENABLED=false

# Contract generation
CONTRACT_TEMPLATE_DIR=/app/templates/contracts
ESIGN_PROVIDER=internal                           # internal | docusign | hellosign
DOCUSIGN_INTEGRATION_KEY=                         # if used

# Fake follower detection
FAKE_FOLLOWER_THRESHOLD=30                        # audience authenticity < 30 = flag

# Service URLs
MARKETING_CORE_URL=http://marketing-core:3100
EMAIL_HUB_URL=http://email-hub:3106
CONTENT_AI_URL=http://content-ai:3102

# Observability
SENTRY_DSN=https://****
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
LOG_LEVEL=info
```

---

## 9-14. (Deployment, Observability, Security, Testing, Local Dev, Runbooks)

### Runbook: "Discovery turning up few results"
- Public APIs rate-limited; widen niche; consider paid (HypeAuditor) subscription
- Cache aggressively (7-day TTL on profile data)
