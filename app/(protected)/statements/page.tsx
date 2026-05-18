import { StatementsView } from "@/app/statements/statements-view";
import { prisma } from "@/lib/prisma";
import { buildStatements } from "@/lib/statements";

export default async function StatementsPage() {
  const [months, goals, plan] = await Promise.all([
    prisma.monthlySummary.findMany({
      orderBy: [{ year: "asc" }, { month: "asc" }],
      include: {
        lines: true,
      },
    }),
    prisma.goal.findMany({
      orderBy: [{ priority: "asc" }, { id: "asc" }],
    }),
    prisma.investmentPlan.findUnique({ where: { id: 1 } }),
  ]);

  return (
    <StatementsView
      data={buildStatements(
        months.map((month) => ({
          id: month.id,
          year: month.year,
          month: month.month,
          totalIncome: Number(month.totalIncome),
          totalExpense: Number(month.totalExpense),
          note: month.note,
          lines: month.lines.map((line) => ({
            kind: line.kind,
            name: line.name,
            amount: Number(line.amount),
          })),
        })),
        goals.map((goal) => ({
          id: goal.id,
          tier: goal.tier,
          label: goal.label,
          currentAmount: Number(goal.currentAmount),
          targetAmount: Number(goal.targetAmount),
          expectedAnnualReturn: Number(goal.expectedAnnualReturn),
          priority: goal.priority,
        })),
        plan
          ? {
              startingCapital: Number(plan.startingCapital),
              monthlyContribution: Number(plan.monthlyContribution),
              targetAmount: Number(plan.targetAmount),
              twStockPct: plan.twStockPct,
              usStockPct: plan.usStockPct,
              bondPct: plan.bondPct,
            }
          : null,
      )}
    />
  );
}
