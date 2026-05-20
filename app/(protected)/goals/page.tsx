import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { GoalsView } from "@/app/goals/goals-view";
import { calculateGoalPmt } from "@/lib/wealth";

export default async function GoalsPage() {
  const user = await requireUser();
  const goals = await prisma.goal.findMany({
    where: { householdId: user.householdId },
    orderBy: [{ priority: "asc" }, { id: "asc" }],
  });

  const latestMonth = await prisma.monthlySummary.findFirst({
    where: { householdId: user.householdId },
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
          const currentAmount = Number(goal.currentAmount);
          const targetAmount = Number(goal.targetAmount);
          const alreadyComplete = currentAmount >= targetAmount;

          const monthsRemaining = alreadyComplete
            ? 0
            : goal.targetDate
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
            currentAmount,
            targetAmount,
            expectedAnnualReturn: Number(goal.expectedAnnualReturn),
            priority: goal.priority,
            targetDate: goal.targetDate ? goal.targetDate.toISOString().slice(0, 10) : null,
            monthsRemaining,
            requiredMonthly: alreadyComplete
              ? 0
              : calculateGoalPmt(
                  targetAmount,
                  currentAmount,
                  Number(goal.expectedAnnualReturn),
                  monthsRemaining,
                ),
          };
        })}
      />
    </>
  );
}
