import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { TICKER_META } from "@/lib/ticker-meta";

const YAHOO_SYM: Record<string, string> = {
  "0050":   "0050.TW",  "006208": "006208.TW", "0056":   "0056.TW",
  "00878":  "00878.TW", "00679B": "00679B.TW", "2330":   "2330.TW",
  "2454":   "2454.TW",  "2412":   "2412.TW",
};

export type NewsItem = {
  title: string;
  url: string;
  source: string;
  publishedAt: string; // ISO string
};

function parseRssItems(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1]!;
    const title =
      block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1]?.trim() ??
      block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? "";
    // <link> in RSS often sits between two tags with no closing tag — grab text node after it
    const link =
      block.match(/<link>(https?:\/\/[^\s<]+)/)?.[1]?.trim() ??
      block.match(/<guid[^>]*>(https?:\/\/[^\s<]+)/)?.[1]?.trim() ?? "";
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() ?? "";
    const source =
      block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1]?.trim() ??
      block.match(/<dc:creator>([\s\S]*?)<\/dc:creator>/)?.[1]?.trim() ?? "Yahoo Finance";

    if (title && link) {
      items.push({
        title,
        url: link,
        source,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date(0).toISOString(),
      });
    }
    if (items.length >= 5) break;
  }
  return items;
}

async function fetchRss(yahooSym: string, isTW: boolean): Promise<NewsItem[]> {
  const region = isTW ? "TW" : "US";
  const lang   = isTW ? "zh-TW" : "zh-TW";
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(yahooSym)}&region=${region}&lang=${lang}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/rss+xml, application/xml, text/xml",
      },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`RSS ${res.status} for ${yahooSym}`);
      return [];
    }
    return parseRssItems(await res.text());
  } catch (e) {
    console.error(`RSS fetch error for ${yahooSym}:`, e);
    return [];
  }
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const symbol = req.nextUrl.searchParams.get("symbol")?.toUpperCase() ?? "";
  if (!symbol) return NextResponse.json({ error: "Missing symbol" }, { status: 400 });

  const yahooSym = YAHOO_SYM[symbol] ?? symbol;
  const meta = TICKER_META[symbol];
  const isTW = meta?.region === "TW" || yahooSym.endsWith(".TW");

  const news = await fetchRss(yahooSym, isTW);
  return NextResponse.json({ news });
}
