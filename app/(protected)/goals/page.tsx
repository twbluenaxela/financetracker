import { prisma } from "@/lib/prisma";
import { GoalsView } from "@/app/goals/goals-view";
import { calculateGoalPmt } from "@/lib/wealth";

export default async function GoalsPage() {
  const goals = await prisma.goal.findMany({
    orderBy: [{ priority: "asc" }, { id: "asc" }],
  });

  const latestMonth = await prisma.monthlySummary.findFirst({
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  const income = latestMonth ? Number(latestMonth.totalIncome) : 0;
  const expense = latestMonth ? Number(latestMonth.totalExpense) : 0;
  const surplus = income - expense;

  return (
    <>
      <GoalsView
        surplus={surplus}
        income={income}
        expense={expense}
        goals={goals.map((goal) => {
          const monthsRemaining = goal.targetDate
            ? Math.max(
                1,
                (goal.targetDate.getFullYear() - new Date().getFullYear()) * 12 +
                  (goal.targetDate.getMonth() - new Date().getMonth()),
              )
            : 360;

          return {
            id: goal.id,
            tier: goal.tier,
            label: goal.label,
            currentAmount: Number(goal.currentAmount),
            targetAmount: Number(goal.targetAmount),
            expectedAnnualReturn: Number(goal.expectedAnnualReturn),
            priority: goal.priority,
            targetDate: goal.targetDate ? goal.targetDate.toISOString().slice(0, 10) : null,
            monthsRemaining,
            requiredMonthly: calculateGoalPmt(
              Number(goal.targetAmount),
              Number(goal.currentAmount),
              Number(goal.expectedAnnualReturn),
              monthsRemaining,
            ),
          };
        })}
      />
    </>
  );
}
