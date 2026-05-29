# @marketing/web

React 18 + Vite 5 + TypeScript + MUI v6 + Redux Toolkit + React Router 6.

## Dev

```bash
# From repo root
yarn install
yarn dev:web       # starts vite on :3000

# In another terminal
yarn dev:core      # starts marketing-core on :3100
```

Vite proxies `/api/*` → `http://localhost:3100`, so the SPA can call the API via relative URLs.

## What's here (Phase 0)

- ✅ MUI theme + CssBaseline + global SnackbarProvider
- ✅ Redux Toolkit store (auth slice)
- ✅ React Router v6 with `<RequireAuth>` guard
- ✅ Axios with auth header + 401 redirect
- ✅ Login page (form validation via zod + react-hook-form)
- ✅ Register page
- ✅ Dashboard layout with sidebar + 20-module nav
- ✅ Overview page (empty states; calls `/users/me`)

## What's next

- Onboarding wizard
- Module pages (SEO, Campaigns, etc.) — empty states per `design-system.md`
- Workspace switcher (for agency owners)
- 2FA setup UI

See [doc.md](../doc.md) Frontend Screens for the full route map.
