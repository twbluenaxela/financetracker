import { notFound } from "next/navigation";

import { MonthForm } from "@/app/months/month-form";
import { prisma } from "@/lib/prisma";

export default async function EditMonthPage({
  params,
}: {
  params: Promise<{ year: string; month: string }>;
}) {
  const { year, month } = await params;
  const record = await prisma.monthlySummary.findFirst({
    where: {
      year: Number(year),
      month: Number(month),
    },
    include: {
      lines: true,
    },
  });

  if (!record) notFound();

  return (
    <>
      <MonthForm
        mode="edit"
        initialValue={{
          id: record.id,
          year: record.year,
          month: record.month,
          income: Number(record.totalIncome),
          expense: Number(record.totalExpense),
          note: record.note ?? "",
          lines: record.lines.map((line) => ({
            id: line.id,
            kind: line.kind as "income" | "expense",
            name: line.name,
            amount: Number(line.amount),
          })),
        }}
      />
    </>
  );
}
