# ⚖️ Compliance & Privacy
## GDPR · CCPA · CAN-SPAM · TCPA · SOC 2 Roadmap

> Production marketing platforms touch personal data, email lists, SMS subscribers, and behavioural tracking. Every jurisdiction has different rules. Non-compliance = fines, lawsuits, and platform shutdown.

---

## 📋 Table of Contents

1. [What Personal Data Lives Where](#what-personal-data-lives-where)
2. [GDPR (EU + UK)](#gdpr)
3. [CCPA / CPRA (California)](#ccpa--cpra)
4. [CAN-SPAM Act (US Email)](#can-spam-act)
5. [TCPA (US SMS/Calls)](#tcpa)
6. [Cookie Consent](#cookie-consent)
7. [Sub-Processors](#sub-processors)
8. [Data Processing Agreement (DPA)](#data-processing-agreement-dpa)
9. [Data Retention Schedule](#data-retention-schedule)
10. [DSAR & RTBF Implementation](#dsar--rtbf-implementation)
11. [Breach Notification](#breach-notification)
12. [SOC 2 Roadmap](#soc-2-roadmap)

---

## What Personal Data Lives Where

```
Type of PII                          Where stored              Retention default
─────────────────────────────────────────────────────────────────────────────────
Customer (user) account               core_users                  Until deletion
End-customer contacts (CRM)           crm_contacts               Per workspace policy
Email subscribers                     email_subscribers      Per workspace policy
SMS subscribers                       email_subscribers      Per workspace policy
WhatsApp opt-ins                      email_subscribers      Per workspace policy
Lead form submissions                 crm_form_submissions       Per workspace policy
Analytics events (web traffic)        analytics_events       365 days (configurable)
Behavioural tracking                  ClickHouse analytics_events_ch   365 days (configurable)
IP addresses (analytics)              analytics_events       30 days then truncated to /24
Session recordings                    S3 + analytics_heatmap_sessions  90 days
Audit log (admin actions)             core_audit_log              Per plan (30d - 7y)
Stripe customer data                  Stripe (not on our DB)     Per Stripe terms
Influencer contact info               influencer_profiles            Per workspace policy
```

**Data classification:**
- **PII** (Personal Identifiable Information): name, email, phone, IP address (in EU)
- **Sensitive PII**: payment data (handled by Stripe), health data (we don't collect)
- **Operational data**: aggregated analytics with no individual identifiers
- **Confidential**: AI prompts, OAuth tokens, brand strategy

---

## GDPR

Applies to processing of personal data of **EU residents** and **UK residents** (UK GDPR is a near-copy). Fines up to **4% of global annual revenue**.

### The 7 GDPR Principles + Our Implementation

| Principle | Our Implementation |
|---|---|
| **Lawfulness, fairness, transparency** | Privacy policy at `/legal/privacy`; cookie consent banner; clear opt-in copy on every form |
| **Purpose limitation** | Data collected for one purpose isn't repurposed without new consent |
| **Data minimisation** | Lead forms request only what's needed; analytics tracks events only on customer's verified domains |
| **Accuracy** | Subscribers can self-update via preference centre; customers can edit any field |
| **Storage limitation** | Per-data-type retention; auto-delete crons; subscriber-only retention 90 days after unsubscribe |
| **Integrity & confidentiality** | AES-GCM encryption at rest, TLS 1.3 in transit, RBAC, audit log |
| **Accountability** | DPO appointed; sub-processor list maintained; Records of Processing Activities (ROPA) kept |

### Lawful Bases We Use

| Lawful Basis (Article 6) | Where used |
|---|---|
| **Consent** (6(1)(a)) | Email/SMS marketing to end-customers (subscribers), cookies non-essential |
| **Contract** (6(1)(b)) | Account creation, billing, providing the platform service to paying customers |
| **Legitimate interest** (6(1)(f)) | Product analytics on our platform (not customer data), security monitoring, fraud prevention |
| **Legal obligation** (6(1)(c)) | Tax records, anti-money-laundering for Stripe Connect affiliate payouts |

### Data Subject Rights (Articles 15–22)

Every right has a dedicated API endpoint accessible to authenticated customers and their end-customers:

| Right | Article | Endpoint | Implementation |
|---|---|---|---|
| **Access** | 15 | `POST /api/v1/core/dsar/access` | Generate ZIP of all user's data within 30 days |
| **Rectification** | 16 | `PATCH /api/v1/core/users/me` (account); preference centre (subscribers) | Self-serve UI for both |
| **Erasure** ("Right to be Forgotten") | 17 | `POST /api/v1/core/dsar/erasure` | Hard delete pipeline (see DSAR section below) |
| **Restriction of processing** | 18 | `POST /api/v1/core/dsar/restrict` | Sets `restricted=true` flag; jobs skip restricted records |
| **Data portability** | 20 | Included in Access endpoint | JSON + CSV exports |
| **Object to processing** | 21 | Unsubscribe links, opt-out flags | Instant honoring |
| **Not be subject to automated decision-making** | 22 | N/A | Our AI is assistive, not deciding rights/contracts |

### Data Protection Impact Assessment (DPIA)

Required under Article 35 for high-risk processing. Maintain a DPIA for:
- AI-generated content (automated processing affecting people)
- Behavioural tracking at scale (analytics events)
- Cross-border data transfers (US sub-processors)

DPIA template: `/legal/dpia-template.pdf`

### International Data Transfers

The platform uses US-based sub-processors (OpenAI, SendGrid, AWS US regions). To lawfully transfer EU personal data:

1. **Standard Contractual Clauses (SCCs)** signed with every US sub-processor (EU Commission 2021/914)
2. **Transfer Impact Assessment (TIA)** documented per sub-processor
3. **UK addendum** signed for UK-to-non-adequate-country transfers
4. Customer can opt for **EU-only deployment** (Phase 4) where MySQL/PostgreSQL, Redis, ClickHouse, S3, and processing happen entirely in `eu-west-2` (London) region

---

## CCPA / CPRA

Applies to businesses processing personal data of **California residents** with revenue > $25M OR data on 100k+ Californians. Fines: $2,500/violation, $7,500/intentional.

### Implementation

| Requirement | Implementation |
|---|---|
| **Privacy notice at collection** | Lead forms display CCPA notice in California (geo-detected via IP) |
| **Right to know** | Same endpoint as GDPR DSAR access |
| **Right to delete** | Same endpoint as GDPR RTBF |
| **Right to correct (CPRA)** | Self-serve via preference centre |
| **Right to opt-out of sale/sharing** | "Do Not Sell or Share My Personal Information" link in footer (we don't sell; complies trivially) |
| **Global Privacy Control (GPC) signal** | Browser GPC header automatically respected → opt-out flag applied |
| **Sensitive personal info** | We don't collect (no government IDs, financial accounts, precise geo) |
| **Annual privacy report** | Published at `/legal/ccpa-report` if revenue threshold triggered |

---

## CAN-SPAM Act

Applies to **all commercial emails sent to US recipients**. Fines: $51,744 per violation.

### Mandatory on Every Marketing Email

| Requirement | Implementation |
|---|---|
| **Don't use false or misleading header info** | Sender = customer's verified domain or `noreply@yourplatform.com` only |
| **Don't use deceptive subject lines** | We don't enforce content; customers bear responsibility — DPA includes this clause |
| **Identify as advertisement** | Required if not explicit consent; flag in email composer |
| **Tell recipients where you're located** | Mandatory physical postal address in email footer — captured during workspace setup |
| **Tell recipients how to opt out** | Unsubscribe link injected into every email (cannot be removed) |
| **Honor opt-out requests within 10 business days** | Instant honoring; `email_subscribers.status='unsubscribed'` immediately |
| **Monitor what others do on your behalf** | Customers are processors; we are joint controllers per DPA |

### Implementation

- Every email sent through `email-hub` has these injected at the bottom by the template renderer:
  ```html
  <p style="font-size:12px; color:#888">
    You're receiving this because you subscribed at {{workspace.domain}}.
    <a href="{{unsubscribe_url}}">Unsubscribe</a> | 
    <a href="{{preferences_url}}">Preferences</a><br>
    {{workspace.business_name}}, {{workspace.physical_address}}
  </p>
  ```
- Workspace setup forces entry of **physical_address** before any marketing email can be sent
- Unsubscribe link is server-rendered with single-use token (prevents enumeration)
- Unsubscribe is **one-click** (CAN-SPAM compliant): GET on the link unsubscribes; POST not required

---

## TCPA

Applies to **automated SMS / phone calls to US numbers**. Statutory damages: **$500–$1,500 per message**. Class-action exposure is the highest legal risk on the platform.

### Mandatory for SMS

| Requirement | Implementation |
|---|---|
| **Express written consent** | Double opt-in: SMS keyword → confirm "Y" reply to subscribe |
| **Clear consent disclosure** | Opt-in form must state: "Up to N msgs/month, msg & data rates may apply, reply STOP to opt out, reply HELP for help" |
| **STOP keyword honors immediately** | All inbound "STOP", "UNSUBSCRIBE", "QUIT", "CANCEL" trigger opt-out in real-time + send confirmation |
| **HELP keyword** | Returns: "Support: yourplatform.com/help. STOP to opt out." |
| **Time-of-day restriction** | No SMS before 8am or after 9pm in recipient's local time (queue holds until window opens) |
| **State Sunday rules** | Some US states restrict Sunday sends; queue checks |
| **Identify sender** | First SMS in any sequence must identify the workspace's brand |
| **Consent record** | `core_consent_log` stores: subscriber_id, channel, opt-in IP, timestamp, source URL, exact wording |

### Implementation

```javascript
// email-hub/_services/sms-sender.service.js
async function sendSMS(subscriber, message, workspace) {
  // 1. Opt-in check
  if (subscriber.sms_status !== 'subscribed') {
    throw new Error('Recipient not opted in to SMS');
  }

  // 2. Time-of-day check (recipient's timezone)
  const recipientHour = dayjs().tz(subscriber.timezone).hour();
  if (recipientHour < 8 || recipientHour >= 21) {
    await BullQueue.add('mkt-sms-sender', { ... }, { delay: untilNext8amIn(subscriber.timezone) });
    return { status: 'queued_for_window' };
  }

  // 3. Append required footer (first message of any sequence)
  if (await isFirstMessage(subscriber.id, workspace.id)) {
    message = `${workspace.brand_name}: ${message} Reply STOP to opt out.`;
  } else {
    message = `${message} STOP to end.`;
  }

  // 4. Send via Twilio
  await twilio.messages.create({ to: subscriber.phone, from: workspace.sms_sender_id, body: message });

  // 5. Audit log
  await MktAuditLog.create({ ... });
}
```

### Inbound STOP/HELP Handling

```javascript
// Twilio webhook on inbound SMS
const INBOUND_STOP = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'QUIT', 'CANCEL', 'END', 'OPTOUT', 'OPT-OUT'];
const INBOUND_HELP = ['HELP', 'INFO'];

router.post('/sms/inbound', verifyTwilioSig, async (req, res) => {
  const { From, Body } = req.body;
  const text = Body.trim().toUpperCase();

  if (INBOUND_STOP.includes(text)) {
    await MktEmailSubscriber.update({ sms_status: 'unsubscribed' }, { where: { phone: From } });
    return res.type('text/xml').send(`<Response><Message>You're unsubscribed. No more messages.</Message></Response>`);
  }
  if (INBOUND_HELP.includes(text)) {
    return res.type('text/xml').send(`<Response><Message>Support: yourplatform.com/help. STOP to opt out.</Message></Response>`);
  }
  // Other inbound messages routed to two-way SMS handler
});
```

---

## Cookie Consent

### Strategy

- **Essential cookies** (session, CSRF token) — no consent required (legitimate interest)
- **Analytics cookies** (visitor session ID for our analytics) — consent required in EU/UK
- **Functional cookies** (theme, language) — consent required in some jurisdictions
- **Marketing cookies** — N/A (we don't run ads on the platform itself)

### Implementation
- Banner on first visit using a lightweight, accessible component (own implementation or `@phosphor-icons/react` + MUI)
- Three options: "Accept all", "Reject all", "Customise"
- Geo-detect (Cloudflare `cf-ipcountry` header) → show stricter consent in EU/UK; lighter banner in US
- Consent stored in `localStorage` (not a cookie itself) with timestamp + IP hash
- Records audit-grade event in `core_consent_log` (linked to anonymous visitor_id)
- "Re-prompt" every 12 months or after privacy policy update

### Customer Sites Using Our Tracking Script

The script respects `navigator.doNotTrack === '1'` and the Global Privacy Control header (`Sec-GPC: 1`). Customers can configure additional behaviour:
- "Consent mode": don't fire events until customer's CMP grants consent (Cookiebot, OneTrust, Termly)
- "First-party cookie": cookies set on customer's domain via subdomain CNAME (better for ITP/Safari)

---

## Sub-Processors

A current list of third parties processing personal data on behalf of the platform. Published at `/legal/sub-processors` and updated with 30-day advance notice for any changes.

| Sub-Processor | Purpose | Data Type | Location | DPA Signed |
|---|---|---|---|---|
| **AWS** | S3 storage, KMS, CloudFront CDN | All workspace files, encrypted secrets | EU + US (workspace choice) | ✅ |
| **Stripe** | Payments + Connect | Customer billing, affiliate payouts | US (EU-Standard Contract Clauses) | ✅ |
| **SendGrid (Twilio)** | Email delivery | Subscriber emails, transactional emails | US | ✅ |
| **Twilio** | SMS, WhatsApp Business | Subscriber phone numbers, message content | US | ✅ |
| **360dialog** | WhatsApp Business API | Subscriber phone, message content | EU (Germany) | ✅ |
| **OpenAI** | AI text/image/voice generation | User prompts, generated content | US | ✅ — Enterprise tier excludes training |
| **Anthropic** | Claude AI generation | User prompts | US | ✅ |
| **Google Cloud** | Gemini AI generation, OAuth | User prompts, Google account tokens | US | ✅ |
| **Meta (Facebook)** | OAuth, ad management | OAuth tokens, account IDs | US | ✅ |
| **DataForSEO** | SEO data (third-party) | Workspace domain (input only) | US | ✅ |
| **Cloudflare** | CDN, WAF, DDoS protection | IP addresses (logs) | Global edge | ✅ |
| **Sentry** | Error monitoring (PII scrubbing enabled) | Error stack traces, scrubbed user IDs | EU + US | ✅ |
| **PR Newswire** | Press release distribution | Press release content | US | ✅ |
| **SimilarWeb** (intelligence) | Competitor traffic data | Workspace domain (input only) | US | ✅ |
| **Apple / Google App Store APIs** | ASO data | App identifiers (public) | US | N/A (public data) |
| **Linear / GitHub / Slack** (internal) | Engineering tooling | Anonymised support tickets | US | ✅ — DPA on file |

### Required Customer Disclosure

Every customer DPA includes:
1. List of sub-processors at signing
2. 30-day advance notice for new sub-processors
3. Right to object → if not resolvable, right to terminate

---

## Data Processing Agreement (DPA)

The platform acts in **two roles** depending on the data:

| Data | Role |
|---|---|
| Customer's account info (their name, their email) | **Data Controller** (we decide how to use it for billing) |
| Subscriber lists, lead form data, CRM contacts (end-customers of our customer) | **Data Processor** (customer decides; we process on their instruction) |
| Analytics events on customer's website | **Joint Controller** (we define schema; customer decides what to collect) |

### Standard DPA Template Includes

1. **Subject matter** (which data, what processing)
2. **Duration** (life of subscription + 30 days)
3. **Nature and purpose** (provide the platform service)
4. **Type of personal data** (contact info, behavioural data, communications)
5. **Categories of data subjects** (customer's leads, subscribers, prospects)
6. **Controller obligations** (lawful basis, accurate data)
7. **Processor obligations**:
   - Process only on documented instructions
   - Personnel under confidentiality obligations
   - Implement Article 32 security measures (encryption, RBAC, backups)
   - Engage sub-processors only with prior consent
   - Assist with data subject rights
   - Assist with security/breach obligations
   - Delete/return data on termination
   - Allow audits
8. **Sub-processor list** (Annex II)
9. **Security measures** (Annex I — links to `security.md` content)
10. **Standard Contractual Clauses** (Annex III for international transfers)

### Enterprise DPA Customisations

Agency and enterprise customers may request:
- BAA-style controls (not HIPAA, but enhanced)
- Data residency clause (EU-only, US-only)
- Audit rights with reasonable notice
- Specific sub-processor exclusions (e.g., "no OpenAI training" — already standard)
- Custom retention overrides

---

## Data Retention Schedule

Per data type. Customers can configure shorter retention per workspace; the platform-default is shown.

| Data Type | Default Retention | Configurable? | Hard delete? |
|---|---|---|---|
| Customer account | Indefinite while subscribed; 30 days after cancellation; then deleted | No | Yes (30d post-cancellation) |
| End-customer contacts (CRM) | Per workspace policy (default 5 years) | Yes (1m – 10y) | Yes |
| Email subscribers (unsubscribed) | 90 days then deleted (kept for suppression list) | Yes | Yes (anonymised hash kept) |
| Email subscribers (bounced) | 30 days then deleted | No | Yes |
| Lead form submissions | Same as contacts | Yes | Yes |
| Analytics events | 365 days then aggregated | Yes (30d – 24m) | Yes (raw); aggregates kept |
| ClickHouse events | 365 days then dropped via TTL | Yes | Yes |
| IP addresses (in analytics) | 30 days raw; truncated to /24 after | No | Yes (raw); /24 kept |
| Session recordings | 90 days | Yes (7d – 180d) | Yes |
| AI prompts + outputs | 30 days (debugging); then deleted | No | Yes |
| Audit log | Plan-dependent (Free 30d, Pro 1y, Agency 7y) | Plan-tier | Anonymised after retention |
| Stripe billing | 7 years (legal requirement for tax) | No | Held by Stripe |
| Backups | 30 days rolling | No | Yes |
| Soft-deleted rows | 30-day grace; then hard-deleted | No | Yes via `mkt-workspace-deletion` |

### Automated Retention Enforcement

Daily cron jobs:
- `mkt-retention-analytics-events` — delete `analytics_events` older than workspace's retention
- `mkt-retention-clickhouse` — ClickHouse TTL drops partitions automatically
- `mkt-retention-session-recordings` — delete S3 session recording files
- `mkt-retention-ai-prompts` — delete `intel_ai_usage` rows older than 30 days (keep aggregates)
- `mkt-retention-audit-log` — anonymise (replace user PII with hashes) past plan-tier retention

---

## DSAR & RTBF Implementation

### DSAR (Article 15 — Access)

Customer or end-customer requests a copy of all their data.

```
POST /api/v1/core/dsar/access
  body: { email, verification_method }
  → Email verification link sent (PHP-encoded JWT, 24h expiry)
  → User clicks → creates core_dsar_requests (status=verified)
  → Bull queue mkt-data-export picks up
  → Aggregates data across all 14 services:
      • marketing-core: account, plan, sessions, audit log entries
      • crm-automation: contact record, all activities, deals, tasks
      • email-hub: subscription history, all messages sent, opens, clicks
      • analytics-engine: all events with this email/visitor_id
      • social-hub, campaign-manager, etc. — any other appearances
  → Compiles into JSON + CSV ZIP file
  → Encrypted with random password
  → Uploads to S3 (pre-signed URL, 7-day expiry)
  → Emails password (separate email from URL)
  → core_dsar_requests.status='completed'
  → Audit log entry
```

**SLA: 30 days max** (GDPR requirement). Customer-facing dashboard tracks DSAR progress.

### RTBF (Article 17 — Erasure)

Customer or end-customer requests deletion.

```
POST /api/v1/core/dsar/erasure
  body: { email, verification_method, reason }
  → Email verification link
  → User clicks + selects scope:
      - Just unsubscribe from emails
      - Delete from this workspace
      - Delete from all workspaces on the platform (right to be forgotten in full)
  → core_dsar_requests.status='approved'

  → Bull queue mkt-rtbf-purge:
    HARD DELETE from MySQL/PostgreSQL:
      • crm_contacts WHERE email = ?
      • email_subscribers WHERE email = ?
      • crm_form_submissions WHERE data->>'email' = ?
      • crm_workflow_enrollments JOIN
      • email_drip_enrollments JOIN
    HARD DELETE from ClickHouse:
      ALTER TABLE analytics_events_ch DELETE WHERE visitor_id IN
        (SELECT id FROM analytics_visitors WHERE email = ?)
    HARD DELETE from S3:
      Any uploaded files associated with this user
    HARD DELETE from Elasticsearch:
      DELETE BY QUERY across all indexes
    HARD DELETE from Redis:
      All cached references

  → REPLACE in audit log:
      Original: { email: "user@example.com", ... }
      Anonymised: { email: "[REDACTED-RTBF-{hash}]", ... }
      (Legal retention requires the audit entry to remain; PII is hashed)

  → SUPPRESSION LIST:
      Add SHA-256 hash of email to email_suppression
      (prevents re-import via CSV — meets GDPR Art 17(2) "informing controllers")

  → COMPLETE WITHIN 30 DAYS
  → Email confirmation to requester
  → core_dsar_requests.status='completed'
```

**Conflict with backups:** Backups are immutable for 30 days. If a customer is fully erased, but a backup from 28 days ago still contains their data, we cannot edit the backup. Resolution:
- Backups are encrypted; access tightly controlled
- Backup restore is exceptional; if restore happens, we re-run RTBF queue against the restored state
- Backups themselves expire on schedule (30 days) — by then, RTBF-deleted data is gone everywhere

### DSAR Dashboard for Customers

In Settings → Privacy:
- View all DSARs received (theirs and their end-customers')
- Status: pending / verifying / processing / completed / rejected
- Download completed exports
- "Generate test export" button for compliance demos

---

## Breach Notification

### GDPR Article 33 — Notify Supervisory Authority within 72 hours

The Notice must include:
1. Nature of the breach (categories, approximate number of data subjects affected)
2. Likely consequences
3. Measures taken or proposed
4. Contact details of DPO

### GDPR Article 34 — Notify Data Subjects "without undue delay" if high risk

Template stored at `/legal/breach-notification-template.html`:
```
Subject: Important Security Notice from YourPlatform

Dear [Customer Name],

On [DATE], we detected unauthorized access affecting [SCOPE].

What happened: [DESCRIPTION]
When: [TIMELINE]
What information was involved: [DATA CATEGORIES]
What we are doing: [MITIGATION]
What you can do: [RECOMMENDED ACTIONS]

If you have questions, contact our DPO at dpo@yourplatform.com.

Sincerely,
[CEO Name]
```

### Internal Process

1. Incident declared SEV-1 in `security.md` runbook
2. Legal counsel engaged within 1 hour
3. Forensic investigation begins (preserve logs, disable affected accounts)
4. Within 24 hours: customer counts and data-type assessment
5. Within 72 hours: supervisory authority notification (ICO for UK, CNIL for France, etc.)
6. As soon as practical: affected customer notifications
7. Within 7 days: blameless post-mortem published

---

## SOC 2 Roadmap

SOC 2 is required for enterprise sales. Plan to be Type 1 ready by Phase 3 (12 months) and Type 2 by Phase 4 (18 months).

### Trust Service Criteria

| Criterion | Status | Phase |
|---|---|---|
| **Security** | In progress | Phase 1 — security.md controls implemented |
| **Availability** | Phase 2 | 99.9% uptime SLA, status page |
| **Processing Integrity** | Phase 2 | Idempotency, audit log, retry logic |
| **Confidentiality** | Phase 2 | Per-workspace encryption, RBAC |
| **Privacy** | Phase 2 | GDPR/CCPA controls (this document) |

### Phase 1 (now) — Foundation
- Security policies (acceptable use, password, incident response) documented
- Risk assessment performed annually
- Vendor management (this sub-processor list)
- Background checks for engineers with prod access
- Onboarding/offboarding access provisioning checklist

### Phase 2 — Operationalise
- Monthly access reviews
- Quarterly vulnerability scans
- Annual penetration test (engage HackerOne or Trail of Bits)
- Disaster recovery test (annual)
- Security awareness training (annual)

### Phase 3 — Audit-Ready
- Engage SOC 2 auditor (Drata / Vanta / Secureframe — automated evidence collection)
- Type 1 audit: point-in-time review of controls (≈ 6 weeks)
- Receive Type 1 report → share with enterprise customers under NDA

### Phase 4 — Type 2
- 6 months of operating evidence collected continuously
- Type 2 audit: review of control operation over time
- Receive Type 2 report (annual recertification)
