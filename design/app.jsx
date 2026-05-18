// Family finance tracker — dark home page
// Data mirrors the schema in app/models.py (MonthlySummary + CategoryLine)
// All amounts in TWD. Locale: zh-Hant.

const { useState, useMemo, useRef, useEffect } = React;

// ---------- mock data (would come from /dashboard route) ----------
const MONTHS = [
  { year: 2025, month: 6,  income: 118000, expense:  91200 },
  { year: 2025, month: 7,  income: 121500, expense:  88400 },
  { year: 2025, month: 8,  income: 119800, expense: 102300 },
  { year: 2025, month: 9,  income: 122000, expense:  89000 },
  { year: 2025, month: 10, income: 125000, expense:  93400 },
  { year: 2025, month: 11, income: 128000, expense:  96100 },
  { year: 2025, month: 12, income: 168000, expense: 124500 },
  { year: 2026, month: 1,  income: 124000, expense:  95800 },
  { year: 2026, month: 2,  income: 122500, expense: 108200 },
  { year: 2026, month: 3,  income: 126000, expense:  91500 },
  { year: 2026, month: 4,  income: 128500, expense:  87900 },
  { year: 2026, month: 5,  income: 131200, expense:  95400 },
];

const CATEGORIES_BY_MONTH = {
  "2026-5": [
    { name: "房租",      kind: "expense", amount: 32000 },
    { name: "餐飲",      kind: "expense", amount: 18400 },
    { name: "購物",      kind: "expense", amount:  9200 },
    { name: "交通",      kind: "expense", amount:  6800 },
    { name: "娛樂",      kind: "expense", amount:  5200 },
    { name: "雜支",      kind: "expense", amount:  5800 },
    { name: "水電瓦斯",  kind: "expense", amount:  4500 },
    { name: "醫療",      kind: "expense", amount:  3800 },
    { name: "訂閱",      kind: "expense", amount:  2400 },
    { name: "未分類",    kind: "expense", amount:  7300 },
  ],
  "2026-4": [
    { name: "房租",      kind: "expense", amount: 32000 },
    { name: "餐飲",      kind: "expense", amount: 16200 },
    { name: "購物",      kind: "expense", amount:  7400 },
    { name: "交通",      kind: "expense", amount:  6100 },
    { name: "娛樂",      kind: "expense", amount:  4800 },
    { name: "雜支",      kind: "expense", amount:  5200 },
    { name: "水電瓦斯",  kind: "expense", amount:  4100 },
    { name: "醫療",      kind: "expense", amount:  2900 },
    { name: "訂閱",      kind: "expense", amount:  2400 },
    { name: "未分類",    kind: "expense", amount:  6800 },
  ],
};

const INCOME_LINES = {
  "2026-5": [
    { name: "薪資 (主)", amount: 82000 },
    { name: "薪資 (副)", amount: 41000 },
    { name: "利息 / 股息", amount: 5800 },
    { name: "其他", amount: 2400 },
  ],
};

const GOALS = [
  { tier: "短期", label: "緊急預備金", current: 285000,  target:  360000, eta: "2026 Q4" },
  { tier: "中期", label: "京都家庭旅遊", current:  62000,  target:  150000, eta: "2027 春" },
  { tier: "長期", label: "退休投資組合", current: 980000,  target: 5000000, eta: "2042" },
];

const USER = { email: "ling@chen-family.tw", display: "Ling" };

// ---------- helpers ----------
const fmt = (n) => "$" + Math.round(n).toLocaleString("en-US");
const fmtCompact = (n) => {
  if (Math.abs(n) >= 1_000_000) return "$" + (n/1_000_000).toFixed(2) + "M";
  if (Math.abs(n) >= 10_000)    return "$" + (n/1000).toFixed(0) + "K";
  if (Math.abs(n) >= 1_000)     return "$" + (n/1000).toFixed(1) + "K";
  return "$" + n.toFixed(0);
};
const monthLabel = (y, m) => `${y}-${String(m).padStart(2,"0")}`;
const monthShort = (m) => ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"][m-1];
const monthChinese = (m) => ["一","二","三","四","五","六","七","八","九","十","十一","十二"][m-1] + "月";

// ---------- sidebar ----------
function Sidebar({ active }) {
  const items = [
    { id: "home",    href: "Home.html",   label: "總覽",          icon: "M3 11 12 3l9 8M5 10v10h14V10" },
    { id: "months",  href: "Months.html", label: "每月收支",      icon: "M4 5h16v14H4zM4 9h16M8 5v14" },
    { id: "goals",   href: "Goals.html",  label: "理財目標",      icon: "M12 3v18M3 12h18M12 7l4 5-4 5-4-5z" },
    { id: "import",  href: "#",           label: "匯入快速記帳",  icon: "M12 4v12m0 0 4-4m-4 4-4-4M4 20h16" },
    { id: "settings",href: "#",           label: "設定",          icon: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" },
  ];
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <svg viewBox="0 0 32 32" width="22" height="22">
            <path d="M6 22 L13 12 L18 18 L26 8" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="26" cy="8" r="2.5" fill="currentColor"/>
          </svg>
        </div>
        <div>
          <div className="brand-name">家庭理財</div>
          <div className="brand-sub">Chen Household</div>
        </div>
      </div>
      <nav className="nav">
        {items.map(it => (
          <a key={it.id} className={"nav-item " + (active === it.id ? "active" : "")} href={it.href}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d={it.icon}/>
            </svg>
            <span>{it.label}</span>
            {it.id === "import" && <span className="nav-badge">3</span>}
          </a>
        ))}
      </nav>
      <div className="sidebar-foot">
        <div className="ledger-card">
          <div className="ledger-card-row">
            <span className="muted">共享帳本</span>
            <span className="dot dot-live"></span>
          </div>
          <div className="ledger-card-title">陳家庭</div>
          <div className="ledger-card-meta">2 位成員 · TWD</div>
        </div>
        <div className="user-pill">
          <div className="avatar">L</div>
          <div className="user-info">
            <div className="user-name">{USER.display}</div>
            <div className="user-email">{USER.email}</div>
          </div>
          <button className="icon-btn" title="登出" aria-label="登出">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 12H4M4 12l4-4M4 12l4 4M10 4h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-8"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}

// ---------- top bar ----------
function TopBar({ current, onAdd }) {
  return (
    <header className="topbar">
      <div>
        <div className="crumb">總覽 · Overview</div>
        <h1 className="page-title">
          {current.year} 年 {monthChinese(current.month)}
          <span className="page-title-sub"> · 第 {Math.ceil((new Date(current.year, current.month-1, 18).getDay() + 18)/7)} 週</span>
        </h1>
      </div>
      <div className="topbar-actions">
        <div className="search">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="11" cy="11" r="7"/>
            <path d="m20 20-3.5-3.5" strokeLinecap="round"/>
          </svg>
          <input placeholder="搜尋分類、月份、備註…" />
          <kbd>⌘K</kbd>
        </div>
        <button className="btn btn-ghost">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h10"/>
          </svg>
          匯出
        </button>
        <button className="btn btn-primary" onClick={onAdd}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          新增月份
        </button>
      </div>
    </header>
  );
}

// ---------- hero (current month KPIs + surplus) ----------
function Hero({ current, prev }) {
  const surplus = current.income - current.expense;
  const prevSurplus = prev ? prev.income - prev.expense : 0;
  const surplusDelta = surplus - prevSurplus;
  const surplusPct = prevSurplus !== 0 ? (surplusDelta / Math.abs(prevSurplus)) * 100 : 0;
  const savingsRate = (surplus / current.income) * 100;

  const incomeDelta = prev ? ((current.income - prev.income) / prev.income) * 100 : 0;
  const expenseDelta = prev ? ((current.expense - prev.expense) / prev.expense) * 100 : 0;

  return (
    <section className="hero">
      <div className="hero-main">
        <div className="hero-label">
          <span className="dot dot-accent"></span>
          本月結餘
        </div>
        <div className={"hero-figure " + (surplus >= 0 ? "pos" : "neg")}>
          <span className="currency">NT$</span>
          <span className="amount">{Math.round(surplus).toLocaleString("en-US")}</span>
        </div>
        <div className="hero-meta">
          <div className={"chip " + (surplusDelta >= 0 ? "chip-pos" : "chip-neg")}>
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d={surplusDelta >= 0 ? "m6 14 6-6 6 6" : "m6 10 6 6 6-6"}/>
            </svg>
            {surplusDelta >= 0 ? "+" : ""}{fmt(surplusDelta)} 較上月
          </div>
          <div className="chip chip-muted">
            儲蓄率 <strong>{savingsRate.toFixed(1)}%</strong>
          </div>
          <div className="chip chip-muted">
            日均支出 <strong>{fmt(current.expense/30)}</strong>
          </div>
        </div>
      </div>
      <div className="hero-side">
        <div className="hero-stat">
          <div className="stat-row">
            <span className="stat-label">
              <span className="bar bar-income"></span>
              收入
            </span>
            <span className={"stat-delta " + (incomeDelta >= 0 ? "pos" : "neg")}>
              {incomeDelta >= 0 ? "+" : ""}{incomeDelta.toFixed(1)}%
            </span>
          </div>
          <div className="stat-amount">{fmt(current.income)}</div>
          <div className="stat-foot muted">含薪資、利息、其他 共 {(INCOME_LINES["2026-5"]||[]).length} 項</div>
        </div>
        <div className="hero-stat">
          <div className="stat-row">
            <span className="stat-label">
              <span className="bar bar-expense"></span>
              支出
            </span>
            <span className={"stat-delta " + (expenseDelta <= 0 ? "pos" : "neg")}>
              {expenseDelta >= 0 ? "+" : ""}{expenseDelta.toFixed(1)}%
            </span>
          </div>
          <div className="stat-amount">{fmt(current.expense)}</div>
          <div className="stat-foot muted">{(CATEGORIES_BY_MONTH["2026-5"]||[]).length} 個分類 · 1 個未分類</div>
        </div>
      </div>
    </section>
  );
}

// ---------- twin-bar cashflow chart ----------
function Cashflow({ months, activeIdx, onPick }) {
  const max = Math.max(...months.flatMap(m => [m.income, m.expense]));
  const chartH = 220;
  const half = chartH / 2;
  const padX = 28;
  const [hover, setHover] = useState(null);

  // svg sized to viewbox; container handles width
  const N = months.length;
  const slotW = 100 / N;
  const barW = slotW * 0.32;

  return (
    <div className="card chart-card">
      <div className="card-head">
        <div>
          <div className="card-title">12 個月現金流</div>
          <div className="card-sub muted">收入 <span className="bar bar-income"></span> 與支出 <span className="bar bar-expense"></span> · 點擊月份切換檢視</div>
        </div>
        <div className="seg">
          <button className="seg-btn active">12M</button>
          <button className="seg-btn">6M</button>
          <button className="seg-btn">YTD</button>
        </div>
      </div>
      <div className="chart-wrap">
        <div className="chart-axis">
          <span>{fmtCompact(max)}</span>
          <span>{fmtCompact(max/2)}</span>
          <span>0</span>
          <span>{fmtCompact(max/2)}</span>
          <span>{fmtCompact(max)}</span>
        </div>
        <div className="chart-area">
          <svg viewBox={`0 0 100 ${chartH}`} preserveAspectRatio="none" className="chart-svg">
            {[0.25, 0.5, 0.75, 1].map((t,i) => (
              <line key={i} x1="0" x2="100" y1={half + (half*t)*(i%2?1:1) - half} y2={half + (half*t)*(i%2?1:1) - half} />
            ))}
            <line className="chart-mid" x1="0" x2="100" y1={half} y2={half}/>
            <line className="chart-grid" x1="0" x2="100" y1={half - half*0.5} y2={half - half*0.5}/>
            <line className="chart-grid" x1="0" x2="100" y1={half + half*0.5} y2={half + half*0.5}/>
            {months.map((m, i) => {
              const cx = slotW*i + slotW/2;
              const ih = (m.income / max) * (half - 6);
              const eh = (m.expense / max) * (half - 6);
              const isActive = i === activeIdx;
              const isHover = i === hover;
              return (
                <g key={i}
                   onMouseEnter={() => setHover(i)}
                   onMouseLeave={() => setHover(null)}
                   onClick={() => onPick(i)}
                   className={"bar-group " + (isActive ? "active " : "") + (isHover ? "hover" : "")}
                >
                  <rect className="hit" x={cx - slotW/2} y="0" width={slotW} height={chartH} />
                  <rect className="bar-income-rect"
                        x={cx - barW} y={half - ih}
                        width={barW} height={ih} rx="1.2"/>
                  <rect className="bar-expense-rect"
                        x={cx} y={half}
                        width={barW} height={eh} rx="1.2"/>
                  {isActive && <circle className="active-marker" cx={cx} cy={half} r="1.6"/>}
                </g>
              );
            })}
          </svg>
          <div className="chart-labels">
            {months.map((m,i) => (
              <span key={i} className={"chart-lbl " + (i === activeIdx ? "active" : "")} style={{width: `${slotW}%`}}>
                {m.month === 1 ? `${String(m.year).slice(2)}'1月` : monthShort(m.month)}
              </span>
            ))}
          </div>
          {hover != null && (
            <div className="chart-tip" style={{ left: `${slotW*hover + slotW/2}%`}}>
              <div className="tip-head">{monthLabel(months[hover].year, months[hover].month)}</div>
              <div className="tip-row"><span className="bar bar-income"></span>收入<strong>{fmt(months[hover].income)}</strong></div>
              <div className="tip-row"><span className="bar bar-expense"></span>支出<strong>{fmt(months[hover].expense)}</strong></div>
              <div className="tip-row tip-net">結餘<strong className={months[hover].income - months[hover].expense >= 0 ? "pos" : "neg"}>{fmt(months[hover].income - months[hover].expense)}</strong></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- categories ----------
function Categories({ items }) {
  const total = items.reduce((a,b) => a + b.amount, 0);
  const sorted = [...items].sort((a,b) => b.amount - a.amount);
  const top = sorted.slice(0, 7);
  const restAmount = sorted.slice(7).reduce((a,b) => a + b.amount, 0);
  const rows = restAmount > 0 ? [...top, { name: `其他 ${sorted.length-7} 項`, amount: restAmount, isRest: true }] : top;

  return (
    <div className="card cat-card">
      <div className="card-head">
        <div>
          <div className="card-title">支出分類</div>
          <div className="card-sub muted">共 {items.length} 個分類 · 合計 {fmt(total)}</div>
        </div>
        <button className="link-btn">查看全部 →</button>
      </div>
      <div className="cat-list">
        {rows.map((r,i) => {
          const pct = (r.amount/total)*100;
          const isUncat = r.name === "未分類";
          return (
            <div key={i} className={"cat-row " + (isUncat ? "is-uncat" : "")}>
              <div className="cat-row-top">
                <div className="cat-name">
                  <span className="cat-swatch" style={{ "--i": i }}></span>
                  {r.name}
                  {isUncat && <span className="cat-flag">未指派</span>}
                </div>
                <div className="cat-amt">
                  <span className="amt">{fmt(r.amount)}</span>
                  <span className="pct muted">{pct.toFixed(1)}%</span>
                </div>
              </div>
              <div className="cat-track">
                <div className="cat-fill" style={{ width: `${pct}%`, "--i": i }}></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- goals ----------
function Goals({ goals }) {
  return (
    <div className="card goals-card">
      <div className="card-head">
        <div>
          <div className="card-title">理財目標</div>
          <div className="card-sub muted">依本月結餘自動配置 · 短期 50% / 中期 30% / 長期 20%</div>
        </div>
        <button className="link-btn">調整配置 →</button>
      </div>
      <div className="goals-grid">
        {goals.map((g,i) => {
          const pct = (g.current/g.target)*100;
          return (
            <div key={i} className="goal">
              <div className="goal-head">
                <span className="goal-tier" data-tier={g.tier}>{g.tier}</span>
                <span className="goal-eta muted">完成於 {g.eta}</span>
              </div>
              <div className="goal-label">{g.label}</div>
              <div className="goal-fig">
                <span className="goal-current">{fmtCompact(g.current)}</span>
                <span className="goal-of muted">/ {fmtCompact(g.target)}</span>
              </div>
              <div className="goal-track">
                <div className="goal-fill" style={{ width: `${Math.min(100,pct)}%` }}></div>
                <div className="goal-tick" style={{ left: `${Math.min(100,pct)}%` }}></div>
              </div>
              <div className="goal-foot">
                <span className="muted">本月配置</span>
                <strong>+{fmt(g.tier === "短期" ? 17900 : g.tier === "中期" ? 10740 : 7160)}</strong>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- recent months table ----------
function Recent({ months, activeIdx, onPick }) {
  const list = [...months].reverse();
  return (
    <div className="card recent-card">
      <div className="card-head">
        <div>
          <div className="card-title">近期月份</div>
          <div className="card-sub muted">點擊任一列切換上方檢視</div>
        </div>
        <a className="link-btn" href="#">完整明細 →</a>
      </div>
      <div className="table-wrap">
        <table className="recent-table">
          <thead>
            <tr>
              <th>月份</th>
              <th className="num">收入</th>
              <th className="num">支出</th>
              <th className="num">結餘</th>
              <th className="num">儲蓄率</th>
              <th>趨勢</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((m, j) => {
              const i = months.length - 1 - j;
              const s = m.income - m.expense;
              const rate = (s/m.income)*100;
              const isCurrent = i === activeIdx;
              return (
                <tr key={i} className={isCurrent ? "current" : ""} onClick={() => onPick(i)}>
                  <td>
                    <div className="mo-cell">
                      <strong>{monthLabel(m.year, m.month)}</strong>
                      <span className="muted">{monthChinese(m.month)}</span>
                      {isCurrent && <span className="now-pill">目前</span>}
                    </div>
                  </td>
                  <td className="num">{fmt(m.income)}</td>
                  <td className="num">{fmt(m.expense)}</td>
                  <td className={"num " + (s >= 0 ? "pos" : "neg")}>{fmt(s)}</td>
                  <td className="num muted">{rate.toFixed(1)}%</td>
                  <td><MiniSpark income={m.income} expense={m.expense} /></td>
                  <td className="num">
                    <button className="icon-btn ghost" aria-label="編輯">
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m4 20 4-1 11-11-3-3L5 16zM14 6l3 3"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MiniSpark({ income, expense }) {
  const max = Math.max(income, expense);
  return (
    <svg viewBox="0 0 40 16" width="48" height="16" className="mini-spark">
      <rect x="2"  y={16 - (income/max)*14}  width="6" height={(income/max)*14}  rx="1" className="bar-income-rect"/>
      <rect x="12" y={16 - (expense/max)*14} width="6" height={(expense/max)*14} rx="1" className="bar-expense-rect"/>
    </svg>
  );
}

// ---------- main app ----------
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#7be0a8",
  "density": "舒適",
  "showGoals": true
}/*EDITMODE-END*/;

const ACCENT_MAP = {
  "#7be0a8": { soft: "#1f3a2c" }, // mint
  "#7cd8e0": { soft: "#1d3a3c" }, // cyan
  "#b89fe8": { soft: "#2c2640" }, // lavender
  "#e0b87b": { soft: "#3a2f1d" }, // amber
};

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [activeIdx, setActiveIdx] = useState(MONTHS.length - 1);
  const current = MONTHS[activeIdx];
  const prev = activeIdx > 0 ? MONTHS[activeIdx - 1] : null;
  const cats = CATEGORIES_BY_MONTH[`${current.year}-${current.month}`] || CATEGORIES_BY_MONTH["2026-5"];

  useEffect(() => {
    const v = ACCENT_MAP[t.accent] || ACCENT_MAP["#7be0a8"];
    document.documentElement.style.setProperty("--accent", t.accent);
    document.documentElement.style.setProperty("--accent-soft", v.soft);
    document.documentElement.dataset.density = t.density === "緊湊" ? "compact" : "comfortable";
  }, [t.accent, t.density]);

  return (
    <div className="app">
      <Sidebar active="home"/>
      <main className="main">
        <TopBar current={current} onAdd={() => alert("新增月份 (Demo)")}/>
        <Hero current={current} prev={prev}/>
        <div className="grid-2">
          <Cashflow months={MONTHS} activeIdx={activeIdx} onPick={setActiveIdx}/>
          <Categories items={cats}/>
        </div>
        {t.showGoals && <Goals goals={GOALS}/>}
        <Recent months={MONTHS} activeIdx={activeIdx} onPick={setActiveIdx}/>
        <footer className="page-foot muted">
          家庭理財 · 共享帳本 · 資料快取於 {new Date().toLocaleString("zh-TW", { hour12: false })}
        </footer>
      </main>

      <TweaksPanel title="Tweaks">
        <TweakSection label="外觀" />
        <TweakColor label="強調色" value={t.accent}
          options={["#7be0a8", "#7cd8e0", "#b89fe8", "#e0b87b"]}
          onChange={(v) => setTweak("accent", v)} />
        <TweakRadio label="密度" value={t.density}
          options={["舒適", "緊湊"]}
          onChange={(v) => setTweak("density", v)} />
        <TweakSection label="區塊" />
        <TweakToggle label="顯示理財目標" value={t.showGoals}
          onChange={(v) => setTweak("showGoals", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
