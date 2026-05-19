"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import Link from "next/link";

import { auth } from "@/lib/firebase";

async function exchangeTokenForSession(idToken: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error("session_failed");
}

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("兩次密碼不一致。");
      return;
    }

    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();
      await exchangeTokenForSession(idToken);
      const next = searchParams.get("next") ?? "/";
      startTransition(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.replace(next as any);
        router.refresh();
      });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code.includes("email-already-in-use")) {
        setError("此 Email 已被註冊，請直接登入。");
      } else if (code.includes("weak-password")) {
        setError("密碼至少需要 6 個字元。");
      } else if (code.includes("invalid-email")) {
        setError("Email 格式不正確。");
      } else {
        setError("註冊失敗，請稍後再試。");
      }
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} style={{ marginTop: 18 }}>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>

        <label className="field">
          <span>密碼</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少 6 個字元"
            required
          />
        </label>

        <label className="field">
          <span>確認密碼</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            required
          />
        </label>

        {error ? <p className="error" style={{ margin: "10px 0 0" }}>{error}</p> : null}

        <div style={{ marginTop: 16 }}>
          <button type="submit" disabled={isPending} style={{ width: "100%", justifyContent: "center" }}>
            {isPending ? "註冊中…" : "建立帳號"}
          </button>
        </div>
      </form>

      <p style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
        已有帳號？{" "}
        <Link href="/login" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
          登入
        </Link>
      </p>
    </>
  );
}
