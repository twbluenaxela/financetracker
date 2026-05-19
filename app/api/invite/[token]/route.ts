import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { token } = await params;

  const invite = await prisma.householdInvite.findUnique({ where: { token } });

  if (!invite) return NextResponse.json({ error: "invalid_token" }, { status: 404 });
  if (invite.usedAt) return NextResponse.json({ error: "already_used" }, { status: 410 });
  if (invite.expiresAt < new Date()) return NextResponse.json({ error: "expired" }, { status: 410 });

  // Check if already a member of any household
  const existing = await prisma.householdMember.findFirst({
    where: { firebaseUid: user.uid },
  });
  if (existing) {
    if (existing.householdId === invite.householdId) {
      return NextResponse.json({ error: "already_member" }, { status: 409 });
    }

    // Allow joining if the user is in a solo, empty auto-created household
    // (happens when someone registers and then immediately accepts an invite)
    const [memberCount, dataCount] = await Promise.all([
      prisma.householdMember.count({ where: { householdId: existing.householdId } }),
      prisma.monthlySummary.count({ where: { householdId: existing.householdId } }),
    ]);
    const isEmptySolo = memberCount === 1 && dataCount === 0;
    if (!isEmptySolo) {
      return NextResponse.json({ error: "already_in_household" }, { status: 409 });
    }

    // Delete the empty solo household and fall through to join the invite household
    await prisma.household.delete({ where: { id: existing.householdId } });
  }

  await prisma.$transaction([
    prisma.householdMember.create({
      data: {
        householdId: invite.householdId,
        firebaseUid: user.uid,
        role: "member",
        canEdit: false,
      },
    }),
    prisma.householdInvite.update({
      where: { token },
      data: { usedAt: new Date(), usedBy: user.uid },
    }),
  ]);

  return NextResponse.json({ ok: true, householdId: invite.householdId });
}
