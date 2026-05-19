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
    household/members/[uid]/  # PATCH canEdit + displayName, DELETE member (owner only)
    chat/                 # POST — Gemini multi-turn chat; GET /models — live model list

  invite/[token]/         # public invite acceptance page (no auth gate — handles it inline)
  login/                  # public login page
  globals.css             # design tokens + global styles (no Tailwind)
  layout.tsx              # root layout — self-hosted fonts via @fontsource npm packages + next/font/local (no network requests)

components/
  app-shell.tsx           # outer grid (sidebar + main); desktop collapse + mobile drawer (mobile-open class triggers fixed-position overlay)
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
  name: string | null;        // Firebase Auth display name (e.g. from Google)
  householdId: number;
  role: string;               // "owner" | "member"
  canEdit: boolean;
  displayName: string | null; // custom name stored in household_members; shown in sidebar + settings
  photoURL: string | null;    // resolved: DB photoUrl → decoded.picture (Google) → null
}
```

`SessionUser` is defined in `lib/auth.ts` (server) and mirrored in `components/app-shell.tsx` (client). Keep them in sync.

Members have an optional `displayName` (`VARCHAR(50)`) and `photoUrl` (`TEXT`) stored on `HouseholdMember`. Any member can edit their own; the owner can edit anyone's. See `agents.md` for full permission rules and the photo upload flow.

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

- **Robo-advisor** — Gemini API integration for AI financial advice. `GEMINI_API_KEY` must be set in env.

## Mobile responsiveness

Target: 400px minimum width. All pages must be usable without horizontal scroll.

**Sidebar drawer (≤640px)**
- Desktop: sidebar is part of the CSS grid; `sidebar-collapsed` class narrows it.
- Mobile: `toggle()` in `app-shell.tsx` detects `window.innerWidth <= 640` and toggles `mobileOpen` instead of `collapsed`. The `.app.mobile-open .sidebar` CSS rule switches the sidebar to `position: fixed` overlay (at most `min(200px, 72vw)` wide, `height: 100dvh`, `background: var(--panel)`, `border-right: 1px solid var(--border-strong)`). No backdrop — page content stays visible behind the drawer.
- `height: 100dvh` (not `100vh`) — respects iOS URL bar and Android nav chrome.

**Sidebar footer always visible**
- `.nav { flex: 1; overflow-y: auto; min-height: 0; }` — nav scrolls if links overflow.
- `.sidebar-foot { flex-shrink: 0; display: flex !important; }` — footer pinned at bottom. `!important` is required because `.sidebar-collapsed .sidebar-foot { display: none }` has higher specificity [0,2,0] than the mobile rule [0,1,0].

**Hero stats (dashboard)**
- `.hero { grid-template-columns: 1fr; }` stacks 本月結餘 above 收入/支出 on narrow screens.
- `.hero-side { border-left: 0; border-top: 1px solid var(--border); }` separates them visually.

**Goal tier cards**
- `.tier-grid { grid-template-columns: 1fr; }` overrides the `minmax(310px, 1fr)` auto-fill, forcing single-column vertical stacking.

**Robo-advisor modal (≤700px)**
- Modal switches to `display: block; overflow-y: auto` (was flex with `overflow: hidden`).
- `.robo-modal .modal-body` overrides `display: contents` (which removed the scroll container) with `display: flex; flex-direction: column`.
- Modal header is `position: sticky; top: 0` — always visible while scrolling.
- Chat input bar is `position: sticky; bottom: 0` — always reachable.
- Chat thread has `max-height: 220px; overflow-y: auto` — bounded internal scroll.
