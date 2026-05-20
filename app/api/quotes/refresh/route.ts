import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const YAHOO_SYM: Record<string, string> = {
  "0050":   "0050.TW",
  "006208": "006208.TW",
  "0056":   "0056.TW",
  "00878":  "00878.TW",
  "00679B": "00679B.TW",
  "2330":   "2330.TW",
  "2454":   "2454.TW",
  "2412":   "2412.TW",
  "VT":     "VT",
  "VOO":    "VOO",
  "VTI":    "VTI",
  "QQQ":    "QQQ",
  "SMH":    "SMH",
  "SOXX":   "SOXX",
  "XLK":    "XLK",
  "AIQ":    "AIQ",
  "BND":    "BND",
  "BNDW":   "BNDW",
  "TLT":    "TLT",
};

const ALL_SYMBOLS = Object.keys(YAHOO_SYM);

// USD/TWD fetched separately — stored in stock_quotes as "USDTWD", no history needed
const FX_INTERNAL = "USDTWD";
const FX_YAHOO    = "USDTWD=X";

const BASE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Origin": "https://finance.yahoo.com",
  "Referer": "https://finance.yahoo.com/",
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function withTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

async function fetchWithTimeout(url: string, options: RequestInit, ms = 8000): Promise<Response> {
  return fetch(url, { ...options, signal: withTimeout(ms), cache: "no-store" });
}

async function retry<T>(fn: () => Promise<T>, attempts = 2, delayMs = 800): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

// ─── Yahoo Finance session ────────────────────────────────────────────────────

async function getYahooSession(): Promise<{ cookie: string; crumb: string }> {
  const r1 = await fetchWithTimeout(
    "https://fc.yahoo.com/",
    { headers: BASE_HEADERS, redirect: "follow" },
    6000,
  );
  const rawCookie = r1.headers.getSetCookie?.() ?? [];
  const cookie = rawCookie.map((c) => c.split(";")[0]).join("; ");

  const r2 = await fetchWithTimeout(
    "https://query1.finance.yahoo.com/v1/test/getcrumb",
    { headers: { ...BASE_HEADERS, Cookie: cookie } },
    6000,
  );
  if (!r2.ok) throw new Error(`Crumb fetch ${r2.status}`);
  const crumb = (await r2.text()).trim();
  if (!crumb || crumb.includes("<")) throw new Error("Invalid crumb response");
  return { cookie, crumb };
}

// ─── quote fetch ─────────────────────────────────────────────────────────────

async function fetchBatchQuotes(
  yahooSymbols: string[],
  cookie: string,
  crumb: string,
): Promise<Record<string, unknown>[]> {
  const fields = "regularMarketPrice,regularMarketChangePercent,trailingPE,trailingAnnualDividendYield,marketCap,totalAssets,fiftyTwoWeekHigh,fiftyTwoWeekLow,currency";
  const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${yahooSymbols.join(",")}&fields=${fields}&crumb=${encodeURIComponent(crumb)}`;
  const res = await fetchWithTimeout(url, { headers: { ...BASE_HEADERS, Cookie: cookie } }, 10000);
  if (!res.ok) throw new Error(`Yahoo quote ${res.status}`);
  const json = await res.json();
  return (json?.quoteResponse?.result ?? []) as Record<string, unknown>[];
}

// ─── history fetch ────────────────────────────────────────────────────────────

type HistoryRow = { date: Date; open: number | null; high: number | null; low: number | null; close: number };

async function fetchHistory(
  yahooSymbol: string,
  cookie: string,
  crumb: string,
): Promise<HistoryRow[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1y&crumb=${encodeURIComponent(crumb)}`;
  const res = await fetchWithTimeout(url, { headers: { ...BASE_HEADERS, Cookie: cookie } }, 10000);
  if (!res.ok) return [];

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return [];
  }

  const result = (json as Record<string, unknown> | null)?.chart as Record<string, unknown> | undefined;
  const first = (result?.result as unknown[])?.[0] as Record<string, unknown> | undefined;
  if (!first) return [];

  const timestamps = (first.timestamp as number[] | undefined) ?? [];
  const q = ((first.indicators as Record<string, unknown>)?.quote as Record<string, unknown>[])?.[0] ?? {};
  const opens  = (q.open  as (number | null)[]) ?? [];
  const highs  = (q.high  as (number | null)[]) ?? [];
  const lows   = (q.low   as (number | null)[]) ?? [];
  const closes = (q.close as (number | null)[]) ?? [];

  const rows: HistoryRow[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (close == null) continue;
    rows.push({
      date:  new Date(timestamps[i]! * 1000),
      open:  opens[i]  ?? null,
      high:  highs[i]  ?? null,
      low:   lows[i]   ?? null,
      close,
    });
  }
  return rows;
}

// ─── route handler ────────────────────────────────────────────────────────────

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const yahooToInternal = Object.fromEntries(
    Object.entries(YAHOO_SYM).map(([internal, yahoo]) => [yahoo, internal]),
  );

  // 1. Yahoo session — retry once on failure
  let cookie = "";
  let crumb  = "";
  try {
    ({ cookie, crumb } = await retry(() => getYahooSession(), 2, 1000));
  } catch (e) {
    console.error("Yahoo session failed:", e);
    return NextResponse.json({ error: "Yahoo session unavailable" }, { status: 502 });
  }

  const errors: string[] = [];

  // 2. Batch quote fetch — include FX rate in the same request
  let quoteResults: Record<string, unknown>[] = [];
  try {
    const yahooSymbols = [...ALL_SYMBOLS.map((s) => YAHOO_SYM[s]!), FX_YAHOO];
    quoteResults = await retry(() => fetchBatchQuotes(yahooSymbols, cookie, crumb), 2, 1000);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Quote batch failed:", msg);
    errors.push(`quotes: ${msg}`);
  }

  // 3. Upsert quotes (stocks + FX rate)
  const updatedSymbols: string[] = [];
  for (const q of quoteResults) {
    const yahooSym = q.symbol as string;

    // Handle FX rate separately — store as USDTWD with price = rate
    if (yahooSym === FX_YAHOO) {
      const rate = (q.regularMarketPrice as number | null) ?? 0;
      if (rate > 0) {
        try {
          await prisma.stockQuote.upsert({
            where:  { symbol: FX_INTERNAL },
            create: { symbol: FX_INTERNAL, price: rate, dayChg: 0, high52w: rate, low52w: rate, currency: "TWD" },
            update: { price: rate },
          });
        } catch (e) {
          console.error("FX upsert failed:", e);
        }
      }
      continue;
    }

    const sym = yahooToInternal[yahooSym];
    if (!sym) continue;

    const price    = (q.regularMarketPrice              as number | null) ?? 0;
    const dayChg   = (q.regularMarketChangePercent      as number | null) ?? 0;
    const pe       = (q.trailingPE                      as number | null) ?? null;
    const yldRaw   =  q.trailingAnnualDividendYield     as number | null;
    const yld      = yldRaw != null ? yldRaw * 100 : null;
    const aumRaw   = (q.totalAssets as number | null) ?? (q.marketCap as number | null) ?? null;
    const aum      = aumRaw != null ? aumRaw / 1e9 : null;
    const high52w  = (q.fiftyTwoWeekHigh                as number | null) ?? price;
    const low52w   = (q.fiftyTwoWeekLow                 as number | null) ?? price;
    const currency = (q.currency                        as string | null) ?? "USD";

    try {
      await prisma.stockQuote.upsert({
        where:  { symbol: sym },
        create: { symbol: sym, price, dayChg, pe, yld, aum, high52w, low52w, currency },
        update: {                price, dayChg, pe, yld, aum, high52w, low52w, currency },
      });
      updatedSymbols.push(sym);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`Quote upsert failed for ${sym}:`, msg);
      errors.push(`upsert ${sym}: ${msg}`);
    }
  }

  // 4. History — check existing counts, then backfill per symbol in batches of 5
  const existingCounts = await prisma.stockHistory.groupBy({
    by: ["symbol"],
    _count: { symbol: true },
  });
  const countMap = Object.fromEntries(existingCounts.map((r) => [r.symbol, r._count.symbol]));

  async function refreshHistory(sym: string) {
    const yahooSym = YAHOO_SYM[sym]!;
    let rows: HistoryRow[] = [];
    try {
      rows = await retry(() => fetchHistory(yahooSym, cookie, crumb), 2, 800);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`History fetch failed for ${sym}:`, msg);
      errors.push(`history ${sym}: ${msg}`);
      return;
    }
    if (rows.length === 0) return;

    const existing  = countMap[sym] ?? 0;
    const toUpsert  = existing > 10 ? rows.slice(-10) : rows;

    try {
      await prisma.$transaction(
        toUpsert.map((r) =>
          prisma.stockHistory.upsert({
            where:  { symbol_date: { symbol: sym, date: r.date } },
            create: { symbol: sym, date: r.date, close: r.close, open: r.open, high: r.high, low: r.low },
            update: {                             close: r.close, open: r.open, high: r.high, low: r.low },
          }),
        ),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`History upsert failed for ${sym}:`, msg);
      errors.push(`history upsert ${sym}: ${msg}`);
    }
  }

  for (let i = 0; i < ALL_SYMBOLS.length; i += 5) {
    await Promise.all(ALL_SYMBOLS.slice(i, i + 5).map(refreshHistory));
  }

  return NextResponse.json({
    ok: updatedSymbols.length > 0,
    updatedSymbols,
    updatedAt: new Date().toISOString(),
    errors: errors.length > 0 ? errors : undefined,
  });
}
