import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { SettingsView } from "@/app/settings/settings-view";

export default async function SettingsPage() {
  const user = await requireUser();

  const [household, members] = await Promise.all([
    prisma.household.findUnique({ where: { id: user.householdId } }),
    prisma.householdMember.findMany({
      where: { householdId: user.householdId },
      orderBy: { joinedAt: "asc" },
    }),
  ]);

  return (
    <SettingsView
      isOwner={user.role === "owner"}
      household={{ id: user.householdId, name: household?.name ?? "家庭" }}
      currentUid={user.uid}
      members={members.map((m) => ({
        uid: m.firebaseUid,
        role: m.role,
        canEdit: m.canEdit,
        displayName: m.displayName ?? null,
        photoUrl: m.photoUrl ?? null,
        joinedAt: m.joinedAt.toISOString(),
      }))}
    />
  );
}
