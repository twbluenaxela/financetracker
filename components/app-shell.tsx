import type { ReactNode } from "react";

import { Sidebar } from "@/components/sidebar";

export type SessionUser = { uid: string; email: string | null; name: string | null };

export function AppShell({
  children,
  user,
  memberCount,
}: {
  children: ReactNode;
  user: SessionUser;
  memberCount: number;
}) {
  return (
    <div className="app">
      <Sidebar user={user} memberCount={memberCount} />
      <main className="main">{children}</main>
    </div>
  );
}
