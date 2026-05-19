"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import Link from "next/link";

import { auth } from "@/lib/firebase";

const googleProvider = new GoogleAuthProvider();

async function exchangeTokenForSession(idToken: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error("session_failed");
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSuccess() {
    const next = searchParams.get("next") ?? "/";
    startTransition(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.replace(next as any);
      router.refresh();
    });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();
      await exchangeTokenForSession(idToken);
      handleSuccess();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code.includes("wrong-password") || code.includes("user-not-found") || code.includes("invalid-credential")) {
        setError("帳號或密碼錯誤。");
      } else {
        setError("登入失敗，請稍後再試。");
      }
    }
  }

  async function onGoogleSignIn() {
    setError(null);

    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const idToken = await credential.user.getIdToken();
      await exchangeTokenForSession(idToken);
      handleSuccess();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code !== "auth/popup-closed-by-user") {
        setError("Google 登入失敗，請稍後再試。");
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
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </label>

        {error ? <p className="error" style={{ margin: "10px 0 0" }}>{error}</p> : null}

        <div style={{ marginTop: 16 }}>
          <button type="submit" disabled={isPending} style={{ width: "100%", justifyContent: "center" }}>
            {isPending ? "登入中…" : "登入"}
          </button>
        </div>
      </form>

      <div style={{ marginTop: 12, textAlign: "center", color: "var(--muted)", fontSize: 12 }}>或</div>

      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          onClick={onGoogleSignIn}
          disabled={isPending}
          style={{
            width: "100%",
            justifyContent: "center",
            background: "var(--bg-elev)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 16px",
            borderRadius: "var(--radius-sm)",
            fontSize: 13.5,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.4 35.5 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-8H6.4C9.8 35.5 16.4 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.6l6.2 5.2C37 39 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/>
          </svg>
          Google 登入
        </button>
      </div>

      <p style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
        還沒有帳號？{" "}
        <Link href="/register" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
          立即註冊
        </Link>
      </p>
    </>
  );
}
