# Shared Family Wealth Dashboard: Robo-Advisor Upgrade

This document defines the data model and product boundary for the next
stage of the app. It keeps the current FastAPI app as the source of truth
for household accounting, while carving out a clean portfolio/analytics
layer that can later be exposed to a Next.js frontend.

## Product rules

- Bogleheads first: target allocation and contribution discipline always
  dominate short-term signals.
- Technical indicators are informational and can only nudge which ETF
  receives a contribution, never the stock/bond policy mix.
- Short-term goals should default to cash or short-duration bonds.
- Long-term goals can assume higher expected returns because they can
  hold broad stock index funds long enough to absorb volatility.
- Rebalancing alerts trigger at `>= 5%` absolute drift from target weight.

## Canonical entities

The current `monthly_summaries` and `goals` tables remain valid. Add the
following domain entities for the robo-advisor layer.

```ts
export type CurrencyCode = "TWD" | "USD";
export type AssetClass = "cash" | "tw_equity" | "us_equity" | "intl_equity" | "bond";
export type GoalTier = "short" | "mid" | "long";
export type RiskProfile = "conservative" | "moderate" | "aggressive";

export interface HouseholdProfile {
  id: string;
  displayName: string;
  baseCurrency: CurrencyCode;
  birthYears: number[];
  riskProfile: RiskProfile;
  rebalanceThresholdPct: number;
  emergencyFundMonths: number;
  createdAt: string;
  updatedAt: string;
}

export interface GoalPolicy {
  assetMix: Record<AssetClass, number>;
  expectedAnnualReturn: number;
  maxEquityPct: number;
}

export interface GoalRecord {
  id: string;
  label: string;
  tier: GoalTier;
  priority: number;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  expectedAnnualReturn: number;
  goalPolicy: GoalPolicy;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LiabilityRecord {
  id: string;
  label: string;
  category: "mortgage" | "loan" | "credit";
  balance: number;
  interestRate: number;
  minimumPayment: number;
  currency: CurrencyCode;
  updatedAt: string;
}

export interface PortfolioProfile {
  id: string;
  householdId: string;
  label: string;
  targetWeights: Record<AssetClass, number>;
  twEquityTickers: string[];
  usEquityTickers: string[];
  bondTickers: string[];
  expectedReturn: number;
  expectedVolatility: number;
  createdAt: string;
  updatedAt: string;
}

export interface PositionLot {
  id: string;
  portfolioId: string;
  ticker: string;
  assetClass: AssetClass;
  market: "TW" | "US";
  currency: CurrencyCode;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  marketValue: number;
  updatedAt: string;
}

export interface ContributionPlan {
  id: string;
  monthKey: string;
  availableCash: number;
  currency: CurrencyCode;
  goalAllocations: Array<{
    goalId: string;
    plannedAmount: number;
    executedAmount: number;
  }>;
  portfolioBuys: Array<{
    ticker: string;
    quantity: number;
    plannedAmount: number;
    executedAmount: number;
  }>;
  createdAt: string;
}

export interface PriceBar {
  ticker: string;
  market: "TW" | "US";
  asOf: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjustedClose: number;
  volume: number;
  currency: CurrencyCode;
  source: "yahoo" | "finnhub" | "alphavantage";
}

export interface TechnicalSnapshot {
  ticker: string;
  asOf: string;
  sma20: number | null;
  sma60: number | null;
  ema12: number | null;
  ema26: number | null;
  bollingerUpper: number | null;
  bollingerMiddle: number | null;
  bollingerLower: number | null;
  stochasticK: number | null;
  stochasticD: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  rsi14: number | null;
  obv: number | null;
  marketTemperature: number | null;
}

export interface BacktestSnapshot {
  id: string;
  portfolioProfileId: string;
  startDate: string;
  endDate: string;
  rebalanceRule: "annual" | "threshold_5";
  cagr: number;
  maxDrawdown: number;
  sharpeRatio: number;
  bestYear: number;
  worstYear: number;
  annualReturns: Array<{ year: number; returnPct: number }>;
  series: Array<{ date: string; value: number; benchmarkValue?: number }>;
  createdAt: string;
}
```

## Suggested relational mapping

- `household_profiles`
- `goal_policies`
- `portfolio_profiles`
- `positions`
- `position_lots`
- `liabilities`
- `price_bars`
- `technical_snapshots`
- `contribution_plans`
- `backtest_snapshots`
- `backtest_series`

## Statement layer

- Cash Flow Statement: derived from `monthly_summaries`, portfolio cash
  contributions, dividends, debt service, and withdrawals.
- Income Statement: realized income, realized expenses, realized
  dividends/interest, and optionally unrealized gain shown separately.
- Balance Sheet: cash + brokerage market value + retirement accounts +
  emergency fund + home equity if tracked, minus liabilities.

## Market data notes

- Taiwan ETF symbols often need market suffixes in vendor APIs, for
  example `0050.TW` and `006208.TW`.
- US ETFs can remain plain, for example `VTI`, `VOO`, `VXUS`, `BND`.
- Store raw price bars separately from indicators so calculations can be
  recomputed when formulas change.

## AI boundary

The AI layer is a translator, not a discretionary manager. It should only
summarize:

- current cash available
- allocation drift
- goal PMT shortfalls
- technical readings
- backtest facts

It must not invent performance numbers or recommend leverage, options,
single-stock bets, or timing-based allocation changes.
