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

## Neon Baseline (Vercel)

The project now runs on Neon PostgreSQL by default on Vercel:

- `lib/neon.ts` (pooled Postgres connection via `pg`)
- `lib/db.ts` (runtime DB layer, prefers `DATABASE_URL`)
- `scripts/check-neon-connection.mjs` (CLI health check)
- `scripts/migrate-mysql-to-neon.mjs` (data migration from MySQL to Neon)
- `GET /api/health/neon` (runtime health endpoint)

`DATABASE_URL` is now mandatory at runtime. Hidden fallback to MySQL is disabled unless you explicitly set `ALLOW_MYSQL_FALLBACK=1`.

## Neon To Supabase Migration

This repo now includes an end-to-end migration script:

- `scripts/migrate-neon-to-supabase.mjs`
- `npm run db:migrate:neon-to-supabase`

Required env vars for migration:

- `NEON_DATABASE_URL` (or fallback `DATABASE_URL_UNPOOLED` / `DATABASE_URL`)
- `SUPABASE_DATABASE_URL` (target database URL)

What the script does:

1. Exports Neon with `pg_dump` to `backups/neon-to-supabase-<timestamp>/`
2. Creates schema in Supabase with `pg_restore --schema-only`
3. Imports all data with `pg_restore --data-only`
4. Verifies table row counts (source vs target)

Useful commands:

```bash
npm run db:check:neon
npm run db:check:supabase
npm run db:migrate:neon-to-supabase
```

Optional flags:

- `--skip-dump`
- `--skip-restore`
- `--skip-verify`
- `--backup-dir <path>`

## Setup

1. Install dependencies:
```bash
npm install
```


2. Create environment file:
```bash
cp .env.example .env.local
```

3. Set a strong `AUTH_TOKEN_SECRET` in `.env.local`.
4. Configure Neon connection values in `.env.local`:
   - `DATABASE_URL` (pooled Neon URL, recommended for app traffic)
   - Optional: `DATABASE_URL_UNPOOLED` (direct URL for migrations/admin tooling)
   - Optional pool tuning: `PG_CONNECTION_LIMIT`, `PG_IDLE_TIMEOUT_MS`, `PG_CONNECT_TIMEOUT_MS`
5. Verify Neon connection:
```bash
npm run db:check:neon
```
6. (If you are migrating old MySQL data) run dry-run first:
```bash
npm run db:migrate:mysql-to-neon -- --dry-run
```
7. Then run actual migration:
```bash
npm run db:migrate:mysql-to-neon -- --truncate
```
8. Optional runtime check:
```bash
GET /api/health/neon
```
9. In production, set `APP_ORIGIN` to your deployed domain (for CSRF checks), for example:
   - `APP_ORIGIN=https://caf-sand.vercel.app`

10. Create/update the first admin user:
```bash
npm run auth:create-user -- --email admin@example.com --password "StrongPass123!"
```

11. Start dev server:
```bash
npm run dev
```

## MySQL To Neon Migration Notes

- Source MySQL envs:
  - preferred: `SOURCE_DB_HOST`, `SOURCE_DB_PORT`, `SOURCE_DB_USER`, `SOURCE_DB_PASSWORD`, `SOURCE_DB_NAME`
  - fallback: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- Target Neon env:
  - `DATABASE_URL` (or `TARGET_DATABASE_URL`)
- `--truncate` clears target tables before copy (safe for one-time cutover).
- Script is idempotent via `ON CONFLICT` upsert behavior.

## Link Neon With Vercel Project

1. Install Neon from Vercel Marketplace and connect it to this Vercel project.
2. Pull environment variables locally:
```bash
vercel env pull .env.local
```
3. Confirm `DATABASE_URL` exists, then run:
```bash
npm run db:check:neon
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
