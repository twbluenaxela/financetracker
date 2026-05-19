"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type MonthLine = {
  id: number;
  kind: "income" | "expense";
  name: string;
  amount: number;
};

type MonthRecord = {
  id: number;
  year: number;
  month: number;
  income: number;
  expense: number;
  note: string;
  lines: MonthLine[];
};

const monthChinese = (m: number) =>
  ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"][m - 1] + "月";

const monthLabel = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

const fmtCompact = (n: number) => {
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1_000_000) return sign + "$" + (a / 1_000_000).toFixed(2) + "M";
  if (a >= 10_000) return sign + "$" + (a / 1000).toFixed(0) + "K";
  if (a >= 1_000) return sign + "$" + (a / 1000).toFixed(1) + "K";
  return sign + "$" + a.toFixed(0);
};

function YearPicker({
  year,
  minYear,
  maxYear,
  countByYear,
  onPick,
}: {
  year: number;
  minYear: number;
  maxYear: number;
  countByYear: Record<number, number>;
  onPick: (year: number) => void;
}) {
  return (
    <div className="year-picker">
      <button
        type="button"
        className="year-nav-btn"
        onClick={() => onPick(year - 1)}
        disabled={year <= minYear}
        aria-label="Previous year"
      >
        ‹
      </button>
      <span className="year-nav-label">
        {year}
        <span className="year-pill-sub">{countByYear[year] ?? 0}/12</span>
      </span>
      <button
        type="button"
        className="year-nav-btn"
        onClick={() => onPick(year + 1)}
        disabled={year >= maxYear}
        aria-label="Next year"
      >
        ›
      </button>
    </div>
  );
}

function KpiStrip({ year, months }: { year: number; months: MonthRecord[] }) {
  const yearMonths = months.filter((m) => m.year === year);
  const income = yearMonths.reduce((sum, m) => sum + m.income, 0);
  const expense = yearMonths.reduce((sum, m) => sum + m.expense, 0);
  const surplus = income - expense;
  const rate = income ? (surplus / income) * 100 : 0;

  const items = [
    { label: `${year} 年收入`, value: fmtCompact(income), tone: "" },
    { label: `${year} 年支出`, value: fmtCompact(expense), tone: "" },
    { label: `${year} 年結餘`, value: fmtCompact(surplus), tone: surplus >= 0 ? "pos" : "neg" },
    { label: "平均儲蓄率", value: `${rate.toFixed(1)}%`, tone: "" },
    { label: "已記錄月份", value: `${yearMonths.length} / 12`, tone: "muted-val" },
  ];

  return (
    <div className="kpi-strip">
      {items.map((item) => (
        <div key={item.label} className="kpi-tile">
          <div className="kpi-label">{item.label}</div>
          <div className={`kpi-val ${item.tone}`}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function MonthTile({
  year,
  month,
  data,
  active,
  current,
  onPick,
}: {
  year: number;
  month: number;
  data?: MonthRecord;
  active: boolean;
  current: boolean;
  onPick: (year: number, month: number) => void;
}) {
  const hasData = Boolean(data);
  const surplus = hasData ? data!.income - data!.expense : 0;
  const max = hasData ? Math.max(data!.income, data!.expense) : 1;

  return (
    <button
      type="button"
      className={`month-tile ${active ? "active" : ""} ${current ? "current" : ""} ${!hasData ? "empty" : ""}`}
      onClick={() => onPick(year, month)}
    >
      <div className="mt-head">
        <span className="mt-num">{String(month).padStart(2, "0")}</span>
        <span className="mt-cn">{monthChinese(month)}</span>
        {current ? <span className="now-pill">目前</span> : null}
      </div>

      {hasData ? (
        <>
          <div className={`mt-figure ${surplus >= 0 ? "pos" : "neg"}`}>{fmtCompact(surplus)}</div>
          <div className="mt-meta">
            <span>
              <span className="bar bar-income"></span>
              {fmtCompact(data!.income)}
            </span>
            <span>
              <span className="bar bar-expense"></span>
              {fmtCompact(data!.expense)}
            </span>
          </div>
          <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="mt-spark">
            <line x1="0" x2="100" y1="12" y2="12" stroke="currentColor" strokeWidth="0.3" opacity="0.2" />
            <rect x="6" y={12 - (data!.income / max) * 10} width="40" height={(data!.income / max) * 10} className="bar-income-rect" rx="1" />
            <rect x="54" y="12" width="40" height={(data!.expense / max) * 10} className="bar-expense-rect" rx="1" />
          </svg>
          {data!.note ? <div className="mt-note">“{data!.note}”</div> : null}
        </>
      ) : (
        <div className="mt-empty">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span>新增</span>
        </div>
      )}
    </button>
  );
}

function YearGrid({
  year,
  months,
  activeKey,
  currentKey,
  onPick,
}: {
  year: number;
  months: MonthRecord[];
  activeKey: string;
  currentKey: string;
  onPick: (year: number, month: number) => void;
}) {
  const monthMap = new Map(months.map((m) => [monthLabel(m.year, m.month), m]));

  return (
    <div className="year-grid">
      {Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const key = monthLabel(year, month);
        return (
          <MonthTile
            key={key}
            year={year}
            month={month}
            data={monthMap.get(key)}
            active={key === activeKey}
            current={key === currentKey}
            onPick={onPick}
          />
        );
      })}
    </div>
  );
}

function BreakdownPanel({
  kind,
  total,
  lines,
}: {
  kind: "income" | "expense";
  total: number;
  lines: MonthLine[];
}) {
  const sum = lines.reduce((acc, line) => acc + line.amount, 0);
  const uncategorized = Math.max(0, total - sum);
  const over = sum > total;
  const tint = kind === "income" ? "var(--accent)" : "var(--neg)";

  return (
    <section className="bd-panel">
      <header className="bd-head">
        <div className="bd-head-l">
          <span className="bar" style={{ background: tint }}></span>
          <div>
            <div className="bd-title">{kind === "income" ? "收入" : "支出"}</div>
            <div className="bd-sub muted">{lines.length} 項分類{uncategorized > 0 ? " · 含未分類" : ""}</div>
          </div>
        </div>
        <div className="bd-total">
          <span>總額</span>
          <div className="bd-total-input">
            <span>$</span>
            <input readOnly value={Math.round(total).toLocaleString("en-US")} />
          </div>
        </div>
      </header>

      {over ? (
        <div className="bd-warn">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M12 8v5M12 17h.01M3 19h18L12 4z" />
          </svg>
          分類加總 {fmt(sum)} 超過{kind === "income" ? "收入" : "支出"}總額 {fmt(total)}
        </div>
      ) : null}

      <div className="bd-list">
        {lines.map((line, index) => (
          <div key={`${line.kind}-${line.name}-${index}`} className="cat-edit-row">
            <div className="cat-edit-name">
              <span className="cat-dot" style={{ background: tint }}></span>
              <input className="cat-input" readOnly value={line.name} />
            </div>
            <div className="cat-edit-amt">
              <span className="cat-edit-cur">$</span>
              <input className="cat-input num right" readOnly value={Math.round(line.amount).toLocaleString("en-US")} />
            </div>
            <div className="cat-edit-act"></div>
          </div>
        ))}
        {uncategorized > 0 ? (
          <div className="cat-edit-row uncat">
            <div className="cat-edit-name">
              <span className="cat-dot" style={{ background: "color-mix(in oklab, var(--warn) 60%, transparent)" }}></span>
              <span>未分類</span>
              <span className="cat-flag">總額 − 已分類</span>
            </div>
            <div className="cat-edit-amt num muted">{fmt(uncategorized)}</div>
            <div className="cat-edit-act"></div>
          </div>
        ) : null}
      </div>

      <div className="bd-foot">
        <span className="muted">小計</span>
        <strong className="num">{fmt(sum)}</strong>
        <span className="muted">未分類</span>
        <strong className="num">{fmt(uncategorized)}</strong>
        <span className="muted">總額</span>
        <strong className="num">{fmt(total)}</strong>
      </div>
    </section>
  );
}

function MonthEditor({ month }: { month?: MonthRecord }) {
  if (!month) {
    return (
      <section className="editor-card">
        <div className="editor-empty">
          <div className="editor-empty-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 5h16v14H4zM4 9h16M8 5v14" />
            </svg>
          </div>
          <div>
            <div className="editor-empty-title">尚未記錄這個月份</div>
            <div className="editor-empty-sub muted">先建立月份總收入與總支出，再補分類明細。</div>
          </div>
          <button className="btn btn-primary" type="button">新增月份</button>
        </div>
      </section>
    );
  }

  const surplus = month.income - month.expense;
  const rate = month.income ? (surplus / month.income) * 100 : 0;
  const incomeLines = month.lines.filter((line) => line.kind === "income");
  const expenseLines = month.lines.filter((line) => line.kind === "expense");

  return (
    <section className="editor-card">
      <header className="editor-head">
        <div>
          <div className="crumb">編輯月份</div>
          <h2 className="editor-title">
            {month.year} 年 {monthChinese(month.month)}
            <span className="editor-title-sub"> · {monthLabel(month.year, month.month)}</span>
          </h2>
        </div>

        <div className="editor-stats">
          <div className={`editor-stat ${surplus >= 0 ? "pos" : "neg"}`}>
            <div className="editor-stat-label">結餘</div>
            <div className="editor-stat-val num">{fmt(surplus)}</div>
          </div>
          <div className="editor-stat">
            <div className="editor-stat-label">儲蓄率</div>
            <div className="editor-stat-val num">{rate.toFixed(1)}%</div>
          </div>
          <div className="editor-stat">
            <div className="editor-stat-label">日均支出</div>
            <div className="editor-stat-val num">{fmt(month.expense / 30)}</div>
          </div>
        </div>

        <div className="editor-actions">
          <button className="btn btn-ghost" type="button">複製到下個月</button>
          <button className="btn btn-danger" type="button">刪除</button>
          <button className="btn btn-primary" type="button">儲存</button>
        </div>
      </header>

      <div className="editor-grid">
        <BreakdownPanel kind="income" total={month.income} lines={incomeLines} />
        <BreakdownPanel kind="expense" total={month.expense} lines={expenseLines} />
      </div>

      <div className="editor-note">
        <label>
          <span className="note-label">備註</span>
          <textarea className="note-input" rows={2} readOnly value={month.note || ""} />
        </label>
      </div>
    </section>
  );
}

export function MonthsView({
  months,
  currentYear,
  currentMonth,
}: {
  months: MonthRecord[];
  currentYear: number;
  currentMonth: number;
}) {
  const currentKey = monthLabel(currentYear, currentMonth);
  const { minYear, maxYear } = useMemo(() => {
    const existing = months.map((m) => m.year);
    return {
      minYear: Math.min(currentYear - 5, ...(existing.length ? existing : [currentYear])),
      maxYear: Math.max(currentYear, ...(existing.length ? existing : [currentYear])),
    };
  }, [months, currentYear]);
  const countByYear = useMemo(
    () =>
      months.reduce<Record<number, number>>((acc, month) => {
        acc[month.year] = (acc[month.year] ?? 0) + 1;
        return acc;
      }, {}),
    [months],
  );

  const [year, setYear] = useState<number>(currentYear);
  const [activeKey, setActiveKey] = useState<string>(currentKey);
  const router = useRouter();

  const monthMap = useMemo(() => new Map(months.map((m) => [monthLabel(m.year, m.month), m])), [months]);
  const activeMonth = monthMap.get(activeKey);

  const openMonth = (nextYear: number, nextMonth: number) => {
    const key = monthLabel(nextYear, nextMonth);
    setActiveKey(key);
    const month = monthMap.get(key);
    if (month) {
      router.push(`/months/${nextYear}/${nextMonth}/edit`);
      return;
    }
    router.push(`/months/new?year=${nextYear}&month=${nextMonth}`);
  };

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">每月收支 · Monthly Ledger</div>
          <h1 className="page-title">每月收支</h1>
          <div className="topbar-sub muted">紀錄每月共享帳本的總收支與分類明細</div>
        </div>
        <div className="topbar-actions">
          <YearPicker year={year} minYear={minYear} maxYear={maxYear} countByYear={countByYear} onPick={setYear} />
          <button className="btn btn-ghost" type="button">匯出</button>
          <button className="btn btn-primary" type="button" onClick={() => router.push("/months/new")}>新增月份</button>
        </div>
      </header>

      <KpiStrip year={year} months={months} />

      <section className="card year-card">
        <div className="card-head">
          <div>
            <div className="card-title">{year} 年</div>
            <div className="card-sub muted">點擊任一月份開啟編輯 · 灰底為尚未建立的月份</div>
          </div>
          <div className="legend">
            <span><span className="bar bar-income"></span>收入</span>
            <span><span className="bar bar-expense"></span>支出</span>
            <span><span className="legend-dot legend-current"></span>目前</span>
          </div>
        </div>

        <YearGrid
          year={year}
          months={months}
          activeKey={activeKey}
          currentKey={currentKey}
          onPick={openMonth}
        />
      </section>

      <MonthEditor month={activeMonth} />
    </>
  );
}
