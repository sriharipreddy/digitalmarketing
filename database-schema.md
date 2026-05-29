# 🗄️ Database Schema — MySQL Reference
## Complete DDL for all ~100 tables · service-prefixed naming · Sequelize auto-creation

> **Decision (2026-05-28):**
> - **Reference format:** MySQL DDL only (for documentation + DBA review)
> - **Runtime:** Sequelize models with `sync()` auto-create tables, indexes, FKs, ENUMs
> - **Naming:** `<service>_<plural-noun>` so every table name tells you which service owns it (e.g., `core_users`, `seo_keywords`, `crm_contacts`)

This document is the **schema reference**. The actual source of truth is the Sequelize model files. When `sequelize.sync({ alter: true })` runs at service boot, it creates / updates tables to match the models.

For the auto-sync pattern, safety rules, and zero-downtime production migrations, see **[database-sync-strategy.md](database-sync-strategy.md)**.

---

## 📋 Table of Contents

1. [Naming Convention](#naming-convention)
2. [Universal Columns](#universal-columns)
3. [Service Prefix Map](#service-prefix-map)
4. [marketing-core](#marketing-core-core_)
5. [seo-engine](#seo-engine-seo_)
6. [content-ai](#content-ai-content_)
7. [campaign-manager](#campaign-manager-campaign_)
8. [analytics-engine](#analytics-engine-analytics_)
9. [social-hub](#social-hub-social_)
10. [email-hub](#email-hub-email_)
11. [intelligence](#intelligence-intel_)
12. [affiliate-hub](#affiliate-hub-affiliate_)
13. [influencer-hub](#influencer-hub-influencer_)
14. [crm-automation](#crm-automation-crm_)
15. [media-hub](#media-hub-media_)
16. [notification-service](#notification-service-notify_)
17. [integration-service](#integration-service-integ_)
18. [Foreign Key Catalogue](#foreign-key-catalogue)
19. [Index Strategy Summary](#index-strategy-summary)
20. [Migration Sequence](#migration-sequence)

---

## Naming Convention

```
mkt_<service-slug>_<plural-noun>
```

| Service | Prefix | Example tables |
|---|---|---|
| marketing-core | `core_` | `core_users`, `core_workspaces` |
| seo-engine | `seo_` | `seo_keywords`, `seo_rankings` |
| content-ai | `content_` | `content_pieces`, `content_brand_voices` |
| campaign-manager | `campaign_` | `campaign_campaigns`, `campaign_ad_creatives` |
| analytics-engine | `analytics_` | `analytics_events`, `analytics_ab_tests` |
| social-hub | `social_` | `social_accounts`, `social_posts` |
| email-hub | `email_` | `email_lists`, `email_subscribers` |
| intelligence | `intel_` | `intel_competitors`, `intel_ai_usage` |
| affiliate-hub | `affiliate_` | `affiliate_programs`, `affiliate_links` |
| influencer-hub | `influencer_` | `influencer_profiles`, `influencer_contracts` |
| crm-automation | `crm_` | `crm_contacts`, `crm_workflows` |
| media-hub | `media_` | `media_videos`, `media_images` |
| notification-service | `notify_` | `notify_notifications`, `notify_prefs` |
| integration-service | `integ_` | `integ_api_keys`, `integ_webhooks` |

**Why this convention:**
- Looking at any table name immediately tells you which service owns it
- `SHOW TABLES LIKE 'seo_%'` lists everything seo-engine owns
- Easy to set per-service table permissions if needed later
- No collision with the existing LicensedTaxi platform tables (all prefixed `a_`)

---

## Universal Columns

Every workspace-scoped table includes these columns:

```sql
id            CHAR(36)  NOT NULL PRIMARY KEY DEFAULT (UUID()),
workspace_id  CHAR(36)  NOT NULL,
created_at    DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
updated_at    DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
deleted_at    DATETIME  NULL,
INDEX idx_workspace (workspace_id),
INDEX idx_deleted (deleted_at)
```

**Global tables** (no `workspace_id`): `core_users`, `core_plans`. Everything else is workspace-scoped.

All tables use `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`.

---

## Service Prefix Map

```
                         ┌────────────────────────┐
                         │      core_*        │ ← Foundation
                         │  users, workspaces,    │   All services FK here
                         │  members, roles,       │
                         │  permissions, plans,   │
                         │  subscriptions, audit  │
                         └──────────┬─────────────┘
                                    │
        ┌──────────────┬────────────┼────────────┬──────────────┐
        ▼              ▼            ▼            ▼              ▼
   seo_*    content_*  campaign_*  crm_*   analytics_*
   keywords,    pieces,        campaigns,      contacts,    events,
   rankings,    brand_voices,  channels,       companies,   ab_tests,
   audits,      schedules      ad_creatives,   workflows,   funnels,
   backlinks                   utm_links,      forms,       reports
                               webinars        deals
        │              │            │            │              │
        ▼              ▼            ▼            ▼              ▼
   social_*   email_*   intel_*  affiliate_*  influencer_*
   accounts,      lists,        competitors, programs,        profiles,
   posts,         subscribers,  ad_spy,      affiliates,      contracts,
   metrics,       campaigns,    price_mon,   commissions,     outreach
   mentions       drips,        autopilot    payouts
                  sms, push
                                              ┌──────────────┐
                                              ▼              ▼
                                         media_*    notify_*
                                         videos,        notifications,
                                         images,        prefs,
                                         podcasts       digests

                                       integ_*
                                       api_keys, webhooks,
                                       deliveries, imports, exports
```

---

## marketing-core (core_*)

Foundation tables. Every other service has FKs pointing here.

### core_users — Global user identity

```sql
CREATE TABLE core_users (
  id                      CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  full_name               VARCHAR(255) NOT NULL,
  user_email              VARCHAR(255) NOT NULL,
  password_hash           VARCHAR(255),
  google_id               VARCHAR(255),
  avatar_url              VARCHAR(500),
  type                    ENUM('platform_admin','agency_owner','client_owner','team_member') NOT NULL,
  status                  ENUM('active','suspended','invited','pending_verify') NOT NULL DEFAULT 'pending_verify',
  email_verified          TINYINT(1)   NOT NULL DEFAULT 0,
  verify_token            VARCHAR(255),
  verify_token_exp        DATETIME,
  totp_secret             VARCHAR(255),
  totp_required           TINYINT(1)   NOT NULL DEFAULT 0,
  webauthn_credentials    JSON,
  backup_codes_hash       JSON,
  last_2fa_at             DATETIME,
  trusted_devices         JSON,
  preferred_locale        CHAR(5)      NOT NULL DEFAULT 'en',
  last_login_at           DATETIME,
  created_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at              DATETIME     NULL,
  UNIQUE KEY uk_email (user_email),
  INDEX idx_type_status (type, status),
  INDEX idx_google (google_id),
  INDEX idx_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### core_workspaces — Tenancy boundary

```sql
CREATE TABLE core_workspaces (
  id                    CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  name                  VARCHAR(255) NOT NULL,
  slug                  VARCHAR(100),
  domain                VARCHAR(255),
  industry              VARCHAR(100),
  country               CHAR(2),
  timezone              VARCHAR(50)  NOT NULL DEFAULT 'Europe/London',
  business_address      JSON,
  logo_url              VARCHAR(500),
  owner_id              CHAR(36)     NOT NULL,
  agency_id             CHAR(36),
  plan_id               CHAR(36),
  status                ENUM('trial','active','past_due','suspended','cancelled','pending_deletion','deleted') NOT NULL DEFAULT 'trial',
  trial_ends_at         DATETIME,
  cancelled_at          DATETIME,
  settings              JSON,
  ip_allowlist          JSON,
  region                VARCHAR(20)  NOT NULL DEFAULT 'eu-west-2',
  stripe_customer_id    VARCHAR(255),
  created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at            DATETIME     NULL,
  UNIQUE KEY uk_slug (slug),
  INDEX idx_owner (owner_id),
  INDEX idx_agency (agency_id),
  INDEX idx_status (status),
  INDEX idx_stripe (stripe_customer_id),
  INDEX idx_deleted (deleted_at),
  CONSTRAINT fk_workspaces_owner FOREIGN KEY (owner_id) REFERENCES core_users(id),
  CONSTRAINT fk_workspaces_agency FOREIGN KEY (agency_id) REFERENCES core_workspaces(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### core_workspace_members — User ↔ workspace + role

```sql
CREATE TABLE core_workspace_members (
  id                  CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id        CHAR(36)     NOT NULL,
  user_id             CHAR(36)     NOT NULL,
  role                ENUM('owner','editor','analyst','viewer') NOT NULL,
  invited_by          CHAR(36),
  invite_token        VARCHAR(255),
  invite_expires_at   DATETIME,
  joined_at           DATETIME,
  status              ENUM('active','invited','suspended') NOT NULL DEFAULT 'invited',
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at          DATETIME     NULL,
  UNIQUE KEY uk_workspace_user (workspace_id, user_id),
  INDEX idx_workspace (workspace_id),
  INDEX idx_user (user_id),
  INDEX idx_status (status),
  INDEX idx_invite_token (invite_token),
  INDEX idx_deleted (deleted_at),
  CONSTRAINT fk_members_workspace FOREIGN KEY (workspace_id) REFERENCES core_workspaces(id),
  CONSTRAINT fk_members_user FOREIGN KEY (user_id) REFERENCES core_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### core_roles + core_permissions

```sql
CREATE TABLE core_roles (
  id            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id  CHAR(36),                                  -- NULL = platform-default role
  role_name     VARCHAR(100) NOT NULL,
  description   VARCHAR(500),
  is_default    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    DATETIME     NULL,
  INDEX idx_workspace (workspace_id),
  INDEX idx_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE core_permissions (
  id            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  role_id       CHAR(36)     NOT NULL,
  module_name   VARCHAR(100) NOT NULL,
  access        JSON         NOT NULL,                     -- {"c":true,"r":true,"u":false,"d":false}
  UNIQUE KEY uk_role_module (role_id, module_name),
  CONSTRAINT fk_perms_role FOREIGN KEY (role_id) REFERENCES core_roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### core_auth_sessions — Refresh tokens

```sql
CREATE TABLE core_auth_sessions (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  user_id         CHAR(36)     NOT NULL,
  workspace_id    CHAR(36),
  refresh_token   VARCHAR(500) NOT NULL,
  device_info     JSON,
  ip_address      VARCHAR(45),
  expires_at      DATETIME     NOT NULL,
  revoked_at      DATETIME,
  last_used_at    DATETIME,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_token (refresh_token(100)),
  INDEX idx_expires (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES core_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### core_plans + core_subscriptions

```sql
CREATE TABLE core_plans (
  id                          CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  name                        VARCHAR(100) NOT NULL,
  slug                        VARCHAR(50)  NOT NULL,
  price_monthly_gbp           DECIMAL(8,2),
  price_yearly_gbp            DECIMAL(8,2),
  stripe_price_id_monthly     VARCHAR(255),
  stripe_price_id_yearly      VARCHAR(255),
  features                    JSON         NOT NULL,
  limits                      JSON         NOT NULL,
  max_team_members            INT          NOT NULL DEFAULT 1,
  max_clients                 INT          NOT NULL DEFAULT 0,
  is_agency_plan              TINYINT(1)   NOT NULL DEFAULT 0,
  is_active                   TINYINT(1)   NOT NULL DEFAULT 1,
  display_order               INT          NOT NULL DEFAULT 0,
  created_at                  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                  DATETIME     NULL,
  UNIQUE KEY uk_slug (slug),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE core_subscriptions (
  id                          CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id                CHAR(36)     NOT NULL,
  plan_id                     CHAR(36)     NOT NULL,
  stripe_subscription_id      VARCHAR(255),
  stripe_customer_id          VARCHAR(255),
  status                      ENUM('trialing','active','past_due','cancelled','paused','incomplete') NOT NULL DEFAULT 'trialing',
  billing_cycle               ENUM('monthly','yearly') NOT NULL DEFAULT 'monthly',
  current_period_start        DATETIME,
  current_period_end          DATETIME,
  cancel_at_period_end        TINYINT(1)   NOT NULL DEFAULT 0,
  cancelled_at                DATETIME,
  trial_ends_at               DATETIME,
  created_at                  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                  DATETIME     NULL,
  INDEX idx_workspace (workspace_id),
  INDEX idx_plan (plan_id),
  INDEX idx_status (status),
  INDEX idx_stripe_sub (stripe_subscription_id),
  CONSTRAINT fk_subs_workspace FOREIGN KEY (workspace_id) REFERENCES core_workspaces(id),
  CONSTRAINT fk_subs_plan FOREIGN KEY (plan_id) REFERENCES core_plans(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### core_agency_settings + core_agency_domains

```sql
CREATE TABLE core_agency_settings (
  id                  CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id        CHAR(36)     NOT NULL,
  brand_name          VARCHAR(255),
  brand_logo_url      VARCHAR(500),
  brand_colour        CHAR(7),
  brand_favicon_url   VARCHAR(500),
  reply_to_email      VARCHAR(255),
  support_url         VARCHAR(255),
  hide_powered_by     TINYINT(1)   NOT NULL DEFAULT 0,
  report_footer       TEXT,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at          DATETIME     NULL,
  UNIQUE KEY uk_workspace (workspace_id),
  CONSTRAINT fk_agency_workspace FOREIGN KEY (workspace_id) REFERENCES core_workspaces(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE core_agency_domains (
  id                          CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id                CHAR(36)     NOT NULL,
  domain                      VARCHAR(255) NOT NULL,
  verification_token          VARCHAR(100),
  domain_verified_at          DATETIME,
  tls_cert_pem_encrypted      TEXT,
  tls_key_pem_encrypted       TEXT,
  cert_issued_at              DATETIME,
  cert_expires_at             DATETIME,
  status                      ENUM('pending_verify','verifying','active','expired','disabled') NOT NULL DEFAULT 'pending_verify',
  created_at                  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                  DATETIME     NULL,
  UNIQUE KEY uk_domain (domain),
  INDEX idx_workspace (workspace_id),
  INDEX idx_cert_expiry (cert_expires_at),
  CONSTRAINT fk_domains_workspace FOREIGN KEY (workspace_id) REFERENCES core_workspaces(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### core_audit_log — Append-only audit trail

```sql
CREATE TABLE core_audit_log (
  id                      CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id            CHAR(36),
  actor_id                CHAR(36),
  actor_type              ENUM('user','system','admin_impersonation','api_key') NOT NULL,
  impersonated_user_id    CHAR(36),
  action                  VARCHAR(100) NOT NULL,
  resource_type           VARCHAR(50),
  resource_id             CHAR(36),
  before_state            JSON,
  after_state             JSON,
  ip_address              VARCHAR(45),
  user_agent              VARCHAR(500),
  request_id              VARCHAR(50),
  occurred_at             DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_workspace_time (workspace_id, occurred_at),
  INDEX idx_actor (actor_id),
  INDEX idx_action (action),
  INDEX idx_resource (resource_type, resource_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Partitioning added via separate migration; see "Index Strategy Summary"
```

### core_sso_connections + core_feature_flags + core_support_tickets

```sql
CREATE TABLE core_sso_connections (
  id                            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id                  CHAR(36)     NOT NULL,
  protocol                      ENUM('saml','oidc','scim') NOT NULL,
  display_name                  VARCHAR(100),
  saml_entity_id                VARCHAR(500),
  saml_sso_url                  VARCHAR(500),
  saml_cert                     TEXT,
  oidc_issuer                   VARCHAR(500),
  oidc_client_id                VARCHAR(255),
  oidc_client_secret_encrypted  TEXT,
  scim_endpoint                 VARCHAR(500),
  scim_bearer_token_encrypted   TEXT,
  default_role                  ENUM('owner','editor','analyst','viewer') NOT NULL DEFAULT 'viewer',
  domain_lock                   VARCHAR(255),
  enforce_sso                   TINYINT(1)   NOT NULL DEFAULT 0,
  status                        ENUM('active','testing','disabled') NOT NULL DEFAULT 'testing',
  created_at                    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                    DATETIME     NULL,
  INDEX idx_workspace (workspace_id),
  INDEX idx_status (status),
  CONSTRAINT fk_sso_workspace FOREIGN KEY (workspace_id) REFERENCES core_workspaces(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE core_feature_flags (
  id            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id  CHAR(36),                                  -- NULL = global flag
  flag_key      VARCHAR(100) NOT NULL,
  enabled       TINYINT(1)   NOT NULL DEFAULT 0,
  value         JSON,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_workspace_flag (workspace_id, flag_key),
  INDEX idx_flag (flag_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE core_support_tickets (
  id            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id  CHAR(36)     NOT NULL,
  user_id       CHAR(36)     NOT NULL,
  subject       VARCHAR(255) NOT NULL,
  body          TEXT         NOT NULL,
  category      VARCHAR(50),
  priority      ENUM('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
  status        ENUM('open','pending','resolved','closed') NOT NULL DEFAULT 'open',
  assigned_to   CHAR(36),
  resolved_at   DATETIME,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    DATETIME     NULL,
  INDEX idx_workspace_status (workspace_id, status),
  INDEX idx_user (user_id),
  INDEX idx_priority_status (priority, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Cross-cutting tables owned by marketing-core

```sql
CREATE TABLE core_outbox (
  id            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  aggregate     VARCHAR(100) NOT NULL,
  aggregate_id  CHAR(36)     NOT NULL,
  event_type    VARCHAR(100) NOT NULL,
  payload       JSON         NOT NULL,
  status        ENUM('pending','processing','published','failed') NOT NULL DEFAULT 'pending',
  attempts      INT          NOT NULL DEFAULT 0,
  last_error    TEXT,
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  published_at  DATETIME(3),
  INDEX idx_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE core_idempotency_keys (
  id            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  key_hash      VARCHAR(64)  NOT NULL,
  response_body JSON,
  status_code   INT,
  expires_at    DATETIME     NOT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_key_hash (key_hash),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE core_dsar_requests (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36),
  user_id         CHAR(36),
  email           VARCHAR(255) NOT NULL,
  request_type    ENUM('access','erasure','restriction','portability') NOT NULL,
  status          ENUM('pending_verify','verified','processing','completed','rejected') NOT NULL DEFAULT 'pending_verify',
  reason          TEXT,
  export_url      VARCHAR(500),
  completed_at    DATETIME,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_workspace (workspace_id),
  INDEX idx_email (email),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE core_consent_log (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  subscriber_id   CHAR(36),
  email_or_phone  VARCHAR(255),
  channel         ENUM('email','sms','push','whatsapp','cookies') NOT NULL,
  consent_type    ENUM('subscribe','unsubscribe','double_opt_in_confirm','preference_update','revoke') NOT NULL,
  source_url      VARCHAR(2048),
  ip_address      VARCHAR(45),
  user_agent      VARCHAR(500),
  consent_text    TEXT,
  occurred_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_workspace_subscriber (workspace_id, subscriber_id),
  INDEX idx_email_phone (email_or_phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## seo-engine (seo_*)

### seo_keywords + seo_clusters + seo_rankings

```sql
CREATE TABLE seo_clusters (
  id            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id  CHAR(36)     NOT NULL,
  cluster_name  VARCHAR(255) NOT NULL,
  intent        ENUM('informational','commercial','transactional','navigational'),
  description   TEXT,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    DATETIME     NULL,
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE seo_keywords (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  keyword         VARCHAR(500) NOT NULL,
  search_volume   INT,
  difficulty      TINYINT,
  cpc             DECIMAL(6,2),
  intent          ENUM('informational','commercial','transactional','navigational'),
  country         CHAR(2),
  language        CHAR(5),
  source          ENUM('manual','ai_suggested','competitor_stolen','keyword_research'),
  cluster_id      CHAR(36),
  status          ENUM('tracking','paused','archived') NOT NULL DEFAULT 'tracking',
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME     NULL,
  UNIQUE KEY uk_workspace_keyword (workspace_id, keyword(255), country, language),
  INDEX idx_workspace (workspace_id),
  INDEX idx_cluster (cluster_id),
  INDEX idx_status (status),
  FULLTEXT KEY ft_keyword (keyword)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE seo_rankings (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  keyword_id      CHAR(36)     NOT NULL,
  workspace_id    CHAR(36)     NOT NULL,
  domain          VARCHAR(255) NOT NULL,
  position        TINYINT,
  prev_position   TINYINT,
  url             VARCHAR(2048),
  search_engine   ENUM('google','bing') NOT NULL DEFAULT 'google',
  device          ENUM('desktop','mobile') NOT NULL DEFAULT 'desktop',
  date            DATE         NOT NULL,
  INDEX idx_keyword_date (keyword_id, date),
  INDEX idx_workspace_date (workspace_id, date),
  CONSTRAINT fk_rankings_keyword FOREIGN KEY (keyword_id) REFERENCES seo_keywords(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Production: partition by month on `date`
```

### seo_audits + seo_audit_issues

```sql
CREATE TABLE seo_audits (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  domain          VARCHAR(255) NOT NULL,
  status          ENUM('queued','running','completed','failed') NOT NULL DEFAULT 'queued',
  overall_score   TINYINT,
  pages_crawled   INT          NOT NULL DEFAULT 0,
  pages_total     INT,
  issues_critical INT          NOT NULL DEFAULT 0,
  issues_warning  INT          NOT NULL DEFAULT 0,
  issues_info     INT          NOT NULL DEFAULT 0,
  started_at      DATETIME,
  completed_at    DATETIME,
  error_message   TEXT,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME     NULL,
  INDEX idx_workspace (workspace_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE seo_audit_issues (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  audit_id        CHAR(36)     NOT NULL,
  workspace_id    CHAR(36)     NOT NULL,
  url             VARCHAR(2048),
  issue_type      VARCHAR(100),
  severity        ENUM('critical','warning','info') NOT NULL,
  description     TEXT,
  recommendation  TEXT,
  auto_fixable    TINYINT(1)   NOT NULL DEFAULT 0,
  fixed           TINYINT(1)   NOT NULL DEFAULT 0,
  fixed_at        DATETIME,
  INDEX idx_audit_severity (audit_id, severity),
  INDEX idx_workspace_type (workspace_id, issue_type),
  CONSTRAINT fk_issues_audit FOREIGN KEY (audit_id) REFERENCES seo_audits(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### seo_backlinks + seo_serp_snapshots + seo_local_listings + seo_app_listings

```sql
CREATE TABLE seo_backlinks (
  id                CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id      CHAR(36)     NOT NULL,
  source_url        VARCHAR(2048) NOT NULL,
  target_url        VARCHAR(2048) NOT NULL,
  anchor_text       VARCHAR(500),
  source_domain     VARCHAR(255),
  domain_authority  INT,
  domain_rating     INT,
  do_follow         TINYINT(1)   NOT NULL DEFAULT 1,
  toxic_score       TINYINT,
  status            ENUM('active','lost','broken') NOT NULL DEFAULT 'active',
  first_seen        DATE,
  last_checked      DATE,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        DATETIME     NULL,
  UNIQUE KEY uk_source_target (source_url(255), target_url(255)),
  INDEX idx_workspace (workspace_id),
  INDEX idx_source_domain (source_domain),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE seo_serp_snapshots (
  id                CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  keyword_id        CHAR(36)     NOT NULL,
  workspace_id      CHAR(36)     NOT NULL,
  date              DATE         NOT NULL,
  results           JSON,
  featured_snippet  JSON,
  people_also_ask   JSON,
  INDEX idx_keyword_date (keyword_id, date),
  CONSTRAINT fk_serp_keyword FOREIGN KEY (keyword_id) REFERENCES seo_keywords(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE seo_local_listings (
  id                  CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id        CHAR(36)     NOT NULL,
  gmb_location_id     VARCHAR(255),
  name                VARCHAR(255),
  address             JSON,
  phone               VARCHAR(50),
  website             VARCHAR(500),
  categories          JSON,
  hours               JSON,
  status              ENUM('active','suspended','verified','unverified') NOT NULL DEFAULT 'unverified',
  rating              DECIMAL(3,2),
  reviews_count       INT,
  last_synced_at      DATETIME,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at          DATETIME     NULL,
  INDEX idx_workspace (workspace_id),
  INDEX idx_gmb (gmb_location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE seo_app_listings (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  platform        ENUM('ios_app_store','google_play') NOT NULL,
  app_id          VARCHAR(255),
  title           VARCHAR(255),
  subtitle        VARCHAR(255),
  description     TEXT,
  keywords        TEXT,
  rating          DECIMAL(3,2),
  ratings_count   INT,
  ranking         INT,
  aso_score       TINYINT,
  last_synced     DATETIME,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME     NULL,
  INDEX idx_workspace_platform (workspace_id, platform)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## content-ai (content_*)

```sql
CREATE TABLE content_brand_voices (
  id                    CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id          CHAR(36)     NOT NULL,
  name                  VARCHAR(100) NOT NULL,
  description           TEXT,
  sample_texts          JSON,
  extracted_attributes  JSON,
  system_preamble       TEXT,
  is_default            TINYINT(1)   NOT NULL DEFAULT 0,
  trained_at            DATETIME,
  created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at            DATETIME     NULL,
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE content_pieces (
  id                  CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id        CHAR(36)     NOT NULL,
  campaign_id         CHAR(36),
  brand_voice_id      CHAR(36),
  title               VARCHAR(500),
  body                LONGTEXT,
  content_type        ENUM('blog_post','landing_page','social_post','email_body','ad_copy','press_release','product_description','video_script','lead_magnet') NOT NULL,
  status              ENUM('draft','review','approved','scheduled','published','archived') NOT NULL DEFAULT 'draft',
  seo_score           TINYINT,
  readability_score   TINYINT,
  word_count          INT,
  target_keyword      VARCHAR(255),
  language_code       CHAR(5)      NOT NULL DEFAULT 'en',
  ai_generated        TINYINT(1)   NOT NULL DEFAULT 0,
  ai_provider         ENUM('openai','claude','gemini'),
  ai_model            VARCHAR(50),
  prompt_version      VARCHAR(20),
  validation_passed   TINYINT(1)   NOT NULL DEFAULT 1,
  validation_errors   JSON,
  parent_content_id   CHAR(36),
  created_by          CHAR(36),
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at          DATETIME     NULL,
  INDEX idx_workspace_type (workspace_id, content_type),
  INDEX idx_status (status),
  INDEX idx_campaign (campaign_id),
  FULLTEXT KEY ft_title (title)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE content_versions (
  id            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  content_id    CHAR(36)     NOT NULL,
  version_num   INT          NOT NULL,
  body          LONGTEXT,
  changed_by    CHAR(36),
  change_note   VARCHAR(500),
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_content_version (content_id, version_num),
  CONSTRAINT fk_versions_content FOREIGN KEY (content_id) REFERENCES content_pieces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE content_schedule (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  content_id      CHAR(36)     NOT NULL,
  channel         ENUM('blog','email','social','linkedin','twitter','instagram','facebook','tiktok','youtube') NOT NULL,
  scheduled_at    DATETIME     NOT NULL,
  published_at    DATETIME,
  status          ENUM('scheduled','publishing','published','failed','cancelled') NOT NULL DEFAULT 'scheduled',
  external_id     VARCHAR(255),
  failure_reason  TEXT,
  INDEX idx_scheduled (status, scheduled_at),
  INDEX idx_workspace (workspace_id),
  CONSTRAINT fk_schedule_content FOREIGN KEY (content_id) REFERENCES content_pieces(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE content_plagiarism_checks (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  content_id      CHAR(36)     NOT NULL,
  workspace_id    CHAR(36)     NOT NULL,
  score           DECIMAL(5,2),
  matches         JSON,
  provider        VARCHAR(50),
  checked_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_content (content_id),
  INDEX idx_workspace (workspace_id),
  CONSTRAINT fk_plagi_content FOREIGN KEY (content_id) REFERENCES content_pieces(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE content_translations (
  id                  CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  content_id          CHAR(36)     NOT NULL,
  workspace_id        CHAR(36)     NOT NULL,
  language_code       CHAR(5)      NOT NULL,
  translated_title    VARCHAR(500),
  translated_body     LONGTEXT,
  ai_provider         VARCHAR(50),
  status              ENUM('pending','completed','failed') NOT NULL DEFAULT 'pending',
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_content_lang (content_id, language_code),
  CONSTRAINT fk_trans_content FOREIGN KEY (content_id) REFERENCES content_pieces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE content_press_releases (
  id                  CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id        CHAR(36)     NOT NULL,
  content_id          CHAR(36),
  title               VARCHAR(500) NOT NULL,
  body                LONGTEXT,
  distribution_target ENUM('pr_newswire','business_wire','manual') NOT NULL DEFAULT 'pr_newswire',
  status              ENUM('draft','submitted','distributed','failed') NOT NULL DEFAULT 'draft',
  external_id         VARCHAR(255),
  distributed_at      DATETIME,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at          DATETIME     NULL,
  INDEX idx_workspace (workspace_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE content_lead_magnets (
  id                  CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id        CHAR(36)     NOT NULL,
  title               VARCHAR(255) NOT NULL,
  description         TEXT,
  type                ENUM('ebook','checklist','template','swipe_file','webinar','course'),
  storage_key         VARCHAR(500),
  download_count      INT          NOT NULL DEFAULT 0,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at          DATETIME     NULL,
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## campaign-manager (campaign_*)

```sql
CREATE TABLE campaign_campaigns (
  id                  CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id        CHAR(36)     NOT NULL,
  name                VARCHAR(255) NOT NULL,
  type                ENUM('seo','ppc','email','social','multi_channel','aso','webinar') NOT NULL,
  status              ENUM('draft','active','paused','completed','archived') NOT NULL DEFAULT 'draft',
  objective           ENUM('awareness','traffic','leads','sales','retention','app_installs'),
  budget              DECIMAL(12,2),
  budget_period       ENUM('daily','weekly','monthly','total'),
  start_date          DATE,
  end_date            DATE,
  goal_type           VARCHAR(100),
  goal_value          DECIMAL(12,2),
  ai_generated        TINYINT(1)   NOT NULL DEFAULT 0,
  oneclick_job_id     CHAR(36),
  metadata            JSON,
  created_by          CHAR(36),
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at          DATETIME     NULL,
  INDEX idx_workspace_status (workspace_id, status),
  INDEX idx_dates (start_date, end_date),
  INDEX idx_oneclick (oneclick_job_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE campaign_channels (
  id                  CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id        CHAR(36)     NOT NULL,
  campaign_id         CHAR(36)     NOT NULL,
  channel             ENUM('google_ads','meta','linkedin','twitter','tiktok','email','sms','push','organic_seo','organic_social','influencer') NOT NULL,
  status              ENUM('draft','pending','active','paused','completed','failed') NOT NULL DEFAULT 'draft',
  budget_allocated    DECIMAL(12,2),
  spent               DECIMAL(12,2) NOT NULL DEFAULT 0,
  external_id         VARCHAR(255),
  config              JSON,
  last_synced_at      DATETIME,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at          DATETIME     NULL,
  INDEX idx_campaign (campaign_id),
  INDEX idx_channel_status (channel, status),
  CONSTRAINT fk_chan_campaign FOREIGN KEY (campaign_id) REFERENCES campaign_campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE campaign_metrics (
  id                  CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  campaign_channel_id CHAR(36)     NOT NULL,
  workspace_id        CHAR(36)     NOT NULL,
  date                DATE         NOT NULL,
  impressions         BIGINT       NOT NULL DEFAULT 0,
  clicks              INT          NOT NULL DEFAULT 0,
  conversions         INT          NOT NULL DEFAULT 0,
  spend               DECIMAL(12,2) NOT NULL DEFAULT 0,
  revenue             DECIMAL(12,2) NOT NULL DEFAULT 0,
  ctr                 DECIMAL(6,4),
  cpc                 DECIMAL(8,2),
  cpa                 DECIMAL(8,2),
  roas                DECIMAL(6,2),
  UNIQUE KEY uk_channel_date (campaign_channel_id, date),
  INDEX idx_workspace_date (workspace_id, date),
  CONSTRAINT fk_metrics_channel FOREIGN KEY (campaign_channel_id) REFERENCES campaign_channels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE campaign_ad_creatives (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  campaign_id     CHAR(36)     NOT NULL,
  channel         VARCHAR(50),
  type            ENUM('image','video','carousel','text','responsive_search') NOT NULL,
  headline        VARCHAR(500),
  body            TEXT,
  cta             VARCHAR(100),
  asset_storage_keys JSON,
  external_id     VARCHAR(255),
  status          ENUM('draft','approved','rejected','active','paused') NOT NULL DEFAULT 'draft',
  performance     JSON,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME     NULL,
  INDEX idx_campaign (campaign_id),
  CONSTRAINT fk_creative_campaign FOREIGN KEY (campaign_id) REFERENCES campaign_campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE campaign_landing_pages (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  campaign_id     CHAR(36),
  slug            VARCHAR(100) NOT NULL,
  title           VARCHAR(255),
  html_content    LONGTEXT,
  json_design     JSON,
  status          ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  visits          INT          NOT NULL DEFAULT 0,
  conversions     INT          NOT NULL DEFAULT 0,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME     NULL,
  UNIQUE KEY uk_slug (slug),
  INDEX idx_workspace (workspace_id),
  INDEX idx_campaign (campaign_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE campaign_utm_links (
  id              CHAR(36)      NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)      NOT NULL,
  campaign_id     CHAR(36),
  original_url    VARCHAR(2048) NOT NULL,
  utm_source      VARCHAR(100),
  utm_medium      VARCHAR(100),
  utm_campaign    VARCHAR(100),
  utm_content     VARCHAR(100),
  utm_term        VARCHAR(100),
  short_code      VARCHAR(20),
  clicks          INT           NOT NULL DEFAULT 0,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at      DATETIME      NULL,
  UNIQUE KEY uk_short_code (short_code),
  INDEX idx_workspace (workspace_id),
  INDEX idx_campaign (campaign_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE campaign_retargeting_pixels (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  platform        ENUM('meta','google_ads','linkedin','tiktok','twitter') NOT NULL,
  pixel_id        VARCHAR(255),
  snippet         TEXT,
  pages_fired     JSON,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME     NULL,
  INDEX idx_workspace_platform (workspace_id, platform)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE campaign_webinars (
  id                  CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id        CHAR(36)     NOT NULL,
  campaign_id         CHAR(36),
  title               VARCHAR(255) NOT NULL,
  description         TEXT,
  slug                VARCHAR(100),
  speaker_bio         TEXT,
  starts_at           DATETIME     NOT NULL,
  duration_minutes    INT,
  zoom_meeting_id     VARCHAR(100),
  replay_url          VARCHAR(500),
  registration_count  INT          NOT NULL DEFAULT 0,
  attendance_count    INT          NOT NULL DEFAULT 0,
  status              ENUM('scheduled','live','completed','cancelled') NOT NULL DEFAULT 'scheduled',
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at          DATETIME     NULL,
  UNIQUE KEY uk_slug (slug),
  INDEX idx_workspace (workspace_id),
  INDEX idx_starts (starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE campaign_webinar_registrants (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  webinar_id      CHAR(36)     NOT NULL,
  workspace_id    CHAR(36)     NOT NULL,
  email           VARCHAR(255) NOT NULL,
  first_name      VARCHAR(100),
  last_name       VARCHAR(100),
  registered_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  attended        TINYINT(1)   NOT NULL DEFAULT 0,
  watch_minutes   INT,
  INDEX idx_webinar (webinar_id),
  INDEX idx_email (email),
  CONSTRAINT fk_reg_webinar FOREIGN KEY (webinar_id) REFERENCES campaign_webinars(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE campaign_oneclick_jobs (
  id                  CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id        CHAR(36)     NOT NULL,
  initiated_by        CHAR(36),
  input_url           VARCHAR(2048),
  input_description   TEXT,
  industry_hint       VARCHAR(100),
  status              ENUM('queued','running','completed','failed','cancelled') NOT NULL DEFAULT 'queued',
  current_step        TINYINT,
  total_credits_used  INT          NOT NULL DEFAULT 0,
  total_cost_usd      DECIMAL(8,2) NOT NULL DEFAULT 0,
  campaign_id         CHAR(36),
  started_at          DATETIME,
  completed_at        DATETIME,
  failure_reason      TEXT,
  idempotency_key     VARCHAR(100),
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_workspace (workspace_id),
  INDEX idx_status (status),
  INDEX idx_idempotency (idempotency_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE campaign_oneclick_steps (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  job_id          CHAR(36)     NOT NULL,
  step_num        TINYINT      NOT NULL,
  step_name       VARCHAR(100),
  status          ENUM('pending','running','completed','failed','skipped') NOT NULL DEFAULT 'pending',
  input           JSON,
  output          JSON,
  duration_ms     INT,
  credits_used    INT,
  cost_usd        DECIMAL(8,4),
  started_at      DATETIME,
  completed_at    DATETIME,
  failure_reason  TEXT,
  UNIQUE KEY uk_job_step (job_id, step_num),
  INDEX idx_job (job_id),
  CONSTRAINT fk_step_job FOREIGN KEY (job_id) REFERENCES campaign_oneclick_jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## analytics-engine (analytics_*)

```sql
CREATE TABLE analytics_events (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  visitor_id      VARCHAR(36),
  session_id      VARCHAR(36),
  user_id         CHAR(36),
  event_type      VARCHAR(50)  NOT NULL,
  url             VARCHAR(2048),
  referrer        VARCHAR(2048),
  utm_source      VARCHAR(100),
  utm_medium      VARCHAR(100),
  utm_campaign    VARCHAR(100),
  utm_content     VARCHAR(100),
  utm_term        VARCHAR(100),
  country_code    CHAR(2),
  city            VARCHAR(100),
  device_type     ENUM('desktop','mobile','tablet'),
  browser         VARCHAR(50),
  os              VARCHAR(50),
  custom_data     JSON,
  revenue         DECIMAL(12,2),
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_workspace_time (workspace_id, created_at),
  INDEX idx_session (session_id),
  INDEX idx_visitor (visitor_id),
  INDEX idx_utm (utm_campaign, utm_source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Production: partition by week on `created_at`; 30-day TTL via partition drop

CREATE TABLE analytics_conversion_goals (
  id            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id  CHAR(36)     NOT NULL,
  name          VARCHAR(255) NOT NULL,
  type          ENUM('pageview','event','revenue','custom') NOT NULL,
  conditions    JSON,
  value         DECIMAL(12,2),
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    DATETIME     NULL,
  INDEX idx_workspace_active (workspace_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE analytics_funnels (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  date_range_days INT          NOT NULL DEFAULT 30,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME     NULL,
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE analytics_funnel_steps (
  id            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  funnel_id     CHAR(36)     NOT NULL,
  step_order    INT          NOT NULL,
  step_name     VARCHAR(255) NOT NULL,
  conditions    JSON         NOT NULL,
  UNIQUE KEY uk_funnel_order (funnel_id, step_order),
  CONSTRAINT fk_funnelstep_funnel FOREIGN KEY (funnel_id) REFERENCES analytics_funnels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE analytics_ab_tests (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  name            VARCHAR(255) NOT NULL,
  variants        JSON         NOT NULL,
  metric          VARCHAR(100),
  min_sample_size INT          NOT NULL DEFAULT 100,
  status          ENUM('draft','running','concluded','cancelled') NOT NULL DEFAULT 'draft',
  winner          VARCHAR(50),
  confidence      DECIMAL(5,2),
  started_at      DATETIME,
  concluded_at    DATETIME,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME     NULL,
  INDEX idx_workspace_status (workspace_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE analytics_ab_assignments (
  id            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  test_id       CHAR(36)     NOT NULL,
  visitor_id    VARCHAR(36)  NOT NULL,
  variant       VARCHAR(50)  NOT NULL,
  assigned_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  converted     TINYINT(1)   NOT NULL DEFAULT 0,
  UNIQUE KEY uk_test_visitor (test_id, visitor_id),
  INDEX idx_test_variant (test_id, variant),
  CONSTRAINT fk_assign_test FOREIGN KEY (test_id) REFERENCES analytics_ab_tests(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE analytics_heatmap_sessions (
  id            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id  CHAR(36)     NOT NULL,
  url           VARCHAR(2048),
  visitor_id    VARCHAR(36),
  duration_sec  INT,
  storage_key   VARCHAR(500),
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_workspace (workspace_id),
  INDEX idx_visitor (visitor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE analytics_reports (
  id            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id  CHAR(36)     NOT NULL,
  name          VARCHAR(255) NOT NULL,
  config        JSON         NOT NULL,
  schedule      VARCHAR(50),
  format        ENUM('pdf','csv','dashboard') NOT NULL DEFAULT 'dashboard',
  last_run      DATETIME,
  last_storage_key VARCHAR(500),
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    DATETIME     NULL,
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE analytics_predictions (
  id            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id  CHAR(36)     NOT NULL,
  contact_id    CHAR(36),
  prediction_type ENUM('ltv','churn','next_purchase','engagement') NOT NULL,
  value         DECIMAL(12,4),
  confidence    DECIMAL(5,2),
  computed_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_workspace_type (workspace_id, prediction_type),
  INDEX idx_contact (contact_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## social-hub (social_*)

```sql
CREATE TABLE social_accounts (
  id                              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id                    CHAR(36)     NOT NULL,
  platform                        ENUM('instagram','facebook','twitter','linkedin','tiktok','youtube','pinterest') NOT NULL,
  account_id                      VARCHAR(255),
  account_name                    VARCHAR(255),
  username                        VARCHAR(255),
  oauth_access_token_encrypted    TEXT,
  oauth_refresh_token_encrypted   TEXT,
  oauth_expires_at                DATETIME,
  oauth_scopes                    JSON,
  followers                       INT,
  following                       INT,
  posts_count                     INT,
  status                          ENUM('connected','expired','revoked','error') NOT NULL DEFAULT 'connected',
  connected_at                    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_synced_at                  DATETIME,
  deleted_at                      DATETIME     NULL,
  UNIQUE KEY uk_workspace_account (workspace_id, platform, account_id),
  INDEX idx_workspace_platform (workspace_id, platform),
  INDEX idx_token_expiry (oauth_expires_at),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE social_posts (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  account_id      CHAR(36)     NOT NULL,
  content_id      CHAR(36),
  campaign_id     CHAR(36),
  platform        ENUM('instagram','facebook','twitter','linkedin','tiktok','youtube','pinterest') NOT NULL,
  body            TEXT,
  media_keys      JSON,
  hashtags        JSON,
  mentions        JSON,
  link            VARCHAR(2048),
  scheduled_at    DATETIME,
  published_at    DATETIME,
  status          ENUM('draft','scheduled','publishing','published','failed','deleted') NOT NULL DEFAULT 'draft',
  external_id     VARCHAR(255),
  external_url    VARCHAR(500),
  engagement      JSON,
  failure_reason  TEXT,
  created_by      CHAR(36),
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at      DATETIME     NULL,
  INDEX idx_workspace (workspace_id),
  INDEX idx_account (account_id),
  INDEX idx_scheduled (status, scheduled_at),
  CONSTRAINT fk_posts_account FOREIGN KEY (account_id) REFERENCES social_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE social_metrics (
  id                CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  social_account_id CHAR(36) NOT NULL,
  workspace_id      CHAR(36) NOT NULL,
  date              DATE     NOT NULL,
  followers         INT,
  reach             INT,
  impressions       INT,
  engagement_rate   DECIMAL(6,4),
  posts_count       INT,
  UNIQUE KEY uk_account_date (social_account_id, date),
  INDEX idx_workspace_date (workspace_id, date),
  CONSTRAINT fk_smetrics_account FOREIGN KEY (social_account_id) REFERENCES social_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE social_listeners (
  id            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id  CHAR(36)     NOT NULL,
  name          VARCHAR(255),
  keywords      JSON         NOT NULL,
  platforms     JSON,
  status        ENUM('active','paused') NOT NULL DEFAULT 'active',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    DATETIME     NULL,
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE social_mentions (
  id                CHAR(36)      NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id      CHAR(36)      NOT NULL,
  listener_id       CHAR(36)      NOT NULL,
  platform          VARCHAR(50),
  mention_url       VARCHAR(2048),
  author_username   VARCHAR(255),
  author_followers  INT,
  body              TEXT,
  sentiment         ENUM('positive','neutral','negative'),
  sentiment_score   DECIMAL(4,3),
  language          CHAR(5),
  posted_at         DATETIME,
  detected_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_workspace_detected (workspace_id, detected_at),
  INDEX idx_sentiment (sentiment),
  INDEX idx_listener (listener_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE social_hashtag_research (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  hashtag         VARCHAR(100) NOT NULL,
  platform        ENUM('instagram','twitter','tiktok','linkedin') NOT NULL,
  post_count      BIGINT,
  weekly_trend    DECIMAL(6,2),
  related         JSON,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_workspace_hashtag (workspace_id, hashtag, platform),
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE social_community_posts (
  id            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id  CHAR(36)     NOT NULL,
  community_type ENUM('facebook_group','discord','slack','telegram') NOT NULL,
  external_id   VARCHAR(255),
  body          TEXT,
  scheduled_at  DATETIME,
  published_at  DATETIME,
  status        ENUM('draft','scheduled','published','failed') NOT NULL DEFAULT 'draft',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at    DATETIME     NULL,
  INDEX idx_workspace (workspace_id),
  INDEX idx_scheduled (status, scheduled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## email-hub (email_*)

```sql
CREATE TABLE email_lists (
  id                CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id      CHAR(36)     NOT NULL,
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  subscriber_count  INT          NOT NULL DEFAULT 0,
  tags              JSON,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        DATETIME     NULL,
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  email_status    ENUM('subscribed','unsubscribed','bounced','complained','pending') NOT NULL DEFAULT 'pending',
  sms_status      ENUM('subscribed','unsubscribed','pending') NOT NULL DEFAULT 'pending',
  push_status     ENUM('subscribed','unsubscribed','pending') NOT NULL DEFAULT 'pending',
  whatsapp_status ENUM('subscribed','unsubscribed','pending') NOT NULL DEFAULT 'pending',
  timezone        VARCHAR(50),
  language        CHAR(5)      NOT NULL DEFAULT 'en',
  opt_in_source   VARCHAR(100),
  opt_in_ip       VARCHAR(45),
  subscribed_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unsubscribed_at DATETIME,
  last_email_opened_at DATETIME,
  deleted_at      DATETIME     NULL,
  UNIQUE KEY uk_list_email (list_id, email),
  INDEX idx_workspace_email (workspace_id, email),
  INDEX idx_email_status (email_status),
  INDEX idx_phone (phone),
  CONSTRAINT fk_subs_list FOREIGN KEY (list_id) REFERENCES email_lists(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE email_templates (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  name            VARCHAR(255) NOT NULL,
  category        VARCHAR(50),
  json_design     JSON,
  html_content    LONGTEXT,
  thumbnail_url   VARCHAR(500),
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME     NULL,
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE email_campaigns (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  list_id         CHAR(36),
  name            VARCHAR(255) NOT NULL,
  subject         VARCHAR(255),
  from_name       VARCHAR(255),
  from_email      VARCHAR(255),
  reply_to        VARCHAR(255),
  template_id     CHAR(36),
  html_content    LONGTEXT,
  status          ENUM('draft','scheduled','sending','sent','cancelled') NOT NULL DEFAULT 'draft',
  scheduled_at    DATETIME,
  sent_at         DATETIME,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME     NULL,
  INDEX idx_workspace_status (workspace_id, status),
  INDEX idx_scheduled (status, scheduled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE email_metrics (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  campaign_id     CHAR(36)     NOT NULL,
  workspace_id    CHAR(36)     NOT NULL,
  sent            INT          NOT NULL DEFAULT 0,
  delivered       INT          NOT NULL DEFAULT 0,
  opens           INT          NOT NULL DEFAULT 0,
  unique_opens    INT          NOT NULL DEFAULT 0,
  clicks          INT          NOT NULL DEFAULT 0,
  unique_clicks   INT          NOT NULL DEFAULT 0,
  bounces         INT          NOT NULL DEFAULT 0,
  unsubscribes    INT          NOT NULL DEFAULT 0,
  complaints      INT          NOT NULL DEFAULT 0,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_campaign (campaign_id),
  CONSTRAINT fk_metrics_campaign FOREIGN KEY (campaign_id) REFERENCES email_campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE email_events (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  campaign_id     CHAR(36),
  subscriber_id   CHAR(36)     NOT NULL,
  event_type      ENUM('sent','delivered','opened','clicked','bounced','unsubscribed','complained','dropped','deferred') NOT NULL,
  event_data      JSON,
  ip              VARCHAR(45),
  user_agent      VARCHAR(500),
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_workspace_time (workspace_id, created_at),
  INDEX idx_subscriber (subscriber_id),
  INDEX idx_campaign_type (campaign_id, event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE email_suppression (
  id            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id  CHAR(36),
  email_hash    VARCHAR(64)  NOT NULL,
  reason        ENUM('unsubscribe','bounce','complaint','rtbf') NOT NULL,
  added_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_workspace_hash (workspace_id, email_hash),
  INDEX idx_email_hash (email_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE email_drip_sequences (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  name            VARCHAR(255) NOT NULL,
  channel         ENUM('email','sms','push','whatsapp','multi') NOT NULL DEFAULT 'email',
  trigger_event   VARCHAR(100),
  trigger_config  JSON,
  status          ENUM('draft','active','paused') NOT NULL DEFAULT 'draft',
  re_enrollment   ENUM('never','always','after_completion') NOT NULL DEFAULT 'never',
  created_by      CHAR(36),
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at      DATETIME     NULL,
  INDEX idx_workspace_status (workspace_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE email_drip_steps (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  sequence_id     CHAR(36)     NOT NULL,
  step_num        INT          NOT NULL,
  delay_minutes   INT,
  channel         ENUM('email','sms','push','whatsapp') NOT NULL,
  template_id     CHAR(36),
  subject         VARCHAR(255),
  body            TEXT,
  condition       JSON,
  UNIQUE KEY uk_sequence_step (sequence_id, step_num),
  CONSTRAINT fk_step_sequence FOREIGN KEY (sequence_id) REFERENCES email_drip_sequences(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE email_drip_enrollments (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  sequence_id     CHAR(36)     NOT NULL,
  subscriber_id   CHAR(36)     NOT NULL,
  current_step    INT          NOT NULL DEFAULT 0,
  status          ENUM('active','completed','exited','failed') NOT NULL DEFAULT 'active',
  enrolled_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  next_action_at  DATETIME,
  completed_at    DATETIME,
  exit_reason     VARCHAR(255),
  context         JSON,
  INDEX idx_next_action (status, next_action_at),
  INDEX idx_subscriber_sequence (subscriber_id, sequence_id),
  CONSTRAINT fk_enroll_sequence FOREIGN KEY (sequence_id) REFERENCES email_drip_sequences(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE email_sms_campaigns (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  name            VARCHAR(255) NOT NULL,
  body            VARCHAR(1600) NOT NULL,
  sender_id       VARCHAR(50),
  list_id         CHAR(36),
  status          ENUM('draft','scheduled','sending','sent') NOT NULL DEFAULT 'draft',
  scheduled_at    DATETIME,
  sent_at         DATETIME,
  total_sent      INT          NOT NULL DEFAULT 0,
  total_delivered INT          NOT NULL DEFAULT 0,
  total_failed    INT          NOT NULL DEFAULT 0,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME     NULL,
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE email_push_campaigns (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  title           VARCHAR(255) NOT NULL,
  body            VARCHAR(500),
  icon_url        VARCHAR(500),
  action_url      VARCHAR(2048),
  audience        JSON,
  status          ENUM('draft','scheduled','sent') NOT NULL DEFAULT 'draft',
  scheduled_at    DATETIME,
  sent_at         DATETIME,
  total_sent      INT,
  total_opened    INT,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME     NULL,
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE email_whatsapp_campaigns (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  name            VARCHAR(255) NOT NULL,
  template_name   VARCHAR(255),
  body            TEXT,
  media_key       VARCHAR(500),
  list_id         CHAR(36),
  status          ENUM('draft','approved','scheduled','sending','sent') NOT NULL DEFAULT 'draft',
  scheduled_at    DATETIME,
  sent_at         DATETIME,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME     NULL,
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## intelligence (intel_*)

```sql
CREATE TABLE intel_competitors (
  id                          CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id                CHAR(36)     NOT NULL,
  domain                      VARCHAR(255) NOT NULL,
  name                        VARCHAR(255),
  industry                    VARCHAR(100),
  manually_added              TINYINT(1)   NOT NULL DEFAULT 0,
  ai_discovered               TINYINT(1)   NOT NULL DEFAULT 0,
  monthly_traffic_estimate    INT,
  traffic_sources             JSON,
  top_keywords                JSON,
  tech_stack                  JSON,
  last_analysed               DATETIME,
  status                      ENUM('active','archived') NOT NULL DEFAULT 'active',
  created_at                  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at                  DATETIME     NULL,
  UNIQUE KEY uk_workspace_domain (workspace_id, domain),
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE intel_competitor_ads (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  competitor_id   CHAR(36)     NOT NULL,
  platform        ENUM('meta_ad_library','google_transparency','linkedin_ad_library','tiktok_ad_library') NOT NULL,
  ad_external_id  VARCHAR(255),
  headline        VARCHAR(500),
  body            TEXT,
  cta             VARCHAR(100),
  landing_url     VARCHAR(2048),
  asset_storage_keys JSON,
  format          ENUM('image','video','carousel','text'),
  first_seen      DATE,
  last_seen       DATE,
  active          TINYINT(1)   NOT NULL DEFAULT 1,
  metadata        JSON,
  INDEX idx_competitor (competitor_id),
  INDEX idx_platform_seen (platform, last_seen),
  CONSTRAINT fk_ads_competitor FOREIGN KEY (competitor_id) REFERENCES intel_competitors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE intel_price_monitors (
  id                  CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id        CHAR(36)     NOT NULL,
  competitor_id       CHAR(36),
  url                 VARCHAR(2048) NOT NULL,
  product_name        VARCHAR(255),
  css_selector        VARCHAR(500),
  current_price       DECIMAL(12,2),
  currency            CHAR(3)      NOT NULL DEFAULT 'GBP',
  prev_price          DECIMAL(12,2),
  changed_at          DATETIME,
  last_checked_at     DATETIME,
  check_frequency_min INT          NOT NULL DEFAULT 60,
  status              ENUM('active','paused','failing') NOT NULL DEFAULT 'active',
  failure_count       INT          NOT NULL DEFAULT 0,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at          DATETIME     NULL,
  INDEX idx_workspace (workspace_id),
  INDEX idx_status_freq (status, last_checked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE intel_brand_mentions (
  id            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id  CHAR(36)     NOT NULL,
  brand_name    VARCHAR(255),
  source        VARCHAR(100),
  url           VARCHAR(2048),
  body          TEXT,
  sentiment     ENUM('positive','neutral','negative'),
  detected_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_workspace_time (workspace_id, detected_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE intel_market_share (
  id            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id  CHAR(36)     NOT NULL,
  date          DATE         NOT NULL,
  brand_domain  VARCHAR(255),
  traffic_estimate INT,
  keyword_overlap INT,
  share_percent DECIMAL(5,2),
  UNIQUE KEY uk_workspace_date_brand (workspace_id, date, brand_domain),
  INDEX idx_workspace_date (workspace_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE intel_autopilot_recommendations (
  id                CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id      CHAR(36)     NOT NULL,
  category          ENUM('seo','ppc','content','social','email','crm','general') NOT NULL,
  priority          ENUM('high','medium','low') NOT NULL DEFAULT 'medium',
  title             VARCHAR(255) NOT NULL,
  description       TEXT,
  recommended_action JSON,
  estimated_impact  JSON,
  status            ENUM('new','viewed','accepted','dismissed','expired') NOT NULL DEFAULT 'new',
  generated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at        DATETIME,
  acted_on_at       DATETIME,
  INDEX idx_workspace_status (workspace_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE intel_ai_usage (
  id                CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id      CHAR(36)     NOT NULL,
  user_id           CHAR(36),
  task              VARCHAR(50)  NOT NULL,
  provider_model    VARCHAR(50)  NOT NULL,
  prompt_version    VARCHAR(20),
  tokens_in         INT,
  tokens_out        INT,
  cost_usd          DECIMAL(10,6),
  latency_ms        INT,
  status            ENUM('success','failed','rate_limited','blocked_quota','blocked_safety') NOT NULL,
  request_hash      VARCHAR(64),
  occurred_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_workspace_time (workspace_id, occurred_at),
  INDEX idx_status (status),
  INDEX idx_provider_model (provider_model)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## affiliate-hub (affiliate_*)

```sql
CREATE TABLE affiliate_programs (
  id                          CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id                CHAR(36)     NOT NULL,
  name                        VARCHAR(255) NOT NULL,
  description                 TEXT,
  commission_type             ENUM('percent','flat','tiered') NOT NULL,
  commission_value            DECIMAL(8,2),
  cookie_days                 INT          NOT NULL DEFAULT 60,
  payout_threshold_gbp        DECIMAL(8,2) NOT NULL DEFAULT 50,
  approval_required           TINYINT(1)   NOT NULL DEFAULT 1,
  terms_url                   VARCHAR(2048),
  status                      ENUM('active','paused','closed') NOT NULL DEFAULT 'active',
  created_at                  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                  DATETIME     NULL,
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE affiliate_affiliates (
  id                            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id                  CHAR(36)     NOT NULL,
  program_id                    CHAR(36)     NOT NULL,
  user_id                       CHAR(36),
  name                          VARCHAR(255),
  email                         VARCHAR(255),
  company                       VARCHAR(255),
  country                       CHAR(2),
  stripe_connect_account_id     VARCHAR(255),
  stripe_kyc_status             ENUM('pending','verified','rejected','requires_action') NOT NULL DEFAULT 'pending',
  status                        ENUM('pending','approved','rejected','suspended') NOT NULL DEFAULT 'pending',
  total_clicks                  INT          NOT NULL DEFAULT 0,
  total_conversions             INT          NOT NULL DEFAULT 0,
  total_earned_gbp              DECIMAL(12,2) NOT NULL DEFAULT 0,
  unpaid_balance_gbp            DECIMAL(12,2) NOT NULL DEFAULT 0,
  fraud_score                   TINYINT      NOT NULL DEFAULT 0,
  approved_at                   DATETIME,
  created_at                    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at                    DATETIME     NULL,
  UNIQUE KEY uk_program_email (program_id, email),
  INDEX idx_workspace (workspace_id),
  INDEX idx_status (status),
  CONSTRAINT fk_aff_program FOREIGN KEY (program_id) REFERENCES affiliate_programs(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE affiliate_links (
  id              CHAR(36)      NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)      NOT NULL,
  affiliate_id    CHAR(36)      NOT NULL,
  campaign_id     CHAR(36),
  short_code      VARCHAR(20)   NOT NULL,
  destination_url VARCHAR(2048) NOT NULL,
  clicks          INT           NOT NULL DEFAULT 0,
  conversions     INT           NOT NULL DEFAULT 0,
  revenue_gbp     DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at      DATETIME      NULL,
  UNIQUE KEY uk_short_code (short_code),
  INDEX idx_workspace (workspace_id),
  INDEX idx_affiliate (affiliate_id),
  CONSTRAINT fk_link_aff FOREIGN KEY (affiliate_id) REFERENCES affiliate_affiliates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE affiliate_clicks (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  link_id         CHAR(36)     NOT NULL,
  affiliate_id    CHAR(36)     NOT NULL,
  visitor_id      VARCHAR(36),
  ip              VARCHAR(45),
  user_agent      VARCHAR(500),
  referrer        VARCHAR(2048),
  destination_url VARCHAR(2048),
  country         CHAR(2),
  fraud_flagged   TINYINT(1)   NOT NULL DEFAULT 0,
  fraud_reason    VARCHAR(100),
  clicked_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_workspace_time (workspace_id, clicked_at),
  INDEX idx_affiliate (affiliate_id),
  INDEX idx_link (link_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE affiliate_commissions (
  id                      CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id            CHAR(36)     NOT NULL,
  affiliate_id            CHAR(36)     NOT NULL,
  program_id              CHAR(36)     NOT NULL,
  click_id                CHAR(36),
  conversion_value        DECIMAL(12,2),
  commission_amount_gbp   DECIMAL(12,2),
  tier                    TINYINT      NOT NULL DEFAULT 1,
  status                  ENUM('pending','approved','paid','refunded','under_review') NOT NULL DEFAULT 'pending',
  reason                  VARCHAR(255),
  approved_at             DATETIME,
  paid_at                 DATETIME,
  payout_id               CHAR(36),
  refunded_at             DATETIME,
  created_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at              DATETIME     NULL,
  INDEX idx_workspace (workspace_id),
  INDEX idx_affiliate_status (affiliate_id, status),
  CONSTRAINT fk_comm_aff FOREIGN KEY (affiliate_id) REFERENCES affiliate_affiliates(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE affiliate_payouts (
  id                  CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id        CHAR(36)     NOT NULL,
  affiliate_id        CHAR(36)     NOT NULL,
  amount_gbp          DECIMAL(12,2) NOT NULL,
  currency            CHAR(3)      NOT NULL DEFAULT 'GBP',
  stripe_transfer_id  VARCHAR(255),
  period_start        DATE,
  period_end          DATE,
  status              ENUM('pending','processing','paid','failed','reversed') NOT NULL DEFAULT 'pending',
  failure_reason      TEXT,
  initiated_at        DATETIME,
  paid_at             DATETIME,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_affiliate (affiliate_id),
  INDEX idx_status (status),
  CONSTRAINT fk_payout_aff FOREIGN KEY (affiliate_id) REFERENCES affiliate_affiliates(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE affiliate_referral_coupons (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  affiliate_id    CHAR(36)     NOT NULL,
  code            VARCHAR(50)  NOT NULL,
  discount_type   ENUM('percent','flat') NOT NULL,
  discount_value  DECIMAL(8,2),
  uses            INT          NOT NULL DEFAULT 0,
  max_uses        INT,
  expires_at      DATETIME,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at      DATETIME     NULL,
  UNIQUE KEY uk_code (code),
  INDEX idx_affiliate (affiliate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## influencer-hub (influencer_*)

```sql
CREATE TABLE influencer_profiles (
  id                              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id                    CHAR(36)     NOT NULL,
  platform                        ENUM('instagram','youtube','tiktok','twitter','linkedin') NOT NULL,
  username                        VARCHAR(255) NOT NULL,
  full_name                       VARCHAR(255),
  email                           VARCHAR(255),
  bio                             TEXT,
  followers                       INT,
  following                       INT,
  avg_engagement_rate             DECIMAL(6,4),
  tier                            ENUM('nano','micro','macro','mega'),
  niche                           JSON,
  language                        CHAR(5),
  country                         CHAR(2),
  audience_authenticity_score     TINYINT,
  contact_status                  ENUM('discovered','contacted','negotiating','partnered','rejected','archived') NOT NULL DEFAULT 'discovered',
  notes                           TEXT,
  external_profile_url            VARCHAR(500),
  last_synced_at                  DATETIME,
  created_at                      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at                      DATETIME     NULL,
  UNIQUE KEY uk_workspace_platform_username (workspace_id, platform, username),
  INDEX idx_workspace_tier (workspace_id, tier),
  INDEX idx_engagement (avg_engagement_rate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE influencer_campaigns (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  campaign_id     CHAR(36),
  name            VARCHAR(255) NOT NULL,
  brief           TEXT,
  budget_gbp      DECIMAL(12,2),
  start_date      DATE,
  end_date        DATE,
  status          ENUM('draft','active','completed','cancelled') NOT NULL DEFAULT 'draft',
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME     NULL,
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE influencer_contracts (
  id                          CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id                CHAR(36)     NOT NULL,
  campaign_id                 CHAR(36)     NOT NULL,
  influencer_id               CHAR(36)     NOT NULL,
  fee_amount_gbp              DECIMAL(12,2),
  deliverables                JSON,
  content_approval_required   TINYINT(1)   NOT NULL DEFAULT 1,
  ftc_disclosure_required     TINYINT(1)   NOT NULL DEFAULT 1,
  contract_storage_key        VARCHAR(500),
  signed_at                   DATETIME,
  status                      ENUM('draft','sent','signed','active','completed','cancelled') NOT NULL DEFAULT 'draft',
  start_date                  DATE,
  end_date                    DATE,
  created_at                  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at                  DATETIME     NULL,
  INDEX idx_campaign (campaign_id),
  INDEX idx_influencer (influencer_id),
  CONSTRAINT fk_contract_inf FOREIGN KEY (influencer_id) REFERENCES influencer_profiles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE influencer_posts (
  id                  CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id        CHAR(36)     NOT NULL,
  contract_id         CHAR(36)     NOT NULL,
  influencer_id       CHAR(36)     NOT NULL,
  platform            VARCHAR(50),
  post_url            VARCHAR(500),
  posted_at           DATETIME,
  views               INT,
  likes               INT,
  comments            INT,
  shares              INT,
  saves               INT,
  reach               INT,
  impressions         INT,
  clicks              INT,
  conversions         INT,
  revenue_attributed  DECIMAL(12,2),
  emv_gbp             DECIMAL(12,2),
  last_synced_at      DATETIME,
  INDEX idx_contract (contract_id),
  INDEX idx_influencer_time (influencer_id, posted_at),
  CONSTRAINT fk_inf_post_contract FOREIGN KEY (contract_id) REFERENCES influencer_contracts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE influencer_outreach (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  influencer_id   CHAR(36)     NOT NULL,
  campaign_id     CHAR(36),
  message_type    ENUM('email','dm','inmail') NOT NULL,
  subject         VARCHAR(255),
  body            TEXT,
  sent_at         DATETIME,
  replied_at      DATETIME,
  status          ENUM('drafted','sent','opened','replied','bounced') NOT NULL DEFAULT 'drafted',
  INDEX idx_influencer (influencer_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE influencer_payments (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  contract_id     CHAR(36)     NOT NULL,
  amount_gbp      DECIMAL(12,2) NOT NULL,
  status          ENUM('pending','approved','paid','cancelled') NOT NULL DEFAULT 'pending',
  paid_at         DATETIME,
  payment_method  VARCHAR(50),
  reference       VARCHAR(255),
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_contract (contract_id),
  CONSTRAINT fk_pay_contract FOREIGN KEY (contract_id) REFERENCES influencer_contracts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## crm-automation (crm_*)

```sql
CREATE TABLE crm_companies (
  id            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id  CHAR(36)     NOT NULL,
  name          VARCHAR(255) NOT NULL,
  domain        VARCHAR(255),
  industry      VARCHAR(100),
  size          VARCHAR(50),
  country       CHAR(2),
  annual_revenue_gbp DECIMAL(15,2),
  custom_fields JSON,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    DATETIME     NULL,
  INDEX idx_workspace_name (workspace_id, name),
  INDEX idx_domain (domain),
  FULLTEXT KEY ft_company (name, domain)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE crm_contacts (
  id                    CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id          CHAR(36)     NOT NULL,
  email                 VARCHAR(255),
  phone                 VARCHAR(50),
  first_name            VARCHAR(100),
  last_name             VARCHAR(100),
  full_name             VARCHAR(255),
  company_id            CHAR(36),
  company_name          VARCHAR(255),
  job_title             VARCHAR(255),
  source                ENUM('organic','paid','social','referral','direct','email','form','manual','import','api') NOT NULL DEFAULT 'manual',
  source_details        VARCHAR(500),
  lifecycle_stage       ENUM('subscriber','lead','mql','sql','customer','evangelist') NOT NULL DEFAULT 'subscriber',
  lead_score            INT          NOT NULL DEFAULT 0,
  custom_fields         JSON,
  tags                  JSON,
  email_subscriber_id   CHAR(36),
  owner_user_id         CHAR(36),
  first_seen_at         DATETIME,
  last_activity_at      DATETIME,
  last_engaged_at       DATETIME,
  created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at            DATETIME     NULL,
  UNIQUE KEY uk_workspace_email (workspace_id, email),
  INDEX idx_workspace_lifecycle (workspace_id, lifecycle_stage),
  INDEX idx_workspace_score (workspace_id, lead_score),
  INDEX idx_company (company_id),
  FULLTEXT KEY ft_contact (full_name, email, company_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE crm_contact_activities (
  id                  CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id        CHAR(36)     NOT NULL,
  contact_id          CHAR(36)     NOT NULL,
  activity_type       VARCHAR(100),
  source_event_type   VARCHAR(100),
  data                JSON,
  score_delta         INT,
  occurred_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_contact_time (contact_id, occurred_at),
  INDEX idx_workspace_time (workspace_id, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE crm_lead_scoring_rules (
  id            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id  CHAR(36)     NOT NULL,
  event_type    VARCHAR(100) NOT NULL,
  condition     JSON,
  score_delta   INT          NOT NULL,
  description   VARCHAR(255),
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    DATETIME     NULL,
  INDEX idx_workspace_event (workspace_id, event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE crm_workflows (
  id                          CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id                CHAR(36)     NOT NULL,
  name                        VARCHAR(255) NOT NULL,
  description                 TEXT,
  trigger_type                ENUM('contact_created','lifecycle_changed','tag_added','score_threshold','date_based','page_visited','form_submitted','event','manual') NOT NULL,
  trigger_config              JSON,
  flow_json                   JSON,
  parsed_steps                JSON,
  status                      ENUM('draft','active','paused','archived') NOT NULL DEFAULT 'draft',
  re_enrollment               ENUM('never','always','after_completion') NOT NULL DEFAULT 'never',
  max_active_per_contact      INT          NOT NULL DEFAULT 1,
  created_by                  CHAR(36),
  created_at                  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                  DATETIME     NULL,
  INDEX idx_workspace_status (workspace_id, status),
  INDEX idx_trigger_type (trigger_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE crm_workflow_enrollments (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  workflow_id     CHAR(36)     NOT NULL,
  contact_id      CHAR(36)     NOT NULL,
  current_step    INT          NOT NULL DEFAULT 0,
  status          ENUM('enrolled','running','completed','exited','failed') NOT NULL DEFAULT 'enrolled',
  enrolled_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  next_action_at  DATETIME,
  completed_at    DATETIME,
  exit_reason     VARCHAR(255),
  context         JSON,
  INDEX idx_next_action (status, next_action_at),
  INDEX idx_contact_workflow (contact_id, workflow_id),
  CONSTRAINT fk_enroll_workflow FOREIGN KEY (workflow_id) REFERENCES crm_workflows(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE crm_forms (
  id                  CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id        CHAR(36)     NOT NULL,
  name                VARCHAR(255),
  slug                VARCHAR(100),
  fields              JSON         NOT NULL,
  submit_action       ENUM('redirect','message','download') NOT NULL DEFAULT 'message',
  redirect_url        VARCHAR(2048),
  success_message     TEXT,
  download_url        VARCHAR(2048),
  notify_emails       JSON,
  add_to_lists        JSON,
  enrol_workflow_id   CHAR(36),
  captcha_enabled     TINYINT(1)   NOT NULL DEFAULT 1,
  submission_count    INT          NOT NULL DEFAULT 0,
  embed_code          TEXT,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at          DATETIME     NULL,
  UNIQUE KEY uk_slug (slug),
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE crm_form_submissions (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  form_id         CHAR(36)     NOT NULL,
  contact_id      CHAR(36),
  data            JSON         NOT NULL,
  ip_address      VARCHAR(45),
  user_agent      VARCHAR(500),
  submitted_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_form (form_id),
  INDEX idx_workspace_time (workspace_id, submitted_at),
  CONSTRAINT fk_sub_form FOREIGN KEY (form_id) REFERENCES crm_forms(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE crm_pipelines (
  id            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id  CHAR(36)     NOT NULL,
  name          VARCHAR(255) NOT NULL,
  stages        JSON         NOT NULL,
  is_default    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    DATETIME     NULL,
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE crm_deals (
  id            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id  CHAR(36)     NOT NULL,
  pipeline_id   CHAR(36)     NOT NULL,
  contact_id    CHAR(36),
  company_id    CHAR(36),
  name          VARCHAR(255) NOT NULL,
  value_gbp     DECIMAL(12,2),
  stage         VARCHAR(100),
  probability   TINYINT,
  close_date    DATE,
  owner_id      CHAR(36),
  status        ENUM('open','won','lost') NOT NULL DEFAULT 'open',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    DATETIME     NULL,
  INDEX idx_workspace_status (workspace_id, status),
  INDEX idx_pipeline_stage (pipeline_id, stage),
  INDEX idx_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE crm_tasks (
  id            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id  CHAR(36)     NOT NULL,
  contact_id    CHAR(36),
  deal_id       CHAR(36),
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  due_date      DATETIME,
  priority      ENUM('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
  status        ENUM('open','in_progress','completed','cancelled') NOT NULL DEFAULT 'open',
  assigned_to   CHAR(36),
  completed_at  DATETIME,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    DATETIME     NULL,
  INDEX idx_workspace_status (workspace_id, status),
  INDEX idx_assigned (assigned_to),
  INDEX idx_due (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## media-hub (media_*)

```sql
CREATE TABLE media_youtube_channels (
  id                              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id                    CHAR(36)     NOT NULL,
  channel_id                      VARCHAR(50)  NOT NULL,
  channel_name                    VARCHAR(255),
  subscribers                     INT,
  total_views                     BIGINT,
  video_count                     INT,
  oauth_access_token_encrypted    TEXT,
  oauth_refresh_token_encrypted   TEXT,
  oauth_expires_at                DATETIME,
  status                          ENUM('connected','expired','revoked') NOT NULL DEFAULT 'connected',
  last_synced_at                  DATETIME,
  created_at                      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at                      DATETIME     NULL,
  UNIQUE KEY uk_workspace_channel (workspace_id, channel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE media_videos (
  id                      CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id            CHAR(36)     NOT NULL,
  channel_id              CHAR(36)     NOT NULL,
  youtube_id              VARCHAR(50),
  title                   VARCHAR(255),
  description             TEXT,
  tags                    JSON,
  thumbnail_url           VARCHAR(500),
  duration_seconds        INT,
  published_at            DATETIME,
  views                   BIGINT,
  likes                   INT,
  comments                INT,
  watch_time_minutes      BIGINT,
  avg_view_duration_pct   DECIMAL(5,2),
  ctr_impressions         DECIMAL(5,2),
  last_synced_at          DATETIME,
  UNIQUE KEY uk_youtube_id (youtube_id),
  INDEX idx_channel_published (channel_id, published_at),
  CONSTRAINT fk_video_channel FOREIGN KEY (channel_id) REFERENCES media_youtube_channels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE media_video_seo_audits (
  id                  CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id        CHAR(36)     NOT NULL,
  video_id            CHAR(36)     NOT NULL,
  title_score         TINYINT,
  description_score   TINYINT,
  tags_score          TINYINT,
  thumbnail_score     TINYINT,
  engagement_score    TINYINT,
  overall_score       TINYINT,
  recommendations     JSON,
  audited_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_video (video_id),
  CONSTRAINT fk_vaudit_video FOREIGN KEY (video_id) REFERENCES media_videos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE media_video_scripts (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  title           VARCHAR(255),
  script_body     LONGTEXT,
  hook            TEXT,
  cta             TEXT,
  keywords_used   JSON,
  ai_generated    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME     NULL,
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE media_shorts (
  id                  CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id        CHAR(36)     NOT NULL,
  source_storage_key  VARCHAR(500),
  caption             TEXT,
  hashtags            JSON,
  platforms           JSON,
  scheduled_at        DATETIME,
  published_at        DATETIME,
  status              ENUM('draft','transcribing','ready','scheduled','publishing','published','failed') NOT NULL DEFAULT 'draft',
  transcript          TEXT,
  external_post_ids   JSON,
  views               JSON,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at          DATETIME     NULL,
  INDEX idx_workspace (workspace_id),
  INDEX idx_scheduled (status, scheduled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE media_podcasts (
  id                  CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id        CHAR(36)     NOT NULL,
  title               VARCHAR(255) NOT NULL,
  show_notes          TEXT,
  transcript          LONGTEXT,
  audio_storage_key   VARCHAR(500),
  duration_seconds    INT,
  platforms           JSON,
  published_at        DATETIME,
  status              ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at          DATETIME     NULL,
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE media_image_generations (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  prompt          TEXT         NOT NULL,
  provider        ENUM('openai_dalle','stability_ai') NOT NULL,
  model           VARCHAR(50),
  size            VARCHAR(20),
  quality         ENUM('standard','hd'),
  style           ENUM('vivid','natural'),
  image_storage_keys JSON,
  cost_usd        DECIMAL(8,4),
  status          ENUM('queued','generating','completed','failed') NOT NULL DEFAULT 'queued',
  failure_reason  TEXT,
  generated_at    DATETIME,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_workspace (workspace_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE media_creative_briefs (
  id                  CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id        CHAR(36)     NOT NULL,
  campaign_id         CHAR(36),
  brief_type          ENUM('video_ad','display_ad','social_graphic','banner') NOT NULL,
  brief_content       JSON,
  status              ENUM('draft','approved','in_production','completed') NOT NULL DEFAULT 'draft',
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at          DATETIME     NULL,
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## notification-service (notify_*)

```sql
CREATE TABLE notify_notifications (
  id                  CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id        CHAR(36)     NOT NULL,
  user_id             CHAR(36)     NOT NULL,
  event_type          VARCHAR(100) NOT NULL,
  severity            ENUM('info','success','warning','critical') NOT NULL DEFAULT 'info',
  title               VARCHAR(255),
  body                TEXT,
  link                VARCHAR(2048),
  icon                VARCHAR(50),
  metadata            JSON,
  read_at             DATETIME,
  delivered_channels  JSON,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at          DATETIME     NULL,
  INDEX idx_user_unread (user_id, read_at, created_at),
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notify_prefs (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  user_id         CHAR(36)     NOT NULL,
  event_type      VARCHAR(100) NOT NULL,
  channels        JSON,
  enabled         TINYINT(1)   NOT NULL DEFAULT 1,
  digest_only     TINYINT(1)   NOT NULL DEFAULT 0,
  dnd_start_hour  TINYINT,
  dnd_end_hour    TINYINT,
  UNIQUE KEY uk_user_event (user_id, event_type),
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notify_channels (
  id            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id  CHAR(36)     NOT NULL,
  user_id       CHAR(36)     NOT NULL,
  type          ENUM('email','in_app','push','slack','webhook') NOT NULL,
  target        VARCHAR(500),
  verified      TINYINT(1)   NOT NULL DEFAULT 0,
  config        JSON,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at    DATETIME     NULL,
  INDEX idx_user_type (user_id, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notify_digests (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  user_id         CHAR(36)     NOT NULL,
  period_start    DATE         NOT NULL,
  period_end      DATE         NOT NULL,
  content         JSON,
  pdf_storage_key VARCHAR(500),
  sent_at         DATETIME,
  status          ENUM('pending','generated','sent','failed') NOT NULL DEFAULT 'pending',
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_period (user_id, period_start, period_end),
  INDEX idx_workspace_period (workspace_id, period_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## integration-service (integ_*)

```sql
CREATE TABLE integ_api_keys (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  user_id         CHAR(36)     NOT NULL,
  name            VARCHAR(100) NOT NULL,
  key_prefix      VARCHAR(20),
  key_hash        VARCHAR(255) NOT NULL,
  scopes          JSON,
  mode            ENUM('live','test') NOT NULL DEFAULT 'live',
  last_used_at    DATETIME,
  expires_at      DATETIME,
  ip_allowlist    JSON,
  status          ENUM('active','revoked','expired') NOT NULL DEFAULT 'active',
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at      DATETIME     NULL,
  INDEX idx_workspace (workspace_id),
  INDEX idx_key_prefix (key_prefix),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE integ_oauth_apps (
  id                      CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  name                    VARCHAR(255) NOT NULL,
  client_id               VARCHAR(100) NOT NULL,
  client_secret_hash      VARCHAR(255) NOT NULL,
  redirect_uris           JSON,
  scopes                  JSON,
  owner_workspace_id      CHAR(36),
  is_official             TINYINT(1)   NOT NULL DEFAULT 0,
  status                  ENUM('active','suspended') NOT NULL DEFAULT 'active',
  created_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at              DATETIME     NULL,
  UNIQUE KEY uk_client_id (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE integ_oauth_tokens (
  id                  CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  app_id              CHAR(36)     NOT NULL,
  user_id             CHAR(36)     NOT NULL,
  workspace_id        CHAR(36),
  access_token_hash   VARCHAR(255) NOT NULL,
  refresh_token_hash  VARCHAR(255),
  scopes              JSON,
  expires_at          DATETIME     NOT NULL,
  revoked_at          DATETIME,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_app_user (app_id, user_id),
  INDEX idx_access (access_token_hash),
  CONSTRAINT fk_otoken_app FOREIGN KEY (app_id) REFERENCES integ_oauth_apps(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE integ_webhooks (
  id                      CHAR(36)      NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id            CHAR(36)      NOT NULL,
  url                     VARCHAR(2048) NOT NULL,
  events                  JSON          NOT NULL,
  secret_encrypted        TEXT,
  description             VARCHAR(255),
  status                  ENUM('active','disabled','failing') NOT NULL DEFAULT 'active',
  consecutive_failures    INT           NOT NULL DEFAULT 0,
  last_success_at         DATETIME,
  last_failure_at         DATETIME,
  created_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at              DATETIME      NULL,
  INDEX idx_workspace (workspace_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE integ_webhook_events (
  id                CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  event_type        VARCHAR(100) NOT NULL,
  description       TEXT,
  schema_version    VARCHAR(20),
  example_payload   JSON,
  added_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deprecated_at     DATETIME,
  UNIQUE KEY uk_event_version (event_type, schema_version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE integ_webhook_deliveries (
  id                CHAR(36)      NOT NULL PRIMARY KEY DEFAULT (UUID()),
  webhook_id        CHAR(36)      NOT NULL,
  workspace_id      CHAR(36)      NOT NULL,
  event_id          CHAR(36),
  event_type        VARCHAR(100),
  attempt           INT,
  request_url       VARCHAR(2048),
  request_body      JSON,
  response_status   INT,
  response_body     TEXT,
  duration_ms       INT,
  status            ENUM('pending','succeeded','failed','retrying','dlq') NOT NULL DEFAULT 'pending',
  next_retry_at     DATETIME,
  delivered_at      DATETIME,
  created_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_webhook_time (webhook_id, created_at),
  INDEX idx_status_retry (status, next_retry_at),
  CONSTRAINT fk_delivery_webhook FOREIGN KEY (webhook_id) REFERENCES integ_webhooks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE integ_zapier_subscriptions (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  user_id         CHAR(36)     NOT NULL,
  trigger_type    VARCHAR(100) NOT NULL,
  target_url      VARCHAR(2048) NOT NULL,
  status          ENUM('active','disabled') NOT NULL DEFAULT 'active',
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at      DATETIME     NULL,
  INDEX idx_workspace_trigger (workspace_id, trigger_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE integ_data_imports (
  id                  CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id        CHAR(36)     NOT NULL,
  source              ENUM('csv','hubspot','mailchimp','klaviyo','activecampaign','convertkit','salesforce','google_sheets') NOT NULL,
  target              ENUM('contacts','companies','deals','subscribers') NOT NULL,
  config              JSON,
  total_rows          INT,
  processed_rows      INT          NOT NULL DEFAULT 0,
  succeeded_rows      INT          NOT NULL DEFAULT 0,
  failed_rows         INT          NOT NULL DEFAULT 0,
  status              ENUM('queued','running','completed','failed','cancelled') NOT NULL DEFAULT 'queued',
  started_at          DATETIME,
  completed_at        DATETIME,
  error_csv_storage_key VARCHAR(500),
  created_by          CHAR(36),
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_workspace (workspace_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE integ_data_import_rows (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  import_id       CHAR(36)     NOT NULL,
  row_number      INT          NOT NULL,
  status          ENUM('pending','succeeded','failed','skipped') NOT NULL DEFAULT 'pending',
  data            JSON,
  error_message   TEXT,
  INDEX idx_import_status (import_id, status),
  CONSTRAINT fk_row_import FOREIGN KEY (import_id) REFERENCES integ_data_imports(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE integ_data_exports (
  id                  CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id        CHAR(36)     NOT NULL,
  type                ENUM('dsar','custom','scheduled_report') NOT NULL,
  format              ENUM('json','csv','zip','pdf') NOT NULL,
  filters             JSON,
  status              ENUM('queued','running','completed','failed') NOT NULL DEFAULT 'queued',
  export_storage_key  VARCHAR(500),
  download_url        VARCHAR(2048),
  expires_at          DATETIME,
  created_by          CHAR(36),
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at        DATETIME,
  INDEX idx_workspace (workspace_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## Foreign Key Catalogue

Cross-service FKs to be aware of (Sequelize will auto-create these when models reference each other; for the same physical database):

| From | To | Cascade |
|---|---|---|
| `core_workspaces.owner_id` | `core_users.id` | no |
| `core_workspaces.agency_id` | `core_workspaces.id` | no (self-ref) |
| `core_workspace_members.workspace_id` | `core_workspaces.id` | no |
| `core_workspace_members.user_id` | `core_users.id` | no |
| `core_subscriptions.workspace_id` | `core_workspaces.id` | no |
| `core_subscriptions.plan_id` | `core_plans.id` | no |
| All `*.workspace_id` | `core_workspaces.id` | **no** (soft FK; enforce in app layer to allow service-per-DB later) |
| Within-service FKs (e.g., `seo_audit_issues.audit_id` → `seo_audits.id`) | varies | **CASCADE delete** |

**Rule of thumb:**
- **Within-service FKs**: enforce in DB with `ON DELETE CASCADE`
- **Cross-service FKs** (any FK pointing to another service's table): keep them as soft references (no DB-level constraint) so each service can later be split to its own database without breaking constraints. Validate in application code.

---

## Index Strategy Summary

Every workspace-scoped table includes:
- `INDEX idx_workspace (workspace_id)` — mandatory for tenant isolation queries
- `INDEX idx_deleted (deleted_at)` — soft-delete filter speed

Additional indexes per table type:
- **State-machine tables** (campaigns, workflows, sequences): `INDEX (workspace_id, status)`
- **Time-series tables** (events, activities, deliveries): `INDEX (workspace_id, created_at)` + monthly/weekly partitioning
- **Lookup tables** (subscribers, contacts): `UNIQUE KEY (workspace_id, email)` + `INDEX (email_status)`
- **Search tables** (keywords, contacts, content): `FULLTEXT KEY` on the searchable column(s)
- **OAuth token tables** (social_accounts, youtube_channels): `INDEX (oauth_expires_at)` for refresh worker
- **Queue-style tables** (drip_enrollments, workflow_enrollments): `INDEX (status, next_action_at)` for "find work to do" queries

### Partitioning (production only)

High-volume tables — partition by **week** for hot data, monthly for warm:

| Table | Partition strategy | Retention |
|---|---|---|
| `analytics_events` | Weekly partitions | 30 days (then drop partition) |
| `email_events` | Monthly | 90 days |
| `intel_ai_usage` | Monthly | 1 year |
| `core_audit_log` | Monthly | Plan-tier (30d / 1y / 7y) |
| `integ_webhook_deliveries` | Monthly | 90 days |
| `affiliate_clicks` | Monthly | 1 year |
| `crm_contact_activities` | Monthly | 1 year |

These partition definitions are added via **separate migration**, not via Sequelize sync. See [database-sync-strategy.md](database-sync-strategy.md).

---

## Migration Sequence

When provisioning a fresh database, tables must be created in this order to satisfy FKs:

```
Phase 1 — Foundation (no FK deps)
  1. core_users
  2. core_plans
  3. core_workspaces       (FKs to users, self)
  4. core_roles
  5. core_permissions      (FK to roles)
  6. core_workspace_members (FKs to workspaces, users)
  7. core_auth_sessions    (FK to users)
  8. core_subscriptions    (FKs to workspaces, plans)
  9. core_agency_settings  (FK to workspaces)
 10. core_agency_domains   (FK to workspaces)
 11. core_audit_log
 12. core_sso_connections  (FK to workspaces)
 13. core_feature_flags
 14. core_support_tickets
 15. core_outbox
 16. core_idempotency_keys
 17. core_dsar_requests
 18. core_consent_log

Phase 2 — Service tables (no FKs across services; soft refs only)
   All other tables in any order — Sequelize handles this
   when each service starts up.
```

Sequelize handles this automatically via the model dependency graph when `sequelize.sync()` runs (or via service startup order in a clean-DB scenario). See **[database-sync-strategy.md](database-sync-strategy.md)** for the auto-create pattern.

---

## Total Table Count

| Service | Tables |
|---|---|
| marketing-core | 18 |
| seo-engine | 10 |
| content-ai | 8 |
| campaign-manager | 12 |
| analytics-engine | 10 |
| social-hub | 7 |
| email-hub | 12 |
| intelligence | 7 |
| affiliate-hub | 7 |
| influencer-hub | 6 |
| crm-automation | 12 |
| media-hub | 8 |
| notification-service | 4 |
| integration-service | 10 |
| **Total** | **131 tables** |

All created automatically by Sequelize `sync()` at first boot. No manual SQL execution required for the dev/staging environment.
