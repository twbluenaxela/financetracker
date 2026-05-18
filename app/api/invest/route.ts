import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  id: z.number().int().default(1),
  startingCapital: z.number().min(0),
  monthlyContribution: z.number().min(0),
  targetAmount: z.number().min(0),
  twStockPct: z.number().int().min(0).max(100),
  usStockPct: z.number().int().min(0).max(100),
  bondPct: z.number().int().min(0).max(100),
  twStockReturn: z.number().min(0).max(1),
  usStockReturn: z.number().min(0).max(1),
  bondReturn: z.number().min(0).max(1),
  age: z.number().int().min(0).max(120).nullable().optional(),
  risk: z.enum(["conservative", "moderate", "aggressive"]),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await request.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const data = parsed.data;
  await prisma.investmentPlan.upsert({
    where: { id: data.id },
    update: data,
    create: data,
  });

  return NextResponse.json({ ok: true });
}
