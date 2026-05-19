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
    statements/           # 財務報表 — interactive financial reports (client component)
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
  statements.ts           # StatementBundle builder + formatting helpers (buildStatements, money, compactMoney)
  wealth.ts               # goal PMT calculation + money formatters
  invest.ts               # blended return, growth schedules, allocation recommender

prisma/
  schema.prisma           # DB schema (push-based, no migration files)

Dockerfile                # multi-stage Node 22 Alpine build for Fly.io
fly.toml                  # Fly.io config — app: financetrackertw, region: nrt
```

## Key conventions

- **Server components by default.** Client components are `"use client"` and live in `*-view.tsx` or `*-form.tsx` files alongside their server page. Exception: `statements-view.tsx` is a client component because the reports page has rich interactivity (period switcher, chart clicks, heatmap hover).
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

## 財務報表 page (`/statements`)

The reports page (`app/statements/`) is a fully client-side interactive view built on top of `StatementBundle` data fetched server-side in `page.tsx`.

**Sections:**
- **KPI strip** — 5 tiles: 期間收入 / 期間支出 / 期間結餘 (with half-period trend) / 儲蓄率 / 淨值
- **現金流** — twin-bar SVG chart (income up, expense down from midline) with cumulative cash line overlay; click any bar to set the active month
- **分類 × 月份** — heatmap grid; income rows (mint intensity) and expense rows (coral intensity); hover cells for tooltip with amount + share of month; footer rows show monthly totals and surplus
- **損益表** — scrollable table grouped by year; savings-rate mini bar per row; click row to set active month
- **資產負債表** — net worth callout with sparkline trajectory back-projected from `data.months`; composition bar; assets vs liabilities breakdown
- **支出深度分析** — top-8 expense category cards with sparklines and MoM delta

**Period switcher** (滾動 12M / 2026 YTD / 2025) filters all sections client-side from the full `data.months` array.

**Data shape** — all sections consume `StatementMonth[]` which already carries `incomeLines` / `expenseLines` per month (populated by `buildStatements` from Prisma `MonthlySummary.lines`). No extra API calls needed.

## 理財目標 page (`/goals`)

The goals page pairs a React Server Component (`app/(protected)/goals/page.tsx`) with a large client component (`app/goals/goals-view.tsx`). The server component fetches all goals and the latest `MonthlySummary`, then passes `{ goals, income, expense, surplus }` as props.

**Features:**
- Goals grouped into three tiers: 短期 (<1yr) / 中期 (1–5yr) / 長期 (5+yr)
- Drag-handle allocator distributes monthly surplus across tiers (default 50/30/20)
- Per-goal sliders to adjust monthly contribution; ETA recalculates in real time
- Add / edit / delete goals via modal forms + `/api/goals` route
- **Robo-advisor modal** — see section below

**Robo-advisor** (`RoboAdvisorModal` inside `goals-view.tsx`):

*Asset universe* — `ASSETS` constant, four slots:

| ID | Name | Ticker | Return | Currency | Who |
|----|------|--------|--------|----------|-----|
| `cash` | 定存/活存 | 台灣銀行 | 1.8% | TWD | Anyone |
| `bond` | 全球債券 ETF | BNDW | 3.5% | USD | You (Schwab) |
| `world` | 全球股市 ETF | VT | 7.9% | USD | You (Schwab) |
| `twStock` | 台股市值型 ETF | 0050 | 7.5% | TWD | Wife only |

BNDW and VT carry `fxRisk: true` (USD-denominated, bought via Schwab wire). 0050 is PFIC for N — tagged in the UI and warned in the advisor chat.

*Allocation recipes* — `RECIPES` constant, Boglehead-grounded:
- 短期: conservative/moderate = 100% cash; aggressive = 85% cash / 15% bond
- 中期: conservative = 20/45/25/10; moderate = 10/25/50/15; aggressive = 5/10/65/20
- 長期: conservative = 35% bond / 50% VT / 15% 0050; moderate = 15/70/15; aggressive = 5/80/15

*Gemini chat* (`POST /api/chat`):
- Request shape: `{ system: string, history: { role: "user"|"model", text: string }[], model: string }`
- `system` is the full household briefing (profile, PFIC rules, asset universe, costs, philosophy) — sent as `config.systemInstruction`, not part of the chat history
- `history` is the **full conversation** so the model has multi-turn memory; error messages are stripped before sending
- The financial context snapshot (income, expenses, surplus, all goal amounts + recommended mixes) is injected as a `<context>` block prepended to the first user message only — not repeated on every turn
- Model list fetched live at modal open from `GET /api/chat/models`; static fallback list if fetch fails
- Default model: `gemini-3-flash-preview`

**PFIC constraint** — N cannot hold Taiwan-domiciled ETFs (0050, 00679B, 00720B, etc.); they are PFICs and trigger Form 8621 + up to 37% punitive tax. Only J can hold them. The advisor system prompt encodes this and surfaces warnings in the UI.

- **Robo-advisor** — Gemini API integration for AI financial advice. `GEMINI_API_KEY` is already in env, not yet wired up.
