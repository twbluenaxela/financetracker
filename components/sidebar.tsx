"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { SessionUser } from "@/components/app-shell";
import { useTransition } from "react";

const items = [
  {
    id: "home",
    href: "/",
    label: "總覽",
    icon: "M3 11 12 3l9 8M5 10v10h14V10",
  },
  {
    id: "statements",
    href: "/statements",
    label: "財務報表",
    icon: "M4 19V5M4 19h16M8 15v-4M12 15V8M16 15v-6",
  },
  {
    id: "months",
    href: "/months",
    label: "每月收支",
    icon: "M4 5h16v14H4zM4 9h16M8 5v14",
  },
  {
    id: "goals",
    href: "/goals",
    label: "理財目標",
    icon: "M12 3v18M3 12h18M12 7l4 5-4 5-4-5z",
  },
  {
    id: "investments",
    href: "/investments",
    label: "投資",
    icon: "M3 3v18h18M7 16l4-4 4 4 5-5",
  },
] as const;

function userDisplay(email: string) {
  const handle = email.split("@")[0] ?? email;
  return handle.slice(0, 1).toUpperCase() + handle.slice(1);
}

function activeFromPath(pathname: string) {
  if (pathname.startsWith("/statements")) return "statements";
  if (pathname.startsWith("/months")) return "months";
  if (pathname.startsWith("/goals")) return "goals";
  if (pathname.startsWith("/investments")) return "investments";
  return "home";
}

export function Sidebar({
  user,
  householdName,
  memberCount,
  collapsed,
  onToggle,
}: {
  user: SessionUser;
  householdName: string;
  memberCount: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const active = activeFromPath(pathname);
  const display = userDisplay(user.email ?? user.uid);
  const initial = display[0];
  const onSettings = pathname.startsWith("/settings");

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    startTransition(() => {
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <svg viewBox="0 0 32 32" width="22" height="22">
            <path
              d="M6 22 L13 12 L18 18 L26 8"
              stroke="currentColor"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="26" cy="8" r="2.5" fill="currentColor" />
          </svg>
        </div>
        <div className="brand-text">
          <div className="brand-name">家庭理財</div>
        </div>
      </div>

      <button className="sidebar-toggle" type="button" onClick={onToggle} aria-label={collapsed ? "展開側欄" : "收合側欄"} title={collapsed ? "展開側欄" : "收合側欄"}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {collapsed
            ? <path d="M9 18l6-6-6-6"/>
            : <path d="M15 18l-6-6 6-6"/>}
        </svg>
      </button>

      <nav className="nav">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={`nav-item ${active === item.id ? "active" : ""}`}
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={item.icon} />
            </svg>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar-foot">
        <Link href="/settings" className={`ledger-card${onSettings ? " active" : ""}`}>
          <div className="ledger-card-row">
            <span className="muted">共享帳本</span>
            <span className="dot dot-live"></span>
          </div>
          <div className="ledger-card-title">{householdName}</div>
          <div className="ledger-card-meta">{memberCount} 位成員 · TWD</div>
        </Link>

        <div className="user-pill">
          <div className="avatar">{initial}</div>
          <div className="user-info">
            <div className="user-name">{display}</div>
            <div className="user-email">{user.email ?? user.uid}</div>
          </div>
          <button className="icon-btn" type="button" aria-label="登出" title="登出" onClick={logout} disabled={isPending}>
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 12H4M4 12l4-4M4 12l4 4M10 4h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-8" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
