# CAF Admin Security System

This project now includes a complete admin authentication and authorization system for Next.js 16 (App Router), with backend-first enforcement.

## Security Features

- Admin-only access for `/admin` pages
- Secure login/logout with `httpOnly` auth cookie
- Role-based access control (RBAC) with deny-by-default behavior
- Server-side session validation on every sensitive request
- Route protection at two layers:
  - `proxy.ts` (request boundary)
  - server guards inside pages/APIs (source of truth)
- Proper status codes:
  - `401` unauthenticated
  - `403` authenticated but unauthorized
- Brute-force defenses:
  - login rate limiting (IP + email)
  - account lockout after repeated failures
- Session security:
  - expiration + idle timeout
  - session invalidation on logout
  - user-agent mismatch revokes session
- CSRF protection for state-changing requests (Origin/Referer validation)
- Security event logging + admin audit logging
- Public recipe submissions separated from admin recipe management

## Setup

1. Install dependencies:
```bash
npm install
```


`test`

2. Create environment file:
```bash
cp .env.example .env.local
```

3. Set a strong `AUTH_TOKEN_SECRET` in `.env.local`.
4. Configure database connection values in `.env.local`:
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
   - Managed MySQL (e.g. Aiven): set `DB_SSL_MODE=REQUIRED` (or `VERIFY_CA` with `DB_SSL_CA`)
   - On Vercel/serverless, reduce DB pressure:
     - `DB_CONNECTION_LIMIT=2`
     - `DB_MAX_IDLE=1`
     - `DB_IDLE_TIMEOUT_MS=60000`
   - In production, set `APP_ORIGIN` to your deployed domain (for CSRF checks), for example:
     - `APP_ORIGIN=https://caf-sand.vercel.app`

5. Create/update the first admin user:
```bash
npm run auth:create-user -- --email admin@example.com --password "StrongPass123!"
```

6. Start dev server:
```bash
npm run dev
```

## Admin Flows

1. **Unauthenticated -> Admin route**
- Visiting `/admin` redirects to `/login?next=/admin`.

2. **Authenticated non-admin -> Admin route/API**
- Page access is redirected to `/access-denied`.
- API access returns `403`.

3. **Authenticated admin -> Admin route/API**
- Access granted.
- Sensitive actions are checked on each request and logged in `admin_audit_logs`.

4. **Expired/invalid session**
- Admin pages redirect to `/login`.
- Admin APIs return `401`.

## Protected Areas

- Admin pages: `/admin`, `/admin/roasters`, `/admin/recipes`
- Admin APIs:
  - `/api/roasters` (`GET`, `POST`)
  - `/api/roasters/[slug]` (`PUT`, `DELETE`)
  - `/api/recipes` (`GET`, `POST`)
  - `/api/recipes/[slug]` (`PATCH`, `DELETE`)
  - `/api/site-metrics` (`GET`)

## Public vs Admin APIs

- Admin recipe create/edit/delete is protected.
- Public user recipe input now goes to:
  - `/api/recipe-submissions` (stored as pending submissions)
