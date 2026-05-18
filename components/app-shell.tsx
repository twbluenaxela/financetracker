import type { ReactNode } from "react";
import type { User } from "@prisma/client";

import { Sidebar } from "@/components/sidebar";

export function AppShell({
  children,
  user,
  memberCount,
}: {
  children: ReactNode;
  user: User;
  memberCount: number;
}) {
  return (
    <div className="app">
      <Sidebar user={user} memberCount={memberCount} />
      <main className="main">{children}</main>
    </div>
  );
}
