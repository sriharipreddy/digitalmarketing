# 🚀 Marketing Platform — Quick Start (Phase 0)

> The documentation index is in [README.md](README.md). This file is the **engineering quick-start** for running the project locally.

---

## Prerequisites

- **Node.js 20+** (`nvm use` reads `.nvmrc`)
- **Yarn 3.6+** (Berry; ships with corepack)
- **Local Redis** running on `127.0.0.1:6379`
  - macOS: `brew install redis && brew services start redis`
  - Linux: `sudo apt install redis-server && sudo systemctl start redis`
- **Remote MySQL** — credentials already in the `.env.example` files (DB `digitalmarketing` on `68.178.239.242:3306`)

## First-time setup

```bash
# 1. Enable Yarn Berry (one-time, if you don't already have it)
corepack enable

# 2. Make sure Redis is running locally
redis-cli ping       # should reply "PONG"

# 3. Install all workspace dependencies
yarn install

# 4. Copy env files (already pre-filled — DB + Redis credentials baked in)
cp api/marketing-core/.env.example   api/marketing-core/.env
cp web/.env.example                  web/.env

# 5. Start the API — Sequelize connects to the remote MySQL,
#    auto-creates all core_* tables, seeds default plans + roles + dev admin
yarn dev:core
#    → http://localhost:3100/health

# 6. In another terminal, start the web app
yarn dev:web
#    → http://localhost:3000  (Vite proxies /api → :3100)
```

## Connection details (already wired into env files)

| Resource | Value |
|---|---|
| Database | `digitalmarketing` on `68.178.239.242:3306` (MySQL) |
| DB user | `amgprojects` |
| Redis | `127.0.0.1:6379` (local, no password) |
| Redis key prefix | `digi:` |

To override (e.g. point at a local MySQL instead): edit `.env` in the relevant service.

---

## Folder layout

```
/Users/apple/Sites/marketing/
├── PROJECT.md                ← you are here (quick-start)
├── README.md                 ← documentation index
├── *.md                      ← 30+ design docs (doc.md, tech.md, etc.)
├── microservices/            ← per-service specs
│
├── package.json              ← Yarn workspaces root
├── tsconfig.base.json
│
├── web/                      ← React 18 + Vite 5 + MUI v6 SPA (Option C)
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── routes/
│   │   │   ├── auth/Login.tsx, Register.tsx
│   │   │   └── dashboard/DashboardLayout.tsx, Overview.tsx
│   │   ├── store/            ← Redux Toolkit
│   │   ├── lib/api.ts        ← Axios w/ auth header
│   │   └── theme.ts          ← MUI theme tokens
│   └── package.json
│
└── api/
    ├── packages/             ← shared workspace libraries
    │   ├── shared-types/     ← TypeScript interfaces used everywhere
    │   ├── shared-config/    ← env validation (envalid)
    │   ├── shared-db/        ← Sequelize dual-dialect + sync helpers
    │   ├── shared-storage/   ← pluggable S3 / local driver
    │   └── shared-middleware/← JWT, errors, logger, health, base middleware
    │
    ├── marketing-core/       ← ⭐ WORKING service (port 3100)
    │   └── src/
    │       ├── app.ts        ← bootstrap
    │       ├── _config/env.ts
    │       ├── _services/auth.service.ts
    │       ├── controllers/auth.controller.ts
    │       ├── routes/
    │       ├── models/       ← core_users, core_workspaces, etc.
    │       └── seeds/        ← idempotent default data
    │
    └── (13 service stubs — Phase 1-4 implementation)
        seo-engine/           :3101 — Phase 1
        content-ai/           :3102 — Phase 1
        crm-automation/       :3110 — Phase 1
        campaign-manager/     :3103 — Phase 2
        analytics-engine/     :3104 — Phase 2
        social-hub/           :3105 — Phase 2
        email-hub/            :3106 — Phase 2
        media-hub/            :3111 — Phase 3
        influencer-hub/       :3109 — Phase 3
        intelligence/         :3107 — Phase 3
        affiliate-hub/        :3108 — Phase 4
        notification-service/ :3112 — Phase 4
        integration-service/  :3113 — Phase 4
```

---

## What works right now (Phase 0)

✅ Yarn workspaces monorepo wired up
✅ TypeScript across the board
✅ Shared packages compile and import cleanly
✅ marketing-core service boots, connects to MySQL, auto-creates all `core_*` tables, seeds data
✅ Auth endpoints: register, login, refresh, logout, /users/me
✅ MUI dashboard with login, register, sidebar, overview page
✅ Frontend ↔ API connectivity verified via `/users/me`
✅ Health checks: `/health`, `/ready`, `/live`
✅ Graceful shutdown on SIGTERM/SIGINT

## Try it out

After running steps 1-6 above:

1. Open http://localhost:3000 → see the login page
2. Click "Register" → create a new account (any email, 12+ char password, any workspace name)
3. Log in with the new account, OR use the dev admin: `admin@yourplatform.local` / `AdminDev1234!`
4. Dashboard appears with the workspace name + connection check card

Or call the API directly:
```bash
# Register
curl -X POST http://localhost:3100/api/v1/core/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"full_name":"Test User","email":"test@example.com","password":"TestPassword123!","workspace_name":"Test Co"}'

# Login
curl -X POST http://localhost:3100/api/v1/core/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"TestPassword123!"}'

# Health
curl http://localhost:3100/health
```

---

## Useful commands

```bash
yarn dev:web                  # Vite dev server (port 3000)
yarn dev:core                 # marketing-core watch mode (port 3100)
yarn build                    # Build all workspaces
yarn type-check               # TypeScript check across the monorepo
yarn lint                     # ESLint everywhere
yarn test                     # Run vitest across all workspaces

# Redis (local) — start once on your machine
brew services start redis     # macOS
# sudo systemctl start redis  # Linux
redis-cli ping                # → "PONG"
```

**Reset the database** (drops every `core_*` table on next boot — destructive):
```bash
RESET_DB=true yarn dev:core   # next boot drops + recreates all tables + reseeds
```

---

## Adding a new service

1. Copy the working pattern from `api/marketing-core/`
2. Update `api/<new-service>/package.json` with the right name + port
3. Define your models in `src/models/` using the **`<service>_<table>`** naming (e.g. `seo_keywords`)
4. Implement your routes + services
5. Run `yarn workspace @marketing/<new-service> dev`

Sequelize will auto-create the tables on first boot (dev/staging).

---

## Database

- **Local dev:** MySQL 8 via Docker (port 3306) — `marketing_app` / `marketing_app`
- **Production target:** PostgreSQL — set `DB_DIALECT=postgres` + `DATABASE_URL=postgres://...`
- **Schema reference:** [database-schema.md](database-schema.md) (all 131 tables across 14 services)
- **Auto-sync at boot:** [database-sync-strategy.md](database-sync-strategy.md)

The same code runs on both MySQL and PostgreSQL — only the connection URL + dialect changes.

---

## Next steps

See [microservices/99-build-phases.md](microservices/99-build-phases.md) for the 20-week build plan.

**Immediate todo (Phase 0 → 1):**
- [ ] Add Sentry SDK to marketing-core
- [ ] Set up GitHub Actions CI
- [ ] Submit Meta / LinkedIn / TikTok developer app approvals (4-8 weeks lead time)
- [ ] Implement workspace + member endpoints
- [ ] Email verification flow (SendGrid)
- [ ] 2FA (TOTP via otplib)
- [ ] Stripe subscription integration
- [ ] Audit log auto-middleware
- [ ] Bring `seo-engine`, `content-ai`, `crm-automation` to first vertical slice (Phase 1 week 4 deliverable)
