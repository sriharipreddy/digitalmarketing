# 🔗 Third-Party Integrations
## OAuth Specs · Rate Limits · Sandbox Modes · Token Refresh

> Per-integration deep specs. Every platform we connect to has quirks. Document them once, never debug them twice.

---

## 📋 Table of Contents

1. [Integration Catalogue](#integration-catalogue)
2. [Generic OAuth Flow](#generic-oauth-flow)
3. [Google Suite](#google-suite)
4. [Meta (Facebook + Instagram)](#meta-facebook--instagram)
5. [LinkedIn](#linkedin)
6. [Twitter / X](#twitter--x)
7. [TikTok](#tiktok)
8. [YouTube](#youtube)
9. [Stripe](#stripe)
10. [Twilio](#twilio)
11. [SendGrid](#sendgrid)
12. [DataForSEO](#dataforseo)
13. [Rate Limit Handling](#rate-limit-handling)
14. [Sandbox / Test Modes](#sandbox--test-modes)

---

## Integration Catalogue

| Provider | Auth | Use Case | Rate Limit | Sandbox |
|---|---|---|---|---|
| **Google Search Console** | OAuth 2.0 | Import keyword data, impressions | 1,200 queries/min | Test property |
| **Google Ads** | OAuth 2.0 | Manage Search/Shopping/Performance Max campaigns | 15,000 ops/day (dev token tier) | Test account |
| **Google My Business** | OAuth 2.0 | Local business listings, posts, reviews | 5 QPS per account | None — caution |
| **Google Analytics 4** | OAuth 2.0 | Import GA4 reports for unified analytics | 50,000 requests/day | None — use real |
| **YouTube Data API** | OAuth 2.0 | Channel manager, video SEO | 10,000 units/day | None |
| **Meta Business** | OAuth 2.0 | Facebook + Instagram posting, ads, insights | 200 calls/hour/user | App in dev mode |
| **LinkedIn Marketing** | OAuth 2.0 | Sponsored content, posting, Lead Gen Forms | 500 calls/day/user | Test app |
| **Twitter v2** | OAuth 2.0 PKCE | Posting, filtered stream, ads | 300 posts/3h (Pro tier $5k/mo) | Free tier (limited) |
| **TikTok for Business** | OAuth 2.0 | Ad campaigns, content scheduling, analytics | 100 QPS | Sandbox available |
| **Stripe** | API key | Payments, Connect (affiliate payouts) | 100 req/sec | Stripe test mode |
| **Stripe Connect** | OAuth + KYC | Affiliate payout accounts | — | Test mode |
| **Twilio** | API key | SMS, WhatsApp Business | 1 SMS/sec/number | Test credentials |
| **SendGrid** | API key | Transactional + marketing email | Per plan | Sandbox subdomain |
| **360dialog** | API key | WhatsApp Business API | Per template | Sandbox number |
| **DataForSEO** | Basic auth | Keyword + SERP + backlink data | 30 req/sec | Sandbox tier |
| **PR Newswire** | API key | Press release distribution | Per release | Test endpoint |
| **OpenAI / Anthropic / Google AI** | API key | AI generation | See ai-platform.md | Test API |
| **HubSpot / Mailchimp / Klaviyo** | OAuth | Data import for new customers | Per API | Test accounts |

---

## Generic OAuth Flow

Every OAuth integration follows the same pattern in `social-hub` / `media-hub`.

### 1. Authorization Initiation

```
GET /api/v1/social/connect/:platform
  → Validate user has permission to add social account
  → Generate state parameter:
      state = jwt.sign({ workspace_id, user_id, platform, nonce }, secret, { expiresIn: '10m' })
  → Build authorization URL for platform
  → Redirect user to platform's authorize URL
```

### 2. Callback Handler

```
GET /api/v1/social/oauth/callback/:platform?code=...&state=...
  1. Verify state JWT (workspace_id, user_id, platform match expectations)
  2. Exchange code for tokens:
       POST <platform_token_url>
         grant_type=authorization_code
         code=...
         redirect_uri=...
         client_id=...
         client_secret=...
  3. Receive { access_token, refresh_token?, expires_in, scope }
  4. Fetch user profile from platform (verify account, get account_id, username)
  5. AES-encrypt tokens via per-workspace KEK (see security.md)
  6. INSERT into social_accounts:
       { workspace_id, platform, account_id, username, oauth_access_token (encrypted),
         oauth_refresh_token (encrypted), oauth_expires_at, scopes, status='connected' }
  7. Audit log
  8. Redirect to success page
```

### 3. Token Refresh

```javascript
// Common middleware: runs before any API call requiring tokens
async function getAccessToken(socialAccount) {
  if (socialAccount.oauth_expires_at > new Date(Date.now() + 5 * 60 * 1000)) {
    // Still valid for > 5 minutes
    return decryptToken(socialAccount.oauth_access_token, socialAccount.workspace_id);
  }

  // Refresh
  const refreshToken = decryptToken(socialAccount.oauth_refresh_token, socialAccount.workspace_id);
  const response = await axios.post(PLATFORMS[socialAccount.platform].token_url, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: process.env[`${socialAccount.platform.toUpperCase()}_CLIENT_ID`],
    client_secret: process.env[`${socialAccount.platform.toUpperCase()}_CLIENT_SECRET`],
  });

  // Re-encrypt and save
  socialAccount.oauth_access_token = encryptToken(response.data.access_token, socialAccount.workspace_id);
  socialAccount.oauth_expires_at = new Date(Date.now() + response.data.expires_in * 1000);
  if (response.data.refresh_token) {
    socialAccount.oauth_refresh_token = encryptToken(response.data.refresh_token, socialAccount.workspace_id);
  }
  await socialAccount.save();

  return response.data.access_token;
}
```

### 4. Token Revocation

```
When workspace is cancelled / suspended / user disconnects:
  1. Call platform's /oauth/revoke endpoint
  2. Mark social_accounts.status = 'revoked'
  3. Audit log
```

### Token Lifecycle Summary

| Event | Action |
|---|---|
| User connects account | Encrypt + store tokens |
| Access token within 5 min of expiry | Refresh transparently |
| Refresh token expires (90d typical) | Email user: "Please reconnect [Platform]" |
| User disconnects | Revoke at platform + mark revoked locally |
| Workspace cancelled | Revoke all OAuth tokens |
| Workspace deleted | Hard delete encrypted tokens |
| Anomalous activity detected | Force-revoke + alert user |

---

## Google Suite

### Setup

1. Create Google Cloud project: `marketing-platform-prod`
2. Enable APIs: Search Console, Ads, My Business, Analytics 4, YouTube Data
3. Configure OAuth consent screen — verified domain, scopes listed
4. **Google Ads requires Developer Token approval** — submit application; takes 2-4 weeks for production-level token

### Scopes Used

```
https://www.googleapis.com/auth/webmasters.readonly    (Search Console)
https://www.googleapis.com/auth/adwords                (Google Ads)
https://www.googleapis.com/auth/business.manage         (Google Business Profile)
https://www.googleapis.com/auth/analytics.readonly     (GA4)
https://www.googleapis.com/auth/youtube                 (YouTube)
```

### Library

```bash
npm install googleapis google-auth-library
```

### Google Ads Specifics

- Uses **gRPC** under the hood, not REST
- Library: `google-ads-api` (community) or `google-ads-node` (official)
- Each customer connects a Google Ads account → MCC (manager) link required
- Smart Bidding strategies pre-configured

### Search Console Specifics

- Property must be verified by the customer
- We import last 90 days of impressions/clicks/CTR/position per query
- Daily sync via `mkt-seo-gsc-sync` cron at 04:00 UTC

### Google My Business Specifics

- Each location has its own ID
- Daily insights sync
- Posts support text + image
- Reviews monitored every 30 minutes for new ones

---

## Meta (Facebook + Instagram)

### Setup

1. Create Meta app at `developers.facebook.com`
2. Add product: **Marketing API**, **Pages API**, **Instagram Graph API**, **Ad Library**
3. Submit for **App Review** — required scopes need approval (takes 1-3 weeks)
4. **Business Verification** required for posting on behalf of users

### Scopes Required

```
public_profile
email
pages_show_list
pages_manage_posts
pages_manage_metadata
pages_read_engagement
pages_messaging
ads_management
ads_read
business_management
instagram_basic
instagram_content_publish
instagram_manage_insights
instagram_manage_messages
```

### Library

```bash
npm install facebook-nodejs-business-sdk
```

### Key Quirks

- **Page Access Tokens** (long-lived: 60 days) — derived from User Access Token
- For posting to Pages, use Page Token, not User Token
- Instagram requires the linked Facebook Page — Instagram-only auth doesn't exist for business
- Instagram posting requires **professional account** (Business or Creator)
- Ad creation: Campaign → Ad Set → Ad object hierarchy
- **Webhooks**: configure for `mention_tag`, `feed`, `messages` events

### Rate Limits

- User-level: 200 calls per hour
- Page-level: depends on Page activity; safe budget: 10 posts/hour
- Ads: business tier dependent

### Insights API

- Engagement metrics polled every 15 minutes for last 24 hours
- Older data backfilled daily
- Stored in `social_metrics`

---

## LinkedIn

### Setup

1. Apply at `developer.linkedin.com` for **Marketing Developer Platform** access (manual approval, 2-4 weeks)
2. Create app, request scopes
3. **Note**: LinkedIn does NOT have an official Node SDK — call REST directly

### Scopes

```
r_basicprofile
r_organization_social
w_organization_social
r_organization_admin
rw_organization_admin
r_ads
rw_ads
r_ads_reporting
r_1st_connections_size
```

### Direct REST Calls

```javascript
// services/social-hub/_services/linkedin.service.js
const axios = require('axios');

async function postToCompanyPage(accessToken, companyUrn, text, mediaUrns = []) {
  const body = {
    author: `urn:li:organization:${companyUrn}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: mediaUrns.length ? 'IMAGE' : 'NONE',
        media: mediaUrns.map(urn => ({ status: 'READY', media: urn }))
      }
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
  };

  return axios.post('https://api.linkedin.com/v2/ugcPosts', body, {
    headers: { 'Authorization': `Bearer ${accessToken}`, 'X-Restli-Protocol-Version': '2.0.0' }
  });
}
```

### Rate Limits

- 500 calls per day per user
- Pages: more restrictive — 25 posts per day per page
- Marketing API: per-account; daily token replenishment

### Quirks

- All API responses use `urn:li:` URNs as IDs (e.g., `urn:li:organization:12345`)
- Images uploaded as 2-step: register asset → upload binary
- Lead Gen Forms: ingest submissions via webhook to platform CRM

---

## Twitter / X

### Setup

1. Apply for Twitter API at `developer.twitter.com`
2. **Pricing tiers (critical for product planning):**
   - Free: 1,500 tweets/month, no read access — useless for product
   - Basic: $200/month, 50k tweets/month read, 100 posts/month — minimal viable
   - Pro: $5,000/month, includes Filtered Stream + Ads API — required for social listening
   - Enterprise: custom

### Scopes

```
tweet.read
tweet.write
tweet.moderate.write
users.read
follows.read
list.read
list.write
mute.read
block.read
bookmark.read
offline.access
space.read
```

### Library

```bash
npm install twitter-api-v2
```

### Critical Product Decision

**Social listening via Filtered Stream is paywalled** ($5k/mo Pro tier minimum). Plan options:

| Option | Cost | Trade-off |
|---|---|---|
| Skip Twitter listening | $0 | Feature gap |
| Use search API every 15 min | $200/mo | Near-real-time but not instant |
| Pro tier with Filtered Stream | $5,000/mo | True real-time + Ads API |
| Switch to TweetDeck pro accounts (community workaround) | varies | Brittle, not recommended |

Recommendation: launch with search-poll model; upgrade to Pro when revenue justifies.

---

## TikTok

### Setup

1. Apply at `business-api.tiktok.com` for app approval
2. **TikTok for Business** — separate from TikTok Login Kit
3. Multiple products: Ads, Content Marketing API, Login Kit

### Scopes

```
user.info.basic
video.list
video.publish
video.upload
research.adlib.basic
biz.creative.publish
```

### Library

No mature Node.js SDK. Direct REST calls.

### Quirks

- Video upload requires multipart chunked upload (videos can be large)
- Approval delays: TikTok takes 4-8 weeks to approve apps for publish permissions
- Sandbox available — test against sandbox accounts before going live
- Rate limit: 100 QPS per app

---

## YouTube

### Setup

- Part of Google Cloud project
- Enable YouTube Data API v3 + YouTube Analytics API

### Quota Costs

YouTube uses a **quota cost** model — each operation has a cost, daily quota is 10,000 units:

| Operation | Cost |
|---|---|
| List videos | 1 unit |
| Insert video (upload) | **1,600 units** ← expensive |
| Update video | 50 units |
| List comments | 1 unit |
| Get analytics | 1 unit |
| Insert community post | 50 units |

10,000 daily / 1,600 = 6 uploads per day per project at default quota. **Request quota increase** for production (1,000,000 units/day requires Google approval).

### Optimisation

- Cache video lists aggressively (1-hour TTL)
- Only fetch analytics for videos viewed in dashboard (lazy)
- Batch operations where possible

---

## Stripe

See `billing-lifecycle.md` for full Stripe integration. Quick reference:

### Library
```bash
npm install stripe@^17.4.0
```

### Webhooks (verified via `stripe-signature`)

```
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
customer.subscription.trial_will_end
invoice.paid
invoice.payment_failed
charge.dispute.created
payment_method.attached
```

### Connect (Affiliate Payouts)

- Express accounts (lightest KYC)
- Transfers issued monthly per affiliate
- 1099-K for US affiliates via Stripe (automated)

---

## Twilio

### SMS

```bash
npm install twilio@^5.3.4
```

```javascript
await twilioClient.messages.create({
  to: '+44...',
  from: workspace.sms_sender_id,
  body: 'Your message',
  statusCallback: 'https://api.yourplatform.com/webhook/twilio/sms-status'
});
```

### WhatsApp (option 1 — Twilio)

- Twilio offers WhatsApp Business API
- Higher cost than 360dialog
- Easier integration if already using Twilio
- Use 360dialog as primary (better pricing); Twilio as fallback

### Voice (future)

- Outbound voice for sales call workflows
- Inbound: track phone calls as conversion events (callforward to customer's number)

### Number Provisioning

- Customers can buy local long codes via Twilio for branded SMS sending
- 10DLC registration in US (regulatory requirement) — automated via Twilio

---

## SendGrid

```bash
npm install @sendgrid/mail @sendgrid/client
```

### Sub-Users (Agency White-Label)

Agency clients can use their own sending domain:
1. Agency creates SendGrid sub-user via API
2. Customer adds DNS records (SPF, DKIM, DMARC)
3. SendGrid verifies → emails sent from `noreply@agencyname.com`

### Event Webhooks

```
processed
delivered
open
click
bounce
dropped
spamreport
unsubscribe
group_unsubscribe
deferred
```

Each event updates `email_events` and `email_subscribers.status`.

### Suppression Lists

SendGrid maintains bounce/spam suppression lists. Sync daily with `email_suppression` to prevent re-import via CSV.

---

## DataForSEO

Basic Auth, REST API. No npm SDK; use `axios`.

### Endpoints Used

| Endpoint | Use |
|---|---|
| `/v3/keywords_data/google_ads/search_volume/live` | Keyword volume |
| `/v3/dataforseo_labs/google/keyword_suggestions/live` | Keyword expansion |
| `/v3/serp/google/organic/task_post` + `task_get` | SERP rankings (async) |
| `/v3/backlinks/summary/live` | Backlink overview |
| `/v3/backlinks/backlinks/live` | Detailed backlinks |
| `/v3/on_page/task_post` | Technical SEO audit |
| `/v3/business_data/google/locations/live` | Local SEO data |

### Pricing Model

Pay per request, ~$0.0006 per keyword volume lookup. Budget-aware caching:
- SERP results cached 24 hours
- Volume data cached 7 days
- Per-workspace caps to prevent unexpected costs

### Async Tasks

Many DataForSEO endpoints are async (post task → wait → fetch result):
- Post task → returns `task_id`
- Bull job polls every 60 seconds
- Result cached in MySQL/PostgreSQL once complete

---

## Rate Limit Handling

### Universal Strategy

```javascript
// shared-middleware/external-api-client.js
async function callExternalApi(url, options, providerKey) {
  const breaker = circuitBreakers[providerKey];
  if (!breaker.isHealthy()) throw new Error('Provider unhealthy');

  try {
    const response = await axios(url, options);
    breaker.recordSuccess();
    return response;
  } catch (err) {
    if (err.response?.status === 429) {
      // Rate limited — queue and retry
      const retryAfter = parseInt(err.response.headers['retry-after']) || 60;
      throw new RateLimitError(retryAfter);
    }
    if (err.response?.status >= 500) {
      breaker.recordFailure();
    }
    throw err;
  }
}
```

### Bull Queue Rate Limiting

```javascript
const queue = new Bull('mkt-social-publish', {
  limiter: {
    max: 10,
    duration: 60000,  // 10 jobs per minute = 1 per 6 seconds
  }
});
```

### Per-Workspace Throttling

A single workspace can't monopolise external rate limits. Per-workspace concurrency cap via Redis semaphore.

---

## Sandbox / Test Modes

### Per-Provider Test Setup

| Provider | Test Mode |
|---|---|
| Stripe | `sk_test_*` keys; full Stripe Dashboard test mode |
| SendGrid | Sandbox subdomain (`sandbox.api.sendgrid.com`) doesn't actually send |
| Twilio | Magic test numbers (`+15005550006` etc.); messages don't deliver |
| Google APIs | Real but with low-volume test accounts |
| Meta | App in Development mode; only test users can be reached |
| LinkedIn | Sandbox apps + test members |
| TikTok | Sandbox accounts via developer portal |
| DataForSEO | Sandbox tier (free) for development |
| OpenAI | Real API but with $5 monthly cap on dev keys |

### Our Sandbox API

Customers using `api-sandbox.yourplatform.com` get mock responses for all integrations — no real sends, no real ads launched.

---

## OAuth Connect Status Page

For internal use — Settings → Admin → Integrations Health:

| Provider | Status | Last Successful Call | Tokens Expired | Action |
|---|---|---|---|---|
| Google Search Console | ✅ Healthy | 2 min ago | 0 | — |
| Meta Graph | ⚠️ Degraded | 5 min ago | 12 | Reconnect required for 12 workspaces |
| LinkedIn Marketing | ✅ Healthy | 1 min ago | 0 | — |
| TikTok Business | ❌ Down | 2 hours ago | 0 | Investigate — possible outage |

Linked to circuit breaker state + alerting.
