import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (user.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.householdInvite.create({
    data: {
      token,
      householdId: user.householdId,
      expiresAt,
    },
  });

  return NextResponse.json({ token });
}
