import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  canEdit: z.boolean(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ uid: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (user.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { uid } = await params;
  if (uid === user.uid) return NextResponse.json({ error: "cannot_modify_self" }, { status: 400 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  await prisma.householdMember.update({
    where: {
      householdId_firebaseUid: {
        householdId: user.householdId,
        firebaseUid: uid,
      },
    },
    data: { canEdit: parsed.data.canEdit },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ uid: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (user.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { uid } = await params;
  if (uid === user.uid) return NextResponse.json({ error: "cannot_remove_self" }, { status: 400 });

  await prisma.householdMember.delete({
    where: {
      householdId_firebaseUid: {
        householdId: user.householdId,
        firebaseUid: uid,
      },
    },
  });

  return NextResponse.json({ ok: true });
}
