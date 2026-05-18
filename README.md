# financetracker

Family finance tracker for tracking monthly cash flow, savings goals, and investment planning. UI is in Traditional Chinese (zh-TW). Currency is TWD.

Live: **https://financetrackertw.fly.dev**

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, RSC, TypeScript strict) |
| Auth | Firebase Auth — email/password + Google sign-in |
| Database | PostgreSQL on Neon (serverless) |
| ORM | Prisma 5 |
| Deployment | Fly.io (Tokyo / nrt region) |
| Validation | Zod |
| Styling | Custom CSS, no component library |

## Local development

```bash
npm install
npm run dev       # http://localhost:3000
```

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

Both local and production point to the same Neon database — edits sync in real time.

## Database

The database schema is managed via `prisma db push` (no migration files). To sync schema changes:

```bash
npx prisma db push        # push schema to Neon
npx prisma studio         # browse data in browser
npx prisma generate       # regenerate client after schema change
```

## Deployment

Deploys to Fly.io via Docker. The release command runs `prisma db push` before each deploy to keep the schema in sync.

```bash
fly deploy
```

Fly secrets required (set with `fly secrets set -a financetrackertw`):
- All env vars above except the `NEXT_PUBLIC_*` ones are injected as secrets
- `NEXT_PUBLIC_*` vars are baked into the image at build time via Docker build args (set them as Fly secrets too — Next.js reads them at build time from the environment)

## Firebase setup

Firebase project: `financetracker-c0cea`

In Firebase Console → Authentication → Sign-in method, enable:
- Email/Password
- Google
