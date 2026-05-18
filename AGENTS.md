# Architecture reference for agents

Read this before making changes. It describes the intent behind the structure, not just what the code does.

---

## Auth

**Files:** `lib/firebase.ts`, `lib/firebase-admin.ts`, `lib/auth.ts`, `app/api/auth/login/route.ts`, `app/api/auth/logout/route.ts`, `app/login/`

### How it works

Auth is split across two Firebase SDKs:

**Client side (`lib/firebase.ts`):** Initializes the Firebase client app using `NEXT_PUBLIC_*` env vars. Used only in the login form (`"use client"`). Calls `signInWithEmailAndPassword` or `signInWithPopup(googleProvider)`, then gets an ID token from the credential.

**Server side (`lib/firebase-admin.ts`):** Initializes the Firebase Admin SDK using service account credentials (server-only env vars). Lazy-initialized inside a function so env vars are available at call time, not module load time. Both this file and `lib/auth.ts` have `import "server-only"` at the top — this causes a build error if they ever leak into the client bundle.

**Session flow:**
1. Login form signs in with Firebase client SDK → gets a short-lived ID token (1 hour)
2. Form POSTs the ID token to `/api/auth/login`
3. Server calls `adminAuth.createSessionCookie(idToken, { expiresIn: 14 days })`
4. Cookie is set `httpOnly`, `sameSite: lax`, `secure` in production
5. Every protected server component calls `requireUser()` → `adminAuth.verifySessionCookie(cookie, true)` → returns `{ uid, email, name }`
6. Logout: POSTs to `/api/auth/logout` → revokes Firebase refresh tokens → deletes cookie

### What `requireUser` returns

```ts
{ uid: string; email: string | null; name: string | null }
```

This is NOT a database row. Firebase owns identity. To associate DB data with a user, use `uid` as the foreign key.

### Things to know

- `verifySessionCookie(cookie, true)` — the `true` checks token revocation on every request. This is how logout immediately invalidates sessions.
- Firebase project: `financetracker-c0cea`. Sign-in methods enabled: Email/Password, Google.
- The `User` table in Postgres is a legacy remnant from the Python era. It is unused — Firebase is the source of truth for identity.

---

## Database

**Files:** `lib/prisma.ts`, `prisma/schema.prisma`

### Infrastructure

Database: **Neon** (serverless PostgreSQL). Both local dev and production point to the same Neon instance — changes sync in real time. Connection string uses the pooled endpoint (`-pooler` in the hostname) with `sslmode=require&channel_binding=require`.

Schema is managed with **`prisma db push`** — there are no migration files. Do not run `prisma migrate dev`. After any schema change, run `npx prisma db push` then `fly deploy` (the release command runs `db push` automatically).

### Prisma singleton

`lib/prisma.ts` stores the client on `globalThis` to survive Next.js hot reloads in dev. Always import from `@/lib/prisma`, never instantiate `PrismaClient` directly.

### Prisma binary targets

`schema.prisma` specifies `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]`. The second target is required for Fly.io (Alpine Linux + OpenSSL 3). Without it Prisma can't find its query engine at runtime.

### Schema

| Model | Purpose |
|---|---|
| `User` | Legacy from Python/argon2 era. Unused — do not write to it. Remove when convenient. |
| `MonthlySummary` | One row per calendar month. `totalIncome`, `totalExpense`, optional `note`. Has-many `CategoryLine`. Unique on `(year, month)`. |
| `CategoryLine` | Named income or expense line item. `kind` is `"income"` or `"expense"`. Belongs to `MonthlySummary`, cascades on delete. |
| `Goal` | Savings goal with target/current amounts, expected annual return, optional deadline, priority. |
| `InvestmentPlan` | Singleton (always `id: 1`). Asset allocation percentages, return assumptions, contribution plan. Always upsert. |

### Things to know

- **Decimal fields** come out of Prisma as `Decimal` objects. Always `Number(row.field)` before math or JSON serialization.
- **`MonthlySummary` save pattern:** deletes all `CategoryLine` children then recreates them. No partial line updates — always a full replace.

---

## API routes

**Files:** `app/api/`

### Pattern

Every route follows the same three steps:

```ts
const user = await getSessionUser();
if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

const parsed = schema.safeParse(await request.json());
if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

// prisma call
return NextResponse.json({ ok: true });
```

Never skip the auth check. Never call Prisma without validating input first.

### Route map

| Route | Method | What it does |
|---|---|---|
| `/api/auth/login` | POST | Accepts `{ idToken }`, creates Firebase session cookie |
| `/api/auth/logout` | POST | Revokes Firebase session, clears cookie |
| `/api/dashboard` | GET | Returns last 12 months + goals data |
| `/api/goals` | POST | Upsert goal (pass `id` to update, omit to create) |
| `/api/goals/[id]` | DELETE | Delete a goal by id |
| `/api/invest` | POST | Upsert the singleton InvestmentPlan (always id=1) |
| `/api/months` | POST | Upsert monthly summary + category lines |
| `/api/months/[year]/[month]` | DELETE | Delete monthly summary (cascades to lines) |

### Things to know

- The dashboard page calls `getDashboardData()` directly (RSC, no HTTP hop). `/api/dashboard` exists for future client-side use.
- All mutation routes are POST with upsert semantics — no PUT/PATCH.
- Zod schemas are inline in each route file.

---

## Financial logic

**Files:** `lib/dashboard.ts`, `lib/statements.ts`, `lib/wealth.ts`, `lib/invest.ts`

### `lib/wealth.ts` — goal math + formatting

`calculateGoalPmt(targetAmount, currentAmount, annualRate, months)` — PMT formula for savings. Returns the monthly contribution needed to reach the target. Returns 0 if already funded.

Formatters:
- `formatMoney(n)` — `NT$1,234` via `Intl.NumberFormat`
- `money(n)` / `moneyPlain(n)` — en-US comma format, used on dashboard
- `compactMoney(n)` — abbreviates to `萬`, `K`, `M`

### `lib/invest.ts` — investment calculations

- `blendedReturn(input)` — weighted average return from TW stock / US stock / bond percentages
- `lumpSumSchedule(principal, annualRate, years)` — year-by-year compound growth table
- `periodicSchedule(annualContribution, annualRate, years)` — year-by-year recurring contribution table
- `yearsToTarget(input)` — how many years until balance hits target; returns `null` if never
- `recommendAllocation(age, risk, horizonYears)` — Bogleheads rule-of-thumb allocator. Returns percentages + Chinese-language rationale strings.

### `lib/statements.ts` — three-statement bundle

`buildStatements(months, goals, plan)` → `StatementBundle`. Sorts months chronologically, computes surplus/savings rate/cumulative cash per month, rolls up totals, approximates net worth as `max(0, cumulativeCash) + goalAssets + investmentAssets`.

Also contains formatting helpers (`monthLabel`, `monthChinese`, `money`, `compactMoney`) used across pages.

### `lib/dashboard.ts` — dashboard query

`getDashboardData()` — fetches last 12 months with lines + all goals. For each goal derives `monthsRemaining` from `targetDate` (defaults to 360 if no date) and runs `calculateGoalPmt`. Returns plain JS — all `Decimal` converted to `number`.

### Things to know

- The dashboard page has its own inline `money()` / `compact()` helpers that differ slightly from `lib/statements.ts` (different locale formatting). Intentional for now, consolidate later.
- `InvestmentPlan.startingCapital` is used as current investment assets in net worth. It doesn't compound in the statements view — a known simplification.

---

## Pages and routing

**Files:** `app/`

### Route structure

```
/                           → dashboard (RSC)
/statements                 → three-statement view (RSC + client view)
/months                     → monthly list (RSC + client view)
/months/new                 → new month form (client)
/months/[year]/[month]/edit → edit form (client)
/goals                      → goals manager (RSC + client view)
/invest                     → investment calculator (client)
/login                      → public login page
```

### RSC + client view pattern

Every protected page splits into two files:

- `page.tsx` — Server Component. Queries Prisma, shapes data into plain JS, passes as props to a client component.
- `*-view.tsx` / `*-form.tsx` — `"use client"`. Owns all interactivity, mutations via `fetch()` to API routes. Never imports Prisma.

### Protected layout

`app/(protected)/layout.tsx` calls `requireUser()`. Redirects to `/login` if no session. The `(protected)` folder name is a Next.js route group — it doesn't appear in URLs.

### Things to know

- `typedRoutes: true` in `next.config.ts` — `<Link href>` values are type-checked against your actual routes.
- Month form (`app/months/month-form.tsx`): Tab on the amount input of the last category row creates a new row and focuses its name input automatically.

---

## Deployment

**Files:** `Dockerfile`, `fly.toml`

### Fly.io

App name: `financetrackertw`. Region: `nrt` (Tokyo). Machine: `shared-cpu-1x`, 512mb RAM.

The Dockerfile is a three-stage build:
1. **deps** — `npm ci` on Alpine
2. **builder** — runs `prisma generate` + `npm run build` (Next.js standalone output)
3. **runner** — copies standalone output + `node_modules` (needed for prisma CLI) + prisma schema. Runs as non-root `nextjs` user. Adds `openssl` via `apk`.

`output: "standalone"` is set in `next.config.ts` — required for the Docker runner to work without all of `node_modules` present.

Release command: `node_modules/.bin/prisma db push` — runs before each deploy to sync schema. Uses the local binary (not `npx prisma`) to avoid downloading the wrong version.

Health check hits `/login` (always returns 200, no auth required).

### Secrets

All env vars are set as Fly secrets (`fly secrets set -a financetrackertw`). `NEXT_PUBLIC_*` vars must also be set as secrets because Next.js bakes them into the image at build time — Fly injects them into the build environment.

### Things to know

- `prisma generate` in the builder stage must run before `npm run build`, otherwise the Prisma client types are missing during compilation.
- `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` in `schema.prisma` is required — without it, Prisma can't find its engine binary on Alpine.
- `node_modules` is copied into the runner (not just the standalone output) because `prisma db push` needs the full CLI at release time.
- Do not use `npx prisma` in the release command — it downloads the latest Prisma version which may be a breaking major.

---

## UI and styling

**Files:** `app/globals.css`, `components/`

### Design tokens

All colors, spacing, and radii are CSS custom properties at the top of `globals.css`:

```css
:root {
  --bg, --bg-elev, --panel, --panel-hi    /* dark backgrounds */
  --border, --border-soft, --border-strong
  --text, --text-soft, --muted, --faint
  --pos, --neg, --warn, --info, --accent  /* semantic colors */
  --radius, --radius-sm, --radius-lg
  --shadow-card
}
```

Dark-only design (`color-scheme: dark` on `html`). `--accent` and `--pos` are the same green — `--accent` for interactive elements, `--pos` for positive financial values.

### Typography

Three fonts via `next/font/google` in `app/layout.tsx`:
- **Manrope** — primary UI sans-serif
- **Noto Sans TC** — Traditional Chinese characters
- **JetBrains Mono** — numbers, amounts, keyboard shortcuts (`.num`, `.amount`, `kbd`)

### Class conventions

No component library. All styling via semantic class names in `globals.css`:
- `.card`, `.card-head`, `.card-title` — panels
- `.topbar`, `.topbar-actions` — page header
- `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-danger` — buttons
- `.chip`, `.chip-pos`, `.chip-neg`, `.chip-muted` — stat badges
- `.field` — form field wrapper
- `.num`, `.amount`, `.currency` — monospace number display
- `.pos` / `.neg` — green/red semantic utilities
- `.muted`, `.faint` — text color utilities

CSS is one file, organized by section headers. No CSS modules — all class names are global.

---

## Planned: Households

The app currently has no user isolation — all data is shared. The planned architecture:

- `Household` — name, owner Firebase UID
- `HouseholdMember` — links Firebase UIDs to a household with a role (`owner` / `member`)
- `HouseholdInvite` — time-limited token for invite links; one-time use
- All financial models (`MonthlySummary`, `Goal`, `InvestmentPlan`) get a `householdId` foreign key
- First login → create a household automatically if user doesn't belong to one
- Accepting an invite merges you into the inviter's household
- Default member permission: view-only. Owner can grant edit access per member.
- Every Prisma query must be scoped by `householdId` after this is built.
