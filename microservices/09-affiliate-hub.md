# 🤝 affiliate-hub (Port 3108)
## Affiliate Programs · Partner Portal · Tracking · Commissions · Payouts

> **Tier 2 — Important.** Money flowing both directions. Stripe Connect KYC delays = blocked customers. Fraud detection critical.

---

## 1. Service Identity

| Field | Value |
|---|---|
| **Service Name** | `affiliate-hub` |
| **Port** | 3108 |
| **Maturity Tier** | Tier 2 |
| **SLA** | 99.5% uptime |
| **On-Call** | Business hours |
| **Owning Team** | Affiliate Team |

**One-sentence purpose:** Run customer-defined affiliate programs — let their partners promote products and earn commissions, with fraud detection and automated payouts via Stripe Connect.

---

## 2. Responsibilities (DO / DON'T)

### ✅ DO
- Affiliate program CRUD per workspace (commission structure, cookie window)
- Affiliate signup + KYC via Stripe Connect Express
- Branded partner portal (white-labelled to agency)
- Unique tracking link generation per affiliate
- Click tracking (high-volume redirect endpoint)
- Cookie-based attribution (30/60/90-day configurable)
- Conversion attribution (when a click leads to a customer's sale)
- Multi-tier commissions (Tier 1 + sub-affiliate Tier 2)
- Referral coupon codes (alternative to tracking links)
- Fraud detection (same-IP velocity, conversion ratio anomalies, duplicate emails)
- Monthly payout processing via Stripe Connect transfers
- 1099-K facilitation (Stripe handles for US affiliates)
- Marketing asset library (banners, email templates for affiliates)

### ❌ DON'T
- Track end-customer purchases (we receive conversion events from analytics-engine or customer's API)
- Process customer's billing (that's `marketing-core` via Stripe customer subscriptions)
- Send affiliate recruitment emails → publish events; `email-hub` sends
- Manage influencer relationships → `influencer-hub` (different model: paid sponsorship vs commission)

---

## 3. Domain Model

### Tables Owned (7)

| Table | Purpose |
|---|---|
| `affiliate_programs` | Program definitions per workspace |
| `affiliate_affiliates` | Registered affiliates (with Stripe Connect account) |
| `affiliate_links` | Tracking links per affiliate per program |
| `affiliate_clicks` | Click events (high-volume, partitioned) |
| `affiliate_commissions` | Earned commissions awaiting payout |
| `affiliate_payouts` | Processed payout records |
| `affiliate_referral_coupons` | Coupon codes linked to affiliates |

### Key Schemas

```sql
CREATE TABLE affiliate_programs (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  commission_type ENUM('percent','flat','tiered') NOT NULL,
  commission_value DECIMAL(8,2),                 -- 20.00 = 20% or £20
  cookie_days     INT DEFAULT 60,
  payout_threshold_gbp DECIMAL(8,2) DEFAULT 50,
  approval_required TINYINT(1) DEFAULT 1,
  terms_url       VARCHAR(2048),
  status          ENUM('active','paused','closed') DEFAULT 'active',
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB;

CREATE TABLE affiliate_affiliates (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  program_id      CHAR(36)     NOT NULL,
  user_id         CHAR(36),                     -- if existing platform user
  name            VARCHAR(255),
  email           VARCHAR(255),
  company         VARCHAR(255),
  country         CHAR(2),
  stripe_connect_account_id VARCHAR(255),       -- Express account
  stripe_kyc_status ENUM('pending','verified','rejected','requires_action') DEFAULT 'pending',
  status          ENUM('pending','approved','rejected','suspended') DEFAULT 'pending',
  total_clicks    INT DEFAULT 0,
  total_conversions INT DEFAULT 0,
  total_earned_gbp DECIMAL(12,2) DEFAULT 0,
  unpaid_balance_gbp DECIMAL(12,2) DEFAULT 0,
  fraud_score     TINYINT DEFAULT 0,
  approved_at     DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  UNIQUE KEY uk_program_email (program_id, email),
  INDEX idx_workspace (workspace_id),
  INDEX idx_status (status)
) ENGINE=InnoDB;

CREATE TABLE affiliate_clicks (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36) NOT NULL,
  link_id         CHAR(36) NOT NULL,
  affiliate_id    CHAR(36) NOT NULL,
  visitor_id      VARCHAR(36),                  -- cookie value
  ip              VARCHAR(45),
  user_agent      VARCHAR(500),
  referrer        VARCHAR(2048),
  destination_url VARCHAR(2048),
  country         CHAR(2),
  fraud_flagged   TINYINT(1) DEFAULT 0,
  fraud_reason    VARCHAR(100),
  clicked_at      DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_workspace_time (workspace_id, clicked_at),
  INDEX idx_affiliate (affiliate_id),
  INDEX idx_link (link_id)
) ENGINE=InnoDB
PARTITION BY RANGE (TO_DAYS(clicked_at)) (
  PARTITION p_2026_q2 VALUES LESS THAN (TO_DAYS('2026-07-01')),
  ...
);

CREATE TABLE affiliate_commissions (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36) NOT NULL,
  affiliate_id    CHAR(36) NOT NULL,
  program_id      CHAR(36) NOT NULL,
  click_id        CHAR(36),                     -- attribution source
  conversion_value DECIMAL(12,2),               -- the sale amount
  commission_amount_gbp DECIMAL(12,2),
  tier            TINYINT DEFAULT 1,
  status          ENUM('pending','approved','paid','refunded','under_review') DEFAULT 'pending',
  reason          VARCHAR(255),
  approved_at     DATETIME,
  paid_at         DATETIME,
  payout_id       CHAR(36),
  refunded_at     DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  INDEX idx_workspace (workspace_id),
  INDEX idx_affiliate_status (affiliate_id, status)
) ENGINE=InnoDB;

CREATE TABLE affiliate_payouts (
  id              CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36) NOT NULL,
  affiliate_id    CHAR(36) NOT NULL,
  amount_gbp      DECIMAL(12,2) NOT NULL,
  currency        CHAR(3) DEFAULT 'GBP',
  stripe_transfer_id VARCHAR(255),
  period_start    DATE,
  period_end      DATE,
  status          ENUM('pending','processing','paid','failed','reversed') DEFAULT 'pending',
  failure_reason  TEXT,
  initiated_at    DATETIME,
  paid_at         DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_affiliate (affiliate_id),
  INDEX idx_status (status)
) ENGINE=InnoDB;
```

---

## 4. API Contract

| Method | Path | Auth |
|---|---|---|
| GET | `/programs` | JWT + `affiliates:r` |
| POST | `/programs` | JWT + `affiliates:c` |
| PATCH | `/programs/:id` | JWT + `affiliates:u` |
| GET | `/affiliates/apply/:program_id` | (public — application form) |
| POST | `/affiliates/apply` | (public) |
| GET | `/affiliates` | JWT + `affiliates:r` |
| POST | `/affiliates/:id/approve` | JWT + `affiliates:u` |
| POST | `/affiliates/:id/connect-stripe` | (affiliate auth via magic link) |
| GET | `/portal/:affiliate_id/dashboard` | (affiliate auth via magic link) |
| GET | `/portal/:affiliate_id/links` | (affiliate auth) |
| POST | `/portal/:affiliate_id/links` | (affiliate auth) |
| **GET** | **`/r/:short_code`** | **(public — high-volume redirect)** |
| GET | `/commissions` | JWT + `affiliates:r` |
| POST | `/commissions/:id/approve` | JWT + `affiliates:u` |
| GET | `/payouts` | JWT + `affiliates:r` |
| POST | `/payouts/process` | JWT + `affiliates:u` (manual trigger) |
| POST | `/internal/conversion-attribution` | (service JWT — from analytics-engine) |
| POST | `/webhooks/stripe-connect` | (Stripe signature) |

### Highest-volume endpoint: `GET /r/:short_code`

```http
GET /r/abc123 HTTP/1.1
Host: track.yourplatform.com
```

Logic:
1. Look up `affiliate_links` by short_code (Redis cache 5min)
2. Set cookie: `_aff=<link_id>` (max age = cookie_days from program config)
3. Fire-and-forget INSERT into `affiliate_clicks` (async via Bull `mkt-affiliate-click-track`)
4. 301 redirect to destination_url

**Target: < 30ms response time. P99 < 100ms. 1000+ req/sec.**

---

## 5. Async Events

### Published
| Event | When |
|---|---|
| `affiliate.application.submitted` | New application |
| `affiliate.approved` | Application approved |
| `affiliate.commission.earned` | New commission attributed |
| `affiliate.commission.approved` | Commission approved (after refund window) |
| `affiliate.payout.initiated` | Stripe transfer triggered |
| `affiliate.payout.completed` | Transfer confirmed |
| `affiliate.payout.failed` | Transfer failed |
| `affiliate.fraud.detected` | Suspicious activity flagged |

### Consumed
| Event | From | Action |
|---|---|---|
| `analytics.conversion_goal_hit` | analytics-engine | Look up cookie, attribute conversion |
| (any customer purchase event via API) | integration-service | Attribute commission |

### Bull Queues
| Queue | Purpose | Schedule |
|---|---|---|
| `mkt-affiliate-click-track` | Persist click events from /r redirect | On-demand (high volume) |
| `mkt-affiliate-attribution` | Match conversions to clicks via cookie | On-demand |
| `mkt-affiliate-fraud-detect` | Run fraud rules nightly | Nightly 02:00 UTC |
| `mkt-affiliate-payouts` | Process monthly payouts | 15th of month |
| `mkt-affiliate-commission-approve` | Auto-approve commissions past 30-day refund window | Daily 03:00 UTC |

---

## 6. Dependencies

### External APIs
- **Stripe Connect** — Express accounts, KYC, transfers, 1099-K

### Fraud Detection Rules
- Same IP > 3 conversions / hour → flag
- Conversion-to-click ratio > 50% → flag (normal: 1-5%)
- Disposable email domain → flag
- Multiple affiliates with same Stripe Connect bank → flag
- Geographic mismatch (click from US, conversion from VPN exit in India) → flag

---

## 7. Folder Structure (standard — see 00-standards.md)

## 8. Configuration

```bash
# Service Identity
SERVICE_NAME=affiliate-hub
NODE_ENV=production
PORT=3108

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
AFFILIATE_PORTAL_TOKEN_SECRET=****                # magic-link login for affiliates
SHORT_LINK_DOMAIN=track.yourplatform.com

# Stripe Connect (affiliate payouts)
STRIPE_SECRET_KEY=sk_live_****
STRIPE_CONNECT_CLIENT_ID=ca_****
STRIPE_WEBHOOK_SECRET=whsec_****
STRIPE_PUBLISHABLE_KEY=pk_live_****

# Cookie attribution
AFFILIATE_COOKIE_NAME=_aff
AFFILIATE_COOKIE_DEFAULT_DAYS=60
AFFILIATE_COOKIE_DOMAIN=.yourplatform.com

# Fraud detection
FRAUD_DETECT_SAME_IP_CONVERSIONS_PER_HOUR=3
FRAUD_DETECT_CONVERSION_TO_CLICK_RATIO=0.5         # 50% = suspicious
FRAUD_REVIEW_THRESHOLD_SCORE=70                    # 0-100; auto-suspend at 80+

# Payouts
PAYOUT_DAY_OF_MONTH=15
PAYOUT_MIN_THRESHOLD_GBP=50
PAYOUT_CURRENCY_DEFAULT=GBP

# Commission window
COMMISSION_REFUND_HOLD_DAYS=30                    # wait this long before auto-approve

# Service URLs
MARKETING_CORE_URL=http://marketing-core:3100
ANALYTICS_ENGINE_URL=http://analytics-engine:3104
EMAIL_HUB_URL=http://email-hub:3106

# Observability
SENTRY_DSN=https://****
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
LOG_LEVEL=info

# Feature Flags
FEATURE_MULTI_TIER_COMMISSIONS=true
FEATURE_AUTO_FRAUD_SUSPEND=false                  # require manual review in early phases
```

---

## 9-14. (Deployment, Observability, Security, Testing, Local Dev, Runbooks)

### Metrics
```
affiliate_clicks_total{workspace_tier}             Counter
affiliate_conversions_total                        Counter
affiliate_commission_earned_gbp_total              Counter
affiliate_payouts_processed_total{status}          Counter
affiliate_fraud_flagged_total                      Counter
mkt_redirect_latency_seconds{p50,p95,p99}              Histogram
```

### Runbooks

**"Affiliate payout failed"**
1. Check Stripe Dashboard for the transfer
2. Common cause: affiliate's Stripe Connect KYC incomplete, bank info wrong
3. Notify affiliate via email; partner portal shows actionable banner
4. Retry after KYC complete

**"Suspected affiliate fraud"**
1. Suspend the affiliate immediately
2. Reverse pending (unpaid) commissions
3. Investigate IP/conversion patterns
4. If confirmed: ban + report to fraud detection vendors
5. If false positive: unsuspend + apologise + manual review credit
