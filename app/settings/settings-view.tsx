"use client";

import { useState, useTransition } from "react";

type Member = {
  uid: string;
  role: string;
  canEdit: boolean;
  joinedAt: string;
};

type Props = {
  isOwner: boolean;
  household: { id: number; name: string };
  currentUid: string;
  members: Member[];
};

function uidDisplay(uid: string) {
  return uid.length > 20 ? uid.slice(0, 8) + "…" + uid.slice(-6) : uid;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export function SettingsView({ isOwner, household, currentUid, members: initialMembers }: Props) {
  const [members, setMembers] = useState(initialMembers);
  const [householdName, setHouseholdName] = useState(household.name);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(household.name);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  async function saveName() {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === householdName) { setEditingName(false); return; }
    const res = await fetch("/api/household", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (res.ok) { setHouseholdName(trimmed); setEditingName(false); }
  }

  async function generateInvite() {
    const res = await fetch("/api/invite", { method: "POST" });
    if (!res.ok) return;
    const { token } = await res.json();
    setInviteLink(`${window.location.origin}/invite/${token}`);
    setCopied(false);
  }

  async function copyLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function toggleEdit(uid: string, canEdit: boolean) {
    const res = await fetch(`/api/household/members/${uid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canEdit }),
    });
    if (!res.ok) return;
    setMembers((prev) => prev.map((m) => (m.uid === uid ? { ...m, canEdit } : m)));
  }

  async function removeMember(uid: string) {
    if (!confirm("確定要移除此成員嗎？")) return;
    const res = await fetch(`/api/household/members/${uid}`, { method: "DELETE" });
    if (!res.ok) return;
    setMembers((prev) => prev.filter((m) => m.uid !== uid));
  }

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">設定 · Settings</div>
          <h1 className="page-title">帳本設定</h1>
        </div>
      </header>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div className="card-head">
          <div className="card-title">帳本資訊</div>
        </div>
        <div style={{ padding: "0 1.5rem 1.5rem" }}>
          <label className="muted" style={{ fontSize: "0.75rem", display: "block", marginBottom: "0.4rem" }}>
            帳本名稱
          </label>
          {editingName ? (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                style={{
                  background: "var(--panel)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: "var(--radius-sm)",
                  padding: "0.35rem 0.6rem",
                  color: "var(--text)",
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  minWidth: 0,
                  width: 220,
                }}
              />
              <button className="btn btn-primary" style={{ padding: "0.35rem 0.75rem" }} onClick={saveName}>儲存</button>
              <button className="btn btn-ghost" style={{ padding: "0.35rem 0.75rem" }} onClick={() => setEditingName(false)}>取消</button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{householdName}</span>
              {isOwner && (
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                  onClick={() => { setNameInput(householdName); setEditingName(true); }}
                >
                  編輯
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div className="card-head">
          <div className="card-title">成員管理</div>
          {isOwner && (
            <button className="btn btn-primary" onClick={() => startTransition(generateInvite)} disabled={isPending}>
              產生邀請連結
            </button>
          )}
        </div>

        {inviteLink && (
          <div style={{ padding: "0 1.5rem 1rem", display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <input
              readOnly
              value={inviteLink}
              style={{
                flex: 1,
                minWidth: 0,
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "0.4rem 0.75rem",
                color: "var(--text)",
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "0.8rem",
              }}
            />
            <button className="btn btn-ghost" onClick={copyLink}>
              {copied ? "已複製 ✓" : "複製"}
            </button>
          </div>
        )}

        <div style={{ padding: "0 1.5rem 1.5rem" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="muted" style={{ textAlign: "left", padding: "0.5rem 0", fontWeight: 500, fontSize: "0.75rem" }}>成員</th>
                <th className="muted" style={{ textAlign: "left", padding: "0.5rem 0", fontWeight: 500, fontSize: "0.75rem" }}>角色</th>
                <th className="muted" style={{ textAlign: "left", padding: "0.5rem 0", fontWeight: 500, fontSize: "0.75rem" }}>加入日期</th>
                {isOwner && <th style={{ width: 160 }}></th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.uid} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                  <td style={{ padding: "0.75rem 0" }}>
                    <span className="num" style={{ fontSize: "0.8rem" }}>{uidDisplay(m.uid)}</span>
                    {m.uid === currentUid && <span className="chip chip-muted" style={{ marginLeft: "0.5rem" }}>我</span>}
                  </td>
                  <td style={{ padding: "0.75rem 0" }}>
                    {m.role === "owner" ? (
                      <span className="chip chip-pos">擁有者</span>
                    ) : m.canEdit ? (
                      <span className="chip chip-muted">可編輯</span>
                    ) : (
                      <span className="chip chip-muted">僅檢視</span>
                    )}
                  </td>
                  <td className="muted" style={{ padding: "0.75rem 0", fontSize: "0.85rem" }}>
                    {formatDate(m.joinedAt)}
                  </td>
                  {isOwner && m.uid !== currentUid && (
                    <td style={{ padding: "0.75rem 0", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: "0.8rem", padding: "0.25rem 0.6rem" }}
                          onClick={() => toggleEdit(m.uid, !m.canEdit)}
                        >
                          {m.canEdit ? "改為僅檢視" : "允許編輯"}
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ fontSize: "0.8rem", padding: "0.25rem 0.6rem" }}
                          onClick={() => removeMember(m.uid)}
                        >
                          移除
                        </button>
                      </div>
                    </td>
                  )}
                  {isOwner && m.uid === currentUid && <td></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">邀請說明</div>
        </div>
        <div style={{ padding: "0 1.5rem 1.5rem" }} className="muted">
          <ul style={{ listStyle: "disc", paddingLeft: "1.2rem", lineHeight: 1.9, fontSize: "0.9rem" }}>
            <li>點擊「產生邀請連結」可產生一個有效期 7 天的一次性邀請連結。</li>
            <li>將連結分享給家人，對方點擊後需先登入，然後自動加入此帳本。</li>
            <li>新成員預設為「僅檢視」，帳本擁有者可在此頁面調整權限。</li>
            <li>每個連結只能使用一次，使用後即失效。</li>
          </ul>
        </div>
      </div>
    </>
  );
}
