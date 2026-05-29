# 🛠️ Technology Stack — Digital Marketing Platform
## Complete Technology Guide: Every Tool, Every Library, Every Reason

> Based on deep analysis of the existing LicensedTaxi platform codebase.
> Every technology choice aligns with or extends what is already built and proven.

---

## 📋 Table of Contents

1. [The Big Picture](#the-big-picture)
2. [Frontend Technologies](#frontend-technologies)
3. [Backend Technologies](#backend-technologies)
4. [Database Layer](#database-layer)
5. [AI & Machine Learning](#ai--machine-learning)
6. [Third-Party APIs & Integrations](#third-party-apis--integrations)
7. [Infrastructure & DevOps](#infrastructure--devops)
8. [Security Stack](#security-stack)
9. [Real-Time & Messaging](#real-time--messaging)
10. [Testing Stack](#testing-stack)
11. [Complete Package List](#complete-package-list)
12. [Technology Decision Matrix](#technology-decision-matrix)
13. [Why NOT These Technologies](#why-not-these-technologies)

---

## The Big Picture

The platform is built as a **monorepo** with 12 backend microservices + 2 frontend apps.

```
Architecture Overview
─────────────────────────────────────────────────────────────────
User Browser / Mobile App
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│  React 18 + Vite (Dashboard)  ·  Astro (Marketing site)       │
│  Express (Landing-renderer)   ·  MUI v6 · TypeScript          │
└───────────────────────────┬───────────────────────────────────┘
                            │ HTTPS
                            ▼
┌───────────────────────────────────────────────────────────────┐
│                    Nginx  (Reverse Proxy)                     │
│            SSL Termination · Rate Limiting · Load Balance     │
└──────┬──────┬──────┬──────┬──────┬──────┬──────┬─────────────┘
       │      │      │      │      │      │      │
  ─────┼──────┼──────┼──────┼──────┼──────┼──────┼─────
  3100 │ 3101 │ 3102 │ 3103 │ 3104 │ 3105 │ 3106 │ ...
  ─────┼──────┼──────┼──────┼──────┼──────┼──────┼─────
  Core │ SEO  │  AI  │Camps │Anlyt │Social│Email │ +6
  ─────┴──────┴──────┴──────┴──────┴──────┴──────┴─────
       Node.js + Express (identical pattern per service)
                            │
          ┌─────────────────┼──────────────────┐
          ▼                 ▼                  ▼
    ┌──────────┐     ┌──────────┐      ┌──────────────┐
    │  MySQL/PostgreSQL │     │  Redis   │      │  ClickHouse  │
    │ (primary)│     │(cache+   │      │  (analytics) │
    │Sequelize │     │  queues) │      │  time-series │
    └──────────┘     └──────────┘      └──────────────┘
          │
    ┌──────────┐     ┌──────────────┐
    │Elasticsrch│     │  Bull Queues │
    │ (search) │     │  (background)│
    └──────────┘     └──────────────┘
```

---

## Frontend Technologies

> ✅ **Decision recorded (2026-05-28):** Option C — React + Vite for the dashboard, Astro for the marketing site, Express for landing-page SSR. See [frontend-decision.md](frontend-decision.md) for the full rationale.

### 🔷 Dashboard Framework: React 18 + Vite 5 + TypeScript

```
react: 18.3.x
react-dom: 18.3.x
react-router-dom: 6.26.x
vite: 5.4.x
@vitejs/plugin-react: 4.3.x
typescript: 5.5.x
vitest: 2.0.x                    (Vite-native test runner — replaces Jest for frontend)
```

**Why React + Vite (not Next.js)?**

The dashboard is **logged-in only** — it doesn't need SEO. For a pure SPA:
- **Vite's HMR is ~50ms** (vs Next.js 100-500ms) — better dev experience
- **Simpler mental model** — no Server Components, no `app/` router conventions, no Server Actions
- **Static file deployment** — Cloudflare Pages free tier handles unlimited traffic
- **Smaller learning curve** — plain React + React Router that every JS developer already knows
- **Faster cold builds** — Vite uses esbuild for dev, Rollup for prod; both faster than Next.js webpack

### 🔷 Public Marketing Site: Astro 4 (separate app)

```
astro: 4.x
@astrojs/sitemap: 3.x
@astrojs/mdx: 3.x
@astrojs/rss: 4.x
@astrojs/react: 3.x              (optional — for interactive React islands)
```

**Why Astro for marketing site?**
- Zero JavaScript by default (Lighthouse perf score 100)
- Built for content-heavy sites (blog, pricing, features)
- Markdown / MDX-first for non-engineers to edit blog posts
- Deploys as static files → free unlimited Cloudflare Pages
- SEO-perfect out of the box (sitemap, OG tags, semantic HTML)

### 🔷 Landing Page Renderer: Express + Handlebars (separate small service)

For One-Click Capture landing pages, webinar registration pages, and other SEO-critical dynamic pages that the SPA can't serve:

```
express: 4.18.x
handlebars: 4.7.x                (or react-dom/server for React SSR)
helmet: 8.0.x
compression: 1.7.x
```

A small (~500-line) dedicated SSR service serving `pages.yourplatform.com/*`. Caches at the CDN edge so it scales trivially.

**Why this hybrid?**

| Frontend concern | Solution |
|---|---|
| Dashboard (login-only, no SEO needed) | React + Vite SPA |
| Marketing site (SEO critical) | Astro SSG |
| Landing pages from One-Click Capture (SEO critical, dynamic) | Express SSR (`landing-renderer`) |
| Lead capture form embeds (Open Graph tags) | Server-rendered HTML from `crm-automation` |
| Tracking script | Built separately, served via CDN |

**Three deployable frontends instead of one** — but each is small, focused, and independently deployable.

---

### 🎨 UI Framework: MUI (Material-UI) v6

```
@mui/material: 6.4.x              (core component library)
@mui/icons-material: 6.4.x        (2,100+ Material icons)
@mui/x-data-grid: 7.9.x           (Community — free; advanced data tables — already in admin panel)
@mui/x-data-grid-pro: 7.9.x       (PAID LICENCE — required for >100k row virtualisation, row pinning, tree data, server-side filtering for keyword/contact tables. £149/dev/year)
@mui/x-date-pickers: 7.28.x       (date/time pickers — already in web app)
@mui/x-date-pickers-pro: 7.28.x   (date ranges — already in web app)
@mui/x-charts: 7.x                (MUI-native charts — bar, line, pie, area)
@emotion/react: 11.x              (CSS-in-JS engine for MUI)
@emotion/styled: 11.x             (styled components for MUI)
```

**Why MUI — aligned with existing platform:**

The entire existing platform already runs on MUI. Using it for the marketing platform means:

| Benefit | Detail |
|---|---|
| **Zero new learning** | Every developer already knows MUI component API |
| **Consistent design language** | Marketing dashboard looks and feels like the existing admin panel |
| **Shared theme** | One `createTheme()` definition → brand colours, typography, spacing applied everywhere |
| **Component depth** | MUI ships 50+ production-ready components: DataGrid, DatePicker, Autocomplete, Dialog, Drawer, etc. |
| **TypeScript-first** | Full TypeScript types for every prop — already typed in existing codebase |
| **MUI X DataGrid** | Already used in admin panel — handles 100,000-row keyword tables with virtualization, sorting, filtering, export |
| **MUI X Charts** | Native MUI charts — no extra charting library needed for basic analytics |
| **Accessibility** | WCAG 2.1 AA compliant out of the box — keyboard nav, screen reader support |
| **SPA-friendly** | Works seamlessly with React + Vite (no SSR setup required for the dashboard) |

**Version alignment:**
- Existing **web app**: MUI `6.4.4` → Marketing platform uses **MUI `6.4.x`** (exact match)
- Existing **admin panel**: MUI `7.1.0` → White-label admin portal uses **MUI `7.x`** (exact match)

**MUI Theme Setup for Marketing Platform:**
```typescript
// apps/web/lib/theme.ts
import { createTheme } from '@mui/material/styles';

export const marketingTheme = createTheme({
  palette: {
    mode: 'light',
    primary:   { main: '#2563EB' },  // Professional blue
    secondary: { main: '#7C3AED' },  // Purple accent
    success:   { main: '#16A34A' },  // Growth/positive metrics
    error:     { main: '#DC2626' },  // Alerts/drops
    warning:   { main: '#D97706' },  // Warnings
    background: { default: '#F8FAFC', paper: '#FFFFFF' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: '2rem',   fontWeight: 700 },
    h2: { fontSize: '1.5rem', fontWeight: 600 },
    h3: { fontSize: '1.25rem',fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton:   { defaultProps: { disableElevation: true } },
    MuiCard:     { styleOverrides: { root: { boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } } },
    MuiDataGrid: { defaultProps: { density: 'compact', disableRowSelectionOnClick: true } },
  },
});
```

**Key MUI Components Used Per Module:**

| Module | MUI Components |
|---|---|
| SEO Keyword Table | `DataGrid` (sort, filter, export), `Chip` (intent tags), `LinearProgress` (difficulty score) |
| Analytics Dashboard | `MUI X Charts` (line/bar/area), `Card`, `Skeleton` (loading states) |
| Campaign Manager | `Stepper` (One-Click wizard steps), `Timeline`, `Chip` (channel tags) |
| CRM Contacts | `DataGrid` (100k rows, virtualized), `Avatar`, `Badge` (lifecycle stage) |
| Email Builder | `Drawer` (template panel), `Tabs`, `Accordion` (block settings) |
| Social Scheduler | `DateCalendar` (content calendar view), `Badge` (post count per day) |
| Competitor Intel | `Table`, `Tooltip`, `Rating` (DA score) |
| Workflow Builder | `Paper` nodes with MUI styling over React Flow canvas |
| Navigation | `Drawer` (sidebar), `AppBar`, `List`, `ListItem`, `Collapse` (nested nav) |
| Forms (all) | `TextField`, `Select`, `Autocomplete`, `Switch`, `Slider`, `FormControl` |
| Modals (all) | `Dialog`, `DialogTitle`, `DialogContent`, `DialogActions` |
| Notifications | `Snackbar` + `Alert` (success/error toasts) |
| Upload | `Button` + custom dropzone (MUI-styled) |
| Loading | `Skeleton`, `CircularProgress`, `LinearProgress` |

---

### ✨ Animations: Framer Motion

```
framer-motion: 12.4.x  (already in existing web app — exact same version)
```

**Why:** Already proven in the existing codebase. Powers the One-Click Capture wizard's live-streaming progress animation, page transitions, and the animated marketing dashboard components.

---

### 📊 Charts & Data Visualisation

```
@mui/x-charts: 7.x         (PRIMARY — native MUI charts, no extra theming needed)
recharts: 2.12.x           (SECONDARY — for complex custom charts MUI X doesn't cover)
@xyflow/react: 12.x        (workflow builder — drag-and-drop automation canvas; v12 is the renamed package, formerly `reactflow`)
```

**Why MUI X Charts as primary?**
- **Native MUI integration** — inherits your theme colours, typography, and spacing automatically. No separate colour config needed.
- **Consistent look** — chart tooltips, legends, and axes match your MUI components exactly
- **Zero theming friction** — `primary.main`, `success.main` colours flow straight into bars and lines
- **Covers 90% of needs** — Line, Bar, Pie, Area, Scatter charts all included

```tsx
// Example: Analytics dashboard line chart — zero extra styling needed
import { LineChart } from '@mui/x-charts/LineChart';

<LineChart
  series={[{ data: trafficData, label: 'Organic Traffic', color: theme.palette.primary.main }]}
  height={300}
  sx={{ '& .MuiChartsAxis-root': { fontSize: '0.75rem' } }}
/>
```

**Why keep Recharts as secondary?**
For advanced custom visualisations MUI X Charts doesn't support yet:
- Multi-axis charts (traffic + conversions on dual Y-axes)
- Custom SVG conversion funnel visualisation
- Geo/heatmap charts (social listening geographic distribution)
- Real-time streaming charts (live visitor count with 5-second refresh)

**Why React Flow for the CRM workflow builder?**
The automation workflow builder needs a drag-and-drop canvas where marketing managers connect "trigger → condition → action" nodes visually. React Flow is the industry standard (used by Retool, n8n, Zapier). MUI Paper + Card components style the individual nodes — the canvas itself is React Flow.

```tsx
// MUI-styled workflow node inside React Flow
<Paper elevation={2} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'primary.light' }}>
  <Stack direction="row" alignItems="center" spacing={1}>
    <EmailIcon color="primary" />
    <Typography variant="body2">Send Email</Typography>
  </Stack>
</Paper>
```

---

### 🗂️ State Management: Redux Toolkit + RTK Query

```
@reduxjs/toolkit: 2.2.x    (matches existing mobile app pattern)
react-redux: 9.1.x
```

**Why Redux Toolkit over plain Redux (existing pattern)?**

The existing web/admin apps use Redux + Redux Thunk manually. RTK simplifies this significantly:
- `createSlice` replaces separate actions + reducers files
- RTK Query replaces manual `axios + loading/error state` boilerplate
- RTK Query built-in features: automatic caching, background refetching, polling (for live analytics), request deduplication

The marketing analytics dashboard shows live visitor counts — RTK Query's `pollingInterval` handles this cleanly without manual `setInterval` + Redux dispatch patterns.

---

### 📧 Email Builder: Unlayer (React)

```
@unlayer/react: 2.2.x
```

**Why Unlayer?**
- The industry-standard embedded email builder (used by Mailchimp competitors)
- Drag-and-drop blocks (image, text, button, divider, social links)
- Exports `json_design` (for storage) + compiled `html_content` (for sending)
- 100+ responsive email templates included
- Works offline — no external API calls during editing
- Licence: one-time fee for white-label embedding

---

### 🔄 Form Handling

```
react-hook-form: 7.54.x   (already in existing web app — exact same)
zod: 3.22.x               (TypeScript-first validation — better than Yup for TS)
@hookform/resolvers: 3.3.x
```

**Why Zod over Yup?**
The existing app uses Yup. Zod is recommended for the marketing platform because:
- TypeScript-first — schema types are automatically inferred
- `z.infer<typeof schema>` gives you the TypeScript type for free
- Better error messages
- 40% smaller bundle

---

### 📅 Date/Time

```
date-fns: 3.6.x           (replaces moment.js — 6KB vs 67KB)
date-fns-tz: 3.1.x        (timezone support)
```

**Why date-fns over Moment (existing)?**
Moment is 67KB minified and deprecated. date-fns is tree-shakeable (you only import what you use), immutable (no mutation bugs), and TypeScript-native.

---

## Backend Technologies

### ⚙️ Runtime & Framework

```
Node.js: 20.x LTS      (existing platform requirement)
Express: 4.18.x        (matches existing — 4.16.x in Login API, 4.17.x in Booking)
Babel: 7.24.x          (full setup — matches Booking + Payment APIs exactly)
  @babel/core
  @babel/cli
  @babel/node
  @babel/preset-env
  @babel/plugin-transform-runtime
  @babel/plugin-proposal-optional-chaining
  @babel/register
nodemon: 3.0.x         (development auto-reload — matches existing)
```

**Why Express over Fastify/Hapi/NestJS?**
Every single existing microservice uses Express. Switching introduces:
- New team knowledge requirement
- Different middleware patterns
- Different error handling conventions
- Different testing approaches

Express 4.x is battle-tested, the team already knows it, and the performance difference is negligible for API servers (Node.js is not CPU-bound for this use case). Fastify is ~2x faster in benchmarks but that gap disappears when your bottleneck is database queries and AI API calls — which it always is.

**Why Babel?**
Same reason as existing Booking and Payment APIs — allows ES Module syntax (`import/export`), optional chaining (`?.`), async/await without polyfills, and modern JavaScript features in Node.js.

---

### 🗄️ ORM: Sequelize

```
sequelize: 6.37.x          (matches existing — 6.3.5 to 6.16.1 range)
sequelize-cli: 6.6.x       (database migrations — matches Booking API)
sequelize-paginate: 1.1.x  (pagination — already used everywhere)
mysql: 2.5.x             (MySQL/PostgreSQL driver — same as existing)
mysql2: 3.9.x              (MySQL driver fallback — same as Booking/Payment)
```

**Why Sequelize over Prisma/TypeORM/Drizzle?**

The entire platform (Login, Booking, Payment, SOC) uses Sequelize. Every model file, every association, every migration follows the Sequelize pattern. Switching would mean:
- Rewriting shared model code
- Different migration syntax
- Different query builder syntax
- Team retraining

Sequelize's `findAll`, `findOne`, `create`, `update` with `where: { deleted_at: null }` is the established convention. The `sequelize-paginate` plugin is already wired everywhere for consistent `{ docs, totalDocs, page, totalPages }` responses.

---

### ⚡ Cache & Background Jobs

```
redis: 4.6.x               (exact match — existing uses 4.6.10)
bull: 4.8.x                (exact match — existing uses 4.8.5)
node-cron: 3.0.x           (exact match — existing uses 3.0.2)
```

**Why Bull over BullMQ?**
The existing platform uses Bull 4.x. BullMQ is the newer v2 but requires Redis Streams and has different API syntax. Sticking with Bull 4.x means:
- Same `initQueue()` helper can be copied from `_helpers/redis.js`
- Same job monitoring tooling (Bull Board)
- Zero migration risk

**All queues prefixed `mkt-`** to coexist on the same Redis instance without colliding with existing LicensedTaxi queues.

---

### 🔐 Authentication

```
passport: 0.6.x            (matches Payment API — newest existing version)
passport-jwt: 4.0.x        (exact match)
passport-saml: 3.2.x       (NEW — SAML 2.0 SSO for enterprise/agency clients)
openid-client: 5.6.x       (NEW — OIDC SSO for enterprise/agency clients)
passport-google-oauth20: 2.0.x  (matches Booking API)
jsonwebtoken: 9.0.x        (BUMPED from existing 8.5.x — 8.x has known CVEs: CVE-2022-23529, CVE-2022-23539, CVE-2022-23540)
bcrypt: 5.1.x              (BUMPED from existing 5.0.x — minor security fixes)
@simplewebauthn/server: 10.x  (NEW — WebAuthn / Passkey support for 2FA)
otplib: 12.0.x             (NEW — TOTP code generation for Google Authenticator / Authy)
rate-limit-redis: 4.2.x    (NEW — replaces in-process store; required across multiple Node instances)
hibp: 14.x                 (NEW — Have I Been Pwned API for password breach checks)
```

**Why bump `jsonwebtoken` from 8.x → 9.x?**
The existing platform's `8.5.1` has known CVEs allowing signature bypass under specific configurations. The 9.x major release fixes these and removes weak default algorithms. The breaking change is minor (some option names changed); migration takes ~1 day per service. Continuing to "match existing" perpetuates known security debt — fix it now in the marketing platform and back-port to LicensedTaxi when convenient.

**Why same JWT secret as existing platform?**
Using the same `JWT_SECRET` environment variable means existing LicensedTaxi admin accounts can log into the marketing platform without a separate login — Single Sign-On for free. The `ExtractJwt.fromAuthHeaderAsBearerToken()` pattern is identical across all existing services.

**Future path — asymmetric signing (RS256):** When key rotation becomes important (post-launch), migrate from HS256 (shared secret) to RS256 (each platform has its own private key + shared public key). Both 8.x and 9.x support this; the marketing platform should be built ready for this transition. See `security.md` → "Key Management".

---

### 🔍 Web Scraping & Browser Automation

```
puppeteer: 24.11.x         (exact match — already in Booking API)
puppeteer-core: 24.11.x    (lighter version for production — Chrome not bundled)
cheerio: 1.0.x             (jQuery-like DOM parsing — fast, server-side)
playwright: 1.44.x         (fallback for Cloudflare-protected sites)
```

**Why Puppeteer?**
Already installed and proven in the Booking API for PDF generation. For the SEO crawler:
- Cheerio handles static HTML pages (fast, low memory)
- Puppeteer handles JavaScript-rendered pages (Next.js, React, Angular sites)
- Two-tier strategy: try Cheerio first → fallback to Puppeteer if JS rendering detected

**Why add Playwright?**
Some competitor sites are protected by Cloudflare bot detection, which blocks headless Chromium (Puppeteer). Playwright with Firefox or WebKit bypasses these. Used only for the competitor intelligence module, not the core crawler.

---

### 📝 Validation

```
joi: 17.13.x               (exact match — existing uses 17.3.0)
```

Every existing API route uses Joi for request validation. Same pattern: `Joi.object({ field: Joi.string().required() })`.

---

### 🔧 Utilities

```
axios: 1.6.x               (matches web app — existing API uses 0.26.1)
morgan: 1.10.x             (HTTP request logging — exact match)
helmet: 8.0.x              (security headers — exact match)
cors: 2.8.x                (CORS — exact match)
express-rate-limit: 7.5.x  (rate limiting — exact match)
multer: 1.4.x              (file uploads — exact match)
uuid: 9.0.x                (UUID generation — existing uses 8.3.1)
body-parser: 1.20.x        (request parsing — exact match)
cookie-parser: 1.4.x       (cookies — exact match)
moment: 2.30.x             (date handling — matches existing)
moment-timezone: 0.5.x     (timezone — matches existing)
nodemailer: 6.10.x         (email sending — exact match)
nodemailer-express-handlebars: 6.1.x  (email templates — matches existing)
crypto-js: 4.2.x           (AES encryption — exact match)
validator: 13.12.x         (string validation — exact match)
node-fetch: 3.3.x          (HTTP fetch — matches existing)
```

---

### 🔍 Search Engine: ❌ NOT in v1 (deferred to Phase 5+)

> **Decision (2026-05-28):** Elasticsearch is **removed from v1** of the platform. Use database-native search until volume justifies it.

**Why removed:**
- Adds operational complexity (separate cluster, sync pipeline, mapping migrations)
- Cost: £200+/month managed; £100+/month self-hosted
- Premature for Phase 1-4 customer volumes
- Database-native search handles the v1 use cases adequately

**What we use instead (v1):**

| Use case | v1 solution | Adequate up to |
|---|---|---|
| Keyword search within a workspace (≤50k keywords) | MySQL `FULLTEXT INDEX` on `seo_keywords.keyword` / PostgreSQL `tsvector` GIN index | ~500k keywords per workspace |
| Contact CRM search by name/email/company | MySQL `FULLTEXT` / Postgres `tsvector` + Sequelize `iLike` filters | ~100k contacts per workspace |
| Content library search | MySQL `FULLTEXT` on `content_pieces.title + body` | ~10k content pieces per workspace |
| Competitor ad search | MySQL `LIKE` (low volume — competitor data is small) | Indefinitely |

**Schema additions for v1:**
```sql
-- MySQL
ALTER TABLE seo_keywords ADD FULLTEXT INDEX ft_keyword (keyword);
ALTER TABLE crm_contacts ADD FULLTEXT INDEX ft_contact (full_name, email, company_name);
ALTER TABLE content_pieces ADD FULLTEXT INDEX ft_content (title);

-- PostgreSQL (production)
CREATE INDEX idx_keywords_search ON seo_keywords USING gin(to_tsvector('english', keyword));
CREATE INDEX idx_contacts_search ON crm_contacts USING gin(to_tsvector('english',
  coalesce(full_name,'') || ' ' || coalesce(email,'') || ' ' || coalesce(company_name,'')));
```

**When to add Elasticsearch back (Phase 5+ trigger):**
- A workspace has >500k contacts AND search latency exceeds 500ms (P95)
- Fuzzy matching demanded ("markteing" → "marketing" — typo tolerance)
- Faceted search on >5 dimensions simultaneously
- Aggregations over text fields (e.g., "top 10 most common job titles")

If/when added, the dependency `@elastic/elasticsearch: 8.13.x` slots back in. Until then, **don't introduce the complexity**.

---

### 📊 Analytics: ClickHouse

```
@clickhouse/client: 1.0.x
```

**Why ClickHouse?**
A business running 10 active campaigns generates ~10,000 analytics events per day. With 1,000 workspaces, that's 10 million rows/day. MySQL/PostgreSQL InnoDB handles transactional workloads beautifully but struggles with analytical queries over hundreds of millions of rows.

ClickHouse is a columnar database built for exactly this: `GROUP BY utm_source WHERE workspace_id = ? AND created_at > ?` over 500 million rows in **under 1 second**. Used by Cloudflare, Uber, and Bloomberg for exactly this pattern.

**Dual-write strategy:**
- All events write to both MySQL/PostgreSQL (for operational queries — last 30 days) and ClickHouse (for analytics — all history)
- Dashboard queries go to ClickHouse
- CRM contact activity queries go to MySQL/PostgreSQL

---

## Database Layer

### Primary: MySQL/PostgreSQL (shared with existing platform)

```
mysql: 2.5.x
mysql2: 3.9.x
sequelize: 6.37.x
```

**Schema isolation:** All marketing tables prefixed `mkt_` — zero collision with existing LicensedTaxi tables (`a_users`, `bookings`, etc.).

**Shared instance in Phase 1–3** — no new database server needed. The existing MySQL/PostgreSQL server handles both platforms. Separate instance in Phase 4 when query volume warrants it.

### Time-Series: ClickHouse

```
@clickhouse/client: 1.0.x
```

Separate server. Only analytics events go here. Partitioned by month. Materialized views for hourly aggregations power the real-time dashboard without recomputing on every page load.

### Search: ❌ Database-native FULLTEXT in v1

Elasticsearch is deferred to Phase 5+. Use MySQL `FULLTEXT INDEX` (dev) / PostgreSQL `tsvector` GIN (prod) for all in-workspace search. See "Search Engine" section above for thresholds + schema.

Separate server. Indexes for: keywords, content pieces, contacts, competitor ads, social posts. Auto-synced from MySQL/PostgreSQL via Bull queue job after every write.

### Cache: Redis (shared with existing platform)

```
redis: 4.6.x
```

**Shared Redis instance** — all marketing keys prefixed `mkt:`. Existing LicensedTaxi keys remain untouched. Used for:
- Session tokens
- API rate limit counters (per workspace)
- Cached analytics summaries (5-minute TTL)
- Bull job queues

---

## AI & Machine Learning

### 🤖 AI Provider Abstraction (3 Models)

```javascript
// The AI Provider service — single interface, swap models anytime
// Located: content-ai/_services/ai-provider.service.js

const providers = {
  openai:  openai: 5.x (BUMPED from existing 4.91.x — Booking API can stay on 4.x; new platform uses 5.x for latest model parameters, structured outputs, streaming improvements),        // GPT-4o, GPT-4o-mini
  claude:  @anthropic-ai/sdk: 0.24.x,  // Claude 3.5 Sonnet, Claude 3 Haiku
  gemini:  @google/generative-ai: 0.14.x  // Gemini 1.5 Pro, Gemini 1.5 Flash
}
```

**Model Selection by Task:**

| Task | Model | Why |
|---|---|---|
| SEO content writing (long-form) | **GPT-4o** | Best writing quality, follows SEO instructions precisely |
| Ad copy (concise, punchy) | **Claude 3.5 Sonnet** | Superior at short persuasive writing |
| Keyword research (structured JSON) | **GPT-4o** | Reliable structured output with JSON mode |
| Competitor analysis (research) | **Gemini 1.5 Pro** | 1M token context — can analyze entire competitor website |
| Social media captions (bulk) | **GPT-4o-mini** | Cheap, fast, good enough for social posts |
| Sentiment analysis | **GPT-4o-mini** | Accurate, 100x cheaper than GPT-4o for classification |
| Email subject lines | **Claude 3 Haiku** | Fast, cheap, excellent for A/B variant generation |
| One-Click Capture (11 steps) | **GPT-4o** (orchestrator) + **GPT-4o-mini** (sub-tasks) | Balance quality vs. cost |
| Brand voice training | **GPT-4o** | Needs deep language understanding |

**Why 3 providers?**
- **Redundancy** — if OpenAI has an outage, switch to Claude automatically
- **Cost optimisation** — route cheap tasks to cheaper models
- **Quality routing** — use the best model for each specific task
- **Rate limit management** — distribute heavy workloads across providers

**OpenAI already in use:** `openai: 4.91.1` in the Booking API for KYC document processing. Same SDK, same pattern.

---

### 🎤 Speech & Transcription: OpenAI Whisper

```
openai: 5.x (BUMPED from existing 4.91.x — Booking API can stay on 4.x; new platform uses 5.x for latest model parameters, structured outputs, streaming improvements)  (Whisper is part of the OpenAI SDK — no extra package)
```

**Used for:**
- YouTube/TikTok video → auto-captions
- Podcast episode → transcript → show notes
- Video transcript → SEO blog post
- Shorts captions (critical for mobile silent viewing)

**Why Whisper over AssemblyAI / Deepgram?**
Already paying for OpenAI. Whisper via the OpenAI API is the same model that powers ChatGPT voice. For marketing content, accuracy > 95% is required — Whisper delivers 97%+ in English.

---

### 🖼️ Image Generation: OpenAI DALL-E 3

```
openai: 5.x (BUMPED from existing 4.91.x — Booking API can stay on 4.x; new platform uses 5.x for latest model parameters, structured outputs, streaming improvements)  (DALL-E 3 via the OpenAI SDK Images API)
```

**Used for:**
- Ad creative generation (4 variants per campaign)
- YouTube thumbnail concepts
- Social media graphics
- Blog post hero images

**Why DALL-E 3 over Midjourney?**
DALL-E 3 has a proper API with programmatic access. Midjourney requires Discord interaction — unusable in an automated pipeline. DALL-E 3 accepts text prompts with brand colour hex codes and style instructions, returns image URLs within 15 seconds.

---

### 📊 OCR: Tesseract.js

```
tesseract.js: 6.0.x  (already in Booking API — exact same version)
```

**Used for:**
- Competitor ad screenshot text extraction
- Price monitoring (when prices are in images, not text)
- Logo extraction from competitor websites

---

## Third-Party APIs & Integrations

### 🔍 SEO Data: DataForSEO

```
No npm package — direct HTTP API calls via axios
DataForSEO REST API: https://api.dataforseo.com/v3/
Authentication: Basic Auth (login:password base64 encoded)
```

**Why DataForSEO over SEMrush API + Ahrefs API + Moz API separately?**

| Data | SEMrush | Ahrefs | Moz | DataForSEO |
|---|---|---|---|---|
| Keyword Research | ✅ $450/mo | ✅ $399/mo | ✅ $299/mo | ✅ $50/mo pay-as-you-go |
| SERP Rankings | ✅ | ✅ | ✅ | ✅ |
| Backlink Analysis | ✅ | ✅ | ✅ | ✅ |
| Technical SEO | ✅ | ❌ | ✅ | ✅ |
| **Total Cost** | **$450/mo** | **$399/mo** | **$299/mo** | **~$50-200/mo** |

DataForSEO is a data provider, not a tool. It costs per API call, not per seat. A 1,000-workspace platform would pay $50-200/month for DataForSEO vs. $1,000+/month for enterprise SEMrush API access.

**DataForSEO APIs used:**
- Keywords Data API (Google Keyword Planner data)
- SERP API (live Google search results)
- Backlinks API (Ahrefs-equivalent backlink database)
- Domain Analytics (competitor keyword rankings)
- On-Page API (technical SEO scores per URL)
- Business Data API (Google My Business listings)

---

### 📧 Email Delivery: SendGrid

```
@sendgrid/mail: 8.1.x
@sendgrid/client: 8.1.x
```

**Why SendGrid?**
- 100 emails/day free
- Transactional + marketing in one platform (no mixing Mailchimp + Postmark)
- Webhooks for bounce, complaint, open, click events
- Sub-user accounts (for white-label agency clients to use their own sending domain)
- Dedicated IP options for high-volume senders
- 99.9% deliverability on managed IPs

---

### 📱 Social Media APIs

```
facebook-nodejs-business-sdk: 20.0.x  (Meta Graph API — Facebook + Instagram)
twitter-api-v2: 1.17.x               (Twitter/X API v2)
linkedin-api-client: 1.0.x           (LinkedIn Marketing API v2)
tiktok-business-api-sdk: latest      (TikTok for Business API)
googleapis: 140.x                    (YouTube Data API v3 + Google Ads API)
```

**What each does:**

| SDK | Capabilities |
|---|---|
| `facebook-nodejs-business-sdk` | Post to Pages, schedule posts, create/manage ad campaigns, Instagram Graph API, Ad Library, Meta Pixel events, read insights |
| `twitter-api-v2` | Post tweets, schedule, read mentions/timeline, Filtered Stream API (real-time brand monitoring), Twitter Ads |
| `linkedin-api-client` | Post to Company Pages, LinkedIn Marketing API (sponsored content, Lead Gen Forms), profile data |
| `tiktok-business-api-sdk` | TikTok for Business campaigns, content scheduling, analytics, TikTok Pixel |
| `googleapis` | YouTube channel management, video upload, analytics, Google Ads campaigns, Google Business Profile |

---

### 💰 Payments: Stripe + Stripe Connect

```
stripe: 17.4.x   (exact match — existing Payment API)
```

**Two modes:**
1. **Stripe Subscriptions** — billing users for platform plans (Free/Pro/Agency)
2. **Stripe Connect** — paying affiliates their earned commissions (Express accounts)

Stripe Connect Express allows affiliates to receive bank transfers to their own accounts without the platform holding money. The platform charges a small platform fee on each payout.

---

### 📞 SMS: Twilio

```
twilio: 5.3.x  (matches Booking API — existing uses 5.3.4)
```

Already integrated in the SOC service. The marketing platform reuses the same Twilio account for SMS campaigns. Separate short codes / sender IDs for marketing vs. transactional messages (regulatory requirement in most countries).

---

### 🔔 Push Notifications: Firebase Admin

```
firebase-admin: 12.1.x  (exact match — existing SOC service)
```

Already integrated. FCM (Firebase Cloud Messaging) handles both app push notifications (to the existing LicensedTaxi mobile app) and web push notifications via service workers.

---

### 📺 WhatsApp: 360dialog

```
No npm package — REST API calls via axios
360dialog Cloud API: https://waba.360dialog.io/v1/
```

**Why 360dialog over Twilio WhatsApp?**
360dialog is the largest WhatsApp Business Solution Provider (BSP) in Europe. Key advantages:
- Lower cost per message than Twilio's WhatsApp pricing
- Direct WhatsApp Business API access (not resold)
- Pre-approved message templates library
- Better compliance tooling for GDPR

WhatsApp requires opt-in — broadcast only to users who have explicitly subscribed. The platform manages opt-in lists, message templates (must be pre-approved by Meta), and opt-out handling.

---

### ☁️ File Storage: Pluggable Driver — AWS S3 OR Local Disk

> ✅ **Decision (2026-05-28):** Storage is **pluggable via `STORAGE_DRIVER` env var**. Same code runs on cloud (S3) or on-premise (local disk). See **[storage-strategy.md](storage-strategy.md)** for the full design.

```
@aws-sdk/client-s3: 3.914.x          (only when STORAGE_DRIVER=s3)
@aws-sdk/s3-request-presigner: 3.x   (only when STORAGE_DRIVER=s3)
node:fs/promises                      (built-in, used by local driver)
```

**Storage abstraction** lives in `packages/shared-storage`. Every service that handles files imports `storage` from this package and never calls AWS SDK directly:

```typescript
import { storage } from '@marketing/shared-storage';

await storage.upload(buffer, `workspace/${ws}/content/image.png`, { contentType: 'image/png' });
const url = await storage.getSignedDownloadUrl(key, { expiresIn: 900 });
await storage.deletePrefix(`workspace/${ws}/`);   // for workspace deletion + RTBF
```

**Two drivers:**

| Driver | Env | Use case |
|---|---|---|
| `s3` | `STORAGE_DRIVER=s3` | Cloud deploy: AWS S3, Cloudflare R2, MinIO, Backblaze B2, Wasabi (all S3-compatible) |
| `local` | `STORAGE_DRIVER=local` | On-premise / single-server / local dev: files on disk, served by Nginx with HMAC signature verification |

**What gets stored** (across both drivers):
- Email template images
- AI-generated ad creatives (DALL-E)
- Uploaded influencer contract documents
- Podcast audio files
- Profile photos / agency logos
- DSAR export ZIPs
- Data import CSVs (HubSpot/Mailchimp/Klaviyo)
- Session recordings (analytics)
- PDF reports
- Brand asset library

**Path convention:** every file path starts with `workspace/<workspace_id>/` — enforced by the storage service. Per-workspace deletion (cancellation + GDPR RTBF) is a single recursive `deletePrefix()` call.

**Recommended driver per environment:**

| Environment | Recommended | Why |
|---|---|---|
| Local dev | `local` | No AWS creds needed; fast iteration |
| Staging | `s3` (AWS) | Match production architecture |
| **Production (default)** | **`s3` (Cloudflare R2)** | Zero egress fees; cheap; S3-compatible |
| Enterprise on-prem | `local` (NFS/EFS for HA) | Data residency requirement |
| EU GDPR-strict | `s3` (AWS eu-west-2) | EU data residency |

---

### 🗓️ PR Distribution: PR Newswire

```
No npm package — REST API via axios
PR Newswire API: https://api.prnewswire.com
```

**Why PR Newswire?**
Distributes press releases to 4,000+ media outlets, journalists, and news sites. Generates real backlinks from DA 60-90 news sites. One press release can earn 50-200 backlinks — better ROI than manual outreach.

**Alternative:** Business Wire API for financial/investor press releases.

---

### 📊 Website Analytics: Custom Tracking

```javascript
// Tiny tracking script (~2KB gzipped) embedded on customer websites
// Deployed via CDN (Cloudflare)
// Captures: page views, clicks, form submits, custom events
// Sends to: POST /api/v1/analytics/track
// Dual-write: MySQL/PostgreSQL (operational) + ClickHouse (analytical)
```

**Why build instead of using Google Analytics?**
- Google Analytics data belongs to Google, not the customer
- GDPR: GA requires cookie consent banners; first-party analytics doesn't need consent in many jurisdictions
- No sampling — GA samples data above 500k sessions/day; ClickHouse handles billions of events
- Revenue attribution — only possible with custom tracking tied to your own purchase data
- White-label: the analytics shown to white-label agency clients is branded as your platform, not Google

---

## Infrastructure & DevOps

### 🐳 Docker & Docker Compose

```yaml
# docker-compose.yml — all services
services:
  nginx:            # Reverse proxy
  web:              # React + Vite SPA (static) :3000
  marketing-site:   # Astro SSG (static)         :3001 (dev only; static in prod)
  landing-renderer: # Express SSR                :3200
  marketing-core:   # Auth + billing            :3100
  seo-engine:       # SEO                       :3101
  content-ai:       # AI content                :3102
  campaign-manager: # PPC + campaigns           :3103
  analytics-engine: # Analytics                 :3104
  social-hub:       # Social media              :3105
  email-hub:        # Email + SMS + push        :3106
  intelligence:     # Competitor intel          :3107
  affiliate-hub:    # Affiliate program         :3108
  influencer-hub:   # Influencer CRM            :3109
  crm-automation:   # Marketing CRM             :3110
  media-hub:        # YouTube + video           :3111
  mysql:          # Shared with existing      :3306
  redis:            # Shared with existing      :6379
  # elasticsearch:  # Deferred to Phase 5+ — database-native FULLTEXT covers v1
  clickhouse:       # Analytics DB              :8123
  # kibana:         # Deferred with Elasticsearch
```

---

### 🌐 Nginx

```nginx
# Reverse proxy configuration
# SSL termination at Nginx level
# Rate limiting at Nginx level (before hitting Node.js)
# Load balancing ready (add more Node.js instances per service)

upstream marketing_core    { server marketing-core:3100; }
upstream seo_engine        { server seo-engine:3101; }
# ... all 12 services

server {
  location /api/v1/core/          { proxy_pass http://marketing_core; }
  location /api/v1/seo/           { proxy_pass http://seo_engine; }
  # ... all routes
  
  # Rate limiting — 100 req/min per IP for unauthenticated
  limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;
  
  # Gzip compression
  gzip on;
  gzip_types application/json;
}
```

---

### 🔄 CI/CD: GitHub Actions

```yaml
# .github/workflows/deploy.yml
# On push to main:
# 1. Run all Jest tests
# 2. TypeScript type check
# 3. ESLint
# 4. Build apps/web (Vite), apps/marketing-site (Astro), apps/landing-renderer (tsc)
# 5. Build Docker images
# 6. Push to container registry
# 7. Deploy to production (rolling update)
```

---

### 📦 Package Manager & Monorepo

```
yarn: 4.x (Berry)
workspaces: all packages in monorepo managed together
turbo: 2.x  (Turborepo — parallel builds, build caching)
```

**Why Turborepo?**
Running `yarn build` in a monorepo without Turborepo builds all 12 services sequentially (slow). Turborepo:
- Builds services in parallel
- Caches build outputs — unchanged services skip rebuild (50-80% faster)
- Detects which services changed and only rebuilds those

---

### 🔍 Monitoring: Sentry

```
@sentry/node: 8.x    (backend error tracking)
@sentry/react: 8.x   (frontend error tracking for React SPA)
@sentry/astro: 8.x   (frontend error tracking for marketing site)
```

**What Sentry catches:**
- Uncaught exceptions in all 12 Node.js services
- Failed AI API calls (OpenAI, Claude, Gemini errors)
- Database connection errors
- Bull queue job failures
- React SPA client-side errors with full stack trace + user context

---

### 📊 Load Testing: k6

```
k6: latest  (CLI tool — not an npm package)
```

**Test targets:**
- `POST /api/v1/analytics/track` — must sustain 1,000 events/sec (ClickHouse writes)
- `POST /campaigns/one-click-capture` — must complete in < 120 seconds end-to-end
- `GET /api/v1/seo/keywords` — workspace with 50,000 keywords loads in < 500ms

---

## Security Stack

### Full Security Layer (identical to existing platform)

```javascript
// Copied from existing /api/login/middleware/ — same code, zero deviation

helmet: 8.0.x           // HTTP security headers (exact match)
express-rate-limit: 7.5.x  // Rate limiting per IP + per workspace (exact match)
cors: 2.8.x             // CORS allowlist (exact match)
bcrypt: 5.0.x           // Password hashing (exact match)
jsonwebtoken: 8.5.x     // JWT signing + verification (exact match)
crypto-js: 4.2.x        // AES-256 payload encryption (exact match)
```

**Custom middleware copied from existing:**
- `encryptionMiddleWare.js` — AES encryption: detects `X-Encrypted` header, decrypts request body
- `validateSecurityHeaders.js` — validates `X-Device-ID` (min 10 chars), sets `X-Frame-Options: DENY`
- `corsMiddleware.js` — allowlists marketing domain + existing LicensedTaxi domains

**Additional marketing-specific security:**
- **Webhook signature verification** — validate Stripe, SendGrid, Facebook, Twitter webhook signatures before processing
- **OAuth state parameter** — CSRF protection for social platform OAuth flows
- **API key hashing** — affiliate tracking API keys stored as bcrypt hash, never plaintext
- **Rate limiting per workspace tier** — Free: 100 API calls/min, Pro: 1000/min, Agency: 10000/min
- **Content Security Policy (CSP)** — strict CSP for the React SPA + Astro site (no XSS via user content)

---

## Real-Time & Messaging

### WebSocket: Socket.IO (existing pattern)

```
socket.io: 4.8.x         (exact match — existing SOC service)
socket.io-client: 4.8.x  (exact match — existing web app)
```

**Used in marketing platform for:**
- Live analytics dashboard — visitor count updates every 5 seconds
- One-Click Capture progress — stream AI generation steps to frontend
- Social listening feed — real-time mention alerts
- Campaign status updates — "Your Google Ads campaign is now live"

Actually, One-Click Capture uses **Server-Sent Events (SSE)** not WebSocket because it's unidirectional (server → client only). SSE is simpler, automatically reconnects, and works over HTTP/2. WebSocket is used for bidirectional real-time features.

---

### Server-Sent Events (SSE)

```javascript
// Built into Node.js/Express — no npm package needed
// Used for One-Click Market Capture live progress streaming

res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');

// Each AI step completion streams an event:
res.write(`data: ${JSON.stringify({ step: 2, label: 'SEO Strategy', done: true })}\n\n`);
```

---

## Testing Stack

```
jest: 29.7.x                         (matches existing — exact same)
@testing-library/react: 16.x         (React component testing)
@testing-library/jest-dom: 6.x       (DOM assertion matchers)
@testing-library/user-event: 14.x    (simulate user interactions)
supertest: 7.x                       (HTTP API integration testing)
msw: 2.x                             (Mock Service Worker — mock API calls in tests)
```

**Testing strategy per layer:**

| Layer | Tool | What it tests |
|---|---|---|
| Utility functions | Jest | Pure functions — keyword scoring, content scoring, attribution calculations |
| API routes | supertest | `POST /campaigns` creates DB record, returns correct response |
| Services | Jest + mocks | `content-ai.service.generateBlogPost()` calls OpenAI with correct prompt |
| React components | React Testing Library | Form submission, error states, loading states |
| E2E workflows | supertest chains | One-Click Capture: 11-step pipeline creates all expected DB records |
| Performance | k6 | `/track` endpoint sustains 1,000 req/sec |

---

## Complete Package List

### Per Service (copy this exact `package.json` base for all 12 services)

```json
{
  "name": "service-name",
  "version": "1.0.0",
  "scripts": {
    "start": "node -r @babel/register src/app.js",
    "dev": "nodemon --exec 'node -r @babel/register' src/app.js",
    "build": "babel src -d dist",
    "test": "jest --coverage",
    "migrate": "sequelize-cli db:migrate",
    "migrate:undo": "sequelize-cli db:migrate:undo"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.914.0",
    "@babel/runtime": "^7.24.0",
    "axios": "^1.6.0",
    "bcrypt": "^5.0.1",
    "body-parser": "^1.20.0",
    "bull": "^4.8.5",
    "cookie-parser": "^1.4.6",
    "cors": "^2.8.5",
    "crypto-js": "^4.2.0",
    "express": "^4.18.0",
    "express-rate-limit": "^7.5.0",
    "helmet": "^8.0.0",
    "joi": "^17.13.0",
    "jsonwebtoken": "^8.5.1",
    "mysql2": "^3.9.6",
    "pg": "^8.11.0",
    "pg-hstore": "^2.3.4",
    "moment": "^2.30.0",
    "moment-timezone": "^0.5.45",
    "morgan": "^1.10.0",
    "multer": "^1.4.5",
    "mysql2": "^3.9.6",
    "node-cron": "^3.0.3",
    "node-fetch": "^3.3.2",
    "nodemailer": "^6.10.0",
    "nodemailer-express-handlebars": "^6.1.0",
    "passport": "^0.6.0",
    "passport-jwt": "^4.0.0",
    "redis": "^4.6.10",
    "sequelize": "^6.37.0",
    "sequelize-paginate": "^1.1.6",
    "uuid": "^9.0.0",
    "validator": "^13.12.0"
  },
  "devDependencies": {
    "@babel/cli": "^7.24.0",
    "@babel/core": "^7.24.0",
    "@babel/node": "^7.23.0",
    "@babel/plugin-proposal-optional-chaining": "^7.21.0",
    "@babel/plugin-transform-runtime": "^7.24.0",
    "@babel/preset-env": "^7.24.0",
    "@babel/register": "^7.23.0",
    "jest": "^29.7.0",
    "nodemon": "^3.0.3",
    "supertest": "^7.0.0"
  }
}
```

### Service-Specific Additional Packages

```
marketing-core:
  + stripe: ^17.4.0

seo-engine:
  + puppeteer-core: ^24.11.0
  + cheerio: ^1.0.0
  # @elastic/elasticsearch: deferred to Phase 5+
  + xml2js: ^0.6.0            (sitemap parsing)
  + robots-parser: ^3.0.1     (respect robots.txt)

content-ai:
  + openai: ^4.91.1           (already in booking — exact match)
  + @anthropic-ai/sdk: ^0.24.0
  + @google/generative-ai: ^0.14.0
  + tesseract.js: ^6.0.0      (exact match — already in booking)

campaign-manager:
  + google-ads-api: ^17.0.0   (Google Ads API v17)
  + facebook-nodejs-business-sdk: ^20.0.0

analytics-engine:
  + @clickhouse/client: ^1.0.0
  # @elastic/elasticsearch: deferred to Phase 5+

social-hub:
  + twitter-api-v2: ^1.17.0
  + linkedin-api-client: ^1.0.0
  + googleapis: ^140.0.0      (YouTube + Google Business)

email-hub:
  + @sendgrid/mail: ^8.1.0
  + @sendgrid/client: ^8.1.0
  + twilio: ^5.3.4            (exact match — already in booking)
  + firebase-admin: ^12.1.0   (exact match — already in SOC)

intelligence:
  + puppeteer: ^24.11.0       (exact match — already in booking)
  + playwright: ^1.44.0       (Cloudflare bypass)
  + cheerio: ^1.0.0

media-hub:
  + openai: ^4.91.1           (Whisper + DALL-E)
  + googleapis: ^140.0.0      (YouTube Data API v3)
  + fluent-ffmpeg: ^2.1.3     (video metadata extraction)
```

### Dashboard (`apps/web/package.json`) — React + Vite + TypeScript

```json
{
  "name": "@marketing/web",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint . --max-warnings 0",
    "type-check": "tsc -b --noEmit",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.26.0",

    "@reduxjs/toolkit": "^2.2.0",
    "react-redux": "^9.1.0",

    "@mui/material": "^6.4.4",
    "@mui/icons-material": "^6.4.8",
    "@mui/x-data-grid": "^7.9.0",
    "@mui/x-date-pickers": "^7.28.3",
    "@mui/x-date-pickers-pro": "^7.28.3",
    "@mui/x-charts": "^7.0.0",
    "@mui/lab": "^6.0.0-beta",
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.0",

    "framer-motion": "^12.4.3",
    "lucide-react": "^0.483.0",

    "recharts": "^2.12.0",
    "@xyflow/react": "^12.0.0",

    "react-hook-form": "^7.54.0",
    "zod": "^3.22.0",
    "@hookform/resolvers": "^3.3.0",

    "@unlayer/react": "^2.2.0",

    "date-fns": "^3.6.0",
    "date-fns-tz": "^3.1.0",
    "dayjs": "^1.11.9",

    "axios": "^1.6.0",
    "socket.io-client": "^4.8.1",

    "crypto-js": "^4.2.0",
    "uuid": "^9.0.0",

    "notistack": "^3.0.1",
    "react-dropzone": "^14.3.8",
    "react-window": "^1.8.10",
    "@sentry/react": "^8.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@types/node": "^20.0.0",
    "@types/crypto-js": "^4.2.0",
    "@types/uuid": "^9.0.0",
    "@types/react-window": "^1.8.8",
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^5.4.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "@vitest/coverage-v8": "^2.0.0",
    "@playwright/test": "^1.46.0",
    "eslint": "^8.0.0",
    "eslint-plugin-react": "^7.34.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-config-prettier": "^9.0.0",
    "prettier": "^3.2.0",
    "jsdom": "^24.0.0"
  }
}
```

### Marketing Site (`apps/marketing-site/package.json`) — Astro

```json
{
  "name": "@marketing/marketing-site",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview"
  },
  "dependencies": {
    "astro": "^4.16.0",
    "@astrojs/sitemap": "^3.0.0",
    "@astrojs/mdx": "^3.0.0",
    "@astrojs/rss": "^4.0.0",
    "@astrojs/react": "^3.0.0",
    "@sentry/astro": "^8.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@types/react": "^18.3.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0"
  }
}
```

### Landing Page Renderer (`apps/landing-renderer/package.json`) — Express SSR

```json
{
  "name": "@marketing/landing-renderer",
  "version": "1.0.0",
  "scripts": {
    "dev": "nodemon -r ts-node/register src/server.ts",
    "build": "tsc -b",
    "start": "node dist/server.js"
  },
  "dependencies": {
    "express": "^4.18.0",
    "helmet": "^8.0.0",
    "compression": "^1.7.4",
    "cookie-parser": "^1.4.6",
    "handlebars": "^4.7.8",
    "axios": "^1.6.0",
    "pino": "^9.0.0",
    "@sentry/node": "^8.0.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "ts-node": "^10.9.0",
    "nodemon": "^3.0.0",
    "@types/express": "^4.17.0",
    "@types/compression": "^1.7.0",
    "@types/node": "^20.0.0"
  }
}
```

**Key package notes:**
- **Removed from dashboard:** `next`, `@sentry/nextjs`, `@emotion/cache`, `@emotion/server`, `eslint-config-next` — all Next.js-specific
- **Added to dashboard:** `react-router-dom`, `vite`, `@vitejs/plugin-react`, `vitest`, `@playwright/test`, `@sentry/react`, `jsdom` (test DOM)
- `notistack` — MUI-compatible snackbar/toast notification stack
- `react-window` — virtual scrolling for large MUI lists (50,000 keywords)
- `@mui/lab` — experimental MUI components: `LoadingButton`, `TreeView`, `Masonry`, `Timeline`
- `dayjs` — MUI X DatePickers requires dayjs or date-fns as the date adapter

---

## Technology Decision Matrix

Every choice in one table — with the alternative considered and the reason for the decision:

| Component | **Chosen** | Alternative Considered | Decision Reason |
|---|---|---|---|
| Dashboard Framework | **React 18 + Vite 5** ⭐ Option C | Next.js, CRA | Simpler mental model, faster HMR; dashboard is login-only so SSR not needed |
| Marketing Site | **Astro 4** (separate app) | Next.js, Hugo, WordPress | Zero-JS by default; perfect SEO; markdown-first |
| Landing Page Renderer | **Express + Handlebars** (separate small service) | Next.js, dedicated SSR framework | Single-purpose; cacheable at CDN edge; ~500 lines |
| CSS Framework | **MUI Emotion (CSS-in-JS)** | TailwindCSS | Exact match to existing web app — team already knows it, zero retraining |
| Component Library | **MUI v6 + MUI X** | shadcn/ui, Ant Design | Already used in web app (v6) and admin (v7) — consistent design language across entire platform |
| Workflow Canvas | **React Flow** | Custom SVG | Industry standard, handles complex graphs |
| Email Builder | **Unlayer** | Custom build | 6-month build vs. ready-made enterprise solution |
| Backend Framework | **Express 4.18** | Fastify, NestJS | Exact match to all 4 existing services |
| ORM | **Sequelize 6** | Prisma, TypeORM | Exact match, zero migration cost |
| Primary DB | **MySQL/PostgreSQL** | PostgreSQL | Exact match to existing — same Sequelize dialect |
| Analytics DB | **ClickHouse** | PostgreSQL TimescaleDB | ClickHouse 10× faster for analytical GROUP BY queries |
| Search | **Elasticsearch** | Meilisearch, Typesense | Mature ecosystem, fuzzy search, aggregations |
| Queue | **Bull** | BullMQ | Exact match to existing platform |
| SEO Data | **DataForSEO** | SEMrush API, Ahrefs API | 90% cheaper, single API for all SEO data |
| Email Delivery | **SendGrid** | Mailgun, Postmark | Sub-user accounts for agency white-labelling |
| AI Provider | **OpenAI + Claude + Gemini** | OpenAI only | Redundancy + cost routing + capability routing |
| Image Gen | **DALL-E 3** | Midjourney | API access (Midjourney has no API) |
| Transcription | **Whisper** | AssemblyAI | Already paying OpenAI — same SDK |
| WhatsApp | **360dialog** | Twilio WhatsApp | Lower cost, better BSP support |
| SMS | **Twilio** | Vonage, MessageBird | Already integrated in existing SOC service |
| Push | **Firebase** | OneSignal, Pusher | Already integrated in existing SOC service |
| Storage | **Pluggable driver** (S3 OR local disk) ⭐ Option | n/a | Deploy in cloud (S3/R2/MinIO) or on-premise (local disk). See [storage-strategy.md](storage-strategy.md) |
| Payments | **Stripe + Connect** | Braintree, PayPal | Already integrated in existing payment service |
| Monorepo | **Turborepo + Yarn** | Nx, Lerna | Simpler than Nx, better than Lerna |
| Monitoring | **Sentry** | Datadog, New Relic | Best error tracking UX, generous free tier |
| Scraping | **Puppeteer + Cheerio** | Playwright only | Puppeteer already in codebase; Cheerio for static |
| Load Testing | **k6** | Artillery, Locust | Best DX, JavaScript test scripts |
| Container | **Docker + Compose** | Kubernetes | Kubernetes is over-engineered for Phase 1 |

---

## Why NOT These Technologies

Technologies evaluated and rejected — with reasons:

### ❌ TailwindCSS + shadcn/ui (instead of MUI)
TailwindCSS is excellent for greenfield projects. But:
- The entire existing platform (web app, admin panel, mobile app) uses MUI — switching would create a visual split between this platform and the rest
- Every developer already knows MUI's component API (`<Button variant="contained">`, `<TextField label="">`, `<DataGrid rows={}>`)
- MUI X DataGrid is already proven in the admin panel for large datasets — exactly what keyword tables and contact lists need
- MUI's `createTheme()` provides one central place to update brand colours across all 50+ component types simultaneously
- shadcn/ui requires owning and maintaining every component file — MUI ships updates, bug fixes, and accessibility improvements automatically

**Decision:** MUI v6 throughout — same as existing web app.

---

### ❌ Ant Design (instead of MUI)
The existing admin panel uses both MUI and Ant Design. For the marketing platform, using both would double the CSS-in-JS bundle. MUI alone covers every component needed.

**Decision:** MUI only — consistent with web app (which uses MUI as primary, Ant Design as secondary).

---

### ❌ Prisma (instead of Sequelize)
Prisma is excellent and TypeScript-native. But migrating means:
- Rewriting 100+ existing Sequelize models
- Different migration system (Prisma Migrate vs. Sequelize-CLI)
- Different query syntax
- Breaking shared model code with existing platform

**Decision:** Sequelize until the entire platform is ready for a coordinated migration.

### ❌ NestJS (instead of Express)
NestJS adds decorators, dependency injection, modules — powerful for large teams. But:
- Every existing service uses plain Express with `app.js` → `routes/` → `_services/`
- NestJS learning curve for a team already experienced with Express
- Opinionated structure that conflicts with the existing flat service structure

**Decision:** Express — consistency > marginal architectural benefit.

### ❌ GraphQL (instead of REST)
The existing platform uses REST exclusively. Marketing platform analytics queries would benefit from GraphQL's field selection. But:
- All 4 existing APIs are REST
- Client code (Axios, RTK Query) is REST-oriented
- GraphQL adds complexity: schema definition, resolvers, N+1 query problem

**Decision:** REST with well-designed resource endpoints.

### ❌ Kafka (instead of Bull/Redis queues)
Kafka handles millions of events/second with guaranteed delivery and replay. Overkill for Phase 1-4. Bull on Redis:
- Already running in existing platform
- Handles 10,000 jobs/minute (more than enough)
- Visual dashboard (Bull Board) for queue monitoring
- Simple retry/delay/priority semantics

**Decision:** Bull now. Kafka only if Redis becomes the bottleneck (unlikely before 100,000 workspaces).

### ❌ Kubernetes (instead of Docker Compose)
Kubernetes is the right answer for 1,000+ concurrent users with zero-downtime deployments. For initial launch:
- Docker Compose is simpler to understand, debug, and modify
- No YAML complexity for ingress, services, deployments, namespaces
- Single machine deployment is fine for Phase 1

**Decision:** Docker Compose → migrate to Kubernetes when needed (Compose → Swarm → K8s is a natural path).

### ❌ Supabase / Firebase (instead of MySQL/PostgreSQL + Sequelize)
Supabase is compelling (Postgres + Auth + Storage + Realtime). But:
- The existing platform is built on MySQL/PostgreSQL + Sequelize
- Shared database for SSO would require a different driver
- Vendor lock-in risk for a production platform

**Decision:** Stay on the proven stack.

### ❌ Vercel (for Next.js hosting — N/A under Option C)
Not applicable since the dashboard is React + Vite static files (deployed to Cloudflare Pages). Marketing site (Astro) and landing-renderer are also self-hosted. Historical note:
- The microservices need to be on the same network as MySQL/PostgreSQL, Redis, ClickHouse
- Vercel functions are stateless (can't hold Bull queue workers)
- At scale, Vercel costs more than self-hosted
- Data sovereignty: user marketing data on self-managed infrastructure

**Decision:** Three frontends, three deploys:
- `apps/web` (React+Vite) → Cloudflare Pages or S3+CloudFront (static)
- `apps/marketing-site` (Astro) → Cloudflare Pages (static)
- `apps/landing-renderer` (Express SSR) → ECS Fargate (small task, behind CDN)

---

## Summary — One Line Per Technology

```
React 18 + Vite 5       Dashboard SPA framework — fast HMR, static deploy, login-only
React Router 6          Client-side routing (replaces Next.js App Router)
Astro 4                 Marketing site SSG (separate app; perfect SEO)
Express + Handlebars    Landing page renderer (One-Click Capture, webinar pages)
MUI v6 (@mui/material)  UI component library — exact match to existing web app (v6.4.4)
MUI X DataGrid          Data tables — 100k-row keyword/contact tables with virtual scroll
MUI X DatePickers       Date/time pickers — exact match to existing web app
MUI X Charts            Native charts — inherits MUI theme, zero extra styling
MUI Icons               2,100+ icons — exact match to existing web app
Emotion (CSS-in-JS)     MUI's styling engine — same as existing platform
Framer Motion           Animations — already in existing codebase (v12.4.3)
lucide-react            Additional icons — already in existing web app
Recharts                Advanced custom charts — dual-axis, funnels, geo charts
React Flow              Workflow canvas — drag-and-drop CRM automation builder
Unlayer                 Email builder — enterprise drag-and-drop, exports HTML
Redux Toolkit           State management — matches existing mobile app pattern
RTK Query               Server state — caching, polling, refetch for analytics
React Hook Form         Forms — already in existing web app
Zod                     Validation — TypeScript-first schema + type inference
date-fns + dayjs        Dates — dayjs required by MUI X DatePickers adapter
notistack               Snackbar stack — MUI-compatible toast notifications
─────────────────────────────────────────────────────────────────
Node.js 20 LTS      Runtime — existing platform requirement
Express 4.18        HTTP framework — identical to all 4 existing services
Babel 7             Transpiler — identical to Booking + Payment services
Sequelize 6         ORM — identical to all existing services
sequelize-cli       Migrations — matches Booking API exactly
Sequelize-Paginate  Pagination — already used everywhere
MySQL/PostgreSQL             Primary database — shared with existing platform
ClickHouse          Analytics DB — time-series, 10× faster GROUP BY
Elasticsearch       Search — keyword/content/contact full-text search
Redis               Cache + sessions — shared with existing platform
Bull                Background jobs — shared Redis, mkt- prefix
node-cron           Scheduled jobs — identical to all existing services
─────────────────────────────────────────────────────────────────
OpenAI GPT-4o       AI writing, keyword research, analysis
Claude 3.5 Sonnet   AI ad copy, persuasive writing
Gemini 1.5 Pro      AI long-context competitor analysis
Whisper             Audio/video transcription
DALL-E 3            Image generation for ads + thumbnails
Tesseract.js        OCR — already in Booking service
Puppeteer           SEO crawling — already in Booking service
Cheerio             Fast HTML parsing for static pages
Playwright          Cloudflare-bypass scraping for competitor intel
─────────────────────────────────────────────────────────────────
DataForSEO          SEO data API — keywords, SERP, backlinks
SendGrid            Email delivery — transactional + marketing
Twilio              SMS — already in existing SOC service
Firebase Admin      Push notifications — already in existing SOC service
360dialog           WhatsApp Business API — broadcasts + chatbot
Pluggable Storage   File storage — STORAGE_DRIVER=s3 (cloud) OR local (on-prem)
Stripe + Connect    Payments + affiliate payouts — already integrated
Meta Graph API      Facebook + Instagram scheduling + ads
Twitter API v2      Twitter/X scheduling + listening
LinkedIn API        LinkedIn scheduling + B2B ads
TikTok Business API TikTok scheduling + ads
YouTube Data API v3 Channel management + video SEO
Google Ads API      Search + Shopping + Display campaigns
─────────────────────────────────────────────────────────────────
Nginx               Reverse proxy — SSL, routing, rate limiting
Docker + Compose    Containerisation — all 12 services + DBs
Yarn 4 + Turborepo  Monorepo management — parallel builds, caching
Sentry              Error monitoring — all 12 services
GitHub Actions      CI/CD — test, build, deploy pipeline
k6                  Load testing — 1,000 events/sec on analytics
Jest                Unit + integration testing — matches existing
React Testing Lib   Component testing — matches existing web app
Supertest           API endpoint testing — standard Express testing
─────────────────────────────────────────────────────────────────
Helmet              HTTP security headers — exact match
express-rate-limit  Rate limiting — exact match
Passport + JWT      Authentication — exact match, enables SSO
bcrypt              Password hashing — exact match
crypto-js           AES encryption — exact match, shared middleware
```
