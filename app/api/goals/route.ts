import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  id: z.number().int().optional(),
  tier: z.string().min(1).max(4),
  label: z.string().trim().min(1).max(100),
  targetAmount: z.number().min(0),
  currentAmount: z.number().min(0),
  expectedAnnualReturn: z.number().min(0).max(1).default(0.05),
  priority: z.number().int().min(0).default(0),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.canEdit) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const json = await request.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const data = parsed.data;
  const payload = {
    tier: data.tier,
    label: data.label,
    targetAmount: data.targetAmount,
    currentAmount: data.currentAmount,
    expectedAnnualReturn: data.expectedAnnualReturn,
    priority: data.priority,
    targetDate: data.targetDate ? new Date(data.targetDate) : null,
  };

  const goal = data.id
    ? await prisma.goal.update({
        where: { id: data.id, householdId: user.householdId },
        data: payload,
      })
    : await prisma.goal.create({
        data: { ...payload, householdId: user.householdId },
      });

  revalidatePath("/");
  revalidatePath("/statements");
  return NextResponse.json({ ok: true, id: goal.id });
}
