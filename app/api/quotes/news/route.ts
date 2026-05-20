import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { TICKER_META } from "@/lib/ticker-meta";

export type NewsItem = {
  title: string;
  url: string;
  source: string;
  publishedAt: string; // ISO string
};

function parseGoogleRss(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1]!;
    const title  = block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? "";
    const link   = block.match(/<link>(https?:\/\/[^\s<]+)/)?.[1]?.trim() ?? "";
    const source = block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1]?.trim() ?? "";
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() ?? "";
    if (title && link) {
      items.push({
        title,
        url: link,
        source: source || "Google News",
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date(0).toISOString(),
      });
    }
    if (items.length >= 5) break;
  }
  return items;
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const symbol = req.nextUrl.searchParams.get("symbol")?.toUpperCase() ?? "";
  if (!symbol) return NextResponse.json({ error: "Missing symbol" }, { status: 400 });

  const meta = TICKER_META[symbol];
  const name = meta?.name ?? symbol;

  // Build a tight zh-TW query: stock code/ticker + Chinese name (or English name)
  const query = `${symbol} ${name}`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`Google News ${res.status} for ${symbol}`);
      return NextResponse.json({ news: [] });
    }
    const news = parseGoogleRss(await res.text());
    return NextResponse.json({ news });
  } catch (e) {
    console.error("News fetch error:", e);
    return NextResponse.json({ news: [] });
  }
}
