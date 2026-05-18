# Next.js Migration Plan

## Decision

Move to **Next.js App Router + Prisma + route handlers** and retire the
FastAPI + Jinja rendering layer.

## Why this is the correct cut

- Your roadmap is frontend-heavy: charts, allocation tooling, market
  overlays, portfolio drilldowns, and AI summaries.
- Jinja is already becoming friction instead of leverage.
- Keeping the same Postgres database avoids a risky data migration in the
  first cut.

## Stack

- Frontend + server rendering: Next.js
- Database ORM: Prisma
- Auth/session: custom cookie session with `jose`
- Password compatibility: `@node-rs/argon2`
- Charts: `recharts`
- Validation: `zod`
- Gemini: `@google/genai`

## Route mapping

- `GET /login` -> `app/login/page.tsx`
- `POST /login` -> `app/api/auth/login/route.ts`
- `POST /logout` -> `app/api/auth/logout/route.ts`
- `GET /` -> `app/page.tsx`
- `GET /months` -> `app/months/page.tsx`
- `GET /months/new` -> add `app/months/new/page.tsx`
- `GET /months/[year]/[month]/edit` -> add dynamic segment page
- `POST /months` -> add `app/api/months/route.ts`
- `POST /months/[year]/[month]/delete` -> add delete route
- `GET /goals` -> `app/goals/page.tsx`
- `POST /goals` -> add `app/api/goals/route.ts`
- `GET /invest` -> `app/invest/page.tsx`
- `POST /invest` -> add `app/api/invest/route.ts`

## Migration phases

### Phase 1: Infrastructure parity

- Stand up the Next app in `web/`
- Connect Prisma to the existing Postgres database
- Keep schema names mapped to the current tables
- Verify login against existing Argon2 hashes

### Phase 2: Read-only parity

- Dashboard page
- Months list
- Goals list with PMT logic
- Investment plan page

### Phase 3: Mutation parity

- Month create/edit/delete
- Goal create/edit/delete
- Investment plan update

### Phase 4: Product upgrade

- Portfolio tables
- Market data ingestion
- Technical indicators
- Backtesting
- Gemini summary

## Non-goals for the first cut

- Rewriting the financial math again
- Replacing Postgres
- Reworking user accounts
- Building real-time websockets

## Operational advice

- Freeze new Jinja work now.
- Put all new UI work into `web/`.
- Treat FastAPI as legacy once the Next app is bootstrapped.
