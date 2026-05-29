# 🏗️ Microservices Documentation
## All 14 Services + Standards + Build Plan

> Per-service deep-dive documentation following microservice industry standards (C4 model + OpenAPI + AsyncAPI). Read `00-standards.md` first; it's the constitution every service obeys.

---

## 📂 Documents in This Folder

### Foundation (read these first)

| File | Purpose |
|---|---|
| **[00-standards.md](00-standards.md)** | THE CONSTITUTION — universal rules every service obeys. 20 sections covering bounded contexts, API versioning, DB conventions, Sequelize, error handling, auth, inter-service comms, events, queues, webhooks, logging, metrics, health checks, shutdown, config, folder structure, code style, testing, PR standards, docs |
| **[00-architecture-diagram.md](00-architecture-diagram.md)** | C4 Level 1 (System Context) + Level 2 (Containers) + Level 3 (Components). Sequence diagrams for: login, One-Click Capture, webhook delivery, DSAR export, workspace deletion, analytics ingestion. Network topology |

### Service Documentation (one per service)

| # | Service | Port | Tier | Owner | Key Capability |
|---|---|---|---|---|---|
| **[01](01-marketing-core.md)** | **marketing-core** | 3100 | 1 | Platform Team | Auth · Workspaces · Billing · Audit · SSO · Custom domains |
| **[02](02-seo-engine.md)** | **seo-engine** | 3101 | 2 | SEO Team | Keyword tracking · Crawler · Backlinks · GMB · ASO |
| **[03](03-content-ai.md)** | **content-ai** | 3102 | 1 | AI/ML Team | AI generation · Brand voice · Press releases · Translations |
| **[04](04-campaign-manager.md)** | **campaign-manager** | 3103 | 1 | Campaigns Team | PPC · 🎯 One-Click Capture · UTM · Webinars |
| **[05](05-analytics-engine.md)** | **analytics-engine** | 3104 | 1 | Data Team | Events · A/B · Attribution · Funnels · Reports |
| **[06](06-social-hub.md)** | **social-hub** | 3105 | 2 | Social Team | Multi-platform scheduling · Listening · Community |
| **[07](07-email-hub.md)** | **email-hub** | 3106 | 1 | Messaging Team | Email · SMS · Push · WhatsApp · Drips |
| **[08](08-intelligence.md)** | **intelligence** | 3107 | 3 | Data Team | Competitor analysis · Ad spy · AI autopilot |
| **[09](09-affiliate-hub.md)** | **affiliate-hub** | 3108 | 2 | Affiliate Team | Programs · Partner portal · Stripe Connect payouts |
| **[10](10-influencer-hub.md)** | **influencer-hub** | 3109 | 3 | Growth Team | Discovery · CRM · Briefs · ROI |
| **[11](11-crm-automation.md)** | **crm-automation** | 3110 | 1 | CRM Team | Contacts · Lead scoring · Workflows · Deals · Forms |
| **[12](12-media-hub.md)** | **media-hub** | 3111 | 2 | Media Team | YouTube · Video SEO · Shorts · Podcast · AI images |
| **[13](13-notification-service.md)** | **notification-service** | 3112 | 2 | Platform Team | In-app notifications · Real-time alerts · Digests |
| **[14](14-integration-service.md)** | **integration-service** | 3113 | 1 | API Team | Public REST API · Outbound webhooks · Zapier · Data import |

### Action Plan

| File | Purpose |
|---|---|
| **[99-build-phases.md](99-build-phases.md)** | Week-by-week build plan from Phase 0 (foundation) through Phase 6 (post-launch). Team allocation, dependencies, risk mitigations, definition of done |

---

## 📐 The Universal Service Template

Every service doc (01-14) follows this exact structure (~600-1,200 lines each):

```
1. Service Identity          — Port, tier, owner, SLA, on-call
2. Responsibilities          — DO / DON'T (bounded context)
3. Domain Model              — Tables, schemas, state machines, invariants
4. API Contract              — Endpoint catalog, sample requests/responses
5. Async Events              — Published, consumed, Bull queues
6. Dependencies              — Upstream, downstream, external APIs
7. Folder Structure          — Code organisation
8. Configuration             — .env vars + secrets
9. Deployment & Operations   — Docker, ECS, health checks
10. Observability            — Logs, metrics, traces, alerts
11. Security                 — Auth, permissions, PII, threats
12. Testing                  — Unit, integration, isolation, load
13. Local Development        — How to run + test data
14. Runbooks                 — Common production issues
```

This template ensures **any engineer can pick up any service** and immediately know how to work on it.

---

## 🎯 Service Maturity Tiers

| Tier | SLA | On-Call | Test Coverage | Services |
|---|---|---|---|---|
| **Tier 1** | 99.9% uptime | 24/7 | 90%+ | marketing-core, content-ai, campaign-manager, analytics-engine, email-hub, crm-automation, integration-service |
| **Tier 2** | 99.5% uptime | Business hours | 80%+ | seo-engine, social-hub, affiliate-hub, media-hub, notification-service |
| **Tier 3** | Best effort | Next business day | 70%+ | intelligence, influencer-hub |

Tier determines alerting urgency, required redundancy, DR priority, and engineering investment.

---

## 🗺️ Service Dependency Graph (Quick View)

```
                    marketing-core (Foundation)
                            │
       ┌────────┬───────────┼───────────┬────────┬──────────┐
       │        │           │           │        │          │
   seo-engine content-ai  crm-auto  social-hub email-hub  media-hub
       │        │           │           │        │          │
       └────────┴──┬────────┴───────────┴────────┴──────────┘
                   │
               campaign-manager
                   │ (orchestrates them all)
                   ▼
            🎯 One-Click Market Capture
                   │
                   ▼
          analytics-engine ◄── consumes ALL events
                   │
                   ▼
       affiliate-hub ─── influencer-hub ─── intelligence
                   │
                   ▼
       notification-service ─── integration-service
       (fans out events)        (Public API + Zapier)
```

---

## 🚀 Getting Started

### New engineer joining the team
1. Read `00-standards.md` end-to-end (~45 min)
2. Read `00-architecture-diagram.md` (~30 min)
3. Read the doc for the service you're assigned (~45-90 min)
4. Read `99-build-phases.md` for current phase context (~30 min)
5. Read cross-cutting docs (see root README.md): `security.md`, `testing.md`, `observability.md` for your role
6. Run the service locally (see service doc Section 13)
7. Pick up your first ticket

### Adding a new feature
1. Decide which service it belongs to (use bounded context decision tree in `00-standards.md`)
2. Update that service's doc — add endpoints, tables, events
3. Implement (with tests + isolation tests)
4. Open PR — service owner + (SRE if infra) + (security if auth/PII) review
5. Update OpenAPI spec
6. Add monitoring + runbook entry
7. Deploy via feature flag → roll out gradually

### Decision: "Which service does this feature go in?"
See `00-standards.md` → Section 1 → "Where Should This Feature Live?" Decision Tree.

---

## 📊 Documentation Statistics

| Metric | Value |
|---|---|
| Total documents in this folder | 17 |
| Total lines | ~14,000 |
| Services covered | 14 |
| Tables documented across services | 100+ |
| API endpoints documented | 250+ |
| Event types catalogued | 80+ |
| Bull queues documented | 35+ |
| Runbooks defined | 40+ |

---

## 🔗 Related Documentation (in root folder)

The microservice docs assume familiarity with these cross-cutting docs:

| Doc | Topic |
|---|---|
| [doc.md](../doc.md) | Product blueprint (what we're building, who for) |
| [tech.md](../tech.md) | Technology stack details |
| [clients.md](../clients.md) | Multi-tenant access, roles, JWT, workspace lifecycle |
| [security.md](../security.md) | Threat model, KMS, OAuth encryption, webhook signatures |
| [compliance.md](../compliance.md) | GDPR, CCPA, TCPA, CAN-SPAM, SOC 2 |
| [observability.md](../observability.md) | Logs, traces, metrics, alerts, runbooks template |
| [billing-lifecycle.md](../billing-lifecycle.md) | Stripe state machine, dunning, refunds |
| [public-api.md](../public-api.md) | Customer-facing API contract |
| [ai-platform.md](../ai-platform.md) | AI provider abstraction, cost controls |
| [design-system.md](../design-system.md) | MUI theme, states, a11y, i18n |
| [infrastructure-prod.md](../infrastructure-prod.md) | Backups, DR, HA, migrations |
| [integrations.md](../integrations.md) | OAuth specs per external platform |
| [testing.md](../testing.md) | Test strategy, isolation matrix |
| [README.md](../README.md) | Documentation index (master) |

---

## ✍️ Maintenance

| Document | Update Trigger | Owner |
|---|---|---|
| 00-standards.md | New universal rule established | Engineering Lead |
| 00-architecture-diagram.md | New service added; major flow changes | Architecture Lead |
| Per-service docs | Any change to API, schema, events, queues, config | Service Owner |
| 99-build-phases.md | Sprint planning per phase | Engineering Lead |

**All documentation lives in the repo. Updated in the same PR as the code change.**

---

## ❓ FAQ

**Q: Why 14 services and not fewer / more?**
A: Each service owns a clear bounded context. Splitting more = service-coordination overhead grows linearly. Combining = bounded contexts blur and services become "the mainframe." 14 is the sweet spot for a marketing platform of this scope.

**Q: What if a feature spans 2 services?**
A: Use async events. Service A publishes; Service B subscribes. Never reach across service boundaries with direct DB queries.

**Q: Can we deploy services independently?**
A: Yes. That's the whole point of microservices. Each service has its own Docker image, ECS task definition, version, and deploy schedule.

**Q: Why both internal `/api/v1/` and public `/api/v2/`?**
A: Internal can break with frontend coordination; public must be stable for customer integrations. Different versioning rules, different SLAs.

**Q: What about graphQL?**
A: Not in v1. REST is simpler, the team knows it, the existing platform uses it. Possible Phase 6 if customer demand justifies.

**Q: Why Bull and not Kafka/SQS?**
A: Bull on shared Redis is sufficient for our volume (< 100k jobs/min). Kafka is overkill until we hit scale. Same with SQS — adds vendor lock-in for no current benefit.

**Q: Can two services share a database table?**
A: No. Each `mkt_*` table is logically owned by one service. Other services read via that service's API. Sharing tables = tightly-coupled services that can't deploy independently.

**Q: How do we test cross-service flows?**
A: E2E tests via Playwright. Integration tests within a service use mocks for downstream services. See `testing.md`.
