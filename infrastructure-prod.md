# 🏗️ Production Infrastructure
## Backups · Disaster Recovery · HA · Zero-Downtime Migrations · Scaling

> Production infrastructure for a SaaS that customers rely on for revenue-generating campaigns. Downtime = lost trust + lost money.

---

## 📋 Table of Contents

1. [Environment Topology](#environment-topology)
2. [Backups](#backups)
3. [Disaster Recovery](#disaster-recovery)
4. [High Availability](#high-availability)
5. [Zero-Downtime Database Migrations](#zero-downtime-database-migrations)
6. [Deployment Strategy](#deployment-strategy)
7. [CDN & Edge](#cdn--edge)
8. [Multi-Region Plan](#multi-region-plan)
9. [Scaling Thresholds](#scaling-thresholds)
10. [Database Pooling](#database-pooling)
11. [Read Replicas](#read-replicas)

---

## Environment Topology

### Three Environments

| Env | URL | Data | Stripe | AI APIs | Purpose |
|---|---|---|---|---|---|
| **Local** | `localhost:3000` | Docker MySQL/PostgreSQL | Stripe test | Mock provider | Dev work |
| **Staging** | `staging.yourplatform.com` | Anonymised prod copy (weekly) | Stripe test | Real (low budget) | Pre-prod testing |
| **Production** | `app.yourplatform.com` | Live customer data | Stripe live | Real | Customer-facing |

### Deployment Models (production can run in EITHER)

The platform supports **two deployment models** — same code, different infra. Decided per customer / per region.

#### Model A — Cloud Deploy (default; most customers)
```
AWS / GCP / Azure
├── Compute     ECS Fargate (auto-scaling)
├── Database    Managed PostgreSQL (RDS Multi-AZ)
├── Cache       Managed Redis (ElastiCache cluster)
├── Analytics   ClickHouse Cloud OR self-managed in EKS
├── Storage     STORAGE_DRIVER=s3 (AWS S3 or Cloudflare R2)
├── CDN         Cloudflare in front
└── DNS         Cloudflare + Route 53
```
**Use for:** SaaS customers, fast scaling, lowest operational overhead.

#### Model B — On-Premise / Single Server (enterprise / data residency)
```
Customer's own data centre OR single VPS
├── Compute     Docker Compose on Linux server(s)
├── Database    Self-managed MySQL 8 (dev) OR PostgreSQL 15 (prod)
├── Cache       Self-managed Redis
├── Analytics   Self-managed ClickHouse
├── Storage     STORAGE_DRIVER=local (disk) OR STORAGE_DRIVER=s3 (MinIO self-hosted)
├── CDN         Nginx caching only (no external CDN)
└── DNS         Customer-controlled
```
**Use for:**
- Enterprise customers with data residency requirements (data must NOT leave their premises)
- Customers with regulatory constraints (healthcare, government, defence)
- Cost-sensitive deployments (small workspaces; no per-GB cloud costs)
- Air-gapped environments (offline-capable; sync with cloud later)

**Key compatibility design:**
- Same Docker images run in both models
- Same env vars; only their values change
- `STORAGE_DRIVER=local` for on-prem; `STORAGE_DRIVER=s3` for cloud (or self-hosted MinIO)
- `DB_DIALECT=mysql` for self-hosted; `DB_DIALECT=postgres` for managed RDS
- AI providers, payment, social platform APIs still require internet — these can't be "on-prem"
- Cost: cloud ~£10k/mo at 1k customers; on-prem ~£500/mo + server hardware

### Production Topology (Phase 3)

```
                          ┌─────────────────┐
                          │   Cloudflare    │  ← DDoS, WAF, CDN
                          │   (global edge) │
                          └────────┬────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
       ┌────────────┐       ┌────────────┐       ┌────────────┐
       │ EU-West-2  │       │  US-East-1 │       │ AP-South-1 │
       │  (London)  │       │ (Virginia) │       │  (Mumbai)  │
       └──────┬─────┘       └─────┬──────┘       └──────┬─────┘
              │                   │                     │
              │  (Phase 1: only EU-West-2; multi-region in Phase 4)
              ▼
   ┌───────────────────────────────────────────┐
   │   AWS Application Load Balancer            │
   │   • SSL termination                        │
   │   • Health checks                          │
   │   • Sticky sessions OFF (stateless)        │
   └─────────────┬─────────────────────────────┘
                 │
   ┌─────────────┴─────────────────────────────┐
   │   Nginx (2x EC2)                          │
   │   • Reverse proxy                         │
   │   • Rate limiting per IP                  │
   └─────────────┬─────────────────────────────┘
                 │
   ┌─────────────┴─────────────────────────────┐
   │   App Tier (ECS Fargate)                  │
   │   • 14 microservices                      │
   │   • Auto-scaling: 2-20 tasks per service  │
   │   • Health checks: /health endpoint       │
   └─────────────┬─────────────────────────────┘
                 │
   ┌─────────────┴─────────────────────────────┐
   │   Data Tier                               │
   │   • MySQL/PostgreSQL primary + replica (RDS)       │
   │   • Redis cluster (ElastiCache)           │
   │   • ClickHouse cluster (3 nodes)          │
   │   • Storage: S3 / R2 / MinIO / local disk │  (pluggable per deploy)
   │   • Elasticsearch — Phase 5+ only         │
   └───────────────────────────────────────────┘
```

---

## Backups

### MySQL/PostgreSQL

| Backup Type | Frequency | Retention | Tool |
|---|---|---|---|
| **Full snapshot** | Daily at 03:00 UTC | 30 days | AWS RDS automated backups |
| **Point-in-Time Recovery (PITR)** | Continuous (transaction logs) | 7 days | RDS PITR |
| **Weekly off-site** | Sunday 04:00 UTC | 90 days | `mysqldump` → S3 cross-region |
| **Pre-migration snapshot** | Before every schema migration | 7 days | Manual snapshot |

**RPO (Recovery Point Objective):** 5 minutes (PITR)
**RTO (Recovery Time Objective):** 1 hour (full restore)

### Redis

Redis is cache + queue. Strategy:
- AOF (Append-Only File) persistence enabled
- Daily RDB snapshot to S3
- **Treat Redis as ephemeral** — design for Redis loss without data loss
- Bull queue jobs: critical jobs also persist a row in MySQL/PostgreSQL (`core_outbox`) for replay

### ClickHouse

ClickHouse holds analytics events. Loss is annoying but not catastrophic (raw events also written to MySQL/PostgreSQL for 30 days).

- Daily `BACKUP` to S3 via ClickHouse-Backup tool
- Retention: 30 days
- Replication across 3 nodes (so single-node failure doesn't lose data)

### Elasticsearch (Phase 5+ only — NOT v1)

In v1 the platform does not run Elasticsearch (database FULLTEXT / `tsvector` covers v1 needs). When added in Phase 5+: rebuildable from MySQL/PostgreSQL via `mkt-elasticsearch-sync` job; snapshot weekly to storage backend.

### File Storage (Pluggable Driver — S3 OR Local Disk)

> Storage is pluggable per deploy via `STORAGE_DRIVER`. See [storage-strategy.md](storage-strategy.md).

#### When STORAGE_DRIVER=s3 (cloud deploys)

S3 itself has 11 nines of durability. Add:
- **Versioning enabled** on all production buckets
- **Cross-region replication** to a secondary region
- **Lifecycle policies**: transition to Glacier after 90 days for cold data
- **Object Lock** on backup buckets (immutable for 30 days)

#### When STORAGE_DRIVER=local (on-prem deploys)

Local disk requires manual durability + backup discipline:
- **Storage volume** on RAID-1 or RAID-10 (mirror, not stripe-only)
- **Daily `restic` snapshot** to off-site backup target (could be S3, B2, second server)
- Retention: 7 daily + 4 weekly + 6 monthly
- **Encrypted at rest** (restic default)
- **Disk monitoring**: alert at 85%, page at 95%
- **Test restore** monthly to verify backup integrity

```bash
# /etc/cron.daily/marketing-storage-backup
restic -r b2:yourplatform-backups:files backup /var/lib/marketing/files \
  --tag daily --password-file /etc/restic-password
restic -r b2:yourplatform-backups:files forget \
  --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
```

### Backup Testing

**A backup that isn't tested doesn't exist.** Schedule monthly restore drills:

1. First Monday of each month: PR-trained engineer restores latest backup to a separate RDS instance
2. Run smoke tests: can login? can query random workspace's data? does it match prod schema?
3. Document the restore in `runbooks/backup-drill-YYYY-MM.md`
4. If restore fails: SEV-1 incident

---

## Disaster Recovery

### DR Scenarios

| Scenario | Impact | Recovery Plan | RTO | RPO |
|---|---|---|---|---|
| Single EC2 instance fails | Auto-scaling replaces; no customer impact | None — automatic | < 5 min | 0 |
| Single AZ outage | Other AZ takes traffic; small latency blip | Auto-failover | < 5 min | 0 |
| MySQL/PostgreSQL primary fails | Replica promoted automatically | RDS Multi-AZ failover | < 2 min | 0 |
| Region outage | All services in region down | Failover to secondary region (Phase 4) | 1 hour | 5 min |
| Accidental data deletion | Customer data lost | PITR restore to point before deletion | 1 hour | 5 min |
| Ransomware/attack | Production compromised | Restore from immutable backup; full security audit | 4 hours | 24 hours |
| Catastrophic provider issue (AWS down regional) | Full outage | Migration to backup provider — multi-day | 24 hours | 24 hours |

### DR Runbook (`runbooks/disaster-recovery.md`)

```markdown
# Disaster Recovery Runbook

## Pre-recovery
1. Confirm incident severity with engineering lead
2. Open #incident-DR channel in Slack
3. Status page: update to "Investigating"
4. Customer comms: prepare templated email

## MySQL/PostgreSQL Total Loss
1. Identify last good snapshot or PITR point
2. RDS console → restore to new instance
3. Update DNS / connection string in ECS task definitions
4. Run smoke tests: SELECT COUNT(*) FROM core_workspaces, core_users
5. Bring services back online one at a time:
   marketing-core → seo-engine → others
6. Re-run failed Bull jobs from core_outbox table
7. Status page: "Resolved"

## Region Failure (Phase 4)
1. Update Route 53 / Cloudflare DNS to secondary region
2. Promote standby database in secondary region
3. Cold start ECS tasks in secondary region (takes 2-5 minutes)
4. Verify health checks across all services
5. Status page updates throughout
```

### Annual DR Exercise

- Simulate region failure on a weekend (notify customers)
- Execute the full runbook with no shortcuts
- Measure actual RTO/RPO vs. targets
- Document gaps in `dr-exercise-YYYY.md`

---

## High Availability

### App Tier

- Every microservice runs minimum 2 ECS tasks across 2 availability zones
- ALB health checks every 30 seconds; 2 consecutive failures → mark unhealthy
- Auto-scaling triggers: CPU > 70% or request rate > target

### Database Tier

- **PostgreSQL RDS Multi-AZ**: synchronous standby in different AZ, automatic failover
- **Read replicas**: 2 read replicas for read-heavy operations (analytics queries, list endpoints)
- **ClickHouse cluster**: 3 nodes with internal replication (factor 2)
- **Redis ElastiCache**: cluster mode, 3 shards × 2 nodes each (primary + replica per shard)
- **Elasticsearch**: not deployed in v1 (deferred to Phase 5+); when added: 3 master nodes + 2 data nodes per zone
- **File Storage**: per `STORAGE_DRIVER` — S3/R2 inherits provider HA; local disk requires NFS/EFS + RAID for HA

### No SPOF (Single Point of Failure) Audit

Every component must answer: "If this dies, what happens?"
- ALB: AWS-managed, multi-AZ
- Nginx: 2 instances behind ALB
- ECS tasks: 2+ per service
- MySQL/PostgreSQL: Multi-AZ with standby
- Redis: cluster mode
- ClickHouse: clustered
- S3: 11 nines of durability + cross-region replication
- Stripe webhooks: idempotent + replay via dashboard
- AI providers: fallback to alternate provider
- DataForSEO: cached SERP data still usable for 7 days

---

## Zero-Downtime Database Migrations

### The Problem

MySQL/PostgreSQL schema changes can lock tables. A 5-minute migration on a 100M-row table = 5 minutes of customer downtime. Unacceptable.

### Strategy: Expand-Migrate-Contract

```
PHASE 1 — Expand (add new schema):
  1. Deploy code that writes to BOTH old and new schema
  2. Backfill new schema from old in background
  3. Verify counts match

PHASE 2 — Migrate (read from new):
  1. Deploy code that reads from new schema
  2. Continue dual-write for rollback safety

PHASE 3 — Contract (remove old):
  1. Deploy code that writes ONLY to new schema
  2. After 1 week of confidence: DROP old column/table
```

### Example: Adding a Column

**Goal:** add `crm_contacts.lifetime_value DECIMAL(10,2)`

```
Step 1 — Migration (instant in MySQL/PostgreSQL 10.x):
  ALTER TABLE crm_contacts ADD COLUMN lifetime_value DECIMAL(10,2) NULL;
  (Online DDL with ALGORITHM=INSTANT — no table lock)

Step 2 — Deploy code that writes lifetime_value on new orders
Step 3 — Backfill historical:
  UPDATE crm_contacts SET lifetime_value = (SELECT SUM(amount) FROM customer_orders WHERE contact_id = ...)
  -- (customer_orders is illustrative — actual order table lives in the customer's e-commerce system,
  --  imported via integ_data_imports)
  Run in 10k-row chunks via Bull queue mkt-backfill-lifetime-value

Step 4 — Deploy code that uses lifetime_value
Step 5 — Make column NOT NULL with default (instant DDL)
```

### Tools

- **gh-ost** or **pt-online-schema-change** (Percona) for ALTER TABLE on large tables — copies table while writing dual to old + new, then swaps
- Triggered via CI/CD with feature-flagged code

### Migration Process

```bash
# 1. Engineer writes migration:
yarn migrate:create add-lifetime-value-to-contacts

# 2. PR reviewed
# 3. CI: tests run, including migration up + down
# 4. Manual approval from senior engineer
# 5. Deploy to staging
# 6. Test for 24 hours
# 7. Deploy to production via:
yarn migrate:prod  # logs to audit, uses gh-ost for large tables

# 8. Verify in monitoring
# 9. Old code/columns removed 1 week later (separate PR)
```

### Forbidden in Production

- `ALTER TABLE ... DROP COLUMN` without expand-contract
- `ALTER TABLE ... ADD CONSTRAINT` that requires table scan
- Renaming columns (always add new + migrate + drop old)
- Changing column types that require row rewrite

---

## Deployment Strategy

### Pipeline

```
git push origin feature-branch
  ↓
GitHub Actions:
  • yarn lint
  • yarn type-check
  • yarn test (unit + integration)
  • yarn test:isolation (cross-tenant safety)
  • yarn test:a11y (accessibility)
  • Snyk security scan
  • Build Docker images
  ↓
PR opened → CodeRabbit review + human review
  ↓
Merge to main →
  • Tag Docker image with commit SHA
  • Push to ECR
  • Deploy to staging automatically
  ↓
Smoke tests in staging (Playwright):
  • Login flow
  • One-Click Capture end-to-end
  • Send test email
  ↓
Manual promote to production (engineer clicks "Deploy" in GitHub Actions)
  ↓
Blue-green deploy:
  • New ECS service tasks spin up (green)
  • Health checks
  • ALB shifts traffic 10% → 50% → 100% over 10 minutes
  • Old tasks (blue) drain → terminate
  ↓
Sentry watches for error spike
  ↓
Auto-rollback if error rate > baseline + 50%
```

### Frequency

- Multiple production deploys per day per service
- Friday afternoon freeze (no risky deploys 14:00 onward UTC)
- No deploys during incidents

### Feature Flags

Risky changes ship behind feature flags (not deploys):
- Build a `core_feature_flags` table + Redis-cached service
- Roll out 1% → 10% → 50% → 100% over days
- Kill switch: disable a feature in seconds without redeploy

```javascript
if (await isFeatureEnabled('one_click_v2', workspace_id)) {
  return useNewOneClick();
} else {
  return useOldOneClick();
}
```

---

## CDN & Edge

### Cloudflare Configuration

| Setting | Value | Why |
|---|---|---|
| **DNS** | Cloudflare-managed | Easy custom-domain setup |
| **SSL/TLS** | Full (strict) | End-to-end encryption |
| **HSTS** | Enabled, max-age=63072000 | Browser-enforced HTTPS |
| **WAF (Pro tier)** | Enabled | OWASP Core Rule Set |
| **Bot Fight Mode** | Enabled | Block bad bots |
| **Rate Limiting** | 100 req/10s per IP | Layer 7 DDoS |
| **Caching** | Aggressive on `/static/*`, none on `/api/*` | Static assets cached, API not |
| **Workers** | Custom routing logic for white-label domains | Map agency domains to correct theme |
| **Argo Smart Routing** | Enabled (Phase 3) | Faster global routes |

### Static Asset Strategy

- React + Vite SPA builds with `vite build` → static files served via Cloudflare Pages / S3+CloudFront (immutable hashed filenames, 1-year cache)
- Astro marketing-site builds with `astro build` → static files; Cloudflare Pages
- Images via Cloudflare Polish (Pro plan) → automatic WebP/AVIF conversion + compression; `<img loading="lazy">` everywhere
- Fonts self-hosted: Inter `.woff2` files in `public/fonts/`, preloaded via `<link rel="preload">` in `index.html` (no external font requests)
- JS/CSS hash-versioned (`main.abc123.js`) → 1-year cache headers

### Tracking Script CDN

- `cdn.yourplatform.com/track.js` served via Cloudflare with 5-minute TTL
- Workspace-specific config injected via Cloudflare Workers (no DB lookup on every page load)

---

## Multi-Region Plan

### Phase 1-3: Single Region (EU-West-2, London)

- Latency for US customers: 80-150ms (acceptable)
- Cheaper to operate
- Simpler GDPR posture (all data in EU)

### Phase 4: Multi-Region

| Region | Primary For | Backup For |
|---|---|---|
| eu-west-2 (London) | EU, UK, Africa, Middle East | global |
| us-east-1 (Virginia) | North America, South America | EU |
| ap-southeast-1 (Singapore) | Asia, Australia | US |

### Data Strategy

- **Per-workspace region affinity**: customer chooses region at signup, data lives in that region
- **Cross-region replication for DR only**, not active-active
- **Stateless services** can run in any region; they connect to the region's local data
- **Cloudflare DNS** routes users to nearest region

### Enterprise EU-Only Option

Some EU enterprises require ALL data stays in EU. The platform offers:
- Workspace region locked to `eu-west-2`
- Sub-processors restricted to EU-data-residency options (OpenAI Enterprise EU, SendGrid EU)
- DPA reflects this constraint

---

## Scaling Thresholds

### When to Take Each Action

| Threshold | Action |
|---|---|
| 100 workspaces | Add monitoring dashboards; basic observability |
| 1,000 workspaces | Move to managed Postgres/MySQL (RDS); separate Redis prod from dev |
| 5,000 workspaces | Add MySQL/PostgreSQL read replicas; dedicated ClickHouse cluster (not shared) |
| 10,000 workspaces | Shard MySQL/PostgreSQL by workspace_id; CDN tracking script via Workers |
| 25,000 workspaces | Multi-region (Phase 4) |
| 50,000 workspaces | Dedicated cluster per region; data warehousing for cross-region analytics |
| 100,000 workspaces | Kubernetes; service mesh (Istio); chaos engineering |

### Cost Projections

| Workspaces | Monthly Infra Cost | Per-Workspace Cost |
|---|---|---|
| 100 | $500 | $5 |
| 1,000 | $2,000 | $2 |
| 10,000 | $15,000 | $1.50 |
| 100,000 | $80,000 | $0.80 |

(Excludes AI API costs which scale per-usage)

---

## Database Pooling

### Connection Pools

Sequelize default pool: 5 connections per process. With 14 services × 4 instances each × 5 = **280 connections** to MySQL/PostgreSQL. RDS Medium = 1700 max. Headroom OK.

```javascript
// Sequelize config
{
  pool: {
    max: 10,              // max connections per process
    min: 2,               // keep warm
    acquire: 30000,       // max time waiting for a connection
    idle: 10000,          // close idle after 10s
  }
}
```

### PgBouncer / ProxySQL (Phase 3+)

When connections approach RDS limit:
- Deploy **ProxySQL** in front of MySQL/PostgreSQL
- Connection multiplexing: 5,000 app connections → 200 backend connections
- Query routing (reads → replicas, writes → primary)

---

## Read Replicas

### Setup

```
MySQL/PostgreSQL Primary (writes + low-latency reads)
    ├── Replica 1 (lag-tolerant reads — analytics list endpoints)
    └── Replica 2 (long-running reports, bulk exports)
```

### Routing in Sequelize

```javascript
const sequelize = new Sequelize({
  dialect: process.env.DB_DIALECT || 'mysql',     // 'mysql' in dev, 'postgres' in production
  replication: {
    read: [
      { host: 'replica-1.rds...', username: 'app_read', password: '...' },
      { host: 'replica-2.rds...', username: 'app_read', password: '...' },
    ],
    write: { host: 'primary.rds...', username: 'app_write', password: '...' }
  },
  pool: { max: 10, min: 2 }
});

// Sequelize auto-routes SELECTs to replicas, writes to primary
```

### Lag Awareness

```javascript
// Critical reads after writes must use primary (read-after-write consistency)
const newKeyword = await MktKeyword.create({...});
const verify = await MktKeyword.findByPk(newKeyword.id, { useMaster: true });

// Analytics queries can tolerate lag
const stats = await MktKeyword.findAll({ where: {...} });  // → replica
```

### Lag Monitoring

- Alert if replica lag > 30 seconds
- Replica with > 5min lag automatically de-pooled
- Re-pooled when caught up
