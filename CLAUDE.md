# financetracker

Family finance tracker — monthly cash flow, savings goals, investment planning. UI is in Traditional Chinese (zh-TW). Currency is TWD.

Live: https://financetrackertw.fly.dev

## Tech stack

- **Next.js 15** (App Router, React Server Components, TypeScript strict)
- **Firebase Auth** — email/password + Google; session cookies via Admin SDK
- **Prisma 5 + Neon PostgreSQL** — all financial data (serverless Postgres)
- **Zod** — API input validation
- **Fly.io** — deployment (Tokyo / nrt region, shared-cpu-1x, 512mb)
- No UI component library — custom CSS with design tokens

## Running locally

```bash
npm run dev       # dev server at http://localhost:3000
npm run build     # production build
npm run start     # serve production build
```

Both local and production point to the same Neon database — changes sync in real time.

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

```
DATABASE_URL                      # Neon PostgreSQL connection string (postgresql://...)
NEXT_PUBLIC_FIREBASE_API_KEY      # Firebase project web API key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN  # financetracker-c0cea.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID   # financetracker-c0cea
NEXT_PUBLIC_FIREBASE_APP_ID       # Firebase web app ID
FIREBASE_ADMIN_PROJECT_ID         # financetracker-c0cea (server-only)
FIREBASE_ADMIN_CLIENT_EMAIL       # service account client_email (server-only)
FIREBASE_ADMIN_PRIVATE_KEY        # service account private_key with \n literals (server-only)
```

Firebase console: enable **Email/Password** and **Google** under Authentication → Sign-in method.

## Database

Schema is managed with `prisma db push` — there are no migration files.

```bash
npx prisma db push        # sync schema changes to Neon
npx prisma studio         # browse data in browser
npx prisma generate       # regenerate client after schema change
```

After any schema change: run `prisma db push`, commit the updated `schema.prisma`, and `fly deploy`. The release command runs `prisma db push` automatically on each deploy.

## Deployment

```bash
fly deploy                          # build, push image, run release command, deploy
fly logs -a financetrackertw        # tail live logs
fly secrets list -a financetrackertw
fly secrets set KEY=value -a financetrackertw
```

## Project structure

```
app/
  (protected)/            # all authenticated pages; layout.tsx enforces auth
    page.tsx              # dashboard
    months/               # monthly cash flow list + new/edit forms
    goals/                # savings goals
    statements/           # three-statement financial view
    settings/             # household settings — members, permissions, invite links
  api/
    auth/login/           # POST — exchange Firebase ID token for session cookie
    auth/logout/          # POST — revoke and clear session cookie
    dashboard/            # GET  — dashboard data (scoped to household)
    goals/                # POST — upsert goal; [id]/DELETE
    months/               # POST — upsert monthly summary; [year]/[month]/DELETE
    invite/               # POST — generate invite token (owner only)
    invite/[token]/       # POST — accept invite (joins caller to household)
    household/members/[uid]/  # PATCH canEdit, DELETE member (owner only)
  invite/[token]/         # public invite acceptance page (no auth gate — handles it inline)
  login/                  # public login page
  globals.css             # design tokens + global styles (no Tailwind)
  layout.tsx              # root layout — loads Google fonts

components/
  app-shell.tsx           # outer grid (sidebar + main), collapsible sidebar state
  sidebar.tsx             # nav, user pill, logout, collapse toggle

lib/
  auth.ts                 # session management (server-only); requireUser returns SessionUser
  household.ts            # getOrCreateHousehold — auto-provisions on first login
  firebase.ts             # client SDK init
  firebase-admin.ts       # admin SDK init (server-only)
  prisma.ts               # Prisma singleton
  dashboard.ts            # getDashboardData(householdId)
  statements.ts           # StatementBundle builder + formatting helpers
  wealth.ts               # goal PMT calculation + money formatters
  invest.ts               # blended return, growth schedules, allocation recommender

prisma/
  schema.prisma           # DB schema (push-based, no migration files)

Dockerfile                # multi-stage Node 22 Alpine build for Fly.io
fly.toml                  # Fly.io config — app: financetrackertw, region: nrt
```

## Key conventions

- **Server components by default.** Client components are `"use client"` and live in `*-view.tsx` or `*-form.tsx` files alongside their server page.
- **Auth pattern:** server pages call `requireUser()` (redirects to /login if no session); API routes call `getSessionUser()` and return 401.
- **Household scoping:** every Prisma query on financial data (`MonthlySummary`, `Goal`, `InvestmentPlan`) must include `where: { householdId: user.householdId }`. Never query without it.
- **Permission check:** mutation API routes check `user.canEdit` (or `user.role === "owner"` for admin actions) before touching the DB.
- **API pattern:** auth check → permission check → Zod parse → Prisma → `{ ok: true }`.
- **No Prisma in client components.** Pages fetch via their own API routes or receive data as props from the RSC parent.
- **`server-only`** is imported in `lib/auth.ts`, `lib/household.ts`, and `lib/firebase-admin.ts` to prevent accidental client bundle inclusion.
- **Decimal fields** come out of Prisma as `Decimal` objects — always wrap with `Number()` before math or serialization.
- **`@/`** path alias maps to project root (e.g. `@/lib/auth`).
- **CSS classes** are hand-written in `globals.css`. Design tokens are CSS custom properties (`--bg`, `--accent`, `--text`, etc.). No Tailwind.
- **InvestmentPlan is per-household** — unique on `householdId`. Use `upsert` with `where: { householdId }`. There is no longer a singleton id=1.
- **No migration files** — schema changes go through `prisma db push`. Do not run `prisma migrate dev`.

## Households

Every user belongs to exactly one household. On first login, `getOrCreateHousehold(uid)` (called inside `getSessionUser`) auto-creates a household and makes the user its owner.

`requireUser()` and `getSessionUser()` both return:
```ts
{
  uid: string;
  email: string | null;
  name: string | null;
  householdId: number;
  role: string;       // "owner" | "member"
  canEdit: boolean;
}
```

Invite links are one-time-use, 7-day tokens stored in `household_invites`. They are valid across Fly machine restarts because the token lives in Neon, not in memory.

## Planned features

- **Robo-advisor** — Gemini API integration for AI financial advice. `GEMINI_API_KEY` is already in env, not yet wired up.
