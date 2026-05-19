"use client";

import { useRef, useState, useTransition } from "react";

type Member = {
  uid: string;
  role: string;
  canEdit: boolean;
  displayName: string | null;
  photoUrl: string | null;
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

async function resizeToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d")!;
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 64, 64);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function MemberRow({
  member,
  isOwner,
  currentUid,
  onSaveName,
  onSavePhoto,
  onToggleEdit,
  onRemove,
}: {
  member: Member;
  isOwner: boolean;
  currentUid: string;
  onSaveName: (uid: string, name: string | null) => Promise<void>;
  onSavePhoto: (uid: string, photoUrl: string | null) => Promise<void>;
  onToggleEdit: (uid: string, canEdit: boolean) => Promise<void>;
  onRemove: (uid: string) => Promise<void>;
}) {
  const isSelf = member.uid === currentUid;
  const canEditName = isOwner || isSelf;
  const canEditPhoto = isOwner || isSelf;

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(member.displayName ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  async function saveName() {
    const trimmed = nameInput.trim() || null;
    await onSaveName(member.uid, trimmed);
    setEditingName(false);
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await resizeToDataUrl(file);
    await onSavePhoto(member.uid, dataUrl);
    e.target.value = "";
  }

  const photoSrc = member.photoUrl;
  const initial = (member.displayName ?? uidDisplay(member.uid))[0]?.toUpperCase() ?? "?";

  return (
    <tr style={{ borderBottom: "1px solid var(--border-soft)" }}>
      {/* Avatar */}
      <td style={{ padding: "0.75rem 0.75rem 0.75rem 0", width: 44 }}>
        <div style={{ position: "relative", display: "inline-block" }}>
          {photoSrc ? (
            <img
              src={photoSrc}
              alt=""
              style={{
                width: 32,
                height: 32,
                borderRadius: "99px",
                objectFit: "cover",
                border: "1px solid var(--border-strong)",
                display: "block",
              }}
            />
          ) : (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "99px",
                background: "linear-gradient(135deg, #4a3f33, #2a221c)",
                color: "var(--text)",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                fontSize: 13,
                border: "1px solid var(--border-strong)",
              }}
            >
              {initial}
            </div>
          )}
          {canEditPhoto && (
            <>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                title="更換頭像"
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "99px",
                  background: "rgba(0,0,0,0.45)",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: 0,
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handlePhotoChange}
              />
            </>
          )}
        </div>
      </td>

      {/* Name */}
      <td style={{ padding: "0.75rem 0" }}>
        {editingName ? (
          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") { setNameInput(member.displayName ?? ""); setEditingName(false); }
              }}
              placeholder={uidDisplay(member.uid)}
              style={{
                background: "var(--panel)",
                border: "1px solid var(--border-strong)",
                borderRadius: "var(--radius-sm)",
                padding: "0.25rem 0.5rem",
                color: "var(--text)",
                fontSize: "0.85rem",
                width: 130,
                minWidth: 0,
              }}
            />
            <button className="btn btn-primary" style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }} onClick={saveName}>儲存</button>
            <button className="btn btn-ghost" style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }} onClick={() => { setNameInput(member.displayName ?? ""); setEditingName(false); }}>取消</button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {member.displayName ? (
              <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{member.displayName}</span>
            ) : (
              <span className="num" style={{ fontSize: "0.8rem" }}>{uidDisplay(member.uid)}</span>
            )}
            {isSelf && <span className="chip chip-muted">我</span>}
            {canEditName && (
              <button
                className="btn btn-ghost"
                style={{ fontSize: "0.72rem", padding: "0.15rem 0.4rem" }}
                onClick={() => setEditingName(true)}
              >
                改名
              </button>
            )}
          </div>
        )}
      </td>

      {/* Role */}
      <td style={{ padding: "0.75rem 0" }}>
        {member.role === "owner" ? (
          <span className="chip chip-pos">擁有者</span>
        ) : member.canEdit ? (
          <span className="chip chip-muted">可編輯</span>
        ) : (
          <span className="chip chip-muted">僅檢視</span>
        )}
      </td>

      {/* Joined */}
      <td className="muted" style={{ padding: "0.75rem 0", fontSize: "0.85rem" }}>
        {formatDate(member.joinedAt)}
      </td>

      {/* Owner actions */}
      {isOwner && !isSelf && (
        <td style={{ padding: "0.75rem 0", textAlign: "right" }}>
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
            <button
              className="btn btn-ghost"
              style={{ fontSize: "0.8rem", padding: "0.25rem 0.6rem" }}
              onClick={() => onToggleEdit(member.uid, !member.canEdit)}
            >
              {member.canEdit ? "改為僅檢視" : "允許編輯"}
            </button>
            <button
              className="btn btn-danger"
              style={{ fontSize: "0.8rem", padding: "0.25rem 0.6rem" }}
              onClick={() => onRemove(member.uid)}
            >
              移除
            </button>
          </div>
        </td>
      )}
      {isOwner && isSelf && <td></td>}
    </tr>
  );
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

  async function saveDisplayName(uid: string, displayName: string | null) {
    const res = await fetch(`/api/household/members/${uid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    });
    if (!res.ok) return;
    setMembers((prev) => prev.map((m) => (m.uid === uid ? { ...m, displayName } : m)));
  }

  async function savePhoto(uid: string, photoUrl: string | null) {
    const res = await fetch(`/api/household/members/${uid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoUrl }),
    });
    if (!res.ok) return;
    setMembers((prev) => prev.map((m) => (m.uid === uid ? { ...m, photoUrl } : m)));
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

        <div style={{ padding: "0 1.5rem 1.5rem", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ width: 44 }}></th>
                <th className="muted" style={{ textAlign: "left", padding: "0.5rem 0", fontWeight: 500, fontSize: "0.75rem" }}>成員</th>
                <th className="muted" style={{ textAlign: "left", padding: "0.5rem 0", fontWeight: 500, fontSize: "0.75rem" }}>角色</th>
                <th className="muted" style={{ textAlign: "left", padding: "0.5rem 0", fontWeight: 500, fontSize: "0.75rem" }}>加入日期</th>
                {isOwner && <th style={{ width: 160 }}></th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <MemberRow
                  key={m.uid}
                  member={m}
                  isOwner={isOwner}
                  currentUid={currentUid}
                  onSaveName={saveDisplayName}
                  onSavePhoto={savePhoto}
                  onToggleEdit={toggleEdit}
                  onRemove={removeMember}
                />
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
