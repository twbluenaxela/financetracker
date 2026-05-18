import type {
  AllocationGap,
  BacktestSummary,
  GoalAllocationResult,
  GoalFundingResult,
  GoalInput,
  MarketTemperature,
  PortfolioSnapshot,
  TechnicalCompositeInput,
  TimeSeriesPoint,
} from "./types";

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const monthsBetween = (today: Date, targetDate: Date) => {
  return Math.max(
    1,
    (targetDate.getFullYear() - today.getFullYear()) * 12 +
      (targetDate.getMonth() - today.getMonth()),
  );
};

export function calculateGoalPMT(
  targetAmount: number,
  currentAmount: number,
  annualRate: number,
  months: number,
): number {
  if (months <= 0 || currentAmount >= targetAmount) return 0;
  const monthlyRate = Math.max(annualRate, 0) / 12;
  if (monthlyRate === 0) return Math.max(0, (targetAmount - currentAmount) / months);

  const growth = Math.pow(1 + monthlyRate, months);
  const futureGap = targetAmount - currentAmount * growth;
  if (futureGap <= 0) return 0;
  return (futureGap * monthlyRate) / (growth - 1);
}

export function buildGoalFundingPlan(goals: GoalInput[], today = new Date()): GoalFundingResult[] {
  return goals.map((goal) => {
    const monthsRemaining = goal.targetDate
      ? monthsBetween(today, new Date(goal.targetDate))
      : 360;
    return {
      goalId: goal.id,
      label: goal.label,
      monthsRemaining,
      requiredMonthly: Number(
        calculateGoalPMT(
          goal.targetAmount,
          goal.currentAmount,
          goal.expectedAnnualReturn,
          monthsRemaining,
        ).toFixed(2),
      ),
    };
  });
}

export function allocateMonthlyBudget(
  availableCash: number,
  goals: GoalInput[],
  today = new Date(),
): GoalAllocationResult[] {
  const fundingPlan = buildGoalFundingPlan(goals, today).filter((goal) => goal.requiredMonthly > 0);
  if (availableCash <= 0 || fundingPlan.length === 0) return [];

  const scores = fundingPlan.map((goal) => {
    const source = goals.find((item) => item.id === goal.goalId)!;
    const priorityScore = 1 / Math.max(1, source.priority + 1);
    const urgencyScore = Math.min(3, 24 / Math.max(1, goal.monthsRemaining));
    const shortfallScore = Math.min(
      1,
      Math.max(0, source.targetAmount - source.currentAmount) / Math.max(1, source.targetAmount),
    );
    const composite = priorityScore * 0.45 + urgencyScore * 0.35 + shortfallScore * 0.2;
    return {
      goal,
      source,
      priorityScore,
      urgencyScore,
      shortfallScore,
      composite,
    };
  });

  const totalScore = scores.reduce((sum, item) => sum + item.composite, 0);
  let remainingCash = availableCash;

  const initial = scores.map((item) => {
    const rawAmount = totalScore === 0 ? 0 : (availableCash * item.composite) / totalScore;
    const amount = Math.min(item.goal.requiredMonthly, Number(rawAmount.toFixed(2)));
    remainingCash -= amount;
    return {
      goalId: item.goal.goalId,
      label: item.goal.label,
      amount,
      weight: totalScore === 0 ? 0 : item.composite / totalScore,
      rationale: `priority=${item.priorityScore.toFixed(2)}, urgency=${item.urgencyScore.toFixed(2)}, shortfall=${item.shortfallScore.toFixed(2)}`,
    };
  });

  for (const item of [...initial].sort((a, b) => b.weight - a.weight)) {
    if (remainingCash <= 0) break;
    const target = fundingPlan.find((goal) => goal.goalId === item.goalId)!;
    const room = Math.max(0, target.requiredMonthly - item.amount);
    const topUp = Math.min(room, remainingCash);
    item.amount = Number((item.amount + topUp).toFixed(2));
    remainingCash = Number((remainingCash - topUp).toFixed(2));
  }

  return initial;
}

export function computeAllocationGaps(snapshot: PortfolioSnapshot): AllocationGap[] {
  return Object.entries(snapshot.targetWeights).map(([assetClass, targetWeight]) => {
    const currentWeight = snapshot.currentWeights[assetClass as keyof typeof snapshot.currentWeights] ?? 0;
    return {
      assetClass: assetClass as AllocationGap["assetClass"],
      targetWeight,
      currentWeight,
      gapWeight: Number((targetWeight - currentWeight).toFixed(4)),
    };
  });
}

export function getMarketTemperature(input: TechnicalCompositeInput): MarketTemperature {
  let score = 50;
  const notes: string[] = [];

  if (input.rsi14 != null) {
    if (input.rsi14 >= 70) {
      score += 18;
      notes.push("RSI is overbought");
    } else if (input.rsi14 <= 30) {
      score -= 18;
      notes.push("RSI is oversold");
    } else {
      score += (input.rsi14 - 50) * 0.6;
    }
  }

  if (input.macdHistogram != null) {
    score += clamp(input.macdHistogram * 120, -15, 15);
    notes.push(input.macdHistogram >= 0 ? "MACD trend is positive" : "MACD trend is negative");
  }

  if (input.stochasticK != null && input.stochasticD != null) {
    const kdSpread = input.stochasticK - input.stochasticD;
    score += clamp(kdSpread * 0.5, -10, 10);
    if (input.stochasticK >= 80 && input.stochasticD >= 80) notes.push("KD is hot");
    if (input.stochasticK <= 20 && input.stochasticD <= 20) notes.push("KD is cold");
  }

  score = clamp(Math.round(score), 0, 100);
  const label =
    score >= 75 ? "hot" : score >= 60 ? "warm" : score <= 25 ? "cold" : "neutral";

  return {
    score,
    label,
    explanation:
      notes.join("; ") ||
      "Technicals are mixed. Use this only as a contribution-timing footnote, not an allocation rule.",
  };
}

export function calculateCagrAndMaxDrawdown(series: TimeSeriesPoint[]): BacktestSummary {
  if (series.length < 2) {
    return { cagr: 0, maxDrawdown: 0 };
  }

  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const startValue = sorted[0].value;
  const endValue = sorted[sorted.length - 1].value;
  if (startValue <= 0 || endValue <= 0) {
    return { cagr: 0, maxDrawdown: 0 };
  }

  const startDate = new Date(sorted[0].date);
  const endDate = new Date(sorted[sorted.length - 1].date);
  const years = Math.max(1 / 365, (endDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  const cagr = Math.pow(endValue / startValue, 1 / years) - 1;

  let peak = sorted[0].value;
  let maxDrawdown = 0;
  for (const point of sorted) {
    peak = Math.max(peak, point.value);
    const drawdown = (point.value - peak) / peak;
    maxDrawdown = Math.min(maxDrawdown, drawdown);
  }

  return {
    cagr: Number(cagr.toFixed(6)),
    maxDrawdown: Number(maxDrawdown.toFixed(6)),
  };
}
