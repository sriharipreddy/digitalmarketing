# 🔔 notification-service (Port 3112)
## In-App Notifications · Real-Time Alerts · Weekly Digests · Preferences

> **Tier 2 — Important.** Consumes ALL events from other services; fans out to user notifications per preferences.

---

## 1. Service Identity

| Field | Value |
|---|---|
| **Service Name** | `notification-service` |
| **Port** | 3112 |
| **Maturity Tier** | Tier 2 |
| **SLA** | 99.5% uptime |
| **On-Call** | Business hours |
| **Owning Team** | Platform Team |

**One-sentence purpose:** Deliver the right notification to the right user at the right time via their preferred channel — in-app bell, email, push, or Slack.

**Bounded context:** Everything internal-facing. Users see notifications via the bell icon, weekly digest emails, real-time alerts. Customer-facing alerts (their end-customers) are not this service.

---

## 2. Responsibilities (DO / DON'T)

### ✅ DO
- In-app notification creation + read/unread state
- Real-time delivery via Socket.IO (bell badge live updates)
- Per-user notification preferences (which events to receive on which channel)
- Email digest generation (weekly summary)
- Per-event routing per workspace + per user
- Slack/Teams webhook integration (optional channel for power users)
- Notification grouping (don't fire 100 separate alerts; group)
- Snooze + DND (do-not-disturb) windows

### ❌ DON'T
- Send marketing emails to customers' subscribers → `email-hub`
- Generate the alerts' content → publish events; we render templates
- Track customer's end-customer notifications → out of scope
- Be the system-of-record for events → `analytics-engine` is

---

## 3. Domain Model

### Tables Owned (4)

| Table | Purpose |
|---|---|
| `notify_notifications` | Per-user notification (with state) |
| `notify_prefs` | User's notification preferences per event type |
| `notify_channels` | Connected channels (email default, optional Slack) |
| `notify_digests` | Weekly digest content accumulator |

### Key Schemas

```sql
CREATE TABLE notify_notifications (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  user_id         CHAR(36)     NOT NULL,
  event_type      VARCHAR(100) NOT NULL,
  severity        ENUM('info','success','warning','critical') DEFAULT 'info',
  title           VARCHAR(255),
  body            TEXT,
  link            VARCHAR(2048),
  icon            VARCHAR(50),
  metadata        JSON,
  read_at         DATETIME,
  delivered_channels JSON,                        -- ['in_app','email'] etc
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  INDEX idx_user_unread (user_id, read_at, created_at),
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB;

CREATE TABLE notify_prefs (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36) NOT NULL,
  user_id         CHAR(36) NOT NULL,
  event_type      VARCHAR(100) NOT NULL,
  channels        JSON,                            -- ['in_app','email','push','slack']
  enabled         TINYINT(1) DEFAULT 1,
  digest_only     TINYINT(1) DEFAULT 0,
  dnd_start_hour  TINYINT,                         -- 0-23 (user's timezone)
  dnd_end_hour    TINYINT,
  UNIQUE KEY uk_user_event (user_id, event_type),
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB;
```

---

## 4. API Contract

| Method | Path | Permission |
|---|---|---|
| GET | `/notifications` | JWT |
| GET | `/notifications/unread/count` | JWT (high-frequency polling allowed) |
| POST | `/notifications/:id/read` | JWT |
| POST | `/notifications/read-all` | JWT |
| DELETE | `/notifications/:id` | JWT |
| GET | `/preferences` | JWT |
| PATCH | `/preferences` | JWT |
| GET | `/digests/weekly/preview` | JWT |
| GET | `/socket-token` | JWT (issues short-lived Socket.IO token) |
| WSS | `/ws` | Socket-token query param |
| POST | `/internal/notify` | (service JWT — direct notification) |

---

## 5. Async Events

### Consumed (subscribes to ALL events from all services)
- `seo.ranking.changed` → notify if user's prefs include
- `social.post.failed` → notify post owner
- `campaign.launched` → notify campaign creator
- `email.bounce.rate_spike` → notify email manager
- `crm.contact.score_threshold_crossed` → notify sales rep
- `intelligence.autopilot.recommendation_generated` → notify owner
- ... (any event matching user preference rules)

### Bull Queues
| Queue | Purpose | Schedule |
|---|---|---|
| `mkt-notification-fanout` | Process inbound events → create notifications | Every 30s |
| `mkt-digest-builder` | Build weekly digests per workspace | Mon 07:00 workspace TZ |
| `mkt-digest-sender` | Email the digest | Mon 08:00 workspace TZ |
| `mkt-notification-grouper` | Merge similar notifications (e.g., 5 rank drops → 1 summary) | Every 5 min |

---

## 6. Dependencies

### External
- **SendGrid** — weekly digest emails (transactional channel)
- **Firebase FCM** — push to mobile (if PWA enabled)
- **Slack incoming webhook** — optional power-user channel
- **Socket.IO** — server runs alongside Express

---

## 7. Folder Structure (standard)

## 8. Configuration

```bash
SERVICE_NAME=notification-service
NODE_ENV=production
PORT=3112

# Database
DB_DIALECT=mysql
DATABASE_URL=mysql://app_write:****@primary:3306/marketing?ssl-mode=REQUIRED
DB_POOL_MAX=8
DB_POOL_MIN=2

# Redis (cache + pubsub + Socket.IO adapter)
REDIS_URL=rediss://****@redis-cluster:6379/0

# Auth
JWT_SECRET=****
SOCKET_TOKEN_SECRET=****                          # for short-lived Socket.IO tokens

# Socket.IO
SOCKET_IO_PATH=/api/v1/notify/ws
SOCKET_IO_ORIGINS=https://app.yourplatform.com,https://*.yourplatform.com

# SendGrid (digest emails)
SENDGRID_API_KEY=SG.****
DIGEST_FROM_EMAIL=digest@yourplatform.com

# Slack (optional channel for power users)
SLACK_CLIENT_ID=****                              # Slack app OAuth
SLACK_CLIENT_SECRET=****

# Firebase (push to PWA / mobile — Phase 6)
FIREBASE_PROJECT_ID=yourplatform-prod
FIREBASE_ADMIN_KEY_JSON_BASE64=****

# Digest builder
DIGEST_DAY_OF_WEEK=monday
DIGEST_HOUR_WORKSPACE_TZ=8
DIGEST_PDF_INCLUDED=true

# Notification grouping
NOTIFICATION_GROUP_INTERVAL_MIN=5                 # merge similar within 5min
NOTIFICATION_RETENTION_DAYS=90

# Service URLs
MARKETING_CORE_URL=http://marketing-core:3100

# Observability
SENTRY_DSN=https://****
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
LOG_LEVEL=info

# Feature Flags
FEATURE_SLACK_CHANNEL_ENABLED=false               # Phase 4
FEATURE_WEEKLY_DIGEST_ENABLED=true
FEATURE_PUSH_NOTIFICATIONS_ENABLED=false          # Phase 6 (PWA)
```

---

## 9-14. (Deployment, Observability, Security, Testing, Local Dev, Runbooks)

### Metrics
```
mkt_notifications_created_total{event_type, severity}    Counter
mkt_notifications_delivered_total{channel, status}        Counter
mkt_socket_connections_active                             Gauge
mkt_digest_emails_sent_total                             Counter
```

### Runbooks

**"Notifications backed up"**
1. Check `mkt-notification-fanout` queue depth
2. Could indicate downstream event flood (one workspace creating 1000s of events/min)
3. Apply temporary per-workspace rate limit on notification creation
4. Investigate event flood at the source

**"Weekly digest emails failed"**
1. Check `mkt-digest-sender` queue
2. Often DNS / SendGrid issues
3. Re-run for affected workspaces; digest emails are best-effort, late delivery acceptable
