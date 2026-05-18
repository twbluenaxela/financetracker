import { prisma } from "@/lib/prisma";
import { MonthsView } from "@/app/months/months-view";

export default async function MonthsPage() {
  const months = await prisma.monthlySummary.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: {
      lines: true,
    },
  });

  return (
    <>
      <MonthsView
        currentYear={months[0]?.year ?? new Date().getFullYear()}
        currentMonth={months[0]?.month ?? new Date().getMonth() + 1}
        months={months.map((month) => ({
          id: month.id,
          year: month.year,
          month: month.month,
          income: Number(month.totalIncome),
          expense: Number(month.totalExpense),
          note: month.note ?? "",
          lines: month.lines.map((line) => ({
            id: line.id,
            kind: line.kind as "income" | "expense",
            name: line.name,
            amount: Number(line.amount),
          })),
        }))}
      />
    </>
  );
}
