# Next.js Migration Scaffold

This folder is the starting point for replacing the FastAPI + Jinja app
with a full Next.js app.

## Why this shape

- `app/` replaces server-rendered Jinja routes
- `prisma/` replaces SQLAlchemy models for the new stack
- `app/api/` replaces FastAPI route handlers
- `lib/auth.ts` verifies the **existing Argon2 password hashes**, so you
  do not need to reset users during migration

## Current migration status

- Prisma schema mirrors the current Postgres tables
- Dashboard, months, goals, and invest pages exist as server-component
  placeholders reading real DB data
- Login/logout route handlers exist
- Shared shell exists, but it is intentionally minimal

## Recommended migration order

1. Install dependencies:

```bash
cd web
npm install
```

2. Copy env:

```bash
cp .env.example .env.local
```

3. Generate Prisma client:

```bash
npm run prisma:generate
```

4. Start the app:

```bash
npm run dev
```

## Cutover strategy

1. Keep FastAPI live while you rebuild the UI in Next.
2. Point Next directly at the same Postgres database first.
3. Recreate each page in this order:
   - `/login`
   - `/`
   - `/months`
   - `/months/new` and edit
   - `/goals`
   - `/invest`
4. After parity, replace FastAPI mutations with Next route handlers.
5. Only then retire the Python web layer.

## Important note

Do not try to migrate both the UI and the financial engine at the same
time. First move rendering and forms. Then move the advanced
robo-advisor/data pipeline.
