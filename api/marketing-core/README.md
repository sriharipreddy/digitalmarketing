# marketing-core

**Port:** 3100
**Status:** Working skeleton (Phase 0)

Auth · Workspaces · Billing · Audit · SSO · Custom Domains

## Quick start

```bash
# From repo root
yarn install
docker compose up -d mysql redis      # MySQL + Redis local
cp api/marketing-core/.env.example api/marketing-core/.env

yarn dev:core
```

Service starts at http://localhost:3100.

## What works right now (Phase 0 / Phase 1 partial)

- ✅ MySQL connection (Sequelize) with auto-sync of all `core_*` tables
- ✅ Seeds: default plans (Free/Starter/Pro/Agency), default roles + permissions, dev admin user
- ✅ `POST /api/v1/core/auth/register` — create user + workspace
- ✅ `POST /api/v1/core/auth/login` — JWT issuance + refresh cookie
- ✅ `POST /api/v1/core/auth/refresh-token`
- ✅ `POST /api/v1/core/auth/logout`
- ✅ `GET /api/v1/core/users/me` — authenticated
- ✅ `GET /health` — DB + service status
- ✅ `GET /ready` / `GET /live`

## Dev login

After first boot:
- Email: `admin@yourplatform.local`
- Password: `AdminDev1234!`

## Next (Phase 1)

- Workspaces CRUD + member management
- Email verification + password reset
- 2FA setup
- Stripe subscription integration
- Audit log middleware
- Agency white-label settings

See [microservices/01-marketing-core.md](../../microservices/01-marketing-core.md) for the full spec.
