import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  const memberCount = await prisma.user.count();

  return (
    <AppShell user={user} memberCount={memberCount}>
      {children}
    </AppShell>
  );
}
