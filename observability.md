# 📡 Observability
## Logs, Tracing, Metrics, SLOs, and Runbooks

> 14 microservices × thousands of workspaces = millions of events per day. Without proper observability, debugging is impossible.

---

## 📋 Table of Contents

1. [The Three Pillars](#the-three-pillars)
2. [Structured Logging](#structured-logging)
3. [Distributed Tracing](#distributed-tracing)
4. [Metrics & Dashboards](#metrics--dashboards)
5. [SLO/SLI Definitions](#slosli-definitions)
6. [Alerting Strategy](#alerting-strategy)
7. [Status Page](#status-page)
8. [Runbooks](#runbooks)
9. [Tools & Cost](#tools--cost)

---

## The Three Pillars

```
                       ┌────────────────────┐
                       │   USER REPORTS BUG  │
                       └──────────┬─────────┘
                                  │
   ┌──────────────────────────────┼──────────────────────────────┐
   ▼                              ▼                              ▼
┌─────────┐                  ┌─────────┐                   ┌──────────┐
│  LOGS   │                  │ TRACES  │                   │ METRICS  │
│         │                  │         │                   │          │
│ What    │                  │ Why     │                   │ How      │
│ happened│                  │ slow?   │                   │ often?   │
│         │                  │ Which   │                   │ Trends?  │
│ For one │                  │ service │                   │ Spikes?  │
│ request │                  │ failed? │                   │          │
└─────────┘                  └─────────┘                   └──────────┘
   Pino                        OpenTelemetry                Prometheus
   + Loki/Datadog              + Jaeger/Tempo               + Grafana
```

---

## Structured Logging

### Library: pino

**Why pino?**
- 5× faster than `winston` (less CPU overhead per log line at scale)
- JSON-native output (machine-readable)
- Async logging (doesn't block request handling)
- Standard among modern Node.js services

```javascript
// shared-middleware/logger.js
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    service: process.env.SERVICE_NAME,         // e.g., 'marketing-core'
    env: process.env.NODE_ENV,                 // 'production' | 'staging' | 'dev'
    region: process.env.AWS_REGION,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    // Auto-scrub PII/secrets from log lines
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.password_confirmation',
      'req.body.refresh_token',
      'req.body.access_token',
      'req.body.oauth_access_token',
      '*.api_key',
      '*.stripe_*',
      '*.totp_secret',
      'res.headers["set-cookie"]',
    ],
    censor: '[REDACTED]',
  },
});

module.exports = logger;
```

### Log Levels

| Level | Use |
|---|---|
| `fatal` | Process about to crash |
| `error` | Request failed — needs investigation |
| `warn` | Recovered from failure (e.g., AI provider fallback, retry succeeded) |
| `info` | Significant business event (user signed up, campaign launched, workspace created) |
| `debug` | Verbose flow data (off in production by default; turn on per workspace_id for debugging) |
| `trace` | Method entry/exit (only during local development) |

### Required Fields on Every Log

```javascript
logger.info({
  request_id: req.id,           // ULID from request middleware
  workspace_id: req.workspaceId,
  user_id: req.user?.id,
  duration_ms: 142,
  path: req.path,
  method: req.method,
  status: 200,
  ip: req.ip,
}, 'Campaign created');
```

### Log Sampling

At scale, log volume becomes expensive. Sampling rules:
- `info` logs: 10% sampled per route (configurable)
- `error` logs: 100% (never sample errors)
- `debug`: only emitted when `?debug=true` query param + admin role

### Log Storage

| Phase | Solution |
|---|---|
| **Phase 1 (MVP)** | Pino → stdout → Docker logs → CloudWatch Logs (US$0.50/GB ingest + $0.03/GB stored/month) |
| **Phase 2** | Grafana Loki (self-hosted, S3-backed; ~$200/mo at 100GB/month) |
| **Phase 3** | Datadog or Better Stack (managed; ~$3-5/GB/month with full search + retention) |

### Retention
- `error`/`fatal`: 90 days
- `warn`: 60 days
- `info`: 30 days
- `debug`: 7 days

---

## Distributed Tracing

A single user request can flow through 5+ services. Tracing shows the full path.

### Library: OpenTelemetry

```javascript
// shared-middleware/tracing.js
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

const sdk = new NodeSDK({
  serviceName: process.env.SERVICE_NAME,
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },  // noisy
    }),
  ],
});

sdk.start();
```

Auto-instruments: Express, Sequelize, Redis, ioredis, http, fetch, BullMQ.

### Manual Spans for Business Logic

```javascript
const { trace } = require('@opentelemetry/api');
const tracer = trace.getTracer('content-ai');

async function generateBlogPost(prompt, workspace_id) {
  return tracer.startActiveSpan('content-ai.generateBlogPost', async (span) => {
    span.setAttributes({ 'workspace.id': workspace_id, 'prompt.length': prompt.length });

    try {
      const result = await aiProvider.generate(prompt);
      span.setAttribute('tokens_used', result.tokens);
      span.setStatus({ code: 1 });  // OK
      return result;
    } catch (err) {
      span.recordException(err);
      span.setStatus({ code: 2, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  });
}
```

### Trace Context Propagation

Every inter-service call must propagate the trace context via `traceparent` HTTP header. Auto-handled by axios and fetch instrumentations.

```
User Request
  ↓ traceparent: 00-abc123...-def456-01
React SPA via Axios → Nginx /api/* proxy
  ↓ traceparent: 00-abc123...-ghi789-01    (same trace, new span)
marketing-core
  ↓ traceparent: 00-abc123...-jkl012-01
campaign-manager
  ↓ traceparent: 00-abc123...-mno345-01
content-ai
  → OpenAI API
  ← span ends
← traces returned
```

### Tools

| Phase | Tool |
|---|---|
| **Phase 1** | Jaeger (self-hosted, free) |
| **Phase 2** | Grafana Tempo (self-hosted, S3-backed) |
| **Phase 3** | Datadog APM or Honeycomb |

### Sampling

- 100% trace sampling for errors
- 10% for normal requests
- 100% for SEV-1 incident investigation (toggle via flag)

---

## Metrics & Dashboards

### Library: prom-client

```javascript
// shared-middleware/metrics.js
const promClient = require('prom-client');
const register = new promClient.Registry();

promClient.collectDefaultMetrics({ register });

const httpDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status', 'service'],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10],
  registers: [register],
});

const aiTokensUsed = new promClient.Counter({
  name: 'ai_tokens_used_total',
  help: 'Total AI tokens consumed',
  labelNames: ['provider', 'model', 'workspace_id'],
  registers: [register],
});

const bullJobsProcessed = new promClient.Counter({
  name: 'bull_jobs_processed_total',
  help: 'Total Bull jobs processed',
  labelNames: ['queue', 'status'],
  registers: [register],
});

const bullJobDuration = new promClient.Histogram({
  name: 'bull_job_duration_seconds',
  help: 'Bull job processing duration',
  labelNames: ['queue'],
  buckets: [0.1, 1, 5, 30, 60, 300, 600, 3600],
  registers: [register],
});

// Exposed at /metrics on each service
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

### Critical Business Metrics

| Metric | Type | What it tracks |
|---|---|---|
| `mkt_signups_total` | Counter | New workspace creations |
| `mkt_activation_total` | Counter | Workspaces that completed onboarding |
| `mkt_one_click_capture_runs_total` | Counter | Flagship feature usage |
| `mkt_one_click_capture_duration_seconds` | Histogram | End-to-end time of flagship |
| `campaign_launches_total` | Counter | Campaigns going live (by channel) |
| `mkt_ai_tokens_used_total` | Counter | Per-provider, per-model — cost tracking |
| `mkt_ai_cost_usd_total` | Counter | Direct $ spend by provider |
| `seo_crawls_total` | Counter | Pages crawled (resource intensive) |
| `mkt_emails_sent_total` | Counter | Per workspace — billing relevance |
| `social_posts_published_total` | Counter | Per platform |
| `mkt_active_workspaces_gauge` | Gauge | Currently active (logged in within 7d) |
| `mkt_mrr_usd_gauge` | Gauge | Monthly recurring revenue |
| `mkt_churn_rate_gauge` | Gauge | 30-day rolling churn |

### Standard Grafana Dashboards (build these on day 1)

**Dashboard 1: Service Health (per service)**
- Request rate (req/sec)
- Error rate (% 5xx responses)
- P50 / P95 / P99 latency
- Active database connections
- Memory usage
- CPU usage

**Dashboard 2: Business Metrics**
- Today's signups vs. yesterday vs. 7-day avg
- Active workspaces (last 24h)
- MRR (live from Stripe)
- One-Click Capture: runs today + success rate
- Top 10 workspaces by API usage

**Dashboard 3: Queue Health**
- Job throughput per queue
- Job duration P95 per queue
- Backlog (waiting + delayed jobs) per queue
- DLQ (dead letter queue) size — should be 0

**Dashboard 4: AI Cost**
- Tokens consumed per provider per hour
- $ spend per provider per day
- Top 20 workspaces by AI usage (potential cost-cap candidates)
- Error rate per provider (signals outage)

**Dashboard 5: Database**
- Slow queries (> 1 second)
- Connection pool utilisation
- Replication lag (if read replicas configured)
- Table sizes and growth rate
- Lock waits

---

## SLO/SLI Definitions

Service Level Objectives — promises to customers, tracked with Service Level Indicators.

| SLI | SLO | Window | Error Budget |
|---|---|---|---|
| **API availability** | 99.9% | Rolling 30d | 43.2 minutes/month |
| **API latency (P95 < 500ms)** | 99% of requests | Rolling 7d | — |
| **One-Click Capture success** | 95% complete within 120s | Rolling 30d | — |
| **Email delivery (to SendGrid)** | 99.5% within 5 minutes of scheduled time | Rolling 7d | — |
| **Social post publish** | 98% within 1 minute of scheduled time | Rolling 7d | — |
| **Analytics event ingest** | 99.99% accepted | Rolling 24h | — |
| **Dashboard load time (P95)** | < 3 seconds | Rolling 7d | — |
| **Cron job freshness** | All daily crons run within scheduled hour | Rolling 7d | — |

**Error budget policy:**
- Burned > 50% → halt risky deploys, increase observation
- Burned > 100% (SLO breached) → all-hands incident review

**Public SLA (Agency plan customers):**
- 99.9% uptime guaranteed; 5% credit per 0.1% below
- 99.5% for Pro plan
- Best-effort for Starter and trial

---

## Alerting Strategy

### Alert Levels

| Severity | Channel | Acknowledge SLA |
|---|---|---|
| **P1** | PagerDuty (phone call) + Slack #incidents | 5 minutes |
| **P2** | Slack #incidents + email | 30 minutes |
| **P3** | Slack #engineering | Next business day |
| **P4** | Email digest weekly | Next sprint |

### Alert Rules (Prometheus AlertManager)

```yaml
groups:
  - name: critical
    rules:
      - alert: ServiceDown
        expr: up{job=~"marketing-.+"} == 0
        for: 2m
        labels: { severity: P1 }
        annotations:
          summary: "{{ $labels.job }} is down"
          runbook: https://runbooks.yourplatform.com/service-down

      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m])) by (service)
          / sum(rate(http_requests_total[5m])) by (service) > 0.05
        for: 5m
        labels: { severity: P1 }
        annotations:
          summary: "{{ $labels.service }} 5xx error rate > 5%"

      - alert: DatabaseConnectionsExhausted
        expr: sequelize_pool_connections_used / sequelize_pool_connections_max > 0.9
        for: 5m
        labels: { severity: P2 }

      - alert: BullQueueBacklog
        expr: bull_queue_waiting_count > 10000
        for: 10m
        labels: { severity: P2 }
        annotations:
          summary: "Queue {{ $labels.queue }} backlog: {{ $value }} jobs"

      - alert: AISpendSpike
        expr: increase(mkt_ai_cost_usd_total[1h]) > 100
        for: 5m
        labels: { severity: P2 }
        annotations:
          summary: "AI spend exceeded $100/hour — check for abuse"

      - alert: WorkspaceIsolationFailure
        expr: increase(workspace_isolation_breach_total[1h]) > 0
        for: 1m
        labels: { severity: P1 }
        annotations:
          summary: "Workspace isolation breach detected — IMMEDIATE INVESTIGATION"

      - alert: CertificateExpiringSoon
        expr: cert_expires_in_days < 14
        for: 1h
        labels: { severity: P3 }

      - alert: DiskSpace
        expr: disk_used_percent > 85
        for: 10m
        labels: { severity: P2 }
```

### Alert Hygiene
- **Don't alert on metrics no one will act on** — every alert needs a runbook and an action
- **Page only on user-impacting issues** — internal noise is muted
- **Group related alerts** — one notification per incident, not 50 emails
- **Burn-rate alerts** — alert when error budget burns 2× too fast (not just when budget exhausted)

---

## Status Page

Public-facing uptime communication: `status.yourplatform.com`

**Tool: Statuspage.io or Better Uptime ($30-$100/month)**

### Components to Track

| Component | Status Indicator |
|---|---|
| Web Dashboard | Up / Down / Degraded |
| API | Up / Down / Degraded |
| One-Click Capture | Up / Down / Degraded |
| Email Sending | Up / Down / Degraded |
| Social Publishing | Up / Down / Degraded |
| Analytics Tracking | Up / Down / Degraded |
| AI Generation | Up / Down / Degraded (often "Degraded" when OpenAI has issues) |
| Reports | Up / Down / Degraded |
| Webhooks | Up / Down / Degraded |
| Customer API | Up / Down / Degraded |

### Auto-Update from Monitoring
Statuspage components are linked to Prometheus alerts. If `ServiceDown` fires for `email-hub` for 2+ minutes, "Email Sending" component auto-updates to "Major Outage".

### Customer Notifications
Customers can subscribe via email or SMS:
- Notify on **any** incident
- Notify only on **major** incidents
- Per-component subscriptions (e.g., only care about Email)

---

## Runbooks

Every alert links to a runbook. Runbooks are stored as Markdown files in the repo (`/runbooks/`) and served at `runbooks.yourplatform.com` (internal).

### Sample Runbook: `service-down.md`

```markdown
# Service Down

**Alert:** `ServiceDown`
**Severity:** P1
**On-call action SLA:** 5 minutes

## Symptoms
- Prometheus reports `up{job="..."}` == 0
- Customer reports 502/503 errors
- Status page shows component down

## Quick Triage (60 seconds)
1. SSH to host: `ssh ops@<host>`
2. Check container: `docker ps | grep <service>`
3. Check logs: `docker logs <container_id> --tail 200`

## Likely Causes
1. **Out of memory** → check `free -m`; restart container; investigate post-incident
2. **Database connection pool exhausted** → check `SELECT * FROM information_schema.processlist`
3. **Disk full** → check `df -h`
4. **Recent deploy broke** → check `git log` for last hour

## Quick Recovery
```bash
# Option A: Restart service (low risk)
docker restart <container>

# Option B: Rollback last deploy
cd /opt/marketing
git revert HEAD --no-edit
docker compose up -d --build <service>

# Option C: Scale up (if traffic spike)
docker compose up -d --scale <service>=3
```

## After Recovery
1. Confirm health: `curl -s http://localhost:<port>/health`
2. Update status page
3. Post in #incidents with summary
4. Write incident report in /incidents/
5. Schedule post-mortem within 48h
```

### Required Runbooks

| Runbook | Trigger |
|---|---|
| `service-down.md` | `ServiceDown` alert |
| `high-error-rate.md` | `HighErrorRate` alert |
| `database-slow.md` | `DatabaseQuerySlow` alert |
| `queue-backlog.md` | `BullQueueBacklog` alert |
| `ai-provider-outage.md` | OpenAI / Claude / Gemini outage |
| `oauth-token-mass-revoke.md` | OAuth tokens flagged as compromised |
| `ddos-incident.md` | Cloudflare reports DDoS attack |
| `data-breach.md` | Suspected unauthorised data access |
| `stripe-webhook-failures.md` | Stripe events not being processed |
| `mass-email-bounce.md` | SendGrid reputation drop |
| `disk-full.md` | `DiskSpace` alert |
| `certificate-expiry.md` | `CertificateExpiringSoon` alert |
| `workspace-isolation-breach.md` | Critical incident — full IR procedure |

---

## Tools & Cost

### Stack (estimated monthly cost at 1,000 paying workspaces)

| Tool | Purpose | Phase 1 | Phase 3 |
|---|---|---|---|
| **Sentry** | Error tracking | $80 (Team) | $400 (Business) |
| **CloudWatch Logs** | Log storage | $50 | — |
| **Grafana Loki (self-hosted)** | Log aggregation | — | $200 |
| **Grafana Cloud / self-hosted Grafana** | Dashboards | $50 | $300 |
| **Prometheus (self-hosted)** | Metrics | $20 (small VM) | $100 (HA pair) |
| **Jaeger / Tempo** | Tracing | $0 (self-hosted) | $200 |
| **Statuspage.io** | Status page | $29 | $99 |
| **PagerDuty** | On-call paging | $21/user (3 users = $63) | $187 |
| **Better Stack** | Uptime monitor + logs | $79 | $250 |
| **Total** | | ~$370/mo | ~$1,800/mo |

### Phase 1 Quick Setup

For MVP, simplify to:
- Sentry (errors)
- Grafana Cloud free tier (metrics + logs + traces; 10k series, 50GB logs, 50GB traces)
- Statuspage.io
- PagerDuty (3 users)

Total: ~$200/mo.

---

## Engineering Practices

### Pre-Production Checklist for Every PR
- [ ] New endpoint has request_id propagation
- [ ] New endpoint emits at least one `info` log on success
- [ ] New endpoint emits `error` log with sufficient context on failure
- [ ] Manual span added if endpoint contains non-trivial business logic
- [ ] Prometheus counter incremented for business-significant actions
- [ ] Alert added if SLA matters (e.g., new cron job → "did it run today?" alert)

### On-Call Expectations
- Engineer on rotation 1 week at a time
- Acknowledge P1 page within 5 minutes
- Resolve or escalate P1 within 1 hour
- Write incident retrospective within 48h
- Post-week handoff to next on-call

### Incident-Driven Improvements
After every SEV-1 or SEV-2 incident:
1. Add monitoring that would have detected it earlier
2. Add automation that would have remediated it (or made remediation faster)
3. Update runbooks
4. Share lessons in monthly engineering review
