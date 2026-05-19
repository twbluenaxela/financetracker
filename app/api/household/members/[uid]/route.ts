import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z
  .object({
    canEdit: z.boolean().optional(),
    displayName: z.string().trim().max(50).nullable().optional(),
    photoUrl: z.string().max(200_000).nullable().optional(), // base64 data URL or remote URL
  })
  .refine((d) => d.canEdit !== undefined || d.displayName !== undefined || d.photoUrl !== undefined, {
    message: "no_op",
  });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ uid: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { uid } = await params;
  const isSelf = uid === user.uid;
  const isOwner = user.role === "owner";

  // Non-owners can only touch their own record
  if (!isOwner && !isSelf) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const { canEdit, displayName, photoUrl } = parsed.data;

  // canEdit is owner-only and cannot target self
  if (canEdit !== undefined) {
    if (!isOwner) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    if (isSelf) return NextResponse.json({ error: "cannot_modify_self" }, { status: 400 });
  }

  // displayName / photoUrl: owner can do anyone; non-owner can only do self (already guarded above)
  const data: { canEdit?: boolean; displayName?: string | null; photoUrl?: string | null } = {};
  if (canEdit !== undefined) data.canEdit = canEdit;
  if (displayName !== undefined) data.displayName = displayName || null;
  if (photoUrl !== undefined) data.photoUrl = photoUrl || null;

  await prisma.householdMember.update({
    where: {
      householdId_firebaseUid: {
        householdId: user.householdId,
        firebaseUid: uid,
      },
    },
    data,
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
