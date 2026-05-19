# financetracker

Family finance tracker for shared monthly cash flow, savings goals, and investment planning. UI is in Traditional Chinese (zh-TW). Currency is TWD.

Live: **https://financetrackertw.fly.dev**

## Features

- **Dashboard** — current-month hero, 12-month cashflow sparkline, category breakdown, savings goals
- **Monthly ledger** — income/expense entries with category lines and notes
- **財務報表** — interactive financial reports: cash flow chart, category heatmap, P&L table, balance sheet, expense deep-dive
- **Savings goals** — short/medium/long-term goals with progress tracking and auto-allocation
- **Households** — shared ledger with invite links, member management, and per-member edit permissions

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, RSC, TypeScript strict) |
| Auth | Firebase Auth — email/password + Google sign-in |
| Database | PostgreSQL on Neon (serverless) |
| ORM | Prisma 5 |
| Deployment | Fly.io (Tokyo / nrt region) |
| Validation | Zod |
| Styling | Custom CSS with design tokens, no component library |

## Local development

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # production build
npm run start     # serve production build
```

Both local and production point to the same Neon database — edits sync in real time.

## Environment variables

Copy `.env.example` to `.env.local`:

```
DATABASE_URL                       # Neon PostgreSQL connection string
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_APP_ID
FIREBASE_ADMIN_PROJECT_ID
FIREBASE_ADMIN_CLIENT_EMAIL
FIREBASE_ADMIN_PRIVATE_KEY         # paste with \n literals, not real newlines
```

## Database

Schema is managed via `prisma db push` — no migration files.

```bash
npx prisma db push        # push schema to Neon
npx prisma studio         # browse data in browser
npx prisma generate       # regenerate client after schema change
```

## Deployment

Deploys to Fly.io via Docker. The release command runs `prisma db push` before each deploy.

```bash
fly deploy
fly logs -a financetrackertw
fly secrets set KEY=value -a financetrackertw
```

`NEXT_PUBLIC_*` vars are baked into the image at build time — set them as Fly secrets so they're available during `fly deploy`.

## Firebase setup

Firebase project: `financetracker-c0cea`

In Firebase Console → Authentication → Sign-in method, enable:
- Email/Password
- Google
