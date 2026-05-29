# ✍️ content-ai (Port 3102)
## AI Content Generation · Brand Voice · Press Releases · Translations

> **Tier 1 — Critical for flagship.** Every AI-generated word in the platform flows through this service. Owns provider abstraction, cost tracking, prompt safety.

---

## 1. Service Identity

| Field | Value |
|---|---|
| **Service Name** | `content-ai` |
| **Port** | 3102 |
| **Maturity Tier** | Tier 1 |
| **SLA** | 99.9% uptime (degrades gracefully if all AI providers down) |
| **On-Call** | 24/7 |
| **Owning Team** | AI/ML Team + Content Team |

**One-sentence purpose:** Generate, validate, and store all AI content across the platform — blog posts, social captions, ad copy, email bodies, press releases, translations.

**Bounded context:** Anything that involves calling an LLM, anything involving brand voice, all generated content storage, content scoring, plagiarism, multi-language translations, image asset library.

---

## 2. Responsibilities (DO / DON'T)

### ✅ DO
- AI text generation (blog/landing/social/email/ad copy/press release/lead magnet)
- AI image generation orchestration (delegated to `media-hub` for execution)
- Brand voice training (extract style attributes from samples)
- SEO content scoring (Flesch-Kincaid, keyword density, heading structure)
- Plagiarism checking (Copyleaks or similar)
- Multi-language translation
- Content calendar storage + scheduling
- Press release drafting + distribution coordination (via `mkt-pr-distribution`)
- AI provider abstraction (route per task to OpenAI/Claude/Gemini)
- Per-workspace AI cost tracking + cap enforcement
- Output validation (block hallucinations, refusals, prompt-injection leakage)

### ❌ DON'T
- Send the content anywhere → publish events; `social-hub`/`email-hub`/`campaign-manager` consume
- Generate ad creatives end-to-end → `campaign-manager` calls us for copy; we provide briefs only
- Run image generation directly → `media-hub` owns the DALL-E queue (we initiate via event)
- Track delivery analytics → `analytics-engine`
- Schedule cron-based AI runs unrelated to content → respective domain services

---

## 3. Domain Model

### Tables Owned (9)

| Table | Purpose |
|---|---|
| `content_brand_voices` | Per-workspace brand voice profile (sample texts + extracted attributes) |
| `content_pieces` | Generated content (blog, social, email, ad copy, etc.) |
| `content_schedule` | When + where content publishes |
| `content_versions` | Edit history per content piece |
| `content_plagiarism_checks` | Per-content uniqueness score + matches |
| `content_translations` | Multi-language versions |
| `content_image_assets` | Workspace image library (uploaded + AI-generated; binary in S3) |
| `content_press_releases` | Press release records + distribution status |
| `content_lead_magnets` | Ebook/checklist/template downloads |

### Key Schemas

```sql
CREATE TABLE content_brand_voices (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  sample_texts    JSON,                              -- array of 3-10 sample text passages
  extracted_attributes JSON,                          -- {tone, sentence_length_avg, vocab_richness, formality, pov}
  system_preamble TEXT,                              -- generated system prompt addition
  is_default      TINYINT(1) DEFAULT 0,
  trained_at      DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB;

CREATE TABLE content_pieces (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  campaign_id     CHAR(36),                          -- if part of a campaign
  brand_voice_id  CHAR(36),
  title           VARCHAR(500),
  body            LONGTEXT,
  content_type    ENUM('blog_post','landing_page','social_post','email_body','ad_copy','press_release','product_description','video_script','lead_magnet'),
  status          ENUM('draft','review','approved','scheduled','published','archived') DEFAULT 'draft',
  seo_score       TINYINT,                           -- 0-100
  readability_score TINYINT,                          -- Flesch-Kincaid normalised
  word_count      INT,
  target_keyword  VARCHAR(255),
  language_code   CHAR(5) DEFAULT 'en',
  ai_generated    TINYINT(1) DEFAULT 0,
  ai_provider     ENUM('openai','claude','gemini'),
  ai_model        VARCHAR(50),
  prompt_version  VARCHAR(20),
  validation_passed TINYINT(1) DEFAULT 1,
  validation_errors JSON,
  parent_content_id CHAR(36),                        -- if translated/repurposed from another
  created_by      CHAR(36),
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  INDEX idx_workspace_type (workspace_id, content_type),
  INDEX idx_status (status),
  INDEX idx_campaign (campaign_id)
) ENGINE=InnoDB;

CREATE TABLE content_schedule (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  content_id      CHAR(36)     NOT NULL,
  channel         ENUM('blog','email','social','linkedin','twitter','instagram','facebook','tiktok'),
  scheduled_at    DATETIME     NOT NULL,
  published_at    DATETIME,
  status          ENUM('scheduled','publishing','published','failed','cancelled') DEFAULT 'scheduled',
  external_id     VARCHAR(255),                      -- ID in destination system
  failure_reason  TEXT,
  INDEX idx_scheduled (status, scheduled_at),
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB;
```

---

## 4. API Contract

| Method | Path | Permission |
|---|---|---|
| POST | `/generate/blog` | `content:c` |
| POST | `/generate/landing-page` | `content:c` |
| POST | `/generate/social` | `content:c` |
| POST | `/generate/email` | `content:c` |
| POST | `/generate/ad-copy` | `content:c` |
| POST | `/generate/press-release` | `content:c` |
| POST | `/generate/video-script` | `content:c` |
| POST | `/generate/lead-magnet` | `content:c` |
| GET | `/content` | `content:r` |
| GET | `/content/:id` | `content:r` |
| PATCH | `/content/:id` | `content:u` |
| POST | `/content/:id/publish` | `content:u` |
| POST | `/content/:id/translate` | `content:c` |
| POST | `/content/:id/plagiarism-check` | `content:r` |
| POST | `/content/:id/repurpose` | `content:c` |
| GET | `/content/calendar` | `content:r` |
| POST | `/content/schedule` | `content:c` |
| GET | `/brand-voices` | `content:r` |
| POST | `/brand-voices` | `content:c` |
| POST | `/brand-voices/:id/train` | `content:u` |
| GET | `/images` | `content:r` |
| POST | `/images/generate` | `content:c` |
| POST | `/images/upload` | `content:c` |
| POST | `/press-releases/:id/distribute` | `content:u` |
| POST | `/internal/generate` | (service JWT) |

### Sample: `POST /generate/blog`

```http
POST /api/v1/content/generate/blog HTTP/1.1
Authorization: Bearer eyJ...
Idempotency-Key: blog-pizzapalace-pizza-london-2026-05-28

{
  "target_keyword": "best pizza london",
  "word_count_target": 1500,
  "brand_voice_id": "bv_01H...",
  "campaign_id": "cmp_01H...",     // optional — link to campaign
  "include_internal_links": true,
  "language_code": "en",
  "tone_override": null,            // null = use brand voice
  "outline_only": false             // true = return outline; false = full draft
}
```

**Response 202 (async — long-running):**
```json
{
  "id": "ct_01H...",
  "status": "generating",
  "estimated_seconds": 25,
  "stream_url": "/api/v1/content/generate/ct_01H.../stream",   // SSE for live updates
  "credits_used": 50
}
```

**Streaming response (SSE):**
```
event: token
data: {"text": "# The Ultimate Guide", "tokens": 5}

event: token
data: {"text": " to Finding the Best Pizza in London", "tokens": 8}

...

event: complete
data: {
  "id": "ct_01H...",
  "title": "The Ultimate Guide to Finding the Best Pizza in London",
  "body": "...full markdown content...",
  "seo_score": 87,
  "readability_score": 72,
  "word_count": 1487,
  "validation_passed": true,
  "credits_used": 52,
  "cost_usd": 0.0316
}
```

---

## 5. Async Events

### Published
| Event | When |
|---|---|
| `content.created` | New content piece created |
| `content.ai_generation.started` | AI generation initiated |
| `content.ai_generation.completed` | AI generation finished |
| `content.ai_generation.failed` | AI failed (provider down, validation failed, cost cap) |
| `content.published` | Content marked published |
| `content.scheduled` | Content added to publish schedule |
| `content.translated` | Translation completed |
| `content.brand_voice.trained` | Brand voice training complete |
| `content.plagiarism.detected` | High similarity found |
| `content.ai.cost_cap_hit` | Workspace exceeded AI credit limit |

### Consumed
| Event | From | Action |
|---|---|---|
| `core.workspace.cancelled` | marketing-core | Pause all generation for workspace |
| `core.workspace.upgraded` | marketing-core | Increase AI credit limit cache |

### Bull Queues
| Queue | Purpose | Schedule |
|---|---|---|
| `mkt-content-publisher` | Pick scheduled content, route to social/email | Every 5 min |
| `mkt-pr-distribution` | Distribute press releases to PR Newswire | On-demand |
| `mkt-content-translate` | Batch translate content | On-demand |
| `mkt-plagiarism-check` | Run plagiarism scans | On-demand |
| `mkt-brand-voice-train` | Train brand voice from samples | On-demand |

---

## 6. Dependencies

### Upstream
- `marketing-core` — workspace plan + AI credit limit
- `intelligence` — for AI cost aggregation (publishes events here)

### Downstream (callers)
- `campaign-manager` — One-Click Capture orchestrates many `/generate/*` calls
- `seo-engine` — calls `/generate/blog` for content brief execution + meta tag optimization
- `media-hub` — calls for video script generation
- Frontend (direct) — content composer UI

### External APIs
| Provider | Use | Routing |
|---|---|---|
| **OpenAI** | GPT-4o, GPT-4o-mini, Whisper, DALL-E (via media-hub) | Primary for long-form + JSON output |
| **Anthropic** | Claude 3.5 Sonnet, Haiku | Primary for ad copy + persuasive |
| **Google Gemini** | Gemini 1.5 Pro, Flash | Primary for large-context analysis |
| **PR Newswire** | Press release distribution | Async via Bull |
| **Copyleaks** | Plagiarism detection | Per-content check |
| **Google Translate** | Fallback for translations | If AI translation rejected by validation |

### Redis Keys
| Key | TTL |
|---|---|
| `mkt:ai:credits:<workspace_id>` | 5 min |
| `mkt:ai:spend_1h:<workspace_id>` | 1 hour |
| `mkt:ai:provider_circuit:<provider>` | 60 sec |
| `mkt:ai:prompt_version:<task>` | 1 hour |

---

## 7. Folder Structure

```
services/content-ai/
├── _services/
│   ├── ai-provider.service.js          # MAIN: routing, failover, cost tracking
│   ├── providers/
│   │   ├── openai.provider.js
│   │   ├── claude.provider.js
│   │   ├── gemini.provider.js
│   │   └── mock.provider.js            # used in tests
│   ├── prompts/
│   │   ├── seo-blog-post.v3.js
│   │   ├── ad-copy-google.v2.js
│   │   ├── social-caption.v1.js
│   │   ├── email-body.v1.js
│   │   ├── press-release.v1.js
│   │   └── ...
│   ├── validators/
│   │   ├── output-validator.service.js
│   │   ├── prompt-safety.service.js
│   │   └── hallucination-detector.service.js
│   ├── content.service.js
│   ├── brand-voice.service.js
│   ├── seo-scorer.service.js
│   ├── readability.service.js
│   ├── plagiarism.service.js
│   ├── translation.service.js
│   ├── press-release.service.js
│   ├── content-scheduler.service.js
│   └── cost-tracker.service.js
├── (standard folders)
└── app.js
```

See `ai-platform.md` for the full AI provider abstraction details.

---

## 8. Configuration

```bash
# Service Identity
SERVICE_NAME=content-ai
NODE_ENV=production
PORT=3102

# Database (dual dialect)
DB_DIALECT=mysql
DATABASE_URL=mysql://app_write:****@primary:3306/marketing?ssl-mode=REQUIRED
DATABASE_READ_URL=mysql://app_read:****@replica:3306/marketing?ssl-mode=REQUIRED
DB_POOL_MAX=10
DB_POOL_MIN=2

# Redis
REDIS_URL=rediss://****@redis-cluster:6379/0

# Auth
JWT_SECRET=****
SERVICE_NAME_FOR_JWT=content-ai

# AI Providers
OPENAI_API_KEY=sk-****
OPENAI_ORG_ID=org-****
ANTHROPIC_API_KEY=sk-ant-****
GOOGLE_GEMINI_API_KEY=****
STABILITY_AI_API_KEY=                              # optional fallback
DEFAULT_AI_PROVIDER=openai

# Cost controls (see ai-platform.md)
AI_DAILY_BUDGET_USD=500                            # platform-wide kill switch
AI_WORKSPACE_HOURLY_CAP_USD=50                     # spike protection per workspace
AI_REQUEST_TIMEOUT_MS=60000
AI_MAX_RETRIES=2

# Prompt versioning + safety
PROMPT_VERSION_ROLLOUT_JSON='{"seo_blog_post":{"v3":0.9,"v4":0.1}}'
OUTPUT_VALIDATION_STRICT=true                      # reject invalid outputs

# PR Newswire (press release distribution)
PR_NEWSWIRE_API_KEY=****
PR_NEWSWIRE_API_URL=https://api.prnewswire.com
PR_NEWSWIRE_TEST_MODE=true                         # always test in non-prod

# Copyleaks (plagiarism detection)
COPYLEAKS_API_KEY=****
COPYLEAKS_EMAIL=****                               # account email

# Content limits
CONTENT_MAX_WORD_COUNT=10000
CONTENT_MIN_WORD_COUNT=100
BRAND_VOICE_MAX_SAMPLE_LENGTH_CHARS=5000

# File Storage (PLUGGABLE — see storage-strategy.md)
# Set STORAGE_DRIVER=s3 (cloud) OR STORAGE_DRIVER=local (on-prem)
# All file vars defined ONCE in packages/shared-config and inherited here.
# Path prefix used by this service: workspace/<id>/content/...
# Service does NOT define its own bucket; uses shared STORAGE_DRIVER + S3_BUCKET / LOCAL_STORAGE_PATH

# Service URLs
MARKETING_CORE_URL=http://marketing-core:3100
INTELLIGENCE_URL=http://intelligence:3107          # for AI cost recording
MEDIA_HUB_URL=http://media-hub:3111                # delegates DALL-E generation

# Observability
SENTRY_DSN=https://****
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
LOG_LEVEL=info

# Feature Flags
FEATURE_CLAUDE_ENABLED=true
FEATURE_GEMINI_ENABLED=true
FEATURE_BRAND_VOICE_TRAINING_ENABLED=true
FEATURE_PLAGIARISM_CHECK_ENABLED=false             # Phase 3+
FEATURE_AUTO_PUBLISH_ENABLED=false                 # requires explicit opt-in per workspace
```

---

## 9-14. (Deployment, Observability, Security, Testing, Local Dev, Runbooks)

See `ai-platform.md` for in-depth coverage of provider abstraction, cost tracking, prompt versioning, output validation, prompt injection defence, and hallucination handling.

Service-specific runbooks:
- **OpenAI outage** → automatic failover to Claude (logged warn-level); if both down: queue requests with delay, notify customer
- **Cost spike** → identify workspace, apply temporary cap, alert customer
- **Hallucination spike** → check recent prompt version changes; consider rollback
- **PR Newswire failure** → retry via DLQ; notify content owner
