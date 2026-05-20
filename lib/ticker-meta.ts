export type Region = "TW" | "US" | "BOND";
export type Health = "A" | "B" | "C";
export type Signal = "買" | "守" | "賣";

export type TickerMeta = {
  name: string;
  region: Region;
  er?: number;
  aiNote: string;
};

export const TICKER_META: Record<string, TickerMeta> = {
  "0050":   { name: "元大台灣50",             region: "TW",   er: 0.43, aiNote: "台灣大盤核心，長期定期定額首選" },
  "006208": { name: "富邦台50",               region: "TW",   er: 0.09, aiNote: "0050 費率更低替代，長期績效近乎相同" },
  "0056":   { name: "元大高股息",             region: "TW",   er: 0.34, aiNote: "高息但成長較慢，適合退休族配置" },
  "00878":  { name: "國泰永續高股息",         region: "TW",   er: 0.16, aiNote: "ESG 篩選 + 高息，配置偏防守" },
  "VT":     { name: "Vanguard Total World",   region: "US",   er: 0.07, aiNote: "全球分散首選，費率超低，Bogleheads 核心持股" },
  "VOO":    { name: "Vanguard S&P 500",       region: "US",   er: 0.03, aiNote: "標普 500 大盤 ETF，費率極低" },
  "VTI":    { name: "Vanguard Total US",      region: "US",   er: 0.03, aiNote: "美國全市場，含更多中小型股" },
  "QQQ":    { name: "Invesco Nasdaq-100",     region: "US",   er: 0.20, aiNote: "科技集中，高波動高報酬，適合衛星部位" },
  "SMH":    { name: "VanEck Semiconductor",   region: "US",   er: 0.35, aiNote: "半導體主題，台積電受益，高波動高報酬" },
  "SOXX":   { name: "iShares Semiconductor",  region: "US",   er: 0.35, aiNote: "SMH 替代選擇，覆蓋範圍更廣" },
  "XLK":    { name: "Technology Select SPDR", region: "US",   er: 0.08, aiNote: "AAPL+MSFT 集中度高，注意估值風險" },
  "AIQ":    { name: "Global X AI & Tech",     region: "US",   er: 0.68, aiNote: "AI 主題分散尚可，費率偏高需注意" },
  "BND":    { name: "Vanguard Total Bond",    region: "BOND", er: 0.03, aiNote: "美國全債市，降息環境受益，防禦性核心" },
  "BNDW":   { name: "Vanguard World Bond",    region: "BOND", er: 0.05, aiNote: "全球債券分散，利率風險更低" },
  "00679B": { name: "元大美債20年",           region: "BOND", er: 0.15, aiNote: "長債波動大，降息有利但時機難抓" },
  "TLT":    { name: "iShares 20+ Treasury",   region: "BOND", er: 0.15, aiNote: "20年期美債，高利率環境下波動顯著" },
  "2330":   { name: "台積電",                 region: "TW",             aiNote: "AI 受惠龍頭，留意估值與地緣風險" },
  "2454":   { name: "聯發科",                 region: "TW",             aiNote: "手機 AP 龍頭，AI 邊緣端受益" },
  "2412":   { name: "中華電信",               region: "TW",             aiNote: "高殖利率防禦股，成長動能有限" },
};

export const ALL_SYMBOLS = Object.keys(TICKER_META);

export const CAROUSEL_ROWS = [
  { label: "台股市值型 ETF", symbols: ["0050", "006208", "0056", "00878"] },
  { label: "美股大盤 ETF",   symbols: ["VT", "VOO", "VTI", "QQQ"] },
  { label: "美股主題 ETF",   symbols: ["SMH", "SOXX", "XLK", "AIQ"] },
  { label: "債券 ETF",       symbols: ["BND", "BNDW", "00679B", "TLT"] },
  { label: "台股權值股",     symbols: ["2330", "2454", "2412"] },
] as const;
