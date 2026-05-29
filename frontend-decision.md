# 🎨 Frontend Decision: ✅ React + Vite + TypeScript (Option C)
## Decision Recorded — 2026-05-28

> **DECISION:** The platform uses **React 18 + Vite 5 + TypeScript** for the dashboard. A **separate static marketing site** (Astro or similar) handles the public-facing pages that need SEO.
>
> This is Option C from the original analysis. The trade-offs and compensation plan are documented below.

---

## 📌 Decision Summary (Authoritative)

| Concern | Resolution |
|---|---|
| **Dashboard app** (`apps/web/`) | **React 18 + Vite 5 + TypeScript** |
| **UI library** | MUI v6 (unchanged) |
| **State** | Redux Toolkit + RTK Query (unchanged) |
| **Routing** | React Router v6 (replaces Next.js App Router) |
| **Build tool** | Vite 5 (replaces Next.js build) |
| **Deployment** | Static files → Cloudflare Pages or S3 + CloudFront |
| **Public marketing site** | Separate static site (Astro recommended) at `yourplatform.com` |
| **One-Click Capture landing pages** | Dedicated renderer service (see "Landing Page Renderer" below) |
| **Lead capture form embeds** | Server-rendered HTML via a small Express endpoint in `crm-automation` |
| **Webinar registration pages** | Server-rendered via campaign-manager OR via the marketing site CMS |
| **Auth flash mitigation** | Synchronous session check in `index.html` before React mounts |
| **SEO bots for public pages** | Handled by Astro static site (built-in SSG) |

---

## 🏗️ Confirmed Architecture

```
apps/
├── web/                       # ⭐ React + Vite + TypeScript (logged-in dashboard)
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── routes/            # React Router v6
│   │   │   ├── auth/
│   │   │   │   ├── Login.tsx
│   │   │   │   ├── Register.tsx
│   │   │   │   └── Verify.tsx
│   │   │   ├── dashboard/     # All 20 modules
│   │   │   │   ├── Overview.tsx
│   │   │   │   ├── seo/
│   │   │   │   ├── campaigns/
│   │   │   │   ├── content/
│   │   │   │   ├── crm/
│   │   │   │   └── ...
│   │   │   └── public/        # Login-adjacent public pages (NOT marketing)
│   │   │       ├── ResetPassword.tsx
│   │   │       └── InviteAccept.tsx
│   │   ├── components/
│   │   ├── store/             # Redux Toolkit
│   │   ├── lib/
│   │   └── theme.ts           # MUI theme
│   ├── vite.config.ts
│   └── package.json
│
├── marketing-site/            # ⭐ Astro (separate; public-facing only)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── index.astro    # Homepage
│   │   │   ├── pricing.astro
│   │   │   ├── features.astro
│   │   │   ├── blog/[slug].astro
│   │   │   ├── customers.astro
│   │   │   ├── security.astro
│   │   │   ├── legal/[doc].astro
│   │   │   └── changelog.astro
│   │   ├── layouts/
│   │   └── components/        # Astro components (optionally with React islands)
│   ├── content/               # Markdown content for blog
│   ├── astro.config.mjs
│   └── package.json
│
├── landing-renderer/          # ⭐ Small Express service (NEW)
│   # Renders One-Click Capture landing pages SSR-style
│   # Serves at pages.yourplatform.com/<slug>
│   ├── src/
│   │   ├── server.ts
│   │   ├── templates/         # Handlebars or React-SSR templates
│   │   └── seo.ts             # OG tags, schema.org, sitemap
│   └── package.json
│
└── packages/
    ├── shared-ui/             # Pure React MUI components (used by web/)
    ├── shared-types/          # TypeScript interfaces
    └── shared-config/         # Shared vite config, eslint config
```

Three deployable units:
1. **`web` (React + Vite SPA)** → `app.yourplatform.com` (Cloudflare Pages / S3+CDN)
2. **`marketing-site` (Astro)** → `yourplatform.com` (Cloudflare Pages)
3. **`landing-renderer` (Express SSR)** → `pages.yourplatform.com` (ECS task)

---

## 📋 Why Option C Was Chosen

The decision-maker explicitly chose:
- Simpler mental model than Next.js (no Server Components, no `app/` router conventions, no Server Actions)
- Faster HMR for dashboard dev experience (Vite ~50ms vs Next.js 100-500ms)
- Smaller learning curve for the team
- Marketing site can be built with content-first tools (Astro) optimised for that job

Accepting the trade-offs documented below.

---

## ⚠️ What We're Accepting (Trade-offs)

### Hard losses (now solved by separate infrastructure)

| Problem | Mitigation in Option C |
|---|---|
| Dashboard SPA has no SEO | ✅ Not needed — dashboard is login-only |
| Marketing site SEO | ✅ Astro at `yourplatform.com` (SSG, perfect Lighthouse SEO) |
| Landing pages from One-Click Capture | ⚠️ `landing-renderer` service (extra ~2 weeks build) |
| Lead capture form embeds (Open Graph) | ⚠️ Server-render in `crm-automation` (small addition) |
| Webinar registration pages | ⚠️ `landing-renderer` or marketing-site CMS |
| Auth flash (FOUC of unauthenticated state) | ⚠️ Synchronous session check in `index.html` |

### Medium effort additions

- **CDN tracking script** (`cdn.yourplatform.com/track.js`) — already a separate build target; no change
- **SPA fallback routing** — Cloudflare Pages handles via `_redirects` file
- **Sitemap + robots.txt** — Astro generates for marketing-site; `landing-renderer` generates for landing pages

### Soft trade-offs

- Two front-end build pipelines instead of one
- Cross-subdomain auth: cookies scoped to `.yourplatform.com` to work for both `yourplatform.com` (marketing) and `app.yourplatform.com` (dashboard)
- Slight code duplication: marketing-site repeats some MUI-styled CTA buttons that the dashboard also has (acceptable — different visual languages)

---

## 🛠️ Concrete Setup Instructions

### apps/web (React + Vite + TypeScript)

**Initialise:**
```bash
yarn create vite apps/web --template react-ts
cd apps/web
yarn add react-router-dom
yarn add @mui/material @mui/icons-material @mui/x-data-grid @mui/x-date-pickers @mui/x-charts
yarn add @emotion/react @emotion/styled
yarn add @reduxjs/toolkit react-redux
yarn add axios socket.io-client
yarn add react-hook-form zod @hookform/resolvers
yarn add framer-motion notistack
yarn add @xyflow/react
yarn add recharts
yarn add date-fns dayjs
yarn add @unlayer/react
yarn add lucide-react
yarn add crypto-js uuid
yarn add -D @types/crypto-js @types/uuid @types/react-window
```

**`vite.config.ts`:**
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 3000,
    proxy: {
      // Forward /api/* to nginx during dev
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          mui: ['@mui/material', '@mui/icons-material'],
          charts: ['recharts', '@mui/x-charts'],
          editor: ['@unlayer/react', '@xyflow/react'],
        },
      },
    },
  },
});
```

**`index.html` (with auth pre-check to mitigate flash):**
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>YourPlatform</title>
    <link rel="icon" href="/favicon.ico" />
    <link rel="preconnect" href="https://api.yourplatform.com" />
    <script>
      // Synchronous session pre-check before React loads
      // Fetches /api/v1/core/users/me with the refresh cookie
      // If 401, redirects to /login server-side before React mounts
      (async () => {
        const path = window.location.pathname;
        const publicPaths = ['/login', '/register', '/verify', '/reset-password', '/invite/'];
        if (publicPaths.some(p => path.startsWith(p))) return;
        try {
          const r = await fetch('/api/v1/core/users/me', { credentials: 'include' });
          if (r.status === 401) window.location.replace('/login');
        } catch (_) { /* network error — let React handle */ }
      })();
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**`src/main.tsx`:**
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { store } from './store';
import { theme } from './theme';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <SnackbarProvider maxSnack={3}>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </SnackbarProvider>
        </LocalizationProvider>
      </ThemeProvider>
    </Provider>
  </StrictMode>
);
```

### apps/marketing-site (Astro)

**Initialise:**
```bash
yarn create astro apps/marketing-site
cd apps/marketing-site
yarn add @astrojs/sitemap @astrojs/mdx @astrojs/rss
yarn add @astrojs/react       # optional — for interactive React islands
```

**`astro.config.mjs`:**
```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://yourplatform.com',
  integrations: [sitemap(), mdx(), react()],
  output: 'static',
});
```

Pages live as `.astro` files in `src/pages/`. Blog posts in MDX. Each page automatically optimises images, generates sitemap entries, ships zero JS unless an interactive island is used.

**Why Astro over Next.js for the marketing site:**
- Zero JS by default (Lighthouse perf 100)
- Built specifically for content-heavy sites
- Simpler than Next.js for marketers to edit (just `.astro` / `.mdx` files)
- Can deploy as static files (Cloudflare Pages free tier handles unlimited traffic)
- Markdown-first; blog is trivial to add

### apps/landing-renderer (Express SSR for One-Click Capture pages)

**Initialise:**
```bash
mkdir -p apps/landing-renderer
cd apps/landing-renderer
yarn init -y
yarn add express helmet compression cookie-parser pino axios handlebars
yarn add -D typescript @types/node @types/express ts-node nodemon
```

**`src/server.ts` (skeleton):**
```ts
import express from 'express';
import helmet from 'helmet';
import { renderLandingPage } from './render';
import { generateOpenGraphTags } from './seo';

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));

app.get('/p/:slug', async (req, res) => {
  // 1. Fetch landing page from campaign-manager service
  const page = await fetch(`${process.env.CAMPAIGN_MANAGER_URL}/internal/landing-pages/by-slug/${req.params.slug}`).then(r => r.json());
  if (!page) return res.status(404).send('Not found');

  // 2. Render full SSR HTML with OG tags + JSON-LD schema
  const html = renderLandingPage(page);
  res.set('Cache-Control', 'public, max-age=300, s-maxage=900');
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// Track conversions back to analytics-engine
app.post('/p/:slug/track', /* ... */);

app.listen(3200);
```

This service is small (~500 lines), well-cached at the CDN edge, and is the **only** place where SSR happens in Option C. It's not a "framework" — it's a focused renderer for one job.

---

## 🚦 Routing Strategy

```
yourplatform.com                  → marketing-site (Astro, SSG)
yourplatform.com/pricing          → marketing-site
yourplatform.com/blog/[slug]      → marketing-site
yourplatform.com/legal/*          → marketing-site
yourplatform.com/security         → marketing-site

app.yourplatform.com              → web (React + Vite SPA)
app.yourplatform.com/login        → web (router-based)
app.yourplatform.com/dashboard    → web (router-based)
app.yourplatform.com/seo          → web (router-based)
app.yourplatform.com/campaigns    → web (router-based)
app.yourplatform.com/*            → web (catch-all, served via SPA fallback)

pages.yourplatform.com/p/[slug]   → landing-renderer (Express SSR — One-Click landing)
pages.yourplatform.com/f/[slug]   → crm-automation (form embed; existing endpoint)
pages.yourplatform.com/w/[slug]   → landing-renderer (webinar registration)

analytics.rocketagency.co.uk      → web with branding loaded dynamically
(agency custom domain)            → Cloudflare Worker injects agency theme
```

### Cloudflare Pages `_redirects` for SPA fallback (`apps/web/public/_redirects`):
```
/*  /index.html  200
```
This sends all unmatched routes to `index.html`, letting React Router handle them.

---

## 🔐 Cross-Subdomain Auth

Cookies scoped to `.yourplatform.com` so they work on both `yourplatform.com` and `app.yourplatform.com`:

```
Set-Cookie: refresh_token=<hex>;
            HttpOnly;
            Secure;
            SameSite=Lax;
            Domain=.yourplatform.com;
            Path=/api/v1/core/auth;
            Max-Age=2592000
```

When a logged-in user clicks "Dashboard" on `yourplatform.com`, they're sent to `app.yourplatform.com` and the cookie travels with them. The `index.html` pre-check fires automatically.

For agency custom domains (`analytics.rocketagency.co.uk`), the cookie is scoped to that domain — agency clients never share session with the main platform.

---

## 📦 Updated Package List for `apps/web/package.json`

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
    "test:ui": "vitest --ui",
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
    "react-window": "^1.8.10"
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
    "@vitest/ui": "^2.0.0",
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

**Notes vs the Next.js version:**
- Removed: `next`, `@sentry/nextjs`, `@emotion/cache`, `@emotion/server` (Next.js-specific MUI SSR helpers — not needed for SPA)
- Added: `react-router-dom`, `vite`, `@vitejs/plugin-react`, `vitest`
- Replaced `next/font` with manual font preload in `index.html`
- Replaced `next/image` with `react-image` or native `<img loading="lazy">`

---

## 📋 Table of Contents

1. [TL;DR Recommendation](#tldr-recommendation)
2. [The Two Options](#the-two-options)
3. [What Next.js Does That Plain React Doesn't](#what-nextjs-does-that-plain-react-doesnt)
4. [The 8 Critical Differences](#the-8-critical-differences)
5. [If You Choose React + Vite: What You Lose](#if-you-choose-react--vite-what-you-lose)
6. [If You Choose React + Vite: How to Compensate](#if-you-choose-react--vite-how-to-compensate)
7. [Hybrid Option: Best of Both](#hybrid-option-best-of-both)
8. [Final Recommendation Matrix](#final-recommendation-matrix)
9. [Migration Path](#migration-path)

---

## TL;DR Recommendation

### Use **Next.js** if:
- ✅ You want the platform's **own marketing website** (`/`, `/pricing`, `/blog`, `/features`) to rank on Google — **REQUIRED for SaaS**
- ✅ You want **agency white-label landing pages** to be SEO-discoverable
- ✅ You want the customer-facing **landing pages built by One-Click Capture** to be SEO-friendly
- ✅ You want **public webinar registration pages** to share well on social (Open Graph tags)
- ✅ You want **public form embed pages** for lead capture

### Use **React + Vite + TypeScript** if:
- ✅ The entire frontend is **logged-in-only** (no public marketing pages, no public landing pages)
- ✅ You have a **separate static site** (WordPress, Webflow, plain HTML) for marketing
- ✅ You want **slightly faster developer experience** (Vite HMR is ~50ms vs Next.js ~100-500ms)
- ✅ You're more comfortable with the **simpler mental model** (no Server Components, no `app/` routing, no `next/image`)

### Hybrid (RECOMMENDED for your situation):
- 🎯 **Next.js for public-facing pages** (`apps/web-public/`): marketing site, landing pages, blog
- 🎯 **React + Vite for logged-in dashboard** (`apps/web-app/`): all 20 modules
- Two apps, shared component library, deployed to different subdomains (`yourplatform.com` and `app.yourplatform.com`)

---

## The Two Options

### Option A — Next.js 14 (current plan)

```
apps/web/
├── app/
│   ├── (marketing)/page.tsx              # SSR — Google indexes this
│   ├── (marketing)/pricing/page.tsx      # SSR
│   ├── (marketing)/blog/[slug]/page.tsx  # ISR
│   ├── (auth)/login/page.tsx
│   └── (dashboard)/page.tsx              # CSR after login
├── components/
└── package.json
```

Build with `next build`. Deploy as Node.js server (handles SSR).

### Option B — React + Vite + TypeScript

```
apps/web/
├── index.html                            # single HTML shell
├── src/
│   ├── main.tsx                          # React entry
│   ├── App.tsx
│   ├── routes/                           # React Router
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   └── ...
│   └── components/
└── vite.config.ts
```

Build with `vite build`. Deploy as static files (S3 + CloudFront / Cloudflare Pages).

---

## What Next.js Does That Plain React Doesn't

Next.js is React **plus** a framework around it that adds:

1. **Server-Side Rendering (SSR)** — server generates the HTML; Google sees content immediately
2. **Static Site Generation (SSG)** — pages built at deploy time; fastest possible loads
3. **Incremental Static Regeneration (ISR)** — public pages re-build every N seconds without redeploy
4. **File-based routing** — `app/pricing/page.tsx` automatically becomes `/pricing`
5. **API Routes** — built-in BFF (Backend for Frontend); no separate Node.js server needed for proxying
6. **Image Optimization** — `<Image>` auto-resizes, converts to WebP/AVIF, lazy-loads
7. **Font Optimization** — `next/font` self-hosts Google Fonts at build time (no FOUT)
8. **Metadata API** — `<head>`, Open Graph, Twitter cards, sitemap.xml, robots.txt generated automatically
9. **React Server Components (RSC)** — components run on server-only; smaller JS bundle
10. **Built-in middleware** — for auth checks, redirects, A/B test cookie assignment at the edge

React + Vite is just the React library + a fast dev server + a bundler. You get HMR (Hot Module Replacement) and TypeScript out of the box, but **nothing else** in this list.

---

## The 8 Critical Differences

### 1. SEO (Search Engine Optimisation)

| | Next.js | React + Vite |
|---|---|---|
| Public pages rank on Google | ✅ SSR / SSG | ❌ Empty HTML; Google must execute JS |
| First Contentful Paint (FCP) on `/pricing` | ~200ms | 1-3 seconds |
| LCP score | 90+ | 40-60 |
| Open Graph tags on share | ✅ Per-page | ❌ Single tag set for the whole SPA |
| Twitter card preview | ✅ Per-page | ❌ Generic |

**Impact on your platform:** Google Lighthouse SEO score 95+ with Next.js, ~50 with Vite-only. **Without SSR, your marketing site won't rank.** This affects:
- Marketing site SEO
- Customer's landing pages generated by One-Click Capture (these MUST rank)
- Agency white-label landing pages
- Form embed pages
- Webinar registration pages

### 2. Time to First Byte (TTFB) + Time to Interactive (TTI)

| | Next.js SSR | React + Vite |
|---|---|---|
| TTFB | 200-500ms | 50-200ms (CDN serves static HTML shell) |
| TTI (first meaningful interaction) | 1-2s | 2-5s |
| Cold start (no cache) on slow 3G | 3s | 8s |
| Bundle size (initial JS) | 100-200KB | 200-500KB |

**Why?** Vite serves a static `index.html` faster (no server compute) BUT then the browser has to download all the JS to render anything. Next.js sends pre-rendered HTML so the user sees content immediately, even if interactivity is slightly delayed.

### 3. Bundle Size

| | Next.js (App Router with RSC) | React + Vite |
|---|---|---|
| Initial JS bundle | 100-200KB (Server Components stay on server) | 200-500KB (everything ships to client) |
| Code splitting | Automatic per route | Manual via `React.lazy()` |
| Dead code elimination | Automatic per route | Automatic (Rollup) |

React Server Components are unique to Next.js (and similar frameworks). They let parts of your UI run on the server only — they're never sent to the browser. For a 20-module dashboard, this can reduce bundle by 30-50%.

### 4. Public Landing Page Generation (One-Click Capture feature)

Your One-Click Capture creates landing pages for customers (`campaign_landing_pages` table). These need to:
- Be publicly accessible at `pages.yourplatform.com/<slug>`
- Render fast on mobile (< 2s LCP)
- Have proper `<title>`, meta description, Open Graph tags
- Be Google-indexable

| Approach | With Next.js | With React + Vite |
|---|---|---|
| Implementation | Add `app/(public)/pages/[slug]/page.tsx` — done | Need separate server (Express + Handlebars or React SSR) to render these dynamically |
| Effort | 1 day | 1-2 weeks |
| Performance | LCP 1-2s | Need work to match |

### 5. Dynamic Imports / Code Splitting

| | Next.js | React + Vite |
|---|---|---|
| Route-level splitting | Automatic | Manual via `React.lazy()` |
| Component-level splitting | `next/dynamic` | `React.lazy()` |
| Bundle analysis | `@next/bundle-analyzer` | `rollup-plugin-visualizer` |

For 20 modules with rich UIs (workflow builder, email builder, charts), code splitting is critical. Both can do it; Next.js makes it more automatic.

### 6. Authentication Patterns

| | Next.js | React + Vite |
|---|---|---|
| Server-side cookie check | Middleware runs on edge before page renders | All client-side; flash of unauthenticated content possible |
| Redirect to login if not authed | Server-side 302 | Client-side `useEffect` + `<Navigate>` |
| Token refresh on page load | Done before HTML sent | Done after JS hydrates |

**User experience:** Next.js can redirect unauthenticated users to login **before they see anything**. React + Vite shows the dashboard shell, runs JS, discovers they're not logged in, then redirects — a brief flash that feels janky.

### 7. Image Handling (Crucial for Marketing Platform)

Your platform handles **a lot** of images:
- AI-generated DALL-E images
- Uploaded ad creatives
- Email template inline images
- Workspace logos
- Influencer profile photos
- Brand asset library

| | Next.js | React + Vite |
|---|---|---|
| Auto-resize on demand | `<Image>` does it | Manual via Cloudflare/ImgIX |
| WebP/AVIF serving | Automatic | Manual |
| Lazy loading | Automatic | Manual `loading="lazy"` |
| Layout shift prevention | Automatic | Manual width/height |
| Cost | Built-in | Need Cloudflare Polish or ImgIX (~$50-200/mo) |

### 8. Internationalisation (i18n)

| | Next.js | React + Vite |
|---|---|---|
| Library | `next-intl` integrated with App Router | `react-intl` or `i18next` standalone |
| URL-based locales (`/en/`, `/es/`) | Built-in | Manual via React Router |
| Server-rendered translations | Yes (RSC) | Client-only |
| RTL support (Arabic) | Works seamlessly | Works (manual `dir="rtl"`) |

---

## If You Choose React + Vite: What You Lose

### Hard losses (cannot easily replicate)
1. **SEO on public pages** — without SSR, Google sees `<div id="root"></div>` and an empty page
2. **Open Graph tags on share** — social previews will be generic
3. **Marketing site discoverability** — your own SaaS won't rank for "[your-niche] marketing platform"
4. **One-Click Capture landing pages won't be Google-friendly** — defeats the purpose
5. **Server-side auth check** — flash of unauthenticated content on every page load

### Medium losses (replicable with effort)
6. **Image optimisation** — need Cloudflare Polish, ImgIX, or build-time optimisation (extra cost + complexity)
7. **Font optimisation** — manual self-hosting + preload
8. **Sitemap + robots.txt** — manual generation scripts
9. **Code splitting** — manual `React.lazy()` everywhere (Next.js does it automatically per route)
10. **Bundle size** — no React Server Components, so all UI code ships to browser

### Soft losses (acceptable)
11. **Slightly more boilerplate** — manual `<head>` management, manual middleware, manual prefetching
12. **No edge functions** — can't run code at Cloudflare edge before page render

---

## If You Choose React + Vite: How to Compensate

If you're committed to React + Vite, here's the **minimum viable** compensation plan:

### For SEO problems
- **Build a separate static marketing site** (Astro, Hugo, or plain HTML) for `yourplatform.com/*` public pages
- Keep React+Vite SPA for the logged-in app at `app.yourplatform.com`
- Use **Cloudflare Workers + HTMLRewriter** to inject SEO tags from origin data on landing pages
- Use **prerendering services** like Prerender.io ($90/month) for crawler bot traffic — serves SSR-like HTML to Googlebot only

### For One-Click Capture landing pages
- Build a **separate landing page renderer** service (Node.js + Handlebars or React SSR) that renders templates on demand
- Serve at `pages.yourplatform.com/<slug>` via this dedicated service
- ~2 weeks of additional work

### For auth flash
- Add a **session check API call** that runs synchronously before the React app mounts (block render until response)
- Use **`fetch` in `index.html`** before the React bundle loads
- ~2 days of work; still imperfect UX

### For image optimisation
- Adopt **Cloudflare Polish** (Pro plan included) — adds WebP/AVIF + compression automatically
- Or use **`vite-plugin-imagemin`** at build time for static assets
- Or use **ImgIX / Cloudinary** ($25-200/mo) for dynamic resizing

### For SPA routing under Cloudflare
- Add a Cloudflare Page Rule or Worker to serve `index.html` for all unmatched paths (otherwise refreshes 404)

### For static site
- Pick one of: **Astro** (best for marketing sites — partial hydration), **Eleventy** (markdown-friendly), or **Webflow** (no-code)

---

## Hybrid Option: Best of Both

The **most pragmatic recommendation** for your situation:

### Two apps, one design system

```
apps/
├── web-public/                    # Next.js 14 — for SEO
│   ├── app/
│   │   ├── page.tsx               # Homepage
│   │   ├── pricing/page.tsx       # Pricing
│   │   ├── blog/[slug]/page.tsx   # Blog
│   │   ├── features/page.tsx
│   │   ├── customers/page.tsx
│   │   ├── pages/[slug]/page.tsx  # One-Click Capture landing pages
│   │   ├── f/[slug]/page.tsx      # Lead capture form embeds
│   │   ├── webinars/[slug]/page.tsx
│   │   ├── legal/[doc]/page.tsx
│   │   └── (auth)/login/page.tsx  # Login (Next.js handles redirects)
│   └── package.json
│
├── web-app/                       # React + Vite + TypeScript — for the dashboard
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── routes/
│   │   │   ├── dashboard/         # All 20 modules
│   │   │   ├── seo/
│   │   │   ├── campaigns/
│   │   │   └── ...
│   │   └── components/            # Imports from shared-ui
│   └── package.json
│
└── packages/
    └── shared-ui/                  # MUI theme + shared components
```

### Deployment

| URL | App | Runtime |
|---|---|---|
| `yourplatform.com` | web-public | Next.js SSR on Vercel / self-hosted Node.js |
| `app.yourplatform.com` | web-app | Static files on Cloudflare Pages |
| `pages.yourplatform.com/<slug>` | web-public route | Next.js SSR |
| `analytics.rocketagency.co.uk` (agency custom domain) | web-app (with branding loaded dynamically) | Static + edge worker for branding |

### Benefits
- ✅ Public pages get **full SEO** via Next.js SSR
- ✅ Dashboard gets **fast HMR** + simpler mental model via Vite
- ✅ Smaller individual bundle sizes per app
- ✅ Public pages can deploy independently (faster iteration on marketing copy)
- ✅ MUI theme + components shared via `packages/shared-ui`

### Trade-offs
- ❌ Two build pipelines, two CI jobs, two deploy processes (~1 extra day setup)
- ❌ Auth complexity: cross-subdomain cookies; SSO handoff between apps
- ❌ Slight code duplication for shared logic (Redux Toolkit setup, Axios instance)
- ❌ Two domains to manage (`yourplatform.com` + `app.yourplatform.com`)

### Time investment
- Hybrid: **+1 week** setup vs single-app
- Plain Vite (with SEO workarounds): **+2-3 weeks** setup
- Pure Next.js (current plan): baseline

---

## Final Recommendation Matrix

| Your Situation | Recommendation |
|---|---|
| Solo founder, just want to ship the dashboard fast, separate marketing site already exists (WordPress etc.) | **React + Vite** |
| Building everything from scratch, no existing marketing site, want one codebase | **Pure Next.js** (current plan) |
| Have a team, want best-in-class performance + SEO, willing to maintain two apps | **Hybrid** ⭐ |
| Already comfortable with Next.js | **Pure Next.js** |
| Strong team preference for plain React (and you have a marketing site elsewhere) | **React + Vite** + Prerender.io for SEO |

---

## ⭐ My Specific Recommendation for Your Platform

Given you're building:
- A **marketing-focused SaaS** (irony: SEO matters!)
- With **white-label agency portals**
- That generates **public landing pages** via One-Click Capture
- That embeds **lead capture forms** on customer websites
- That hosts **public webinar registration pages**

→ **Use Pure Next.js 14** (the original plan) OR **Hybrid (Next.js public + React+Vite dashboard)**.

→ **Avoid React + Vite only.** You'll spend 3+ weeks rebuilding what Next.js gives you for free, and your SEO will suffer.

### Why I keep recommending Next.js for THIS platform specifically

A digital marketing platform that doesn't itself rank on Google for terms like "marketing platform UK" is hypocrisy that competitors will exploit. Your own marketing site needs the SSR Next.js provides. Even if your dashboard is React+Vite, the public-facing parts must be Next.js or equivalent.

If you absolutely insist on React + Vite for the dashboard, go **Hybrid**: Next.js for public, Vite for dashboard. Two weeks of extra setup; far better long-term outcome.

---

## Migration Path

If you start with React + Vite and want to migrate to Next.js later:

| Phase | Action | Effort |
|---|---|---|
| 1. Add Next.js as separate app | `apps/web-public/` (new) | 1 week |
| 2. Move marketing pages to Next.js | Homepage, pricing, blog, legal | 2 weeks |
| 3. Move landing page renderer to Next.js | `pages.yourplatform.com/*` | 1 week |
| 4. Move auth pages to Next.js | Login, register, password reset (for SSR redirects) | 1 week |
| 5. Decide whether to move dashboard too | Optional; could stay Vite forever | varies |

**Total migration cost (if needed): ~5 weeks** for the public surface.

---

## Decision Summary

| Question | Answer |
|---|---|
| Can we use React + Vite + TypeScript? | **Yes** |
| Will the platform work? | **Yes** |
| Will the platform's own marketing rank on Google? | **No** (without significant additional work) |
| Will the customer's One-Click Capture landing pages rank on Google? | **No** (defeats a key feature) |
| Will the lead capture form embed pages work for SEO? | **No** |
| Is the dev experience slightly nicer with Vite? | Yes (faster HMR, simpler mental model) |
| Is the bundle smaller with Next.js App Router + RSC? | Yes |
| Should I go with Hybrid (Next.js public + Vite dashboard)? | **Strong recommendation for your platform** |
| Should I switch the current Next.js plan to pure Vite? | **No** — you'd lose too much |

---

## What to Tell the Team

> **"We're using Next.js 14 because we're a marketing platform — our own pages must rank on Google, and the landing pages we generate for customers must rank too. React Server Components also keep our dashboard bundle small. The team's Vite preferences are valid but the SEO requirement overrides them."**

OR (if going hybrid):

> **"We're using Next.js for public-facing pages (marketing site, landing pages, lead forms, webinar pages) because of SEO. We're using React + Vite for the logged-in dashboard because of faster dev experience and simpler mental model. They share a `packages/shared-ui` MUI component library, so design stays consistent."**
