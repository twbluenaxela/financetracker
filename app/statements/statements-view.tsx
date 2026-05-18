import Link from "next/link";

import type { StatementBundle } from "@/lib/statements";
import { compactMoney, monthChinese, monthLabel, money } from "@/lib/statements";

function chartLabel(year: number, month: number) {
  return month === 1 ? `${String(year).slice(2)}'1月` : `${month}月`;
}

function linePath(points: Array<{ x: number; y: number }>) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function ratio(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0;
}

export function StatementsView({ data }: { data: StatementBundle }) {
  const latest = data.latest;
  const months = data.months;
  const chartMax = Math.max(...months.flatMap((month) => [month.income, month.expense]), 1);
  const cashMax = Math.max(...months.map((month) => month.cumulativeSurplus), 1);
  const cashPoints = months.map((month, index) => {
    const slotW = 100 / Math.max(1, months.length);
    return {
      x: slotW * index + slotW / 2,
      y: 98 - (month.cumulativeSurplus / cashMax) * 80,
    };
  });
  const cashPath = cashPoints.length > 0 ? linePath(cashPoints) : "";
  const totalAssets = data.trackedAssets;
  const liabilityPct = ratio(data.trackedLiabilities, Math.max(totalAssets, 1));

  if (!latest) {
    return (
      <>
        <header className="topbar">
          <div>
            <div className="crumb">三大報表 · Statements</div>
            <h1 className="page-title">尚無可用報表</h1>
          </div>
          <div className="topbar-actions">
            <Link className="btn btn-ghost" href="/months/new">
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
          <p className="muted">先建立月份資料後，現金流、損益表與資產負債表才會出現。</p>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">三大報表 · Statements</div>
          <h1 className="page-title">
            現金流、損益表、資產負債表
            <span className="page-title-sub"> · {monthLabel(latest.year, latest.month)} 結算</span>
          </h1>
        </div>
        <div className="topbar-actions">
          <Link className="btn btn-ghost" href="/months/new">
            新增月份
          </Link>
          <Link className="btn btn-primary" href="/months">
            管理月份
          </Link>
        </div>
      </header>

      <section className="statement-note card">
        <div className="statement-note-main">
          <div className="statement-note-title">報表口徑</div>
          <p className="muted">
            這一版以已記錄的月份資料為基礎。現金流與損益表是直接來自收入 / 支出總額；
            資產負債表則先以已追蹤的現金盈餘、目標存款與投資本金做代理，負債尚未建模。
          </p>
        </div>
        <div className="statement-note-aside">
          <div className="statement-note-value">{months.length}</div>
          <div className="muted">個月份已納入</div>
        </div>
      </section>

      <section className="statement-kpis">
        <div className="card statement-kpi">
          <div className="kpi-label">年度收入</div>
          <div className="kpi-value">{money(data.totalIncome)}</div>
          <div className="muted">12 個月累計</div>
        </div>
        <div className="card statement-kpi">
          <div className="kpi-label">年度支出</div>
          <div className="kpi-value neg">{money(data.totalExpense)}</div>
          <div className="muted">12 個月累計</div>
        </div>
        <div className="card statement-kpi">
          <div className="kpi-label">年度結餘</div>
          <div className={`kpi-value ${data.totalSurplus >= 0 ? "pos" : "neg"}`}>{money(data.totalSurplus)}</div>
          <div className="muted">收入減支出</div>
        </div>
        <div className="card statement-kpi">
          <div className="kpi-label">淨值代理</div>
          <div className="kpi-value">{money(data.netWorth)}</div>
          <div className="muted">含目標存款與投資本金</div>
        </div>
      </section>

      <div className="grid-2 statement-grid">
        <div className="card statement-chart-card">
          <div className="card-head">
            <div>
              <div className="card-title">現金流現況</div>
              <div className="card-sub muted">收入、支出與累積現金走勢</div>
            </div>
          </div>

          <div className="chart-wrap statement-chart-wrap">
            <div className="chart-axis">
              <span>{compactMoney(chartMax)}</span>
              <span>{compactMoney(chartMax / 2)}</span>
              <span>0</span>
              <span>{compactMoney(chartMax / 2)}</span>
              <span>{compactMoney(chartMax)}</span>
            </div>
            <div className="chart-area">
              <svg viewBox="0 0 100 220" preserveAspectRatio="none" className="chart-svg">
                <line className="chart-grid" x1="0" x2="100" y1="55" y2="55" />
                <line className="chart-mid" x1="0" x2="100" y1="110" y2="110" />
                <line className="chart-grid" x1="0" x2="100" y1="165" y2="165" />
                {months.map((month, index) => {
                  const slotW = 100 / months.length;
                  const barW = slotW * 0.32;
                  const cx = slotW * index + slotW / 2;
                  const incomeH = (month.income / chartMax) * 104;
                  const expenseH = (month.expense / chartMax) * 104;
                  const active = month.id === latest.id;
                  return (
                    <g key={month.id} className={`bar-group ${active ? "active" : ""}`}>
                      <rect className="bar-income-rect" x={cx - barW} y={110 - incomeH} width={barW} height={incomeH} rx="1.2" />
                      <rect className="bar-expense-rect" x={cx} y={110} width={barW} height={expenseH} rx="1.2" />
                      {active ? <circle className="active-marker" cx={cx} cy={110} r="1.6" /> : null}
                    </g>
                  );
                })}
                {cashPath ? <path d={cashPath} className="statement-cash-path" /> : null}
              </svg>
              <div className="chart-labels">
                {months.map((month, index) => (
                  <span
                    key={month.id}
                    className={`chart-lbl ${month.id === latest.id ? "active" : ""}`}
                    style={{ width: `${100 / months.length}%` }}
                  >
                    {chartLabel(month.year, month.month)}
                  </span>
                ))}
              </div>
              <div className="statement-legend">
                <span><span className="bar bar-income"></span>收入</span>
                <span><span className="bar bar-expense"></span>支出</span>
                <span><span className="statement-legend-line"></span>累積現金</span>
              </div>
            </div>
          </div>

          <div className="statement-summary">
            <div className="summary-chip">
              <span className="muted">最新月份</span>
              <strong>{monthLabel(latest.year, latest.month)}</strong>
            </div>
            <div className="summary-chip">
              <span className="muted">儲蓄率</span>
              <strong>{latest.savingsRate != null ? `${latest.savingsRate.toFixed(1)}%` : "—"}</strong>
            </div>
            <div className="summary-chip">
              <span className="muted">累積現金</span>
              <strong>{money(data.cumulativeCash)}</strong>
            </div>
          </div>
        </div>

        <div className="card statement-side-card">
          <div className="card-head">
            <div>
              <div className="card-title">最新月份拆解</div>
              <div className="card-sub muted">收入 / 支出分類加總</div>
            </div>
          </div>

          <div className="statement-mini-grid">
            <div className="statement-mini">
              <div className="statement-mini-label">收入</div>
              <div className="statement-mini-value pos">{money(latest.income)}</div>
              <div className="statement-lines">
                {latest.incomeLines.slice(0, 4).map((line) => (
                  <div key={`${line.name}-${line.amount}`} className="statement-line">
                    <span>{line.name}</span>
                    <strong>{money(line.amount)}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="statement-mini">
              <div className="statement-mini-label">支出</div>
              <div className="statement-mini-value neg">{money(latest.expense)}</div>
              <div className="statement-lines">
                {latest.expenseLines.slice(0, 4).map((line) => (
                  <div key={`${line.name}-${line.amount}`} className="statement-line">
                    <span>{line.name}</span>
                    <strong>{money(line.amount)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="statement-notes">
            <div className="statement-note-row">
              <span className="muted">備註</span>
              <strong>{latest.note?.trim() ? latest.note : "無"}</strong>
            </div>
            <div className="statement-note-row">
              <span className="muted">累積結餘</span>
              <strong className={latest.cumulativeSurplus >= 0 ? "pos" : "neg"}>{money(latest.cumulativeSurplus)}</strong>
            </div>
            <div className="statement-note-row">
              <span className="muted">目標存款</span>
              <strong>{money(data.goalAssets)}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2 statement-grid">
        <div className="card statement-table-card">
          <div className="card-head">
            <div>
              <div className="card-title">損益表</div>
              <div className="card-sub muted">每月收入、支出與利潤率</div>
            </div>
          </div>
          <div className="table-wrap statement-table-wrap">
            <table className="recent-table statement-table">
              <thead>
                <tr>
                  <th>月份</th>
                  <th className="num">收入</th>
                  <th className="num">支出</th>
                  <th className="num">結餘</th>
                  <th className="num">儲蓄率</th>
                </tr>
              </thead>
              <tbody>
                {months.map((month) => (
                  <tr key={month.id} className={month.id === latest.id ? "current" : ""}>
                    <td>
                      <div className="mo-cell">
                        <strong>{monthLabel(month.year, month.month)}</strong>
                        <span className="muted">{monthChinese(month.month)}</span>
                      </div>
                    </td>
                    <td className="num">{money(month.income)}</td>
                    <td className="num">{money(month.expense)}</td>
                    <td className={`num ${month.surplus >= 0 ? "pos" : "neg"}`}>{money(month.surplus)}</td>
                    <td className="num muted">{month.savingsRate != null ? `${month.savingsRate.toFixed(1)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card balance-card">
          <div className="card-head">
            <div>
              <div className="card-title">資產負債表</div>
              <div className="card-sub muted">目前先以已追蹤資產做代理</div>
            </div>
          </div>

          <div className="balance-total">
            <div>
              <div className="muted">淨值</div>
              <div className="balance-value">{money(data.netWorth)}</div>
            </div>
            <div className="balance-pill">
              {data.trackedLiabilities === 0 ? "暫無負債資料" : `${liabilityPct.toFixed(1)}% 負債比`}
            </div>
          </div>

          <div className="balance-stack">
            <div className="balance-row">
              <span>現金盈餘</span>
              <strong>{money(Math.max(0, data.cumulativeCash))}</strong>
            </div>
            <div className="balance-row">
              <span>目標存款資產</span>
              <strong>{money(data.goalAssets)}</strong>
            </div>
            <div className="balance-row">
              <span>投資本金</span>
              <strong>{money(data.investmentAssets)}</strong>
            </div>
            <div className="balance-row total">
              <span>總資產</span>
              <strong>{money(totalAssets)}</strong>
            </div>
            <div className="balance-row">
              <span>負債</span>
              <strong className="muted">{money(data.trackedLiabilities)}</strong>
            </div>
            <div className="balance-row total">
              <span>淨值</span>
              <strong className={data.netWorth >= 0 ? "pos" : "neg"}>{money(data.netWorth)}</strong>
            </div>
          </div>

          <div className="balance-breakdown">
            <div className="balance-bar">
              <div className="balance-segment balance-cash" style={{ width: `${ratio(Math.max(0, data.cumulativeCash), Math.max(totalAssets, 1))}%` }} />
              <div className="balance-segment balance-goal" style={{ width: `${ratio(data.goalAssets, Math.max(totalAssets, 1))}%` }} />
              <div className="balance-segment balance-invest" style={{ width: `${ratio(data.investmentAssets, Math.max(totalAssets, 1))}%` }} />
            </div>
            <div className="balance-legend">
              <span><i className="swatch cash" />現金</span>
              <span><i className="swatch goal" />目標資產</span>
              <span><i className="swatch invest" />投資本金</span>
            </div>
          </div>

          <p className="statement-foot muted">
            負債尚未建模，所以這裡是「追蹤中的淨值代理」。要做成真正的資產負債表，下一步應加入房貸、信貸與銀行帳戶餘額資料。
          </p>
        </div>
      </div>

      <footer className="page-foot muted">家庭理財 · Next.js frontend</footer>
    </>
  );
}
