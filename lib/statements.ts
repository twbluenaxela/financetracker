export type StatementLine = {
  name: string;
  amount: number;
};

export type StatementMonth = {
  id: number;
  year: number;
  month: number;
  income: number;
  expense: number;
  surplus: number;
  savingsRate: number | null;
  cumulativeSurplus: number;
  note: string | null;
  incomeLines: StatementLine[];
  expenseLines: StatementLine[];
};

export type StatementGoal = {
  id: number;
  tier: string;
  label: string;
  currentAmount: number;
  targetAmount: number;
  expectedAnnualReturn: number;
  priority: number;
};

export type StatementPlan = {
  startingCapital: number;
  monthlyContribution: number;
  targetAmount: number;
  twStockPct: number;
  usStockPct: number;
  bondPct: number;
};

export type StatementBundle = {
  months: StatementMonth[];
  latest: StatementMonth | null;
  totalIncome: number;
  totalExpense: number;
  totalSurplus: number;
  cumulativeCash: number;
  goalAssets: number;
  investmentAssets: number;
  trackedAssets: number;
  trackedLiabilities: number;
  netWorth: number;
  goals: StatementGoal[];
  plan: StatementPlan | null;
};

export function buildStatements(
  months: Array<{
    id: number;
    year: number;
    month: number;
    totalIncome: number;
    totalExpense: number;
    note: string | null;
    lines: Array<{
      kind: string;
      name: string;
      amount: number;
    }>;
  }>,
  goals: StatementGoal[],
  plan: StatementPlan | null,
): StatementBundle {
  const ordered = [...months].sort((a, b) => (a.year - b.year) || (a.month - b.month));
  let runningCash = 0;

  const normalized = ordered.map((month) => {
    const income = Number(month.totalIncome);
    const expense = Number(month.totalExpense);
    const surplus = income - expense;
    runningCash += surplus;
    const savingsRate = income ? (surplus / income) * 100 : null;

    return {
      id: month.id,
      year: month.year,
      month: month.month,
      income,
      expense,
      surplus,
      savingsRate,
      cumulativeSurplus: runningCash,
      note: month.note,
      incomeLines: month.lines
        .filter((line) => line.kind === "income")
        .map((line) => ({ name: line.name, amount: Number(line.amount) }))
        .sort((a, b) => b.amount - a.amount),
      expenseLines: month.lines
        .filter((line) => line.kind === "expense")
        .map((line) => ({ name: line.name, amount: Number(line.amount) }))
        .sort((a, b) => b.amount - a.amount),
    } satisfies StatementMonth;
  });

  const latest = normalized.at(-1) ?? null;
  const totalIncome = normalized.reduce((sum, row) => sum + row.income, 0);
  const totalExpense = normalized.reduce((sum, row) => sum + row.expense, 0);
  const totalSurplus = totalIncome - totalExpense;
  const goalAssets = goals.reduce((sum, goal) => sum + goal.currentAmount, 0);
  const investmentAssets = plan?.startingCapital ?? 0;
  const trackedAssets = Math.max(0, runningCash) + goalAssets + investmentAssets;
  const trackedLiabilities = 0;
  const netWorth = trackedAssets - trackedLiabilities;

  return {
    months: normalized,
    latest,
    totalIncome,
    totalExpense,
    totalSurplus,
    cumulativeCash: runningCash,
    goalAssets,
    investmentAssets,
    trackedAssets,
    trackedLiabilities,
    netWorth,
    goals,
    plan,
  };
}

export function monthLabel(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function monthChinese(month: number) {
  return ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"][month - 1] + "月";
}

export function money(value: number) {
  return "NT$" + Math.round(value).toLocaleString("zh-TW");
}

export function moneyPlain(value: number) {
  return Math.round(value).toLocaleString("zh-TW");
}

export function compactMoney(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return "NT$" + (value / 1_000_000).toFixed(2) + "M";
  if (abs >= 10_000) return "NT$" + (value / 10_000).toFixed(1) + "萬";
  if (abs >= 1_000) return "NT$" + (value / 1_000).toFixed(1) + "K";
  return money(value);
}
