import { prisma } from "@/lib/prisma";
import { calculateGoalPmt } from "@/lib/wealth";

export async function getDashboardData() {
  const months = await prisma.monthlySummary.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
    take: 12,
    include: {
      lines: true,
    },
  });

  const ordered = [...months].reverse();
  const current = ordered.at(-1) ?? null;
  const previous = ordered.at(-2) ?? null;

  const goals = await prisma.goal.findMany({
    orderBy: [{ priority: "asc" }, { id: "asc" }],
  });

  return {
    months: ordered,
    current,
    previous,
    goals: goals.map((goal) => {
      const monthsRemaining = goal.targetDate
        ? Math.max(
            1,
            (goal.targetDate.getFullYear() - new Date().getFullYear()) * 12 +
              (goal.targetDate.getMonth() - new Date().getMonth()),
          )
        : 360;

      const requiredMonthly = calculateGoalPmt(
        Number(goal.targetAmount),
        Number(goal.currentAmount),
        Number(goal.expectedAnnualReturn),
        monthsRemaining,
      );

      return {
        id: goal.id,
        tier: goal.tier,
        label: goal.label,
        targetAmount: Number(goal.targetAmount),
        currentAmount: Number(goal.currentAmount),
        expectedAnnualReturn: Number(goal.expectedAnnualReturn),
        monthsRemaining,
        requiredMonthly,
        priority: goal.priority,
        targetDate: goal.targetDate ? goal.targetDate.toISOString().slice(0, 10) : null,
      };
    }),
  };
}
