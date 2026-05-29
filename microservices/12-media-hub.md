# 📹 media-hub (Port 3111)
## YouTube · Video SEO · Shorts · Podcast · AI Images

> **Tier 2 — Important.** Memory-heavy operations (video processing, image generation). External API rate limits constrain throughput.

---

## 1. Service Identity

| Field | Value |
|---|---|
| **Service Name** | `media-hub` |
| **Port** | 3111 |
| **Maturity Tier** | Tier 2 |
| **SLA** | 99.5% uptime |
| **On-Call** | Business hours |
| **Owning Team** | Media Team |

**One-sentence purpose:** Manage YouTube channels, audit + optimise video SEO, schedule Shorts/Reels/TikTok, run podcast workflows, generate AI images (DALL-E orchestration).

---

## 2. Responsibilities (DO / DON'T)

### ✅ DO
- YouTube channel connection (OAuth) + dashboard
- Video SEO auditor (title, description, tags, thumbnail scoring)
- AI title + description optimiser (calls content-ai)
- Thumbnail analyser (CTR-prediction via AI)
- Shorts / Reels / TikTok cross-posting scheduler
- Whisper AI video transcription (subtitles + transcript)
- Video → blog post repurposing (calls content-ai)
- Podcast manager (episodes, show notes, transcripts, RSS distribution)
- AI image generation (DALL-E 3 + Stability AI fallback)
- HTML5 banner ad creator (IAB standard sizes)
- Best-time-to-post analysis from YouTube audience data
- YouTube community post scheduling

### ❌ DON'T
- Generate video script text → `content-ai` provides scripts; we orchestrate
- Run YouTube paid ads (TrueView) → `campaign-manager`
- Track YouTube view analytics for ROI → `analytics-engine`
- Edit videos (cuts, transitions) → out of scope; users use Premiere/DaVinci

---

## 3. Domain Model

### Tables Owned (8)

| Table | Purpose |
|---|---|
| `media_youtube_channels` | Connected YouTube channels (OAuth tokens) |
| `media_videos` | Per-channel videos + analytics |
| `media_video_seo_audits` | Per-video SEO scoring |
| `media_video_scripts` | AI-generated scripts |
| `media_shorts` | Short-form video schedule + analytics |
| `media_podcasts` | Podcast episodes + transcripts |
| `media_image_generations` | DALL-E job records + S3 URLs |
| `media_creative_briefs` | Briefs for ad creative + video |

### Key Schemas

```sql
CREATE TABLE media_youtube_channels (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  channel_id      VARCHAR(50) NOT NULL,
  channel_name    VARCHAR(255),
  subscribers     INT,
  total_views     BIGINT,
  video_count     INT,
  oauth_access_token_encrypted TEXT,
  oauth_refresh_token_encrypted TEXT,
  oauth_expires_at DATETIME,
  status          ENUM('connected','expired','revoked') DEFAULT 'connected',
  last_synced_at  DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  UNIQUE KEY uk_workspace_channel (workspace_id, channel_id)
) ENGINE=InnoDB;

CREATE TABLE media_videos (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36) NOT NULL,
  channel_id      CHAR(36) NOT NULL,
  youtube_id      VARCHAR(50) UNIQUE,
  title           VARCHAR(255),
  description     TEXT,
  tags            JSON,
  thumbnail_url   VARCHAR(500),
  duration_seconds INT,
  published_at    DATETIME,
  views           BIGINT,
  likes           INT,
  comments        INT,
  watch_time_minutes BIGINT,
  avg_view_duration_pct DECIMAL(5,2),
  ctr_impressions DECIMAL(5,2),
  last_synced_at  DATETIME,
  INDEX idx_channel_published (channel_id, published_at)
) ENGINE=InnoDB;

CREATE TABLE media_shorts (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36) NOT NULL,
  source_video_url VARCHAR(500),                    -- uploaded original
  s3_url          VARCHAR(500),
  caption         TEXT,
  hashtags        JSON,
  platforms       JSON,                              -- ['youtube_shorts','instagram_reels','tiktok']
  scheduled_at    DATETIME,
  published_at    DATETIME,
  status          ENUM('draft','transcribing','ready','scheduled','publishing','published','failed') DEFAULT 'draft',
  transcript      TEXT,
  external_post_ids JSON,                            -- {tiktok: '...', instagram: '...'}
  views           JSON,                              -- per platform
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  INDEX idx_workspace (workspace_id),
  INDEX idx_scheduled (status, scheduled_at)
) ENGINE=InnoDB;

CREATE TABLE media_image_generations (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36) NOT NULL,
  prompt          TEXT NOT NULL,
  provider        ENUM('openai_dalle','stability_ai') NOT NULL,
  model           VARCHAR(50),
  size            VARCHAR(20),                       -- '1024x1024'
  quality         ENUM('standard','hd'),
  style           ENUM('vivid','natural'),
  image_urls      JSON,                              -- S3 URLs (multiple if variants)
  cost_usd        DECIMAL(8,4),
  status          ENUM('queued','generating','completed','failed') DEFAULT 'queued',
  failure_reason  TEXT,
  generated_at    DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB;
```

---

## 4. API Contract

| Method | Path | Permission |
|---|---|---|
| GET | `/youtube/channels` | `media:r` |
| GET | `/youtube/connect` | `media:c` (OAuth initiate) |
| GET | `/youtube/oauth/callback` | (public OAuth callback) |
| GET | `/videos` | `media:r` |
| GET | `/videos/:id` | `media:r` |
| POST | `/videos/:id/audit` | `media:u` |
| POST | `/videos/:id/optimise` | `media:u` (AI title/description) |
| POST | `/videos/:id/transcribe` | `media:u` |
| POST | `/scripts/generate` | `media:c` |
| GET | `/shorts` | `media:r` |
| POST | `/shorts` | `media:c` (upload + schedule) |
| POST | `/shorts/:id/transcribe` | `media:u` |
| GET | `/podcasts/episodes` | `media:r` |
| POST | `/podcasts/episodes` | `media:c` |
| POST | `/podcasts/episodes/:id/transcribe` | `media:u` |
| GET | `/images` | `media:r` |
| POST | `/images/generate` | `media:c` |
| POST | `/images/upload` | `media:c` |
| GET | `/internal/image/generate` | (service JWT — called by campaign-manager) |

---

## 5. Async Events

### Published
| Event | When |
|---|---|
| `media.youtube.channel_connected` | OAuth complete |
| `media.video.audit_completed` | SEO audit done |
| `media.video.transcribed` | Whisper transcription complete |
| `media.shorts.published` | Short published to all platforms |
| `media.shorts.failed` | Publishing failed |
| `media.image.generated` | DALL-E generation complete |
| `media.image.failed` | Generation failed |
| `media.podcast.episode_published` | Episode RSS-distributed |

### Consumed
| Event | From | Action |
|---|---|---|
| `content.scheduled` (channel=video) | content-ai | Schedule shorts |
| `campaign.launched` | campaign-manager | Generate associated images |

### Bull Queues
| Queue | Purpose | Schedule | Concurrency |
|---|---|---|---|
| `mkt-youtube-sync` | Pull channel + video data | Daily | 3 (YouTube quota) |
| `mkt-video-transcription` | Whisper AI transcribe | On-demand | 5 (memory-heavy) |
| `mkt-shorts-publish` | Cross-post to YT Shorts + IG Reels + TikTok | Every 1 min | 5 |
| `mkt-image-generation` | DALL-E job execution | On-demand | 2 (rate limit: 50/min) |
| `mkt-podcast-rss-update` | Re-generate RSS feed | On-demand | 1 |
| `mkt-video-seo-audit` | Score videos | On-demand | 5 |

---

## 6. Dependencies

### External APIs
| Provider | Use | Cost Constraint |
|---|---|---|
| **YouTube Data API v3** | Channel mgmt, video metadata, community posts | 10,000 units/day default (need quota increase) |
| **OpenAI Whisper** | Audio/video transcription | $0.006/min |
| **OpenAI DALL-E 3** | Image generation | $0.04-0.08/image |
| **Stability AI** | DALL-E fallback | varies |
| **ffmpeg** | Video metadata extraction (no re-encoding) | local binary |

### YouTube Quota Management
Per-operation cost (10,000/day total):
- List videos: 1 unit
- Upload video: 1,600 units (max 6 uploads/day at default quota)
- Update video: 50 units
- Get analytics: 1 unit

**Quota multiplier**: request 1,000,000 units/day via Google Cloud quota increase request (4-6 week approval).

---

## 7. Folder Structure (standard)

## 8. Configuration

```bash
SERVICE_NAME=media-hub
NODE_ENV=production
PORT=3111

# Database
DB_DIALECT=mysql
DATABASE_URL=mysql://app_write:****@primary:3306/marketing?ssl-mode=REQUIRED
DB_POOL_MAX=8
DB_POOL_MIN=2

# Redis
REDIS_URL=rediss://****@redis-cluster:6379/0

# Auth
JWT_SECRET=****
MASTER_DEK_HEX=****                                # for YouTube OAuth token encryption

# YouTube Data API v3
YOUTUBE_API_KEY=****                              # server key (some operations don't need OAuth)
YOUTUBE_CLIENT_ID=****
YOUTUBE_CLIENT_SECRET=****
YOUTUBE_OAUTH_REDIRECT_URI=https://api.yourplatform.com/api/v1/media/youtube/oauth/callback
YOUTUBE_DAILY_QUOTA_UNITS=10000                    # default; request increase from Google

# OpenAI (Whisper transcription + DALL-E images)
OPENAI_API_KEY=sk-****
WHISPER_MODEL=whisper-1
DALLE_MODEL=dall-e-3
DALLE_DEFAULT_SIZE=1024x1024
DALLE_DEFAULT_QUALITY=standard                    # standard | hd
DALLE_MAX_VARIANTS=4

# Stability AI (DALL-E fallback)
STABILITY_AI_API_KEY=
STABILITY_AI_ENABLED=false

# Image upload limits
IMAGE_MAX_UPLOAD_MB=10
IMAGE_GENERATION_HOURLY_WORKSPACE_LIMIT=50

# Video processing
FFMPEG_PATH=/usr/bin/ffmpeg
VIDEO_MAX_UPLOAD_MB=500
VIDEO_TRANSCRIPTION_MAX_MINUTES=60                # Whisper expense protection

# File Storage (PLUGGABLE — see storage-strategy.md)
# Set STORAGE_DRIVER=s3 (cloud) OR STORAGE_DRIVER=local (on-prem)
# All file vars defined ONCE in packages/shared-config and inherited here.
# Path prefixes used by this service:
#   workspace/<id>/media/videos/...
#   workspace/<id>/media/images/...
#   workspace/<id>/media/podcasts/...
# Service does NOT define its own bucket; uses shared STORAGE_DRIVER + S3_BUCKET / LOCAL_STORAGE_PATH

# Service URLs
MARKETING_CORE_URL=http://marketing-core:3100
CONTENT_AI_URL=http://content-ai:3102              # for AI script generation
SOCIAL_HUB_URL=http://social-hub:3105              # for shorts publishing

# Observability
SENTRY_DSN=https://****
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
LOG_LEVEL=info

# Feature Flags
FEATURE_PODCAST_MANAGER_ENABLED=false              # Phase 5
FEATURE_VIDEO_TRANSCRIPTION_ENABLED=true
FEATURE_IMAGE_GENERATION_ENABLED=true
FEATURE_HTML5_BANNER_BUILDER_ENABLED=false         # Phase 5
```

---

## 9-14. (Deployment, Observability, Security, Testing, Local Dev, Runbooks)

### Metrics
```
mkt_video_audits_total                              Counter
mkt_video_transcriptions_total{status}              Counter
mkt_video_transcription_duration_seconds            Histogram
mkt_shorts_published_total{platform, status}        Counter
mkt_image_generations_total{provider, status}       Counter
mkt_image_generation_cost_usd_total                 Counter
mkt_youtube_quota_used_today                        Gauge (alert at 80%)
```

### Runbooks

**"YouTube quota exhausted"**
1. Check `mkt_youtube_quota_used_today` Grafana
2. Pause `mkt-youtube-sync` for the day
3. Surface customer notice: "YouTube data syncing delayed; back tomorrow"
4. If recurring: submit Google quota increase request

**"DALL-E rate limited"**
1. Bull queue throttle holds; users see "Image queued" message
2. Falls back to Stability AI if configured
3. If both fail: queue + retry; notify user via email when ready

**"Video transcription queue backed up"**
1. Whisper is single-purpose; 5 concurrent max
2. Add temp workers; communicate ETA to users
3. Long-term: consider Whisper-large vs Whisper-medium tradeoff
