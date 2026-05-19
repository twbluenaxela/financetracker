"use client";

import { useEffect, useMemo, useState } from "react";
import type { StatementBundle, StatementMonth } from "@/lib/statements";
import { compactMoney, monthChinese, monthLabel, money } from "@/lib/statements";

type Period = "12M" | "2026" | "2025";

function fmtSigned(n: number) {
  return (n >= 0 ? "+" : "") + money(n);
}

function monthShort(month: number) {
  return ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"][month - 1]!;
}

function expColor(v: number, max: number) {
  if (!v || max === 0) return "var(--bg-elev)";
  const t = Math.min(1, Math.pow(v / max, 0.7));
  return `color-mix(in oklab, var(--neg) ${Math.round(t * 78)}%, var(--bg-elev))`;
}

function incColor(v: number, max: number) {
  if (!v || max === 0) return "var(--bg-elev)";
  const t = Math.min(1, Math.pow(v / max, 0.7));
  return `color-mix(in oklab, var(--accent) ${Math.round(t * 78)}%, var(--bg-elev))`;
}

// ---- Period switcher ----
function PeriodSwitcher({ period, onPeriod }: { period: Period; onPeriod: (p: Period) => void }) {
  return (
    <div className="period-sw">
      {(["12M", "2026", "2025"] as Period[]).map((p) => (
        <button key={p} className={period === p ? "active" : ""} onClick={() => onPeriod(p)}>
          {p === "12M" ? "滾動 12M" : p === "2026" ? "2026 YTD" : "2025"}
        </button>
      ))}
    </div>
  );
}

// ---- KPI strip ----
function ReportsKPIs({ months, netWorth, totalAssets, totalLiab }: {
  months: StatementMonth[];
  netWorth: number;
  totalAssets: number;
  totalLiab: number;
}) {
  const totalI = months.reduce((a, m) => a + m.income, 0);
  const totalE = months.reduce((a, m) => a + m.expense, 0);
  const totalS = totalI - totalE;
  const rate = totalI > 0 ? (totalS / totalI) * 100 : 0;
  const half = Math.floor(months.length / 2);
  const sA = months.slice(0, half).reduce((a, m) => a + m.surplus, 0);
  const sB = months.slice(half).reduce((a, m) => a + m.surplus, 0);
  const surplusYoY = sA > 0 ? ((sB - sA) / sA) * 100 : 0;

  return (
    <div className="kpi-strip">
      <div className="kpi-tile">
        <div className="kpi-label">期間收入</div>
        <div className="kpi-val">{compactMoney(totalI)}</div>
        <div className="kpi-foot">{months.length} 個月累計</div>
      </div>
      <div className="kpi-tile">
        <div className="kpi-label">期間支出</div>
        <div className="kpi-val neg">{compactMoney(totalE)}</div>
        <div className="kpi-foot">{months.length} 個月累計</div>
      </div>
      <div className="kpi-tile">
        <div className="kpi-label">期間結餘</div>
        <div className={`kpi-val ${totalS >= 0 ? "pos" : "neg"}`}>{compactMoney(totalS)}</div>
        {months.length >= 2 && (
          <div className={`kpi-trend ${surplusYoY >= 0 ? "pos" : "neg"}`}>
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d={surplusYoY >= 0 ? "m6 14 6-6 6 6" : "m6 10 6 6 6-6"}/>
            </svg>
            {surplusYoY >= 0 ? "+" : ""}{surplusYoY.toFixed(1)}% 對前期
          </div>
        )}
      </div>
      <div className="kpi-tile">
        <div className="kpi-label">儲蓄率</div>
        <div className="kpi-val muted-val">{rate.toFixed(1)}%</div>
        <div className="kpi-foot">收入留下的比例</div>
      </div>
      <div className="kpi-tile">
        <div className="kpi-label">淨值</div>
        <div className="kpi-val">{compactMoney(netWorth)}</div>
        <div className="kpi-foot">資產 {compactMoney(totalAssets)} − 負債 {compactMoney(totalLiab)}</div>
      </div>
    </div>
  );
}

// ---- Cashflow chart ----
function CashflowChart({ months, activeIdx, onPick }: {
  months: StatementMonth[];
  activeIdx: number;
  onPick: (i: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (!months.length) return null;

  const H = 300, mid = H / 2;
  const N = months.length;
  const slotW = 100 / N;
  const barW = slotW * 0.32;
  const halfH = mid - 14;

  const rawMax = Math.max(...months.flatMap((m) => [m.income, m.expense]), 1);
  const axisMax = Math.ceil(rawMax / 20000) * 20000;

  let cum = 0;
  const cumPoints = months.map((m) => { cum += m.surplus; return cum; });
  const cumMin = Math.min(0, ...cumPoints);
  const cumMax = Math.max(0, ...cumPoints);
  const cumRange = Math.max(cumMax - cumMin, 1);
  const cumToY = (v: number) => H - 18 - ((v - cumMin) / cumRange) * (H - 36);
  const xOf = (i: number) => slotW * i + slotW / 2;

  // Catmull-Rom → cubic Bezier smoothed cumulative line
  const pts = cumPoints.map((v, i) => ({ x: xOf(i), y: cumToY(v) }));
  let linePath = "";
  if (pts.length > 0) {
    linePath = `M ${pts[0]!.x} ${pts[0]!.y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i]!;
      const p1 = pts[i]!;
      const p2 = pts[i + 1]!;
      const p3 = pts[i + 2] ?? p2;
      const t = 0.18;
      const c1x = p1.x + (p2.x - p0.x) * t;
      const c1y = p1.y + (p2.y - p0.y) * t;
      const c2x = p2.x - (p3.x - p1.x) * t;
      const c2y = p2.y - (p3.y - p1.y) * t;
      linePath += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
    }
  }
  const baselineY = cumToY(0);
  const areaPath = pts.length > 0
    ? `M ${pts[0]!.x} ${baselineY} L ${linePath.slice(2)} L ${pts[pts.length - 1]!.x} ${baselineY} Z`
    : "";

  const totalIncome  = months.reduce((a, m) => a + m.income, 0);
  const totalExpense = months.reduce((a, m) => a + m.expense, 0);
  const totalSurplus = totalIncome - totalExpense;
  const avgSavings   = totalIncome > 0 ? (totalSurplus / totalIncome) * 100 : 0;
  const endCum       = cumPoints.length > 0 ? cumPoints[cumPoints.length - 1]! : 0;

  return (
    <div className="card cf-card">
      <div className="card-head">
        <div>
          <div className="card-title">現金流</div>
          <div className="card-sub muted">每月收入 vs 支出 · 累積現金以藍線疊加 · 點擊月份查看細節</div>
        </div>
        <div className="cf-legend">
          <span><span className="cf-legend-sw income"></span>收入</span>
          <span><span className="cf-legend-sw expense"></span>支出</span>
          <span><span className="cf-legend-line"></span>累積現金</span>
        </div>
      </div>

      <div className="cf-wrap">
        <div className="cf-yaxis">
          <span>{compactMoney(axisMax)}</span>
          <span>{compactMoney(axisMax / 2)}</span>
          <span className="zero">0</span>
          <span className="neg">-{compactMoney(axisMax / 2)}</span>
          <span className="neg">-{compactMoney(axisMax)}</span>
        </div>

        <div className="cf-chart">
          <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="cf-svg">
            <defs>
              <linearGradient id="cf-grad-income" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="var(--accent)" stopOpacity="0.95"/>
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.35"/>
              </linearGradient>
              <linearGradient id="cf-grad-expense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="var(--neg)" stopOpacity="0.35"/>
                <stop offset="100%" stopColor="var(--neg)" stopOpacity="0.95"/>
              </linearGradient>
              <linearGradient id="cf-grad-cum" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="var(--info)" stopOpacity="0.22"/>
                <stop offset="100%" stopColor="var(--info)" stopOpacity="0"/>
              </linearGradient>
            </defs>

            <line className="cf-grid" x1="0" x2="100" y1={mid - halfH}         y2={mid - halfH}/>
            <line className="cf-grid" x1="0" x2="100" y1={mid - halfH * 0.5}   y2={mid - halfH * 0.5}/>
            <line className="cf-grid" x1="0" x2="100" y1={mid + halfH * 0.5}   y2={mid + halfH * 0.5}/>
            <line className="cf-grid" x1="0" x2="100" y1={mid + halfH}         y2={mid + halfH}/>
            <line className="cf-mid"  x1="0" x2="100" y1={mid}                 y2={mid}/>

            <path d={areaPath} className="cf-cum-area"/>
            <path d={linePath} className="cf-cum-line"/>

            {months.map((m, i) => {
              const cx = xOf(i);
              const ih = Math.max(0, ((m.income)  / axisMax) * halfH);
              const eh = Math.max(0, ((m.expense) / axisMax) * halfH);
              const isActive = i === activeIdx;
              const isHover  = i === hover;
              return (
                <g key={i}
                   onMouseEnter={() => setHover(i)}
                   onMouseLeave={() => setHover(null)}
                   onClick={() => onPick(i)}
                   className={`cf-bar-group${isActive ? " active" : ""}${isHover ? " hover" : ""}`}>
                  <line className="cf-hover-guide" x1={cx} x2={cx} y1="0" y2={H}/>
                  <rect className="cf-hit"          x={cx - slotW / 2} y="0"      width={slotW} height={H}/>
                  <rect className="cf-bar-income"   x={cx - barW - 0.2} y={mid - ih} width={barW} height={ih} rx="1.2"/>
                  <rect className="cf-bar-expense"  x={cx + 0.2}        y={mid}      width={barW} height={eh} rx="1.2"/>
                </g>
              );
            })}

            {months.map((_, i) => {
              const isActive = i === activeIdx;
              const isHover  = i === hover;
              const r = isActive || isHover ? 2.4 : 1.7;
              return (
                <circle
                  key={`d${i}`}
                  className={`cf-cum-dot${isActive ? " active" : ""}${isHover ? " hover" : ""}`}
                  cx={xOf(i)} cy={cumToY(cumPoints[i]!)} r={r}
                  style={{ pointerEvents: "none" }}
                />
              );
            })}
          </svg>

          <div className="cf-xlabels">
            {months.map((m, i) => (
              <span key={i}
                    className={`cf-xlabel${i === activeIdx ? " active" : ""}`}
                    style={{ width: `${slotW}%` }}
                    onClick={() => onPick(i)}>
                {monthShort(m.month)}
                {m.month === 1 && <em>{String(m.year)}</em>}
              </span>
            ))}
          </div>

          {hover !== null && months[hover] && (
            <div className="cf-tip" style={{ left: `${slotW * hover + slotW / 2}%` }}>
              <div className="cf-tip-head">{monthLabel(months[hover]!.year, months[hover]!.month)}</div>
              <div className="cf-tip-row"><span className="sw income"></span>收入<strong>{money(months[hover]!.income)}</strong></div>
              <div className="cf-tip-row"><span className="sw expense"></span>支出<strong>{money(months[hover]!.expense)}</strong></div>
              <div className="cf-tip-row net">結餘<strong style={{ color: months[hover]!.surplus >= 0 ? "var(--pos)" : "var(--neg)" }}>{money(months[hover]!.surplus)}</strong></div>
              <div className="cf-tip-row"><span className="sw cum"></span>累積<strong>{money(cumPoints[hover]!)}</strong></div>
            </div>
          )}
        </div>
      </div>

      <div className="cf-summary">
        <div className="cf-summary-cell">
          <span className="l">區間總收入</span>
          <span className="v">{money(totalIncome)}</span>
          <span className="s">{months.length} 個月</span>
        </div>
        <div className="cf-summary-cell">
          <span className="l">區間總支出</span>
          <span className="v">{money(totalExpense)}</span>
          <span className="s">月均 {compactMoney(totalExpense / Math.max(months.length, 1))}</span>
        </div>
        <div className="cf-summary-cell">
          <span className="l">淨結餘</span>
          <span className={`v ${totalSurplus >= 0 ? "pos" : "neg"}`}>{totalSurplus >= 0 ? "+" : ""}{money(totalSurplus)}</span>
          <span className="s">儲蓄率 {avgSavings.toFixed(1)}%</span>
        </div>
        <div className="cf-summary-cell">
          <span className="l">期末累積現金</span>
          <span className="v info">{money(endCum)}</span>
          <span className="s">vs 起點 {endCum >= 0 ? "+" : ""}{compactMoney(endCum)}</span>
        </div>
      </div>
    </div>
  );
}

// ---- Heatmap ----
function CategoryHeatmap({ months, activeIdx }: { months: StatementMonth[]; activeIdx: number }) {
  const [tip, setTip] = useState<{ cat: string; mIdx: number; kind: string; v: number } | null>(null);

  const expByCat: Record<string, number> = {};
  const incByCat: Record<string, number> = {};
  months.forEach((m) => {
    m.expenseLines.forEach((l) => { expByCat[l.name] = (expByCat[l.name] ?? 0) + l.amount; });
    m.incomeLines.forEach((l) => { incByCat[l.name] = (incByCat[l.name] ?? 0) + l.amount; });
  });

  const expCats = Object.entries(expByCat).sort((a, b) => b[1] - a[1]).map(([n]) => n);
  const incCats = Object.entries(incByCat).sort((a, b) => b[1] - a[1]).map(([n]) => n);

  const allExpAmts = months.flatMap((m) => m.expenseLines.map((l) => l.amount));
  const allIncAmts = months.flatMap((m) => m.incomeLines.map((l) => l.amount));
  const maxExp = Math.max(...allExpAmts, 1);
  const maxInc = Math.max(...allIncAmts, 1);

  const monthCols = `repeat(${months.length}, minmax(0, 1fr))`;

  function cellFor(m: StatementMonth, cat: string, kind: "income" | "expense") {
    const line = (kind === "expense" ? m.expenseLines : m.incomeLines).find((l) => l.name === cat);
    return line?.amount ?? 0;
  }

  const colTotalsExp = months.map((m) => m.expenseLines.reduce((a, l) => a + l.amount, 0));
  const colTotalsInc = months.map((m) => m.incomeLines.reduce((a, l) => a + l.amount, 0));
  const colSurplus = months.map((_, i) => colTotalsInc[i]! - colTotalsExp[i]!);

  if (!months.length) return null;

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="card-head" style={{ padding: "20px 22px 12px", marginBottom: 0 }}>
        <div>
          <div className="card-title">分類 × 月份</div>
          <div className="card-sub muted">每格顏色越深、本月花費越大。把游標放在格子上看細項。</div>
        </div>
        <div className="hm-legend">
          <span>支出強度</span>
          <span className="hm-scale">
            {[0, 0.2, 0.4, 0.7, 1].map((t, i) => (
              <span key={i} style={{ background: expColor(maxExp * t, maxExp) }}></span>
            ))}
          </span>
          <span className="hm-scale-lbl">$0</span>
          <span className="hm-scale-lbl">→</span>
          <span className="hm-scale-lbl">{compactMoney(maxExp)}</span>
        </div>
      </div>

      <div className="hm-wrap" style={{ gridTemplateColumns: "170px 1fr 96px" }}>
        {/* Header row */}
        <div className="hm-corner tl">分類</div>
        <div className="hm-months" style={{ gridTemplateColumns: monthCols }}>
          {months.map((m, i) => (
            <div key={i} className={`hm-month${i === activeIdx ? " current" : ""}`}>
              {monthShort(m.month)}
              <em>{String(m.year).slice(2)}</em>
            </div>
          ))}
        </div>
        <div className="hm-corner" style={{ textAlign: "right", borderLeft: "1px solid var(--border)", color: "var(--muted)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>合計</div>

        {/* Income section header */}
        <div className="hm-row-label income" style={{ background: "var(--bg-elev)", fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-soft)" }}>
          <span className="swatch" style={{ background: "var(--accent)" }}></span><span>收入</span>
        </div>
        <div className="hm-row" style={{ gridTemplateColumns: monthCols, background: "var(--bg-elev)" }}></div>
        <div className="hm-total" style={{ background: "var(--bg-elev)", fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-soft)" }}>
          {compactMoney(Object.values(incByCat).reduce((a, b) => a + b, 0))}
        </div>

        {/* Income rows */}
        {incCats.map((cat) => {
          const rowTotal = months.reduce((a, m) => a + cellFor(m, cat, "income"), 0);
          return (
            <>
              <div key={`il-${cat}`} className="hm-row-label income">
                <span className="swatch" style={{ background: "var(--accent)" }}></span>
                <span className="name">{cat}</span>
              </div>
              <div key={`ir-${cat}`} className="hm-row" style={{ gridTemplateColumns: monthCols }}>
                {months.map((m, mi) => {
                  const v = cellFor(m, cat, "income");
                  const dense = v / maxInc > 0.35;
                  return (
                    <div key={mi}
                         className={`hm-cell${dense ? " dense" : ""}${mi === activeIdx ? " current" : ""}`}
                         style={{ background: incColor(v, maxInc) }}
                         onMouseEnter={() => setTip({ cat, mIdx: mi, kind: "income", v })}
                         onMouseLeave={() => setTip(null)}>
                      <span className="v">{v > 0 ? compactMoney(v) : ""}</span>
                      {tip?.cat === cat && tip?.mIdx === mi && (
                        <div className="hm-tip">
                          <div className="hm-tip-head">{monthLabel(m.year, m.month)} · {cat}</div>
                          <div className="hm-tip-row"><span>金額</span><strong>{money(v)}</strong></div>
                          <div className="hm-tip-row"><span>佔月收入</span><strong>{m.income > 0 ? ((v / m.income) * 100).toFixed(1) : "0"}%</strong></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div key={`it-${cat}`} className="hm-total">{compactMoney(rowTotal)}</div>
            </>
          );
        })}

        {/* Expense section header */}
        <div className="hm-row-label expense" style={{ background: "var(--bg-elev)", fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-soft)" }}>
          <span className="swatch" style={{ background: "var(--neg)" }}></span><span>支出</span>
        </div>
        <div className="hm-row" style={{ gridTemplateColumns: monthCols, background: "var(--bg-elev)" }}></div>
        <div className="hm-total" style={{ background: "var(--bg-elev)", fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-soft)" }}>
          {compactMoney(Object.values(expByCat).reduce((a, b) => a + b, 0))}
        </div>

        {/* Expense rows */}
        {expCats.map((cat) => {
          const rowTotal = months.reduce((a, m) => a + cellFor(m, cat, "expense"), 0);
          const isUncat = cat === "未分類";
          return (
            <>
              <div key={`el-${cat}`} className={`hm-row-label expense${isUncat ? " uncat" : ""}`}>
                <span className="swatch" style={{ background: isUncat ? "var(--warn)" : "var(--neg)" }}></span>
                <span className="name">{cat}</span>
                {isUncat && <span className="cat-flag" style={{ marginLeft: "auto" }}>未指派</span>}
              </div>
              <div key={`er-${cat}`} className="hm-row" style={{ gridTemplateColumns: monthCols }}>
                {months.map((m, mi) => {
                  const v = cellFor(m, cat, "expense");
                  const dense = v / maxExp > 0.35;
                  return (
                    <div key={mi}
                         className={`hm-cell${dense ? " dense" : ""}${mi === activeIdx ? " current" : ""}`}
                         style={{ background: expColor(v, maxExp) }}
                         onMouseEnter={() => setTip({ cat, mIdx: mi, kind: "expense", v })}
                         onMouseLeave={() => setTip(null)}>
                      <span className="v">{v > 0 ? compactMoney(v) : ""}</span>
                      {tip?.cat === cat && tip?.mIdx === mi && (
                        <div className="hm-tip">
                          <div className="hm-tip-head">{monthLabel(m.year, m.month)} · {cat}</div>
                          <div className="hm-tip-row"><span>金額</span><strong>{money(v)}</strong></div>
                          <div className="hm-tip-row"><span>佔月支出</span><strong>{m.expense > 0 ? ((v / m.expense) * 100).toFixed(1) : "0"}%</strong></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div key={`et-${cat}`} className="hm-total">{compactMoney(rowTotal)}</div>
            </>
          );
        })}

        {/* Footer: totals */}
        <div className="hm-foot-label">月總支出</div>
        <div className="hm-row" style={{ gridTemplateColumns: monthCols }}>
          {months.map((_, mi) => (
            <div key={mi} className="hm-foot-cell" style={{ color: "var(--neg)" }}>{compactMoney(colTotalsExp[mi]!)}</div>
          ))}
        </div>
        <div className="hm-foot-total" style={{ color: "var(--neg)" }}>{compactMoney(colTotalsExp.reduce((a, b) => a + b, 0))}</div>

        <div className="hm-foot-label">月結餘</div>
        <div className="hm-row" style={{ gridTemplateColumns: monthCols }}>
          {months.map((_, mi) => (
            <div key={mi} className={`hm-foot-cell surplus${colSurplus[mi]! >= 0 ? " pos" : " neg"}`}>
              {compactMoney(colSurplus[mi]!)}
            </div>
          ))}
        </div>
        <div className="hm-foot-total" style={{ color: "var(--pos)" }}>{compactMoney(colSurplus.reduce((a, b) => a + b, 0))}</div>
      </div>
    </div>
  );
}

// ---- P&L table ----
function IncomeStatement({ months, activeIdx, onPick }: {
  months: StatementMonth[];
  activeIdx: number;
  onPick: (i: number) => void;
}) {
  type Row = { kind: "year"; year: number } | { kind: "m"; m: StatementMonth; i: number };
  const rows: Row[] = [];
  let lastYear: number | null = null;
  months.forEach((m, i) => {
    if (m.year !== lastYear) { rows.push({ kind: "year", year: m.year }); lastYear = m.year; }
    rows.push({ kind: "m", m, i });
  });
  const totalI = months.reduce((a, m) => a + m.income, 0);
  const totalE = months.reduce((a, m) => a + m.expense, 0);
  const totalS = totalI - totalE;

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="card-head" style={{ padding: "20px 22px 12px", marginBottom: 0 }}>
        <div>
          <div className="card-title">損益表</div>
          <div className="card-sub muted">每月收入、支出、結餘與儲蓄率</div>
        </div>
      </div>
      <div className="table-wrap" style={{ margin: 0, maxHeight: 480, overflowY: "auto" }}>
        <table className="pnl-table">
          <thead>
            <tr>
              <th>月份</th>
              <th className="num">收入</th>
              <th className="num">支出</th>
              <th className="num">結餘</th>
              <th className="num">儲蓄率</th>
              <th>備註</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              if (r.kind === "year") {
                const yMonths = months.filter((m) => m.year === r.year);
                const yI = yMonths.reduce((a, m) => a + m.income, 0);
                const yE = yMonths.reduce((a, m) => a + m.expense, 0);
                return (
                  <tr key={`y-${r.year}-${idx}`} className="year-sep">
                    <td>{r.year} 年</td>
                    <td className="num">{money(yI)}</td>
                    <td className="num">{money(yE)}</td>
                    <td className={`num ${(yI - yE) >= 0 ? "pos" : "neg"}`}>{money(yI - yE)}</td>
                    <td className="num">{((yI - yE) / Math.max(yI, 1) * 100).toFixed(1)}%</td>
                    <td>{yMonths.length} 個月</td>
                  </tr>
                );
              }
              const { m, i } = r;
              const isCurrent = i === activeIdx;
              const rate = m.savingsRate ?? 0;
              return (
                <tr key={`m-${m.year}-${m.month}`} className={isCurrent ? "current" : ""} onClick={() => onPick(i)} style={{ cursor: "pointer" }}>
                  <td>
                    <div className="mo-cell">
                      <strong>{monthLabel(m.year, m.month)}</strong>
                      <span className="muted">{monthChinese(m.month)}</span>
                      {isCurrent && <span className="now-pill">查看中</span>}
                    </div>
                  </td>
                  <td className="num">{money(m.income)}</td>
                  <td className="num">{money(m.expense)}</td>
                  <td className={`num ${m.surplus >= 0 ? "pos" : "neg"}`}>{fmtSigned(m.surplus)}</td>
                  <td className="num">
                    <span className={`savings-bar${rate < 0 ? " neg" : ""}`}>
                      <i style={{ width: `${Math.min(100, Math.abs(rate))}%` }}></i>
                    </span>
                    <span className="muted">{rate.toFixed(1)}%</span>
                  </td>
                  <td className="muted" style={{ fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.note?.trim() || "—"}
                  </td>
                </tr>
              );
            })}
            <tr className="totals">
              <td>期間合計</td>
              <td className="num">{money(totalI)}</td>
              <td className="num">{money(totalE)}</td>
              <td className={`num ${totalS >= 0 ? "pos" : "neg"}`}>{money(totalS)}</td>
              <td className="num">{(totalS / Math.max(totalI, 1) * 100).toFixed(1)}%</td>
              <td className="muted">{months.length} 個月</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Balance sheet ----
function BalanceSheet({ data }: { data: StatementBundle }) {
  const cumulativeCash = Math.max(0, data.cumulativeCash);
  const assets = [
    { label: "現金與活存", amount: cumulativeCash, sub: "累積結餘 + 流動現金", colorClass: "bs-bar-cash" },
    { label: "投資本金", amount: data.investmentAssets, sub: "證券 + 基金 (持有成本)", colorClass: "bs-bar-invest" },
    { label: "目標存款", amount: data.goalAssets, sub: `${data.goals.length} 個目標已配置`, colorClass: "bs-bar-goal" },
  ];
  const liab = [
    { label: "負債", amount: data.trackedLiabilities, sub: "尚未建模", colorClass: "bs-bar-credit", muted: data.trackedLiabilities === 0 },
  ];
  const totalA = data.trackedAssets;
  const totalL = data.trackedLiabilities;
  const nw = data.netWorth;

  // NW trajectory: back-project from current net worth
  const allMonths = data.months;
  const nwHist = allMonths.map((_, i) => {
    const surplusAhead = allMonths.slice(i + 1).reduce((a, m) => a + m.surplus, 0);
    return nw - surplusAhead;
  });

  const svgW = 140, svgH = 40;
  const minN = Math.min(...nwHist, nw);
  const maxN = Math.max(...nwHist, nw);
  const norm = (v: number) => svgH - 2 - ((v - minN) / Math.max(1, maxN - minN)) * (svgH - 6);
  const pathSp = nwHist.length > 1
    ? nwHist.map((v, i) => `${i === 0 ? "M" : "L"} ${(i / (nwHist.length - 1)) * svgW} ${norm(v)}`).join(" ")
    : `M 0 ${svgH / 2} L ${svgW} ${svgH / 2}`;
  const nwChange = nwHist.length > 1 ? (nwHist[nwHist.length - 1]! - nwHist[0]!) : 0;

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">資產負債表</div>
          <div className="card-sub muted">代理淨值 · 含累積現金、目標存款、投資本金與負債</div>
        </div>
      </div>

      <div className="bs-networth">
        <div>
          <div className="bs-nw-label">淨值 Net Worth</div>
          <div className="bs-nw-val">{money(nw)}</div>
        </div>
        <div className="bs-nw-stat">
          <div className="l">期間變動</div>
          <div className={`v${nwChange >= 0 ? " pos" : " neg"}`}>
            {nwChange >= 0 ? "+" : ""}{compactMoney(nwChange)}
          </div>
        </div>
        <svg className="bs-nw-spark" viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="bs-spgrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4"/>
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path d={`${pathSp} L ${svgW} ${svgH} L 0 ${svgH} Z`} fill="url(#bs-spgrad)"/>
          <path d={pathSp} fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round"/>
        </svg>
      </div>

      <div className="bs-composition">
        {assets.map((a, i) => (
          <div key={i} className={a.colorClass} style={{ width: `${(a.amount / Math.max(totalA, 1)) * 100}%` }} title={`${a.label} · ${money(a.amount)}`}></div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginBottom: 16, fontFamily: "JetBrains Mono, monospace" }}>
        <span>$0</span>
        <span>總資產 {money(totalA)}</span>
      </div>

      <div className="bs-grid">
        <div className="bs-side">
          <div className="bs-head">
            <h3>資產</h3>
            <span className="bs-total">{money(totalA)}</span>
          </div>
          <div className="bs-rows">
            {assets.map((a, i) => (
              <div key={i} className="bs-row">
                <span className={`swatch ${a.colorClass}`}></span>
                <div>
                  <div className="label">{a.label}</div>
                  <div className="sub">{a.sub}</div>
                </div>
                <div className="col-amt">
                  <div className="amt">{money(a.amount)}</div>
                  <div className="amt-sub">{((a.amount / Math.max(totalA, 1)) * 100).toFixed(1)}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bs-side">
          <div className="bs-head">
            <h3>負債</h3>
            <span className="bs-total neg">{money(totalL)}</span>
          </div>
          <div className="bs-rows">
            {liab.map((l, i) => (
              <div key={i} className="bs-row">
                <span className={`swatch ${l.colorClass}`} style={l.muted ? { opacity: 0.4 } : {}}></span>
                <div>
                  <div className="label" style={l.muted ? { color: "var(--muted)" } : {}}>{l.label}</div>
                  <div className="sub">{l.sub}</div>
                </div>
                <div className="col-amt">
                  <div className="amt" style={l.muted ? { color: "var(--muted)" } : {}}>{money(l.amount)}</div>
                  <div className="amt-sub">{totalL > 0 ? ((l.amount / totalL) * 100).toFixed(1) + "%" : "—"}</div>
                </div>
              </div>
            ))}
            <div className="bs-row" style={{ paddingTop: 14, marginTop: 4, borderTop: "1px solid var(--border)", borderBottom: 0 }}>
              <span></span>
              <div>
                <div className="label" style={{ fontWeight: 700 }}>淨值</div>
                <div className="sub">資產 − 負債</div>
              </div>
              <div className="col-amt">
                <div className={`amt${nw >= 0 ? " pos" : " neg"}`} style={{ fontSize: 16 }}>{money(nw)}</div>
                <div className="amt-sub">負債比 {((totalL / Math.max(totalA, 1)) * 100).toFixed(1)}%</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Category deep-dive ----
function CategoryDeepDive({ months }: { months: StatementMonth[] }) {
  const totals: Record<string, number> = {};
  months.forEach((m) => m.expenseLines.forEach((l) => { totals[l.name] = (totals[l.name] ?? 0) + l.amount; }));
  const top = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

  if (!top.length) return null;

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">支出深度分析</div>
          <div className="card-sub muted">前 {top.length} 大類別 · 每月走勢與本期變化</div>
        </div>
      </div>
      <div className="cd-grid">
        {top.map(([name, sum], idx) => {
          const series = months.map((m) => m.expenseLines.find((x) => x.name === name)?.amount ?? 0);
          const last = series[series.length - 1] ?? 0;
          const prev = series.length > 1 ? (series[series.length - 2] ?? 0) : 0;
          const trend = prev > 0 ? ((last - prev) / prev) * 100 : 0;
          const avg = months.length > 0 ? sum / months.length : 0;
          const isUncat = name === "未分類";
          const color = isUncat ? "var(--warn)" : `oklch(0.78 0.13 ${155 + idx * 18})`;

          const sw = 240, sh = 36;
          const maxV = Math.max(...series, 1);
          const pts = series.map((v, i) => ({
            x: series.length > 1 ? (i / (series.length - 1)) * sw : sw / 2,
            y: sh - 2 - (v / maxV) * (sh - 6),
          }));
          const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
          const area = pts.length > 1 ? `${path} L ${pts[pts.length - 1]!.x} ${sh} L 0 ${sh} Z` : "";
          const lastPt = pts[pts.length - 1];

          return (
            <div key={name} className="cd-card">
              <div className="cd-head">
                <div className="cd-name">
                  <span className="swatch" style={{ background: color }}></span>
                  <span>{name}</span>
                  {isUncat && <span className="cat-flag">未指派</span>}
                </div>
                <div className={`cd-trend${trend < 0 ? " pos" : trend > 0 ? " neg" : ""}`}>
                  <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d={trend >= 0 ? "m6 14 6-6 6 6" : "m6 10 6 6 6-6"}/>
                  </svg>
                  {trend >= 0 ? "+" : ""}{trend.toFixed(1)}%
                </div>
              </div>
              <div className="cd-amount">
                <span className="v">{money(last)}</span>
                <span className="pct">本月 · 期間 {compactMoney(sum)}</span>
              </div>
              <svg className="cd-spark" viewBox={`0 0 ${sw} ${sh}`} preserveAspectRatio="none">
                <defs>
                  <linearGradient id={`cdg-${idx}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.35"/>
                    <stop offset="100%" stopColor={color} stopOpacity="0"/>
                  </linearGradient>
                </defs>
                {area && <path d={area} fill={`url(#cdg-${idx})`}/>}
                <path d={path} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round"/>
                {lastPt && <circle cx={lastPt.x} cy={lastPt.y} r="2.4" fill={color} stroke="var(--bg-elev)" strokeWidth="1.4"/>}
              </svg>
              <div className="cd-meta">
                <span>月均 <strong>{money(avg)}</strong></span>
                <span>佔支出 <strong>{((sum / Math.max(grandTotal, 1)) * 100).toFixed(1)}%</strong></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Main component ----
export function StatementsView({ data }: { data: StatementBundle }) {
  const [period, setPeriod] = useState<Period>("12M");
  const [activeIdx, setActiveIdx] = useState(Math.max(0, data.months.length - 1));

  const months = useMemo(() => {
    if (period === "2026") return data.months.filter((m) => m.year === 2026);
    if (period === "2025") return data.months.filter((m) => m.year === 2025);
    return data.months.slice(-12);
  }, [period, data.months]);

  useEffect(() => {
    if (months.length > 0 && activeIdx >= months.length) {
      setActiveIdx(months.length - 1);
    }
  }, [months.length, activeIdx]);

  const clampedIdx = Math.min(activeIdx, Math.max(0, months.length - 1));

  if (!data.latest) {
    return (
      <>
        <header className="topbar">
          <div>
            <div className="crumb">財務報表 · Financial Reports</div>
            <h1 className="page-title">尚無可用報表</h1>
          </div>
        </header>
        <div className="empty-state">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19V5M4 19h16M8 15v-4M12 15V8M16 15v-6"/>
            </svg>
          </div>
          <h2>尚無資料</h2>
          <p className="muted">先建立月份資料後，財務報表才會出現。</p>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">財務報表 · Financial Reports</div>
          <h1 className="page-title">
            一眼看懂錢去哪了
            <span className="page-title-sub"> · 現金流、損益、淨值與分類分析</span>
          </h1>
        </div>
        <div className="topbar-actions">
          <PeriodSwitcher period={period} onPeriod={setPeriod}/>
        </div>
      </header>

      <ReportsKPIs months={months} netWorth={data.netWorth} totalAssets={data.trackedAssets} totalLiab={data.trackedLiabilities}/>

      <div className="sec-head">
        <div>
          <h2>現金流</h2>
          <p>每月進帳與花費，疊上累積現金線。</p>
        </div>
      </div>
      <CashflowChart months={months} activeIdx={clampedIdx} onPick={setActiveIdx}/>

      <div className="sec-head">
        <div>
          <h2>分類 × 月份</h2>
          <p>每一筆錢的去向 —— 列是類別、欄是月份。深色 = 花得多。</p>
        </div>
      </div>
      <CategoryHeatmap months={months} activeIdx={clampedIdx}/>

      <div className="sec-head">
        <div>
          <h2>損益表</h2>
          <p>逐月收入、支出、結餘與儲蓄率。</p>
        </div>
      </div>
      <IncomeStatement months={months} activeIdx={clampedIdx} onPick={setActiveIdx}/>

      <div className="sec-head">
        <div>
          <h2>資產負債表</h2>
          <p>現有資產組成、負債與淨值代理。</p>
        </div>
      </div>
      <BalanceSheet data={data}/>

      <div className="sec-head">
        <div>
          <h2>支出深度分析</h2>
          <p>前 8 大支出類別、每月走勢與本期變化。</p>
        </div>
      </div>
      <CategoryDeepDive months={months}/>

      <footer className="page-foot muted">
        家庭理財 · 共享帳本 · 財務報表
      </footer>
    </>
  );
}
