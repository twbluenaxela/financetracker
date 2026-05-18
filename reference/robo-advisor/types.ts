export type CurrencyCode = "TWD" | "USD";
export type AssetClass = "cash" | "tw_equity" | "us_equity" | "intl_equity" | "bond";
export type RiskProfile = "conservative" | "moderate" | "aggressive";
export type GoalTier = "short" | "mid" | "long";

export interface GoalInput {
  id: string;
  label: string;
  tier: GoalTier;
  priority: number;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  expectedAnnualReturn: number;
}

export interface GoalFundingResult {
  goalId: string;
  label: string;
  monthsRemaining: number;
  requiredMonthly: number;
}

export interface GoalAllocationResult {
  goalId: string;
  label: string;
  amount: number;
  weight: number;
  rationale: string;
}

export interface TechnicalCompositeInput {
  macdHistogram: number | null;
  rsi14: number | null;
  stochasticK: number | null;
  stochasticD: number | null;
}

export interface MarketTemperature {
  score: number;
  label: "cold" | "neutral" | "warm" | "hot";
  explanation: string;
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export interface BacktestSummary {
  cagr: number;
  maxDrawdown: number;
}

export interface PortfolioSnapshot {
  totalValueTwd: number;
  targetWeights: Record<AssetClass, number>;
  currentWeights: Record<AssetClass, number>;
}

export interface AllocationGap {
  assetClass: AssetClass;
  targetWeight: number;
  currentWeight: number;
  gapWeight: number;
}
