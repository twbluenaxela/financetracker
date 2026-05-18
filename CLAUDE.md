# financetracker

Family finance tracker — monthly cash flow, savings goals, investment planning. UI is in Traditional Chinese (zh-TW). Currency is TWD.

## Tech stack

- **Next.js 15** (App Router, React Server Components, TypeScript strict)
- **Firebase Auth** — email/password + Google; session cookies via Admin SDK
- **Prisma + PostgreSQL** — all financial data
- **Zod** — API input validation
- No UI component library — custom CSS with design tokens

## Running locally

```bash
npm run dev       # dev server at http://localhost:3000
npm run build     # production build
npm run start     # serve production build
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

```
DATABASE_URL                      # PostgreSQL connection string
NEXT_PUBLIC_FIREBASE_API_KEY      # Firebase project web API key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN  # <project-id>.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID   # Firebase project ID
NEXT_PUBLIC_FIREBASE_APP_ID       # Firebase web app ID
FIREBASE_ADMIN_PROJECT_ID         # same project ID (server-only)
FIREBASE_ADMIN_CLIENT_EMAIL       # service account client_email
FIREBASE_ADMIN_PRIVATE_KEY        # service account private_key (with \n literals)
```

Firebase console: enable **Email/Password** and **Google** under Authentication → Sign-in method.

## Database

```bash
npx prisma migrate dev    # apply migrations
npx prisma studio         # browse data in browser
npx prisma generate       # regenerate client after schema change
```

## Project structure

```
app/
  (protected)/            # all authenticated pages; layout.tsx enforces auth
    page.tsx              # dashboard
    months/               # monthly cash flow list + new/edit forms
    goals/                # savings goals
    invest/               # investment calculator
    statements/           # three-statement financial view
  api/
    auth/login/           # POST — exchange Firebase ID token for session cookie
    auth/logout/          # POST — revoke and clear session cookie
    dashboard/            # GET  — dashboard data
    goals/                # POST — upsert goal; [id]/DELETE
    invest/               # POST — upsert investment plan
    months/               # POST — upsert monthly summary; [year]/[month]/DELETE
  login/                  # public login page
  globals.css             # design tokens + global styles (no Tailwind)
  layout.tsx              # root layout — loads Google fonts

components/
  app-shell.tsx           # outer grid (sidebar + main)
  sidebar.tsx             # nav, user pill, logout

lib/
  auth.ts                 # session management (server-only)
  firebase.ts             # client SDK init
  firebase-admin.ts       # admin SDK init (server-only)
  prisma.ts               # Prisma singleton
  dashboard.ts            # dashboard data query
  statements.ts           # StatementBundle builder + formatting helpers
  wealth.ts               # goal PMT calculation + money formatters
  invest.ts               # blended return, growth schedules, allocation recommender

prisma/
  schema.prisma           # DB schema
```

## Key conventions

- **Server components by default.** Client components are `"use client"` and live in `*-view.tsx` or `*-form.tsx` files alongside their server page.
- **Auth pattern:** server pages call `requireUser()` (redirects to /login if no session); API routes call `getSessionUser()` and return 401.
- **API pattern:** auth check → Zod parse → Prisma → `{ ok: true }`.
- **No Prisma in client components.** Pages fetch via their own API routes or receive data as props from the RSC parent.
- **`server-only`** is imported in `lib/auth.ts` and `lib/firebase-admin.ts` to prevent accidental client bundle inclusion.
- **Decimal fields** come out of Prisma as `Decimal` objects — always wrap with `Number()` before math or serialization.
- **`@/`** path alias maps to project root (e.g. `@/lib/auth`).
- **CSS classes** are hand-written in `globals.css`. Design tokens are CSS custom properties (`--bg`, `--accent`, `--text`, etc.). No Tailwind.
- **InvestmentPlan is a singleton** — always `id: 1`. Use upsert.
