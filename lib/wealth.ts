export function formatMoney(value: number) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function calculateGoalPmt(
  targetAmount: number,
  currentAmount: number,
  annualRate: number,
  months: number,
) {
  if (months <= 0 || currentAmount >= targetAmount) return 0;
  const monthlyRate = Math.max(annualRate, 0) / 12;
  if (monthlyRate === 0) return Math.max(0, (targetAmount - currentAmount) / months);

  const growth = Math.pow(1 + monthlyRate, months);
  const futureGap = targetAmount - currentAmount * growth;
  if (futureGap <= 0) return 0;

  return Number(((futureGap * monthlyRate) / (growth - 1)).toFixed(2));
}
