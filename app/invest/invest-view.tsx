"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  blendedReturn,
  lumpSumSchedule,
  periodicSchedule,
  recommendAllocation,
  yearsToTarget,
  type RiskLevel,
} from "@/lib/invest";

type InvestPlan = {
  id: number;
  startingCapital: number;
  monthlyContribution: number;
  targetAmount: number;
  twStockPct: number;
  usStockPct: number;
  bondPct: number;
  twStockReturn: number;
  usStockReturn: number;
  bondReturn: number;
  age: number | null;
  risk: RiskLevel;
};

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

export function InvestView({ plan }: { plan: InvestPlan }) {
  const router = useRouter();
  const [draft, setDraft] = useState(plan);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const blended = useMemo(() => blendedReturn(draft), [draft]);
  const annualContribution = draft.monthlyContribution * 12;
  const need = yearsToTarget({
    target: draft.targetAmount,
    annualRate: blended,
    principal: draft.startingCapital,
    annualContribution,
  });
  const horizon = need ?? 20;
  const recommendation = recommendAllocation(draft.age ?? 35, draft.risk, horizon);
  const lumpRows = lumpSumSchedule(draft.startingCapital, blended, Math.min(40, (need ?? 20) + 2));
  const periodicRows = periodicSchedule(annualContribution, blended, Math.min(40, (need ?? 20) + 2));

  async function save() {
    setError(null);
    const response = await fetch("/api/invest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });

    if (!response.ok) {
      setError("投資參數儲存失敗。");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">投資試算 · Invest</div>
          <h1 className="page-title">投資組合與複利試算</h1>
          <div className="topbar-sub muted">延續現有 Python 邏輯，先把表單與投影搬到 Next。</div>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-primary" type="button" onClick={save} disabled={isPending}>
            {isPending ? "儲存中…" : "儲存並重新試算"}
          </button>
        </div>
      </header>

      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-title">參數設定</div>
            <div className="card-sub muted">報酬率以小數輸入，`0.06 = 6%`。</div>
          </div>
        </div>

        <div className="month-form-grid">
          <label className="field"><span>起始資金（單筆）</span><input type="number" min={0} value={draft.startingCapital} onChange={(e) => setDraft({ ...draft, startingCapital: Number(e.target.value) || 0 })} /></label>
          <label className="field"><span>每月投資金額</span><input type="number" min={0} value={draft.monthlyContribution} onChange={(e) => setDraft({ ...draft, monthlyContribution: Number(e.target.value) || 0 })} /></label>
          <label className="field"><span>目標金額</span><input type="number" min={0} value={draft.targetAmount} onChange={(e) => setDraft({ ...draft, targetAmount: Number(e.target.value) || 0 })} /></label>
          <label className="field"><span>台股 %</span><input type="number" min={0} max={100} value={draft.twStockPct} onChange={(e) => setDraft({ ...draft, twStockPct: Number(e.target.value) || 0 })} /></label>
          <label className="field"><span>美股 %</span><input type="number" min={0} max={100} value={draft.usStockPct} onChange={(e) => setDraft({ ...draft, usStockPct: Number(e.target.value) || 0 })} /></label>
          <label className="field"><span>債券 %</span><input type="number" min={0} max={100} value={draft.bondPct} onChange={(e) => setDraft({ ...draft, bondPct: Number(e.target.value) || 0 })} /></label>
          <label className="field"><span>台股預期年報酬</span><input type="number" step="0.001" min={0} value={draft.twStockReturn} onChange={(e) => setDraft({ ...draft, twStockReturn: Number(e.target.value) || 0 })} /></label>
          <label className="field"><span>美股預期年報酬</span><input type="number" step="0.001" min={0} value={draft.usStockReturn} onChange={(e) => setDraft({ ...draft, usStockReturn: Number(e.target.value) || 0 })} /></label>
          <label className="field"><span>債券預期年報酬</span><input type="number" step="0.001" min={0} value={draft.bondReturn} onChange={(e) => setDraft({ ...draft, bondReturn: Number(e.target.value) || 0 })} /></label>
          <label className="field"><span>年齡</span><input type="number" min={0} max={120} value={draft.age ?? ""} onChange={(e) => setDraft({ ...draft, age: e.target.value ? Number(e.target.value) : null })} /></label>
          <label className="field"><span>風險偏好</span>
            <select value={draft.risk} onChange={(e) => setDraft({ ...draft, risk: e.target.value as RiskLevel })}>
              <option value="conservative">保守</option>
              <option value="moderate">穩健</option>
              <option value="aggressive">積極</option>
            </select>
          </label>
        </div>

        {error ? <p className="error" style={{ marginTop: 16 }}>{error}</p> : null}
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">投資組合</div>
              <div className="card-sub muted">加權預期年報酬</div>
            </div>
          </div>
          <div className="hero-figure pos" style={{ marginTop: 0 }}>
            <span className="amount" style={{ fontSize: 48 }}>{(blended * 100).toFixed(2)}%</span>
          </div>
          <div className="hero-meta">
            <div className="chip">台股 <strong>{draft.twStockPct}%</strong></div>
            <div className="chip">美股 <strong>{draft.usStockPct}%</strong></div>
            <div className="chip">債券 <strong>{draft.bondPct}%</strong></div>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Bogleheads 建議配置</div>
              <div className="card-sub muted">依年齡與風險偏好的透明啟發式</div>
            </div>
          </div>
          <div className="hero-meta" style={{ marginTop: 0 }}>
            <div className="chip chip-pos">債券 <strong>{recommendation.bondPct}%</strong></div>
            <div className="chip chip-pos">美股 <strong>{recommendation.usStockPct}%</strong></div>
            <div className="chip chip-pos">台股 <strong>{recommendation.twStockPct}%</strong></div>
          </div>
          <ul className="muted" style={{ margin: "14px 0 0", paddingLeft: 18, fontSize: 12.5, lineHeight: 1.7 }}>
            {recommendation.rationale.map((row) => <li key={row}>{row}</li>)}
          </ul>
        </section>
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">案例 1 · 單筆投資</div>
              <div className="card-sub muted">
                起始 {money(draft.startingCapital)} · {need != null ? `約 ${need} 年達標` : "期間內未達標"}
              </div>
            </div>
          </div>
          <div className="table-wrap">
            <table className="recent-table">
              <thead>
                <tr><th>經過年度</th><th className="num">累積總資金</th></tr>
              </thead>
              <tbody>
                {lumpRows.filter((row) => [0, 1, 3, 5, 10, 15, 20, 30, 40].includes(row.year)).map((row) => (
                  <tr key={row.year}>
                    <td>{row.year} 年</td>
                    <td className="num">{money(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">案例 2 · 定期投資</div>
              <div className="card-sub muted">
                每月 {money(draft.monthlyContribution)}（年 {money(annualContribution)}）
              </div>
            </div>
          </div>
          <div className="table-wrap">
            <table className="recent-table">
              <thead>
                <tr><th>經過年度</th><th className="num">當年投入</th><th className="num">累積總資金</th></tr>
              </thead>
              <tbody>
                {periodicRows.filter((row) => [0, 1, 3, 5, 10, 15, 20, 30, 40].includes(row.year)).map((row) => (
                  <tr key={row.year}>
                    <td>{row.year} 年</td>
                    <td className="num">{money(row.contribution)}</td>
                    <td className="num">{money(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
