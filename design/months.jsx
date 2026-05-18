// 每月收支 — year calendar + month editor
const { useState, useMemo, useRef, useEffect } = React;

// quick lookup by year-month
const monthMap = new Map(MONTHS.map(m => [`${m.year}-${m.month}`, m]));

// ---- year picker ---------------------------------------------------------
function YearPicker({ year, onPick, years }) {
  return (
    <div className="year-picker">
      {years.map(y => (
        <button key={y}
          className={"year-pill " + (y === year ? "active" : "")}
          onClick={() => onPick(y)}>
          {y}
          <span className="year-pill-sub">
            {MONTHS.filter(m => m.year === y).length}/12
          </span>
        </button>
      ))}
    </div>
  );
}

// ---- KPI strip -----------------------------------------------------------
function KpiStrip({ year, months }) {
  const yearMonths = months.filter(m => m.year === year);
  const income  = yearMonths.reduce((a, m) => a + m.income, 0);
  const expense = yearMonths.reduce((a, m) => a + m.expense, 0);
  const surplus = income - expense;
  const rate = income ? (surplus / income) * 100 : 0;
  const items = [
    { lbl: `${year} 年收入`,    val: fmtCompact(income),  tone: "" },
    { lbl: `${year} 年支出`,    val: fmtCompact(expense), tone: "" },
    { lbl: `${year} 年結餘`,    val: fmtCompact(surplus), tone: surplus >= 0 ? "pos" : "neg" },
    { lbl: "平均儲蓄率",        val: rate.toFixed(1) + "%", tone: "" },
    { lbl: "已記錄月份",        val: `${yearMonths.length} / 12`, tone: "muted-val" },
  ];
  return (
    <div className="kpi-strip">
      {items.map((it, i) => (
        <div key={i} className="kpi-tile">
          <div className="kpi-label">{it.lbl}</div>
          <div className={"kpi-val " + it.tone}>{it.val}</div>
        </div>
      ))}
    </div>
  );
}

// ---- year grid -----------------------------------------------------------
function MonthTile({ year, month, data, active, current, onPick }) {
  const has = !!data;
  const surplus = has ? data.income - data.expense : 0;
  const max = has ? Math.max(data.income, data.expense) : 1;
  return (
    <button
      className={
        "month-tile " +
        (active ? "active " : "") +
        (current ? "current " : "") +
        (!has ? "empty" : "")
      }
      onClick={() => onPick(year, month)}>
      <div className="mt-head">
        <span className="mt-num">{String(month).padStart(2,"0")}</span>
        <span className="mt-cn">{monthChinese(month)}</span>
        {current && <span className="now-pill">目前</span>}
      </div>
      {has ? (
        <>
          <div className={"mt-figure " + (surplus >= 0 ? "pos" : "neg")}>
            {fmtCompact(surplus)}
          </div>
          <div className="mt-meta">
            <span><span className="bar bar-income"></span>{fmtCompact(data.income)}</span>
            <span><span className="bar bar-expense"></span>{fmtCompact(data.expense)}</span>
          </div>
          <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="mt-spark">
            <line x1="0" x2="100" y1="12" y2="12" stroke="currentColor" strokeWidth="0.3" opacity="0.2"/>
            <rect x="6"  y={12 - (data.income/max)*10}  width="40" height={(data.income/max)*10}  className="bar-income-rect" rx="1"/>
            <rect x="54" y="12" width="40" height={(data.expense/max)*10} className="bar-expense-rect" rx="1"/>
          </svg>
          {data.note && <div className="mt-note">“{data.note}”</div>}
        </>
      ) : (
        <div className="mt-empty">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          <span>新增</span>
        </div>
      )}
    </button>
  );
}

function YearGrid({ year, monthMap, activeKey, currentKey, onPick }) {
  return (
    <div className="year-grid">
      {Array.from({length: 12}, (_, i) => {
        const m = i + 1;
        const key = `${year}-${m}`;
        const data = monthMap.get(key);
        return (
          <MonthTile key={m}
            year={year} month={m} data={data}
            active={key === activeKey}
            current={key === currentKey}
            onPick={onPick}/>
        );
      })}
    </div>
  );
}

// ---- detail editor -------------------------------------------------------
function CategoryRow({ row, onChange, onDelete, isUncat, accent }) {
  if (isUncat) {
    return (
      <div className="cat-edit-row uncat">
        <div className="cat-edit-name">
          <span className="cat-dot" style={{ background: "color-mix(in oklab, var(--warn) 60%, transparent)" }}></span>
          <span>未分類</span>
          <span className="cat-flag">總額 − 已分類</span>
        </div>
        <div className="cat-edit-amt num muted">{fmt(row.amount)}</div>
        <div className="cat-edit-act"></div>
      </div>
    );
  }
  return (
    <div className="cat-edit-row">
      <div className="cat-edit-name">
        <span className="cat-dot" style={{ background: accent }}></span>
        <input
          className="cat-input"
          value={row.name}
          placeholder="分類名稱"
          onChange={e => onChange({...row, name: e.target.value})}/>
      </div>
      <div className="cat-edit-amt">
        <span className="cat-edit-cur">$</span>
        <input
          className="cat-input num right"
          type="text"
          inputMode="decimal"
          value={row.amount.toLocaleString("en-US")}
          onChange={e => {
            const v = parseInt(e.target.value.replace(/[^0-9]/g, "") || "0", 10);
            onChange({...row, amount: v});
          }}/>
      </div>
      <div className="cat-edit-act">
        <button className="icon-btn ghost" onClick={() => onDelete(row.id)} aria-label="刪除">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M6 7h12M9 7V5h6v2M8 7l1 13h6l1-13M11 11v6M13 11v6"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

function BreakdownPanel({ kind, total, lines, onLineChange, onLineDelete, onAdd, onTotalChange }) {
  const sum = lines.reduce((a, l) => a + l.amount, 0);
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
        <div className="bd-head-r">
          <label className="bd-total">
            <span>總額</span>
            <div className="bd-total-input">
              <span>$</span>
              <input
                className="num right"
                value={total.toLocaleString("en-US")}
                onChange={e => {
                  const v = parseInt(e.target.value.replace(/[^0-9]/g, "") || "0", 10);
                  onTotalChange(v);
                }}/>
            </div>
          </label>
        </div>
      </header>

      {over && (
        <div className="bd-warn">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M12 8v5M12 17h.01M3 19h18L12 4z"/>
          </svg>
          分類加總 {fmt(sum)} 超過{kind === "income" ? "收入" : "支出"}總額 {fmt(total)}
        </div>
      )}

      <div className="bd-list">
        {lines.map(l => (
          <CategoryRow key={l.id} row={l} onChange={onLineChange} onDelete={onLineDelete} accent={tint}/>
        ))}
        {uncategorized > 0 && (
          <CategoryRow row={{ amount: uncategorized }} isUncat/>
        )}
      </div>

      <button className="bd-add" onClick={onAdd}>
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        新增分類
      </button>

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

function MonthEditor({ year, month, data, lines, onPatch }) {
  if (!data) {
    // empty / new state
    return (
      <section className="editor-card">
        <div className="editor-empty">
          <div className="editor-empty-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 5h16v14H4zM4 9h16M8 5v14"/>
            </svg>
          </div>
          <div>
            <div className="editor-empty-title">{year} 年 {monthChinese(month)}尚未記錄</div>
            <div className="editor-empty-sub muted">輸入當月總收入與總支出，分類明細可稍後補上。</div>
          </div>
          <button className="btn btn-primary">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            新增 {monthLabel(year, month)}
          </button>
        </div>
      </section>
    );
  }

  const surplus = data.income - data.expense;
  const rate = data.income ? (surplus / data.income) * 100 : 0;

  const incomeLines = lines.filter(l => l.kind === "income");
  const expenseLines = lines.filter(l => l.kind === "expense");

  const updateLine = (kind) => (row) => {
    const next = lines.map(l => l.id === row.id ? row : l);
    onPatch({ lines: next });
  };
  const deleteLine = (id) => {
    onPatch({ lines: lines.filter(l => l.id !== id) });
  };
  const addLine = (kind) => () => {
    const newId = Math.max(0, ...lines.map(l => l.id)) + 1;
    onPatch({ lines: [...lines, { id: newId, kind, name: "", amount: 0 }] });
  };

  return (
    <section className="editor-card">
      <header className="editor-head">
        <div>
          <div className="crumb">編輯月份</div>
          <h2 className="editor-title">
            {year} 年 {monthChinese(month)}
            <span className="editor-title-sub"> · {monthLabel(year, month)}</span>
          </h2>
        </div>
        <div className="editor-stats">
          <div className={"editor-stat " + (surplus >= 0 ? "pos" : "neg")}>
            <div className="editor-stat-label">結餘</div>
            <div className="editor-stat-val num">{fmt(surplus)}</div>
          </div>
          <div className="editor-stat">
            <div className="editor-stat-label">儲蓄率</div>
            <div className="editor-stat-val num">{rate.toFixed(1)}%</div>
          </div>
          <div className="editor-stat">
            <div className="editor-stat-label">日均支出</div>
            <div className="editor-stat-val num">{fmt(data.expense/30)}</div>
          </div>
        </div>
        <div className="editor-actions">
          <button className="btn btn-ghost">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2M4 9h12v12H4z"/>
            </svg>
            複製到下個月
          </button>
          <button className="btn btn-danger">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 7h12M9 7V5h6v2M8 7l1 13h6l1-13"/>
            </svg>
            刪除
          </button>
          <button className="btn btn-primary">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L20 7"/>
            </svg>
            儲存
          </button>
        </div>
      </header>

      <div className="editor-grid">
        <BreakdownPanel kind="income"
          total={data.income}
          lines={incomeLines}
          onLineChange={updateLine("income")}
          onLineDelete={deleteLine}
          onAdd={addLine("income")}
          onTotalChange={(v) => onPatch({ income: v })}/>
        <BreakdownPanel kind="expense"
          total={data.expense}
          lines={expenseLines}
          onLineChange={updateLine("expense")}
          onLineDelete={deleteLine}
          onAdd={addLine("expense")}
          onTotalChange={(v) => onPatch({ expense: v })}/>
      </div>

      <div className="editor-note">
        <label>
          <span className="note-label">備註</span>
          <textarea
            className="note-input"
            rows="2"
            placeholder="例如：旅遊支出較高、獎金入帳"
            value={data.note || ""}
            onChange={e => onPatch({ note: e.target.value })}/>
        </label>
      </div>
    </section>
  );
}

// ---- main page -----------------------------------------------------------
function MonthsPage() {
  const today = { year: 2026, month: 5 };
  const currentKey = `${today.year}-${today.month}`;

  const [year, setYear] = useState(today.year);
  const [activeKey, setActiveKey] = useState(currentKey);
  const [edits, setEdits] = useState({});  // key -> { income?, expense?, note?, lines? }

  const [ay, am] = activeKey.split("-").map(Number);
  const base = monthMap.get(activeKey);
  const overlay = edits[activeKey] || {};
  const data = base ? {
    ...base,
    income:  overlay.income  ?? base.income,
    expense: overlay.expense ?? base.expense,
    note:    overlay.note    ?? base.note,
  } : null;
  const lines = overlay.lines ?? CATEGORIES[activeKey] ?? [];

  const onPatch = (patch) => {
    setEdits(prev => ({ ...prev, [activeKey]: { ...prev[activeKey], ...patch } }));
  };

  const years = [2024, 2025, 2026];

  return (
    <div className="app">
      <Sidebar active="months"/>
      <main className="main">
        <header className="topbar">
          <div>
            <div className="crumb">每月收支 · Monthly Ledger</div>
            <h1 className="page-title">每月收支</h1>
            <div className="topbar-sub muted">紀錄每月共享帳本的總收支與分類明細</div>
          </div>
          <div className="topbar-actions">
            <YearPicker year={year} onPick={setYear} years={years}/>
            <button className="btn btn-ghost">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M4 7h16M4 12h16M4 17h10"/>
              </svg>
              匯出
            </button>
            <button className="btn btn-primary">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              新增月份
            </button>
          </div>
        </header>

        <KpiStrip year={year} months={MONTHS}/>

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
          <YearGrid year={year}
            monthMap={monthMap}
            activeKey={activeKey}
            currentKey={currentKey}
            onPick={(y, m) => setActiveKey(`${y}-${m}`)}/>
        </section>

        <MonthEditor year={ay} month={am} data={data} lines={lines} onPatch={onPatch}/>

        <footer className="page-foot muted">每月收支 · 共享帳本維護頁面</footer>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<MonthsPage/>);
