"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "needs-auth" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`/api/invite/${token}`, { method: "POST" })
      .then(async (res) => {
        if (res.ok) {
          setStatus("success");
          setTimeout(() => router.replace("/"), 2000);
        } else {
          const body = await res.json().catch(() => ({}));
          if (body.error === "unauthorized") {
            setStatus("needs-auth");
            return;
          }
          const errorMessages: Record<string, string> = {
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
        {status === "needs-auth" && (
          <>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>👋</div>
            <h2 style={{ marginBottom: "0.5rem" }}>您收到了邀請！</h2>
            <p className="muted" style={{ marginBottom: "1.5rem" }}>請先登入或建立帳號，再加入家庭帳本。</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <a
                href={`/login?next=/invite/${token}`}
                style={{ width: "100%", display: "block", textAlign: "center", padding: "9px 16px", borderRadius: "var(--radius-sm)", background: "var(--accent)", color: "#fff", fontWeight: 600, fontSize: 13.5, textDecoration: "none" }}
              >
                登入現有帳號
              </a>
              <a
                href={`/register?next=/invite/${token}`}
                style={{ width: "100%", display: "block", textAlign: "center", padding: "9px 16px", borderRadius: "var(--radius-sm)", background: "var(--bg-elev)", color: "var(--text)", fontWeight: 600, fontSize: 13.5, border: "1px solid var(--border)", textDecoration: "none" }}
              >
                建立新帳號
              </a>
            </div>
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
