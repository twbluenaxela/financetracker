"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NewsItem } from "@/app/api/quotes/news/route";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CAROUSEL_ROWS } from "@/lib/ticker-meta";

// ─── constants ───────────────────────────────────────────────────────────────

const USD_TWD_FALLBACK = 31.5;

// ─── types ────────────────────────────────────────────────────────────────────

type Region = "TW" | "US" | "BOND";
type Currency = "TWD" | "USD";
type Signal = "買" | "守" | "賣";
type Health = "A" | "B" | "C";
type Range = "1M" | "3M" | "1Y" | "5Y";

export type Ticker = {
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
  high52w: number;
  low52w: number;
  health: Health;
  signal: Signal;
  aiNote: string;
};

type HoldingRow = { id: number; symbol: string; qty: number; costAvg: number; currency: string };

const TARGET_ALLOC: Record<string, number> = { 台股: 25, 美股: 45, 債券: 20, 現金: 10 };
const ALLOC_CATS = ["台股", "美股", "債券", "現金"] as const;
const ALLOC_COLORS: Record<string, string> = {
  台股: "var(--pos)", 美股: "var(--info)", 債券: "var(--warn)", 現金: "var(--faint)",
};


// ─── helpers ──────────────────────────────────────────────────────────────────

const RANGE_POINTS: Record<Range, number> = { "1M": 22, "3M": 65, "1Y": 252, "5Y": 260 };

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

function toTWD(amount: number, currency: Currency, rate: number): number {
  return currency === "USD" ? amount * rate : amount;
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

function Sparkline({ symbol, color, w = 80, h = 28, tickers, historyMap }: {
  symbol: string;
  color: string;
  w?: number;
  h?: number;
  tickers: Record<string, Ticker>;
  historyMap: Record<string, number[]>;
}) {
  const data = useMemo(() => {
    const hist = historyMap[symbol] ?? [];
    if (hist.length >= 2) return hist.slice(-30);
    // fallback: flat line at current price
    const t = tickers[symbol];
    const price = t?.price ?? 1;
    return Array(30).fill(price);
  }, [symbol, tickers, historyMap]);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", flexShrink: 0 }}>
      <path d={sparklinePath(data, w, h)} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PriceChart({ symbol, range, tickers, historyMap }: {
  symbol: string;
  range: Range;
  tickers: Record<string, Ticker>;
  historyMap: Record<string, number[]>;
}) {
  const t = tickers[symbol]!;
  const W = 360, H = 140;
  const points = RANGE_POINTS[range];
  const data = useMemo(() => {
    const hist = historyMap[symbol] ?? [];
    if (hist.length >= 2) return hist.slice(-points);
    const price = t?.price ?? 1;
    return Array(Math.min(points, 10)).fill(price);
  }, [symbol, range, historyMap, t?.price, points]);
  const isPos = data[data.length - 1]! >= data[0]!;
  const strokeColor = isPos ? "var(--pos)" : "var(--neg)";
  const fillColor = isPos ? "var(--pos-soft)" : "var(--neg-soft)";
  const { line, area } = chartPath(data, W, H);
  const min = Math.min(...data), max = Math.max(...data);
  const fmtLabel = (v: number) => t?.currency === "USD" ? `$${v.toFixed(2)}` : v.toFixed(0);
  const toX = (i: number) => ((i / (data.length - 1)) * (W - 32) + 16).toFixed(1);
  const toY = (v: number) => (H - 24 - ((v - min) / Math.max(max - min, 0.001)) * (H - 48)).toFixed(1);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      <path d={area} fill={fillColor} opacity={0.25} />
      <path d={line}  fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <text x="18" y={+toY(max) - 4}  fill="var(--faint)" fontSize="9">{fmtLabel(max)}</text>
      <text x="18" y={+toY(min) + 12} fill="var(--faint)" fontSize="9">{fmtLabel(min)}</text>
      <circle cx={toX(data.length - 1)} cy={toY(t?.price ?? 0)} r="3" fill={strokeColor} />
    </svg>
  );
}

// ─── ticker card ──────────────────────────────────────────────────────────────

function TickerCard({
  symbol, watchlist, onWatch, onClick, tickers, historyMap,
}: {
  symbol: string;
  watchlist: Set<string>;
  onWatch: (s: string) => void;
  onClick: (s: string) => void;
  tickers: Record<string, Ticker>;
  historyMap: Record<string, number[]>;
}) {
  const t = tickers[symbol];
  if (!t) return null;
  const hasData = t.price > 0;
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

      <Sparkline symbol={symbol} color={sparkColor} w={166} h={32} tickers={tickers} historyMap={historyMap} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        {hasData ? (
          <>
            <span className="num" style={{ fontSize: 15, fontWeight: 700 }}>{priceStr(t.price, t.currency)}</span>
            <span className={`num ${isPos ? "pos" : "neg"}`} style={{ fontSize: 12 }}>{pct(t.dayChg)}</span>
          </>
        ) : (
          <span style={{ fontSize: 12, color: "var(--faint)" }}>報價待更新</span>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>
          {hasData && (t.pe !== null ? `P/E ${t.pe}` : t.yld !== null ? `殖利率 ${t.yld}%` : "")}
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
  symbol, watchlist, onWatch, onClose, onBuy, tickers, historyMap, usdTwd,
}: {
  symbol: string | null;
  watchlist: Set<string>;
  onWatch: (s: string) => void;
  onClose: () => void;
  onBuy: (symbol: string) => void;
  tickers: Record<string, Ticker>;
  historyMap: Record<string, number[]>;
  usdTwd: number;
}) {
  const [range, setRange] = useState<Range>("1Y");
  const ranges: Range[] = ["1M", "3M", "1Y", "5Y"];

  const [news, setNews]           = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const fetchedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!symbol || fetchedFor.current === symbol) return;
    fetchedFor.current = symbol;
    setNews([]);
    setNewsLoading(true);
    fetch(`/api/quotes/news?symbol=${encodeURIComponent(symbol)}`)
      .then((r) => r.ok ? r.json() : { news: [] })
      .then((data: { news: NewsItem[] }) => setNews(data.news ?? []))
      .catch(() => setNews([]))
      .finally(() => setNewsLoading(false));
  }, [symbol]);

  if (!symbol) return null;
  const t = tickers[symbol]!;
  const hasData = t.price > 0;
  const isPos = t.dayChg >= 0;
  const starred = watchlist.has(symbol);

  const valLabel = !hasData
    ? "待更新"
    : t.pe !== null
      ? (t.pe < 15 ? "便宜" : t.pe < 24 ? "合理" : "偏貴")
      : (t.yld !== null && t.yld > 4.5 ? "殖利率佳" : "合理");
  const valColor = (!hasData || valLabel === "合理") ? "var(--warn)" : (valLabel === "便宜" || valLabel === "殖利率佳") ? "var(--pos)" : valLabel === "偏貴" ? "var(--neg)" : "var(--muted)";

  const metrics = [
    { label: "P/E",  value: t.pe !== null  ? t.pe.toFixed(1)    : "—" },
    { label: "殖利率", value: t.yld !== null ? t.yld.toFixed(1) + "%" : "—" },
    { label: "AUM",  value: t.aum !== null  ? (t.aum >= 1000 ? `${(t.aum / 1000).toFixed(1)}T` : `${t.aum}B`) : "—" },
    { label: "費率",  value: t.er !== undefined ? t.er.toFixed(2) + "%" : "—" },
    { label: "52W 高", value: hasData ? priceStr(t.high52w, t.currency) : "—" },
    { label: "52W 低", value: hasData ? priceStr(t.low52w, t.currency) : "—" },
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
          {hasData ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span className="num" style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>
              {priceStr(t.price, t.currency)}
            </span>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>{t.currency}</span>
            <span className={`num ${isPos ? "pos" : "neg"}`} style={{ fontSize: 14, fontWeight: 600 }}>
              {pct(t.dayChg)}
            </span>
          </div>
          ) : (
            <div style={{ fontSize: 13, color: "var(--faint)" }}>報價尚未載入，請點擊「更新報價」</div>
          )}
          {hasData && t.currency === "USD" && (
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
              ≈ NT${Math.round(t.price * usdTwd).toLocaleString("zh-TW")}
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
          <PriceChart symbol={symbol} range={range} tickers={tickers} historyMap={historyMap} />
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
          {newsLoading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ padding: "8px 0", borderBottom: i < 3 ? "1px solid var(--border-soft)" : "none" }}>
                  <div style={{ height: 12, borderRadius: 4, background: "var(--border-strong)", width: "90%", marginBottom: 6 }} />
                  <div style={{ height: 10, borderRadius: 4, background: "var(--border-strong)", width: "60%" }} />
                </div>
              ))}
            </div>
          )}
          {!newsLoading && news.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--faint)", padding: "8px 0" }}>暫無相關新聞</div>
          )}
          {!newsLoading && news.map((n, i) => (
            <div key={i} style={{ padding: "8px 0", borderBottom: i < news.length - 1 ? "1px solid var(--border-soft)" : "none" }}>
              <a
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: "var(--text-soft)", lineHeight: 1.45, textDecoration: "none", display: "block" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-soft)")}
              >
                {n.title}
              </a>
              <div style={{ fontSize: 10, color: "var(--faint)", marginTop: 3 }}>
                {n.source} · {new Date(n.publishedAt).toLocaleDateString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          ))}
        </div>

        {/* actions */}
        <div style={{ padding: "14px 20px", display: "flex", gap: 8, flexShrink: 0, borderTop: "1px solid var(--border)", background: "var(--bg-elev)" }}>
          <button className="btn btn-sm" onClick={() => onWatch(symbol)}>
            {starred ? "★ 已自選" : "☆ 加自選"}
          </button>
          <button className="btn btn-sm btn-primary" style={{ marginLeft: "auto" }} onClick={() => { onBuy(symbol); onClose(); }}>
            + 紀錄買入
          </button>
        </div>
      </div>
    </>
  );
}

// ─── add/edit holding modal ───────────────────────────────────────────────────

function HoldingModal({
  existing,
  defaultSymbol,
  onClose,
  onSaved,
  onDeleted,
  tickers,
}: {
  existing: HoldingRow | null;
  defaultSymbol?: string;
  onClose: () => void;
  onSaved: (h: HoldingRow) => void;
  onDeleted?: (id: number) => void;
  tickers: Record<string, Ticker>;
}) {
  const [symbol, setSymbol]   = useState(existing?.symbol ?? defaultSymbol ?? "");
  const [qty,    setQty]      = useState(existing ? String(existing.qty) : "");
  const [cost,   setCost]     = useState(existing ? String(existing.costAvg) : "");
  const [saving, setSaving]   = useState(false);
  const [error,  setError]    = useState<string | null>(null);

  const symbolOptions = Object.entries(tickers).map(([sym, t]) => ({
    sym, label: `${sym} · ${t.name}`, currency: t.currency,
  }));

  const symUp = symbol.trim().toUpperCase();
  const ticker = tickers[symUp];
  const currency: "TWD" | "USD" = ticker?.currency ?? (existing?.currency as "TWD" | "USD") ?? "TWD";
  const currencyLabel = currency === "USD" ? "USD ($)" : "TWD (NT$)";

  async function handleSave() {
    const qtyNum  = parseFloat(qty.replace(/,/g, ""));
    const costNum = parseFloat(cost.replace(/,/g, ""));
    if (!symUp || isNaN(qtyNum) || qtyNum <= 0 || isNaN(costNum) || costNum <= 0) {
      setError("請填寫所有欄位（數量與成本均需大於 0）");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/holdings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: symUp, qty: qtyNum, costAvg: costNum, currency }),
    });
    if (!res.ok) { setError("儲存失敗，請稍後再試"); setSaving(false); return; }
    const data = await res.json();
    onSaved(data.holding as HoldingRow);
    onClose();
  }

  async function handleDelete() {
    if (!existing || !onDeleted) return;
    if (!window.confirm(`確定要刪除 ${existing.symbol} 持倉？`)) return;
    setSaving(true);
    await fetch(`/api/holdings/${existing.id}`, { method: "DELETE" });
    onDeleted(existing.id);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <div className="crumb">投資組合</div>
            <h2 className="modal-title">{existing ? "編輯持倉" : "新增持倉"}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="關閉">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="modal-body">
          <div className="ff-group">
            <label className="ff-label">標的代號</label>
            <input
              className="ff-input"
              list="holding-symbols"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="例：0050、VT、BNDW"
              disabled={!!existing}
              style={existing ? { opacity: 0.6 } : {}}
            />
            <datalist id="holding-symbols">
              {symbolOptions.map((o) => (
                <option key={o.sym} value={o.sym}>{o.label}</option>
              ))}
            </datalist>
            {ticker && (
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
                {ticker.name} · {currencyLabel} · 現價 {priceStr(ticker.price, ticker.currency)}
              </div>
            )}
          </div>

          <div className="ff-row-2">
            <div className="ff-group">
              <label className="ff-label">持有數量</label>
              <input
                className="ff-input num"
                type="number"
                min="0"
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="例：100"
              />
            </div>
            <div className="ff-group">
              <label className="ff-label">成本均價 ({currency})</label>
              <input
                className="ff-input num"
                type="number"
                min="0"
                step="any"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder={currency === "USD" ? "例：96.40" : "例：145.20"}
              />
            </div>
          </div>

          {error && <div style={{ fontSize: 12, color: "var(--neg)", marginTop: 4 }}>{error}</div>}
        </div>

        <div className="modal-foot">
          {existing && onDeleted && (
            <button className="btn btn-sm" style={{ color: "var(--neg)", borderColor: "var(--neg-soft)" }} type="button" onClick={handleDelete} disabled={saving}>
              刪除
            </button>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="btn btn-sm" type="button" onClick={onClose}>取消</button>
            <button className="btn btn-sm btn-primary" type="button" onClick={handleSave} disabled={saving}>
              {saving ? "儲存中…" : "儲存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── rebalance modal ──────────────────────────────────────────────────────────

function RebalanceModal({
  onClose,
  totalMV,
  actualAlloc,
  computedHoldings,
  onBuy,
}: {
  onClose: () => void;
  totalMV: number;
  actualAlloc: Record<string, number>;
  computedHoldings: { symbol: string; t: Ticker; mvTWD: number; pnl: number; pnlPct: number; qty: number; costAvg: number; currency: string; id: number }[];
  onBuy: (sym: string) => void;
}) {
  const TARGET_ALLOC_LOCAL: Record<string, number> = { 台股: 25, 美股: 45, 債券: 20, 現金: 10 };
  const ALLOC_CATS_LOCAL = ["台股", "美股", "債券", "現金"] as const;
  const REGION_CAT: Record<string, string> = { TW: "台股", US: "美股", BOND: "債券" };

  // Core tickers to suggest buying per category (in preference order)
  const BUY_SUGGEST: Record<string, string[]> = {
    台股: ["0050", "006208"],
    美股: ["VT", "VOO"],
    債券: ["BNDW", "BND"],
  };

  const rows = ALLOC_CATS_LOCAL.map((cat) => {
    const target = TARGET_ALLOC_LOCAL[cat]!;
    const actual = actualAlloc[cat] ?? 0;
    const gapPct = target - actual;
    const gapTWD = (gapPct / 100) * totalMV;

    // Suggest a ticker to buy/sell
    let suggest: string | null = null;
    if (gapPct > 2) {
      suggest = BUY_SUGGEST[cat]?.[0] ?? null;
    } else if (gapPct < -2) {
      // Suggest trimming the largest holding in this category
      const inCat = computedHoldings
        .filter((h) => REGION_CAT[h.t.region] === cat)
        .sort((a, b) => b.mvTWD - a.mvTWD);
      suggest = inCat[0]?.symbol ?? null;
    }

    return { cat, target, actual, gapPct, gapTWD, suggest };
  });

  const hasAction = rows.some((r) => Math.abs(r.gapPct) >= 2.5);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <div className="crumb">投資組合</div>
            <h2 className="modal-title">再平衡建議</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="關閉">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="modal-body" style={{ padding: 0 }}>
          {!hasAction && (
            <div style={{ padding: "24px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              配置已接近目標，暫無再平衡需求。
            </div>
          )}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["類別", "目標", "目前", "差距金額", "建議操作"].map((h, i) => (
                  <th key={h} style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "12px 16px 8px", textAlign: i === 0 ? "left" : "right", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ cat, target, actual, gapPct, gapTWD, suggest }) => {
                const neutral = Math.abs(gapPct) < 2.5;
                const buying  = gapPct >= 2.5;
                const action  = neutral ? "持平" : buying ? `加碼 ${suggest ?? ""}` : `減碼 ${suggest ?? ""}`;
                const actionColor = neutral ? "var(--muted)" : buying ? "var(--pos)" : "var(--neg)";
                return (
                  <tr key={cat}>
                    <td style={{ padding: "10px 16px", borderTop: "1px solid var(--border-soft)", textAlign: "left", fontWeight: 500 }}>{cat}</td>
                    <td className="num" style={{ padding: "10px 16px", borderTop: "1px solid var(--border-soft)", textAlign: "right", color: "var(--muted)" }}>{target}%</td>
                    <td className="num" style={{ padding: "10px 16px", borderTop: "1px solid var(--border-soft)", textAlign: "right" }}>{actual.toFixed(1)}%</td>
                    <td className={`num ${neutral ? "muted" : buying ? "pos" : "neg"}`} style={{ padding: "10px 16px", borderTop: "1px solid var(--border-soft)", textAlign: "right" }}>
                      {neutral ? "—" : (buying ? "+" : "") + "NT$" + Math.abs(Math.round(gapTWD)).toLocaleString("zh-TW")}
                    </td>
                    <td style={{ padding: "10px 16px", borderTop: "1px solid var(--border-soft)", textAlign: "right" }}>
                      {!neutral && suggest ? (
                        <button
                          className="btn btn-sm"
                          style={{ fontSize: 11, color: actionColor, borderColor: neutral ? undefined : actionColor, opacity: 0.9 }}
                          onClick={() => { onClose(); onBuy(suggest); }}
                        >
                          {action}
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, color: actionColor, fontWeight: 700 }}>{action}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-soft)", fontSize: 11, color: "var(--faint)", lineHeight: 1.5 }}>
            差距金額 = 缺口百分比 × 投資組合總市值。點擊加碼／減碼直接開啟新增持倉表單。
          </div>
        </div>

        <div className="modal-foot">
          <div style={{ marginLeft: "auto" }}>
            <button className="btn btn-sm" onClick={onClose}>關閉</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── main view ────────────────────────────────────────────────────────────────

export function InvestmentsView({
  initialHoldings,
  tickers,
  historyMap,
  quotesUpdatedAt,
  usdTwd: usdTwdProp,
}: {
  initialHoldings: HoldingRow[];
  tickers: Record<string, Ticker>;
  historyMap: Record<string, number[]>;
  quotesUpdatedAt: string | null;
  usdTwd: number;
}) {
  const USD_TWD = usdTwdProp > 0 ? usdTwdProp : USD_TWD_FALLBACK;
  const router = useRouter();
  const [holdings, setHoldings]           = useState<HoldingRow[]>(initialHoldings);
  const [search, setSearch]               = useState("");
  const [drawerSymbol, setDrawerSymbol]   = useState<string | null>(null);
  const [watchlist, setWatchlist]         = useState<Set<string>>(() => new Set(["VT", "0050"]));
  const [holdingsSort, setHoldingsSort]   = useState<"alloc" | "pnl">("alloc");
  const [modalOpen, setModalOpen]             = useState(false);
  const [editingHolding, setEditingHolding]   = useState<HoldingRow | null>(null);
  const [modalDefaultSym, setModalDefaultSym] = useState<string | undefined>(undefined);
  const [rebalanceOpen, setRebalanceOpen]     = useState(false);
  const [refreshing, setRefreshing]           = useState(false);
  const [lastUpdated, setLastUpdated]         = useState<string | null>(quotesUpdatedAt);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/quotes/refresh", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setLastUpdated(data.updatedAt);
        router.refresh();
      }
    } finally {
      setRefreshing(false);
    }
  }

  function openAdd(sym?: string) { setEditingHolding(null); setModalDefaultSym(sym); setModalOpen(true); }
  function openEdit(h: HoldingRow) { setEditingHolding(h); setModalDefaultSym(undefined); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditingHolding(null); setModalDefaultSym(undefined); }

  function handleSaved(h: HoldingRow) {
    setHoldings((prev) => {
      const idx = prev.findIndex((x) => x.id === h.id || x.symbol === h.symbol);
      if (idx >= 0) { const next = [...prev]; next[idx] = h; return next; }
      return [...prev, h];
    });
    router.refresh();
  }

  function handleDeleted(id: number) {
    setHoldings((prev) => prev.filter((x) => x.id !== id));
    router.refresh();
  }

  const computedHoldings = useMemo(() =>
    holdings.filter((h) => tickers[h.symbol]).map((h) => {
      const t = tickers[h.symbol]!;
      const mvLocal = t.price * h.qty;
      const mvTWD   = toTWD(mvLocal, t.currency, USD_TWD);
      const costTWD = toTWD(h.costAvg * h.qty, t.currency, USD_TWD);
      const pnl     = mvTWD - costTWD;
      const pnlPct  = (pnl / costTWD) * 100;
      return { ...h, t, mvTWD, pnl, pnlPct };
    }), [holdings]);

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

  const todayPnl  = useMemo(() => computedHoldings.reduce((a, h) => a + toTWD(h.t.price * h.t.dayChg / 100 * h.qty, h.t.currency, USD_TWD), 0), [computedHoldings]);
  const monthPnl  = useMemo(() => computedHoldings.reduce((a, h) => a + toTWD(h.t.price * h.t.m1   / 100 * h.qty, h.t.currency, USD_TWD), 0), [computedHoldings]);
  const ret12M    = useMemo(() => {
    let cost = 0, gain = 0;
    for (const h of computedHoldings) {
      const c = toTWD(h.t.price * h.qty, h.t.currency, USD_TWD);
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
        s.toLowerCase().includes(q) || (tickers[s]?.name ?? "").toLowerCase().includes(q),
      ),
    })).filter((row) => row.symbols.length > 0);
  }, [search, tickers]);

  return (
    <main className="main">
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      {/* ── topbar ── */}
      <div className="topbar">
        <div>
          <div className="crumb">投資組合</div>
          <h1 className="page-title">
            投資 <span className="page-title-sub">Holdings &amp; Markets</span>
          </h1>
        </div>
        <div className="topbar-actions">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {lastUpdated && (
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                最後更新 {new Date(lastUpdated).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <button className="btn" onClick={handleRefresh} disabled={refreshing}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={refreshing ? { animation: "spin 1s linear infinite" } : {}}>
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M8 16H3v5" />
              </svg>
              {refreshing ? "更新中…" : "更新報價"}
            </button>
          </div>
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
          <button className="btn btn-primary" onClick={() => openAdd()}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            新增持倉
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
          <button className="btn btn-sm" onClick={() => setRebalanceOpen(true)} disabled={totalMV === 0}>依此再平衡</button>
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
            <div className="card-sub muted">總市值 {fmtTWD(totalMV, true)} · USD/TWD @{USD_TWD.toFixed(2)}</div>
          </div>
          <div className="seg">
            <button className={`seg-btn${holdingsSort === "alloc" ? " active" : ""}`} onClick={() => setHoldingsSort("alloc")}>配置</button>
            <button className={`seg-btn${holdingsSort === "pnl"   ? " active" : ""}`} onClick={() => setHoldingsSort("pnl")}>損益</button>
          </div>
        </div>
        {sortedHoldings.length === 0 ? (
          <div style={{ padding: "32px 0", textAlign: "center", color: "var(--muted)" }}>
            <div style={{ fontSize: 14, marginBottom: 10 }}>尚未新增任何持倉</div>
            <button className="btn btn-primary btn-sm" onClick={() => openAdd()}>+ 新增第一筆持倉</button>
          </div>
        ) : (
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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedHoldings.map((h) => {
                  const allocPct = totalMV > 0 ? (h.mvTWD / totalMV) * 100 : 0;
                  return (
                    <tr key={h.symbol} className="inv-holdings-row" onClick={() => setDrawerSymbol(h.symbol)}>
                      <td style={{ textAlign: "left" }}>
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
                        <Sparkline symbol={h.symbol} color={h.pnl >= 0 ? "var(--pos)" : "var(--neg)"} w={58} h={22} tickers={tickers} historyMap={historyMap} />
                      </td>
                      <td>
                        <button
                          className="icon-btn ghost"
                          style={{ width: 24, height: 24, opacity: 0.5 }}
                          onClick={(e) => { e.stopPropagation(); openEdit(h); }}
                          title="編輯持倉"
                        >
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
                    tickers={tickers}
                    historyMap={historyMap}
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
              const t = tickers[s];
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
        onBuy={(sym) => { setDrawerSymbol(null); openAdd(sym); }}
        tickers={tickers}
        historyMap={historyMap}
        usdTwd={USD_TWD}
      />

      {/* ── rebalance modal ── */}
      {rebalanceOpen && (
        <RebalanceModal
          onClose={() => setRebalanceOpen(false)}
          totalMV={totalMV}
          actualAlloc={actualAlloc}
          computedHoldings={computedHoldings}
          onBuy={(sym) => { setRebalanceOpen(false); openAdd(sym); }}
        />
      )}

      {/* ── add/edit holding modal ── */}
      {modalOpen && (
        <HoldingModal
          existing={editingHolding}
          defaultSymbol={modalDefaultSym}
          onClose={closeModal}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          tickers={tickers}
        />
      )}
    </main>
  );
}
