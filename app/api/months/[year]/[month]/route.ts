import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ year: string; month: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.canEdit) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { year, month } = await params;

  await prisma.monthlySummary.deleteMany({
    where: {
      householdId: user.householdId,
      year: Number(year),
      month: Number(month),
    },
  });

  revalidatePath("/");
  revalidatePath("/months");
  revalidatePath("/statements");
  return NextResponse.json({ ok: true });
}
