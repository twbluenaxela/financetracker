import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const [household, memberCount] = await Promise.all([
    prisma.household.findUnique({ where: { id: user.householdId }, select: { name: true } }),
    prisma.householdMember.count({ where: { householdId: user.householdId } }),
  ]);

  return (
    <AppShell user={user} householdName={household?.name ?? "家庭"} memberCount={memberCount}>
      {children}
    </AppShell>
  );
}
