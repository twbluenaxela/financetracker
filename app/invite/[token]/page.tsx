"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`/api/invite/${token}`, { method: "POST" })
      .then(async (res) => {
        if (res.ok) {
          setStatus("success");
          setTimeout(() => router.replace("/"), 2000);
        } else {
          const body = await res.json().catch(() => ({}));
          const errorMessages: Record<string, string> = {
            unauthorized: "請先登入再點擊邀請連結。",
            invalid_token: "邀請連結無效或已過期。",
            already_used: "這個邀請連結已被使用過了。",
            expired: "邀請連結已過期（有效期為 7 天）。",
            already_member: "您已經是這個帳本的成員了。",
            already_in_household: "您已經加入了另一個帳本，無法同時加入多個。",
          };
          setMessage(errorMessages[body.error] ?? "發生未知錯誤，請稍後再試。");
          setStatus("error");
        }
      })
      .catch(() => {
        setMessage("網路錯誤，請稍後再試。");
        setStatus("error");
      });
  }, [token, router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div className="card" style={{ maxWidth: 400, width: "100%", padding: "2rem", textAlign: "center" }}>
        {status === "loading" && (
          <>
            <div className="muted" style={{ marginBottom: "0.75rem" }}>正在驗證邀請…</div>
          </>
        )}
        {status === "success" && (
          <>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>✓</div>
            <h2 style={{ marginBottom: "0.5rem" }}>已成功加入帳本！</h2>
            <p className="muted">正在為您導向總覽頁…</p>
          </>
        )}
        {status === "error" && (
          <>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>✗</div>
            <h2 style={{ marginBottom: "0.5rem" }}>無法加入</h2>
            <p className="muted" style={{ marginBottom: "1.5rem" }}>{message}</p>
            <a href="/login" className="btn btn-primary" style={{ display: "inline-block" }}>
              前往登入
            </a>
          </>
        )}
      </div>
    </div>
  );
}
