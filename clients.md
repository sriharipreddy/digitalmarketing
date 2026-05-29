# 👥 Multi-Client Access — Login, Roles & Analytics
## How Every Type of User Logs In and What They See

---

## 📋 Table of Contents

1. [The Four User Types](#the-four-user-types)
2. [Multi-Tenant Architecture](#multi-tenant-architecture)
3. [Login Flows — Every Type](#login-flows)
4. [Role & Permission System](#role--permission-system)
5. [What Each Role Sees](#what-each-role-sees)
6. [Client Analytics Portal](#client-analytics-portal)
7. [White-Label Agency Flow](#white-label-agency-flow)
8. [Database Schema](#database-schema)
9. [JWT Token Design](#jwt-token-design)
10. [Implementation Guide](#implementation-guide)

---

## The Four User Types

```
┌─────────────────────────────────────────────────────────────────────┐
│                   DIGITAL MARKETING PLATFORM                        │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  ┌────────┐ │
│  │   PLATFORM   │  │    AGENCY    │  │    CLIENT     │  │  TEAM  │ │
│  │   OWNER      │  │    OWNER     │  │    OWNER      │  │MEMBER  │ │
│  │  (Super      │  │  (Reseller)  │  │  (Business    │  │(Staff) │ │
│  │   Admin)     │  │              │  │   owner)      │  │        │ │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  └───┬────┘ │
│         │                 │                  │              │       │
│    Full access       Manages N clients   Own workspace   Limited   │
│    all workspaces    white-label portal  full analytics  access    │
└─────────────────────────────────────────────────────────────────────┘
```

| Type | Who They Are | What They Pay | What They Access |
|---|---|---|---|
| **Platform Owner** | You — the platform operator | Owns the platform | Everything — all workspaces, billing, system config |
| **Agency Owner** | Digital marketing agency using your platform to serve their clients | Agency plan £249/mo | Their own clients only — white-label branded dashboard |
| **Client Owner** | A business owner using the platform directly | Starter £29/mo · Pro £79/mo | Their own workspace — full analytics, campaigns, reports |
| **Team Member** | An employee of a Client or Agency | Included in client/agency plan | Assigned workspace(s) — role-based permissions (Editor, Viewer, etc.) |

---

## Multi-Tenant Architecture

Every piece of data is isolated by **workspace**. A workspace is the top-level container for one business.

```
Platform
│
├── Workspace A  (Client: "Pizza Palace London")
│   ├── seo_keywords          workspace_id = A
│   ├── campaign_campaigns         workspace_id = A
│   ├── analytics_events  workspace_id = A
│   ├── crm_contacts          workspace_id = A
│   └── social_accounts   workspace_id = A
│
├── Workspace B  (Client: "Bob's Plumbing")
│   ├── seo_keywords          workspace_id = B
│   ├── campaign_campaigns         workspace_id = B
│   └── ...
│
└── Workspace C  (Agency: "Rocket Digital Agency")
    ├── Sub-workspace: "Their Client 1"
    ├── Sub-workspace: "Their Client 2"
    └── Sub-workspace: "Their Client 3"
```

**Isolation is enforced at 3 layers:**

```
Layer 1 — JWT:      workspace_id injected into every token
Layer 2 — Backend:  every query appended with WHERE workspace_id = ?
Layer 3 — Nginx:    workspace subdomain routing (optional: client.yourdomain.com)
```

**No JWT = No data. Wrong workspace_id = No data.**

---

## Login Flows

### 🔐 Flow 1 — Direct Client Login (Business Owner)

A business owner signs up directly on the platform.

```
┌─────────────────────────────────────────────────────────┐
│  Step 1: Registration                                   │
│                                                         │
│  business owner visits: app.yourplatform.com/register   │
│  fills in:                                              │
│    • Full name                                          │
│    • Business name                                      │
│    • Email address                                      │
│    • Password                                           │
│    • Business website (optional)                        │
│    • Plan selection (Free / Pro / Agency)               │
│                                                         │
│  → Stripe checkout for paid plans                       │
│  → Email verification link sent                         │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Step 2: Email Verified                                 │
│                                                         │
│  Click link in email → account activated               │
│  First login → Onboarding Wizard:                       │
│    1. Connect your website (add tracking script)        │
│    2. Connect social accounts (OAuth)                   │
│    3. Connect Google Search Console                     │
│    4. Add first 5 keywords to track                     │
│    5. Run first SEO audit                               │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Step 3: Every Subsequent Login                         │
│                                                         │
│  POST /api/v1/core/auth/login                           │
│  { email, password }                                    │
│                                                         │
│  Response:                                              │
│  {                                                      │
│    access_token: "eyJ...",   // 24hr JWT               │
│    refresh_token: "...",     // 30-day, HTTP-only cookie│
│    user: { id, name, email, workspace_id, role, plan }  │
│  }                                                      │
│                                                         │
│  → Redirected to their workspace dashboard              │
│  → URL: app.yourplatform.com/dashboard                  │
└─────────────────────────────────────────────────────────┘
```

---

### 🔐 Flow 2 — Agency Login (White-Label Reseller)

An agency signs up, gets a white-label portal, and creates logins for their clients.

```
┌─────────────────────────────────────────────────────────┐
│  Agency Owner signs up                                  │
│  → Selects "Agency Plan"                                │
│  → Sets their brand:                                    │
│      • Logo upload                                      │
│      • Brand colour (hex)                               │
│      • Custom domain: analytics.rocketagency.co.uk      │
│      • Platform name shown to clients: "Rocket Reports" │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Agency creates a Client                                │
│                                                         │
│  In agency dashboard:                                   │
│  → "Add New Client" button                              │
│  → Fills in:                                            │
│      • Client business name                             │
│      • Client email address                             │
│      • Client website URL                               │
│  → System:                                              │
│      • Creates new core_workspace (linked to agency)     │
│      • Creates core_users row for client (role: CLIENT_OWNER) │
│      • Sends client a branded invite email:             │
│                                                         │
│        "Pizza Palace, your marketing dashboard          │
│         is ready. Click to set your password."          │
│                                                         │
│        Login URL: analytics.rocketagency.co.uk          │
│        (Client never sees "yourplatform.com")           │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Client (Pizza Palace) first login                      │
│                                                         │
│  Visits: analytics.rocketagency.co.uk                   │
│  Sets password via invite link                          │
│  Logs in → sees their workspace only                    │
│  UI shows "Rocket Reports" branding, not yourplatform   │
└─────────────────────────────────────────────────────────┘
```

---

### 🔐 Flow 3 — Team Member Login (Added by Client or Agency)

A business owner or agency adds staff to their workspace.

```
┌─────────────────────────────────────────────────────────┐
│  Client Owner goes to:                                  │
│  Settings → Team → Invite Member                        │
│                                                         │
│  Fills in:                                              │
│    • Email address of team member                       │
│    • Role: Editor / Analyst / Viewer (see roles below)  │
│    • Workspace access: all workspaces or specific ones  │
│                                                         │
│  System sends invite email with:                        │
│    • Set password link (expires 48 hours)               │
│    • Login URL                                          │
│    • Name of workspace they're joining                  │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Team member sets password → logs in                    │
│  Sees only what their role allows (see Role Matrix)     │
└─────────────────────────────────────────────────────────┘
```

---

### 🔐 Flow 4 — Google / Social SSO Login

For convenience — one-click login without remembering passwords.

```
POST /api/v1/core/auth/google
  → Redirect to Google OAuth consent screen
  → Google returns: { email, name, google_id, avatar }
  → Backend: find user by email → if found, login
             if not found → create account → onboarding
  → Return JWT same as password login
```

**Same flow supported for:** Google, Microsoft (for B2B clients who use Office 365)

---

### 🔐 Flow 5 — Platform Owner (Super Admin) Login

You — the platform operator — see every workspace.

```
POST /api/v1/core/auth/admin-login
  { email, password, totp_code }  ← 2FA mandatory for super admin

  → Validates against core_platform_admins table (separate from clients)
  → Returns JWT with type: 'platform_admin'
  → Access: all workspaces, billing dashboard, system health
  → URL: admin.yourplatform.com (separate subdomain)
```

---

## Role & Permission System

Each workspace has members with roles. Roles control exactly what each person can see and do.

### Two Concepts: `user.type` (identity scope) and `member.role` (workspace permission)

A common confusion: there are **two separate fields** doing two different jobs.

```
core_users.type                    →  WHO you are at the platform level
  - platform_admin                   You (the platform operator)
  - agency_owner                     Owns an agency workspace
  - client_owner                     Owns a client workspace
  - team_member                      A staff member (no workspace of their own)

core_workspace_members.role        →  WHAT you can do INSIDE a specific workspace
  - owner                            Full access to workspace (Client/Agency Owner)
  - editor                           Create, edit, publish — not delete or billing
  - analyst                          Read-only access to all analytics
  - viewer                           Read-only access to reports only
```

**Mapping rules:**

| `user.type` | Has workspace_members entries with role | Notes |
|---|---|---|
| `platform_admin` | None — bypasses workspace_members entirely | Sees all workspaces via super-admin route |
| `agency_owner` | Their own agency workspace (`role: owner`) + every client workspace they create (`role: owner`) | Can switch context between client workspaces |
| `client_owner` | Their workspace (`role: owner`) | One workspace they own |
| `team_member` | One or more workspaces, each with one of `editor / analyst / viewer` | Invited by an owner |

### The 6 Effective Roles (combination of type + role)

```
PLATFORM_ADMIN      user.type = 'platform_admin'                     → Access to everything across all workspaces
AGENCY_OWNER        user.type = 'agency_owner'   + role = 'owner'    → Their agency + all their clients
CLIENT_OWNER        user.type = 'client_owner'   + role = 'owner'    → Their workspace, full access
EDITOR              user.type = 'team_member'    + role = 'editor'   → Create/edit/publish; no delete or billing
ANALYST             user.type = 'team_member'    + role = 'analyst'  → Read-only to all analytics
VIEWER              user.type = 'team_member'    + role = 'viewer'   → Read-only to reports only
```

### Permission Matrix

Every module has 4 permission levels: **Create (C) · Read (R) · Update (U) · Delete (D)**

| Module | Platform Admin | Agency Owner | Client Owner | Editor | Analyst | Viewer |
|---|---|---|---|---|---|---|
| **SEO — Keywords** | C R U D | C R U D | C R U D | C R U | R | — |
| **SEO — Audit** | C R U D | C R U D | C R U D | C R U | R | — |
| **SEO — Backlinks** | C R U D | C R U D | C R U D | R | R | — |
| **PPC — Google Ads** | C R U D | C R U D | C R U D | C R U | R | — |
| **PPC — Meta Ads** | C R U D | C R U D | C R U D | C R U | R | — |
| **Content — Create** | C R U D | C R U D | C R U D | C R U | R | — |
| **Content — Publish** | C R U D | C R U D | C R U D | C R U | — | — |
| **Social — Schedule** | C R U D | C R U D | C R U D | C R U | R | — |
| **Email — Send** | C R U D | C R U D | C R U D | C R U | R | — |
| **CRM — Contacts** | C R U D | C R U D | C R U D | C R U | R | — |
| **CRM — Workflows** | C R U D | C R U D | C R U D | C R U | — | — |
| **Analytics — View** | C R U D | C R U D | C R U D | R | R | R |
| **Analytics — Export** | C R U D | C R U D | C R U D | R | R | — |
| **Reports — View** | C R U D | C R U D | C R U D | R | R | R |
| **Reports — Schedule** | C R U D | C R U D | C R U D | R | — | — |
| **Affiliates** | C R U D | C R U D | C R U D | R | R | — |
| **Billing** | C R U D | C R U D | C R U D | — | — | — |
| **Team Management** | C R U D | C R U D | C R U D | — | — | — |
| **Workspace Settings** | C R U D | C R U D | C R U D | — | — | — |
| **One-Click Capture** | C R U D | C R U D | C R U D | C R U | — | — |

**Permission enforcement — identical pattern to existing LicensedTaxi platform:**

```javascript
// middleware/requirePermission.js — mirrors existing admin permission check
const requirePermission = (module_name, action) => {
  return (req, res, next) => {
    const { permissions, workspace_id } = req.user;

    // Check workspace isolation first
    if (req.params.workspace_id && req.params.workspace_id !== workspace_id) {
      if (req.user.type !== 'platform_admin') {
        return res.status(403).json({ status: 'error', msg: 'Access denied' });
      }
    }

    // Check module permission
    const perm = permissions.find(p => p.module_name === module_name);
    if (!perm || !JSON.parse(perm.access)[action]) {
      return res.status(403).json({ status: 'error', msg: 'Permission denied' });
    }
    next();
  };
};

// Usage on routes:
router.get('/keywords', requirePermission('seo_keywords', 'r'), keywordController.list);
router.post('/keywords', requirePermission('seo_keywords', 'c'), keywordController.create);
router.delete('/keywords/:id', requirePermission('seo_keywords', 'd'), keywordController.delete);
```

---

## What Each Role Sees

### 👑 CLIENT OWNER Dashboard

**Full dashboard — every module visible and editable.**

```
┌────────────────────────────────────────────────────────┐
│  🏠 Command Centre          [Full access]              │
│  🎯 One-Click Capture       [Full access]              │
│  ─────────────────────────────────────────────         │
│  🔍 SEO                     [Full access]              │
│     Keywords / Rank Tracker / Audit / Backlinks        │
│  💰 PPC Ads                 [Full access]              │
│     Google Ads / Meta / LinkedIn / TikTok              │
│  📱 Social Media            [Full access]              │
│  ✍️  Content Studio         [Full access]              │
│  📧 Email Marketing         [Full access]              │
│  📲 SMS / Push / WhatsApp   [Full access]              │
│  🤝 Affiliates              [Full access]              │
│  🌟 Influencers             [Full access]              │
│  📊 CRO & A/B Tests         [Full access]              │
│  📹 Video Studio            [Full access]              │
│  📍 Local & ASO             [Full access]              │
│  🧠 CRM & Automation        [Full access]              │
│  🕵️  Competitor Intel        [Full access]              │
│  📈 Analytics               [Full access]              │
│  ─────────────────────────────────────────────         │
│  ⚙️  Settings               [Full access]              │
│  👥 Team Management         [Invite / remove / roles]  │
│  💳 Billing                 [View / upgrade / cancel]  │
└────────────────────────────────────────────────────────┘
```

---

### ✏️ EDITOR Dashboard

**Can create and manage — cannot delete or control billing.**

```
┌────────────────────────────────────────────────────────┐
│  🏠 Command Centre          [View + actions]           │
│  🎯 One-Click Capture       [Run + edit results]       │
│  ─────────────────────────────────────────────         │
│  🔍 SEO                     [Add keywords, view audit] │
│  💰 PPC Ads                 [Create/edit campaigns]    │
│  📱 Social Media            [Schedule posts]           │
│  ✍️  Content Studio         [Create/edit/publish]      │
│  📧 Email Marketing         [Create/send campaigns]    │
│  📲 SMS / Push / WhatsApp   [Create/send]              │
│  🤝 Affiliates              [View only]                │
│  🌟 Influencers             [Manage campaigns]         │
│  📊 CRO & A/B Tests         [Create/run tests]         │
│  📹 Video Studio            [Schedule, scripts]        │
│  📍 Local & ASO             [Update listings]          │
│  🧠 CRM & Automation        [Manage contacts/flows]    │
│  🕵️  Competitor Intel        [View only]               │
│  📈 Analytics               [View reports]             │
│  ─────────────────────────────────────────────         │
│  ⚙️  Settings               [View only — no changes]   │
│  👥 Team Management         [Hidden]                   │
│  💳 Billing                 [Hidden]                   │
└────────────────────────────────────────────────────────┘
```

---

### 📊 ANALYST Dashboard

**Read-only access to all data and analytics. Cannot create or edit anything.**

```
┌────────────────────────────────────────────────────────┐
│  🏠 Command Centre          [View metrics only]        │
│  🎯 One-Click Capture       [Hidden]                   │
│  ─────────────────────────────────────────────         │
│  🔍 SEO                     [View rankings/audit]      │
│  💰 PPC Ads                 [View campaign metrics]    │
│  📱 Social Media            [View analytics]           │
│  ✍️  Content Studio         [View content library]     │
│  📧 Email Marketing         [View campaign stats]      │
│  📲 SMS / Push / WhatsApp   [View delivery stats]      │
│  🤝 Affiliates              [View affiliate metrics]   │
│  🌟 Influencers             [View campaign ROI]        │
│  📊 CRO & A/B Tests         [View test results]        │
│  📹 Video Studio            [View video analytics]     │
│  📍 Local & ASO             [View local rankings]      │
│  🧠 CRM & Automation        [View contact list/scores] │
│  🕵️  Competitor Intel        [View competitor data]    │
│  📈 Analytics               [Full access — all data]   │
│  ─────────────────────────────────────────────         │
│  ⚙️  Settings               [Hidden]                   │
│  👥 Team Management         [Hidden]                   │
│  💳 Billing                 [Hidden]                   │
└────────────────────────────────────────────────────────┘
```

---

### 👁️ VIEWER Dashboard

**Reports only — suitable for a business owner who just wants the summary.**

```
┌────────────────────────────────────────────────────────┐
│  🏠 Summary Dashboard       [High-level KPIs only]     │
│  ─────────────────────────────────────────────         │
│  📈 Analytics               [View all reports]         │
│  📄 Reports                 [Download PDF reports]     │
│  ─────────────────────────────────────────────         │
│  All other modules          [Hidden]                   │
└────────────────────────────────────────────────────────┘
```

**Viewer use case:** A business owner pays for the Pro plan, their in-house accountant only needs to see ROI reports. The accountant gets a Viewer login — they see the performance reports without access to campaign settings.

---

## Client Analytics Portal

The analytics each client sees — broken down by role and module.

### 📊 The Analytics Dashboard (CLIENT OWNER / ANALYST)

When a client logs in and goes to Analytics, they see a **unified cross-channel performance view** — all their marketing channels in one place.

---

#### 1. Command Centre — The First Screen

```
┌────────────────────────────────────────────────────────────────┐
│  Good morning, Sarah 👋   Pizza Palace London                  │
│  Last updated: 2 minutes ago                    📅 Last 30 days │
│                                                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Visitors │  │  Leads   │  │  Revenue │  │   ROAS   │      │
│  │  12,450  │  │   284    │  │ £8,420   │  │  4.2×    │      │
│  │ ▲ +18%   │  │ ▲ +32%  │  │ ▲ +24%  │  │ ▲ +0.8×  │      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
│                                                                │
│  📈 Traffic This Month                                         │
│  [Line chart: Organic / Paid / Social / Email / Direct]        │
│                                                                │
│  🏆 Top Performing Channels          📉 Needs Attention        │
│  1. Google Ads    ROAS: 6.2×         • Email open rate low     │
│  2. Organic SEO   +340 visitors      • 3 keywords dropped      │
│  3. Email         42% open rate      • Meta ROAS under 2×      │
└────────────────────────────────────────────────────────────────┘
```

---

#### 2. SEO Analytics — What Clients See

```
┌────────────────────────────────────────────────────────────────┐
│  🔍 SEO Performance                              Last 90 days  │
│                                                                │
│  Organic Traffic        Keywords in Top 10    Domain Authority │
│  8,234 visitors          47 keywords            DA 34          │
│  ▲ +23% vs last period   ▲ +12 new             ▲ +3 pts       │
│                                                                │
│  📊 Keyword Rankings — Your Tracked Keywords                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Keyword              │ Position │ Change │ Volume │ URL  │  │
│  │ "pizza london"       │    3     │  ▲ +2  │ 8,100  │ /   │  │
│  │ "best pizza near me" │    7     │  ▲ +5  │ 2,400  │ /   │  │
│  │ "pizza delivery EC1" │   14     │  ▼ -1  │   880  │/del │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  🔗 Backlinks                                                  │
│  Total: 234 | New this month: 12 | Lost: 3                     │
│                                                                │
│  ⚡ Site Health Score: 78/100                                  │
│  Critical issues: 2  |  Warnings: 14  |  [View Full Audit]    │
└────────────────────────────────────────────────────────────────┘
```

---

#### 3. Paid Ads Analytics — What Clients See

```
┌────────────────────────────────────────────────────────────────┐
│  💰 Paid Advertising                             Last 30 days  │
│                                                                │
│  Total Spend      Total Revenue    Blended ROAS    Conv. Rate  │
│  £2,000            £8,400           4.2×            3.4%       │
│                                                                │
│  Per Channel Breakdown:                                        │
│  ┌───────────────────────────────────────────────────────┐    │
│  │ Channel       │ Spend  │ Revenue │ ROAS │ Clicks      │    │
│  │ Google Search │ £1,200 │ £7,440  │ 6.2× │ 1,840      │    │
│  │ Meta Ads      │ £600   │ £720    │ 1.2× │ 3,200      │    │
│  │ TikTok Ads    │ £200   │ £240    │ 1.2× │ 4,100      │    │
│  └───────────────────────────────────────────────────────┘    │
│                                                                │
│  💡 AI Insight: "Move £200 from Meta to Google Search.        │
│     Google ROAS is 5× better. Estimated +£1,000 revenue."     │
└────────────────────────────────────────────────────────────────┘
```

---

#### 4. Social Media Analytics — What Clients See

```
┌────────────────────────────────────────────────────────────────┐
│  📱 Social Media                                 Last 30 days  │
│                                                                │
│  Total Followers   New Followers   Engagement Rate   Reach     │
│  12,450             +340            4.8%              48,200   │
│                                                                │
│  Platform Breakdown:                                           │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ Platform   │ Followers │ Growth  │ Eng. Rate │ Posts   │   │
│  │ Instagram  │ 5,420     │ +180    │ 6.2%      │ 12      │   │
│  │ Facebook   │ 3,100     │ +80     │ 3.1%      │ 10      │   │
│  │ TikTok     │ 2,800     │ +60     │ 8.4%      │ 8       │   │
│  │ LinkedIn   │ 1,130     │ +20     │ 2.8%      │ 6       │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                │
│  🏆 Best Performing Post This Month                            │
│  "New Margherita pizza 🍕" — 2,400 likes, 180 shares           │
└────────────────────────────────────────────────────────────────┘
```

---

#### 5. Email Marketing Analytics — What Clients See

```
┌────────────────────────────────────────────────────────────────┐
│  📧 Email Marketing                              Last 30 days  │
│                                                                │
│  Subscribers    Sent    Open Rate    Click Rate    Revenue     │
│  4,820          3,200    42.1%         8.4%         £1,240     │
│                                                                │
│  Recent Campaigns:                                             │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ Campaign         │ Sent  │ Open  │ Click │ Revenue    │   │
│  │ "Weekend Special"│ 3,200 │ 42.1% │  8.4% │ £1,240     │   │
│  │ "New Menu Launch"│ 2,800 │ 38.4% │  6.2% │ £840       │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                │
│  🔄 Active Drip Sequences                                      │
│  • Welcome sequence: 284 enrolled, 62% completion             │
│  • Win-back sequence: 48 enrolled, 12 converted               │
└────────────────────────────────────────────────────────────────┘
```

---

#### 6. Full Attribution — Where Did Revenue Come From?

```
┌────────────────────────────────────────────────────────────────┐
│  📈 Revenue Attribution                          Last 30 days  │
│                                                                │
│  Total Attributed Revenue: £9,660                              │
│                                                                │
│  Multi-Touch Attribution (Linear Model):                       │
│                                                                │
│  Google Ads (organic)    ████████████████████   42%  £4,057   │
│  Email Marketing         ████████████           28%  £2,705   │
│  Direct / Branded        ████████               18%  £1,739   │
│  Social Media            ████                    8%    £773   │
│  Referral                ██                      4%    £386   │
│                                                                │
│  Model: [Last Click ▼] [First Click] [Linear] [Data-Driven]   │
│  Switch model → chart updates instantly                        │
│                                                                │
│  Customer Journey (example):                                   │
│  Google Search → Blog post → Email signup → Email click → BUY │
└────────────────────────────────────────────────────────────────┘
```

---

#### 7. Automated Weekly Reports — What Clients Receive by Email

Every Monday at 8am, each client receives a branded PDF report automatically.

```
┌─────────────────────────────────────────────────────────┐
│  WEEKLY MARKETING REPORT                                │
│  Pizza Palace London  |  Week of 20 May 2026            │
│  ─────────────────────────────────────────────          │
│                                                         │
│  📊 WEEK AT A GLANCE                                    │
│  Visitors: 2,840 (▲ +18% vs last week)                 │
│  Leads: 64 (▲ +12%)                                    │
│  Revenue: £2,105 (▲ +24%)                              │
│                                                         │
│  🏆 WHAT WORKED THIS WEEK                               │
│  • Google Ads "pizza london" campaign: ROAS 6.2×        │
│  • Tuesday email: 44% open rate (industry avg: 22%)     │
│  • Instagram Reel: 4,200 views, +80 new followers       │
│                                                         │
│  ⚠️  NEEDS ATTENTION                                    │
│  • Keyword "pizza delivery EC1" dropped from pos 8→14  │
│  • Meta campaign ROAS below 2× — consider pausing      │
│                                                         │
│  🤖 AI RECOMMENDATIONS FOR NEXT WEEK                    │
│  1. Publish a blog post targeting "best pizza EC1"      │
│  2. Move £100 Meta budget to Google Search             │
│  3. Send re-engagement email to 180 inactive subs       │
│                                                         │
│  [View Full Dashboard] [Download Full Report PDF]       │
└─────────────────────────────────────────────────────────┘
```

This report is auto-generated using `pdfkit` (already in the existing payment service — same library, same pattern). It is sent via SendGrid and also stored in S3 as a downloadable PDF in the client's dashboard.

---

## White-Label Agency Flow

An agency serves multiple clients — each client gets their own login but sees the agency's brand.

```
┌─────────────────────────────────────────────────────────────────┐
│                  AGENCY OWNER VIEW                              │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  👥 My Clients (12 active)              [+ Add New Client]      │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Client Name      │ Plan    │ ROAS │ Traffic │ Status   │    │
│  │ Pizza Palace     │ Pro     │ 4.2× │ 12,450  │ ✅ Good  │    │
│  │ Bob's Plumbing   │ Starter │ 2.1× │  2,840  │ ⚠️ Low  │    │
│  │ Salon Luxe       │ Pro     │ 3.8× │  8,200  │ ✅ Good  │    │
│  │ City Law Firm    │ Agency  │ 5.1× │  4,100  │ ✅ Good  │    │
│  │ ...              │ ...     │  ... │    ...  │ ...      │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  [Click any client → switch into that workspace context]        │
│                                                                 │
│  📊 Agency Overview Metrics                                     │
│  Total clients: 12 | Avg ROAS: 3.8× | MRR: £2,400             │
│                                                                 │
│  📄 Bulk Report Generation                                      │
│  [Generate all client reports for this month] → ZIP download    │
└─────────────────────────────────────────────────────────────────┘
```

**What the client (Pizza Palace) sees on analytics.rocketagency.co.uk:**

```
┌─────────────────────────────────────────────────────────────────┐
│  [🚀 Rocket Reports Logo]                      Pizza Palace ▼   │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Dashboard — all the same analytics as above                    │
│  BUT:                                                           │
│  • URL is analytics.rocketagency.co.uk (not yourplatform.com)  │
│  • Logo is Rocket Reports (not your platform brand)            │
│  • Colour scheme matches Rocket Reports' brand                  │
│  • "Powered by ___" hidden (white-label)                        │
│  • Client can NEVER see other clients' data                     │
│  • Contact us button → Rocket Agency contact, not yours        │
└─────────────────────────────────────────────────────────────────┘
```

**How white-label domains work:**

```
Agency sets custom domain: analytics.rocketagency.co.uk

They add a CNAME in their DNS:
  analytics.rocketagency.co.uk  →  CNAME  →  clients.yourplatform.com

Your Nginx:
  server_name ~^(?<subdomain>.+)\.yourplatform\.com$;
  → Looks up subdomain in core_agency_domains table
  → Finds agency_id → loads their branding config
  → Serves the correct theme/logo/colours
```

---

## Database Schema

The complete multi-tenant database design.

> **Universal column convention** — every `mkt_*` table includes these columns even if not shown in shortened CREATE TABLE statements below. They are present in the actual schema:
> - `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`
> - `updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
> - `deleted_at DATETIME NULL` ← **soft delete on EVERY table**, all queries filter `WHERE deleted_at IS NULL`
> - Workspace-scoped tables include `workspace_id CHAR(36) NOT NULL` and `INDEX idx_workspace (workspace_id)`
>
> The shortened CREATE TABLE blocks below omit these only for readability — they are non-negotiable in implementation.

```sql
-- USERS & AUTH
CREATE TABLE core_users (
  id                CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  full_name         VARCHAR(255) NOT NULL,
  user_email        VARCHAR(255) NOT NULL UNIQUE,
  password_hash     VARCHAR(255),                          -- NULL if SSO-only
  google_id         VARCHAR(255),                          -- for Google SSO
  avatar_url        VARCHAR(500),
  type              ENUM('platform_admin','agency_owner','client_owner','team_member') NOT NULL,
  status            ENUM('active','suspended','invited','pending_verify') DEFAULT 'pending_verify',
  email_verified    TINYINT(1)   DEFAULT 0,
  verify_token      VARCHAR(255),
  verify_token_exp  DATETIME,
  last_login_at     DATETIME,
  totp_secret       VARCHAR(255),                          -- 2FA for admins
  totp_enabled      TINYINT(1)   DEFAULT 0,
  created_at        DATETIME     DEFAULT CURRENT_TIMESTAMP,
  deleted_at        DATETIME     NULL
) ENGINE=InnoDB;

-- WORKSPACES (one per business)
CREATE TABLE core_workspaces (
  id                CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  name              VARCHAR(255) NOT NULL,
  domain            VARCHAR(255),                          -- their website
  industry          VARCHAR(100),
  country           CHAR(2),
  timezone          VARCHAR(50)  DEFAULT 'Europe/London',
  logo_url          VARCHAR(500),
  owner_id          CHAR(36)     NOT NULL,                 -- core_users.id
  agency_id         CHAR(36),                              -- NULL if direct client
  plan_id           CHAR(36),
  status            ENUM('active','suspended','trial','cancelled') DEFAULT 'trial',
  trial_ends_at     DATETIME,
  settings          JSON,                                  -- theme, notifications, etc.
  created_at        DATETIME     DEFAULT CURRENT_TIMESTAMP,
  deleted_at        DATETIME     NULL,
  INDEX idx_owner   (owner_id),
  INDEX idx_agency  (agency_id)
) ENGINE=InnoDB;

-- WORKSPACE MEMBERS (who has access to which workspace)
CREATE TABLE core_workspace_members (
  id                CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id      CHAR(36)     NOT NULL,
  user_id           CHAR(36)     NOT NULL,
  role              ENUM('owner','editor','analyst','viewer') NOT NULL,
  invited_by        CHAR(36),
  invite_token      VARCHAR(255),                          -- for pending invitations
  invite_expires_at DATETIME,
  joined_at         DATETIME,
  status            ENUM('active','invited','suspended') DEFAULT 'invited',
  created_at        DATETIME     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_workspace_user (workspace_id, user_id),
  INDEX idx_workspace (workspace_id),
  INDEX idx_user      (user_id)
) ENGINE=InnoDB;

-- ROLES (per workspace — customisable by client owner)
CREATE TABLE core_roles (
  id                CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id      CHAR(36)     NOT NULL,                 -- NULL = platform default role
  role_name         VARCHAR(100) NOT NULL,
  is_default        TINYINT(1)   DEFAULT 0,
  created_at        DATETIME     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB;

-- PERMISSIONS PER ROLE (matches existing a_permissions pattern exactly)
CREATE TABLE core_permissions (
  id                CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  role_id           CHAR(36)     NOT NULL,
  module_name       VARCHAR(100) NOT NULL,
  access            JSON         NOT NULL,                 -- {"c":true,"r":true,"u":false,"d":false}
  UNIQUE KEY uk_role_module (role_id, module_name)
) ENGINE=InnoDB;

-- AUTH SESSIONS (refresh tokens — mirrors existing a_history pattern)
CREATE TABLE core_auth_sessions (
  id                CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  user_id           CHAR(36)     NOT NULL,
  workspace_id      CHAR(36),
  refresh_token     VARCHAR(500) NOT NULL,
  device_info       JSON,                                  -- browser, OS, IP
  expires_at        DATETIME     NOT NULL,
  revoked_at        DATETIME,
  created_at        DATETIME     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user    (user_id),
  INDEX idx_token   (refresh_token(100))
) ENGINE=InnoDB;

-- AGENCY WHITE-LABEL SETTINGS
CREATE TABLE core_agency_settings (
  id                CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id      CHAR(36)     NOT NULL UNIQUE,          -- the agency's workspace
  brand_name        VARCHAR(255),                          -- "Rocket Reports"
  brand_logo_url    VARCHAR(500),
  brand_colour      CHAR(7),                               -- hex: "#1D4ED8"
  brand_favicon_url VARCHAR(500),
  custom_domain     VARCHAR(255),                          -- "analytics.rocketagency.co.uk"
  domain_verified   TINYINT(1)   DEFAULT 0,
  reply_to_email    VARCHAR(255),                          -- for client emails
  support_url       VARCHAR(255),
  hide_powered_by   TINYINT(1)   DEFAULT 0,
  report_footer     TEXT,                                  -- custom text on PDF reports
  created_at        DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- PLANS (subscription tiers)
CREATE TABLE core_plans (
  id                CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  name              VARCHAR(100) NOT NULL,                 -- "Starter", "Pro", "Agency"
  price_monthly     DECIMAL(8,2),
  price_yearly      DECIMAL(8,2),
  stripe_price_id_monthly VARCHAR(255),
  stripe_price_id_yearly  VARCHAR(255),
  features          JSON,                                  -- feature flags per plan
  limits            JSON,                                  -- {"keywords":100,"campaigns":5}
  max_team_members  INT          DEFAULT 1,
  max_clients       INT          DEFAULT 0,               -- 0 = not an agency plan
  is_agency_plan    TINYINT(1)   DEFAULT 0,
  is_active         TINYINT(1)   DEFAULT 1,
  created_at        DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- SUBSCRIPTIONS
CREATE TABLE core_subscriptions (
  id                       CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id             CHAR(36) NOT NULL,
  plan_id                  CHAR(36) NOT NULL,
  stripe_subscription_id   VARCHAR(255),
  stripe_customer_id       VARCHAR(255),
  status                   ENUM('trialing','active','past_due','cancelled','paused') DEFAULT 'trialing',
  current_period_start     DATETIME,
  current_period_end       DATETIME,
  cancel_at_period_end     TINYINT(1) DEFAULT 0,
  created_at               DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB;
```

---

## JWT Token Design

Built on the same pattern as the existing platform:

```javascript
// marketing-core/_services/auth.service.js
// Mirrors existing auth.service.js exactly

const generateTokens = async (user, workspace, role, permissions) => {

  // Access token payload — same structure as existing JWT
  const payload = {
    id:           user.id,
    type:         user.type,              // 'platform_admin' | 'agency_owner' | 'client_owner' | 'team_member'
    workspace_id: workspace.id,           // KEY: workspace isolation
    workspace_name: workspace.name,
    agency_id:    workspace.agency_id,    // null if direct client
    name:         user.full_name,
    email:        user.user_email,
    avatar:       user.avatar_url,
    role:         role.role_name,         // 'client_owner' | 'editor' | 'analyst' | 'viewer'
    plan:         workspace.plan_id,
    permissions: permissions.map(p => ({  // same structure as existing a_permissions
      module_name: p.module_name,
      access: p.access                    // {"c":true,"r":true,"u":false,"d":false}
    }))
  };

  const access_token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_TOKEN_LIFE || '24h'  // same env var as existing platform
  });

  // Refresh token — same pattern as existing a_history
  const refresh_token = crypto.randomBytes(40).toString('hex');

  // Store in core_auth_sessions (mirrors a_history pattern)
  await MktAuthSession.create({
    user_id:       user.id,
    workspace_id:  workspace.id,
    refresh_token: refresh_token,
    expires_at:    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  });

  return { access_token, refresh_token };
};
```

**Why same JWT_SECRET as existing platform?**
A LicensedTaxi admin (who already has login credentials) can sign into the marketing platform without creating a separate account. SSO is automatic because both platforms trust the same secret.

> **Security note:** The shared `JWT_SECRET` means a leaked key on either platform compromises both. In production, plan to migrate to **asymmetric signing** (RS256) where each platform has its own private signing key but trusts a shared public key — this enables platform-specific key rotation without coordinated downtime. See `security.md` → "Key Management".

### Recommended JWT Lifetimes (revised from initial spec)

The original "24h access token" was inherited from the existing platform. For a SaaS handling business marketing data, that window is too long for compromised tokens. Use shorter access tokens + standard refresh:

| Token | Lifetime | Storage | Reason |
|---|---|---|---|
| **Access token** | **15 minutes** | In-memory (Redux) | Compromised tokens expire fast; refresh is invisible to UX |
| **Refresh token** | **30 days** sliding | HTTP-only Secure SameSite=Lax cookie | Long-lived but server-revokable via `core_auth_sessions.revoked_at` |
| **Email verify token** | 48 hours | DB column, single-use | Invitations |
| **Password reset token** | 1 hour | DB column, single-use | Industry standard |
| **API key (customer integrations)** | Never expires until revoked | Hashed in DB | Long-lived for Zapier/HubSpot etc. |

**Cookie spec (refresh token):**
```
Set-Cookie: refresh_token=<hex>;
            HttpOnly;
            Secure;
            SameSite=Lax;
            Domain=.yourplatform.com;          (for SSO across subdomains)
            Path=/api/v1/core/auth;
            Max-Age=2592000                    (30 days)
```
For custom domains (`analytics.rocketagency.co.uk`), the cookie is scoped to that domain — agency clients never share cookies with the main platform.

**Important:** Remove the `plan` field from the JWT payload — it gets stale within 24h of an upgrade/downgrade. Instead, the `planGuard` middleware reads from Redis (5-minute TTL) on every request. JWT carries only the workspace_id; plan/permissions are fetched server-side.

---

## Two-Factor Authentication (2FA)

**Mandatory:**
- ✅ Platform admins (you) — TOTP required at every login
- ✅ Agency owners — TOTP required at every login (they hold OAuth tokens for dozens of client accounts)
- ✅ Client owners — TOTP required for sensitive actions (delete workspace, change billing, export data, add team member) — "step-up auth"

**Optional but encouraged:**
- Team members (editor/analyst/viewer)

**Supported 2FA methods:**
- **TOTP** (Google Authenticator, Authy, 1Password) — primary
- **WebAuthn / Passkeys** — recommended for enterprise (FIDO2 hardware keys, biometric)
- **SMS** — fallback only, not primary (SIM-swap risk)

```sql
ALTER TABLE core_users
  ADD COLUMN totp_required TINYINT(1) DEFAULT 0,
  ADD COLUMN webauthn_credentials JSON,
  ADD COLUMN backup_codes_hash JSON,           -- 10 single-use codes
  ADD COLUMN last_2fa_at DATETIME,
  ADD COLUMN trusted_devices JSON;             -- list of device fingerprints (30-day trust)
```

**Step-up auth flow:**
```
User clicks "Delete workspace"
  → Backend checks last_2fa_at < 5 minutes ago?
    → Yes: proceed
    → No: respond 401 + WWW-Authenticate: 2FA-Required
    → Frontend shows 2FA modal → user enters TOTP code
    → Backend updates last_2fa_at → retry original request
```

---

## Enterprise SSO (SAML 2.0 + OIDC)

For agency/enterprise clients on the Agency plan, support **single sign-on via their identity provider** (Okta, Azure AD, Google Workspace, OneLogin).

```sql
CREATE TABLE core_sso_connections (
  id              CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  workspace_id    CHAR(36)     NOT NULL,
  protocol        ENUM('saml','oidc','scim') NOT NULL,
  display_name    VARCHAR(100),
  -- SAML
  saml_entity_id  VARCHAR(500),
  saml_sso_url    VARCHAR(500),
  saml_cert       TEXT,
  -- OIDC
  oidc_issuer     VARCHAR(500),
  oidc_client_id  VARCHAR(255),
  oidc_client_secret_encrypted TEXT,           -- AES + per-workspace KEK
  -- SCIM (just-in-time user provisioning)
  scim_endpoint   VARCHAR(500),
  scim_bearer_token_encrypted TEXT,
  -- General
  default_role    ENUM('owner','editor','analyst','viewer') DEFAULT 'viewer',
  domain_lock     VARCHAR(255),                -- only emails from this domain
  enforce_sso     TINYINT(1) DEFAULT 0,        -- if 1, password login blocked
  status          ENUM('active','testing','disabled') DEFAULT 'testing',
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB;
```

**Library choice:** `passport-saml` (already-familiar Passport pattern) + `openid-client` for OIDC.

---

## Workspace Lifecycle State Machine

Every workspace passes through these states. Each transition has defined effects on data, queues, and billing.

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   trial ──────► active ────► past_due ────► suspended ────► cancelled
│      │           ▲    │         │              │              │     │
│      │           │    │         │              │              ▼     │
│      │           └────┴─────────┘              │       pending_deletion
│      │             (recover)                   │              │     │
│      ▼                                         │              ▼     │
│   cancelled ◄──────────────────────────────────┘           deleted  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

| State | Trigger | Data Access | Background Jobs | Billing |
|---|---|---|---|---|
| `trial` | New signup, 14-day trial | Full access | All queues running | No charge |
| `active` | Trial ended + valid card OR upgraded plan | Full access | All queues running | Stripe charges |
| `past_due` | Stripe payment failed | Full access (3-day grace) | All queues running | Dunning emails day 1, 3, 5 |
| `suspended` | 7 days past_due | **Read-only** | Queues paused except `mkt-billing-dunning` | Card retry attempts |
| `cancelled` | User cancels OR 30 days suspended | Read-only login for 30 more days (data export) | All queues paused | No charges |
| `pending_deletion` | 30 days after cancelled | Cannot log in; 30-day legal grace | None | None |
| `deleted` | 60 days after cancellation | Hard delete via `mkt-workspace-deletion` | Audit log row retained (anonymised) | None |

**Effects on scheduled content (critical):**
- `suspended`: scheduled social posts, drip emails, ad campaigns are **paused** (not deleted). On reactivation, user picks which to resume.
- `cancelled`: all OAuth tokens **revoked** at the social platforms (Meta, Google, etc.) — clients should never be auto-posting from a cancelled account.
- `deleted`: hard delete from all DBs + S3; audit-log entry retained for legal compliance (anonymised — see `compliance.md`).

---

## Ownership Transfer, Cancellation, Refunds

These flows are common in production SaaS but easy to forget:

### Workspace Ownership Transfer
- Owner invites a new team member with role `owner`
- Both must accept the transfer via 2FA-verified email confirmation
- Old owner downgraded to `editor` by default (or can be removed)
- Audit log captures full transfer with both parties' IPs and timestamps

### Cancellation Flow
1. User clicks "Cancel Subscription" → required to enter password + reason (radio buttons)
2. Save flow: offer 30% discount for 3 months OR pause for 60 days
3. If proceeds: subscription `cancel_at_period_end = true` (Stripe)
4. End of billing period: workspace status → `cancelled`
5. 30-day export window starts
6. 30 days later → `pending_deletion`
7. 60 days after cancellation → hard delete

### Refunds
- **Self-serve refund** within first 14 days of first payment (Stripe API call)
- After 14 days: support ticket → manual refund via Stripe Dashboard
- Audit log records: actor, amount, reason, original charge ID

### Downgrade Mid-Cycle
- Downgrade takes effect at next billing cycle (no prorated refund)
- If downgrade would exceed new plan limits (e.g., 1500 keywords on Starter plan capped at 100), warn user and require either deletion of excess data OR delay downgrade
- Plan feature flags refresh from Redis within 5 minutes of plan change

---

## Login Security Beyond Password

**Password policy:**
- Minimum 12 characters, must include uppercase + lowercase + digit + symbol
- Checked against [Have I Been Pwned](https://haveibeenpwned.com/Passwords) Pwned Passwords API on every signup and password change (k-anonymity model — only first 5 chars of SHA-1 hash are sent)
- bcrypt 10 rounds (same as existing platform)
- Force password reset on suspicious login (unusual IP/location/device)

**Session management:**
- Max 5 concurrent active sessions per user (older sessions auto-revoked)
- "Log out of all devices" button on Account → Security
- Session list shows: device, browser, IP, location, last active
- Email alert on every new device login

**IP allowlisting (Agency + Enterprise plans only):**
```sql
ALTER TABLE core_workspaces ADD COLUMN ip_allowlist JSON;
-- Stored as CIDR ranges: ["203.0.113.0/24", "198.51.100.42/32"]
```
- Requests outside the allowlist → 403 Forbidden
- Configurable per workspace by the owner
- Useful for B2B clients in regulated industries

**Rate limiting:**
- `express-rate-limit` with `rate-limit-redis` (in-memory won't work across multiple Node.js instances)
- Tiers:
  - Anonymous: 30 req/min per IP
  - Authenticated Free plan: 100 req/min
  - Pro: 1,000 req/min
  - Agency: 10,000 req/min
- 429 responses include `Retry-After` header
- Login endpoint: 5 attempts per email per hour → temporary lock + email alert

**Impersonation (for support):**
- Platform admins can "impersonate" a workspace to debug customer issues
- **Always logged** in `core_audit_log` with `actor_id = admin_id` AND `impersonated_user_id = customer_id`
- Banner displayed at top of UI: "⚠️ You are impersonating user@example.com. Click to exit."
- Limited to 4 hours per impersonation session
- Customer email notification sent when impersonation begins (per GDPR data-access transparency)

---

## Implementation Guide

### Backend: marketing-core service

```
marketing-core/
├── routes/
│   ├── auth.routes.js         POST /register, /login, /logout, /refresh-token, /google
│   ├── workspace.routes.js    GET/POST/PATCH /workspaces, /workspaces/:id
│   ├── members.routes.js      GET/POST/DELETE /workspaces/:id/members
│   ├── invites.routes.js      POST /invites, GET /invites/:token, POST /invites/:token/accept
│   ├── roles.routes.js        GET/POST/PATCH /roles
│   ├── billing.routes.js      POST /billing/subscribe, /billing/portal, /billing/webhook
│   └── agency.routes.js       GET/POST/PATCH /agency/settings, /agency/clients
│
├── _services/
│   ├── auth.service.js        login, register, refreshToken, logout
│   ├── workspace.service.js   create, update, getByUser
│   ├── invite.service.js      sendInvite, acceptInvite, revokeInvite
│   ├── role.service.js        getDefaultRoles, createCustomRole
│   ├── permission.service.js  getPermissions, updatePermissions
│   ├── billing.service.js     subscribe, handleWebhook, getPortalUrl
│   └── agency.service.js      getBranding, updateBranding, verifyDomain
│
├── middleware/
│   ├── authenticate.js        Passport JWT (copy from existing)
│   ├── workspaceGuard.js      Enforce workspace_id from JWT on all requests
│   ├── requirePermission.js   Module-level CRUD permission check
│   ├── planGuard.js           Block features not in current plan
│   └── statusGuard.js         Redis cache: block suspended workspaces (mirrors adminStatusGuard)
│
└── models/
    ├── user.model.js          (mirrors existing a_users pattern)
    ├── workspace.model.js
    ├── workspaceMember.model.js
    ├── role.model.js          (mirrors existing a_roles pattern)
    ├── permission.model.js    (mirrors existing a_permissions pattern)
    ├── authSession.model.js   (mirrors existing a_history pattern)
    ├── agencySettings.model.js
    ├── plan.model.js
    └── subscription.model.js
```

### Frontend: Login Page (React + Vite + MUI — Option C)

```tsx
// apps/web/app/(auth)/login/page.tsx

import {
  Box, Card, CardContent, TextField, Button, Typography,
  Divider, Alert, CircularProgress, InputAdornment, IconButton
} from '@mui/material';
import { Google as GoogleIcon, Visibility, VisibilityOff } from '@mui/icons-material';

export default function LoginPage() {
  // For agency white-label: read domain → fetch brand config
  // → show agency logo + colours instead of platform brand
  const { brand } = useAgencyBrand();

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center',
               justifyContent: 'center', bgcolor: 'background.default' }}>
      <Card sx={{ width: 400, p: 2 }}>
        <CardContent>
          {/* Logo: platform brand OR agency white-label brand */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <img src={brand.logo_url} alt={brand.name} height={40} />
            <Typography variant="h5" fontWeight={700} mt={1}>
              Sign in to {brand.name}
            </Typography>
          </Box>

          {/* Google SSO */}
          <Button fullWidth variant="outlined" startIcon={<GoogleIcon />}
                  onClick={handleGoogleLogin} sx={{ mb: 2 }}>
            Continue with Google
          </Button>

          <Divider sx={{ mb: 2 }}>or</Divider>

          {/* Email + Password */}
          <TextField fullWidth label="Email address" type="email"
                     {...register('email')} error={!!errors.email}
                     helperText={errors.email?.message} sx={{ mb: 2 }} />
          <TextField fullWidth label="Password" type={showPassword ? 'text' : 'password'}
                     {...register('password')} error={!!errors.password}
                     InputProps={{
                       endAdornment: (
                         <InputAdornment position="end">
                           <IconButton onClick={() => setShowPassword(!showPassword)}>
                             {showPassword ? <VisibilityOff /> : <Visibility />}
                           </IconButton>
                         </InputAdornment>
                       )
                     }} sx={{ mb: 1 }} />

          <Button fullWidth variant="contained" size="large"
                  type="submit" disabled={loading} sx={{ mt: 2 }}>
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
```

### Frontend: Workspace Switcher (for Agency Owners)

```tsx
// Agency owners can switch between their client workspaces
// Shown in the top navigation bar

import { Menu, MenuItem, Avatar, Chip, Typography, ListItemText, Divider } from '@mui/material';
import { Business as BusinessIcon } from '@mui/icons-material';

<Menu>
  <Typography variant="caption" sx={{ px: 2, color: 'text.secondary' }}>
    YOUR CLIENTS
  </Typography>
  {clients.map(client => (
    <MenuItem key={client.id} onClick={() => switchWorkspace(client.id)}>
      <Avatar sx={{ mr: 1, width: 28, height: 28 }}>{client.name[0]}</Avatar>
      <ListItemText primary={client.name} secondary={client.domain} />
      {currentWorkspace.id === client.id && (
        <Chip label="Active" size="small" color="primary" />
      )}
    </MenuItem>
  ))}
  <Divider />
  <MenuItem onClick={goToAgencyDashboard}>
    <BusinessIcon sx={{ mr: 1 }} />
    Agency Overview
  </MenuItem>
</Menu>
```

### Workspace Guard Middleware (enforces isolation on ALL routes)

```javascript
// middleware/workspaceGuard.js
// Injected into EVERY route across ALL 12 services

const workspaceGuard = async (req, res, next) => {
  const { workspace_id, type } = req.user;

  // Platform admins bypass workspace isolation — they see everything
  if (type === 'platform_admin') return next();

  // Inject workspace_id into all query operations automatically
  req.workspaceId = workspace_id;

  // If route has :workspace_id param, verify it matches the token
  if (req.params.workspace_id && req.params.workspace_id !== workspace_id) {
    // Agency owners can access their clients' workspaces
    if (type === 'agency_owner') {
      const isClientWorkspace = await MktWorkspace.findOne({
        where: { id: req.params.workspace_id, agency_id: workspace_id, deleted_at: null }
      });
      if (!isClientWorkspace) {
        return res.status(403).json({ status: 'error', msg: 'Access denied' });
      }
      req.workspaceId = req.params.workspace_id; // switch context to client workspace
      return next();
    }
    return res.status(403).json({ status: 'error', msg: 'Access denied' });
  }

  next();
};

// Usage in every controller — data never leaks between workspaces:
const keywords = await MktKeyword.findAll({
  where: { workspace_id: req.workspaceId, deleted_at: null },  // ← always scoped
  ...paginationOptions
});
```

---

## Plan Limits & Feature Flags

Different plan tiers unlock different features and set usage limits.

```javascript
// Starter Plan (£29/mo)
{
  limits: {
    keywords:       100,    // max keywords to track
    campaigns:        5,    // max active campaigns
    team_members:     2,    // max team members
    email_sends:   5000,    // per month
    ai_credits:     500,    // AI content generations per month
    social_accounts:  3,    // connected social profiles
  },
  features: {
    seo:            true,
    ppc:            false,  // upgrade required
    social:         true,
    email:          true,
    influencers:    false,
    affiliates:     false,
    white_label:    false,
    one_click:      false,  // flagship — Pro+ only
    competitor_intel: false,
    advanced_analytics: false,
  }
}

// Pro Plan (£79/mo)
{
  limits: {
    keywords:      1000,
    campaigns:       25,
    team_members:     5,
    email_sends:  50000,
    ai_credits:    5000,
    social_accounts: 10,
  },
  features: {
    seo:            true,
    ppc:            true,
    social:         true,
    email:          true,
    influencers:    true,
    affiliates:     true,
    white_label:    false,
    one_click:      true,   // ← One-Click Market Capture unlocked
    competitor_intel: true,
    advanced_analytics: true,
  }
}

// Agency Plan (£249/mo)
{
  limits: {
    keywords:     10000,    // across all clients
    campaigns:   unlimited,
    team_members:      20,
    email_sends: 500000,
    ai_credits:   50000,
    social_accounts: 100,
    max_clients:      50,   // client sub-workspaces
  },
  features: {
    everything:     true,
    white_label:    true,   // ← Custom domain, logo, colours
    client_portal:  true,
    bulk_reports:   true,
    api_access:     true,
  }
}
```

**Plan guard middleware — runs after workspaceGuard:**

```javascript
// middleware/planGuard.js
const requireFeature = (feature) => async (req, res, next) => {
  const subscription = await getSubscriptionFromCache(req.workspaceId);
  const plan = PLAN_FEATURES[subscription.plan_name];

  if (!plan.features[feature]) {
    return res.status(402).json({
      status: 'error',
      msg: `This feature requires a ${getMinPlanForFeature(feature)} plan`,
      upgrade_url: `/billing/upgrade`
    });
  }
  next();
};

// On the One-Click Capture route:
router.post('/one-click-capture',
  authenticate,
  workspaceGuard,
  requireFeature('one_click'),          // ← blocks Starter plan users
  requirePermission('campaigns', 'c'),  // ← checks role permission
  campaignController.oneClickCapture
);
```

---

## Summary — Complete Multi-Client System

```
Registration:  Email + password  OR  Google SSO  OR  Agency invite link
Login:         Same flow — JWT (24hr) + refresh token (30-day HTTP-only cookie)
Isolation:     workspace_id in every JWT, enforced on EVERY query in EVERY service
Roles:         6 roles — Platform Admin, Agency Owner, Client Owner, Editor, Analyst, Viewer
Permissions:   Per-module CRUD — identical pattern to existing LicensedTaxi RBAC
Analytics:     Every client sees only their own data — SEO, PPC, Social, Email, Revenue
Reports:       Automated weekly PDF via pdfkit + SendGrid — branded for agency clients
White-label:   Custom domain + logo + colours for agency clients — clients see agency brand
Plans:         Starter / Pro / Agency — Stripe subscriptions, feature flags, usage limits
SSO:           Same JWT_SECRET as LicensedTaxi — existing admins can log in without new account
```
