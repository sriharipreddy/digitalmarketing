# 📧 email-hub (Port 3106)
## Email · SMS · Push · WhatsApp · Drip Sequences

> **Tier 1 — Critical for revenue.** Highest legal risk (TCPA, CAN-SPAM, GDPR). Compliance non-negotiable.

---

## 1. Service Identity

| Field | Value |
|---|---|
| **Service Name** | `email-hub` |
| **Port** | 3106 |
| **Maturity Tier** | Tier 1 |
| **SLA** | 99.9% uptime |
| **On-Call** | 24/7 |
| **Owning Team** | Messaging Team |

**One-sentence purpose:** Deliver every marketing message — email broadcasts, drip sequences, SMS, push notifications, WhatsApp — to opt-in subscribers, in compliance with CAN-SPAM/GDPR/TCPA.

**Bounded context:** Subscriber lists, all message delivery, deliverability, opt-in/opt-out flows, suppression lists, transactional + marketing email split.

---

## 2. Responsibilities (DO / DON'T)

### ✅ DO
- Subscriber list CRUD + segmentation
- Email broadcasts (one-time campaigns)
- Drip sequences (multi-step automated flows with conditional branching)
- Transactional emails (auth, billing, invoices) — separate sending infrastructure
- SMS campaigns + drip sequences (Twilio)
- WhatsApp Business broadcasts (360dialog)
- Push notifications (Firebase FCM)
- Messenger Bot flows (Facebook Messenger)
- Visual email builder (Unlayer integration; stores JSON + compiled HTML)
- Deliverability monitoring (SPF/DKIM/DMARC; spam score; bounce/complaint webhooks)
- Suppression lists (unsubscribed, bounced, complained)
- TCPA-compliant SMS (opt-in record, STOP keyword, time-of-day window)
- CAN-SPAM enforcement (unsubscribe link + physical address in every email)

### ❌ DON'T
- Generate email body text → `content-ai`
- Track email opens for analytics → analytics-engine; we publish events
- Identify leads → `crm-automation` (subscribers ≠ contacts; can be linked)
- Send transactional auth emails → `marketing-core` owns (separate SendGrid sub-user)
- Manage influencer outreach emails → `influencer-hub`

---

## 3. Domain Model

### Tables Owned (12)

| Table | Purpose |
|---|---|
| `email_lists` | Lists of subscribers |
| `email_subscribers` | Individual subscriber records (email + phone) |
| `email_campaigns` | Broadcast campaign definitions |
| `email_templates` | Reusable templates |
| `email_metrics` | Per-campaign aggregate metrics |
| `email_events` | Per-subscriber events (sent, opened, clicked, bounced) |
| `email_suppression` | Global suppression list (hash-based after RTBF) |
| `email_drip_sequences` | Drip sequence definitions |
| `email_drip_steps` | Steps per sequence |
| `email_drip_enrollments` | Subscriber enrolled in sequence |
| `email_sms_campaigns` | SMS broadcast records |
| `email_push_campaigns` | Push notification campaigns |
| `email_whatsapp_campaigns` | WhatsApp broadcasts |
| `core_consent_log` | Opt-in records (GDPR Article 7 burden-of-proof) |

### Key Schemas

```sql
CREATE TABLE email_subscribers (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  list_id         CHAR(36)     NOT NULL,
  email           VARCHAR(255) NOT NULL,
  phone           VARCHAR(50),
  whatsapp        VARCHAR(50),
  first_name      VARCHAR(100),
  last_name       VARCHAR(100),
  custom_fields   JSON,
  tags            JSON,
  email_status    ENUM('subscribed','unsubscribed','bounced','complained','pending') DEFAULT 'pending',
  sms_status      ENUM('subscribed','unsubscribed','pending') DEFAULT 'pending',
  push_status     ENUM('subscribed','unsubscribed','pending') DEFAULT 'pending',
  whatsapp_status ENUM('subscribed','unsubscribed','pending') DEFAULT 'pending',
  timezone        VARCHAR(50),
  language        CHAR(5) DEFAULT 'en',
  opt_in_source   VARCHAR(100),                  -- 'form_submit', 'import_csv', 'api'
  opt_in_ip       VARCHAR(45),
  subscribed_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  unsubscribed_at DATETIME,
  last_email_opened_at DATETIME,
  deleted_at      DATETIME NULL,
  UNIQUE KEY uk_list_email (list_id, email),
  INDEX idx_workspace_email (workspace_id, email),
  INDEX idx_email_status (email_status),
  INDEX idx_phone (phone)
) ENGINE=InnoDB;

CREATE TABLE email_events (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36) NOT NULL,
  campaign_id     CHAR(36),
  subscriber_id   CHAR(36) NOT NULL,
  event_type      ENUM('sent','delivered','opened','clicked','bounced','unsubscribed','complained','dropped','deferred'),
  event_data      JSON,                          -- {link_url, bounce_reason, etc}
  ip              VARCHAR(45),
  user_agent      VARCHAR(500),
  created_at      DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_workspace_time (workspace_id, created_at),
  INDEX idx_subscriber (subscriber_id),
  INDEX idx_campaign_type (campaign_id, event_type)
) ENGINE=InnoDB
PARTITION BY RANGE (TO_DAYS(created_at)) (
  PARTITION p_2026_q2 VALUES LESS THAN (TO_DAYS('2026-07-01')),
  ...
);

CREATE TABLE email_drip_sequences (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  channel         ENUM('email','sms','push','whatsapp','multi') DEFAULT 'email',
  trigger_event   VARCHAR(100),                  -- 'form_submit', 'tag_added', 'manual'
  trigger_config  JSON,
  status          ENUM('draft','active','paused') DEFAULT 'draft',
  re_enrollment   ENUM('never','always','after_completion') DEFAULT 'never',
  created_by      CHAR(36),
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  INDEX idx_workspace_status (workspace_id, status)
) ENGINE=InnoDB;

CREATE TABLE email_drip_steps (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  sequence_id     CHAR(36) NOT NULL,
  step_num        INT NOT NULL,
  delay_minutes   INT,                           -- minutes after previous step
  channel         ENUM('email','sms','push','whatsapp'),
  template_id     CHAR(36),
  subject         VARCHAR(255),
  condition       JSON,                          -- e.g., {if_not_opened: skip_to_step_3}
  UNIQUE KEY uk_sequence_step (sequence_id, step_num),
  INDEX idx_sequence (sequence_id)
) ENGINE=InnoDB;

CREATE TABLE core_consent_log (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36) NOT NULL,
  subscriber_id   CHAR(36),
  email_or_phone  VARCHAR(255),
  channel         ENUM('email','sms','push','whatsapp'),
  consent_type    ENUM('subscribe','unsubscribe','double_opt_in_confirm','preference_update'),
  source_url      VARCHAR(2048),
  ip              VARCHAR(45),
  user_agent      VARCHAR(500),
  consent_text    TEXT,                          -- exact wording at the time of consent
  occurred_at     DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_workspace_subscriber (workspace_id, subscriber_id),
  INDEX idx_email_phone (email_or_phone)
) ENGINE=InnoDB;
```

---

## 4. API Contract

| Method | Path | Permission |
|---|---|---|
| GET | `/lists` | `email:r` |
| POST | `/lists` | `email:c` |
| GET | `/lists/:id/subscribers` | `email:r` |
| POST | `/subscribers/bulk` | `email:c` (CSV import) |
| PATCH | `/subscribers/:id` | `email:u` |
| DELETE | `/subscribers/:id` | `email:d` |
| GET | `/subscribers/:id/preferences/:token` | (public — preference centre) |
| PATCH | `/subscribers/:id/preferences/:token` | (public) |
| GET | `/unsubscribe/:token` | (public — one-click unsub) |
| GET | `/templates` | `email:r` |
| POST | `/templates` | `email:c` |
| GET | `/campaigns` | `email:r` |
| POST | `/campaigns` | `email:c` |
| POST | `/campaigns/:id/send` | `email:u` |
| POST | `/campaigns/:id/schedule` | `email:u` |
| GET | `/campaigns/:id/metrics` | `email:r` |
| POST | `/transactional/send` | `email:c` (internal-only) |
| POST | `/sms/send` | `email:c` (sms permission) |
| POST | `/push/send` | `email:c` |
| POST | `/whatsapp/send` | `email:c` |
| GET | `/drips` | `email:r` |
| POST | `/drips` | `email:c` |
| POST | `/drips/:id/enroll` | `email:c` |
| GET | `/deliverability` | `email:r` (SPF/DKIM/DMARC status) |
| POST | `/webhooks/sendgrid` | (SendGrid signature) |
| POST | `/webhooks/twilio/sms-status` | (Twilio signature) |
| POST | `/webhooks/twilio/sms-inbound` | (Twilio signature; STOP/HELP handling) |

---

## 5. Async Events

### Published
| Event | When |
|---|---|
| `email.sent` | Campaign email sent |
| `email.delivered` | SendGrid confirmed delivery |
| `email.opened` | Open tracking pixel hit |
| `email.clicked` | Tracked link clicked |
| `email.bounced` | Hard or soft bounce |
| `email.unsubscribed` | User unsubscribed |
| `email.complained` | Marked as spam |
| `subscriber.added` | New subscriber |
| `subscriber.removed` | Subscriber unsubscribed or deleted |
| `subscriber.bounced` | Subscriber marked bounced |
| `drip.enrolled` | Subscriber enrolled in drip |
| `drip.completed` | Subscriber completed sequence |
| `sms.sent` | SMS sent |
| `sms.delivered` | Twilio confirmed |
| `sms.opted_out` | STOP keyword received |

### Consumed
| Event | From | Action |
|---|---|---|
| `crm.contact.lifecycle_changed` | crm-automation | Re-evaluate drip enrolment |
| `form.submission` | crm-automation | Auto-subscribe to lists if form configured |
| `campaign.launched` | campaign-manager | Send campaign emails / SMS |
| `content.scheduled` (channel=email) | content-ai | Create email campaign |

### Bull Queues
| Queue | Purpose | Schedule | Concurrency |
|---|---|---|---|
| `mkt-email-sender` | Send queued emails via SendGrid | Every 2 min | 50 |
| `mkt-drip-processor` | Advance subscribers through drip steps | Every 5 min | 20 |
| `mkt-sms-sender` | Send queued SMS via Twilio | Every 1 min | 20 (Twilio 1/sec/number) |
| `mkt-push-sender` | Send queued push via FCM | Every 1 min | 50 |
| `mkt-whatsapp-sender` | Send queued WhatsApp via 360dialog | Every 1 min | 10 |
| `mkt-suppression-sync` | Sync SendGrid suppression list | Daily | 1 |
| `mkt-deliverability-check` | DNS check SPF/DKIM/DMARC for each sending domain | Daily | 5 |
| `mkt-bounce-handler` | Process bounce webhooks | On-demand | 10 |

---

## 6. Dependencies

### External APIs
| Provider | Use |
|---|---|
| **SendGrid** | Email delivery + suppression lists + webhooks |
| **Twilio** | SMS (existing) + WhatsApp (fallback) |
| **360dialog** | WhatsApp Business (primary) |
| **Firebase Admin** | Push notifications (existing) |
| **DNSimple / Route 53** | DNS records for SPF/DKIM/DMARC |

---

## 7. Folder Structure (standard — see 00-standards.md)

## 8. Configuration

```bash
# Service Identity
SERVICE_NAME=email-hub
NODE_ENV=production
PORT=3106

# Database
DB_DIALECT=mysql
DATABASE_URL=mysql://app_write:****@primary:3306/marketing?ssl-mode=REQUIRED
DATABASE_READ_URL=mysql://app_read:****@replica:3306/marketing?ssl-mode=REQUIRED
DB_POOL_MAX=15
DB_POOL_MIN=3

# Redis
REDIS_URL=rediss://****@redis-cluster:6379/0

# Auth
JWT_SECRET=****
SERVICE_NAME_FOR_JWT=email-hub
UNSUBSCRIBE_TOKEN_SECRET=****                     # signs unsubscribe URLs
PREFERENCE_TOKEN_SECRET=****

# SendGrid (Email)
SENDGRID_API_KEY=SG.****
SENDGRID_WEBHOOK_PUBLIC_KEY=****                  # for ECDSA verification
SENDGRID_FROM_EMAIL_DEFAULT=noreply@yourplatform.com
SENDGRID_REPLY_TO_DEFAULT=support@yourplatform.com
SENDGRID_SANDBOX_MODE=false                       # true in dev = no real sends

# Sub-user IPs (per agency white-label)
SENDGRID_SUBUSER_CREATE_ENABLED=true

# Twilio (SMS + WhatsApp fallback)
TWILIO_ACCOUNT_SID=AC****
TWILIO_AUTH_TOKEN=****
TWILIO_SMS_FROM_DEFAULT=+44****
TWILIO_MESSAGING_SERVICE_SID=MG****
TWILIO_STATUS_CALLBACK_URL=https://api.yourplatform.com/api/v1/email/webhooks/twilio/sms-status

# 360dialog (WhatsApp Business — primary)
DIALOG360_API_KEY=****
DIALOG360_API_URL=https://waba.360dialog.io/v1
DIALOG360_WEBHOOK_SECRET=****

# Firebase (Push)
FIREBASE_PROJECT_ID=yourplatform-prod
FIREBASE_ADMIN_KEY_JSON_BASE64=****               # base64-encoded service account JSON

# Email Builder
UNLAYER_PROJECT_ID=****
UNLAYER_API_KEY=****                              # for AI auto-design feature

# Deliverability Monitoring
DELIVERABILITY_DNS_CHECK_RESOLVER=8.8.8.8
SPAMASSASSIN_HOST=spamassassin:783                # optional service
HIBP_USER_AGENT=YourPlatform-Email/1.0

# TCPA / Compliance
SMS_TIME_OF_DAY_WINDOW_START=8                    # local time hour
SMS_TIME_OF_DAY_WINDOW_END=21
SMS_MAX_PER_RECIPIENT_PER_DAY=3
SMS_REQUIRE_DOUBLE_OPT_IN=true                    # production safety
WHATSAPP_REQUIRE_DOUBLE_OPT_IN=true

# Rate limiting
EMAIL_SEND_RATE_PER_WORKSPACE_PER_HOUR=10000
SMS_SEND_RATE_PER_WORKSPACE_PER_HOUR=1000

# Drip processor
DRIP_PROCESSOR_TICK_INTERVAL_MINUTES=5
DRIP_MAX_ACTIVE_PER_CONTACT=3

# Service URLs
MARKETING_CORE_URL=http://marketing-core:3100
CRM_AUTOMATION_URL=http://crm-automation:3110
CONTENT_AI_URL=http://content-ai:3102

# Observability
SENTRY_DSN=https://****
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
LOG_LEVEL=info

# Feature Flags
FEATURE_SMS_ENABLED=false                         # gated until Phase 5
FEATURE_WHATSAPP_ENABLED=false                    # gated until Phase 5
FEATURE_PUSH_ENABLED=false                        # gated until Phase 5
```

| Variable | Local | Staging | Production |
|---|---|---|---|
| `SENDGRID_SANDBOX_MODE` | true | true | false |
| `SMS_REQUIRE_DOUBLE_OPT_IN` | false | true | true |
| `FEATURE_SMS_ENABLED` | true | true | true (Phase 5) |

---

## 9. Deployment
ECS: 1 vCPU, 2 GB memory. Bull workers separate task. Webhook receivers behind ALB sticky session OFF.

## 10. Observability — see Section 5 metrics.

## 11. Security
- TCPA enforcement before every SMS (time window, opt-in check, STOP keyword)
- CAN-SPAM: footer auto-injected (physical address + unsubscribe link)
- SendGrid webhook signature verified (ECDSA)
- Twilio webhook signature verified (HMAC-SHA1)
- Suppression list hashed (post-RTBF)

## 12. Testing
- Mock SendGrid + Twilio + Firebase in unit tests
- Integration: test STOP keyword opt-out roundtrip
- Compliance test: verify CAN-SPAM footer present in every test send
- TCPA test: verify SMS held outside 8-21 window

## 13. Local Development
- SendGrid in sandbox mode (no real emails)
- Twilio test credentials (`AC*test*` SID)
- Use real WhatsApp sandbox number from 360dialog for testing

## 14. Runbooks — see Section 14 below.

### Critical Compliance Behaviour (TCPA / CAN-SPAM)
- Every email **automatically** appended with:
  - `<a href="{{unsubscribe_url}}">Unsubscribe</a>` (one-click, no login required)
  - Workspace's physical address (required field at workspace creation)
- Every SMS first-of-sequence prepended with brand name + "Reply STOP to opt out"
- SMS sender checks recipient's timezone — never send before 8am / after 9pm local
- Inbound SMS containing STOP/UNSUBSCRIBE/QUIT/CANCEL/END auto-unsubscribes within 5 seconds
- HELP keyword returns automated response

### Critical Metrics
```
mkt_emails_sent_total{workspace_tier}                      Counter
mkt_emails_delivered_total                                  Counter
mkt_emails_opened_total                                     Counter
email_bounce_rate                                       Gauge (alert if > 5%)
email_complaint_rate                                    Gauge (alert if > 0.1%)
mkt_sms_sent_total                                          Counter
mkt_sms_optout_total                                        Counter
mkt_drip_enrollments_total                                  Counter
mkt_deliverability_spf_failures{workspace_id}              Counter
```

### Runbooks

**"Email bounce rate spike"**
1. Check `email_bounce_rate` by workspace
2. Common cause: poor-quality list import (bought lists, scraped)
3. Pause workspace's email sending; notify owner; recommend list hygiene
4. SendGrid will throttle our sending IP if bounce rate exceeds threshold — affects ALL customers

**"Mass SMS opt-out via STOP"**
1. Investigate: what message was sent? Was it relevant? Frequency too high?
2. Pause sequence
3. Audit consent log for affected numbers
4. TCPA compliance review

**"SendGrid IP reputation drop"**
1. Check IP reputation at senderscore.org
2. Identify which workspace(s) caused the issue
3. Suspend their sending; investigate
4. Reach out to SendGrid support if IP gets blocked
5. Worst case: rotate to backup sending IP
