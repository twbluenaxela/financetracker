# Architecture reference for agents

This file explains how each part of the system fits together. Read this before making changes — it describes the intent behind the structure, not just what the code does.

---

## Auth

**Files:** `lib/firebase.ts`, `lib/firebase-admin.ts`, `lib/auth.ts`, `app/api/auth/login/route.ts`, `app/api/auth/logout/route.ts`, `app/login/`

### How it works

Auth is split across two SDKs:

**Client side (`lib/firebase.ts`):** Initializes the Firebase client app using `NEXT_PUBLIC_*` env vars. Used only in the login form (a `"use client"` component). Calls `signInWithEmailAndPassword` or `signInWithPopup(googleProvider)`, gets an ID token from the resulting credential.

**Server side (`lib/firebase-admin.ts`):** Initializes the Firebase Admin SDK using the service account credentials (server-only env vars). Never imported client-side — both this file and `lib/auth.ts` have `import "server-only"` at the top.

**Session flow:**
1. Login form signs in with Firebase client SDK → gets a short-lived ID token (1 hour)
2. Form POSTs the ID token to `/api/auth/login`
3. Server calls `adminAuth.createSessionCookie(idToken, { expiresIn: 14 days })` — Firebase Admin issues a long-lived session cookie
4. Cookie is set as `httpOnly`, `sameSite: lax`, `secure` in production
5. Every protected server component calls `requireUser()` → `adminAuth.verifySessionCookie(cookie, true)` → returns `{ uid, email, name }`
6. Logout: POSTs to `/api/auth/logout` → revokes Firebase refresh tokens → deletes cookie

### What `requireUser` returns

```ts
{ uid: string; email: string | null; name: string | null }
```

This is NOT a database row. There is no `users` table driving auth — Firebase owns identity. If you need to associate DB data with a user, use `uid` as the foreign key.

### Things to know

- `firebase-admin` must never be imported in client components or anywhere that might be bundled client-side. The `server-only` guard will throw a build error if it ever leaks.
- The Admin SDK is initialized lazily inside a function in `firebase-admin.ts` to ensure env vars are available at call time (not module load time).
- `verifySessionCookie(cookie, true)` — the `true` flag checks token revocation on every request. This is intentional; it's how logout invalidates sessions immediately.

---

## Database

**Files:** `lib/prisma.ts`, `prisma/schema.prisma`

### Prisma singleton

`lib/prisma.ts` exports a single `PrismaClient` instance stored on `globalThis` to survive Next.js hot reloads in development. In production there is only one instance per process. Always import from `@/lib/prisma`, never instantiate `PrismaClient` directly.

### Schema

| Model | Purpose |
|---|---|
| `User` | Legacy table from Python era — no longer used for auth. Can be removed once you confirm nothing depends on it. |
| `MonthlySummary` | One row per calendar month. Stores `totalIncome`, `totalExpense`, optional `note`. Has-many `CategoryLine`. Unique on `(year, month)`. |
| `CategoryLine` | A named income or expense line item belonging to a `MonthlySummary`. `kind` is `"income"` or `"expense"`. |
| `Goal` | A savings goal with target amount, current amount, expected annual return, optional deadline, and priority order. |
| `InvestmentPlan` | Singleton (always `id: 1`). Stores asset allocation percentages, return assumptions, and contribution plan. Use upsert. |

### Things to know

- **Decimal fields** (`totalIncome`, `targetAmount`, etc.) come out of Prisma as `Decimal` objects, not JavaScript numbers. Always wrap with `Number()` before doing math or returning JSON: `Number(row.totalAmount)`.
- **`MonthlySummary` upsert pattern:** the `/api/months` route deletes all `CategoryLine` children then recreates them on every save — no partial line updates. This keeps the logic simple.
- The `User` model still has `passwordHash` — leftover from the Python/argon2 auth. It's unused. Leave it until you're ready to write and run a migration to drop it.

---

## API routes

**Files:** `app/api/`

### Pattern

Every route follows the same three-step pattern:

```ts
const user = await getSessionUser();
if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

const parsed = schema.safeParse(await request.json());
if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

// ... prisma call ...
return NextResponse.json({ ok: true });
```

Auth check → Zod validation → Prisma → respond. Never skip the auth check. Never call Prisma without validating input first.

### Route map

| Route | Method | What it does |
|---|---|---|
| `/api/auth/login` | POST | Accepts `{ idToken }`, creates Firebase session cookie |
| `/api/auth/logout` | POST | Revokes Firebase session, clears cookie |
| `/api/dashboard` | GET | Returns last 12 months + goals data |
| `/api/goals` | POST | Upsert goal (pass `id` to update, omit to create) |
| `/api/goals/[id]` | DELETE | Delete a goal by id |
| `/api/invest` | POST | Upsert the singleton InvestmentPlan (always id=1) |
| `/api/months` | POST | Upsert a monthly summary + its category lines |
| `/api/months/[year]/[month]` | DELETE | Delete a monthly summary (cascades to lines) |

### Things to know

- The dashboard page (`app/(protected)/page.tsx`) does NOT call `/api/dashboard` — it calls `getDashboardData()` directly from the server component, since it's already server-side. The `/api/dashboard` route exists for future client-side use.
- All mutation routes are POST, not PUT/PATCH, because every save is a full replace (upsert semantics).
- Zod schemas are defined inline at the top of each route file — no shared schema library.

---

## Financial logic

**Files:** `lib/dashboard.ts`, `lib/statements.ts`, `lib/wealth.ts`, `lib/invest.ts`

### `lib/wealth.ts` — goal math

`calculateGoalPmt(targetAmount, currentAmount, annualRate, months)` — standard PMT formula adapted for savings. Answers: "given my current savings, expected return, and deadline, how much do I need to invest per month?" Returns 0 if already funded.

Money formatting helpers used across pages:
- `formatMoney(n)` — `NT$1,234` via `Intl.NumberFormat`
- `money(n)` / `moneyPlain(n)` — simpler en-US formatted variants used in the dashboard page
- `compactMoney(n)` — abbreviates to `萬`, `K`, `M` for charts

### `lib/invest.ts` — investment calculations

`blendedReturn(input)` — weighted average annual return from TW stock / US stock / bond percentages and their individual return rates.

`lumpSumSchedule(principal, annualRate, years)` — yearly balance table for a one-time deposit growing at compound interest.

`periodicSchedule(annualContribution, annualRate, years)` — yearly balance table for recurring annual contributions.

`yearsToTarget(input)` — iterates year-by-year to find how long until balance crosses the target. Returns `null` if never reached within `maxYears`.

`recommendAllocation(age, risk, horizonYears)` — Bogleheads-style rule-of-thumb allocator. Starts with bond% ≈ age, adjusts for risk tolerance and time horizon. Returns `{ bondPct, usStockPct, twStockPct, rationale[] }`.

### `lib/statements.ts` — three-statement bundle

`buildStatements(months, goals, plan)` computes a `StatementBundle` — a single object that the Statements page renders. It:
- Sorts months chronologically
- Computes surplus, savings rate, and running cumulative cash for each month
- Rolls up totals across all months
- Computes a net worth approximation: `max(0, cumulativeCash) + goalAssets + investmentAssets`

Formatting helpers (`monthLabel`, `monthChinese`, `money`, `compactMoney`) are also in this file and used across multiple pages.

### `lib/dashboard.ts` — dashboard query

Single function `getDashboardData()`. Fetches last 12 months with their lines, plus all goals. For each goal, derives `monthsRemaining` from `targetDate` (defaults to 360 months / 30 years if no date) and calls `calculateGoalPmt` to compute the required monthly contribution. Returns plain JS objects — all `Decimal` fields converted to `number`.

### Things to know

- There is intentional duplication between the dashboard page and the statements lib — the dashboard has its own inline `money()` / `compact()` helpers with slightly different formatting from `lib/statements.ts`. They serve the same purpose but format differently (dashboard uses en-US commas; statements use zh-TW style). Consolidate when you get around to it.
- `InvestmentPlan.startingCapital` is treated as current investment assets for net worth purposes in `buildStatements`. This is a simplification — it doesn't compound over time in the statements view.

---

## Pages and routing

**Files:** `app/`

### Route structure

```
/           → app/(protected)/page.tsx          — dashboard (RSC)
/statements → app/(protected)/statements/       — three-statement view (RSC + client view)
/months     → app/(protected)/months/           — monthly list (RSC + client view)
/months/new → app/(protected)/months/new/       — new month form (client)
/months/[year]/[month]/edit → ...edit/          — edit form (client)
/goals      → app/(protected)/goals/            — goals manager (RSC + client view)
/invest     → app/(protected)/invest/           — investment calculator (client)
/login      → app/login/                        — public (client form)
```

### RSC + client view pattern

Every protected page follows the same split:

- `page.tsx` — React Server Component. Queries Prisma directly, does any data shaping, then renders a `*View` or `*Form` client component with fully-serialized props (plain JS, no Prisma objects).
- `*-view.tsx` / `*-form.tsx` — `"use client"`. Owns all interactivity: form state, mutations via `fetch()` to the API, optimistic UI.

The server component handles data fetching. The client component handles interaction. They communicate only through props — the client component never imports Prisma.

### Protected layout

`app/(protected)/layout.tsx` calls `requireUser()`. If there's no valid session it redirects to `/login` (Next.js redirect). It also passes `memberCount={1}` to the shell — this was previously a live `prisma.user.count()` but user identity is now in Firebase, so it's hardcoded to 1.

### Things to know

- The `(protected)` folder name is a Next.js route group — it does not appear in the URL.
- Next.js 15 with `typedRoutes: true` is enabled in `next.config.ts`, so `href` props on `<Link>` are type-checked against your actual routes.
- Month edit/new pages use the same `MonthForm` component, distinguishing create vs. update by whether an `initialData` prop is provided.

---

## UI and styling

**Files:** `app/globals.css`, `components/`

### Design tokens

All colors, spacing, and radii are CSS custom properties defined at the top of `globals.css`:

```css
:root {
  --bg, --bg-elev, --panel, --panel-hi    /* backgrounds */
  --border, --border-soft, --border-strong
  --text, --text-soft, --muted, --faint
  --pos, --neg, --warn, --info, --accent  /* semantic colors */
  --radius, --radius-sm, --radius-lg
  --shadow-card
}
```

The design is dark-only (`color-scheme: dark` on `html`).

### Typography

Three fonts loaded via Next.js `next/font/google` in `app/layout.tsx`:
- **Manrope** — primary sans-serif UI font
- **Noto Sans TC** — Traditional Chinese characters
- **JetBrains Mono** — numbers, amounts, keyboard shortcuts (`.num`, `kbd`, `.amount` classes)

### Component conventions

There is no component library. Styling is via semantic class names defined in `globals.css`:
- `.card`, `.card-head`, `.card-title` — content panels
- `.topbar`, `.topbar-actions` — page header bar
- `.btn`, `.btn-primary` — buttons
- `.chip`, `.chip-pos`, `.chip-neg`, `.chip-muted` — inline stat badges
- `.field` — form field wrapper (label + input)
- `.num`, `.amount`, `.currency` — monospace number formatting
- `.pos` / `.neg` — green/red semantic color utilities
- `.muted`, `.faint` — text color utilities

### Sidebar

`components/sidebar.tsx` is a client component (needs `usePathname` for active state). It receives `user` and `memberCount` as props from the RSC layout. Logout calls `POST /api/auth/logout` then does a client-side navigation to `/login`.

### Things to know

- CSS is all in one file (`globals.css`). It's long but organized by section headers. Search by section name.
- There are no CSS modules or scoped styles — class names are global. Be careful not to introduce naming conflicts when adding new classes.
- `--accent` and `--pos` are the same color (green). `--accent` is used for interactive elements, `--pos` for positive financial values.
