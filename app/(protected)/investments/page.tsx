import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InvestmentsView } from "@/app/investments/investments-view";
import { TICKER_META, ALL_SYMBOLS } from "@/lib/ticker-meta";
import type { Region, Health, Signal } from "@/lib/ticker-meta";
import type { Ticker } from "@/app/investments/investments-view";

function periodReturn(closes: number[], tradingDays: number): number {
  if (closes.length < 2) return 0;
  const slice = closes.slice(-Math.min(tradingDays + 1, closes.length));
  const start = slice[0]!;
  const end = slice[slice.length - 1]!;
  if (!start) return 0;
  return ((end - start) / start) * 100;
}

function computeSignal(opts: {
  region: Region;
  price: number;
  pe: number | null;
  yld: number | null;
  high52w: number;
  low52w: number;
  m1: number;
  m3: number;
  hasLiveData: boolean;
}): { signal: Signal; health: Health } {
  // No live data yet — stay neutral
  if (!opts.hasLiveData) return { signal: "守", health: "B" };

  const { region, price, pe, yld, high52w, low52w, m1, m3 } = opts;
  const range = high52w - low52w;
  // pos52w: 0 = at 52W low, 1 = at 52W high
  const pos52w = range > 0 ? (price - low52w) / range : 0.5;
  const momentumPos = m1 > 3  || m3 > 7;
  const momentumNeg = m1 < -5 || m3 < -12;

  // ── Bond ETFs ──────────────────────────────────────────────────────────────
  if (region === "BOND") {
    const goodYield  = yld != null && yld > 4.2;
    const nearHigh   = pos52w > 0.82;
    const cheapish   = pos52w < 0.55;

    if (goodYield && cheapish)        return { signal: "買", health: "A" };
    if (nearHigh || momentumNeg)      return { signal: "賣", health: "C" };
    if (goodYield)                    return { signal: "守", health: "A" };
    return                                   { signal: "守", health: "B" };
  }

  // ── Equity ETFs & stocks (TW / US) ────────────────────────────────────────
  // P/E thresholds: US market trades at a structural premium over TW
  const peCheap     = region === "US" ? 19 : 14;
  const peRich      = region === "US" ? 28 : 22;
  const peExtreme   = region === "US" ? 38 : 30;
  const nearHigh    = pos52w > 0.85;
  const nearLow     = pos52w < 0.30;

  const overvalued  = pe != null && pe > peExtreme;
  const richVal     = pe != null && pe > peRich;
  const cheapVal    = pe == null || pe < peCheap;   // null = no P/E (e.g. bond-like), treat as neutral-cheap

  // 賣: extreme valuation, OR near yearly highs while losing momentum
  if (overvalued)                            return { signal: "賣", health: "C" };
  if (richVal && nearHigh && momentumNeg)    return { signal: "賣", health: "C" };
  if (richVal && nearHigh)                   return { signal: "賣", health: "B" };

  // 買: cheap or near lows, positive/flat momentum
  if (cheapVal && nearLow  && !momentumNeg) return { signal: "買", health: "A" };
  if (cheapVal && momentumPos)              return { signal: "買", health: "A" };
  if (!richVal && momentumPos)              return { signal: "買", health: "A" };

  // Health nuance for 守
  const health: Health = richVal ? "B" : momentumNeg ? "B" : "A";
  return { signal: "守", health };
}

export default async function InvestmentsPage() {
  const user = await requireUser();

  const [holdingRows, quoteRows, historyRows] = await Promise.all([
    prisma.holding.findMany({
      where: { householdId: user.householdId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.stockQuote.findMany({
      where: { symbol: { in: [...ALL_SYMBOLS, "USDTWD"] } },
    }),
    prisma.stockHistory.findMany({
      where: { symbol: { in: ALL_SYMBOLS } },
      orderBy: { date: "asc" },
    }),
  ]);

  const holdings = holdingRows.map((h) => ({
    id: h.id,
    symbol: h.symbol,
    qty: Number(h.qty),
    costAvg: Number(h.costAvg),
    currency: h.currency,
  }));

  const quoteMap = Object.fromEntries(quoteRows.map((q) => [q.symbol, q]));
  const usdTwd = quoteMap["USDTWD"] ? Number(quoteMap["USDTWD"].price) : 31.5;

  // Build history map: symbol → sorted closes oldest-first, max 252
  const historyBySymbol: Record<string, number[]> = {};
  for (const row of historyRows) {
    if (!historyBySymbol[row.symbol]) historyBySymbol[row.symbol] = [];
    historyBySymbol[row.symbol]!.push(Number(row.close));
  }
  const historyMap: Record<string, number[]> = Object.fromEntries(
    Object.entries(historyBySymbol).map(([sym, closes]) => [sym, closes.slice(-252)])
  );

  // Merge static metadata with live DB data
  const tickers: Record<string, Ticker> = {};
  for (const sym of ALL_SYMBOLS) {
    const meta = TICKER_META[sym]!;
    const q = quoteMap[sym];
    const closes = historyMap[sym] ?? [];

    const price    = q ? Number(q.price)   : 0;
    const dayChg   = q ? Number(q.dayChg)  : 0;
    const pe       = q?.pe  != null ? Number(q.pe)  : null;
    const yld      = q?.yld != null ? Number(q.yld) : null;
    const aum      = q?.aum != null ? Number(q.aum) : null;
    const high52w  = q ? Number(q.high52w) : price * 1.13;
    const low52w   = q ? Number(q.low52w)  : price * 0.77;
    const currency = (q?.currency ?? (meta.region === "TW" ? "TWD" : "USD")) as "TWD" | "USD";

    const w1 = periodReturn(closes, 5);
    const m1 = periodReturn(closes, 22);
    const m3 = periodReturn(closes, 65);
    const y1 = periodReturn(closes, 252);

    const { signal, health } = computeSignal({
      region: meta.region,
      price,
      pe,
      yld,
      high52w,
      low52w,
      m1,
      m3,
      hasLiveData: !!q,
    });

    tickers[sym] = {
      ...meta,
      signal,
      health,
      price,
      currency,
      dayChg,
      pe,
      yld,
      aum,
      high52w,
      low52w,
      w1,
      m1,
      m3,
      y1,
    };
  }

  const quotesUpdatedAt =
    quoteRows.length > 0
      ? quoteRows
          .reduce((latest, q) => (q.updatedAt > latest ? q.updatedAt : latest), quoteRows[0]!.updatedAt)
          .toISOString()
      : null;

  return (
    <InvestmentsView
      initialHoldings={holdings}
      tickers={tickers}
      historyMap={historyMap}
      quotesUpdatedAt={quotesUpdatedAt}
      usdTwd={usdTwd}
    />
  );
}
