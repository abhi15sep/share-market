import * as cheerio from 'cheerio';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { CONFIG } from '../config.js';

export interface OnlinePick {
  id: string;
  ticker: string;
  name: string | null;
  market: string;
  source: string;
  sourceUrl: string;
  sourceType: 'analyst' | 'broker' | 'community' | 'screener' | 'news';
  date: string;
  callType: string;
  analyst: string | null;
  priceTarget: number | null;
  upside: number | null;
  headline: string;
  fetchedAt: string;
}

export interface OnlinePicksOutput {
  updatedAt: string;
  picks: OnlinePick[];
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function makeId(source: string, ticker: string, date: string, headline: string): string {
  const h = headline.slice(0, 30).replace(/\W+/g, '');
  return `${source}:${ticker}:${date}:${h}`;
}

function extractPriceTarget(text: string): number | null {
  const m = text.match(/(?:target|PT)\s+(?:raised?\s+to|lowered?\s+to|of|to|at)\s*\$?([0-9]+(?:\.[0-9]+)?)/i);
  return m ? parseFloat(m[1]) : null;
}

function extractCallType(text: string): string {
  const t = text.toLowerCase();
  if (/strong[\s-]?buy/.test(t)) return 'Strong Buy';
  if (/outperform/.test(t)) return 'Outperform';
  if (/overweight/.test(t)) return 'Overweight';
  if (/accumulate/.test(t)) return 'Accumulate';
  if (/speculative[\s-]?buy/.test(t)) return 'Speculative Buy';
  if (/buy/.test(t)) return 'Buy';
  if (/upgrade/.test(t)) return 'Upgrade';
  if (/initiat/.test(t)) return 'Initiation';
  return 'Buy';
}

const BUY_PATTERNS = [
  /upgraded?\s+to\s+(buy|strong[\s-]?buy|outperform|overweight|accumulate)/i,
  /initiates?\s+(?:coverage\s+)?(?:of\s+\w+\s+)?(?:at|with)\s+(buy|strong[\s-]?buy|outperform|overweight)/i,
  /reiterates?\s+(buy|strong[\s-]?buy|outperform|overweight)/i,
  /price\s+target\s+raised/i,
  /raises?\s+(?:price\s+)?target/i,
];

function isBullishHeadline(text: string): boolean {
  return BUY_PATTERNS.some(p => p.test(text));
}

// ─── StockTwits Trending ─────────────────────────────────────────────────────

async function fetchStockTwitsTrending(knownTickers: Set<string>): Promise<OnlinePick[]> {
  try {
    const res = await fetch('https://api.stocktwits.com/api/2/trending/symbols/equities.json', {
      headers: { 'User-Agent': 'StockDashboard/1.0' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const symbols: { symbol: string; title?: string; watchlist_count?: number }[] = data.symbols ?? [];
    const date = today();
    const fetchedAt = new Date().toISOString();

    return symbols
      .filter(s => knownTickers.has(s.symbol))
      .map(s => ({
        id: makeId('stocktwits', s.symbol, date, 'trending'),
        ticker: s.symbol,
        name: s.title ?? null,
        market: 'US',
        source: 'StockTwits',
        sourceUrl: `https://stocktwits.com/symbol/${s.symbol}`,
        sourceType: 'community' as const,
        date,
        callType: 'Watch',
        analyst: null,
        priceTarget: null,
        upside: null,
        headline: `Trending on StockTwits${s.watchlist_count ? ` — ${s.watchlist_count.toLocaleString()} watchlists` : ''}`,
        fetchedAt,
      }));
  } catch (err) {
    console.warn('StockTwits fetch failed:', (err as Error).message);
    return [];
  }
}

// ─── Reddit Mentions ─────────────────────────────────────────────────────────

// US and UK subreddits only
const SUBREDDITS = ['stocks', 'UKInvesting', 'Bogleheads', 'investing'];

async function fetchRedditMentions(knownUS: Set<string>, knownUK: Set<string>): Promise<OnlinePick[]> {
  const picks: OnlinePick[] = [];
  const date = today();
  const fetchedAt = new Date().toISOString();

  for (const sub of SUBREDDITS) {
    try {
      const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=50`, {
        headers: { 'User-Agent': 'StockDashboard/1.0 (educational project)' },
      });
      if (!res.ok) { await delay(1000); continue; }
      const data = await res.json();
      const posts: { data: { title: string; url: string; score: number; selftext?: string } }[] =
        data.data?.children ?? [];

      for (const { data: post } of posts) {
        if (post.score < 20) continue;
        const text = post.title + ' ' + (post.selftext ?? '');

        // US tickers: $TICK or standalone TICK (2-5 uppercase letters)
        const usMatches = [...new Set([
          ...(text.match(/\$([A-Z]{1,5})\b/g) ?? []).map(m => m.slice(1)),
          ...(post.title.match(/\b([A-Z]{2,5})\b/g) ?? []).filter(t => knownUS.has(t)),
        ])].filter(t => knownUS.has(t));

        // UK tickers: base symbol without .L suffix
        const ukMatches = [...new Set(
          (post.title.match(/\b([A-Z]{2,5})\b/g) ?? []).filter(t => knownUK.has(t))
        )];

        const headline = post.title.slice(0, 120);

        for (const ticker of usMatches) {
          picks.push({
            id: makeId(`reddit-${sub}`, ticker, date, post.title),
            ticker,
            name: null,
            market: 'US',
            source: `Reddit r/${sub}`,
            sourceUrl: post.url,
            sourceType: 'community',
            date,
            callType: 'Watch',
            analyst: null,
            priceTarget: null,
            upside: null,
            headline: `[${post.score} upvotes] ${headline}`,
            fetchedAt,
          });
        }

        for (const base of ukMatches) {
          picks.push({
            id: makeId(`reddit-${sub}`, base + '.L', date, post.title),
            ticker: base + '.L',
            name: null,
            market: 'UK',
            source: `Reddit r/${sub}`,
            sourceUrl: post.url,
            sourceType: 'community',
            date,
            callType: 'Watch',
            analyst: null,
            priceTarget: null,
            upside: null,
            headline: `[${post.score} upvotes] ${headline}`,
            fetchedAt,
          });
        }

        if (usMatches.length > 0 || ukMatches.length > 0) await delay(50);
      }
      await delay(1500); // Reddit rate limit: ~1 req/sec
    } catch (err) {
      console.warn(`Reddit r/${sub} fetch failed:`, (err as Error).message);
    }
  }

  return picks;
}


// ─── FinViz News Ratings ──────────────────────────────────────────────────────
// Parses upgrade/downgrade/initiation headlines from FinViz news page.
// Each item may contain ticker hints in the title or nearby context.

async function fetchFinvizRatings(knownUS: Set<string>): Promise<OnlinePick[]> {
  try {
    const res = await fetch('https://finviz.com/news.ashx', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    const picks: OnlinePick[] = [];
    const date = today();
    const fetchedAt = new Date().toISOString();

    // FinViz news rows: each <tr> has title link + source
    $('a.tab-link').each((_, el) => {
      const title = $(el).text().trim();
      if (!title) return;
      if (!isBullishHeadline(title)) return;

      const href = $(el).attr('href') ?? '';
      const target = extractPriceTarget(title);
      const callType = extractCallType(title);

      // Try to extract ticker from title: "Goldman Initiates NVDA at Buy"
      const tickerMatch = title.match(/\b([A-Z]{2,5})\b/g);
      const tickers = (tickerMatch ?? []).filter(t => knownUS.has(t));
      if (tickers.length === 0) return;

      for (const ticker of tickers.slice(0, 2)) {
        picks.push({
          id: makeId('finviz', ticker, date, title),
          ticker,
          name: null,
          market: 'US',
          source: 'FinViz News',
          sourceUrl: href.startsWith('http') ? href : `https://finviz.com/${href}`,
          sourceType: 'analyst',
          date,
          callType,
          analyst: null,
          priceTarget: target,
          upside: null,
          headline: title.slice(0, 120),
          fetchedAt,
        });
      }
    });

    await delay(500);
    return picks;
  } catch (err) {
    console.warn('FinViz ratings fetch failed:', (err as Error).message);
    return [];
  }
}


// ─── Merge & Prune ───────────────────────────────────────────────────────────

function loadExisting(filePath: string): OnlinePick[] {
  try {
    if (!existsSync(filePath)) return [];
    const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as OnlinePicksOutput;
    return raw.picks ?? [];
  } catch {
    return [];
  }
}

function mergeAndPrune(existing: OnlinePick[], fresh: OnlinePick[]): OnlinePick[] {
  const map = new Map<string, OnlinePick>();
  for (const p of existing) map.set(p.id, p);
  for (const p of fresh) map.set(p.id, p);   // fresh overwrites same id

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return Array.from(map.values())
    .filter(p => p.date >= cutoffStr)
    .sort((a, b) => b.date.localeCompare(a.date) || a.ticker.localeCompare(b.ticker));
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export async function fetchOnlinePicks(allTickers: string[]): Promise<OnlinePick[]> {
  console.log('Fetching online stock picks (US + UK)...');

  const knownUS = new Set(allTickers.filter(t => !t.includes('.')));
  const knownUK = new Set(
    allTickers.filter(t => t.endsWith('.L')).map(t => t.replace('.L', ''))
  );

  const [stockTwits, reddit, finviz] = await Promise.allSettled([
    fetchStockTwitsTrending(knownUS),
    fetchRedditMentions(knownUS, knownUK),
    fetchFinvizRatings(knownUS),
  ]);

  const fresh: OnlinePick[] = [
    ...(stockTwits.status === 'fulfilled' ? stockTwits.value : []),
    ...(reddit.status === 'fulfilled' ? reddit.value : []),
    ...(finviz.status === 'fulfilled' ? finviz.value : []),
  ];

  // Load existing and merge
  const existingPath = path.join(CONFIG.dataDir, 'online-picks.json');
  const existing = loadExisting(existingPath);
  const merged = mergeAndPrune(existing, fresh);

  console.log(`Online picks: ${fresh.length} new → ${merged.length} total (14-day window)`);
  return merged;
}
