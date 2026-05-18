// Shared between Home / Months / Goals pages.
// Loaded as a <script type="text/babel"> so other JSX files can use these
// directly — they share scope after Babel inlines them.

const fmt = (n) => "$" + Math.round(n).toLocaleString("en-US");
const fmtSigned = (n) => (n >= 0 ? "+" : "") + fmt(n);
const fmtCompact = (n) => {
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1_000_000) return sign + "$" + (a/1_000_000).toFixed(2) + "M";
  if (a >= 10_000)    return sign + "$" + (a/1000).toFixed(0) + "K";
  if (a >= 1_000)     return sign + "$" + (a/1000).toFixed(1) + "K";
  return sign + "$" + a.toFixed(0);
};
const monthLabel = (y, m) => `${y}-${String(m).padStart(2,"0")}`;
const monthShort = (m) => ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"][m-1];
const monthChinese = (m) => ["一","二","三","四","五","六","七","八","九","十","十一","十二"][m-1] + "月";

// ---- mock data (same shape across pages) -----------------------------------
const MONTHS = [
  { year: 2025, month: 6,  income: 118000, expense:  91200, note: "" },
  { year: 2025, month: 7,  income: 121500, expense:  88400, note: "暑期收斂支出" },
  { year: 2025, month: 8,  income: 119800, expense: 102300, note: "花蓮旅遊" },
  { year: 2025, month: 9,  income: 122000, expense:  89000, note: "" },
  { year: 2025, month: 10, income: 125000, expense:  93400, note: "" },
  { year: 2025, month: 11, income: 128000, expense:  96100, note: "雙11購物" },
  { year: 2025, month: 12, income: 168000, expense: 124500, note: "年終獎金、年末聚餐" },
  { year: 2026, month: 1,  income: 124000, expense:  95800, note: "" },
  { year: 2026, month: 2,  income: 122500, expense: 108200, note: "農曆新年紅包" },
  { year: 2026, month: 3,  income: 126000, expense:  91500, note: "" },
  { year: 2026, month: 4,  income: 128500, expense:  87900, note: "" },
  { year: 2026, month: 5,  income: 131200, expense:  95400, note: "" },
];

const CATEGORIES = {
  "2026-5": [
    { id: 1,  kind: "expense", name: "房租",      amount: 32000 },
    { id: 2,  kind: "expense", name: "餐飲",      amount: 18400 },
    { id: 3,  kind: "expense", name: "購物",      amount:  9200 },
    { id: 4,  kind: "expense", name: "交通",      amount:  6800 },
    { id: 5,  kind: "expense", name: "娛樂",      amount:  5200 },
    { id: 6,  kind: "expense", name: "雜支",      amount:  5800 },
    { id: 7,  kind: "expense", name: "水電瓦斯",  amount:  4500 },
    { id: 8,  kind: "expense", name: "醫療",      amount:  3800 },
    { id: 9,  kind: "expense", name: "訂閱",      amount:  2400 },
    { id: 10, kind: "income",  name: "薪資 (主)", amount: 82000 },
    { id: 11, kind: "income",  name: "薪資 (副)", amount: 41000 },
    { id: 12, kind: "income",  name: "利息 / 股息", amount: 5800 },
    { id: 13, kind: "income",  name: "其他",      amount:  2400 },
  ],
  "2026-4": [
    { id: 20, kind: "expense", name: "房租",      amount: 32000 },
    { id: 21, kind: "expense", name: "餐飲",      amount: 16200 },
    { id: 22, kind: "expense", name: "購物",      amount:  7400 },
    { id: 23, kind: "expense", name: "交通",      amount:  6100 },
    { id: 24, kind: "expense", name: "娛樂",      amount:  4800 },
    { id: 25, kind: "expense", name: "雜支",      amount:  5200 },
    { id: 26, kind: "income",  name: "薪資 (主)", amount: 82000 },
    { id: 27, kind: "income",  name: "薪資 (副)", amount: 41500 },
    { id: 28, kind: "income",  name: "其他",      amount:  5000 },
  ],
};

const GOALS = [
  { id: 1, tier: "短期", label: "緊急預備金",    current:  285000, target:  360000, monthly: 17900, etaMonths: 5,   note: "6 個月家用支出，存放於高利活存",  pinned: true },
  { id: 2, tier: "短期", label: "汽車保養基金",  current:   12000, target:   30000, monthly:  3000, etaMonths: 7,   note: "年度保養 + 保險預備" },
  { id: 3, tier: "中期", label: "京都家庭旅遊",  current:   62000, target:  150000, monthly: 10740, etaMonths: 9,   note: "2027 春 (10 天行程)" },
  { id: 4, tier: "中期", label: "新筆電 / 設備", current:   22000, target:   80000, monthly:  6000, etaMonths: 10,  note: "工作機 + 螢幕" },
  { id: 5, tier: "中期", label: "孩子才藝補習",  current:   18000, target:  120000, monthly:  4500, etaMonths: 24,  note: "2 年期音樂課程", pinned: true },
  { id: 6, tier: "長期", label: "退休投資組合",  current:  980000, target: 5000000, monthly:  7160, etaMonths: 192, note: "60% 股票 / 30% 債券 / 10% 現金" },
  { id: 7, tier: "長期", label: "孩子大學基金",  current:  220000, target: 1800000, monthly:  6000, etaMonths: 168, note: "預估 12 年後就讀" },
  { id: 8, tier: "長期", label: "房屋頭期款",    current:  340000, target: 2400000, monthly: 12000, etaMonths: 84,  note: "2030 看屋計畫", pinned: true },
];

const TIER_META = {
  "短期": { color: "var(--pos)",  range: "< 1 年",  weight: 0.50 },
  "中期": { color: "var(--warn)", range: "1–5 年",  weight: 0.30 },
  "長期": { color: "var(--info)", range: "5+ 年",   weight: 0.20 },
};

const USER = { email: "ling@chen-family.tw", display: "Ling" };

// ---- shared sidebar --------------------------------------------------------
function Sidebar({ active }) {
  const items = [
    { id: "home",     href: "Home.html",   label: "總覽",          icon: "M3 11 12 3l9 8M5 10v10h14V10" },
    { id: "months",   href: "Months.html", label: "每月收支",      icon: "M4 5h16v14H4zM4 9h16M8 5v14" },
    { id: "goals",    href: "Goals.html",  label: "理財目標",      icon: "M12 3v18M3 12h18M12 7l4 5-4 5-4-5z" },
    { id: "import",   href: "#",           label: "匯入快速記帳",  icon: "M12 4v12m0 0 4-4m-4 4-4-4M4 20h16", badge: "3" },
    { id: "settings", href: "#",           label: "設定",          icon: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" },
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
            {it.badge && <span className="nav-badge">{it.badge}</span>}
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
