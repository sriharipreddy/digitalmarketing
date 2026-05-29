# 🗺️ Architecture Diagrams
## C4 Model (Context · Containers · Components) + Sequence Diagrams

> Visual reference for how the 14 services connect, communicate, and serve customers.

---

## 📋 Table of Contents

1. [C4 Level 1 — System Context](#c4-level-1--system-context)
2. [C4 Level 2 — Containers](#c4-level-2--containers)
3. [C4 Level 3 — Components (3 critical services)](#c4-level-3--components)
4. [Service Dependency Graph](#service-dependency-graph)
5. [Sequence: User Login](#sequence-user-login)
6. [Sequence: One-Click Market Capture](#sequence-one-click-market-capture)
7. [Sequence: Webhook Delivery with Retry](#sequence-webhook-delivery)
8. [Sequence: DSAR Data Export](#sequence-dsar-data-export)
9. [Sequence: Workspace Deletion / RTBF](#sequence-workspace-deletion--rtbf)
10. [Data Flow: Analytics Event Ingestion](#data-flow-analytics-event-ingestion)
11. [Network Topology](#network-topology)

---

## C4 Level 1 — System Context

```
                                  ┌──────────────────────┐
                                  │   Marketing          │
                                  │   Platform           │
                                  │   (the system)       │
                                  └──┬───┬───┬───┬───┬───┘
       ┌────────────┐                │   │   │   │   │
       │  Client    │ ─── uses ──────┤   │   │   │   │
       │  Owner     │                │   │   │   │   │
       └────────────┘                │   │   │   │   │
                                     │   │   │   │   │
       ┌────────────┐                │   │   │   │   │
       │  Agency    │ ─── manages ───┤   │   │   │   │
       │  Owner     │                │   │   │   │   │
       └────────────┘                │   │   │   │   │
                                     │   │   │   │   │
       ┌────────────┐                │   │   │   │   │
       │  Team      │ ─── uses ──────┤   │   │   │   │
       │  Member    │                │   │   │   │   │
       └────────────┘                │   │   │   │   │
                                     │   │   │   │   │
       ┌────────────┐                │   │   │   │   │
       │  Platform  │ ─── operates ──┘   │   │   │   │
       │  Admin     │                    │   │   │   │
       └────────────┘                    │   │   │   │
                                         │   │   │   │
       ┌────────────┐                    │   │   │   │
       │End-Customer│ ◄── tracked by ────┘   │   │   │
       │ (the       │                        │   │   │
       │  customer's│                        │   │   │
       │  customer) │                        │   │   │
       └────────────┘                        │   │   │
                                             │   │   │
       ┌────────────┐                        │   │   │
       │  Developer │ ─── integrates ────────┘   │   │
       │ (API user) │     via REST API           │   │
       └────────────┘                            │   │
                                                 │   │
                       ┌─────────────────────────┘   │
                       │                             │
                       ▼                             ▼
   ┌──────────────────────────────────┐    ┌──────────────────────────────────┐
   │      External Marketing APIs     │    │       Infrastructure             │
   │                                  │    │                                  │
   │  • Google (Search Console, Ads,  │    │  • AWS (EC2, RDS, S3, KMS, ECS)  │
   │    My Business, Analytics 4,     │    │  • Cloudflare (CDN, WAF, DNS)    │
   │    YouTube)                      │    │  • Sentry (error monitoring)     │
   │  • Meta (Facebook, Instagram)    │    │                                  │
   │  • LinkedIn                      │    └──────────────────────────────────┘
   │  • Twitter / X                   │
   │  • TikTok                        │    ┌──────────────────────────────────┐
   │  • Stripe (payments)             │    │       AI Providers               │
   │  • Twilio (SMS)                  │    │                                  │
   │  • SendGrid (email)              │    │  • OpenAI                        │
   │  • 360dialog (WhatsApp)          │    │  • Anthropic                     │
   │  • DataForSEO                    │    │  • Google Gemini                 │
   │  • PR Newswire                   │    │  • Stability AI                  │
   │  • Firebase (push)               │    │                                  │
   └──────────────────────────────────┘    └──────────────────────────────────┘
```

### Actors

| Actor | Description | Authentication |
|---|---|---|
| **Client Owner** | Business owner using the platform directly | Email/password + optional 2FA |
| **Agency Owner** | Marketing agency serving multiple clients | Email/password + mandatory 2FA |
| **Team Member** | Editor/Analyst/Viewer invited by owner | Email/password + optional 2FA |
| **Platform Admin** | Platform operator (you) | Email/password + mandatory 2FA + IP allowlist |
| **End-Customer** | Customer's customer (visitor on their website) | Anonymous (tracked via cookie) |
| **Developer** | Integrating customer via public API | API key (mkt_live_*) or OAuth 2.0 |

---

## C4 Level 2 — Containers

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                          MARKETING PLATFORM (System)                         ║
║                                                                              ║
║   ┌──────────────────────────────────────────────────────────────────┐       ║
║   │  Dashboard SPA (React 18 + Vite 5 + MUI v6 + React Router 6)     │       ║
║   │  Marketing Site (Astro 4 SSG)        Landing Renderer (Express)  │       ║
║   │  • SSR for public pages                                          │       ║
║   │  • App router (/dashboard, /agency, /admin)                      │       ║
║   │  • White-label branding per workspace                            │       ║
║   └──────────────────────────────┬───────────────────────────────────┘       ║
║                                  │ HTTPS                                     ║
║   ┌──────────────────────────────▼───────────────────────────────────┐       ║
║   │  Cloudflare (Edge)  — WAF · DDoS · CDN · Custom Domains          │       ║
║   └──────────────────────────────┬───────────────────────────────────┘       ║
║                                  │                                           ║
║   ┌──────────────────────────────▼───────────────────────────────────┐       ║
║   │  Nginx (Reverse Proxy)  — SSL · Rate Limiting · Routing          │       ║
║   └─┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬─┬─┘       ║
║     │    │    │    │    │    │    │    │    │    │    │    │    │ │         ║
║   ┌─▼──┐┌▼──┐┌▼──┐┌▼──┐┌▼──┐┌▼──┐┌▼──┐┌▼──┐┌▼──┐┌▼──┐┌▼──┐┌▼──┐┌▼─▼──┐      ║
║   │MKT-││SEO││CAI││CMP││ANL││SOC││EMA││INT││AFF││INF││CRM││MED││NTF─+║      ║
║   │CORE││3101││3102││3103││3104││3105││3106││3107││3108││3109││3110││3111+│║      ║
║   │3100││    ││    ││    ││    ││    ││    ││    ││    ││    ││    ││ INT │║      ║
║   └─┬──┘└┬──┘└┬──┘└┬──┘└┬──┘└┬──┘└┬──┘└┬──┘└┬──┘└┬──┘└┬──┘└┬──┘└┬┬──┘      ║
║     │    │    │    │    │    │    │    │    │    │    │    │    │ │         ║
║     └────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┘ │         ║
║          14 Node.js / Express services (each in its own container)│         ║
║                                                                   │         ║
║   ┌───────────────────┬───────────────────┬────────────────────┐  │         ║
║   ▼                   ▼                   ▼                    ▼  │         ║
║ ┌────────┐        ┌────────┐         ┌────────────┐     ┌────────┐│         ║
║ │ MySQL/PG │        │ Redis  │         │ClickHouse  │     │ (ES P5+)││         ║
║ │(primary│        │(cache +│         │ (search)   │     │(analytic│         ║
║ │ + repl)│        │ queues)│         │            │     │ events)││         ║
║ └────────┘        └────────┘         └────────────┘     └────────┘│         ║
║                                                                   │         ║
║                              ┌─────────┐                          │         ║
║                              │ Storage │ ◄── pluggable: S3 (cloud) OR local │
║                              │ Driver  │     disk (on-prem). Same code.     ║
║                              │ (files) │                                    ║
║                              └─────────┘                                    ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

         External APIs (called from various services):
         OpenAI · Anthropic · Gemini · Stripe · SendGrid · Twilio · Firebase ·
         360dialog · DataForSEO · Meta Graph · LinkedIn · Twitter · TikTok ·
         YouTube Data · Google Search Console · Google Ads · PR Newswire
```

### Service Port Map

| Port | Service | Tier |
|---|---|---|
| 3000 | web (React + Vite SPA — static; dev port only) | 1 |
| 3001 | marketing-site (Astro SSG — static; dev port only) | 1 |
| 3200 | landing-renderer (Express SSR) | 1 |
| 3100 | marketing-core | 1 |
| 3101 | seo-engine | 2 |
| 3102 | content-ai | 1 |
| 3103 | campaign-manager | 1 |
| 3104 | analytics-engine | 1 |
| 3105 | social-hub | 2 |
| 3106 | email-hub | 1 |
| 3107 | intelligence | 3 |
| 3108 | affiliate-hub | 2 |
| 3109 | influencer-hub | 3 |
| 3110 | crm-automation | 1 |
| 3111 | media-hub | 2 |
| 3112 | notification-service | 2 |
| 3113 | integration-service | 1 |

---

## C4 Level 3 — Components

### campaign-manager Internals

```
┌────────────────────────────────────────────────────────────────────┐
│  campaign-manager (Port 3103)                                      │
│                                                                    │
│  ┌──────────────────────────┐  ┌─────────────────────────────┐    │
│  │  Routes Layer            │  │  Middleware                 │    │
│  │  • /campaigns            │──│  • passport-jwt            │    │
│  │  • /one-click-capture    │  │  • workspace-guard         │    │
│  │  • /ad-creatives         │  │  • require-permission      │    │
│  │  • /webinars             │  │  • plan-guard              │    │
│  └──────────┬───────────────┘  └─────────────────────────────┘    │
│             │                                                      │
│  ┌──────────▼──────────────────────────────────────────────┐      │
│  │  Controllers (thin)                                     │      │
│  │  • campaign.controller                                  │      │
│  │  • oneclick.controller   (SSE streaming)                │      │
│  │  • adcreative.controller                                │      │
│  └──────────┬──────────────────────────────────────────────┘      │
│             │                                                      │
│  ┌──────────▼──────────────────────────────────────────────┐      │
│  │  Services (business logic)                              │      │
│  │  • campaign.service                                     │      │
│  │  • oneclick-orchestrator.service                        │      │
│  │  • google-ads.service                                   │      │
│  │  • meta-ads.service                                     │      │
│  │  • linkedin-ads.service                                 │      │
│  │  • tiktok-ads.service                                   │      │
│  │  • utm-builder.service                                  │      │
│  │  • ab-test.service                                      │      │
│  └────┬─────────────────┬─────────────────┬────────────────┘      │
│       │                 │                 │                        │
│  ┌────▼────┐      ┌────▼────┐      ┌────▼────────────┐            │
│  │ Models  │      │ Queues  │      │ Event Publisher │            │
│  │ (Sequel)│      │ (Bull)  │      │                 │            │
│  │         │      │ mkt-    │      │ → Redis Pub/Sub │            │
│  │ mkt_*   │      │ oneclic │      │ → core_outbox    │            │
│  └─────────┘      └─────────┘      └─────────────────┘            │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
        │                  │                       │
        ▼                  ▼                       ▼
   MySQL/PostgreSQL            Redis (queues)        Other services
                                            (content-ai, seo-engine,
                                             social-hub, email-hub
                                             via service-to-service JWT)
```

### crm-automation Internals

```
┌────────────────────────────────────────────────────────────────────┐
│  crm-automation (Port 3110)                                        │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │  Routes                                                   │     │
│  │  • /contacts (CRUD + bulk)                                │     │
│  │  • /workflows (CRUD + builder JSON)                       │     │
│  │  • /forms (CRUD + public /submit endpoint)                │     │
│  │  • /deals (pipeline)                                      │     │
│  │  • /scoring-rules                                         │     │
│  └──────────────────────┬───────────────────────────────────┘     │
│                         │                                          │
│  ┌──────────────────────▼───────────────────────────────────┐     │
│  │  Services                                                 │     │
│  │  ┌─────────────────────────────────────────────────┐     │     │
│  │  │  contact.service                                │     │     │
│  │  │   • create / update / delete / bulk upsert      │     │     │
│  │  │   • lifecycle stage transitions                 │     │     │
│  │  │   • emit events                                 │     │     │
│  │  └─────────────────────────────────────────────────┘     │     │
│  │  ┌─────────────────────────────────────────────────┐     │     │
│  │  │  workflow.service                               │     │     │
│  │  │   • parse React Flow JSON → executable steps    │     │     │
│  │  │   • enrol contacts                              │     │     │
│  │  │   • process next step (Bull worker)             │     │     │
│  │  └─────────────────────────────────────────────────┘     │     │
│  │  ┌─────────────────────────────────────────────────┐     │     │
│  │  │  lead-scoring.service                           │     │     │
│  │  │   • apply scoring rules to events               │     │     │
│  │  │   • decay over time                             │     │     │
│  │  │   • emit threshold-crossed events               │     │     │
│  │  └─────────────────────────────────────────────────┘     │     │
│  │  ┌─────────────────────────────────────────────────┐     │     │
│  │  │  form.service                                   │     │     │
│  │  │   • CAPTCHA verification                        │     │     │
│  │  │   • spam detection                              │     │     │
│  │  │   • create contact + activity                   │     │     │
│  │  └─────────────────────────────────────────────────┘     │     │
│  └──────────────────────┬───────────────────────────────────┘     │
│                         │                                          │
│  ┌──────────────────────▼───────────────────────────────────┐     │
│  │  Event Subscribers (consume from other services)         │     │
│  │  • on-email-opened  → update score + activity            │     │
│  │  • on-email-clicked → update score + activity            │     │
│  │  • on-conversion    → update score + lifecycle stage     │     │
│  │  • on-form-submit   → enrol in welcome workflow          │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │  Queues                                                   │     │
│  │  • mkt-workflow-processor (1/min)                         │     │
│  │  • mkt-lead-scorer (10/min)                               │     │
│  │  • mkt-rfm-analysis (nightly)                             │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### analytics-engine Internals

```
┌────────────────────────────────────────────────────────────────────┐
│  analytics-engine (Port 3104)                                      │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │  Routes                                                   │     │
│  │  • POST /track  (HIGH VOLUME — 1000+ req/sec)             │     │
│  │  • GET  /analytics/overview                               │     │
│  │  • GET  /analytics/attribution                            │     │
│  │  • GET  /funnels/:id                                      │     │
│  │  • POST /ab-tests                                         │     │
│  │  • GET  /ab-tests/:id/result                              │     │
│  │  • POST /reports/generate                                 │     │
│  └──────────────────────┬───────────────────────────────────┘     │
│                         │                                          │
│  ┌──────────────────────▼───────────────────────────────────┐     │
│  │  Services                                                 │     │
│  │  • event-ingestor.service  (validates, sanitises)         │     │
│  │  • attribution.service     (4 models: first/last/linear/  │     │
│  │                              data-driven)                  │     │
│  │  • funnel.service                                          │     │
│  │  • ab-test.service         (chi-squared significance)     │     │
│  │  • report.service          (PDF generation via pdfkit)     │     │
│  │  • predictive.service      (LTV / churn)                  │     │
│  └────┬──────────────────┬──────────────────┬───────────────┘     │
│       │                  │                  │                       │
│  ┌────▼────────┐  ┌─────▼─────────┐  ┌────▼──────────┐            │
│  │ MySQL/PG    │  │  ClickHouse   │  │ (ES Phase 5+) │            │
│  │ (operational│  │  (analytics — │  │ (event search │            │
│  │  30-day raw)│  │  partitioned) │  │  for reports) │            │
│  └─────────────┘  └───────────────┘  └───────────────┘            │
│                         ▲                                          │
│                         │ Outbox pattern:                          │
│  ┌──────────────────────┴───────────────────────┐                 │
│  │  Event Outbox Worker (mkt-clickhouse-flush)  │                 │
│  │  • Reads core_outbox table                    │                 │
│  │  • Batches 1000 rows                         │                 │
│  │  • Writes to ClickHouse                      │                 │
│  │  • Marks outbox row as processed             │                 │
│  └──────────────────────────────────────────────┘                 │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Service Dependency Graph

```
                                ┌──────────────────┐
                                │  marketing-core  │ ◄─── Foundation; all services depend on it for auth
                                │   (Port 3100)    │
                                └────┬─┬─┬─┬─┬─┬───┘
                                     │ │ │ │ │ │
              ┌──────────────────────┘ │ │ │ │ └──────────────────────┐
              │                ┌───────┘ │ │ └─────────┐              │
              │                │ ┌───────┘ └────────┐  │              │
              ▼                ▼ ▼                  ▼  ▼              ▼
       ┌────────────┐    ┌──────────┐         ┌──────────┐     ┌────────────┐
       │ seo-engine │    │content-ai│         │  social- │     │ crm-       │
       │  (3101)    │    │ (3102)   │         │   hub    │     │ automation │
       └──────┬─────┘    └─────┬────┘         │ (3105)   │     │  (3110)    │
              │                │              └────┬─────┘     └─────┬──────┘
              │                │                   │                 │
              │       ┌────────┘                   │                 │
              │       │                            │                 │
              ▼       ▼                            │                 │
       ┌──────────────────┐                        │                 │
       │ campaign-manager │ ◄──────────────────────┘                 │
       │     (3103)       │ ◄──────────────────────────────────────┘
       │  • One-Click ──► uses ALL the above to orchestrate           │
       └────────┬─────────┘                                           │
                │                                                     │
                ▼                                                     │
       ┌────────────────┐                                             │
       │ analytics-     │ ◄──────────────────────────────────────────┐
       │  engine (3104) │ ◄── receives events from all services      │
       └────────────────┘                                             │
                                                                      │
       ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
       │  email-hub   │     │intelligence  │     │ affiliate-   │    │
       │   (3106)     │     │   (3107)     │     │ hub (3108)   │    │
       └──────────────┘     └──────────────┘     └──────────────┘    │
            ▲                       ▲                                 │
            └───────────────────────┴─────────────────────────────────┘

       ┌────────────────┐     ┌─────────────┐     ┌──────────────┐
       │ influencer-hub │     │  media-hub  │     │notification- │
       │     (3109)     │     │   (3111)    │     │service (3112)│
       └────────────────┘     └─────────────┘     └──────────────┘
                                                          ▲
                                                          │ consumes ALL events
                                                          │ for in-app notifications
                                                          │
                                                  ┌───────┴────────┐
                                                  │ integration-   │
                                                  │  service (3113)│ ◄── consumes ALL events
                                                  └────────────────┘     for customer webhooks
```

### Communication Modes Summary

| From → To | Mode | Example |
|---|---|---|
| Frontend → any service | sync REST (via Nginx) | Loading dashboard |
| Service → service (need result) | sync REST + service JWT | campaign-manager → content-ai: generate ad |
| Service → service (fire & forget) | async event (Redis Pub/Sub) | crm-automation publishes contact.created |
| Service → external API | sync REST with timeout + retry + circuit breaker | seo-engine → DataForSEO |
| External webhook → service | async (sign-verified webhook handler → Bull queue) | Stripe → marketing-core |

---

## Sequence: User Login

```
Customer        React SPA        Nginx        marketing-core      MySQL/PostgreSQL        Redis
  │               │                 │                │              │              │
  ├─── POST ──────►                 │                │              │              │
  │  /login        │                 │                │              │              │
  │  {email,pw}    ├── POST ────────►                │              │              │
  │                │  /api/v1/core/  │                │              │              │
  │                │  auth/login    ├── POST ────────►              │              │
  │                │                 │                │              │              │
  │                │                 │                ├── SELECT ───►              │
  │                │                 │                │  core_users  │              │
  │                │                 │                │◄── user ────┤              │
  │                │                 │                │              │              │
  │                │                 │                ├── bcrypt.compare()         │
  │                │                 │                │              │              │
  │                │                 │                ├── SELECT ───►              │
  │                │                 │                │  permissions │              │
  │                │                 │                │◄────────────┤              │
  │                │                 │                │              │              │
  │                │                 │                ├── INSERT ───►              │
  │                │                 │                │  auth_session              │
  │                │                 │                │              │              │
  │                │                 │                ├── SET ───────────────────►│
  │                │                 │                │  cache:user_perms:<id>     │
  │                │                 │                │              │              │
  │                │                 │                ├── sign JWT (15min)         │
  │                │                 │                │  payload: { id,            │
  │                │                 │                │   workspace_id, role,      │
  │                │                 │                │   permissions[] }          │
  │                │                 │                │              │              │
  │                │                 │  ◄── 200 ──────┤              │              │
  │                │                 │  { access_token,│             │              │
  │                │                 │    user }       │             │              │
  │                │                 │  + Set-Cookie:  │             │              │
  │                │                 │  refresh_token  │             │              │
  │                │◄── 200 ─────────┤  (HttpOnly,    │             │              │
  │                │                 │   Secure)       │             │              │
  │                │◄── render       │                 │             │              │
  │  ◄── render ───┤  dashboard      │                 │             │              │
  │  dashboard     │                 │                 │             │              │
  │                │                 │                 │             │              │
                            ┌─── async ────┐
                            │ Publish event│
                            │ core.user.   │
                            │   logged_in  │
                            └──────────────┘
                                    │
                            ┌───────┼────────┐
                            ▼                ▼
                     notification-     analytics-engine
                       service         (track login event)
                     (welcome back     for security
                      banner)          monitoring
```

---

## Sequence: One-Click Market Capture

The flagship feature — full 11-step SSE pipeline.

```
Customer    Web App    campaign-     content-ai    seo-engine    crm-auto    email-hub    social-hub
            (SSE       manager
            client)
   │           │           │              │             │            │           │           │
   │── click ──►          │              │             │            │           │           │
   │ "One-Click│           │              │             │            │           │           │
   │ Capture"  ├── POST ───►              │             │            │           │           │
   │ + URL     │ /one-click │              │             │            │           │           │
   │           │ -capture   │              │             │            │           │           │
   │           │            ├── INSERT campaign_campaigns                  │           │           │
   │           │            │   (ai_generated=true, status=running)   │           │           │
   │           │            │                                          │           │           │
   │           │ ◄── 200 ───┤ + open SSE  │             │            │           │           │
   │           │  (job_id)  │             │             │            │           │           │
   │           │            │                                          │           │           │
   │           ├── GET ─────►                                          │           │           │
   │           │ /one-click │             │             │            │           │           │
   │           │ -capture/  │             │             │            │           │           │
   │           │ :id/stream │             │             │            │           │           │
   │           │            │                                          │           │           │
   │           │            ├─ STEP 1: Analyse ─►                      │           │           │
   │           │            │  (puppeteer scrape │     │            │           │           │
   │           │            │   + GPT-4o)        │     │            │           │           │
   │           │            │◄─ industry profile ┤     │            │           │           │
   │           │ ◄── SSE ───┤  step:1 complete                        │           │           │
   │ ◄─ UI ────┤            │                                          │           │           │
   │  shows    │            │                                          │           │           │
   │  step 1   │            │                                          │           │           │
   │           │            ├─ STEP 2: SEO ──────────────────►        │           │           │
   │           │            │  (keyword research                       │           │           │
   │           │            │   via DataForSEO)         │              │           │           │
   │           │            │◄── 30 keywords ──────────┤              │           │           │
   │           │ ◄── SSE ───┤  step:2 complete                         │           │           │
   │ ◄─ UI ────┤            │                                          │           │           │
   │           │            │                                          │           │           │
   │           │            ├─ STEP 3: PPC ──────►                     │           │           │
   │           │            │  (RSA copy + Meta │     │              │           │           │
   │           │            │   ad copy)         │     │              │           │           │
   │           │            │◄── ad creatives ───┤     │              │           │           │
   │           │ ◄── SSE ───┤  step:3 complete                         │           │           │
   │           │            │                                          │           │           │
   │           │            ├─ STEP 4: Content ─►                      │           │           │
   │           │            │  (12 blog drafts, │     │              │           │           │
   │           │            │   30 social caps) │     │              │           │           │
   │           │            │◄── content drafts ┤     │              │           │           │
   │           │ ◄── SSE ───┤  step:4 complete                         │           │           │
   │           │            │                                          │           │           │
   │           │            ├─ STEP 5: Email ───────────────────────────────────►│           │
   │           │            │  (5-step welcome drip)                              │           │
   │           │            │◄────────────────────────────────────────────────────┤           │
   │           │ ◄── SSE ───┤  step:5 complete                                                │
   │           │            │                                                                  │
   │           │            ├─ STEP 6: Social ───────────────────────────────────────────────►│
   │           │            │  (30 scheduled posts)                                            │
   │           │            │◄────────────────────────────────────────────────────────────────┤
   │           │ ◄── SSE ───┤  step:6 complete                                                │
   │           │            │                                                                  │
   │           │            ├─ STEP 7: CRM ────────────────────────────►                       │
   │           │            │  (workflow + form + lead scoring rules)                          │
   │           │            │◄─────────────────────────────────────────┤                       │
   │           │ ◄── SSE ───┤  step:7 complete                                                │
   │           │            │                                                                  │
   │           │            │ STEP 8: Influencer shortlist (call influencer-hub)              │
   │           │            │ STEP 9: Video briefs + DALL-E images (call media-hub)           │
   │           │            │ STEP 10: Affiliate setup recommendations                         │
   │           │            │                                                                  │
   │           │            ├─ STEP 11: Assemble package                                       │
   │           │            │  • Generate UTM links                                            │
   │           │            │  • Calculate estimated KPIs                                      │
   │           │            │  • Generate priority launch order                                │
   │           │            │  • UPDATE campaign_campaigns status=ready                             │
   │           │            │  • Publish event campaign.oneclick.completed                     │
   │           │ ◄── SSE ───┤  step:11 complete; campaign_id                                  │
   │ ◄─ UI ────┤            │                                                                  │
   │  "Ready   │            │ + Close SSE                                                      │
   │   to      │            │                                                                  │
   │   Launch" │            │                                                                  │
   │           │            │                                                                  │
   │ Customer reviews + clicks "Launch all channels"                                           │
   │           │            ├─ for each channel, call respective service                       │
   │           │            │  • Google Ads campaign creation                                  │
   │           │            │  • Meta Ads campaign creation                                    │
   │           │            │  • Schedule social posts                                         │
   │           │            │  • Enable email drip sequence                                    │
   │           │            │  • Activate CRM workflow                                         │
   │           │            │                                                                  │
   │ Customer sees "All channels launching" → live status updates                              │
```

### Idempotency on One-Click
- Each step's output stored in `campaign_oneclick_steps` table keyed by `job_id, step_num`
- If SSE disconnects → user reopens → frontend fetches `campaign_oneclick_steps` → catches up to last complete step → resumes from there
- Re-running same URL produces SAME `job_id` if within 5 minutes (cost protection)

---

## Sequence: Webhook Delivery

How `integration-service` delivers an event to a customer's webhook URL.

```
Source service       Redis Pub/Sub    integration-      Bull queue      Customer's
                                       service                          webhook endpoint
       │                  │                 │                │                  │
       │── publish ──────►                  │                │                  │
       │ contact.created  │                 │                │                  │
       │                  │── fanout ──────►                 │                  │
       │                  │                 │                │                  │
       │                  │                 ├── lookup ──►   │                  │
       │                  │                 │ integ_webhooks │                  │
       │                  │                 │  WHERE event   │                  │
       │                  │                 │  matches       │                  │
       │                  │                 │◄── 3 subs ─────┤                  │
       │                  │                 │                │                  │
       │                  │                 ├── INSERT into Bull queue          │
       │                  │                 │   mkt-webhook-delivery            │
       │                  │                 │   x3 jobs (one per subscriber)    │
       │                  │                 │                │                  │
       │                  │                 │                ├── job ────────►  │
       │                  │                 │                │   POST {url}     │
       │                  │                 │                │   + signature    │
       │                  │                 │                │◄── 200 ──────────┤
       │                  │                 │                │                  │
       │                  │                 │                ├── INSERT         │
       │                  │                 │                │   mkt_webhook_   │
       │                  │                 │                │   deliveries     │
       │                  │                 │                │   (status=ok)    │
       │                  │                 │                │                  │
       │                  │                 │  Failure case:                    │
       │                  │                 │                │── POST ───────►  │
       │                  │                 │                │◄── 500 ──────────┤
       │                  │                 │                ├── retry in 1m    │
       │                  │                 │                │   (Bull backoff) │
       │                  │                 │                │── POST ───────►  │
       │                  │                 │                │◄── 500 ──────────┤
       │                  │                 │                ├── retry in 5m    │
       │                  │                 │                │   ...            │
       │                  │                 │                │── (7 attempts)   │
       │                  │                 │                ├── move to DLQ    │
       │                  │                 │                │   mkt-webhook-   │
       │                  │                 │                │    retry-dlq     │
       │                  │                 ├── 50 consecutive failures        │
       │                  │                 │  → auto-disable subscription      │
       │                  │                 │  → email owner                    │
```

---

## Sequence: DSAR Data Export

GDPR Article 15 (right to access) implementation.

```
End-customer    Web Form    marketing-core    Bull          All services       S3
                            (DSAR endpoint)    queue        (parallel queries)
     │             │             │                │                │            │
     ├── POST ─────►             │                │                │            │
     │ /dsar/      │             │                │                │            │
     │ access      │             │                │                │            │
     │ {email}     │             │                │                │            │
     │             ├── POST ─────►                │                │            │
     │             │  /dsar/access│                │                │            │
     │             │              ├── send verification email to {email}        │
     │             │              │  (token, 24h expiry)                        │
     │             │              │                │                │            │
     │ ◄── 200 ────┤              │                │                │            │
     │  "Check your email"        │                │                │            │
     │             │              │                │                │            │
     │ ... User clicks email link ...                              │            │
     │             │              │                │                │            │
     │ ── GET ─────►             │                │                │            │
     │ /dsar/verify│              │                │                │            │
     │  ?token     │              │                │                │            │
     │             ├── GET ──────►                 │                │            │
     │             │              ├── verify token, mark request    │            │
     │             │              │   core_dsar_requests status=verified         │
     │             │              ├── INSERT job into mkt-data-export queue     │
     │             │              │                                              │
     │             │              │                ├── worker picks job          │
     │             │              │                │                              │
     │             │              │                ├── parallel queries:         │
     │             │              │                │   • marketing-core for      │
     │             │              │                │     user/workspace data     │
     │             │              │                │   • crm-automation for      │
     │             │              │                │     contact + activities    │
     │             │              │                │   • email-hub for           │
     │             │              │                │     subscription history    │
     │             │              │                │   • analytics-engine for    │
     │             │              │                │     events                  │
     │             │              │                │   • social-hub for          │
     │             │              │                │     mentions                │
     │             │              │                │   ... etc                   │
     │             │              │                │                              │
     │             │              │                ├── aggregate into JSON       │
     │             │              │                │   + CSV files               │
     │             │              │                │                              │
     │             │              │                ├── zip + encrypt with        │
     │             │              │                │   random password           │
     │             │              │                │                              │
     │             │              │                ├── upload ───────────────────►
     │             │              │                │   s3://bucket/dsar/         │
     │             │              │                │     {request_id}.zip        │
     │             │              │                │                              │
     │             │              │                ├── generate pre-signed       │
     │             │              │                │   download URL (7-day)      │
     │             │              │                │                              │
     │             │              │                ├── send 2 emails:            │
     │             │              │                │   (1) download URL          │
     │             │              │                │   (2) password (separate)   │
     │             │              │                │                              │
     │             │              │                ├── UPDATE core_dsar_requests  │
     │             │              │                │   status=completed          │
     │             │              │                │                              │
     │             │              │                │   SLA: complete within 30   │
     │             │              │                │   days (GDPR Art. 15)       │
     │             │              │                │                              │
     │ ── click download link, enter password → ZIP downloads                    │
```

---

## Sequence: Workspace Deletion / RTBF

GDPR Article 17 (right to be forgotten) — hard delete pipeline.

```
Owner       Web App       marketing-     Bull           All services       S3        Stripe
                          core           queue          (parallel deletes)            (revoke)
  │            │              │              │                │              │           │
  ├── click ───►              │              │                │              │           │
  │ "Cancel    │              │              │                │              │           │
  │  Account"  ├── DELETE ────►              │                │              │           │
  │            │ /workspaces/ │              │                │              │           │
  │            │  :id         │              │                │              │           │
  │            │              ├── 2FA challenge → verify     │              │           │
  │            │              ├── UPDATE workspace            │              │           │
  │            │              │  status=cancelled             │              │           │
  │            │              │  cancel_at_period_end=true    │              │           │
  │            │              │                │              │              │           │
  │            │              ├── enqueue mkt-data-export    │              │           │
  │            │              │  (30-day archive for owner)   │              │           │
  │            │              │                │              │              │           │
  │ ◄── 200 ───┤              │  ... 30 days pass ...                                    │
  │            │              │                │              │              │           │
  │            │              │  Daily cron mkt-workspace-deletion fires:               │
  │            │              │                │              │              │           │
  │            │              ├── find workspaces where                                  │
  │            │              │  status=cancelled AND                                    │
  │            │              │  cancelled_at < NOW() - 30 days                          │
  │            │              │                │              │              │           │
  │            │              ├── status=pending_deletion                                │
  │            │              │  (30-day legal grace period starts)                      │
  │            │              │                │              │              │           │
  │            │              │  ... 30 more days pass ...                               │
  │            │              │                │              │              │           │
  │            │              │  Daily cron mkt-workspace-deletion:                     │
  │            │              │                │              │              │           │
  │            │              ├── enqueue mkt-rtbf-purge                                │
  │            │              │  job per service                                         │
  │            │              │                │              │              │           │
  │            │              │                ├── workers fire in parallel:             │
  │            │              │                │   • DELETE from MySQL/PostgreSQL                │
  │            │              │                │     (crm_contacts WHERE workspace_id=) │
  │            │              │                │   • ALTER TABLE analytics_events_ch DELETE   │
  │            │              │                │     (ClickHouse)                       │
  │            │              │                │   • DELETE BY QUERY                    │
  │            │              │                │     (Elasticsearch — Phase 5+ only)    │
  │            │              │                │   • s3 rm --recursive                  │
  │            │              │                │     s3://bucket/workspace/{id}/        │
  │            │              │                │   • Revoke OAuth tokens at each social │
  │            │              │                │     platform (Meta /oauth/revoke, etc) │
  │            │              │                │   • Cancel Stripe subscription ────────►│
  │            │              │                │                              │           │
  │            │              ├── REPLACE in core_audit_log:                              │
  │            │              │  PII fields hashed                                       │
  │            │              │  (legal retention requires audit trail to remain)        │
  │            │              │                │              │              │           │
  │            │              ├── UPDATE workspace                                       │
  │            │              │  status=deleted                                          │
  │            │              │                │              │              │           │
  │            │              ├── publish event core.workspace.deleted                   │
  │            │              │  → notification-service emails (gone forever)            │
  │            │              │  → integration-service revokes API keys                  │
  │            │              │                │              │              │           │
  │            │              │  Workspace is COMPLETELY GONE.                           │
  │            │              │  Only hashed audit-log entries remain.                   │
```

---

## Data Flow: Analytics Event Ingestion

How a page view on a customer's website becomes a row in ClickHouse.

```
Customer's      Tracking      Cloudflare    Nginx       analytics-     MySQL/PostgreSQL       ClickHouse
website         script        (CDN edge)               engine          (operational) (analytics)
visitor         (track.js)                              (port 3104)     30-day        unlimited
   │               │              │             │            │              │              │
   ├── page view ──►              │             │            │              │              │
   │               │              │             │            │              │              │
   │               ├── batch ─────►             │            │              │              │
   │               │ POST /track  │             │            │              │              │
   │               │ {events:[..]}│             │            │              │              │
   │               │              ├── CORS check (origin must be on        │              │
   │               │              │   workspace's verified domain list)    │              │
   │               │              │             │            │              │              │
   │               │              ├── rate limit per IP                    │              │
   │               │              │   (100/min anonymous)                  │              │
   │               │              │             │            │              │              │
   │               │              ├── forward to Nginx ───►  │              │              │
   │               │              │             │            │              │              │
   │               │              │             ├── proxy ──►│              │              │
   │               │              │             │  to        │              │              │
   │               │              │             │  analytics │              │              │
   │               │              │             │  -engine   │              │              │
   │               │              │             │            │              │              │
   │               │              │             │            ├── validate events           │
   │               │              │             │            │   (Joi schema, max 100/batch│
   │               │              │             │            │                              │
   │               │              │             │            ├── enrich:                   │
   │               │              │             │            │   • workspace_id from API   │
   │               │              │             │            │     key                     │
   │               │              │             │            │   • IP → country (Maxmind)  │
   │               │              │             │            │   • user-agent → device     │
   │               │              │             │            │   • truncate IP to /24      │
   │               │              │             │            │     (GDPR)                  │
   │               │              │             │            │                              │
   │               │              │             │            ├── DUAL WRITE:               │
   │               │              │             │            │                              │
   │               │              │             │            ├── INSERT into ────────────►  │
   │               │              │             │            │   analytics_events      │
   │               │              │             │            │   (partitioned, 30-day TTL) │
   │               │              │             │            │                              │
   │               │              │             │            ├── INSERT into core_outbox    │
   │               │              │             │            │   (transactional with above)│
   │               │              │             │            │                              │
   │               │              │             │            │   Async worker mkt-         │
   │               │              │             │            │   clickhouse-flush:         │
   │               │              │             │            │   reads outbox, batches     │
   │               │              │             │            │   1000 rows, inserts ─────────────────►│
   │               │              │             │            │   into ClickHouse analytics_events_ch       │
   │               │              │             │            │   (materialised view auto-updates)    │
   │               │              │             │            │                              │
   │               │              │ ◄── 200 ────┤            │              │              │
   │               │ ◄── 200 ─────┤             │            │              │              │
   │ ◄── ack ──────┤              │             │            │              │              │
   │ (don't block) │              │             │            │              │              │
   │               │              │             │            │              │              │
   │               │  Dashboard queries:                                                   │
   │               │  • Last 24h fast queries: MySQL/PostgreSQL (operational)                       │
   │               │  • Historical / GROUP BY: ClickHouse (analytical, 10x faster)         │
   │               │  • Materialized view analytics_events_hourly powers real-time widgets       │
```

---

## Network Topology

```
                              ┌──────────────────────┐
                              │   Internet           │
                              └──────────┬───────────┘
                                         │
                              ┌──────────▼───────────┐
                              │   Cloudflare         │  (Edge: WAF, DDoS, CDN)
                              │   Anycast Global     │
                              └──────────┬───────────┘
                                         │
                              ┌──────────▼───────────┐
                              │   AWS ALB            │
                              │   (eu-west-2)        │
                              └──────────┬───────────┘
                                         │
                              ┌──────────▼───────────┐
                              │   Nginx 2x EC2       │
                              │   (Public subnet)    │
                              └──────────┬───────────┘
                                         │
   ┌─────────────────────────────────────┼─────────────────────────────────────┐
   │                          Private Subnet (no public IP)                    │
   │                                                                            │
   │   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │
   │   │ ECS     │  │ ECS     │  │ ECS     │  │ ECS     │  │ ECS     │  ...    │
   │   │ marktg- │  │ seo-    │  │ content │  │ campaign│  │ analytic│         │
   │   │ core    │  │ engine  │  │ -ai     │  │ -manager│  │ -engine │         │
   │   │ Fargate │  │ Fargate │  │ Fargate │  │ Fargate │  │ Fargate │         │
   │   └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘         │
   │                                                                            │
   │   (14 service families, each 2-20 tasks behind ALB-internal)              │
   │                                                                            │
   └────────────────────────────────────────────────────────────────────────────┘
                                         │
   ┌─────────────────────────────────────┼─────────────────────────────────────┐
   │                          Database Subnet (private)                        │
   │                                                                            │
   │   ┌──────────────────┐  ┌──────────────────┐                              │
   │   │ PostgreSQL RDS      │  │ Redis            │                              │
   │   │ Multi-AZ         │  │ ElastiCache      │                              │
   │   │ Primary + Standby│  │ Cluster Mode     │                              │
   │   │ + 2 Read Replicas│  │ 3 shards x 2     │                              │
   │   └──────────────────┘  └──────────────────┘                              │
   │                                                                            │
   │   ┌──────────────────┐  ┌──────────────────┐                              │
   │   │ ClickHouse       │  │ (Elasticsearch   │                              │
   │   │                  │  │  Phase 5+ only)  │                              │
   │   │ Cluster (3 node) │  │ (OpenSearch)     │                              │
   │   └──────────────────┘  └──────────────────┘                              │
   │                                                                            │
   └────────────────────────────────────────────────────────────────────────────┘
                                         │
                              ┌──────────▼───────────┐
                              │ Storage (S3 OR     │  (pluggable driver;
                              │  local disk)        │   see storage-strategy.md;
                              │   (file storage)     │   server-side encryption)
                              └──────────────────────┘
```

### Security Groups
- **ALB SG**: inbound 443 from 0.0.0.0/0 (public)
- **Nginx SG**: inbound 80/443 from ALB SG only
- **ECS SG**: inbound service port from Nginx SG only
- **DB SG**: inbound 3306/6379 from ECS SG only
- **All egress**: open (with Cloudflare-routed customer webhooks limited per service)
