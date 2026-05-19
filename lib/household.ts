import "server-only";

import { prisma } from "@/lib/prisma";

export type HouseholdMembership = {
  householdId: number;
  role: string;
  canEdit: boolean;
};

export async function getOrCreateHousehold(uid: string): Promise<HouseholdMembership> {
  const existing = await prisma.householdMember.findFirst({
    where: { firebaseUid: uid },
    select: { householdId: true, role: true, canEdit: true },
  });
  if (existing) return existing;

  // First login: create a household and make this user the owner
  const household = await prisma.household.create({ data: { name: "家庭" } });
  await prisma.householdMember.create({
    data: {
      householdId: household.id,
      firebaseUid: uid,
      role: "owner",
      canEdit: true,
    },
  });
  return { householdId: household.id, role: "owner", canEdit: true };
}
