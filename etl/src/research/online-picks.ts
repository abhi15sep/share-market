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
        if (post.score < 5) continue;
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


// ─── MarketBeat Analyst Ratings ──────────────────────────────────────────────
// Scrapes today's upgrades + initiations from MarketBeat's public ratings pages.
// Rows contain ticker symbols directly (unlike news headline scrapers).
// Row structure: [Ticker+Company | Action | Broker | Analyst | Price | Target]

async function scrapeMarketBeatPage(url: string, knownUS: Set<string>): Promise<OnlinePick[]> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!res.ok) return [];
  const html = await res.text();
  const $ = cheerio.load(html);
  const picks: OnlinePick[] = [];
  const date = today();
  const fetchedAt = new Date().toISOString();

  $('table tbody tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 4) return;

    // Cell[0]: company link like /stocks/NASDAQ/NVDA/ — ticker is in the href
    const companyLink = $(cells[0]).find('a[href*="/stocks/"]').first();
    const href = companyLink.attr('href') ?? '';
    const tickerMatch = href.match(/\/stocks\/(?:NASDAQ|NYSE|AMEX|OTC)\/([A-Z]{1,6})\//);
    if (!tickerMatch) return;
    const ticker = tickerMatch[1];
    if (!knownUS.has(ticker)) return;

    // Cell[0] text: "NVDANvidia Corp" — ticker and name are concatenated
    const cell0Text = $(cells[0]).text().trim();
    const companyName = cell0Text.replace(ticker, '').trim() || null;

    // Cell[1]: action text e.g. "Upgraded by"
    const actionText = $(cells[1]).text().trim();

    // Cell[2]: broker name — text before "Subscribe" noise
    const brokerRaw = $(cells[2]).text().trim();
    const broker = brokerRaw.split('Subscribe')[0].trim() || null;

    // Cell[5]: price target — may be "$3.00 → $5.00" or just "$85.00"
    const targetCell = $(cells[5] ?? cells[4]).text().trim();
    // Take the last dollar amount (new target)
    const targetMatches = targetCell.match(/\$([0-9]+(?:\.[0-9]+)?)/g);
    const priceTarget = targetMatches?.length
      ? parseFloat(targetMatches[targetMatches.length - 1].slice(1))
      : null;

    const callType = extractCallType(actionText);

    picks.push({
      id: makeId('marketbeat', ticker, date, (broker ?? '') + actionText),
      ticker,
      name: companyName,
      market: 'US',
      source: 'MarketBeat',
      sourceUrl: `https://www.marketbeat.com${href}`,
      sourceType: 'analyst',
      date,
      callType,
      analyst: broker,
      priceTarget,
      upside: null,
      headline: `${broker ?? 'Analyst'} — ${actionText}${priceTarget ? ` · Target $${priceTarget}` : ''}`,
      fetchedAt,
    });
  });

  return picks;
}

async function fetchMarketBeatRatings(knownUS: Set<string>): Promise<OnlinePick[]> {
  try {
    const [upgrades, initiations] = await Promise.allSettled([
      scrapeMarketBeatPage('https://www.marketbeat.com/ratings/upgrades/', knownUS),
      scrapeMarketBeatPage('https://www.marketbeat.com/ratings/initiations/', knownUS),
    ]);
    const picks = [
      ...(upgrades.status === 'fulfilled' ? upgrades.value : []),
      ...(initiations.status === 'fulfilled' ? initiations.value : []),
    ];
    await delay(500);
    console.log(`MarketBeat: ${picks.length} analyst picks (upgrades + initiations)`);
    return picks;
  } catch (err) {
    console.warn('MarketBeat ratings fetch failed:', (err as Error).message);
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

  const [stockTwits, reddit, marketBeat] = await Promise.allSettled([
    fetchStockTwitsTrending(knownUS),
    fetchRedditMentions(knownUS, knownUK),
    fetchMarketBeatRatings(knownUS),
  ]);

  const fresh: OnlinePick[] = [
    ...(stockTwits.status === 'fulfilled' ? stockTwits.value : []),
    ...(reddit.status === 'fulfilled' ? reddit.value : []),
    ...(marketBeat.status === 'fulfilled' ? marketBeat.value : []),
  ];

  // Load existing and merge
  const existingPath = path.join(CONFIG.dataDir, 'online-picks.json');
  const existing = loadExisting(existingPath);
  const merged = mergeAndPrune(existing, fresh);

  console.log(`Online picks: ${fresh.length} new → ${merged.length} total (14-day window)`);
  return merged;
}
