"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";

// ─── constants ───────────────────────────────────────────────────────────────

const USD_TWD = 31.5;

// ─── types ────────────────────────────────────────────────────────────────────

type Region = "TW" | "US" | "BOND";
type Currency = "TWD" | "USD";
type Signal = "買" | "守" | "賣";
type Health = "A" | "B" | "C";
type Range = "1M" | "3M" | "1Y" | "5Y";

type Ticker = {
  name: string;
  region: Region;
  price: number;
  currency: Currency;
  dayChg: number;
  w1: number; m1: number; m3: number; y1: number;
  pe: number | null;
  yld: number | null;
  aum: number | null;
  er?: number;
  health: Health;
  signal: Signal;
  aiNote: string;
};

type Holding = { symbol: string; qty: number; costAvg: number };

// ─── mock data ────────────────────────────────────────────────────────────────

const TICKERS: Record<string, Ticker> = {
  "0050":   { name: "元大台灣50",              region: "TW",   price: 178.50, currency: "TWD", dayChg:+0.84, w1:+1.2,  m1:+3.4,  m3:+8.1,  y1:+22.5, pe:16.2, yld:3.2, aum:2800, er:0.43, health:"A", signal:"買", aiNote:"台灣大盤核心，估值合理，長期定期定額首選" },
  "006208": { name: "富邦台50",                region: "TW",   price:  95.20, currency: "TWD", dayChg:+0.79, w1:+1.1,  m1:+3.2,  m3:+7.9,  y1:+22.1, pe:16.0, yld:3.3, aum: 320, er:0.09, health:"A", signal:"買", aiNote:"0050 費率更低替代，長期績效近乎相同" },
  "0056":   { name: "元大高股息",              region: "TW",   price:  38.60, currency: "TWD", dayChg:-0.26, w1:-0.3,  m1:+1.8,  m3:+4.2,  y1:+12.4, pe:14.8, yld:7.1, aum:3100, er:0.34, health:"B", signal:"守", aiNote:"高息但成長較慢，適合退休族配置" },
  "00878":  { name: "國泰永續高股息",          region: "TW",   price:  21.80, currency: "TWD", dayChg:+0.46, w1:+0.8,  m1:+2.1,  m3:+5.6,  y1:+15.3, pe:15.5, yld:6.8, aum:2200, er:0.16, health:"B", signal:"守", aiNote:"ESG 篩選 + 高息，配置偏防守" },
  "VT":     { name: "Vanguard Total World",    region: "US",   price: 118.40, currency: "USD", dayChg:+0.38, w1:+0.9,  m1:+2.8,  m3:+7.4,  y1:+19.6, pe:17.8, yld:2.1, aum: 42.6, er:0.07, health:"A", signal:"買", aiNote:"全球分散首選，費率超低，Bogleheads 核心持股" },
  "VOO":    { name: "Vanguard S&P 500",        region: "US",   price: 548.20, currency: "USD", dayChg:+0.52, w1:+1.2,  m1:+3.6,  m3:+9.1,  y1:+24.2, pe:22.4, yld:1.3, aum: 531,  er:0.03, health:"B", signal:"守", aiNote:"標普 500 估值偏高但動能強，短期觀望" },
  "VTI":    { name: "Vanguard Total US",       region: "US",   price: 286.50, currency: "USD", dayChg:+0.41, w1:+0.9,  m1:+3.2,  m3:+8.4,  y1:+22.8, pe:21.6, yld:1.4, aum: 440,  er:0.03, health:"B", signal:"守", aiNote:"美國全市場，含更多中小型股" },
  "QQQ":    { name: "Invesco Nasdaq-100",      region: "US",   price: 512.80, currency: "USD", dayChg:+0.68, w1:+1.6,  m1:+5.1,  m3:+12.4, y1:+31.5, pe:30.2, yld:0.6, aum: 298,  er:0.20, health:"C", signal:"賣", aiNote:"科技集中過高、估值偏貴，波動風險大" },
  "SMH":    { name: "VanEck Semiconductor",    region: "US",   price: 248.60, currency: "USD", dayChg:+1.24, w1:+3.1,  m1:+8.4,  m3:+18.6, y1:+42.1, pe:28.4, yld:0.9, aum:  22.4, er:0.35, health:"B", signal:"守", aiNote:"半導體主題，台積電受益，高波動高報酬" },
  "SOXX":   { name: "iShares Semiconductor",   region: "US",   price: 218.40, currency: "USD", dayChg:+1.18, w1:+2.8,  m1:+7.9,  m3:+17.2, y1:+39.8, pe:27.1, yld:1.0, aum:  13.2, er:0.35, health:"B", signal:"守", aiNote:"SMH 替代選擇，覆蓋範圍更廣" },
  "XLK":    { name: "Technology Select SPDR",  region: "US",   price: 224.80, currency: "USD", dayChg:+0.74, w1:+1.8,  m1:+5.6,  m3:+14.2, y1:+33.4, pe:32.1, yld:0.7, aum:  68.4, er:0.08, health:"C", signal:"賣", aiNote:"AAPL+MSFT 集中度高，估值過貴" },
  "AIQ":    { name: "Global X AI & Tech",      region: "US",   price:  46.20, currency: "USD", dayChg:+1.02, w1:+2.4,  m1:+6.8,  m3:+16.4, y1:+38.2, pe:29.8, yld:0.4, aum:   2.8, er:0.68, health:"B", signal:"守", aiNote:"AI 主題分散尚可，費率偏高需注意" },
  "BND":    { name: "Vanguard Total Bond",     region: "BOND", price:  72.40, currency: "USD", dayChg:-0.12, w1:-0.3,  m1:+0.8,  m3:+2.1,  y1: +4.6, pe:null, yld:4.8, aum: 116,  er:0.03, health:"A", signal:"買", aiNote:"美國全債市，降息環境受益，防禦性核心" },
  "BNDW":   { name: "Vanguard World Bond",     region: "BOND", price:  68.80, currency: "USD", dayChg:-0.09, w1:-0.2,  m1:+0.6,  m3:+1.8,  y1: +4.2, pe:null, yld:4.6, aum:  18.6, er:0.05, health:"A", signal:"買", aiNote:"全球債券分散，利率風險更低" },
  "00679B": { name: "元大美債20年",            region: "BOND", price:  32.10, currency: "TWD", dayChg:-0.31, w1:-0.6,  m1:+1.2,  m3:+3.4,  y1: +8.2, pe:null, yld:5.1, aum:  68,   er:0.15, health:"B", signal:"守", aiNote:"長債波動大，降息有利但時機難抓" },
  "TLT":    { name: "iShares 20+ Treasury",    region: "BOND", price:  88.60, currency: "USD", dayChg:-0.22, w1:-0.5,  m1:+1.4,  m3:+3.8,  y1: +7.8, pe:null, yld:4.9, aum:  52.4, er:0.15, health:"B", signal:"守", aiNote:"20年期美債，高利率環境下波動顯著" },
  "2330":   { name: "台積電",                  region: "TW",   price:1025.00, currency: "TWD", dayChg:+1.47, w1:+3.2,  m1:+8.6,  m3:+15.2, y1:+48.3, pe:24.1, yld:1.6, aum:null,             health:"B", signal:"守", aiNote:"AI 受惠龍頭但估值偏高，逢回再加碼" },
  "2454":   { name: "聯發科",                  region: "TW",   price:1380.00, currency: "TWD", dayChg:+0.73, w1:+1.8,  m1:+4.9,  m3:+9.4,  y1:+28.7, pe:18.4, yld:3.1, aum:null,             health:"A", signal:"買", aiNote:"手機 AP 龍頭，AI 邊緣端受益，估值合理" },
  "2412":   { name: "中華電信",                region: "TW",   price: 118.50, currency: "TWD", dayChg:-0.08, w1:-0.4,  m1:+0.6,  m3:+2.1,  y1: +5.8, pe:26.3, yld:5.2, aum:null,             health:"C", signal:"賣", aiNote:"殖利率誘人但成長停滯，PE 偏高" },
};

const HOLDINGS_DATA: Holding[] = [
  { symbol: "2330",  qty: 100, costAvg:  850.0 },
  { symbol: "0050",  qty: 500, costAvg:  145.2 },
  { symbol: "VT",    qty:  80, costAvg:   96.4 },
  { symbol: "BNDW",  qty: 120, costAvg:   62.8 },
  { symbol: "2454",  qty:  50, costAvg: 1180.0 },
  { symbol: "BND",   qty:  60, costAvg:   71.2 },
];

const CAROUSEL_ROWS = [
  { label: "台股市值型 ETF", symbols: ["0050", "006208", "0056", "00878"] },
  { label: "美股大盤 ETF",   symbols: ["VT", "VOO", "VTI", "QQQ"] },
  { label: "美股主題 ETF",   symbols: ["SMH", "SOXX", "XLK", "AIQ"] },
  { label: "債券 ETF",       symbols: ["BND", "BNDW", "00679B", "TLT"] },
  { label: "台股權值股",     symbols: ["2330", "2454", "2412"] },
] as const;

const TARGET_ALLOC: Record<string, number> = { 台股: 25, 美股: 45, 債券: 20, 現金: 10 };
const ALLOC_CATS = ["台股", "美股", "債券", "現金"] as const;
const ALLOC_COLORS: Record<string, string> = {
  台股: "var(--pos)", 美股: "var(--info)", 債券: "var(--warn)", 現金: "var(--faint)",
};

const MOCK_NEWS: Record<string, { title: string; date: string }[]> = {
  "2330": [
    { title: "台積電 Q1 法說：AI 伺服器需求超預期，上修全年展望", date: "2026/05/14" },
    { title: "CoWoS 先進封裝產能持續擴充，供給仍吃緊", date: "2026/05/08" },
    { title: "亞利桑那廠進入風險試產，良率優於預期", date: "2026/04/28" },
  ],
  "VT": [
    { title: "聯準會暗示年底前仍有降息空間，全球股市受惠", date: "2026/05/17" },
    { title: "VT 受惠全球資金回流，近月淨流入創近期新高", date: "2026/05/10" },
    { title: "Vanguard 小幅調整 VT 成分股比重，美股持倉微降", date: "2026/05/02" },
  ],
};
function getMockNews(symbol: string) {
  return (
    MOCK_NEWS[symbol] ?? [
      { title: `${symbol} 受惠全球資金回流，近日交易量明顯放大`, date: "2026/05/16" },
      { title: `分析師維持 ${symbol} 目標區間，關注下季財報`, date: "2026/05/10" },
      { title: "聯準會暗示降息空間，成長型資產受惠", date: "2026/05/02" },
    ]
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function seededRng(seed: number) {
  let s = Math.abs(seed % 2147483647) || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const RANGE_POINTS: Record<Range, number> = { "1M": 22, "3M": 65, "1Y": 252, "5Y": 260 };

function genHistory(symbol: string, points: number, endPrice: number, annualY1: number): number[] {
  const seed = symbol.split("").reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
  const rng = seededRng(seed);
  const dailyDrift = (annualY1 / 100) / 252;
  const dailyVol = 0.013;
  const arr: number[] = [endPrice];
  for (let i = 1; i < points; i++) {
    const shock = (rng() - 0.5) * 2 * dailyVol;
    arr.unshift(arr[0]! * (1 - dailyDrift - shock));
  }
  return arr;
}

function sparklinePath(data: number[], w: number, h: number): string {
  if (data.length < 2) return "";
  const min = Math.min(...data), max = Math.max(...data);
  const range = Math.max(max - min, 0.001);
  return data
    .map((v, i) => {
      const x = ((i / (data.length - 1)) * w).toFixed(1);
      const y = (h - ((v - min) / range) * h * 0.85 - h * 0.075).toFixed(1);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function chartPath(data: number[], w: number, h: number): { line: string; area: string } {
  if (data.length < 2) return { line: "", area: "" };
  const min = Math.min(...data), max = Math.max(...data);
  const range = Math.max(max - min, 0.001);
  const toX = (i: number) => ((i / (data.length - 1)) * (w - 32) + 16).toFixed(1);
  const toY = (v: number) => (h - 24 - ((v - min) / range) * (h - 48)).toFixed(1);
  const segments = data.map((v, i) => `${toX(i)} ${toY(v)}`);
  const line = `M ${segments.join(" L ")}`;
  const area = `M ${toX(0)} ${h - 24} L ${segments.join(" L ")} L ${toX(data.length - 1)} ${h - 24} Z`;
  return { line, area };
}

function fmtTWD(n: number, compact = false): string {
  const abs = Math.abs(n);
  if (compact) {
    if (abs >= 1_000_000) return "NT$" + (n / 1_000_000).toFixed(2) + "M";
    if (abs >= 10_000)    return "NT$" + Math.round(n / 1000) + "K";
  }
  return "NT$" + Math.round(n).toLocaleString("zh-TW");
}

function toTWD(amount: number, currency: Currency): number {
  return currency === "USD" ? amount * USD_TWD : amount;
}

function pct(n: number, dp = 2): string {
  return (n >= 0 ? "+" : "") + n.toFixed(dp) + "%";
}

function priceStr(price: number, currency: Currency): string {
  return currency === "USD"
    ? "$" + price.toFixed(price >= 100 ? 2 : 3)
    : price >= 100 ? price.toLocaleString("zh-TW", { maximumFractionDigits: 0 }) : price.toFixed(2);
}

// ─── sub-components ───────────────────────────────────────────────────────────

function SignalBadge({ signal }: { signal: Signal }) {
  const cls = signal === "買" ? "signal-buy" : signal === "賣" ? "signal-sell" : "signal-hold";
  return <span className={`inv-signal ${cls}`}>{signal}</span>;
}

function HealthBadge({ health }: { health: Health }) {
  return <span className={`inv-health inv-health-${health}`}>{health}</span>;
}

function RegionTag({ region }: { region: Region }) {
  const map: Record<Region, [string, string, string]> = {
    TW:   ["TW",   "var(--pos)",  "var(--pos-soft)"],
    US:   ["US",   "var(--info)", "color-mix(in oklab, var(--info) 12%, var(--panel))"],
    BOND: ["債",   "var(--warn)", "color-mix(in oklab, var(--warn) 12%, var(--panel))"],
  };
  const [label, color, bg] = map[region];
  return (
    <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 4, background: bg, color, letterSpacing: "0.03em", flexShrink: 0 }}>
      {label}
    </span>
  );
}

function Sparkline({ symbol, color, w = 80, h = 28 }: { symbol: string; color: string; w?: number; h?: number }) {
  const t = TICKERS[symbol]!;
  const data = useMemo(() => genHistory(symbol, 30, t.price, t.y1), [symbol, t.price, t.y1]);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", flexShrink: 0 }}>
      <path d={sparklinePath(data, w, h)} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PriceChart({ symbol, range }: { symbol: string; range: Range }) {
  const t = TICKERS[symbol]!;
  const W = 360, H = 140;
  const data = useMemo(
    () => genHistory(symbol, RANGE_POINTS[range], t.price, t.y1),
    [symbol, range, t.price, t.y1],
  );
  const isPos = data[data.length - 1]! >= data[0]!;
  const strokeColor = isPos ? "var(--pos)" : "var(--neg)";
  const fillColor = isPos ? "var(--pos-soft)" : "var(--neg-soft)";
  const { line, area } = chartPath(data, W, H);
  const min = Math.min(...data), max = Math.max(...data);
  const fmtLabel = (v: number) => t.currency === "USD" ? `$${v.toFixed(2)}` : v.toFixed(0);
  const toX = (i: number) => ((i / (data.length - 1)) * (W - 32) + 16).toFixed(1);
  const toY = (v: number) => (H - 24 - ((v - min) / Math.max(max - min, 0.001)) * (H - 48)).toFixed(1);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      <path d={area} fill={fillColor} opacity={0.25} />
      <path d={line}  fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <text x="18" y={+toY(max) - 4}  fill="var(--faint)" fontSize="9">{fmtLabel(max)}</text>
      <text x="18" y={+toY(min) + 12} fill="var(--faint)" fontSize="9">{fmtLabel(min)}</text>
      <circle cx={toX(data.length - 1)} cy={toY(t.price)} r="3" fill={strokeColor} />
    </svg>
  );
}

// ─── ticker card ──────────────────────────────────────────────────────────────

function TickerCard({
  symbol, watchlist, onWatch, onClick,
}: {
  symbol: string;
  watchlist: Set<string>;
  onWatch: (s: string) => void;
  onClick: (s: string) => void;
}) {
  const t = TICKERS[symbol]!;
  const isPos = t.dayChg >= 0;
  const sparkColor = isPos ? "var(--pos)" : "var(--neg)";
  const starred = watchlist.has(symbol);

  return (
    <div className={`inv-ticker-card${starred ? " watchlisted" : ""}`} onClick={() => onClick(symbol)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
            <RegionTag region={t.region} />
            <span className="inv-ticker-sym">{symbol}</span>
          </div>
          <div className="inv-ticker-name">{t.name}</div>
        </div>
        <SignalBadge signal={t.signal} />
      </div>

      <Sparkline symbol={symbol} color={sparkColor} w={166} h={32} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="num" style={{ fontSize: 15, fontWeight: 700 }}>{priceStr(t.price, t.currency)}</span>
        <span className={`num ${isPos ? "pos" : "neg"}`} style={{ fontSize: 12 }}>{pct(t.dayChg)}</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>
          {t.pe !== null ? `P/E ${t.pe}` : t.yld !== null ? `殖利率 ${t.yld}%` : ""}
        </span>
        <button
          className="icon-btn ghost"
          style={{ width: 22, height: 22, fontSize: 13, padding: 0 }}
          onClick={(e) => { e.stopPropagation(); onWatch(symbol); }}
          title={starred ? "移除自選" : "加入自選"}
        >
          {starred ? "★" : "☆"}
        </button>
      </div>

      <div style={{ fontSize: 10.5, color: "var(--muted)", lineHeight: 1.35 }}>{t.aiNote}</div>
    </div>
  );
}

// ─── detail drawer ────────────────────────────────────────────────────────────

function DetailDrawer({
  symbol, watchlist, onWatch, onClose,
}: {
  symbol: string | null;
  watchlist: Set<string>;
  onWatch: (s: string) => void;
  onClose: () => void;
}) {
  const [range, setRange] = useState<Range>("1Y");
  const ranges: Range[] = ["1M", "3M", "1Y", "5Y"];

  if (!symbol) return null;
  const t = TICKERS[symbol]!;
  const isPos = t.dayChg >= 0;
  const starred = watchlist.has(symbol);

  const valLabel = t.pe !== null
    ? (t.pe < 15 ? "便宜" : t.pe < 24 ? "合理" : "偏貴")
    : (t.yld !== null && t.yld > 4.5 ? "殖利率佳" : "合理");
  const valColor = (valLabel === "便宜" || valLabel === "殖利率佳") ? "var(--pos)" : valLabel === "偏貴" ? "var(--neg)" : "var(--warn)";

  const metrics = [
    { label: "P/E",  value: t.pe !== null  ? t.pe.toFixed(1)    : "—" },
    { label: "殖利率", value: t.yld !== null ? t.yld.toFixed(1) + "%" : "—" },
    { label: "AUM",  value: t.aum !== null  ? (t.aum >= 1000 ? `${(t.aum / 1000).toFixed(1)}T` : `${t.aum}B`) : "—" },
    { label: "費率",  value: t.er !== undefined ? t.er.toFixed(2) + "%" : "—" },
    { label: "52W 高", value: priceStr(t.price * 1.13, t.currency) },
    { label: "52W 低", value: priceStr(t.price * 0.77, t.currency) },
  ];

  return (
    <>
      <div className="inv-drawer-bg" onClick={onClose} />
      <div className="inv-drawer open">
        {/* header */}
        <div className="inv-drawer-head">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <RegionTag region={t.region} />
              <span className="num" style={{ fontWeight: 800, fontSize: 18 }}>{symbol}</span>
              <HealthBadge health={t.health} />
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-soft)" }}>{t.name}</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="關閉">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* price */}
        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span className="num" style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>
              {priceStr(t.price, t.currency)}
            </span>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>{t.currency}</span>
            <span className={`num ${isPos ? "pos" : "neg"}`} style={{ fontSize: 14, fontWeight: 600 }}>
              {pct(t.dayChg)}
            </span>
          </div>
          {t.currency === "USD" && (
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
              ≈ NT${Math.round(t.price * USD_TWD).toLocaleString("zh-TW")}
            </div>
          )}
        </div>

        {/* chart */}
        <div style={{ padding: "14px 20px 10px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
            {ranges.map((r) => (
              <button key={r} className={`seg-btn${range === r ? " active" : ""}`} style={{ fontSize: 11, padding: "3px 9px" }} onClick={() => setRange(r)}>{r}</button>
            ))}
          </div>
          <PriceChart symbol={symbol} range={range} />
          <div style={{ display: "flex", justifyContent: "space-around", marginTop: 10 }}>
            {(["w1", "m1", "m3", "y1"] as const).map((k) => {
              const label = { w1: "1W", m1: "1M", m3: "3M", y1: "1Y" }[k];
              const v = t[k];
              return (
                <div key={k} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 9.5, color: "var(--muted)" }}>{label}</div>
                  <div className={`num ${v >= 0 ? "pos" : "neg"}`} style={{ fontSize: 11.5, fontWeight: 600 }}>{pct(v, 1)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* metrics */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>關鍵指標</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px 6px" }}>
            {metrics.map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>{label}</div>
                <div className="num" style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* valuation + ai note */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: valColor }}>{valLabel}</span>
            <SignalBadge signal={t.signal} />
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-soft)", lineHeight: 1.5 }}>{t.aiNote}</div>
        </div>

        {/* news */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", overflowY: "auto", flex: 1, minHeight: 0 }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>近期動態</div>
          {getMockNews(symbol).map((n, i) => (
            <div key={i} style={{ padding: "8px 0", borderBottom: i < 2 ? "1px solid var(--border-soft)" : "none" }}>
              <div style={{ fontSize: 12, color: "var(--text-soft)", lineHeight: 1.45 }}>{n.title}</div>
              <div style={{ fontSize: 10, color: "var(--faint)", marginTop: 3 }}>{n.date}</div>
            </div>
          ))}
        </div>

        {/* actions */}
        <div style={{ padding: "14px 20px", display: "flex", gap: 8, flexShrink: 0, borderTop: "1px solid var(--border)", background: "var(--bg-elev)" }}>
          <button className="btn btn-sm" onClick={() => onWatch(symbol)}>
            {starred ? "★ 已自選" : "☆ 加自選"}
          </button>
          <button className="btn btn-sm btn-primary" style={{ marginLeft: "auto" }}>紀錄買入</button>
        </div>
      </div>
    </>
  );
}

// ─── main view ────────────────────────────────────────────────────────────────

export function InvestmentsView() {
  const [search, setSearch] = useState("");
  const [drawerSymbol, setDrawerSymbol] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<Set<string>>(() => new Set(["VT", "0050"]));
  const [holdingsSort, setHoldingsSort] = useState<"alloc" | "pnl">("alloc");

  const computedHoldings = useMemo(() =>
    HOLDINGS_DATA.map((h) => {
      const t = TICKERS[h.symbol]!;
      const mvLocal = t.price * h.qty;
      const mvTWD   = toTWD(mvLocal, t.currency);
      const costTWD = toTWD(h.costAvg * h.qty, t.currency);
      const pnl     = mvTWD - costTWD;
      const pnlPct  = (pnl / costTWD) * 100;
      return { ...h, t, mvTWD, pnl, pnlPct };
    }), []);

  const totalMV = useMemo(() => computedHoldings.reduce((a, h) => a + h.mvTWD, 0), [computedHoldings]);

  const sortedHoldings = useMemo(() => {
    const arr = [...computedHoldings];
    return holdingsSort === "pnl"
      ? arr.sort((a, b) => b.pnl - a.pnl)
      : arr.sort((a, b) => b.mvTWD - a.mvTWD);
  }, [computedHoldings, holdingsSort]);

  const actualAlloc = useMemo(() => {
    const byRegion: Record<string, number> = { TW: 0, US: 0, BOND: 0 };
    for (const h of computedHoldings) byRegion[h.t.region] += h.mvTWD;
    if (totalMV === 0) return { 台股: 0, 美股: 0, 債券: 0, 現金: 100 };
    const tw   = (byRegion.TW   / totalMV) * 100;
    const us   = (byRegion.US   / totalMV) * 100;
    const bond = (byRegion.BOND / totalMV) * 100;
    return { 台股: tw, 美股: us, 債券: bond, 現金: Math.max(0, 100 - tw - us - bond) };
  }, [computedHoldings, totalMV]);

  const todayPnl  = useMemo(() => computedHoldings.reduce((a, h) => a + toTWD(h.t.price * h.t.dayChg / 100 * h.qty, h.t.currency), 0), [computedHoldings]);
  const monthPnl  = useMemo(() => computedHoldings.reduce((a, h) => a + toTWD(h.t.price * h.t.m1   / 100 * h.qty, h.t.currency), 0), [computedHoldings]);
  const ret12M    = useMemo(() => {
    let cost = 0, gain = 0;
    for (const h of computedHoldings) {
      const c = toTWD(h.t.price * h.qty, h.t.currency);
      cost += c; gain += c * (h.t.y1 / 100);
    }
    return cost > 0 ? (gain / cost) * 100 : 0;
  }, [computedHoldings]);

  const healthScore: Health = useMemo(() => {
    if (totalMV === 0) return "B";
    const w = computedHoldings.reduce((a, h) => a + ({ A: 3, B: 2, C: 1 }[h.t.health]!) * (h.mvTWD / totalMV), 0);
    return w >= 2.5 ? "A" : w >= 1.8 ? "B" : "C";
  }, [computedHoldings, totalMV]);

  const toggleWatch = useCallback((s: string) => {
    setWatchlist((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return CAROUSEL_ROWS;
    return CAROUSEL_ROWS.map((row) => ({
      ...row,
      symbols: row.symbols.filter((s) =>
        s.toLowerCase().includes(q) || (TICKERS[s]?.name ?? "").toLowerCase().includes(q),
      ),
    })).filter((row) => row.symbols.length > 0);
  }, [search]);

  return (
    <main className="main">
      {/* ── topbar ── */}
      <div className="topbar">
        <div>
          <div className="crumb">投資組合</div>
          <h1 className="page-title">
            投資 <span className="page-title-sub">Holdings &amp; Markets</span>
          </h1>
        </div>
        <div className="topbar-actions">
          <div className="search" style={{ minWidth: 200 }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              placeholder="搜尋標的、名稱…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 0, fontSize: 14, lineHeight: 1, display: "flex" }}
                onClick={() => setSearch("")}
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <button className="btn">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            匯入交易
          </button>
          <button className="btn btn-primary">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            新增持股
          </button>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="kpi-strip">
        <div className="kpi-tile">
          <div className="kpi-label">投資總值</div>
          <div className="kpi-val">{fmtTWD(totalMV, true)}</div>
          <div className="kpi-foot">{computedHoldings.length} 檔持股 · TWD</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">今日 P&amp;L</div>
          <div className={`kpi-val ${todayPnl >= 0 ? "pos" : "neg"}`}>{fmtTWD(todayPnl, true)}</div>
          <div className={`kpi-trend ${todayPnl >= 0 ? "pos" : "neg"}`}>
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d={todayPnl >= 0 ? "m6 14 6-6 6 6" : "m6 10 6 6 6-6"} />
            </svg>
            {totalMV > 0 ? Math.abs((todayPnl / totalMV) * 100).toFixed(2) + "%" : "—"}
          </div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">月度 P&amp;L</div>
          <div className={`kpi-val ${monthPnl >= 0 ? "pos" : "neg"}`}>{fmtTWD(monthPnl, true)}</div>
          <div className={`kpi-trend ${monthPnl >= 0 ? "pos" : "neg"}`}>
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d={monthPnl >= 0 ? "m6 14 6-6 6 6" : "m6 10 6 6 6-6"} />
            </svg>
            {totalMV > 0 ? Math.abs((monthPnl / totalMV) * 100).toFixed(2) + "%" : "—"}
          </div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">12M 報酬率</div>
          <div className={`kpi-val ${ret12M >= 0 ? "pos" : "neg"}`}>{pct(ret12M, 1)}</div>
          <div className="kpi-foot">加權平均</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">健康評分</div>
          <div className="kpi-val" style={{ color: healthScore === "A" ? "var(--pos)" : healthScore === "B" ? "var(--warn)" : "var(--neg)" }}>
            {healthScore}
          </div>
          <div className="kpi-foot">配置 × 集中度 × 估值</div>
        </div>
      </div>

      {/* ── allocation gap ── */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">配置缺口</div>
            <div className="card-sub muted">Robo 建議 vs. 目前持有</div>
          </div>
          <button className="btn btn-sm">依此再平衡</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Robo 目標</div>
            <div className="inv-alloc-bar">
              {ALLOC_CATS.map((cat) => (
                <div key={cat} className="inv-alloc-seg" style={{ width: `${TARGET_ALLOC[cat]}%`, background: ALLOC_COLORS[cat] }}>
                  {TARGET_ALLOC[cat]! >= 8 ? `${cat} ${TARGET_ALLOC[cat]}%` : ""}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>目前持有</div>
            <div className="inv-alloc-bar">
              {ALLOC_CATS.map((cat) => {
                const v = actualAlloc[cat];
                return (
                  <div key={cat} className="inv-alloc-seg" style={{ width: `${v}%`, background: ALLOC_COLORS[cat], opacity: 0.68 }}>
                    {v >= 8 ? v.toFixed(0) + "%" : ""}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["類別", "建議", "目前", "差距", "本月行動"].map((label, i) => (
                  <th key={label} style={{
                    fontSize: 10.5, fontWeight: 600, color: "var(--muted)",
                    textTransform: "uppercase", letterSpacing: "0.05em",
                    padding: "0 8px 8px", textAlign: i === 0 ? "left" : "right", whiteSpace: "nowrap",
                  }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALLOC_CATS.map((cat) => {
                const target = TARGET_ALLOC[cat]!;
                const actual = actualAlloc[cat];
                const gap = actual - target;
                const action = Math.abs(gap) < 2.5 ? "持平" : gap > 0 ? "減碼" : "加碼";
                const actionColor = action === "加碼" ? "var(--pos)" : action === "減碼" ? "var(--neg)" : "var(--muted)";
                return (
                  <tr key={cat}>
                    <td style={{ padding: "8px 8px", borderTop: "1px solid var(--border-soft)", textAlign: "left" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 99, background: ALLOC_COLORS[cat], display: "inline-block", flexShrink: 0 }} />
                        {cat}
                      </span>
                    </td>
                    <td className="num" style={{ padding: "8px 8px", borderTop: "1px solid var(--border-soft)", textAlign: "right" }}>{target}%</td>
                    <td className="num" style={{ padding: "8px 8px", borderTop: "1px solid var(--border-soft)", textAlign: "right" }}>{actual.toFixed(1)}%</td>
                    <td className={`num ${Math.abs(gap) < 2.5 ? "muted" : gap > 0 ? "neg" : "pos"}`} style={{ padding: "8px 8px", borderTop: "1px solid var(--border-soft)", textAlign: "right" }}>
                      {Math.abs(gap) < 0.1 ? "—" : pct(gap, 1)}
                    </td>
                    <td style={{ padding: "8px 8px", borderTop: "1px solid var(--border-soft)", textAlign: "right", color: actionColor, fontWeight: 700, fontSize: 12 }}>
                      {action}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── holdings ── */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">持有部位</div>
            <div className="card-sub muted">總市值 {fmtTWD(totalMV, true)} · USD/TWD @{USD_TWD}</div>
          </div>
          <div className="seg">
            <button className={`seg-btn${holdingsSort === "alloc" ? " active" : ""}`} onClick={() => setHoldingsSort("alloc")}>配置</button>
            <button className={`seg-btn${holdingsSort === "pnl"   ? " active" : ""}`} onClick={() => setHoldingsSort("pnl")}>損益</button>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="inv-holdings-table">
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>標的</th>
                <th>持有量</th>
                <th>成本均價</th>
                <th>現價</th>
                <th>市值 TWD</th>
                <th>未實現損益</th>
                <th>配置</th>
                <th>走勢</th>
              </tr>
            </thead>
            <tbody>
              {sortedHoldings.map((h) => {
                const allocPct = totalMV > 0 ? (h.mvTWD / totalMV) * 100 : 0;
                return (
                  <tr key={h.symbol} className="inv-holdings-row" onClick={() => setDrawerSymbol(h.symbol)}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <RegionTag region={h.t.region} />
                        <div>
                          <div className="num" style={{ fontWeight: 700, fontSize: 13 }}>{h.symbol}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>{h.t.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="num">{h.qty.toLocaleString("zh-TW")}</td>
                    <td className="num">{priceStr(h.costAvg, h.t.currency)}</td>
                    <td className="num">{priceStr(h.t.price, h.t.currency)}</td>
                    <td className="num">{fmtTWD(h.mvTWD, true)}</td>
                    <td>
                      <div className={`num ${h.pnl >= 0 ? "pos" : "neg"}`} style={{ fontSize: 12, textAlign: "right" }}>{fmtTWD(h.pnl, true)}</div>
                      <div className={`num ${h.pnlPct >= 0 ? "pos" : "neg"}`} style={{ fontSize: 10.5, textAlign: "right" }}>{pct(h.pnlPct, 1)}</div>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                        <span className="num" style={{ fontSize: 12 }}>{allocPct.toFixed(1)}%</span>
                        <div style={{ width: 36, height: 4, borderRadius: 99, background: "var(--border-strong)", overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(100, allocPct * 3)}%`, height: "100%", background: "var(--accent)", borderRadius: 99 }} />
                        </div>
                      </div>
                    </td>
                    <td>
                      <Sparkline symbol={h.symbol} color={h.pnl >= 0 ? "var(--pos)" : "var(--neg)"} w={58} h={22} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── recommendations ── */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">推薦標的</div>
            <div className="card-sub muted">三色燈號：健康評分 × 估值 × 配置缺口</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {filteredRows.map((row) => (
            <div key={row.label}>
              <div className="inv-carousel-label">{row.label}</div>
              <div className="inv-carousel-track">
                {row.symbols.map((s) => (
                  <TickerCard
                    key={s}
                    symbol={s}
                    watchlist={watchlist}
                    onWatch={toggleWatch}
                    onClick={setDrawerSymbol}
                  />
                ))}
              </div>
            </div>
          ))}
          {filteredRows.length === 0 && (
            <div style={{ color: "var(--muted)", fontSize: 13, padding: "24px 0", textAlign: "center" }}>
              找不到符合「{search}」的標的
            </div>
          )}
        </div>
      </div>

      {/* ── watchlist ── */}
      {watchlist.size > 0 && (
        <div className="card">
          <div className="card-head">
            <div className="card-title">
              自選股{" "}
              <span style={{ fontSize: 12, fontWeight: 400, color: "var(--muted)" }}>{watchlist.size} 檔</span>
            </div>
          </div>
          <div>
            {[...watchlist].map((s) => {
              const t = TICKERS[s];
              if (!t) return null;
              const isPos = t.dayChg >= 0;
              return (
                <div key={s} className="inv-watchlist-item" onClick={() => setDrawerSymbol(s)}>
                  <RegionTag region={t.region} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="num" style={{ fontWeight: 700, fontSize: 13 }}>{s}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                  </div>
                  <span className="num" style={{ fontSize: 14, fontWeight: 600 }}>{priceStr(t.price, t.currency)}</span>
                  <span className={`num ${isPos ? "pos" : "neg"}`} style={{ fontSize: 12, minWidth: 54, textAlign: "right" }}>{pct(t.dayChg)}</span>
                  <SignalBadge signal={t.signal} />
                  <button
                    className="icon-btn ghost"
                    style={{ width: 24, height: 24, flexShrink: 0 }}
                    onClick={(e) => { e.stopPropagation(); toggleWatch(s); }}
                    title="移除自選"
                  >
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── AI advisor banner ── */}
      <div className="inv-advisor-banner">
        <div style={{ width: 42, height: 42, borderRadius: 10, background: "var(--accent-soft)", border: "1px solid color-mix(in oklab, var(--accent) 35%, var(--border))", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>AI 投資顧問</div>
          <div style={{ fontSize: 12, color: "var(--text-soft)", marginTop: 3, lineHeight: 1.4 }}>
            Robo Advisor 提供完整財務規劃與資產配置建議，含 PFIC 規則、Schwab 操作與多目標最佳化。
          </div>
        </div>
        <Link href="/goals" className="btn btn-primary" style={{ flexShrink: 0, textDecoration: "none" }}>
          開啟顧問
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* ── detail drawer ── */}
      <DetailDrawer
        symbol={drawerSymbol}
        watchlist={watchlist}
        onWatch={toggleWatch}
        onClose={() => setDrawerSymbol(null)}
      />
    </main>
  );
}
