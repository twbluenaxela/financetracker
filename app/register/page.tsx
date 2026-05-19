import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { RegisterForm } from "@/app/register/register-form";

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) {
    redirect("/");
  }

  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark">
            <svg viewBox="0 0 32 32" width="22" height="22">
              <path d="M6 22 L13 12 L18 18 L26 8" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="26" cy="8" r="2.5" fill="currentColor" />
            </svg>
          </div>
          <div>
            <div className="brand-name">家庭理財</div>
            <div className="brand-sub">Shared Ledger</div>
          </div>
        </div>
        <h1>建立帳號</h1>
        <p className="muted">註冊後系統自動建立家庭帳戶，可邀請成員加入。</p>
        <RegisterForm />
      </section>
    </main>
  );
}
