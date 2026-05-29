# 🧠 crm-automation (Port 3110)
## Contacts · Lead Scoring · Workflows · Deals · Forms

> **Tier 1 — Critical.** The brain of the customer's marketing. Behavioural triggers, scoring, automation workflows, deal pipeline, lead capture.

---

## 1. Service Identity

| Field | Value |
|---|---|
| **Service Name** | `crm-automation` |
| **Port** | 3110 |
| **Maturity Tier** | Tier 1 |
| **SLA** | 99.9% uptime |
| **On-Call** | 24/7 |
| **Owning Team** | CRM Team |

**One-sentence purpose:** Capture, score, segment, and automate against every contact in a customer's CRM — and run drag-and-drop automation workflows triggered by behavioural events.

**Bounded context:** Contacts, companies, activities, lead scoring rules, automation workflows (the React Flow JSON), deal pipeline, tasks, lead-capture forms. Highest cross-service event consumer.

---

## 2. Responsibilities (DO / DON'T)

### ✅ DO
- Contact CRUD + bulk upsert (deduplication by email)
- Company CRM (account-level rollup)
- Contact activity timeline (every event aggregated)
- Lead scoring rules engine (configurable + decay)
- Automation workflow builder (React Flow JSON → executable steps)
- Workflow processor (trigger → wait → condition → action loop)
- Deal pipeline (Kanban)
- Task management
- Lead-capture forms (public submit endpoint)
- Smart segmentation (filter contacts by any field/tag/score/activity)
- RFM analysis (Recency, Frequency, Monetary)
- NPS automation (survey + segmentation)
- HubSpot / Salesforce sync (via `integration-service`)

### ❌ DON'T
- Send the actual messages → `email-hub` (we just enrol contacts)
- Track web events directly → `analytics-engine` publishes events to us
- Generate AI-personalised email content → `content-ai`
- Manage subscribers (subscription channel) → `email-hub` (a contact can have subscriber linked)

---

## 3. Domain Model

### Tables Owned (11)

| Table | Purpose |
|---|---|
| `crm_contacts` | Master contact record |
| `crm_companies` | Account-level info |
| `crm_contact_activities` | Per-contact event log (high volume) |
| `crm_lead_scoring_rules` | Workspace-configured scoring rules |
| `crm_workflows` | Workflow definitions (React Flow JSON + parsed) |
| `crm_workflow_steps` | Steps within a workflow |
| `crm_workflow_enrollments` | Contact ↔ workflow enrolment state |
| `crm_forms` | Lead capture form definitions |
| `crm_form_submissions` | Form submission records |
| `crm_deals` | Sales pipeline deals |
| `crm_tasks` | Tasks assigned to team members |

### Key Schemas

```sql
CREATE TABLE crm_contacts (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  email           VARCHAR(255),
  phone           VARCHAR(50),
  first_name      VARCHAR(100),
  last_name       VARCHAR(100),
  full_name       VARCHAR(255),
  company_id      CHAR(36),
  company_name    VARCHAR(255),
  job_title       VARCHAR(255),
  source          ENUM('organic','paid','social','referral','direct','email','form','manual','import','api'),
  source_details  VARCHAR(500),
  lifecycle_stage ENUM('subscriber','lead','mql','sql','customer','evangelist') DEFAULT 'subscriber',
  lead_score      INT DEFAULT 0,
  custom_fields   JSON,
  tags            JSON,
  email_subscriber_id CHAR(36),                   -- link to email_subscribers
  owner_user_id   CHAR(36),                        -- sales rep
  first_seen_at   DATETIME,
  last_activity_at DATETIME,
  last_engaged_at DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  UNIQUE KEY uk_workspace_email (workspace_id, email),
  INDEX idx_workspace_lifecycle (workspace_id, lifecycle_stage),
  INDEX idx_workspace_score (workspace_id, lead_score),
  INDEX idx_company (company_id)
) ENGINE=InnoDB;

CREATE TABLE crm_contact_activities (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36) NOT NULL,
  contact_id      CHAR(36) NOT NULL,
  activity_type   VARCHAR(100),                   -- 'email_open','page_view','form_submit','purchase'
  source_event_type VARCHAR(100),                 -- the originating event name
  data            JSON,
  score_delta     INT,                             -- score change applied
  occurred_at     DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_contact_time (contact_id, occurred_at)
) ENGINE=InnoDB
PARTITION BY RANGE (TO_DAYS(occurred_at)) (
  PARTITION p_2026_q2 VALUES LESS THAN (TO_DAYS('2026-07-01')),
  ...
);

CREATE TABLE crm_workflows (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  trigger_type    ENUM('contact_created','lifecycle_changed','tag_added','score_threshold','date_based','page_visited','form_submitted','event','manual') NOT NULL,
  trigger_config  JSON,                            -- trigger-specific parameters
  flow_json       JSON,                            -- React Flow canvas state
  parsed_steps    JSON,                            -- compiled execution steps
  status          ENUM('draft','active','paused','archived') DEFAULT 'draft',
  re_enrollment   ENUM('never','always','after_completion') DEFAULT 'never',
  max_active_per_contact INT DEFAULT 1,
  created_by      CHAR(36),
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  INDEX idx_workspace_status (workspace_id, status),
  INDEX idx_trigger_type (trigger_type)
) ENGINE=InnoDB;

CREATE TABLE crm_workflow_enrollments (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36) NOT NULL,
  workflow_id     CHAR(36) NOT NULL,
  contact_id      CHAR(36) NOT NULL,
  current_step    INT DEFAULT 0,
  status          ENUM('enrolled','running','completed','exited','failed') DEFAULT 'enrolled',
  enrolled_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  next_action_at  DATETIME,                        -- when worker should process next
  completed_at    DATETIME,
  exit_reason     VARCHAR(255),
  context         JSON,                            -- accumulated state during run
  INDEX idx_next_action (status, next_action_at),
  INDEX idx_contact_workflow (contact_id, workflow_id)
) ENGINE=InnoDB;

CREATE TABLE crm_forms (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36) NOT NULL,
  name            VARCHAR(255),
  slug            VARCHAR(100) UNIQUE,
  fields          JSON,                            -- field definitions
  submit_action   ENUM('redirect','message','download') DEFAULT 'message',
  redirect_url    VARCHAR(2048),
  success_message TEXT,
  download_url    VARCHAR(2048),
  notify_emails   JSON,                            -- emails to notify on submit
  add_to_lists    JSON,                            -- email list IDs
  enrol_workflow_id CHAR(36),
  captcha_enabled TINYINT(1) DEFAULT 1,
  submission_count INT DEFAULT 0,
  embed_code      TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  INDEX idx_workspace (workspace_id),
  INDEX idx_slug (slug)
) ENGINE=InnoDB;
```

### State Machine: Workflow Enrolment
```
enrolled → running → completed
                 → exited (manual or condition)
                 → failed (error during step)
```

---

## 4. API Contract

| Method | Path | Auth |
|---|---|---|
| GET | `/contacts` | JWT + `crm:r` |
| POST | `/contacts` | JWT + `crm:c` |
| POST | `/contacts/bulk` | JWT + `crm:c` (upsert by email) |
| GET | `/contacts/:id` | JWT + `crm:r` |
| GET | `/contacts/:id/timeline` | JWT + `crm:r` |
| PATCH | `/contacts/:id` | JWT + `crm:u` |
| DELETE | `/contacts/:id` | JWT + `crm:d` |
| POST | `/contacts/search` | JWT + `crm:r` (smart segmentation) |
| GET | `/companies` | JWT + `crm:r` |
| GET | `/scoring-rules` | JWT + `crm:r` |
| POST | `/scoring-rules` | JWT + `crm:c` |
| GET | `/workflows` | JWT + `workflows:r` |
| POST | `/workflows` | JWT + `workflows:c` |
| PATCH | `/workflows/:id` | JWT + `workflows:u` |
| POST | `/workflows/:id/activate` | JWT + `workflows:u` |
| POST | `/workflows/:id/enroll` | JWT + `workflows:u` (manual enrol) |
| GET | `/workflows/:id/enrollments` | JWT + `workflows:r` |
| GET | `/forms` | JWT + `forms:r` |
| POST | `/forms` | JWT + `forms:c` |
| **GET** | **`/f/:slug`** | **(public — embeddable form)** |
| **POST** | **`/f/:slug/submit`** | **(public — form submission)** |
| GET | `/deals` | JWT + `crm:r` |
| POST | `/deals` | JWT + `crm:c` |
| PATCH | `/deals/:id` | JWT + `crm:u` |
| GET | `/tasks` | JWT + `crm:r` |
| POST | `/tasks` | JWT + `crm:c` |

---

## 5. Async Events

### Published
| Event | When |
|---|---|
| `crm.contact.created` | New contact |
| `crm.contact.updated` | Contact field changed |
| `crm.contact.deleted` | Contact removed |
| `crm.contact.lifecycle_changed` | Lifecycle stage transition |
| `crm.contact.score_threshold_crossed` | Crossed configured threshold |
| `crm.contact.tag_added` | Tag applied |
| `crm.contact.tag_removed` | Tag removed |
| `crm.form.submission` | Form submitted |
| `crm.workflow.enrolled` | Contact enrolled in workflow |
| `crm.workflow.completed` | Contact completed workflow |
| `crm.workflow.exited` | Contact exited mid-workflow |
| `crm.deal.created` | Deal created |
| `crm.deal.stage_changed` | Deal moved between pipeline stages |
| `crm.deal.won` | Deal closed-won |

### Consumed (this service is the BIGGEST event consumer)
| Event | From | Action |
|---|---|---|
| `email.opened` | email-hub | +10 score, create activity |
| `email.clicked` | email-hub | +20 score, create activity |
| `email.unsubscribed` | email-hub | -30 score, lifecycle re-evaluate |
| `email.bounced` | email-hub | -50 score, possibly delete |
| `analytics.conversion_goal_hit` | analytics-engine | +50 score, lifecycle change |
| `analytics.page_view` (high intent pages) | analytics-engine | +variable score |
| `social.mention.detected` | social-hub | Enrich contact if matched, +5 score |
| `affiliate.commission.earned` | affiliate-hub | Track if existing contact |
| `campaign.launched` | campaign-manager | Auto-enrol relevant contacts |

### Bull Queues
| Queue | Purpose | Schedule |
|---|---|---|
| `mkt-workflow-processor` | Find enrolments due → run next step | Every 1 min |
| `mkt-lead-scorer` | Apply scoring rules to activity events | Every 10 min (batch) |
| `mkt-score-decay` | Decrement scores for inactive contacts | Daily 03:00 UTC |
| `mkt-rfm-analysis` | Compute RFM segments | Nightly 01:00 UTC |
| `mkt-nps-survey` | Send NPS surveys | Per schedule |
| `mkt-contact-deduper` | Detect + merge duplicates | Weekly |

---

## 6. Dependencies

### Downstream callers
- Frontend — primary UI consumer
- `campaign-manager` — One-Click creates workflow + form via this service
- `integration-service` — HubSpot/Salesforce sync proxy + customer API

### External
- HubSpot API (via integration-service)
- Salesforce API (via integration-service)

---

## 7. Folder Structure (standard)

## 8. Configuration

```bash
SERVICE_NAME=crm-automation
NODE_ENV=production
PORT=3110

# Database (largest data volume — needs strong pool)
DB_DIALECT=mysql
DATABASE_URL=mysql://app_write:****@primary:3306/marketing?ssl-mode=REQUIRED
DATABASE_READ_URL=mysql://app_read:****@replica:3306/marketing?ssl-mode=REQUIRED
DB_POOL_MAX=20
DB_POOL_MIN=5

# Redis
REDIS_URL=rediss://****@redis-cluster:6379/0

# Contact search — v1 uses MySQL FULLTEXT INDEX / PostgreSQL tsvector GIN
# Adequate for ~100k contacts per workspace.
# Elasticsearch DEFERRED to Phase 5+ when database search > 500ms P95
# ELASTICSEARCH_URL=             # uncomment in Phase 5+
# ELASTICSEARCH_INDEX_CONTACTS=crm_contacts

# Auth
JWT_SECRET=****
SERVICE_NAME_FOR_JWT=crm-automation

# Form submission protection
RECAPTCHA_SECRET_KEY=****
RECAPTCHA_SITE_KEY=****
RECAPTCHA_THRESHOLD=0.5                           # 0.0-1.0; below = block
HONEYPOT_FIELD_NAME=fax_number                    # invisible field; bots fill it
FORM_SUBMISSION_RATE_LIMIT_PER_IP_PER_HOUR=20

# Lead scoring
SCORING_DECAY_INACTIVE_DAYS=30
SCORING_DECAY_PERCENT=10                          # -10% per period after threshold
SCORING_RECOMPUTE_INTERVAL_MIN=10

# Workflow processor
WORKFLOW_PROCESSOR_TICK_INTERVAL_MIN=1
WORKFLOW_MAX_STEPS_PER_RUN=100                    # prevent infinite loops
WORKFLOW_MAX_ENROLLMENTS_PER_CONTACT=3

# RFM analysis
RFM_RECOMPUTE_HOUR_UTC=1                          # nightly 01:00 UTC

# Service URLs
MARKETING_CORE_URL=http://marketing-core:3100
EMAIL_HUB_URL=http://email-hub:3106
NOTIFICATION_SERVICE_URL=http://notification-service:3112
INTEGRATION_SERVICE_URL=http://integration-service:3113

# Observability
SENTRY_DSN=https://****
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
LOG_LEVEL=info

# Feature Flags
FEATURE_HUBSPOT_SYNC_ENABLED=false                # via integration-service
FEATURE_SALESFORCE_SYNC_ENABLED=false             # Phase 5
FEATURE_NPS_AUTOMATION_ENABLED=true
```

---

## 9-14. (Deployment, Observability, Security, Testing, Local Dev, Runbooks)

### Critical Metrics
```
mkt_contacts_total{workspace_tier}                Gauge
mkt_contact_created_total{source}                 Counter
mkt_workflows_active_count                        Gauge
mkt_workflow_enrollments_total                    Counter
mkt_workflow_step_processed_total{action_type}    Counter
mkt_form_submissions_total                        Counter
mkt_form_submission_spam_blocked_total            Counter
mkt_lead_score_threshold_crossed_total            Counter
```

### Workflow Builder Internals

The frontend's React Flow JSON is stored as `flow_json`. A parser converts it to executable `parsed_steps`:

```json
{
  "nodes": [
    { "id": "trigger", "type": "trigger", "config": { "type": "form_submitted", "form_id": "..." } },
    { "id": "wait1",   "type": "wait", "config": { "minutes": 60 } },
    { "id": "send1",   "type": "action", "config": { "channel": "email", "template_id": "..." } },
    { "id": "cond1",   "type": "condition", "config": { "rule": "email_opened_in_last_3_days" } },
    { "id": "send2",   "type": "action", "config": { "channel": "sms", "template_id": "..." } }
  ],
  "edges": [
    { "from": "trigger", "to": "wait1" },
    { "from": "wait1",   "to": "send1" },
    { "from": "send1",   "to": "cond1" },
    { "from": "cond1",   "to": "send2", "if": "true" },
    { "from": "cond1",   "to": "_end",  "if": "false" }
  ]
}
```

### Runbooks

**"Workflow stuck — contacts not advancing"**
1. Check `mkt-workflow-processor` queue health
2. Check `crm_workflow_enrollments` for next_action_at < NOW() AND status=running
3. Common cause: external service down (email-hub can't send → step retries → eventually exits)
4. Inspect failure_reason on enrolments

**"Lead scoring drift"**
1. Audit `crm_lead_scoring_rules` for recent rule changes
2. Check `score_decay` cron is running
3. Compare top-scoring contacts manually to validate
