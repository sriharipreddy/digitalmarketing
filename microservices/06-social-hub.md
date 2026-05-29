# 📱 social-hub (Port 3105)
## Social Scheduling · Listening · Community · Hashtag Research

> **Tier 2 — Important.** Owns all OAuth tokens for social platforms; mass token compromise = catastrophic. Schedules thousands of posts daily.

---

## 1. Service Identity

| Field | Value |
|---|---|
| **Service Name** | `social-hub` |
| **Port** | 3105 |
| **Maturity Tier** | Tier 2 |
| **SLA** | 99.5% uptime |
| **On-Call** | Business hours |
| **Owning Team** | Social Team |

**One-sentence purpose:** Manage social accounts, schedule and publish posts, listen for brand mentions, manage communities, research hashtags.

**Bounded context:** Organic social media. Not paid (that's `campaign-manager`). Owns OAuth tokens for Meta/Twitter/LinkedIn/TikTok/YouTube/Pinterest.

---

## 2. Responsibilities (DO / DON'T)

### ✅ DO
- OAuth flow for each platform (Meta, Twitter/X, LinkedIn, TikTok, YouTube community posts, Pinterest)
- Store OAuth tokens AES-encrypted with per-workspace KEK
- Schedule + publish organic posts
- Multi-platform post composer (cross-post with platform-specific tweaks)
- Real-time social listening (brand mentions, competitor mentions, keyword tracking)
- Sentiment classification (GPT-4o-mini)
- Hashtag research per platform
- Community management for Facebook Groups + Discord
- UGC monitoring (find user posts mentioning brand → request reshare)
- Token refresh (transparent before expiry)
- Account engagement metrics (followers, reach, engagement rate)

### ❌ DON'T
- Run paid social ads → `campaign-manager` (Meta Ads, etc.)
- Generate post content → `content-ai` (we receive scheduled content via event)
- Send messages via DM → out of scope Phase 1 (compliance risk)
- Track customers' end users → `analytics-engine`

---

## 3. Domain Model

### Tables Owned (7)

| Table | Purpose |
|---|---|
| `social_accounts` | OAuth-connected accounts per workspace |
| `social_posts` | Scheduled + published posts |
| `social_metrics` | Follower count, engagement metrics over time |
| `social_listeners` | Saved listening queries |
| `social_mentions` | Brand/competitor/keyword mentions captured |
| `social_hashtag_research` | Cached hashtag data |
| `social_community_posts` | Posts within communities (FB Groups, Discord) |

### Key Schemas

```sql
CREATE TABLE social_accounts (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  platform        ENUM('instagram','facebook','twitter','linkedin','tiktok','youtube','pinterest') NOT NULL,
  account_id      VARCHAR(255),
  account_name    VARCHAR(255),
  username        VARCHAR(255),
  oauth_access_token_encrypted    TEXT,           -- AES-GCM via per-workspace KEK
  oauth_refresh_token_encrypted   TEXT,
  oauth_expires_at DATETIME,
  oauth_scopes    JSON,
  followers       INT,
  following       INT,
  posts_count     INT,
  status          ENUM('connected','expired','revoked','error') DEFAULT 'connected',
  connected_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_synced_at  DATETIME,
  deleted_at      DATETIME NULL,
  UNIQUE KEY uk_workspace_account (workspace_id, platform, account_id),
  INDEX idx_workspace_platform (workspace_id, platform),
  INDEX idx_token_expiry (oauth_expires_at)       -- for refresh worker
) ENGINE=InnoDB;

CREATE TABLE social_posts (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  account_id      CHAR(36)     NOT NULL,
  content_id      CHAR(36),                       -- if from content-ai
  campaign_id     CHAR(36),
  platform        ENUM('instagram','facebook','twitter','linkedin','tiktok','youtube','pinterest'),
  body            TEXT,
  media_urls      JSON,                           -- array of S3 URLs
  hashtags        JSON,
  mentions        JSON,                           -- @handles
  link            VARCHAR(2048),
  scheduled_at    DATETIME,
  published_at    DATETIME,
  status          ENUM('draft','scheduled','publishing','published','failed','deleted') DEFAULT 'draft',
  external_id     VARCHAR(255),                   -- platform's post ID after publish
  external_url    VARCHAR(500),
  engagement      JSON,                           -- {likes, comments, shares, saves, reach}
  failure_reason  TEXT,
  created_by      CHAR(36),
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  INDEX idx_workspace (workspace_id),
  INDEX idx_account (account_id),
  INDEX idx_scheduled (status, scheduled_at)
) ENGINE=InnoDB;

CREATE TABLE social_mentions (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36) NOT NULL,
  listener_id     CHAR(36) NOT NULL,
  platform        VARCHAR(50),
  mention_url     VARCHAR(2048),
  author_username VARCHAR(255),
  author_followers INT,
  body            TEXT,
  sentiment       ENUM('positive','neutral','negative'),
  sentiment_score DECIMAL(4,3),
  language        CHAR(5),
  posted_at       DATETIME,
  detected_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_workspace_detected (workspace_id, detected_at),
  INDEX idx_sentiment (sentiment)
) ENGINE=InnoDB;
```

---

## 4. API Contract

| Method | Path | Permission |
|---|---|---|
| GET | `/accounts` | `social:r` |
| GET | `/accounts/connect/:platform` | `social:c` (initiates OAuth) |
| GET | `/accounts/oauth/callback/:platform` | (public; OAuth callback) |
| DELETE | `/accounts/:id` | `social:d` (disconnects + revokes) |
| GET | `/posts` | `social:r` |
| POST | `/posts` | `social:c` |
| POST | `/posts/bulk` | `social:c` |
| GET | `/posts/:id` | `social:r` |
| PATCH | `/posts/:id` | `social:u` |
| DELETE | `/posts/:id` | `social:d` |
| POST | `/posts/:id/publish` | `social:u` (manual publish now) |
| GET | `/calendar` | `social:r` |
| GET | `/metrics` | `social:r` |
| GET | `/listening` | `social:r` |
| POST | `/listening` | `social:c` |
| GET | `/mentions` | `social:r` |
| GET | `/hashtags/research` | `social:r` |
| POST | `/community/post` | `social:c` |
| POST | `/webhooks/meta` | (Meta signature) |
| POST | `/webhooks/twitter` | (Twitter signature) |

---

## 5. Async Events

### Published
| Event | When |
|---|---|
| `social.account.connected` | OAuth flow complete |
| `social.account.expired` | Token expired (refresh failed) |
| `social.account.disconnected` | User disconnected |
| `social.post.scheduled` | Post added to schedule |
| `social.post.published` | Post live on platform |
| `social.post.failed` | Publish failed |
| `social.mention.detected` | Brand mention found via listener |
| `social.engagement.spike` | Unusual engagement on a post (viral detection) |
| `social.followers.changed` | Significant follower change |

### Consumed
| Event | From | Action |
|---|---|---|
| `content.scheduled` | content-ai | Create scheduled post if channel ∈ social |
| `campaign.launched` | campaign-manager | Schedule campaign's social posts |
| `core.workspace.cancelled` | marketing-core | Revoke all OAuth tokens, pause posts |

### Bull Queues
| Queue | Purpose | Schedule |
|---|---|---|
| `mkt-social-publish` | Find scheduled posts due → publish | Every 1 min |
| `mkt-social-metrics-sync` | Pull engagement metrics for recently-published posts | Every 15 min |
| `mkt-social-followers-sync` | Update follower counts | Daily 06:00 UTC |
| `mkt-oauth-token-refresh` | Refresh expiring OAuth tokens proactively | Every 30 min |
| `mkt-social-listener` | Poll search APIs for mentions | Every 5-15 min |
| `mkt-sentiment-analysis` | Classify mentions via GPT-4o-mini | On-demand |

---

## 6. Dependencies

### External APIs (one of the most complex per service)

| Provider | API | Rate Limit |
|---|---|---|
| **Meta Graph API** | `facebook-nodejs-business-sdk` | 200 calls/hr/user; per-page lower |
| **Twitter API v2** | `twitter-api-v2` | Plan-tier dependent (Basic $200, Pro $5k) |
| **LinkedIn Marketing API** | REST direct | 500/day/user; 25 posts/day/page |
| **TikTok for Business** | REST direct | 100 QPS |
| **YouTube Data API v3** | `googleapis` | 10,000 units/day (managed) |
| **Pinterest API v5** | REST direct | 1000/hr |

### Per-Provider Quirks (see integrations.md)
- Meta: long-lived page tokens; Instagram requires linked Facebook Page; Business verification
- Twitter: Filtered Stream paywalled at $5k/mo Pro tier
- LinkedIn: no official Node SDK; URN-based IDs
- TikTok: 4-8 week app approval delays for publish permissions
- YouTube: quota costs per operation (Insert video = 1600 units)

---

## 7. Folder Structure (standard — see 00-standards.md)

## 8. Configuration

```bash
# Service Identity
SERVICE_NAME=social-hub
NODE_ENV=production
PORT=3105

# Database
DB_DIALECT=mysql
DATABASE_URL=mysql://app_write:****@primary:3306/marketing?ssl-mode=REQUIRED
DATABASE_READ_URL=mysql://app_read:****@replica:3306/marketing?ssl-mode=REQUIRED
DB_POOL_MAX=10
DB_POOL_MIN=2

# Redis
REDIS_URL=rediss://****@redis-cluster:6379/0

# Auth
JWT_SECRET=****
SERVICE_NAME_FOR_JWT=social-hub
MASTER_DEK_HEX=****                               # per-workspace KEK derivation for OAuth tokens

# Meta (Facebook + Instagram)
META_APP_ID=****
META_APP_SECRET=****
META_OAUTH_REDIRECT_URI=https://api.yourplatform.com/api/v1/social/accounts/oauth/callback/meta
META_API_VERSION=v20.0
META_WEBHOOK_VERIFY_TOKEN=****

# Twitter / X (paid tier required for production posting)
TWITTER_CLIENT_ID=****
TWITTER_CLIENT_SECRET=****
TWITTER_CONSUMER_KEY=****
TWITTER_CONSUMER_SECRET=****
TWITTER_API_TIER=basic                            # basic|pro|enterprise
TWITTER_OAUTH_REDIRECT_URI=https://api.yourplatform.com/api/v1/social/accounts/oauth/callback/twitter

# LinkedIn
LINKEDIN_CLIENT_ID=****
LINKEDIN_CLIENT_SECRET=****
LINKEDIN_OAUTH_REDIRECT_URI=https://api.yourplatform.com/api/v1/social/accounts/oauth/callback/linkedin

# TikTok for Business
TIKTOK_CLIENT_KEY=****
TIKTOK_CLIENT_SECRET=****
TIKTOK_OAUTH_REDIRECT_URI=https://api.yourplatform.com/api/v1/social/accounts/oauth/callback/tiktok

# YouTube (for community posts; channel mgmt is media-hub)
YOUTUBE_CLIENT_ID=****
YOUTUBE_CLIENT_SECRET=****

# Pinterest
PINTEREST_APP_ID=****
PINTEREST_APP_SECRET=****

# OAuth token refresh
OAUTH_TOKEN_REFRESH_THRESHOLD_MINUTES=5           # refresh if expires within 5min

# Posting limits
SOCIAL_POST_MAX_MEDIA_FILES=10
SOCIAL_POST_MAX_BODY_CHARS_DEFAULT=3000

# Social listening (Twitter Filtered Stream paywalled)
TWITTER_STREAM_ENABLED=false                      # Pro tier required ($5k/mo)
LISTENING_POLL_INTERVAL_MINUTES=15                # search API fallback

# Sentiment analysis
SENTIMENT_MODEL=gpt-4o-mini
CONTENT_AI_URL=http://content-ai:3102             # delegates sentiment classification

# File Storage (PLUGGABLE — see storage-strategy.md)
# Set STORAGE_DRIVER=s3 (cloud) OR STORAGE_DRIVER=local (on-prem)
# All file vars defined ONCE in packages/shared-config and inherited here.
# Path prefix used by this service: workspace/<id>/social/...
# Service does NOT define its own bucket; uses shared STORAGE_DRIVER + S3_BUCKET / LOCAL_STORAGE_PATH

# Service URLs
MARKETING_CORE_URL=http://marketing-core:3100
CRM_AUTOMATION_URL=http://crm-automation:3110

# Observability
SENTRY_DSN=https://****
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
LOG_LEVEL=info

# Feature Flags
FEATURE_TIKTOK_ENABLED=false                      # await TikTok app approval
FEATURE_PINTEREST_ENABLED=false                   # Phase 5+
FEATURE_SOCIAL_LISTENING_ENABLED=true
```

---

## 9. Deployment & Operations
ECS: 1 vCPU, 2 GB memory. desiredCount: 2 min, 6 max. Bull workers separate task definition.

## 10. Observability — see metrics in Section 5.

## 11. Security
- OAuth tokens AES-GCM encrypted with per-workspace KEK (see security.md)
- Meta webhook signature verified (`X-Hub-Signature-256`)
- Twitter / LinkedIn / TikTok signatures verified per provider
- 2FA required to disconnect a social account (sensitive action)

## 12. Testing
- Mock all platform APIs in unit tests via `nock`
- Integration: full OAuth flow with mock server
- Workspace isolation: user B cannot access workspace A's social accounts

## 13. Local Development
- Meta app must be in "Development" mode with your test users added
- Use ngrok or Cloudflare Tunnel for OAuth callbacks during local dev
- Test posts go to test Facebook page only

## 14. Runbooks — see Section 14 below.

### Critical Metrics
```
social_posts_published_total{platform, status}    Counter
social_publish_latency_seconds{platform}          Histogram
social_oauth_refresh_total{platform, status}      Counter
social_mentions_detected_total{platform, sentiment} Counter
social_external_api_quota_used{platform}          Gauge
```

### Runbooks

**"Mass OAuth token expiration"**
1. Check `mkt-oauth-token-refresh` queue — failing for which platform?
2. Common cause: Meta requires re-auth periodically; LinkedIn 90-day expiry
3. Bulk-email affected workspaces: "Please reconnect your [platform] account"
4. Surface prominent UI banner

**"Twitter API rate limit hit"**
1. Check `social_external_api_quota_used{platform=twitter}`
2. Pause `mkt-social-listener` for Twitter temporarily
3. Notify customers on premium listening: brief degradation
4. Consider upgrading Twitter API plan tier

**"Suspected token compromise"**
1. Mass-revoke all tokens for affected workspace
2. Force OAuth reconnect
3. Audit: which IPs used the tokens? Suspicious geo?
4. SEV-1 if 10+ workspaces affected simultaneously
