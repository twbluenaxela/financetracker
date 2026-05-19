import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  totalIncome: z.number().min(0).default(0),
  totalExpense: z.number().min(0).default(0),
  note: z.string().trim().max(500).optional(),
  lines: z
    .array(
      z.object({
        kind: z.enum(["income", "expense"]),
        name: z.string().trim().min(1).max(100),
        amount: z.number().min(0),
      }),
    )
    .default([]),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.canEdit) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const json = await request.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const data = parsed.data;
  const summary = await prisma.monthlySummary.upsert({
    where: {
      householdId_year_month: {
        householdId: user.householdId,
        year: data.year,
        month: data.month,
      },
    },
    update: {
      totalIncome: data.totalIncome,
      totalExpense: data.totalExpense,
      note: data.note || null,
      lines: {
        deleteMany: {},
        create: data.lines,
      },
    },
    create: {
      householdId: user.householdId,
      year: data.year,
      month: data.month,
      totalIncome: data.totalIncome,
      totalExpense: data.totalExpense,
      note: data.note || null,
      lines: {
        create: data.lines,
      },
    },
  });

  return NextResponse.json({ ok: true, id: summary.id });
}
