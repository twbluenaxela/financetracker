export type RiskLevel = "conservative" | "moderate" | "aggressive";

export type YearRow = {
  year: number;
  contribution: number;
  balance: number;
};

export function blendedReturn(input: {
  twStockPct: number;
  usStockPct: number;
  bondPct: number;
  twStockReturn: number;
  usStockReturn: number;
  bondReturn: number;
}) {
  const total = input.twStockPct + input.usStockPct + input.bondPct;
  if (total === 0) return 0;

  return (
    input.twStockPct * input.twStockReturn +
    input.usStockPct * input.usStockReturn +
    input.bondPct * input.bondReturn
  ) / total;
}

export function lumpSumSchedule(principal: number, annualRate: number, years: number): YearRow[] {
  const rows: YearRow[] = [{ year: 0, contribution: principal, balance: principal }];
  let balance = principal;
  for (let year = 1; year <= years; year += 1) {
    balance = balance * (1 + annualRate);
    rows.push({
      year,
      contribution: 0,
      balance: Math.round(balance),
    });
  }
  return rows;
}

export function periodicSchedule(annualContribution: number, annualRate: number, years: number): YearRow[] {
  const rows: YearRow[] = [{ year: 0, contribution: 0, balance: 0 }];
  let balance = 0;
  for (let year = 1; year <= years; year += 1) {
    balance = balance * (1 + annualRate) + annualContribution;
    rows.push({
      year,
      contribution: Math.round(annualContribution),
      balance: Math.round(balance),
    });
  }
  return rows;
}

export function yearsToTarget(input: {
  target: number;
  annualRate: number;
  principal?: number;
  annualContribution?: number;
  maxYears?: number;
}) {
  const target = input.target;
  const annualRate = input.annualRate;
  const principal = input.principal ?? 0;
  const annualContribution = input.annualContribution ?? 0;
  const maxYears = input.maxYears ?? 100;

  if (target <= 0) return 0;
  let balance = principal;
  if (balance >= target) return 0;

  for (let year = 1; year <= maxYears; year += 1) {
    balance = balance * (1 + annualRate) + annualContribution;
    if (balance >= target) return year;
  }

  return null;
}

export function recommendAllocation(age: number, risk: RiskLevel, horizonYears: number) {
  let baseBond = age;
  if (risk === "aggressive") baseBond = age - 20;
  if (risk === "moderate") baseBond = age - 10;

  if (horizonYears >= 20) baseBond -= 5;
  if (horizonYears < 7) baseBond += 10;

  const bondPct = Math.max(10, Math.min(80, baseBond));
  const equityPct = 100 - bondPct;
  const usStockPct = Math.round(equityPct * 0.6);
  const twStockPct = equityPct - usStockPct;

  return {
    bondPct,
    usStockPct,
    twStockPct,
    rationale: [
      `債券 ${bondPct}%：以年齡與風險偏好作為波動緩衝基準。`,
      `美股 ${usStockPct}%：作為全球股市核心曝險。`,
      `台股 ${twStockPct}%：保留本土市場配置與低操作複雜度。`,
      "Bogleheads 原則：低成本、廣泛分散、長期持有、定期再平衡。",
    ],
  };
}
