# 📚 Marketing Platform — Documentation Index
## Complete Engineering & Product Documentation Set

> A production-grade SaaS Digital Marketing Platform. This is the master index. Start here.

---

## 🎯 Architectural Decisions Recorded

| Decision | Date | Status |
|---|---|---|
| **Frontend = Option C** — React + Vite (dashboard) + Astro (marketing site) + Express SSR (landing renderer) | 2026-05-28 | ✅ Locked. See [frontend-decision.md](frontend-decision.md) |
| **Database = MySQL (dev/staging) + PostgreSQL (prod)** via dual-dialect Sequelize | 2026-05-28 | ✅ Locked. See [microservices/00-standards.md](microservices/00-standards.md#3-database-conventions) |
| **File Storage = Pluggable driver** — `STORAGE_DRIVER=s3` (cloud) OR `STORAGE_DRIVER=local` (on-prem) | 2026-05-28 | ✅ Locked. See [storage-strategy.md](storage-strategy.md) |
| **Search = Database-native FULLTEXT** (MySQL) / `tsvector` (PostgreSQL) in v1. Elasticsearch DEFERRED to Phase 5+ | 2026-05-28 | ✅ Locked. See [tech.md](tech.md) "Search Engine" |
| **Deployment = Cloud OR On-prem** (same code, same env vars, different values) | 2026-05-28 | ✅ Locked. See [infrastructure-prod.md](infrastructure-prod.md) "Deployment Models" |
| **Table naming = `<service>_<plural-noun>`** (e.g., `core_users`, `seo_keywords`, `crm_contacts`) — table name reveals owning service at a glance | 2026-05-28 | ✅ Locked. See [database-schema.md](database-schema.md) |
| **DB sync = Sequelize `sync({ alter: true })`** in dev/staging (auto-create tables + indexes); `sync()` + `verifyProductionSchema()` in production | 2026-05-28 | ✅ Locked. See [database-sync-strategy.md](database-sync-strategy.md) |
| **UI library = MUI v6** | earlier | ✅ Locked |
| **14 microservices**, each with bounded context | earlier | ✅ Locked |
| **One-Click Market Capture** as flagship feature | earlier | ✅ Locked. See [microservices/04-campaign-manager.md](microservices/04-campaign-manager.md) |



---

## 🗂️ Document Library

### Product & Architecture (the core trio)

| Document | Purpose | Status |
|---|---|---|
| **[doc.md](doc.md)** | Product blueprint — 25 customer use cases, 20 modules, 14 microservices, all 12 marketing pillars | ✅ Audited & fixed |
| **[tech.md](tech.md)** | Technology stack — React 18 + Vite + MUI v6 (dashboard) · Astro 4 (marketing) · Express SSR (landing renderer) · Node.js/Express services · MySQL (dev) / PostgreSQL (prod) | ✅ Updated for Option C |
| **[clients.md](clients.md)** | Multi-tenant access — login flows, roles, permissions, 2FA, SSO, workspace lifecycle | ✅ Audited & fixed |
| **[third-party-services.md](third-party-services.md)** | 🌐 Complete catalogue of every external service · pricing · signup order · approval timelines | ✅ NEW |
| **[frontend-decision.md](frontend-decision.md)** | 🎨 ✅ **DECISION RECORDED: Option C** — React + Vite (dashboard) + Astro (marketing) + Express SSR (landing pages) | ✅ DECIDED 2026-05-28 |
| **[storage-strategy.md](storage-strategy.md)** | 💾 ✅ **DECISION RECORDED: Pluggable storage** — S3 (cloud) OR local disk (on-prem); same code, set via `STORAGE_DRIVER` env var | ✅ DECIDED 2026-05-28 |
| **[database-schema.md](database-schema.md)** | 🗄️ **MySQL DDL reference** — all 131 tables across 14 services; service-prefixed naming (`<service>_<table>`); FK catalogue + index strategy | ✅ NEW |
| **[database-sync-strategy.md](database-sync-strategy.md)** | 🔄 Sequelize auto-creates tables/indexes/FKs/ENUMs at boot via `sync()`; production safety + verification + manual-migration patterns | ✅ NEW |

### Microservice Documentation (per-service, follow microservice standards)

| Document | Purpose |
|---|---|
| **[microservices/README.md](microservices/README.md)** | 📚 Index of all 17 microservice docs |
| **[microservices/00-standards.md](microservices/00-standards.md)** | THE CONSTITUTION — universal rules every service obeys |
| **[microservices/00-architecture-diagram.md](microservices/00-architecture-diagram.md)** | C4 diagrams + sequence diagrams |
| **[microservices/01-marketing-core.md](microservices/01-marketing-core.md)** | Auth · Workspaces · Billing |
| **[microservices/02-seo-engine.md](microservices/02-seo-engine.md)** | SEO · Crawler · Backlinks · ASO |
| **[microservices/03-content-ai.md](microservices/03-content-ai.md)** | AI content · Brand voice |
| **[microservices/04-campaign-manager.md](microservices/04-campaign-manager.md)** | PPC · 🎯 One-Click Capture |
| **[microservices/05-analytics-engine.md](microservices/05-analytics-engine.md)** | Events · A/B · Attribution |
| **[microservices/06-social-hub.md](microservices/06-social-hub.md)** | Social scheduling · Listening |
| **[microservices/07-email-hub.md](microservices/07-email-hub.md)** | Email · SMS · WhatsApp · Push |
| **[microservices/08-intelligence.md](microservices/08-intelligence.md)** | Competitor · Ad spy · Autopilot |
| **[microservices/09-affiliate-hub.md](microservices/09-affiliate-hub.md)** | Affiliate programs · Payouts |
| **[microservices/10-influencer-hub.md](microservices/10-influencer-hub.md)** | Influencer CRM |
| **[microservices/11-crm-automation.md](microservices/11-crm-automation.md)** | CRM · Workflows · Deals |
| **[microservices/12-media-hub.md](microservices/12-media-hub.md)** | YouTube · Video · Images |
| **[microservices/13-notification-service.md](microservices/13-notification-service.md)** | In-app notifications · Digests |
| **[microservices/14-integration-service.md](microservices/14-integration-service.md)** | Public REST API · Webhooks |
| **[microservices/99-build-phases.md](microservices/99-build-phases.md)** | Week-by-week build plan |

### Production Hardening (cross-cutting)

| Document | Purpose |
|---|---|
| **[security.md](security.md)** | Threat model, KMS key hierarchy, OAuth token encryption, webhook signatures, prompt injection defence, file upload security, tenant isolation tests, custom domain SSL, vulnerability disclosure, incident response |
| **[compliance.md](compliance.md)** | GDPR, CCPA, CAN-SPAM, TCPA, cookie consent, sub-processors, DPA template, data retention schedule, DSAR/RTBF implementation, breach notification, SOC 2 roadmap |
| **[observability.md](observability.md)** | Structured logging (pino), distributed tracing (OpenTelemetry), Prometheus metrics, SLO/SLI definitions, alerting strategy, status page, runbooks, tooling costs |
| **[billing-lifecycle.md](billing-lifecycle.md)** | Plans + pricing, free trial, subscription state machine, Stripe integration, dunning, upgrades/downgrades/proration, cancellation/refunds, tax handling, affiliate payouts via Stripe Connect, SLA service credits |
| **[public-api.md](public-api.md)** | Customer-facing REST API, authentication via API keys + OAuth, scopes, rate limits, outbound webhooks, Zapier integration, Make.com/n8n, data import (HubSpot/Mailchimp/Klaviyo), embed SDK, OpenAPI docs, SDKs, versioning |
| **[ai-platform.md](ai-platform.md)** | Provider abstraction (OpenAI + Claude + Gemini), model routing per task, cost tracking + per-workspace caps, prompt versioning, output validation, prompt-injection defence, hallucination handling, failover, evaluation harness, mock mode, embeddings |
| **[design-system.md](design-system.md)** | MUI theme tokens, typography scale, spacing system, component states, empty/loading/error states, accessibility (WCAG 2.1 AA), internationalisation, responsive design, component catalogue, Storybook |
| **[infrastructure-prod.md](infrastructure-prod.md)** | Backups (MySQL/PostgreSQL/Redis/ClickHouse/ES/S3), disaster recovery, high availability, zero-downtime migrations, deployment strategy, CDN/edge config, multi-region plan, scaling thresholds, connection pooling, read replicas |
| **[integrations.md](integrations.md)** | OAuth specs per platform (Google, Meta, LinkedIn, Twitter, TikTok, YouTube), token refresh, rate limits, library choices, quirks per provider, sandbox modes |
| **[testing.md](testing.md)** | Unit (Jest), integration (supertest), E2E (Playwright), security tests, workspace isolation matrix, AI evaluation harness, accessibility (axe + Lighthouse), load testing (k6), visual regression (Chromatic), CI pipeline, coverage targets |

---

## 🎯 Quick Navigation by Role

### "I'm a Product Manager"
Read in order:
1. [doc.md](doc.md) — what we're building, who it's for
2. [billing-lifecycle.md](billing-lifecycle.md) — pricing strategy
3. [clients.md](clients.md) — who logs in and what they see
4. [public-api.md](public-api.md) — enterprise / Zapier opportunities

### "I'm a Backend Engineer Starting"
Read in order:
1. [doc.md](doc.md) — system overview
2. [tech.md](tech.md) — stack details
3. [clients.md](clients.md) — auth + multi-tenancy
4. [security.md](security.md) — what to never get wrong
5. [observability.md](observability.md) — how to instrument
6. [testing.md](testing.md) — write tests like this
7. [infrastructure-prod.md](infrastructure-prod.md) — deployment specifics

### "I'm a Frontend Engineer Starting"
1. [doc.md](doc.md) — feature scope
2. [tech.md](tech.md) — MUI + React+Vite stack (Option C)
3. [design-system.md](design-system.md) — components + theming
4. [clients.md](clients.md) — auth + workspace context
5. [public-api.md](public-api.md) — API shape
6. [testing.md](testing.md) — front-end testing strategy

### "I'm a Security / SRE / DevOps Engineer"
1. [security.md](security.md) — threat model
2. [compliance.md](compliance.md) — legal requirements
3. [infrastructure-prod.md](infrastructure-prod.md) — production setup
4. [observability.md](observability.md) — monitoring + runbooks
5. [testing.md](testing.md) — isolation + security tests

### "I'm AI/ML Engineer"
1. [ai-platform.md](ai-platform.md) — provider abstraction
2. [security.md](security.md) — prompt injection
3. [compliance.md](compliance.md) — AI data handling
4. [doc.md](doc.md) — AI features in product context

### "I'm Sales / Customer Success"
1. [doc.md](doc.md) — what we sell, 25 use cases mapped to roles
2. [billing-lifecycle.md](billing-lifecycle.md) — plans + pricing
3. [clients.md](clients.md) — agency model + permissions
4. [compliance.md](compliance.md) — SOC 2, GDPR, DPA — answering RFPs

### "I'm Legal / Compliance"
1. [compliance.md](compliance.md) — full regulatory map
2. [security.md](security.md) — security posture
3. [clients.md](clients.md) — DPA roles (controller vs processor)

---

## 🏗️ The Platform at a Glance

### Architecture Stack

```
┌──────────────────────────────────────────────────────────────┐
│  Dashboard: React 18 + Vite 5 + MUI v6 + React Router + RTK  │
│  Marketing Site: Astro 4 (SSG)                                │
│  Landing Renderer: Express SSR (One-Click pages, webinars)    │
├──────────────────────────────────────────────────────────────┤
│  Edge: Cloudflare (WAF, CDN, DDoS, custom domains)           │
├──────────────────────────────────────────────────────────────┤
│  Backend: 14 Node.js/Express microservices on ECS Fargate    │
├──────────────────────────────────────────────────────────────┤
│  Data: MySQL/PostgreSQL (primary) + ClickHouse (analytics)            │
│        + Redis (cache + queues) + Elasticsearch (search)     │
├──────────────────────────────────────────────────────────────┤
│  AI: OpenAI + Anthropic + Google Gemini (multi-provider)     │
├──────────────────────────────────────────────────────────────┤
│  Observability: Sentry + Prometheus + Grafana + OpenTelem.   │
└──────────────────────────────────────────────────────────────┘
```

### The 14 Microservices

| Port | Service | Owns |
|---|---|---|
| 3100 | marketing-core | Auth · Workspaces · Billing · Audit Log |
| 3101 | seo-engine | SEO · Crawler · Rank Tracking · Backlinks · Local · ASO |
| 3102 | content-ai | AI content · Brand voice · PR · Podcast scripts |
| 3103 | campaign-manager | PPC ads · One-Click Capture · UTM · Webinars |
| 3104 | analytics-engine | Analytics · A/B · Attribution · Funnels · CRO |
| 3105 | social-hub | Social scheduling · Listening · Community |
| 3106 | email-hub | Email · SMS · Push · WhatsApp · Drips |
| 3107 | intelligence | Competitor analysis · Ad spy · Autopilot |
| 3108 | affiliate-hub | Affiliate programs · Partner portal · Payouts |
| 3109 | influencer-hub | Influencer discovery · CRM · ROI |
| 3110 | crm-automation | CRM · Lead scoring · Workflows · Pipeline |
| 3111 | media-hub | YouTube · Video SEO · Shorts · Images |
| 3112 | notification-service | In-app notifications · Real-time alerts · Email digests |
| 3113 | integration-service | Public REST API · Outbound webhooks · Zapier · Data imports |

### The 20 Feature Modules

1. SEO Intelligence Engine
2. PPC & Paid Ads Manager
3. Social Media Command Centre
4. Content Marketing Studio
5. Email Marketing Hub
6. SMS / Push / WhatsApp Marketing
7. Affiliate & Referral Hub
8. Influencer Marketing CRM
9. CRO & Experimentation Suite
10. Video & Multimedia Studio
11. Local & ASO Marketing
12. **🎯 One-Click Market Capture** (flagship)
13. Competitor Intelligence
14. Cross-Channel Analytics & Reporting
15. Marketing CRM & Automation
16. Webinar & Event Marketing
17. PR & Media Coverage
18. AI Marketing Autopilot
19. Community Management Hub
20. White-Label Agency Portal

### The 25 Customer Use Cases

1. Lead generation
2. SEO / page 1 rankings
3. Product sales
4. YouTube channel growth
5. Video views & subscriptions
6. Social followers + engagement
7. Brand awareness
8. Email list building
9. Paid ad ROI
10. Local business visibility
11. App downloads
12. Influencer marketing
13. Affiliate / referral marketing
14. Conversion rate optimisation
15. Customer retention & LTV
16. B2B sales meetings
17. Webinar marketing
18. SMS marketing
19. Push notifications
20. PR & press coverage
21. Podcast marketing
22. WhatsApp / Messenger marketing
23. Community building
24. AI marketing autopilot
25. Agency multi-client management

---

## 📊 What This Documentation Achieves

### Coverage Comparison

| Concern | Pre-Audit (3 docs) | Post-Audit (12 docs) |
|---|---|---|
| Product vision | ✅ | ✅ |
| Technology choices | ✅ | ✅ |
| Multi-tenancy basics | ✅ | ✅ |
| **Security threat model** | ❌ | ✅ security.md |
| **Encryption strategy** | ⚠️ shallow | ✅ KMS per-workspace KEK |
| **GDPR / DSAR / RTBF** | ⚠️ mentioned | ✅ full compliance.md |
| **Audit logging** | ❌ | ✅ core_audit_log everywhere |
| **Webhook reliability** | ⚠️ basics | ✅ idempotency, retries, DLQ |
| **AI cost controls** | ⚠️ credits only | ✅ caps, spike detection, kill switch |
| **AI prompt safety** | ⚠️ mentioned | ✅ full defence in depth |
| **Backups & DR** | ❌ | ✅ RPO/RTO defined |
| **Zero-downtime migrations** | ❌ | ✅ expand-migrate-contract |
| **Observability** | ⚠️ Sentry only | ✅ logs + tracing + metrics + runbooks |
| **Public API** | ❌ | ✅ full API spec |
| **Outbound webhooks** | ❌ | ✅ signed, reliable, replayable |
| **Zapier / data import** | ❌ | ✅ planned integrations |
| **2FA for all owners** | ⚠️ admin only | ✅ mandatory for owners |
| **SAML / OIDC SSO** | ❌ | ✅ enterprise-ready |
| **Workspace lifecycle** | ⚠️ partial | ✅ full state machine |
| **Billing edge cases** | ⚠️ basics | ✅ refunds, downgrades, dunning |
| **Design system** | ⚠️ MUI noted | ✅ tokens, empty/loading/error states, i18n, a11y |
| **Testing strategy** | ⚠️ checklist | ✅ pyramid + isolation + AI eval + a11y + load |
| **CDN / edge** | ❌ | ✅ Cloudflare config |
| **Cost projections** | ❌ | ✅ per scaling threshold |
| **Status page / SLA** | ❌ | ✅ defined |
| **Incident response** | ❌ | ✅ runbook template |

### Estimated Coverage of Production Concerns

- **Before:** ~25-30% of what a SaaS handling business data needs
- **After:** ~80% — remaining gaps are operational details (specific runbooks, customer-specific contracts, ongoing SOC 2 evidence)

---

## 🚀 Recommended Build Sequence

Beyond the phases in `doc.md`, here's the prioritised sequence:

### Pre-Phase 0 (Weeks -2 to 0): Foundations
- Set up monorepo, CI, staging environment
- security.md baseline: KMS, secrets management, encryption
- observability.md baseline: Sentry, basic logs, status page
- compliance.md baseline: privacy policy, cookie consent

### Phase 1 (Weeks 1-4): Core Platform
- doc.md Phase 1
- Apply: security.md (auth + RBAC), clients.md (multi-tenant), testing.md (unit + isolation)

### Phase 2 (Weeks 5-8): Campaign Core
- doc.md Phase 2
- Apply: design-system.md, observability.md (full instrumentation), integrations.md (Stripe, SendGrid, Twilio)

### Phase 3 (Weeks 9-12): AI Flagship
- doc.md Phase 3
- Apply: ai-platform.md (full provider abstraction + cost controls + safety)

### Phase 4 (Weeks 13-16): Affiliate, CRO, Analytics
- doc.md Phase 4
- Apply: public-api.md (Phase 1 — read endpoints), billing-lifecycle.md (Stripe Connect)

### Phase 5 (Weeks 17-20): Local, Retention, Scale
- doc.md Phase 5
- Apply: infrastructure-prod.md (DR drills, multi-region prep)

### Post-Launch (Months 6-12)
- SOC 2 Type 1 audit (compliance.md)
- Public API GA (public-api.md)
- Zapier marketplace listing
- Multi-region (infrastructure-prod.md Phase 4)
- SOC 2 Type 2 prep

---

## ⚠️ Critical Risks Tracked

These risks were surfaced in the audit. They have mitigations across the documents:

| Risk | Mitigation Document |
|---|---|
| Workspace data leak between customers | security.md, testing.md (isolation tests) |
| AI cost runaway | ai-platform.md (per-workspace caps + spike detection) |
| OAuth token mass leak | security.md (per-workspace KEK encryption) |
| GDPR fine for DSAR/RTBF non-compliance | compliance.md (full DSAR pipeline) |
| TCPA class-action lawsuit (SMS) | compliance.md (TCPA section with consent log) |
| Backup not testable | infrastructure-prod.md (monthly restore drill) |
| Vendor lock-in (single AI provider outage) | ai-platform.md (failover + circuit breaker) |
| Database migration causes downtime | infrastructure-prod.md (expand-migrate-contract) |
| API key leak | security.md (key hashing, rotation policy) |
| Prompt injection abuse | security.md + ai-platform.md (defence in depth) |
| Stripe webhook replay → double charge | security.md (idempotency keys) |
| Workspace deleted but data leaks via backup | compliance.md (backup retention reconciled with RTBF) |

---

## 📞 Where to Find Help

| Topic | Documents |
|---|---|
| "How do I add a new microservice?" | doc.md (architecture) + tech.md (boilerplate) |
| "How do I add a new feature?" | doc.md (modules) + design-system.md (UI) + testing.md (tests) |
| "How do I handle PII?" | compliance.md + security.md |
| "How do I integrate a new social platform?" | integrations.md |
| "How do I avoid making customers angry with rate limits?" | public-api.md (limits) + observability.md (monitoring) |
| "How do I handle a customer cancellation?" | billing-lifecycle.md + clients.md (workspace lifecycle) |
| "How do I respond to an SEV-1 incident?" | observability.md (runbooks) + security.md (IR) |
| "How do I roll out a new AI prompt?" | ai-platform.md (versioning + eval) |
| "How do I prove SOC 2 compliance?" | compliance.md + security.md + observability.md |
| "How do I migrate the DB without downtime?" | infrastructure-prod.md (expand-migrate-contract) |

---

## 📝 Document Versioning

| File | Last Updated | Owner | Review Cadence |
|---|---|---|---|
| README.md (this file) | 2026-05-28 | Lead | When new doc added |
| doc.md | 2026-05-28 | Product | Quarterly |
| tech.md | 2026-05-28 | Engineering Lead | Quarterly |
| clients.md | 2026-05-28 | Engineering Lead | When auth changes |
| security.md | 2026-05-28 | Security | Quarterly |
| compliance.md | 2026-05-28 | Legal + Engineering | Quarterly |
| observability.md | 2026-05-28 | SRE | Quarterly |
| billing-lifecycle.md | 2026-05-28 | Product + Finance | When pricing changes |
| public-api.md | 2026-05-28 | API team | Monthly during active dev |
| ai-platform.md | 2026-05-28 | AI/ML Lead | Monthly |
| design-system.md | 2026-05-28 | Design + Frontend | Monthly during active dev |
| infrastructure-prod.md | 2026-05-28 | SRE | Quarterly |
| integrations.md | 2026-05-28 | Integration team | When provider changes API |
| testing.md | 2026-05-28 | Engineering Lead | Quarterly |

---

## ✅ Document Maturity Checklist

Each document is considered "production-ready" when it has:

- [x] Table of contents
- [x] Examples (code, schemas, diagrams)
- [x] Decisions justified with alternatives considered
- [x] Edge cases enumerated
- [x] Cross-references to related documents
- [x] Implementation guidance, not just theory

**Status: All 12 documents meet this bar as of 2026-05-28.**

---

## 🎉 What You're Reading

This documentation set represents the **end-to-end blueprint** for a production-grade Digital Marketing SaaS platform. It is intentionally exhaustive — the goal is that any new engineer can join the team and find the answer to "how should I build this?" in writing rather than asking around.

Total documentation: **~70,000 words** across 12 documents covering product, technology, security, compliance, operations, billing, AI, design, infrastructure, integrations, testing, and APIs.

If something is missing, **add it** — the docs are first-class code.
