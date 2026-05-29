# 🔌 Public API & Integrations
## Customer-Facing REST API · Outbound Webhooks · Zapier · Data Imports

> Customers want to integrate the platform with their own tools (CRMs, data warehouses, custom dashboards). Without a public API, you're not enterprise-ready.

---

## 📋 Table of Contents

1. [Why a Public API](#why-a-public-api)
2. [Authentication](#authentication)
3. [API Surface](#api-surface)
4. [Rate Limits](#rate-limits)
5. [Outbound Webhooks](#outbound-webhooks)
6. [Zapier Integration](#zapier-integration)
7. [Make.com / n8n / Pipedream](#makecom--n8n--pipedream)
8. [Data Import (HubSpot, Mailchimp, Klaviyo)](#data-import)
9. [Embed SDK](#embed-sdk)
10. [API Documentation](#api-documentation)
11. [SDKs](#sdks)
12. [Versioning & Deprecation](#versioning--deprecation)

---

## Why a Public API

| Customer | What They'd Build With Your API |
|---|---|
| E-commerce store | Auto-create lead in CRM when Shopify order completes |
| Agency | Pull all client analytics into custom dashboard for client reviews |
| SaaS | Sync subscribers between platform and their product database |
| Developer | Build a Slack bot that posts daily SEO ranking updates |
| Enterprise | Pipeline campaign data to their data warehouse (Snowflake, BigQuery) |
| Zapier user | Trigger any workflow on any platform event |

Without a public API, enterprise sales conversations end before they begin.

---

## Authentication

### API Keys

Customers generate API keys in Settings → API → Generate Key.

```sql
CREATE TABLE integ_api_keys (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  user_id         CHAR(36)     NOT NULL,
  name            VARCHAR(100) NOT NULL,           -- "Zapier", "My CRM"
  key_prefix      VARCHAR(10),                     -- first 8 chars for identification
  key_hash        VARCHAR(64)  NOT NULL,           -- bcrypt of the secret
  scopes          JSON,                            -- ['read:contacts', 'write:campaigns']
  last_used_at    DATETIME,
  expires_at      DATETIME,                        -- NULL = never; max 1 year recommended
  ip_allowlist    JSON,                            -- optional CIDR ranges
  status          ENUM('active','revoked') DEFAULT 'active',
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  INDEX idx_workspace (workspace_id),
  INDEX idx_key_prefix (key_prefix)
) ENGINE=InnoDB;
```

### Key Format

```
mkt_live_<32-byte-base62>     # production
mkt_test_<32-byte-base62>     # sandbox
```

Example: `mkt_live_AbCdEfGhIjKlMnOpQrStUvWxYz1234567890ABCD`

### Key Display Rules

- **Shown only once at creation** — never retrievable later
- After creation, only the prefix is shown: `mkt_live_AbCdEfGh...`
- "Roll" feature: generate new key, revoke old after grace period
- **Hash storage**: bcrypt(10) — same as user passwords
- Audit log captures: key creation, revocation, every authenticated request (sampled)

### Authentication Methods

```bash
# Recommended: Authorization header
curl https://api.yourplatform.com/v2/contacts \
  -H "Authorization: Bearer mkt_live_AbCdEfGh..."

# Alternative: header (Zapier, legacy)
curl https://api.yourplatform.com/v2/contacts \
  -H "X-API-Key: mkt_live_AbCdEfGh..."

# Never accept keys in query string (logged in access logs)
```

### Scopes (OAuth-style permissions)

Keys are issued with specific scopes — least privilege:

| Scope | Allows |
|---|---|
| `read:contacts` | `GET /v2/contacts/*` |
| `write:contacts` | `POST/PATCH/DELETE /v2/contacts/*` |
| `read:campaigns` | `GET /v2/campaigns/*` |
| `write:campaigns` | `POST/PATCH/DELETE /v2/campaigns/*` |
| `read:analytics` | `GET /v2/analytics/*` |
| `read:keywords` | `GET /v2/keywords/*` |
| `write:emails` | `POST /v2/emails/send` |
| `webhooks:manage` | `POST/DELETE /v2/webhooks/*` |
| `read:all` | All GET endpoints |
| `write:all` | All POST/PATCH/DELETE |
| `admin` | Includes workspace settings, team management |

UI presents these as friendly groups: "Read contacts", "Manage campaigns", etc.

### OAuth 2.0 for Third-Party Apps

For apps that act on behalf of multiple customers (Zapier, HubSpot, custom OAuth apps):

```
GET /oauth/authorize
  ?client_id=zapier_app_id
  &redirect_uri=https://zapier.com/oauth/callback
  &response_type=code
  &scope=read:contacts+write:campaigns
  &state=<random>

→ User logs in (if not already) → consent screen → redirect with code
→ App exchanges code for access_token + refresh_token
→ access_token valid 1 hour, refresh_token valid 90 days
```

Built using `oauth2-server` Node library, same JWT_SECRET as platform.

---

## API Surface

### Base URL

```
Production:  https://api.yourplatform.com/v2/
Sandbox:     https://api-sandbox.yourplatform.com/v2/
```

### Resources

| Resource | Endpoints |
|---|---|
| **Workspaces** | `GET /workspaces/me` |
| **Contacts (CRM)** | `GET /contacts`, `POST /contacts`, `GET /contacts/:id`, `PATCH /contacts/:id`, `DELETE /contacts/:id`, `POST /contacts/bulk` |
| **Companies** | `GET /companies`, `POST /companies`, `GET /companies/:id`, `PATCH /companies/:id` |
| **Deals** | `GET /deals`, `POST /deals`, `PATCH /deals/:id` |
| **Email lists** | `GET /lists`, `POST /lists`, `GET /lists/:id/subscribers` |
| **Email subscribers** | `POST /lists/:id/subscribers`, `PATCH /subscribers/:id`, `DELETE /subscribers/:id` |
| **Send transactional email** | `POST /emails/send` |
| **Campaigns** | `GET /campaigns`, `POST /campaigns`, `GET /campaigns/:id`, `POST /campaigns/:id/launch` |
| **Content** | `GET /content`, `POST /content`, `POST /content/:id/publish` |
| **Social posts** | `GET /social/posts`, `POST /social/posts`, `POST /social/posts/:id/publish` |
| **Forms** | `GET /forms`, `GET /forms/:id/submissions` |
| **Keywords** | `GET /keywords`, `POST /keywords`, `GET /keywords/:id/rankings` |
| **Analytics** | `GET /analytics/overview`, `GET /analytics/events`, `GET /analytics/conversions` |
| **Reports** | `GET /reports`, `POST /reports/generate` |
| **Webhooks** | `GET /webhooks`, `POST /webhooks`, `DELETE /webhooks/:id` |

### Standard Request/Response Shape

```
GET /v2/contacts?limit=50&page=2&filter[lifecycle_stage]=mql

Response 200:
{
  "data": [
    {
      "id": "01H...",
      "email": "jane@example.com",
      "first_name": "Jane",
      "last_name": "Doe",
      "company": "Acme Corp",
      "lifecycle_stage": "mql",
      "lead_score": 75,
      "tags": ["webinar-2026", "high-intent"],
      "custom_fields": { "industry": "saas" },
      "created_at": "2026-05-01T10:23:45Z",
      "updated_at": "2026-05-20T14:11:02Z"
    }
  ],
  "meta": {
    "page": 2,
    "limit": 50,
    "total_pages": 17,
    "total_count": 823
  },
  "links": {
    "self": "https://api.yourplatform.com/v2/contacts?page=2&limit=50",
    "next": "https://api.yourplatform.com/v2/contacts?page=3&limit=50",
    "prev": "https://api.yourplatform.com/v2/contacts?page=1&limit=50",
    "first": "https://api.yourplatform.com/v2/contacts?page=1&limit=50",
    "last": "https://api.yourplatform.com/v2/contacts?page=17&limit=50"
  }
}
```

### Error Format

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Email address is required",
    "details": {
      "email": ["Field is required", "Must be a valid email"]
    },
    "request_id": "01H..."
  }
}
```

### HTTP Status Codes

| Code | Meaning |
|---|---|
| 200 | Success |
| 201 | Created (POST) |
| 204 | No Content (DELETE) |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing/invalid API key) |
| 402 | Payment Required (plan doesn't include this feature) |
| 403 | Forbidden (scope insufficient or workspace isolation) |
| 404 | Not Found |
| 409 | Conflict (duplicate resource) |
| 422 | Unprocessable Entity (semantic error) |
| 429 | Too Many Requests (rate limit) |
| 500 | Server Error |
| 503 | Service Unavailable (maintenance / overload) |

### Filtering, Sorting, Pagination

**Filtering:**
```
GET /contacts?filter[lifecycle_stage]=customer&filter[created_after]=2026-01-01
GET /contacts?filter[tags]=high-intent,webinar
GET /contacts?filter[email][contains]=@example.com
```

**Sorting:**
```
GET /contacts?sort=-created_at         (descending)
GET /contacts?sort=last_name,first_name (multi-field)
```

**Pagination:**
- Default: `page=1&limit=20`
- Max limit: 100 per page
- Cursor pagination available: `GET /contacts?cursor=<opaque>&limit=50` for stable iteration over large lists

### Idempotency

For POST requests, customers can pass `Idempotency-Key` header:
```
POST /contacts
Idempotency-Key: my-unique-key-2026-05-28-123
```
- Same key + body within 24h returns the same response without re-creating
- Same key + different body returns 409

Implemented via `core_idempotency_keys` table (see `security.md`).

### Bulk Operations

```
POST /v2/contacts/bulk
Content-Type: application/json

{
  "operations": [
    { "method": "POST", "data": { "email": "a@example.com", ... } },
    { "method": "PATCH", "id": "01H...", "data": { "lifecycle_stage": "customer" } },
    { "method": "DELETE", "id": "01H..." }
  ]
}

Response 200:
{
  "results": [
    { "status": 201, "data": { "id": "01H..." } },
    { "status": 200, "data": { "id": "01H...", "updated_at": "..." } },
    { "status": 204 }
  ]
}
```

Limit: 1,000 operations per bulk request. Larger imports use the data import API (async, see below).

---

## Rate Limits

### Per-Plan Limits

| Plan | Read req/min | Write req/min | Bulk ops/min |
|---|---|---|---|
| Free | 30 | 10 | 100 |
| Starter | 100 | 30 | 500 |
| Pro | 1,000 | 300 | 5,000 |
| Agency | 5,000 | 1,500 | 25,000 |
| Enterprise | 10,000+ | 3,000+ | custom |

### Rate Limit Headers

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 1716893700
Retry-After: 23  (when 429 returned)
```

### Token Bucket Algorithm

Implemented in Redis via `rate-limit-redis`. Refills continuously, not at fixed intervals.

### Burst Allowance

Pro plan: 1,000 req/min sustained = 16.7/sec. Burst up to 50 req/sec for 10 seconds, then throttled to sustained rate.

### Per-Endpoint Costs

Heavy endpoints "cost" more from the bucket:
- `GET /analytics/events` with large date range: 5 units
- `POST /content` with AI generation: 10 units
- Standard CRUD: 1 unit

### Quota Headers (separate from rate limit)

```
X-Quota-Limit: 25000      (emails/month for plan)
X-Quota-Used: 18420
X-Quota-Reset: 2026-06-01T00:00:00Z
```

When quota exhausted: 402 Payment Required with upgrade URL.

---

## Outbound Webhooks

Customers subscribe their endpoints to platform events.

### Subscribing

```
POST /v2/webhooks
{
  "url": "https://my-crm.example.com/webhooks/yourplatform",
  "events": ["contact.created", "contact.updated", "form.submission"],
  "description": "Sync to my CRM"
}

Response 201:
{
  "id": "wh_01H...",
  "url": "https://my-crm.example.com/webhooks/yourplatform",
  "events": ["contact.created", "contact.updated", "form.submission"],
  "secret": "whsec_AbCdEf...",          # shown once
  "status": "active",
  "created_at": "2026-05-28T10:00:00Z"
}
```

### Event Catalog

| Event | Trigger |
|---|---|
| `workspace.member_invited` | Team member invited |
| `workspace.member_joined` | Team member accepted invite |
| `contact.created` | New contact added (any source) |
| `contact.updated` | Contact field changed |
| `contact.deleted` | Contact removed |
| `contact.lifecycle_changed` | Lifecycle stage transition (lead → MQL → customer) |
| `contact.score_threshold_crossed` | Lead score crossed configured threshold |
| `form.submission` | Lead capture form submitted |
| `email.opened` | Subscriber opened an email |
| `email.clicked` | Subscriber clicked link |
| `email.bounced` | Hard bounce |
| `email.unsubscribed` | Subscriber unsubscribed |
| `campaign.launched` | Campaign went live |
| `campaign.completed` | Campaign finished |
| `social.post_published` | Scheduled post went live |
| `social.post_failed` | Scheduled post failed to publish |
| `social.mention_detected` | Brand mention detected by social listening |
| `seo.ranking_changed` | Keyword position changed by > 3 positions |
| `seo.audit_completed` | Site audit finished |
| `analytics.conversion_goal` | Custom conversion event fired |
| `analytics.anomaly_detected` | AI detected unusual traffic pattern |
| `webhook.test` | Sent immediately on subscription creation to verify endpoint |

### Webhook Payload

```http
POST https://my-crm.example.com/webhooks/yourplatform
Content-Type: application/json
User-Agent: YourPlatform-Webhooks/2.0
X-Marketing-Event: contact.created
X-Marketing-Event-Id: evt_01H...
X-Marketing-Workspace-Id: ws_01H...
X-Marketing-Timestamp: 1716893700
X-Marketing-Signature: t=1716893700,v1=<hex-hmac-sha256>

{
  "id": "evt_01H...",
  "event": "contact.created",
  "workspace_id": "ws_01H...",
  "occurred_at": "2026-05-28T10:00:00Z",
  "data": {
    "contact": {
      "id": "01H...",
      "email": "jane@example.com",
      "first_name": "Jane",
      ...
    }
  }
}
```

### Signature Verification (customer side)

```javascript
// Pseudo-code customers implement on their endpoint
const crypto = require('crypto');

function verifyWebhook(req) {
  const sig = req.headers['x-marketing-signature'];
  const [t, v1] = sig.split(',').map(p => p.split('=')[1]);

  // Reject if timestamp > 5 minutes old (replay protection)
  if (Math.abs(Date.now()/1000 - parseInt(t)) > 300) return false;

  const payload = `${t}.${JSON.stringify(req.body)}`;
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET)
                          .update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
}
```

### Delivery Reliability

See `security.md` → Outbound Webhooks for retry schedule. Summary:
- Up to 7 retries with exponential backoff over 30 hours
- Failed deliveries → manual replay UI in dashboard
- Auto-disable after 50 consecutive failures + email owner

### Webhook Testing

Customers can:
- Send test event from dashboard ("Send test webhook" button)
- View delivery log with response codes, latency, request/response bodies (PII-redacted)
- Replay any delivery manually
- View last 30 days of attempts

---

## Zapier Integration

Zapier is the #1 most-requested integration. Build a private Zapier app first, public after testing.

### Triggers (when something happens in our platform)

| Trigger | Description |
|---|---|
| New Contact | Fires when a contact is created |
| New Form Submission | Fires on form submission |
| Contact Stage Changed | Fires when lifecycle_stage changes |
| New Email Subscriber | Fires when someone subscribes |
| Email Opened | Fires when subscriber opens (sampled) |
| Email Clicked | Fires on link click |
| New Lead Score Threshold | Fires on lead score threshold crossing |
| New Brand Mention | Fires on social listening hit |
| Keyword Rank Drop | Fires when keyword drops >5 positions |
| Campaign Launched | Fires on campaign launch |

### Actions (do something in our platform from Zapier)

| Action | Description |
|---|---|
| Create or Update Contact | Upsert by email |
| Add to Email List | Add subscriber to specified list |
| Send Transactional Email | Send one-off email |
| Add Tag to Contact | Tag management |
| Create Deal | New deal in CRM pipeline |
| Add to Drip Sequence | Enrol contact in named sequence |
| Update Lead Score | Adjust score manually |
| Create Task | Internal task for team |

### Search Actions

| Search | Description |
|---|---|
| Find Contact by Email | Search and return contact |
| Find Campaign by Name | Search campaigns |
| Find Deal | Search deals |

### Implementation

- Zapier Platform CLI to build the app
- OAuth 2.0 for authentication (not API key — Zapier prefers OAuth)
- Each trigger polls every 1 minute (Zapier default) OR uses REST Hooks for instant delivery
- REST Hooks: customer's Zap subscribes to a webhook event → instant delivery

### Submitting to Zapier Marketplace

1. Build app via Zapier Platform CLI
2. Invite beta users to test (10+ active users to publish)
3. Submit for review (Zapier reviews quality, security, UX)
4. Once approved: listed publicly, visible to all 5M+ Zapier users

---

## Make.com / n8n / Pipedream

Make (formerly Integromat), n8n, and Pipedream are alternatives to Zapier with more advanced workflows.

### Strategy
- Don't build native modules for each (too much work)
- Provide great REST API + webhooks → these tools support REST and webhooks natively
- Publish workflow templates on each platform's marketplace
- For Make.com: build a custom module (1 week effort) once we have demand

---

## Data Import

Customers migrating from other platforms need bulk import.

### Supported Imports

| Source | Format |
|---|---|
| **HubSpot CRM** | API integration (OAuth) — import contacts, companies, deals |
| **Mailchimp** | API integration — import audiences, campaigns, automations |
| **Klaviyo** | API integration — import lists, flows, segments |
| **ActiveCampaign** | API integration |
| **ConvertKit** | API integration |
| **Salesforce** | API integration (Enterprise only — complex) |
| **CSV** | Generic CSV with column mapping |
| **JSON** | For developer-friendly imports |
| **Google Sheets** | OAuth + sheet selection |

### Import Flow

```
1. Settings → Imports → "New Import"
2. Choose source → OAuth / upload file
3. Map columns:
   - Source column → platform field
   - Examples: "Email Address" → email
              "First name" → first_name
              "Custom: Industry" → custom_fields.industry
4. Preview first 5 rows with mapping applied
5. Configure:
   - Duplicate handling: skip / update / fail
   - Lifecycle stage default: lead
   - Tags to apply: [imported, hubspot, may-2026]
6. Start import:
   - Async via mkt-data-import Bull queue
   - 1,000 rows/batch
   - Progress UI with ETA
   - Error report at end (failed rows in CSV format)
7. Completion email
```

### Data Mapping Intelligence

AI-suggested mappings on column upload:
- "Email" / "E-mail" / "EmailAddress" → email
- "First" / "FName" / "Given" → first_name
- Common patterns recognised, custom fields user-confirmed

### Error Handling

- Validation errors per row logged with reason: "Invalid email", "Duplicate skipped", "Phone format invalid"
- Failed rows downloadable as CSV with error column added
- Partial import success: 8,234 imported, 412 failed → user can fix and re-upload only failed rows

### Limits

| Plan | Max import size |
|---|---|
| Free | 500 rows |
| Starter | 5,000 rows |
| Pro | 50,000 rows |
| Agency | 250,000 rows |
| Enterprise | Unlimited |

For >250k rows: dedicated migration support from CSM.

### Export (reverse)

```
GET /v2/contacts/export?format=csv&filter[lifecycle_stage]=customer

→ Returns 202 Accepted with job_id
→ Async generation
→ Customer downloads from /v2/exports/:job_id when ready
→ S3 pre-signed URL, 7-day expiry
```

---

## Embed SDK

For customers who want to embed platform features in their own products.

### What's Embeddable

| Component | Use Case |
|---|---|
| Lead form widget | Embed a tracked form on any website |
| Live chat widget | AI chatbot + lead capture on customer's site |
| Pricing table | Pull live pricing from the platform into website |
| Public review widget | Display Google/Yelp reviews managed via platform |
| Newsletter signup | Embed email subscription form |

### JavaScript Embed

```html
<script async src="https://cdn.yourplatform.com/embed.js"
        data-workspace-id="ws_01H..."></script>

<div data-mkt-form="form_01H..."></div>          <!-- lead form -->
<div data-mkt-chat="chat_01H..."></div>          <!-- chat widget -->
<div data-mkt-newsletter="list_01H..."></div>    <!-- newsletter -->
```

### React/Vue Components

```bash
npm install @yourplatform/embed-react
```

```jsx
import { LeadForm, ChatWidget } from '@yourplatform/embed-react';

<LeadForm formId="form_01H..." onSubmit={handler} theme="auto" />
<ChatWidget workspaceId="ws_01H..." position="bottom-right" />
```

### Security

- All embed widgets respect the workspace's domain allowlist (CORS)
- iframe-based for tighter isolation
- No platform credentials exposed to customer site
- CSP-friendly (provide directives in docs)

---

## API Documentation

### Tools

- **OpenAPI 3.1 spec** — single source of truth (`openapi.yaml`)
- **Mintlify** or **Stoplight Elements** — hosted docs site (`docs.yourplatform.com`)
- **Postman Collection** — auto-generated from OpenAPI
- **Code samples** in: cURL, JavaScript, Python, Ruby, PHP, Go

### Documentation Quality Rules

- Every endpoint has: description, parameters, request body schema, response schemas (per status code), example request, example response
- Every error code has explanation + remediation
- Authentication flow documented with diagram
- Webhook events catalog with sample payloads
- Idempotency, rate limiting, pagination explained with examples
- Quick-start guide: "Send your first email in 5 minutes"
- Migration guides per source platform (HubSpot, Mailchimp)
- Changelog with breaking change warnings

### Docs URL Structure

```
docs.yourplatform.com/
├── /                            ← Quickstart
├── /authentication
├── /reference/                  ← Auto-generated from OpenAPI
│   ├── /contacts
│   ├── /campaigns
│   └── ...
├── /webhooks                    ← Event catalog
├── /sdks                        ← SDK docs per language
├── /guides/
│   ├── /migrate-from-hubspot
│   ├── /build-zapier-integration
│   └── /sync-with-data-warehouse
├── /changelog
└── /status                      ← link to status.yourplatform.com
```

---

## SDKs

Official SDKs for the most common languages.

### Phase 1: JavaScript/TypeScript

```bash
npm install @yourplatform/node
```

```typescript
import { YourPlatform } from '@yourplatform/node';

const client = new YourPlatform({ apiKey: process.env.MKT_API_KEY });

const contact = await client.contacts.create({
  email: 'jane@example.com',
  first_name: 'Jane',
  tags: ['high-intent']
});

await client.emails.send({
  to: contact.email,
  subject: 'Welcome',
  template: 'welcome-v2'
});
```

Features:
- TypeScript types auto-generated from OpenAPI
- Auto-retry with exponential backoff
- Per-request idempotency key generation
- Webhook signature verification helper

### Phase 2: Python

```bash
pip install yourplatform
```

### Phase 3: Ruby, PHP, Go

Community contributions accepted via Stainless or Speakeasy auto-generation from OpenAPI.

### SDK Distribution

- npm (JS)
- PyPI (Python)
- RubyGems (Ruby)
- Packagist (PHP)
- pkg.go.dev (Go)

All SDKs versioned independently from the API. SDK 1.4.2 may target API v2.

---

## Versioning & Deprecation

### Versioning Policy

| Type | Trigger | Action |
|---|---|---|
| **Patch** (v2.0.1 → v2.0.2) | Bug fix, no schema change | No customer action needed |
| **Minor** (v2.0 → v2.1) | New endpoint, new optional field | Backwards-compatible |
| **Major** (v2 → v3) | Breaking schema change, endpoint removed | Deprecation period |

### Deprecation Process

```
T+0:    Announce deprecation in changelog + email to API key owners
        Add `Deprecation` header to deprecated endpoint responses:
          Deprecation: Sun, 28 May 2027 00:00:00 GMT
          Sunset: Sun, 28 Nov 2027 00:00:00 GMT
          Link: <https://docs.yourplatform.com/migrate-v2-to-v3>; rel="deprecation"

T+30d:  In-app banner shown to workspace owners using deprecated endpoint

T+180d: Increase visibility — banner becomes warning

T+365d: Endpoint removed (6 months after sunset date)
        Old endpoint returns 410 Gone with migration URL
```

Minimum 12 months between deprecation announcement and removal.

### Tracking Usage

Every API call is logged with the endpoint version. Dashboard shows which workspaces use each version → targeted outreach to migrate before sunset.

### Multiple Major Versions Live

- v1, v2, v3 may all be live simultaneously
- New customers default to latest stable
- Documentation has version switcher
- SDKs target specific versions; major version SDKs supported indefinitely until usage drops to <1% of total API calls

### Breaking Change Examples

| Allowed | NOT Breaking |
|---|---|
| Add new endpoint | Yes |
| Add new optional field to request | Yes |
| Add new field to response | Yes (clients should ignore unknown) |
| Make optional field required | **Breaking** — new major |
| Remove field from response | **Breaking** — new major |
| Rename field | **Breaking** — new major |
| Change field type | **Breaking** — new major |
| Change error code for same condition | **Breaking** — new major |
| Lower rate limit | **Breaking** — new major |
