# 🚧 Build Phases — Week-by-Week Action Plan
## From Zero to Production in 20 Weeks

> The actionable build plan. Every team member knows what to do every week. Every service has a clear owner and deadline.

---

## 📋 Table of Contents

1. [Build Principles](#build-principles)
2. [Phase 0 — Foundation (Weeks -2 to 0)](#phase-0--foundation-weeks--2-to-0)
3. [Phase 1 — Auth + Frontend Skeleton (Weeks 1-4)](#phase-1--auth--frontend-skeleton-weeks-1-4)
4. [Phase 2 — Email + Social + Campaign Core (Weeks 5-8)](#phase-2--email--social--campaign-core-weeks-5-8)
5. [Phase 3 — AI Flagship + Intelligence + Media (Weeks 9-12)](#phase-3--ai-flagship--intelligence--media-weeks-9-12)
6. [Phase 4 — Affiliate, CRO, Public API (Weeks 13-16)](#phase-4--affiliate-cro-public-api-weeks-13-16)
7. [Phase 5 — Local, ASO, Scale, Compliance (Weeks 17-20)](#phase-5--local-aso-scale-compliance-weeks-17-20)
8. [Phase 6 — Post-Launch (Months 6-12)](#phase-6--post-launch-months-6-12)
9. [Critical Path & Dependencies](#critical-path--dependencies)
10. [Team Allocation](#team-allocation)
11. [Risk Mitigations](#risk-mitigations)
12. [Definition of Done per Phase](#definition-of-done-per-phase)

---

## Build Principles

1. **Vertical slices over horizontal layers** — build a complete feature end-to-end (UI → API → DB → tests) before moving to the next
2. **Ship Phase N before starting Phase N+1** — no parallel mega-projects that block on each other
3. **Foundation work first** — security, observability, testing baselines in Phase 0
4. **Customer signs up Week 5** — Phase 1 deliverable; private beta from Week 8
5. **Public launch Week 20** — Phase 5 done; SOC 2 Type 1 audit-ready
6. **Cross-cutting docs are not optional** — every PR enforces them
7. **Frequent releases** — multiple production deploys per day per service (feature-flagged)

---

## Phase 0 — Foundation (Weeks -2 to 0)

**Goal:** Everything in place so engineers can start writing service code on Day 1 of Week 1.

### Week -2 (Infrastructure)

| Task | Owner | Done When |
|---|---|---|
| AWS accounts provisioned (staging + prod) | SRE | Both accounts active; billing alerts configured |
| Cloudflare account; DNS configured for staging + prod | SRE | `app.yourplatform.com` resolves |
| KMS keys created (per security.md hierarchy) | SRE + Security | Master DEK + JWT signing key exist |
| Vault / AWS Secrets Manager set up | SRE | Secrets writeable + readable from CI |
| Sentry + Statuspage.io + PagerDuty accounts | SRE | All three accessible by team |
| GitHub org + repo created | Platform Lead | Repo exists; protected `main` branch |
| Monorepo structure (Yarn workspaces + Turborepo) | Platform Lead | `yarn install` works; Turbo builds in parallel |
| `packages/eslint-config-marketing/` shared config | Platform Lead | Imports correctly |
| `packages/shared-middleware/` (JWT, encryption, CORS, rate-limit, error handler) | Platform Lead | Importable from any service |
| `packages/shared-types/` TypeScript interfaces | Platform Lead | Used by frontend |
| `services/_template/` boilerplate service | Platform Lead | Copying to new service produces working stub |

### Week -1 (Data + CI)

| Task | Owner | Done When |
|---|---|---|
| PostgreSQL RDS provisioned (staging + prod, Multi-AZ) | SRE | Connected from VPC |
| Redis ElastiCache provisioned | SRE | Connected; cluster mode |
| ClickHouse cluster (managed or self-hosted) | SRE | Sample query returns |
| ~~Elasticsearch~~ — DEFERRED to Phase 5+ | SRE | n/a in v1 |
| File storage decision: pick `STORAGE_DRIVER` per env (s3 for staging/prod, local for dev) | SRE | Storage abstraction working in CI matrix |
| S3 bucket (workspace files, backups, exports) — for cloud deploys | SRE | Block public access verified; OR provision local-disk volume mount for on-prem |
| Storage migration script (`scripts/migrate-storage.js`) tested between drivers | SRE | Round-trip migration test passes |
| GitHub Actions CI pipeline (lint + test + type-check + security scan) | Platform Lead | Sample PR passes all checks |
| ECS Fargate cluster + task definitions template | SRE | Sample service deploys |
| ALB + Nginx config + custom domain SSL automation (ACME) | SRE | TLS A grade |
| OpenTelemetry collector + Grafana + Prometheus | SRE | Sample metric flowing |
| Sentry SDK in template service | SRE | Test exception captured |
| Stripe test account + Connect Express set up | Product | Test charge succeeds |
| SendGrid + Twilio + Firebase + 360dialog + DataForSEO accounts | Product | Credentials in Vault |
| **OAuth app submissions to Meta/LinkedIn/TikTok** ← START NOW (2-8 week approval) | Product | Apps in review |

### Week 0 (Documentation + Team Onboarding)

| Task | Owner | Done When |
|---|---|---|
| All 16 microservice docs reviewed | Engineering Lead | Approved |
| Cross-cutting docs (security/compliance/etc.) reviewed | Lead + Security + Legal | Approved |
| Engineers read full doc set | All engineers | Quiz / discussion session passed |
| Team allocations confirmed | Engineering Lead | Owners assigned per service |
| First sprint planned | All | Backlog populated in Linear/Jira |
| Status page configured (status.yourplatform.com) | SRE | Live; placeholder "in development" |
| Sentry alerts + PagerDuty rotation set | SRE | First on-call schedule published |

**✅ Phase 0 Done When:** A new engineer can clone the repo, run `yarn install && yarn dev`, see a service responding at `localhost:3100/health`, write a test, and see it pass in CI.

---

## Phase 1 — Auth + Frontend Skeleton (Weeks 1-4)

**Goal:** Customer can register → log in → create workspace → invite team member → see empty dashboard with all 20 module routes stubbed.

### Services Built (Phase 1 scope)

| Service | Scope This Phase |
|---|---|
| **marketing-core** | FULL: auth, workspaces, members, plans, basic billing, audit log, feature flags |
| **seo-engine** | PARTIAL: keyword CRUD (manual), basic Cheerio crawler, audit endpoint stub |
| **content-ai** | PARTIAL: AI provider abstraction, blog post generation, brand voice basic |
| **crm-automation** | PARTIAL: contact CRUD, lead capture form (basic), lead scoring rules |
| Other services | DB migrations only — schemas created, endpoints stubbed (return 501) |

### Week 1 — Marketing-Core + Frontend Skeleton

**Backend (2 engineers):**
- [ ] `marketing-core` skeleton from template
- [ ] Sequelize models: core_users, core_workspaces, core_workspace_members, core_plans, core_roles, core_permissions
- [ ] Migrations + seed data (plans, default roles)
- [ ] `POST /auth/register` + email verification flow
- [ ] `POST /auth/login` with JWT issuance (15min) + refresh cookie (30d)
- [ ] `POST /auth/refresh-token` rotation
- [ ] Passport JWT strategy (copy from existing platform)
- [ ] Shared middleware deployed: encryptionMiddleware, security headers, CORS, rate limiter (Redis-backed)
- [ ] Audit log table + middleware
- [ ] Health/ready/live endpoints; Prometheus metrics

**Frontend (2 engineers):**
- [ ] React 18 + Vite 5 + TypeScript SPA scaffolded with MUI v6 theme (Option C)
- [ ] React Router v6 routing setup (replaces Next.js App Router)
- [ ] Astro 4 marketing-site scaffolded (homepage + pricing placeholder)
- [ ] landing-renderer Express service skeleton + health check
- [ ] Login + register pages (MUI design)
- [ ] Email verification flow
- [ ] All 20 module sidebar routes stubbed with empty states
- [ ] Workspace switcher in header (placeholder)
- [ ] Redux Toolkit + RTK Query setup
- [ ] Axios interceptor for auth + refresh token

**SRE:**
- [ ] Deploy marketing-core to staging
- [ ] Configure DataDog dashboards (or Grafana) for service
- [ ] First SLO alert (uptime)

### Week 2 — Workspaces + Members + Permissions

**Backend:**
- [ ] `POST /workspaces`, `GET /workspaces/:id`, `PATCH /workspaces/:id`
- [ ] `POST /workspaces/:id/members/invite`, `POST /invites/:token/accept`
- [ ] `GET /workspaces/:id/members`, role management
- [ ] `requirePermission` middleware
- [ ] `workspaceGuard` middleware (with isolation tests!)
- [ ] **Workspace isolation auto-test generator** (reads OpenAPI → generates tests)
- [ ] Per-permission module registration system (`core_permissions` row per role per module)
- [ ] Audit log auto-population on state changes

**Frontend:**
- [ ] Workspace creation onboarding (4-step wizard)
- [ ] Team management UI (invite, change role, remove)
- [ ] Role-based UI (hide menu items if no permission)

**Validation:**
- [ ] Isolation test suite: 100% pass on `marketing-core` endpoints

### Week 3 — Billing (Stripe Trial) + 2FA

**Backend:**
- [ ] Stripe subscription create flow
- [ ] `POST /billing/webhook` with idempotency + signature verification
- [ ] `mkt-billing-dunning` cron
- [ ] 14-day trial mechanics
- [ ] Plan + feature flag enforcement middleware
- [ ] TOTP 2FA setup + verification
- [ ] Step-up auth middleware for sensitive actions
- [ ] HIBP password breach check on signup

**Frontend:**
- [ ] Stripe Checkout integration (Elements)
- [ ] Plan selection page
- [ ] Billing settings UI
- [ ] 2FA setup wizard
- [ ] Step-up auth modal for sensitive ops

### Week 4 — First Vertical Slice: SEO + Content + Lead Capture

**Backend:**
- [ ] `seo-engine` keyword CRUD + manual entry
- [ ] `seo-engine` basic Cheerio crawler (single page only)
- [ ] `content-ai` AI provider abstraction (OpenAI only first)
- [ ] `content-ai` `POST /generate/blog` with cost tracking
- [ ] Per-workspace AI credit cap enforcement
- [ ] `crm-automation` contact CRUD
- [ ] `crm-automation` lead capture form (public `POST /f/:slug/submit`)
- [ ] reCAPTCHA + honeypot on form submit

**Frontend:**
- [ ] SEO module: keyword list + add keyword
- [ ] Content module: AI blog generator with SSE streaming
- [ ] CRM module: contacts table (MUI DataGrid)
- [ ] Forms module: form builder + embed snippet

**Validation:**
- [ ] Engineer can register → upgrade to Pro plan → add 5 keywords → run AI blog gen → embed form on test page → submit → see contact created

### ✅ Phase 1 Deliverable (End of Week 4)
- Customer registers + verifies email + sets up 2FA
- Creates workspace, invites team member
- Adds keywords, runs first AI blog post
- Embeds lead capture form on their site
- All 20 module routes accessible (empty states for unbuilt ones)
- **Private alpha** invitations to 5 friendly customers

---

## Phase 2 — Email + Social + Campaign Core (Weeks 5-8)

**Goal:** Customer can run multi-channel campaigns. Email, social, basic analytics, full CRM workflows.

### Services Built (Phase 2 scope)

| Service | Scope This Phase |
|---|---|
| **email-hub** | FULL email (broadcast + drip), TRANSACTIONAL only initially. Visual builder via Unlayer. SendGrid + bounce/complaint webhooks. |
| **social-hub** | OAuth + post scheduling for Meta + Twitter + LinkedIn |
| **campaign-manager** | Campaign CRUD, UTM builder, short link redirect endpoint |
| **analytics-engine** | `POST /track` endpoint, MySQL/PostgreSQL-only (ClickHouse Phase 4), UTM attribution |
| **crm-automation** | Visual workflow builder (React Flow), behavioural triggers, lifecycle stages |
| **notification-service** | Basic in-app notifications + bell badge |

### Week 5 — Email Marketing Core

- email-hub: subscriber CRUD + bulk import
- email-hub: visual builder (Unlayer embedded)
- email-hub: broadcast campaign send + tracking pixel
- email-hub: SendGrid webhook → events
- Frontend: email list management, builder, broadcast send

### Week 6 — Drip Sequences + Workflows

- email-hub: drip sequence engine
- crm-automation: workflow builder UI (React Flow)
- crm-automation: workflow processor cron
- crm-automation: lead scoring rules engine
- crm-automation: behavioural event consumers
- Frontend: workflow canvas with trigger/wait/condition/action nodes

### Week 7 — Social Scheduling

- social-hub: Meta OAuth + post scheduling
- social-hub: Twitter OAuth + posting (note: paid tier required)
- social-hub: LinkedIn OAuth + posting
- social-hub: cross-post composer
- Frontend: social calendar (drag-and-drop)
- Frontend: post composer with platform tweaks

### Week 8 — Campaigns + Tracking

- campaign-manager: campaign CRUD
- campaign-manager: UTM builder
- campaign-manager: short link redirect (high-volume `/go/:short_code`)
- analytics-engine: `POST /track` ingestion (MySQL/PostgreSQL only)
- analytics-engine: UTM attribution view
- notification-service: in-app notifications + bell badge
- Frontend: campaign dashboard, analytics overview

### ✅ Phase 2 Deliverable (End of Week 8)
- Customer can: send a broadcast email to subscribers, schedule social posts, create a campaign with UTM, see analytics
- Drip sequences fire automatically
- Workflows trigger on contact events
- **Private beta** to 25 customers

---

## Phase 3 — AI Flagship + Intelligence + Media (Weeks 9-12)

**Goal:** The flagship One-Click Market Capture works end-to-end. Video + influencer + intelligence modules live.

### Services Built (Phase 3 scope)

| Service | Scope This Phase |
|---|---|
| **content-ai** | COMPLETE: brand voice training, plagiarism, translations, content scoring, all content types |
| **media-hub** | YouTube integration, video SEO audit, AI script generator, Whisper transcription, Shorts scheduler, DALL-E image generation |
| **influencer-hub** | AI influencer discovery, fake-follower detection, outreach CRM, contract workflow |
| **intelligence** | Competitor profiles, ad spy (Meta Ad Library + Google Ads Transparency), keyword gap analysis, price monitor |
| **campaign-manager** | THE FLAGSHIP: One-Click Market Capture full 11-step pipeline with SSE streaming |
| **seo-engine** | COMPLETE: GSC integration, backlink monitoring, full rank tracking (Elasticsearch DEFERRED to Phase 5+; v1 uses MySQL FULLTEXT / Postgres tsvector) |

### Week 9 — AI Provider Abstraction Complete

- content-ai: all 3 providers (OpenAI + Claude + Gemini) with task routing
- content-ai: brand voice training (sample → attribute extraction → preamble)
- content-ai: SEO content scoring + readability + plagiarism check
- content-ai: full content type matrix (blog/landing/social/email/ad/PR/script)
- content-ai: per-workspace AI cost caps + spike detection alerts

### Week 10 — Media + Influencer

- media-hub: YouTube OAuth + channel sync
- media-hub: video SEO audit + AI title/description optimiser
- media-hub: Whisper transcription
- media-hub: DALL-E 3 image generation
- media-hub: Shorts cross-poster
- influencer-hub: discovery + fake-follower detection
- influencer-hub: outreach CRM with AI personalisation
- influencer-hub: contract + e-signature

### Week 11 — Intelligence + Autopilot

- intelligence: competitor profile management
- intelligence: Meta Ad Library + Google Transparency scrape
- intelligence: keyword gap via DataForSEO (calls seo-engine)
- intelligence: price monitor (Puppeteer scrape hourly)
- intelligence: AI cost aggregator + workspace caps
- intelligence: weekly autopilot recommendations

### Week 12 — 🎯 ONE-CLICK MARKET CAPTURE

- campaign-manager: 11-step orchestrator with idempotency + resume
- campaign-manager: SSE streaming endpoint
- campaign-manager: cost cap enforcement (max $5/run)
- campaign-manager: per-step result storage for resume-on-refresh
- Frontend: One-Click wizard with live progress
- Frontend: campaign package preview + per-channel launch buttons
- **End-to-end test:** paste URL → 120 seconds → see complete campaign ready

### ✅ Phase 3 Deliverable (End of Week 12) ⭐ KEY MILESTONE
- **One-Click Market Capture works end-to-end**
- Customer can: paste URL → 2 minutes later have full multi-channel campaign with 30 social posts, 12 blog drafts, drip emails, Google Ads copy, influencer shortlist, image creatives
- Public beta launches: 100 customers
- Demo video shot for marketing
- Press release sent

---

## Phase 4 — Affiliate, CRO, Public API (Weeks 13-16)

**Goal:** Money-making modules complete. Public API live. White-label agency portal.

### Services Built

| Service | Scope This Phase |
|---|---|
| **affiliate-hub** | Full affiliate programs + partner portal + Stripe Connect payouts + fraud detection |
| **analytics-engine** | ClickHouse dual-write, A/B testing with chi-squared, multi-touch attribution (4 models), PDF reports |
| **integration-service** | Public REST API (Phase 1: read endpoints), API key management, OAuth 2.0 server, outbound webhooks |
| **campaign-manager** | A/B test definitions, landing page builder, webinar pages |
| **notification-service** | Weekly digest emails (PDF reports), Slack integration |
| **marketing-core** | Agency white-label settings + custom domain provisioning (ACME) |

### Week 13 — Affiliate Hub

- affiliate-hub: programs + signup + Stripe Connect
- affiliate-hub: tracking link redirect (high-volume)
- affiliate-hub: conversion attribution + commission calculation
- affiliate-hub: fraud detection rules
- affiliate-hub: monthly payout processor
- Frontend: program management, partner portal

### Week 14 — Analytics Engine Advanced

- analytics-engine: ClickHouse integration + outbox pattern + flush worker
- analytics-engine: materialised views for dashboards
- analytics-engine: A/B test engine + chi-squared
- analytics-engine: 4 attribution models
- analytics-engine: PDF report generation
- analytics-engine: predictive analytics (LTV + churn)
- Frontend: A/B test UI, attribution dashboard, custom reports

### Week 15 — Public API + Webhooks

- integration-service: API key issuance + scopes
- integration-service: public v2 endpoints (contacts, lists, send email, send transactional, analytics overview)
- integration-service: outbound webhook subscriptions + delivery + DLQ
- integration-service: OAuth 2.0 server (for Zapier)
- integration-service: OpenAPI 3.1 spec + docs.yourplatform.com
- integration-service: Node SDK auto-gen + npm publish
- Frontend: API key management UI, webhook subscription UI

### Week 16 — Agency White-Label

- marketing-core: agency_settings + custom domain CRUD
- marketing-core: ACME / Let's Encrypt cert provisioning automation
- marketing-core: `mkt-cert-renewal` cron
- nginx: dynamic config for custom domains
- Frontend: agency portal (all clients view), white-label settings UI
- Frontend: branded report PDF templates
- notification-service: weekly digest builder + Slack integration

### ✅ Phase 4 Deliverable (End of Week 16)
- Affiliate programs live; partners earning + getting paid via Stripe Connect
- A/B testing with statistical significance
- Multi-touch attribution dashboard
- Public REST API live (v2.0.0); SDK published
- Outbound webhooks delivering reliably
- Custom domains working for agency clients
- **Open beta:** invite-only signups → public signup

---

## Phase 5 — Local, ASO, Scale, Compliance (Weeks 17-20)

**Goal:** All 20 modules live. SOC 2 Type 1 audit-ready. Production-hardened.

### Services Built

| Service | Scope This Phase |
|---|---|
| **seo-engine** | Local SEO (GMB), ASO (App Store + Google Play), citation builder |
| **email-hub** | SMS (Twilio) + WhatsApp (360dialog) + Push (Firebase) — complete messaging suite |
| **crm-automation** | HubSpot + Salesforce sync (via integration-service), RFM, NPS, advanced segments |
| **integration-service** | Data imports (HubSpot, Mailchimp, Klaviyo), DSAR exports, Zapier marketplace submission |
| **All services** | Performance hardening, SOC 2 evidence collection, load testing |

### Week 17 — Local + ASO

- seo-engine: GMB integration + posts + review management
- seo-engine: local citation builder
- seo-engine: ASO module (App Store Connect + Google Play API)
- seo-engine: local schema markup generator
- Frontend: local SEO dashboard, review management, ASO module

### Week 18 — SMS + WhatsApp + Push

- email-hub: Twilio SMS with full TCPA compliance (time-of-day, STOP keyword, opt-in log)
- email-hub: 360dialog WhatsApp Business
- email-hub: Firebase FCM push
- email-hub: cross-channel drip sequences (email → wait → SMS)
- Frontend: messaging hub UI, channel-specific composers

### Week 19 — Data Migration + Zapier

- integration-service: HubSpot import (OAuth + contacts/companies/deals)
- integration-service: Mailchimp import (audiences + campaigns)
- integration-service: Klaviyo import
- integration-service: CSV import with AI column mapping
- integration-service: DSAR data export pipeline
- integration-service: Zapier app submission (CLI + triggers + actions)
- crm-automation: HubSpot/Salesforce real-time sync
- Frontend: migration wizards, Zapier integration banner

### Week 20 — Production Hardening + Compliance

- All services: k6 load tests pass targets (see testing.md)
- analytics-engine: `/track` sustains 1000 req/sec
- one-click-capture: P95 < 120s
- All services: chaos engineering exercises (kill random pod, verify recovery)
- DR drill: simulate region failure
- SOC 2 evidence collection: access reviews, vulnerability scans, audit log retention
- Penetration test (Trail of Bits or HackerOne) — patch findings
- Public website: pricing, blog, /legal/*, /security, /changelog
- Marketing launch campaign
- Performance: Cloudflare cache headers on Vite SPA bundle (1-year immutable), Astro page caching, landing-renderer CDN cache (max-age=300), Redis caching, per-workspace rate limiting tuned
- Monitoring: 100+ Grafana dashboards across all 14 services

### ✅ Phase 5 Deliverable (End of Week 20) — PRODUCTION LAUNCH
- All 20 modules live
- SOC 2 Type 1 audit ready (evidence collected; auditor engaged)
- Load-tested to 100k workspaces
- Public marketing launch
- 500+ paying customers within Month 1 post-launch

---

## Phase 6 — Post-Launch (Months 6-12)

| Month | Focus |
|---|---|
| 6 | SOC 2 Type 1 audit → certified; share with enterprise prospects |
| 7 | Zapier marketplace public (5+ active customer Zaps required) |
| 8 | Mobile PWA (`apps/web` already SSR; add manifest + service worker) |
| 9-10 | Multi-region (US + APAC) for low-latency global customers |
| 11 | SOC 2 Type 2 evidence period complete |
| 12 | ISO 27001 prep; SAML SSO marketplace listings (Okta, Azure AD) |

---

## Critical Path & Dependencies

```
                    Phase 0 (foundation)
                            │
                            ▼
                    marketing-core (Week 1-3)
                    ◄──── BLOCKS ALL OTHER SERVICES ────►
                            │
        ┌───────────────────┼───────────────────────┐
        ▼                   ▼                       ▼
   seo-engine          content-ai             crm-automation
   (Week 4)            (Week 4)               (Week 4)
        │                   │                       │
        │            ┌──────┘                       │
        │            │                              │
        ▼            ▼                              ▼
   email-hub  ──► campaign-manager ──► One-Click Capture
   (Week 5-6)     (Week 8 + Week 12)    (Week 12) ⭐
        │              │
        ▼              ▼
   social-hub    analytics-engine
   (Week 7)      (Week 8 + Week 14)
                    │
                    ▼
                affiliate-hub
                (Week 13)
                    │
                    ▼
          integration-service ◄── consumes ALL events
          (Week 15 — Public API GA Week 16)
                    │
                    ▼
                  ✓ Public Launch (Week 20)
```

### Parallelisable Workstreams

These can run in parallel after their dependencies are met:

| Workstream | Earliest Start | Owner | Output |
|---|---|---|---|
| Marketing-core | Week 1 | Platform team | Auth, workspaces, billing |
| Frontend skeleton | Week 1 | Frontend team | All routes stubbed; design system |
| Email-hub | Week 5 | Messaging team | Broadcast + drip |
| Social-hub | Week 7 | Social team | Multi-platform scheduling |
| Content-ai | Week 4 | AI team | All content types |
| Campaign-manager | Week 8 | Campaigns team | CRUD + UTM |
| One-Click flagship | Week 12 | Campaigns + AI teams | The 11-step pipeline |
| Affiliate-hub | Week 13 | Affiliate team | Programs + payouts |
| Analytics-engine | Week 8 | Data team | Tracking + dashboards |
| Integration-service | Week 15 | API team | Public REST API |
| Intelligence | Week 11 | Data team | Competitor + autopilot |
| Media-hub | Week 10 | Media team | YouTube + video + DALL-E |
| Influencer-hub | Week 10 | Growth team | Discovery + outreach |

---

## Team Allocation

| Phase | Backend engineers | Frontend engineers | SRE | AI/ML | Total FTE |
|---|---|---|---|---|---|
| 0 | 1 (platform) | 1 (skeleton) | 2 | 0 | 4 |
| 1 | 2 (core + foundation) | 2 (skeleton + auth) | 1 | 0 | 5 |
| 2 | 3 (email + social + campaign) | 2 (dashboard + composer) | 1 | 0 | 6 |
| 3 | 4 (content + media + intel + one-click) | 2 (one-click wizard + media UI) | 1 | 1 | 8 |
| 4 | 3 (affiliate + integration + analytics) | 2 (CRO + reports + agency portal) | 1 | 1 | 7 |
| 5 | 3 (local + ASO + SMS/WhatsApp + sync) | 2 (polish + mobile responsive) | 2 | 1 | 8 |

Plus: 1 Engineering Lead, 1 Product Manager, 1 Designer, 1 QA throughout.

**Total team size at peak (Phase 3): ~12 people.**

---

## Risk Mitigations Per Phase

### Phase 0 Risks
| Risk | Mitigation |
|---|---|
| AWS account setup delays | Start week -3 instead of -2 |
| OAuth app approvals slow (4-8 weeks for Meta/LinkedIn/TikTok) | Submit applications WEEK -2 — block Phase 2 social work if not approved by Week 7 |
| KMS / Vault setup unfamiliar | Use AWS Secrets Manager (simpler) in Phase 1; migrate to Vault Phase 3 if needed |

### Phase 1 Risks
| Risk | Mitigation |
|---|---|
| Auth bugs = total failure | Heavy isolation testing from day 1; auto-generated tests per endpoint |
| Stripe webhook complexity | Use `stripe listen --forward-to` in dev; idempotency from start |
| 2FA library learning curve | Use `otplib` + Speakeasy patterns; cover edge cases (drift, backup codes) |
| Frontend MUI + Vite setup quirks | No SSR helpers needed (Option C SPA). Standard MUI ThemeProvider + CssBaseline pattern works directly. |
| Cross-subdomain auth (yourplatform.com ↔ app.yourplatform.com) | Cookie scoped to `.yourplatform.com`; synchronous session check in `index.html` before React mounts |

### Phase 2 Risks
| Risk | Mitigation |
|---|---|
| SendGrid IP reputation damage if bounces high | Start with managed shared IP; switch to dedicated only at scale |
| Twitter API Pro tier $5k/mo cost | Defer if not justified — use search polling (Basic $200/mo) until revenue justifies |
| React Flow workflow builder complexity | Start with templates only; custom flows Phase 4 |
| OAuth tokens unencrypted at rest by mistake | Code review checklist + linter rule; isolation test covers |

### Phase 3 Risks
| Risk | Mitigation |
|---|---|
| **AI cost spiral on One-Click** | Per-job cost cap ($5 max); per-workspace daily cap; spike alert |
| AI provider outage | Multi-provider abstraction with circuit breaker (Week 9) |
| DALL-E rate limits (50/min) | Bull queue throttle; fallback to Stability AI |
| YouTube quota exhaustion | Request quota increase (4-6 week approval) submitted at Phase 2 |
| One-Click takes too long (>120s) | Parallelise steps where possible; cache common patterns |

### Phase 4 Risks
| Risk | Mitigation |
|---|---|
| Stripe Connect KYC delays affiliate launch | Submit Connect application in Phase 2; pre-onboard test affiliates |
| ClickHouse complexity | Use managed ClickHouse Cloud first; self-host Phase 5 |
| Custom domain ACME challenges fail | Use DNS-01 (not HTTP-01); Cloudflare API for automation |
| Zapier app rejection | Submit early; iterate based on feedback |

### Phase 5 Risks
| Risk | Mitigation |
|---|---|
| SOC 2 evidence missing | Start collecting Phase 1 (access reviews, vulnerability scans) |
| TCPA compliance bugs (SMS) | Legal review of SMS opt-in copy; test STOP keyword; per-country rules |
| Mobile responsive issues | Mobile testing weekly Phase 1+; not just Phase 5 polish |
| Penetration test findings massive | Pre-test in staging Phase 4; address in Phase 5 |
| Load test failures | Continuous load testing from Phase 2 (small scale); ramp up monthly |

---

## Definition of Done per Phase

A phase is "done" only when ALL of these are true:

### Phase Done Checklist
- [ ] All planned features implemented + tested
- [ ] All planned API endpoints have OpenAPI documentation
- [ ] Workspace isolation tests pass for all new endpoints
- [ ] Unit test coverage ≥ 80% on new code
- [ ] Integration tests pass for all new endpoints
- [ ] At least 1 E2E Playwright test per major user flow
- [ ] All new services have runbooks
- [ ] All new services emit required Prometheus metrics
- [ ] All new services have Grafana dashboards
- [ ] All new services have alerts wired to PagerDuty
- [ ] Security review complete on PRs touching auth/billing/PII
- [ ] Performance benchmarks meet targets (load test)
- [ ] Sentry baseline error rate < 0.1%
- [ ] Status page components added for new services
- [ ] Per-service README.md updated
- [ ] Customer-facing changelog entry written
- [ ] Demo recorded for sales team

### Production Launch Gate (Week 20)
Additional bar for Phase 5 completion:

- [ ] **Security:** Pen test complete; all P0/P1 findings fixed
- [ ] **Compliance:** SOC 2 Type 1 audit kicked off; GDPR + CCPA + TCPA + CAN-SPAM complete
- [ ] **Reliability:** 99.9% uptime SLA validated over 30 days in staging
- [ ] **Performance:** All SLOs met for 30 days
- [ ] **DR:** Region failure drill executed successfully
- [ ] **Backups:** Monthly restore drill passes
- [ ] **Documentation:** All 28 docs (3 product + 11 cross-cutting + 17 microservice) current
- [ ] **Customer:** 100+ customers on private beta with NPS ≥ 8
- [ ] **Sales:** 5+ paying enterprise prospects in pipeline
- [ ] **Support:** Help docs + chat support live
- [ ] **Marketing:** Launch announcement ready; demo video; pricing page
- [ ] **Legal:** Terms of Service, Privacy Policy, DPA template signed off
- [ ] **Insurance:** Cyber liability insurance in place

---

## Communication Cadence

### Daily
- Engineering standup (15 min) per team
- Slack #engineering-async updates

### Weekly
- Cross-team sync (1 hour) — service-owner status reports
- On-call handoff (30 min)
- Stakeholder demo (30 min) — show what shipped

### Per Phase (every 4 weeks)
- Phase retro + planning (4 hours)
- Customer beta feedback session
- Updated burndown + projected timeline

### Monthly
- All-hands engineering review
- Cost review (AWS + AI APIs)
- Incident retrospectives

---

## Success Metrics by Phase

| Phase | KPI | Target |
|---|---|---|
| 0 | New engineer can deploy a service to staging | < 1 day |
| 1 | First customer signs up | Week 5 |
| 2 | First customer sends an email campaign | Week 6 |
| 3 | First customer runs One-Click Capture | Week 12 |
| 4 | First customer makes API call | Week 16 |
| 4 | First affiliate paid via Stripe Connect | Week 16 |
| 5 | Public launch traffic peak | 10k visitors/day |
| 5 | First enterprise contract closed | Month 6 |
| 6 | MRR | £100k by Month 12 |
| 6 | Customer NPS | ≥ 60 |

---

## Continuous Practices (Every Week)

Things that happen every week, every phase:

- 🟢 **Deploy multiple times per day** — feature-flagged risky work
- 🟢 **Code review on every PR** — 1 service owner + (1 SRE if infra) + (1 security if auth)
- 🟢 **Update documentation in same PR** — docs as code
- 🟢 **Workspace isolation tests run on every PR**
- 🟢 **Security scan (Snyk + gitleaks)** every PR
- 🟢 **Monitor cost trend** (AWS + AI APIs) — flag if growing > 20% week-over-week
- 🟢 **Customer support tickets reviewed** — bugs feed into next sprint
- 🟢 **On-call rotation** — engineer rotates weekly; documents incidents
- 🟢 **Update CHANGELOG.md** every release
