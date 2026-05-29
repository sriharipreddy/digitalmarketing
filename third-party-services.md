# 🌐 Third-Party Services Catalogue
## Complete List · Pricing · Signup Order · Used By

> Every external service the platform depends on. Use this as the **procurement checklist** in Phase 0. Some require multi-week approval — sign up early.

---

## 📋 Table of Contents

1. [Procurement Priority](#procurement-priority)
2. [Critical Path Services](#critical-path-services)
3. [Service Catalogue by Category](#service-catalogue-by-category)
4. [Cost Estimates](#cost-estimates)
5. [Account Ownership](#account-ownership)
6. [Approval Timelines](#approval-timelines)

---

## Procurement Priority

The order in which to sign up. Some take 4-8 weeks to approve — submit on Day 1 of Phase 0.

### 🚨 Week -2 (Day 1) — Submit Immediately

| Service | Why Critical Path | Approval Time |
|---|---|---|
| **AWS Account** | All infrastructure | Instant |
| **Stripe** + Stripe Connect | Billing + affiliate payouts | 1-3 days standard; Connect 1-2 weeks |
| **Meta for Developers** App | Facebook + Instagram OAuth (Phase 2) | **2-4 weeks for App Review** |
| **LinkedIn Marketing Developer Platform** | LinkedIn OAuth (Phase 2) | **2-4 weeks for approval** |
| **TikTok for Business API** | TikTok publish permissions | **4-8 weeks** |
| **Google Cloud Project** | YouTube + Search Console + Ads + GMB + Gemini | OAuth Verified Brand: 2-6 weeks |
| **Google Ads Developer Token** | Google Ads campaigns | **2-4 weeks production token** |
| **Apple Developer Account** | ASO + App Store Connect API | 1-2 days |

### Week -1 — Sign Up Before Phase 1 Starts

| Service | Purpose |
|---|---|
| OpenAI | AI text/image/voice (sign up + add billing) |
| Anthropic | Claude API |
| Google AI Studio | Gemini API |
| SendGrid | Email delivery |
| Twilio | SMS + (optional WhatsApp) |
| Firebase | Push notifications |
| 360dialog | WhatsApp Business (primary) |
| DataForSEO | SEO data (sandbox tier first) |
| Sentry | Error monitoring |
| Cloudflare | DNS + WAF + CDN |
| MaxMind GeoLite2 | IP geolocation (free) |

### Week 0 — Nice to Have

| Service | Purpose |
|---|---|
| Unlayer | Email builder (commercial licence) |
| Statuspage.io / Better Uptime | Status page |
| PagerDuty | On-call paging |
| Snyk / Dependabot | Vulnerability scanning |
| Chromatic | Visual regression testing |
| HypeAuditor / Modash | Influencer data (Phase 3+) |
| SimilarWeb | Competitor traffic (Phase 3+, optional) |
| Copyleaks | Plagiarism detection (Phase 3+) |
| PR Newswire | Press release distribution (Phase 3+) |

---

## Critical Path Services

These block development if not procured in time.

### 1. AWS

| Item | Detail |
|---|---|
| **Signup** | https://aws.amazon.com — corporate card; identity verification |
| **Tier** | Standard support → upgrade to Business at scale |
| **Used by** | All 14 services (ECS, RDS, S3, KMS, CloudFront, ALB) |
| **Cost (Year 1)** | ~$24,000 ($2k/mo growing to $5k/mo by Month 12) |
| **Cost driver** | RDS Multi-AZ, ECS Fargate, data transfer |

### 2. Stripe (+ Stripe Connect)

| Item | Detail |
|---|---|
| **Signup** | https://dashboard.stripe.com/register |
| **Connect KYC** | Apply for Stripe Connect Platform account (1-2 weeks review) |
| **Used by** | marketing-core (subscriptions) + affiliate-hub (payouts) |
| **Cost** | 1.4% + 20p per EU charge; 2.9% + 30¢ US. Connect: 0.25% on transfers + $2/active account |
| **Approval risk** | Standard accounts approve in days; Connect for paying out affiliates needs platform verification |

### 3. Meta (Facebook + Instagram Business)

| Item | Detail |
|---|---|
| **Developer signup** | https://developers.facebook.com |
| **Create App** | Type: Business |
| **Products to add** | Facebook Login, Pages API, Instagram Graph API, Marketing API, Ad Library API |
| **Permissions to request** | `pages_manage_posts`, `pages_read_engagement`, `instagram_content_publish`, `ads_management`, `business_management`, etc. |
| **App Review** | Submit for each permission — **2-4 weeks**; reviewers test the integration |
| **Business Verification** | Required for posting on behalf of users — submit company docs |
| **Used by** | social-hub (organic posting + listening), campaign-manager (Meta Ads), intelligence (Ad Library) |
| **Cost** | Free API; pay per ad spend |

### 4. LinkedIn

| Item | Detail |
|---|---|
| **Apply** | https://developer.linkedin.com — Marketing Developer Platform |
| **Approval** | Manual; 2-4 weeks; requires business case + technical architecture write-up |
| **Used by** | social-hub (organic posting), campaign-manager (Sponsored Content), intelligence (Ad Library) |
| **Cost** | Free API; ads pay per spend |

### 5. TikTok for Business

| Item | Detail |
|---|---|
| **Apply** | https://business-api.tiktok.com |
| **Approval** | **4-8 weeks for publish permissions** — start NOW in Phase 0 |
| **Sandbox available** | Yes — develop against sandbox while waiting |
| **Used by** | social-hub (publish + analytics), campaign-manager (TikTok Ads), intelligence (Ad Library) |
| **Cost** | Free API |

### 6. Google Cloud + Google Ads Developer Token

| Item | Detail |
|---|---|
| **Google Cloud project** | https://console.cloud.google.com — enable APIs (YouTube Data v3, Search Console, Ads, My Business, Analytics 4, Gemini, PageSpeed Insights) |
| **OAuth consent screen** | Must be **verified** for "External" with sensitive scopes — 2-6 weeks Brand Verification |
| **Google Ads Developer Token** | Apply at Google Ads UI → Tools → API Access → request token. **Basic level instant; standard level (production volume) 2-4 weeks** |
| **Used by** | seo-engine (GSC, PageSpeed, GMB), media-hub (YouTube), campaign-manager (Google Ads), content-ai (Gemini) |
| **Cost** | YouTube quota free up to 10k units/day; quota increase free request; Gemini paid per token |

### 7. Apple Developer

| Item | Detail |
|---|---|
| **Signup** | https://developer.apple.com — $99/year individual; $299/year enterprise |
| **App Store Connect API key** | Create in App Store Connect → Users and Access → Keys → App Store Connect API |
| **Used by** | seo-engine (ASO for iOS) |
| **Cost** | $99-299/year |

---

## Service Catalogue by Category

### 🏗️ Infrastructure

| Service | Used By | Cost (estimated, monthly at 1k workspaces) | Signup |
|---|---|---|---|
| **AWS** (EC2, RDS, ECS, KMS, CloudFront) | All services | $2,000 → $5,000 | aws.amazon.com |
| **Cloudflare** (DNS, WAF, CDN, custom domains) | Frontend + edge | $200 (Pro) → $5,000 (Enterprise) | cloudflare.com |
| **AWS Route 53** | DNS records | $25 | — |
| **ClickHouse Cloud** (or self-host) | analytics-engine | $300 → $2,000 | clickhouse.com |
| ~~**Elastic Cloud / Opensearch Service**~~ | ❌ DEFERRED to Phase 5+ — v1 uses MySQL FULLTEXT / PostgreSQL `tsvector`. Add only when database search > 500ms P95. | $0 (v1) → $200-1,500 (Phase 5+) | elastic.co or AWS |

### 💾 File Storage — Pluggable Driver (pick ONE per deploy)

> Storage is **pluggable** via `STORAGE_DRIVER` env. Same code works on all options. See [storage-strategy.md](storage-strategy.md).

| Service | Driver | Cost | Best for | Signup |
|---|---|---|---|---|
| **AWS S3** | `s3` | ~$200/mo for 1TB + egress fees (variable, can be high) | AWS-native deploys; mature; durable | aws.amazon.com |
| **Cloudflare R2** ⭐ recommended for cloud | `s3` (S3-compatible) | ~$15/mo for 1TB + **$0 egress** | Cost-sensitive at scale; serves lots of customer media | cloudflare.com/products/r2 |
| **Backblaze B2** | `s3` (S3-compatible) | $6/mo per 1TB; egress $10/TB or free via Cloudflare | Backup-heavy workloads | backblaze.com |
| **Wasabi** | `s3` (S3-compatible) | $7/mo per 1TB; no egress fees within tier | Cost-sensitive; simple pricing | wasabi.com |
| **MinIO** (self-hosted) | `s3` (S3-compatible) | Server cost only | Self-hosted distributed storage | min.io |
| **DigitalOcean Spaces** | `s3` (S3-compatible) | $5/mo for 250GB + bandwidth | Smaller deploys; simpler than AWS | digitalocean.com |
| **Local disk** | `local` | Disk cost only | On-prem deploys; single server; local dev | n/a |

**Recommended defaults:**
- Local dev → `local` driver
- Staging → `s3` (AWS)
- **Production (cloud)** → `s3` (Cloudflare R2) — best price/perf ratio
- Production (on-prem / data residency) → `local` driver with NFS/EFS for HA, or `s3` (MinIO)

### 🔐 Authentication & Security

| Service | Used By | Cost | Signup |
|---|---|---|---|
| **AWS KMS** | All — encryption | $1/month per key + per-API-call | within AWS |
| **HashiCorp Vault** (or AWS Secrets Manager) | All — secret storage | $0 (Secrets Manager $0.40/secret/month) | within AWS or vault.io |
| **Have I Been Pwned API** | marketing-core (password breach check) | Free | haveibeenpwned.com/API |
| **Cloudflare Turnstile** (CAPTCHA) | crm-automation forms | Free | cloudflare.com |
| **Google reCAPTCHA v3** | crm-automation forms | Free | google.com/recaptcha |
| **Let's Encrypt (ACME)** | marketing-core (custom domains) | Free | letsencrypt.org |
| **Snyk** | CI security scanning | $25/dev/month | snyk.io |
| **gitleaks** | Secret detection in code | Free | github.com/gitleaks/gitleaks |
| **Sentry** | Error monitoring | $80 (Team) → $400 (Business) | sentry.io |

### 💳 Payments

| Service | Used By | Cost | Signup |
|---|---|---|---|
| **Stripe** | marketing-core (subscriptions) | % per transaction | stripe.com |
| **Stripe Connect Express** | affiliate-hub (payouts) | $2/active account/month + transfer fees | within Stripe |
| **Stripe Tax** | marketing-core (VAT/GST/sales tax) | 0.5% per successful tax calc | within Stripe |
| **Stripe Atlas** (optional, for company formation) | Initial setup | $500 one-time | stripe.com/atlas |

### 🤖 AI / ML

| Service | Used By | Cost | Signup |
|---|---|---|---|
| **OpenAI** (GPT-4o, GPT-4o-mini, Whisper, DALL-E 3, Moderation, Embeddings) | content-ai, media-hub | $200 → $20,000/month | platform.openai.com |
| **Anthropic Claude** (3.5 Sonnet, Haiku) | content-ai | $200 → $10,000/month | console.anthropic.com |
| **Google Gemini** (1.5 Pro, Flash) | content-ai | $100 → $5,000/month | aistudio.google.com |
| **Stability AI** (fallback image gen) | media-hub | Pay-per-image | stability.ai |
| **MaxMind GeoLite2** | analytics-engine (IP → location) | Free with attribution; $25/month for GeoIP2 (better accuracy) | maxmind.com |

### 📧 Messaging

| Service | Used By | Cost | Signup |
|---|---|---|---|
| **SendGrid** | email-hub (marketing + transactional), notification-service (digests), marketing-core (auth emails) | Pro $90/mo (200k emails) → Premier $400+ | sendgrid.com |
| **Twilio** (SMS) | email-hub | Per SMS (~$0.0075 US) + $1-15/month per number | twilio.com |
| **Twilio Voice** (optional, Phase 6) | future call-tracking | Per minute | within Twilio |
| **360dialog** (WhatsApp Business — primary) | email-hub | €0.05/conversation + per-message-template fees | 360dialog.com |
| **Twilio WhatsApp** (fallback) | email-hub | More expensive per message | within Twilio |
| **Firebase Cloud Messaging (FCM)** | email-hub, notification-service | Free | console.firebase.google.com |
| **Apple Push Notification Service** (via Firebase) | future mobile | Free | within Apple Developer |
| **Slack Webhooks** | notification-service (optional channel) | Free | api.slack.com |

### 🔍 SEO & Marketing Data

| Service | Used By | Cost | Signup |
|---|---|---|---|
| **DataForSEO** (keyword + SERP + backlinks unified) | seo-engine, intelligence | Pay-per-use (~$50-500/month) | dataforseo.com |
| **Google Search Console** (OAuth per workspace) | seo-engine | Free | console.cloud.google.com |
| **Google PageSpeed Insights API** | seo-engine | Free (25k/day) | within Google Cloud |
| **Google My Business API** | seo-engine | Free | within Google Cloud |
| **App Store Connect API** | seo-engine (ASO iOS) | Free with Apple Developer membership | appstoreconnect.apple.com |
| **Google Play Developer API** | seo-engine (ASO Android) | Free | play.google.com/console |
| **SimilarWeb API** (optional — competitor traffic) | intelligence | $500+/month Enterprise | similarweb.com |
| **HypeAuditor** (optional — influencer data) | influencer-hub | $500+/month | hypeauditor.com |
| **Modash** (alternative influencer data) | influencer-hub | $300+/month | modash.io |

### 📺 Social Platform APIs (free, but approval required)

| Service | Used By | Approval Time | Cost |
|---|---|---|---|
| Meta Graph API (Facebook + Instagram) | social-hub, intelligence | 2-4 weeks | Free |
| Twitter API v2 | social-hub | Instant for Basic; Pro tier $5k/mo for Filtered Stream | Basic $200/mo |
| LinkedIn Marketing API | social-hub, campaign-manager | 2-4 weeks | Free |
| TikTok for Business API | social-hub, campaign-manager | 4-8 weeks | Free |
| YouTube Data API v3 | media-hub | Quota increase 4-6 weeks | Free |
| Pinterest API v5 | social-hub (Phase 5) | 2-3 weeks | Free |

### 💼 Ad Platforms

| Service | Used By | Cost |
|---|---|---|
| **Google Ads API** | campaign-manager | Free API; spend per campaign |
| **Meta Marketing API** | campaign-manager | Free API; spend per campaign |
| **LinkedIn Marketing API** | campaign-manager | Free API; spend per campaign |
| **TikTok Marketing API** | campaign-manager | Free API; spend per campaign |
| **Microsoft Advertising API** (Phase 6) | campaign-manager | Free API; spend per campaign |

### 🛠️ Developer Tools

| Service | Used By | Cost |
|---|---|---|
| **GitHub** (private repos + Actions) | All engineering | Team $4/user/month → Enterprise $21 |
| **Linear** (or Jira) | Project management | $8/user/month |
| **Figma** | Design | $15/editor/month |
| **Notion** (or Confluence) | Internal docs not in repo | $10/user/month |
| **Storybook + Chromatic** | Visual regression | Free Storybook; Chromatic $149/month team |
| **MUI X Pro licence** | DataGrid Pro for keyword/contact tables | £149/dev/year |
| **Postman** (or Insomnia) | API exploration | Free → $12/user/month |

### 📊 Observability

| Service | Used By | Cost |
|---|---|---|
| **Grafana Cloud** (or self-hosted) | All services | Free tier → $300/month → enterprise |
| **Prometheus** (self-hosted) | All services | Free (small VM cost) |
| **Loki** (logs, self-hosted) | All services | Free (S3 storage cost) |
| **Jaeger / Tempo** (tracing) | All services | Free (S3 storage cost) |
| **Sentry** | Error monitoring | $80 → $400/month |
| **Statuspage.io** | Customer status page | $29 → $99/month |
| **Better Uptime** (alternative) | Uptime monitoring + status | $79 → $250/month |
| **PagerDuty** | On-call paging | $21/user/month |
| **Datadog** (if not Grafana) | All-in-one alternative | $15+/host/month |

### 📰 PR & Content

| Service | Used By | Cost |
|---|---|---|
| **PR Newswire** | content-ai (press releases) | $500-$3000 per release |
| **Business Wire** (alternative) | content-ai | Similar to PR Newswire |
| **Copyleaks** (plagiarism) | content-ai | $9.99/month → $99/month |
| **Crowdin** (or Lokalise — i18n) | apps/web translations | $40 → $200/month |
| **Unlayer** (email builder) | email-hub (embed) | $200 one-time licence or SaaS $25-$300/month |

### 🔗 Customer Integration

| Service | Used By | Cost |
|---|---|---|
| **Zapier** (publish app) | integration-service | Free to publish; revenue share if monetised |
| **Make.com** (publish app) | integration-service | Free |
| **n8n** (publish via REST) | integration-service | Free |
| **HubSpot OAuth app** | integration-service (data import) | Free; HubSpot pays nothing |
| **Mailchimp OAuth app** | integration-service | Free |
| **Klaviyo OAuth app** | integration-service | Free |
| **Salesforce Connected App** | integration-service | Free |
| **ActiveCampaign OAuth** | integration-service | Free |
| **ConvertKit (Kit) OAuth** | integration-service | Free |

### ⚖️ Legal & Compliance

| Service | Used By | Cost |
|---|---|---|
| **Termly / Iubenda** (privacy policy / cookie consent generator) | apps/web | $10-50/month |
| **Vanta / Drata / Secureframe** (SOC 2 evidence automation, Phase 4+) | Compliance team | $400-2000/month |
| **Stripe Tax** | marketing-core (VAT/GST/sales tax) | 0.5% per tax calc |
| **DocuSign / HelloSign** (optional, influencer-hub contracts) | influencer-hub | $10-30/user/month |
| **Trail of Bits / HackerOne** (pen test, Phase 4+) | Security | $20k-50k per engagement |

### 🎨 Design Assets

| Service | Used By | Cost |
|---|---|---|
| **Unsplash / Pexels API** (stock photos) | content-ai (free imagery) | Free |
| **Heroicons / Lucide / Material Icons** | apps/web | Free |
| **Inter font** (via Google Fonts) | apps/web | Free |

---

## Cost Estimates

### Year 1 (assuming 1,000 paying customers by Month 12)

| Category | Year 1 Total (USD) | Notes |
|---|---|---|
| **AWS infrastructure** (compute, RDS, KMS) | $24,000 | Compute, database, data transfer; storage moved out |
| **File storage** (Cloudflare R2 OR AWS S3 OR local — choose per deploy) | $1,800 (R2) / $6,000 (S3) / $0 + $1,200 disk (local) | See [storage-strategy.md](storage-strategy.md) |
| **AI APIs** (OpenAI + Claude + Gemini) | $40,000 | Highest variable cost; scales with usage |
| **SendGrid** | $5,000 | Pro plan; sub-users for white-label |
| **Twilio (SMS + WhatsApp)** | $8,000 | Variable per send |
| **DataForSEO** | $4,000 | Pay-per-use |
| **ClickHouse Cloud** | $5,000 | Analytics scale-up |
| ~~Elasticsearch~~ | $0 (v1 — deferred) | Database FULLTEXT covers v1; add Phase 5+ |
| **Cloudflare Pro/Business** | $2,500 | WAF + CDN + custom domains |
| **Sentry + Statuspage + PagerDuty** | $5,000 | Observability stack |
| **Stripe fees** | (% of revenue) | Pass-through; not a fixed cost |
| **PR Newswire** (5 releases) | $5,000 | Marketing launch budget |
| **MUI X Pro licences** (5 devs) | $750 | Annual |
| **Misc SaaS** (Linear, Figma, GitHub, etc.) | $6,000 | Per-user team tools |
| **Penetration test** (1 engagement) | $25,000 | Phase 4 milestone |
| **Total** | **~$140,000** | First year ops; varies ±30% |

### At 10,000 Customers (Year 2-3)

| Category | Monthly | Annual |
|---|---|---|
| AWS | $15,000 | $180,000 |
| AI APIs | $20,000 | $240,000 |
| ClickHouse (+ Elasticsearch from Phase 5) | $3,000 | $36,000 |
| Messaging (SendGrid + Twilio) | $10,000 | $120,000 |
| All others | $10,000 | $120,000 |
| **Total** | **$60,000** | **$720,000** |

---

## Account Ownership

Single source of truth — who owns each account login.

| Service | Account Owner | Backup |
|---|---|---|
| AWS root | CTO | Platform Lead |
| Cloudflare | SRE Lead | CTO |
| Stripe | CEO | CFO |
| GitHub org owner | CTO | Engineering Lead |
| All AI provider accounts | CTO | AI/ML Lead |
| Google Cloud project | Platform Lead | SRE Lead |
| Meta / LinkedIn / TikTok dev accounts | Product Lead | Marketing Lead |
| Sentry | SRE Lead | Platform Lead |
| Domain registrar | CEO | CTO |
| SSL/TLS certs (ACME automated) | SRE Lead | — |
| Stripe Connect platform | CFO | CEO |
| Slack / Discord / internal | Platform Lead | All |

**Rules:**
- Personal email **NEVER** used for accounts (always use `accounts+<service>@yourplatform.com`)
- 2FA mandatory on every account
- Password manager (1Password Business) — shared vault per category
- Quarterly access review: who has access to what, do they still need it
- Offboarding: same-day revocation across all accounts

---

## Approval Timelines (Summary)

```
Day 0
├── AWS, Stripe (standard), OpenAI, Anthropic, Google AI, SendGrid, Twilio, Firebase, Sentry — INSTANT
├── Apple Developer — 1-2 days
│
Day 7
├── Stripe Connect (platform-level KYC) — DONE
│
Week 2
├── Stripe Connect approved
│
Week 4
├── Meta App Review approved (some permissions)
├── LinkedIn Marketing API approved
├── Google Ads Developer Token (Standard) approved
│
Week 6
├── Google OAuth Brand Verification approved
├── Cloudflare custom domain SSL automation tested
│
Week 8
├── TikTok publish permissions approved
├── YouTube quota increase approved (1M units/day)
│
Week 12 (Phase 3 start)
└── ALL critical-path services available for production use
```

**Failure mode:** if any of these aren't approved on time, the corresponding service work blocks. Mitigations in `99-build-phases.md` → Risk Mitigations.

---

## Vendor Lock-In Risk

| Locked in by | Severity | Mitigation |
|---|---|---|
| AWS-specific services (KMS, RDS, ECS) | High | Acceptable; standard for SaaS at this scale |
| Stripe payments | High | Acceptable; market leader; migration possible but costly |
| Sentry (error monitoring) | Low | Could swap to Datadog/Honeycomb |
| Cloudflare | Medium | Could swap to Fastly; DNS migration ~1 day |
| SendGrid | Medium | Could swap to Mailgun/Postmark; subscriber lists portable |
| OpenAI | Low | Provider abstraction in content-ai (see ai-platform.md) |
| Twilio | Low | Could swap to Vonage/MessageBird |

---

## Sub-Processor List (for customer DPA)

The platform's **public sub-processor list** at `/legal/sub-processors`. See `compliance.md` for the full DPA-grade list with signed agreements + transfer impact assessments.

Customer-facing tier:
- AWS, Cloudflare (infrastructure)
- Stripe, Stripe Connect (payments)
- OpenAI, Anthropic, Google AI (AI processing)
- SendGrid, Twilio, 360dialog (messaging delivery)
- Sentry (error monitoring — PII scrubbed)
- DataForSEO, SimilarWeb (analytics data — domain only, no PII)
- PR Newswire (press distribution)

Customers must be notified 30 days in advance for any change.
