import Link from "next/link";
import type { CSSProperties } from "react";

import { getDashboardData } from "@/lib/dashboard";

const monthChinese = (m: number) =>
  ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"][m - 1] + "月";

const chartLabel = (year: number, month: number) => (month === 1 ? `${String(year).slice(2)}'1月` : `${month}月`);

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const moneyPlain = (n: number) => Math.round(n).toLocaleString("en-US");
const compact = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (a >= 10_000) return "$" + (n / 1000).toFixed(0) + "K";
  if (a >= 1_000) return "$" + (n / 1000).toFixed(1) + "K";
  return "$" + n.toFixed(0);
};

export default async function DashboardPage() {
  const data = await getDashboardData();
  const months = data.months;
  const current = data.current;
  const previous = data.previous;

  if (!current) {
    return (
      <>
        <header className="topbar">
          <div>
            <div className="crumb">總覽 · Overview</div>
            <h1 className="page-title">家庭理財</h1>
          </div>
          <div className="topbar-actions">
            <Link className="btn btn-primary" href="/months/new">
              新增月份
            </Link>
          </div>
        </header>

        <div className="empty-state">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 5h16v14H4zM4 9h16M8 5v14" />
            </svg>
          </div>
          <h2>尚無資料</h2>
          <p className="muted">先新增第一個月份，總覽頁才有現金流與目標狀態可展示。</p>
        </div>
      </>
    );
  }

  const surplus = Number(current.totalIncome) - Number(current.totalExpense);
  const prevSurplus = previous ? Number(previous.totalIncome) - Number(previous.totalExpense) : 0;
  const surplusDelta = surplus - prevSurplus;
  const savingsRate = Number(current.totalIncome) ? (surplus / Number(current.totalIncome)) * 100 : null;
  const incomeDelta = previous ? ((Number(current.totalIncome) - Number(previous.totalIncome)) / Number(previous.totalIncome)) * 100 : null;
  const expenseDelta = previous ? ((Number(current.totalExpense) - Number(previous.totalExpense)) / Number(previous.totalExpense)) * 100 : null;
  const chartMax = Math.max(...months.flatMap((m) => [Number(m.totalIncome), Number(m.totalExpense)]), 1);

  const expenseLines = current.lines.filter((line) => line.kind === "expense");
  const expenseTotalFromLines = expenseLines.reduce((sum, line) => sum + Number(line.amount), 0);
  const expenseRows = expenseLines
    .map((line) => ({ name: line.name, amount: Number(line.amount) }))
    .sort((a, b) => b.amount - a.amount);
  const expenseRemainder = Number(current.totalExpense) - expenseTotalFromLines;
  if (expenseRemainder > 0) {
    expenseRows.push({ name: "未分類", amount: expenseRemainder });
  }

  const recent = [...months].reverse();

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">總覽 · Overview</div>
          <h1 className="page-title">
            {current.year} 年 {monthChinese(current.month)}
          </h1>
        </div>
          <div className="topbar-actions">
            <div className="search">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input placeholder="搜尋分類、月份、備註…" readOnly />
              <kbd>⌘K</kbd>
            </div>
          <Link className="btn btn-primary" href="/months/new">
            新增月份
          </Link>
          </div>
        </header>

      <section className="hero">
        <div className="hero-main">
          <div className="hero-label"><span className="dot dot-accent"></span>本月結餘</div>
          <div className={`hero-figure ${surplus >= 0 ? "pos" : "neg"}`}>
            <span className="currency">NT$</span>
            <span className="amount">{moneyPlain(surplus)}</span>
          </div>
          <div className="hero-meta">
            <div className={`chip ${surplusDelta >= 0 ? "chip-pos" : "chip-neg"}`}>
              {surplusDelta >= 0 ? "+" : ""}
              {money(surplusDelta)} 較上月
            </div>
            <div className="chip chip-muted">儲蓄率 <strong>{savingsRate != null ? `${savingsRate.toFixed(1)}%` : "—"}</strong></div>
            <div className="chip chip-muted">日均支出 <strong>{money(Number(current.totalExpense) / 30)}</strong></div>
          </div>
        </div>
        <div className="hero-side">
          <div className="hero-stat">
            <div className="stat-row">
              <span className="stat-label"><span className="bar bar-income"></span>收入</span>
              {incomeDelta != null ? <span className={`stat-delta ${incomeDelta >= 0 ? "pos" : "neg"}`}>{incomeDelta >= 0 ? "+" : ""}{incomeDelta.toFixed(1)}%</span> : null}
            </div>
            <div className="stat-amount">{money(Number(current.totalIncome))}</div>
            <div className="stat-foot muted">含薪資、利息、其他 共 {current.lines.filter((line) => line.kind === "income").length} 項</div>
          </div>
          <div className="hero-stat">
            <div className="stat-row">
              <span className="stat-label"><span className="bar bar-expense"></span>支出</span>
              {expenseDelta != null ? <span className={`stat-delta ${expenseDelta <= 0 ? "pos" : "neg"}`}>{expenseDelta >= 0 ? "+" : ""}{expenseDelta.toFixed(1)}%</span> : null}
            </div>
            <div className="stat-amount">{money(Number(current.totalExpense))}</div>
            <div className="stat-foot muted">{expenseRows.length} 個分類</div>
          </div>
        </div>
      </section>

      <div className="grid-2">
        <div className="card chart-card">
          <div className="card-head">
            <div>
              <div className="card-title">12 個月現金流</div>
              <div className="card-sub muted">收入 <span className="bar bar-income"></span> 與支出 <span className="bar bar-expense"></span></div>
            </div>
          </div>
          <div className="chart-wrap">
            <div className="chart-axis">
              <span>{compact(chartMax)}</span>
              <span>{compact(chartMax / 2)}</span>
              <span>0</span>
              <span>{compact(chartMax / 2)}</span>
              <span>{compact(chartMax)}</span>
            </div>
            <div className="chart-area">
              <svg viewBox="0 0 100 220" preserveAspectRatio="none" className="chart-svg">
                <line className="chart-grid" x1="0" x2="100" y1="55" y2="55" />
                <line className="chart-mid" x1="0" x2="100" y1="110" y2="110" />
                <line className="chart-grid" x1="0" x2="100" y1="165" y2="165" />
                {months.map((month, i) => {
                  const slotW = 100 / months.length;
                  const barW = slotW * 0.32;
                  const cx = slotW * i + slotW / 2;
                  const incomeH = (Number(month.totalIncome) / chartMax) * 104;
                  const expenseH = (Number(month.totalExpense) / chartMax) * 104;
                  const active = i === months.length - 1;
                  return (
                    <g key={`${month.year}-${month.month}`} className={`bar-group ${active ? "active" : ""}`}>
                      <rect className="bar-income-rect" x={cx - barW} y={110 - incomeH} width={barW} height={incomeH} rx="1.2" />
                      <rect className="bar-expense-rect" x={cx} y={110} width={barW} height={expenseH} rx="1.2" />
                      {active ? <circle className="active-marker" cx={cx} cy={110} r="1.6" /> : null}
                    </g>
                  );
                })}
              </svg>
              <div className="chart-labels">
                {months.map((month, i) => (
                  <span
                    key={`${month.year}-${month.month}`}
                    className={`chart-lbl ${i === months.length - 1 ? "active" : ""}`}
                    style={{ width: `${100 / months.length}%` }}
                  >
                    {chartLabel(month.year, month.month)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="card cat-card">
          <div className="card-head">
            <div>
              <div className="card-title">支出分類</div>
              <div className="card-sub muted">本月支出結構</div>
            </div>
          </div>
          <div className="cat-list">
            {expenseRows.slice(0, 7).map((row, index) => {
              const pct = Number(current.totalExpense) ? (row.amount / Number(current.totalExpense)) * 100 : 0;
              return (
                <div key={row.name} className={`cat-row ${row.name === "未分類" ? "is-uncat" : ""}`}>
                  <div className="cat-row-top">
                    <div className="cat-name">
                      <span className="cat-swatch" style={{ ["--i" as string]: index } as CSSProperties}></span>
                      {row.name}
                      {row.name === "未分類" ? <span className="cat-flag">未指派</span> : null}
                    </div>
                    <div className="cat-amt">
                      <span className="amt num">{money(row.amount)}</span>
                      <span className="pct muted">{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="cat-track">
                    <div className="cat-fill" style={{ width: `${pct}%`, ["--i" as string]: index } as CSSProperties}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card goals-card">
        <div className="card-head">
          <div>
            <div className="card-title">理財目標</div>
            <div className="card-sub muted">以 PMT 與複利推算每月投入需求</div>
          </div>
        </div>
        <div className="goals-grid">
          {data.goals.slice(0, 3).map((goal) => {
            const pct = goal.targetAmount ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
            return (
              <div key={goal.id} className="goal">
                <div className="goal-head">
                  <span className="goal-tier" data-tier={goal.tier}>{goal.tier}</span>
                  <span className="goal-eta muted">{goal.monthsRemaining} 個月</span>
                </div>
                <div className="goal-label">{goal.label}</div>
                <div className="goal-fig">
                  <span className="goal-current">{compact(goal.currentAmount)}</span>
                  <span className="goal-of muted">/ {compact(goal.targetAmount)}</span>
                </div>
                <div className="goal-track">
                  <div className="goal-fill" style={{ width: `${Math.min(100, pct)}%` }}></div>
                  <div className="goal-tick" style={{ left: `${Math.min(100, pct)}%` }}></div>
                </div>
                <div className="goal-foot">
                  <span className="muted">PMT 每月需投入</span>
                  <strong>{money(goal.requiredMonthly)}</strong>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card recent-card">
        <div className="card-head">
          <div>
            <div className="card-title">近期月份</div>
            <div className="card-sub muted">最近 {recent.length} 個月</div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="recent-table">
            <thead>
              <tr>
                <th>月份</th>
                <th className="num">收入</th>
                <th className="num">支出</th>
                <th className="num">結餘</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((month, index) => {
                const rowSurplus = Number(month.totalIncome) - Number(month.totalExpense);
                return (
                  <tr key={month.id} className={index === 0 ? "current" : ""}>
                    <td>
                      <div className="mo-cell">
                        <strong>{month.year}-{String(month.month).padStart(2, "0")}</strong>
                        <span className="muted">{monthChinese(month.month)}</span>
                        {index === 0 ? <span className="now-pill">目前</span> : null}
                      </div>
                    </td>
                    <td className="num">{money(Number(month.totalIncome))}</td>
                    <td className="num">{money(Number(month.totalExpense))}</td>
                    <td className={`num ${rowSurplus >= 0 ? "pos" : "neg"}`}>{money(rowSurplus)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <footer className="page-foot muted">家庭理財 · Next.js frontend</footer>
    </>
  );
}
