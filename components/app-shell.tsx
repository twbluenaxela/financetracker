"use client";

import type { ReactNode } from "react";
import { useState, useEffect } from "react";

import { Sidebar } from "@/components/sidebar";

export type SessionUser = {
  uid: string;
  email: string | null;
  name: string | null;
  householdId: number;
  role: string;
  canEdit: boolean;
};

export function AppShell({
  children,
  user,
  householdName,
  memberCount,
}: {
  children: ReactNode;
  user: SessionUser;
  householdName: string;
  memberCount: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "1") setCollapsed(true);
  }, []);

  function toggle() {
    if (window.innerWidth <= 640) {
      setMobileOpen((prev) => !prev);
    } else {
      setCollapsed((prev) => {
        localStorage.setItem("sidebar-collapsed", prev ? "0" : "1");
        return !prev;
      });
    }
  }

  return (
    <div className={`app${collapsed ? " sidebar-collapsed" : ""}${mobileOpen ? " mobile-open" : ""}`}>

      <Sidebar user={user} householdName={householdName} memberCount={memberCount} collapsed={collapsed} onToggle={toggle} />
      <main className="main">{children}</main>
    </div>
  );
}
