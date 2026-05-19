# Goals page — agent context

This document covers everything an agent needs to work on `/goals` and the robo-advisor without reading the entire codebase.

## Files

| File | Role |
|------|------|
| `app/(protected)/goals/page.tsx` | RSC — fetches goals + latest MonthlySummary from Prisma, passes props to GoalsView |
| `app/goals/goals-view.tsx` | Client component — all interactivity: goal list, allocator, robo-advisor modal |
| `app/api/goals/route.ts` | POST — upsert goal (auth + canEdit check + Zod) |
| `app/api/goals/[id]/route.ts` | DELETE — remove goal by id (auth + canEdit check) |
| `app/api/chat/route.ts` | POST — Gemini chat endpoint |
| `app/api/chat/models/route.ts` | GET — live Gemini model list |

## Data flow

```
page.tsx (RSC)
  prisma.goal.findMany({ householdId })
  prisma.monthlySummary.findFirst (latest month)
  → GoalsView({ goals, income, expense, surplus })
      → RoboAdvisorModal({ goals, surplus, income, expense })
          → POST /api/chat   (Gemini)
          → GET  /api/chat/models
```

The page re-fetches on every navigation (RSC, no caching). Client-side mutations call the API routes then call `router.refresh()` to re-fetch.

## Key constants in goals-view.tsx

### ASSETS
```ts
const ASSETS = {
  cash:    { id, name: "定存/活存",    ticker: "台灣銀行", ret: 0.018, color },
  bond:    { id, name: "全球債券 ETF", ticker: "BNDW",    ret: 0.035, color, fxRisk: true },
  world:   { id, name: "全球股市 ETF", ticker: "VT",      ret: 0.079, color, fxRisk: true },
  twStock: { id, name: "台股市值型 ETF", ticker: "0050",  ret: 0.075, color },
};
const ASSET_ORDER = ["cash", "bond", "world", "twStock"];
```

### RECIPES
Allocation percentages by tier × risk. Must always sum to 100 per recipe. Follows Boglehead three-fund logic — no REITs (already inside VT), no individual stocks.

```
短期: conservative/moderate = { cash:100 }; aggressive = { cash:85, bond:15 }
中期: conservative = { cash:20, bond:45, world:25, twStock:10 }
      moderate     = { cash:10, bond:25, world:50, twStock:15 }
      aggressive   = { cash:5,  bond:10, world:65, twStock:20 }
長期: conservative = { bond:35, world:50, twStock:15 }
      moderate     = { bond:15, world:70, twStock:15 }
      aggressive   = { bond:5,  world:80, twStock:15 }
```

### RISK_META
```ts
const RISK_META = {
  conservative: { label:"保守", sub:"重債券 · 低波動",   color:"var(--pos)"    },
  moderate:     { label:"穩健", sub:"三基金 · 均衡配置", color:"var(--accent)" },
  aggressive:   { label:"積極", sub:"重股票 · 長期成長", color:"var(--warn)"   },
};
```

## Gemini chat API

**Endpoint:** `POST /api/chat`

**Request:**
```ts
{
  system:  string,                              // household briefing (max 6000 chars)
  history: { role: "user"|"model", text: string }[],  // full conversation, max 40 turns
  model:   string,                              // e.g. "gemini-3-flash-preview"
}
```

**Response:** `{ text: string }` or `{ error: "api_key_invalid"|"generation_failed"|... }`

**How context is injected:**
- `system` is passed as `config.systemInstruction` — Gemini treats it as a persistent background brief, separate from the conversation turns
- The financial snapshot (income, expenses, surplus, all goal details, recommended mixes) is a `<context>` JSON block prepended to the **first user message** in `history` — not re-injected on every turn
- Error messages from prior turns are stripped from history before sending

**System prompt content:**
- Household profile: N (Schwab, US-listed ETFs only) + J (TW brokerage, Taiwan-listed ETFs)
- PFIC rules: N cannot buy 0050 / any Taiwan-domiciled ETF
- Full asset universe with returns, currencies, costs, who can hold each
- Wire transfer fee structure (NT$400–800/transfer + USD$10–30 intermediary)
- Boglehead philosophy summary
- Tone: 繁體中文, 100–300 words, cite actual numbers from context

**Model list endpoint:** `GET /api/chat/models` — calls `ai.models.list()`, filters to `generateContent`-capable Gemini models, strips the `models/` prefix. Falls back to a static list in the UI if the fetch fails.

## PFIC constraint (critical)

**N cannot hold Taiwan-domiciled ETFs** — they are PFICs. Buying them triggers:
- Annual Form 8621 filing per fund
- Gains taxed at 37% ordinary income rate + interest penalties

**Only J can hold:** 0050, 00679B, 00720B, or any Taiwan-listed fund.
N can only buy US-listed ETFs through Schwab: VT, BNDW, BND, VTI, VXUS, etc.

The UI tags 0050 with a red `PFIC` badge and shows an inline warning when it appears in a recommended mix. The advisor system prompt encodes this rule.

## GoalView type

```ts
type GoalView = {
  id: number;
  tier: "短期" | "中期" | "長期";
  label: string;
  currentAmount: number;
  targetAmount: number;
  expectedAnnualReturn: number;
  monthsRemaining: number;
  requiredMonthly: number;
  priority: number;
  targetDate: string | null;   // "YYYY-MM-DD" or null
};
```

## Common pitfalls

- **Decimal fields from Prisma** — `goal.currentAmount` etc. are `Decimal` objects. The page wraps them with `Number()` before passing as props. Never do math on raw Prisma Decimal in client code.
- **RECIPES must sum to 100** — `blendedReturn()` normalises by weight, but the UI displays raw percentages. Off-by-one rounding should be corrected in the recipe definition, not at render time.
- **History order matters for Gemini** — turns must strictly alternate user/model. The `askAdvisor` function filters out error messages (which have no model counterpart) before building the history array.
- **Context block on first turn only** — re-injecting `<context>` on every turn would consume tokens unnecessarily. It goes on `history[0]` (which is always a user turn after the initial greeting is stripped).
