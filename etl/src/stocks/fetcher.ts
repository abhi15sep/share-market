import pLimit from 'p-limit';
import * as cheerio from 'cheerio';
import { CONFIG } from '../config.js';
import type { StockMeta } from './universe.js';

export interface QuoteData {
  ticker: string;
  name: string;
  market: 'US' | 'UK' | 'IN' | 'DE' | 'FR' | 'JP' | 'HK';
  sector: string;
  trading212: boolean;
  price: number;
  previousClose: number;
  changePercent: number;
  marketCap: number;
  capCategory: 'Small' | 'Mid' | 'Large';
  currency: string;
  pe: number | null;
  forwardPe: number | null;
  earningsGrowth: number | null;
  revenueGrowth: number | null;
  beta: number | null;
  volume: number;
  avgVolume: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  historicalClose: number[];
  historicalVolume: number[];
  // OHLCV for candlestick charts
  ohlcvTimestamps: number[];
  ohlcvOpen: number[];
  ohlcvHigh: number[];
  ohlcvLow: number[];
  // Expanded fundamentals (from quoteSummary)
  priceToBook: number | null;
  pegRatio: number | null;
  enterpriseValue: number | null;
  profitMargins: number | null;
  grossMargins: number | null;
  operatingMargins: number | null;
  returnOnEquity: number | null;
  returnOnAssets: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  dividendYield: number | null;
  trailingEps: number | null;
  forwardEps: number | null;
  bookValue: number | null;
  sharesOutstanding: number | null;
  heldPercentInsiders: number | null;
  heldPercentInstitutions: number | null;
  institutionsCount: number | null;
  shortPercentOfFloat: number | null;
  targetMeanPrice: number | null;
  freeCashflow: number | null;
  totalRevenue: number | null;
  totalDebt: number | null;
  ebitda: number | null;
  totalCash: number | null;
  operatingCashflow: number | null;
  averageAnalystRating: string | null;
  earningsDate: string | null;
  dividendHistory: { date: number; amount: number }[];
  // ESG Scores (from Yahoo quoteSummary esgScores module)
  esgScore: number | null;
  esgEnvironment: number | null;
  esgSocial: number | null;
  esgGovernance: number | null;
  esgPercentile: number | null;
}

const MARKET_CURRENCIES: Record<string, string> = {
  US: 'USD', UK: 'GBP', IN: 'INR', DE: 'EUR', FR: 'EUR', JP: 'JPY', HK: 'HKD',
};

function classifyCap(marketCap: number): 'Small' | 'Mid' | 'Large' {
  if (marketCap < CONFIG.marketCap.small) return 'Small';
  if (marketCap < CONFIG.marketCap.mid) return 'Mid';
  return 'Large';
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ---------- Yahoo v8 Chart API (no auth needed) ----------

interface ChartData {
  price: number;
  previousClose: number;
  volume: number;
  marketCap: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  closes: number[];
  volumes: number[];
  // Full OHLCV for candlestick charts
  timestamps: number[];
  opens: number[];
  highs: number[];
  lows: number[];
  // Dividend events
  dividends: { date: number; amount: number }[];
}

async function fetchChart(ticker: string): Promise<ChartData | null> {
  const encoded = encodeURIComponent(ticker);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=${CONFIG.historicalPeriod}&includePrePost=false&events=div`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (res.status === 429) {
        await delay((attempt + 1) * 2000);
        continue;
      }
      if (!res.ok) return null;

      const data = await res.json() as any;
      const result = data?.chart?.result?.[0];
      if (!result?.meta?.regularMarketPrice) return null;

      const m = result.meta;
      const q = result.indicators?.quote?.[0] || {};
      const timestamps = (result.timestamp || []) as number[];
      const opens = (q.open || []) as (number | null)[];
      const highs = (q.high || []) as (number | null)[];
      const lows = (q.low || []) as (number | null)[];
      const rawCloses = (q.close || []) as (number | null)[];
      const rawVolumes = (q.volume || []) as (number | null)[];

      // Yahoo returns UK stocks in GBp (pence) — convert to GBP (pounds)
      const currency: string = m.currency ?? '';
      const isGBp = currency === 'GBp' || currency === 'GBX';
      const fx = isGBp ? 0.01 : 1;

      // Filter out null entries (keeping indices aligned)
      const validIndices = timestamps.map((_, i) => i).filter(i =>
        rawCloses[i] != null && opens[i] != null && highs[i] != null && lows[i] != null
      );

      const closes = validIndices.map(i => rawCloses[i]! * fx);
      const volumes = validIndices.map(i => rawVolumes[i] ?? 0);

      // Parse dividend events
      const divEvents = result.events?.dividends ?? {};
      const dividends = Object.values(divEvents).map((d: any) => ({
        date: d.date as number,
        amount: (d.amount as number) * fx,
      })).sort((a, b) => a.date - b.date);

      // Use the second-to-last daily close as "previous close" so that changePercent
      // reflects the actual day-over-day move, not the return since the start of the
      // chart range (which would be 5 years for our historicalPeriod setting).
      const prevDayClose = closes.length >= 2
        ? closes[closes.length - 2]
        : (m.regularMarketPreviousClose ?? m.regularMarketPrice) * fx;

      return {
        price: m.regularMarketPrice * fx,
        previousClose: prevDayClose,
        volume: m.regularMarketVolume ?? (volumes.length > 0 ? volumes[volumes.length - 1] : 0),
        marketCap: 0, // filled by quoteSummary or FinViz later
        fiftyTwoWeekHigh: m.fiftyTwoWeekHigh != null ? m.fiftyTwoWeekHigh * fx : Math.max(...closes, m.regularMarketPrice * fx),
        fiftyTwoWeekLow: m.fiftyTwoWeekLow != null ? m.fiftyTwoWeekLow * fx : Math.min(...closes, m.regularMarketPrice * fx),
        closes,
        volumes,
        timestamps: validIndices.map(i => timestamps[i]),
        opens: validIndices.map(i => opens[i]! * fx),
        highs: validIndices.map(i => highs[i]! * fx),
        lows: validIndices.map(i => lows[i]! * fx),
        dividends,
      };
    } catch {
      if (attempt < 2) await delay(1000);
    }
  }
  return null;
}

// ---------- Yahoo v7 Quote (fundamentals for UK stocks, requires crumb auth) ----------

interface YahooFundamentals {
  marketCap: number;
  pe: number | null;
  forwardPe: number | null;
  beta: number | null;
  earningsGrowth: number | null;
  revenueGrowth: number | null;
  avgVolume: number;
  // Expanded fields from v7 quote
  priceToBook: number | null;
  trailingEps: number | null;
  forwardEps: number | null;
  bookValue: number | null;
  sharesOutstanding: number | null;
  dividendYield: number | null;
  averageAnalystRating: string | null;
  earningsTimestamp: number | null;
}

interface QuoteSummaryData {
  enterpriseValue: number | null;
  profitMargins: number | null;
  grossMargins: number | null;
  operatingMargins: number | null;
  returnOnEquity: number | null;
  returnOnAssets: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  freeCashflow: number | null;
  totalRevenue: number | null;
  totalDebt: number | null;
  ebitda: number | null;
  totalCash: number | null;
  operatingCashflow: number | null;
  heldPercentInsiders: number | null;
  heldPercentInstitutions: number | null;
  institutionsCount: number | null;
  shortPercentOfFloat: number | null;
  targetMeanPrice: number | null;
  pegRatio: number | null;
  // ESG Scores
  esgScore: number | null;
  esgEnvironment: number | null;
  esgSocial: number | null;
  esgGovernance: number | null;
  esgPercentile: number | null;
}

// Yahoo v7 quote API requires a crumb + cookie pair. Get it once per run.
let yahooCrumb: string | null = null;
let yahooCookie: string | null = null;

export async function getYahooCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  if (yahooCrumb && yahooCookie) return { crumb: yahooCrumb, cookie: yahooCookie };

  try {
    // Step 1: Get cookie from Yahoo
    const cookieRes = await fetch('https://fc.yahoo.com', {
      headers: { 'User-Agent': UA },
      redirect: 'manual',
    });
    const setCookie = cookieRes.headers.get('set-cookie');
    if (!setCookie) return null;

    // Extract the A3 cookie value
    const cookieValue = setCookie.split(';')[0];

    // Step 2: Get crumb using the cookie
    const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: {
        'User-Agent': UA,
        'Cookie': cookieValue,
      },
    });
    if (!crumbRes.ok) return null;

    const crumb = await crumbRes.text();
    if (!crumb || crumb.includes('<!')) return null;

    yahooCrumb = crumb;
    yahooCookie = cookieValue;
    return { crumb, cookie: cookieValue };
  } catch {
    return null;
  }
}

async function fetchYahooFundamentalsBatch(tickers: string[]): Promise<Map<string, YahooFundamentals>> {
  const result = new Map<string, YahooFundamentals>();
  const auth = await getYahooCrumb();
  if (!auth) {
    console.warn('  Failed to get Yahoo crumb — UK fundamentals will be missing');
    return result;
  }

  // Yahoo v7 supports batching up to ~50 symbols per request
  const batchSize = 50;
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const symbols = batch.map(t => encodeURIComponent(t)).join(',');
    const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&crumb=${encodeURIComponent(auth.crumb)}`;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': UA, 'Cookie': auth.cookie },
        });
        if (res.status === 429) {
          await delay((attempt + 1) * 3000);
          continue;
        }
        if (!res.ok) break;

        const data = await res.json() as any;
        const quotes = data?.quoteResponse?.result ?? [];

        for (const q of quotes) {
          // Yahoo returns UK stock prices in GBp (pence) — convert to GBP (pounds)
          const cur: string = q.currency ?? '';
          const isPence = cur === 'GBp' || cur === 'GBX';
          const pxFx = isPence ? 0.01 : 1;

          result.set(q.symbol, {
            marketCap: q.marketCap ?? 0,
            pe: q.trailingPE ?? null,
            forwardPe: q.forwardPE ?? null,
            beta: q.beta ?? null,
            earningsGrowth: q.earningsQuarterlyGrowth?.raw ?? null,
            revenueGrowth: q.revenueGrowth?.raw ?? null,
            avgVolume: q.averageDailyVolume3Month ?? 0,
            priceToBook: q.priceToBook ?? null,
            trailingEps: q.epsTrailingTwelveMonths != null ? q.epsTrailingTwelveMonths * pxFx : null,
            forwardEps: q.epsForward != null ? q.epsForward * pxFx : null,
            bookValue: q.bookValue != null ? q.bookValue * pxFx : null,
            sharesOutstanding: q.sharesOutstanding ?? null,
            dividendYield: q.dividendYield != null ? q.dividendYield / 100 : null,
            averageAnalystRating: q.averageAnalystRating ?? null,
            earningsTimestamp: q.earningsTimestamp?.[0] ?? q.earningsTimestampStart ?? null,
          });
        }
        break; // success
      } catch {
        if (attempt < 1) await delay(1000);
      }
    }

    // Small delay between batches
    if (i + batchSize < tickers.length) await delay(150);
  }

  return result;
}

// ---------- Yahoo quoteSummary (detailed fundamentals per stock) ----------

async function fetchQuoteSummaryBatch(tickers: string[]): Promise<Map<string, QuoteSummaryData>> {
  const result = new Map<string, QuoteSummaryData>();
  const auth = await getYahooCrumb();
  if (!auth) return result;

  const limit = pLimit(8);

  await Promise.all(
    tickers.map(ticker =>
      limit(async () => {
        const encoded = encodeURIComponent(ticker);
        const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encoded}?modules=defaultKeyStatistics,financialData,majorHoldersBreakdown,esgScores&crumb=${encodeURIComponent(auth.crumb)}`;

        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const res = await fetch(url, {
              headers: { 'User-Agent': UA, 'Cookie': auth.cookie },
            });
            if (res.status === 429) {
              await delay((attempt + 1) * 2000);
              continue;
            }
            if (!res.ok) break;

            const data = await res.json() as any;
            const r = data?.quoteSummary?.result?.[0];
            if (!r) break;

            const ks = r.defaultKeyStatistics ?? {};
            const fd = r.financialData ?? {};
            const mh = r.majorHoldersBreakdown ?? {};
            const esg = r.esgScores ?? {};

            // targetMeanPrice is in trading currency (GBp for .L stocks)
            const cur: string = fd.financialCurrency ?? fd.currency ?? '';
            const targetPxFx = (cur === 'GBp' || cur === 'GBX' || (ticker.endsWith('.L') && fd.targetMeanPrice?.raw > 100)) ? 0.01 : 1;

            result.set(ticker, {
              enterpriseValue: ks.enterpriseValue?.raw ?? null,
              profitMargins: ks.profitMargins?.raw ?? fd.profitMargins?.raw ?? null,
              grossMargins: fd.grossMargins?.raw ?? null,
              operatingMargins: fd.operatingMargins?.raw ?? null,
              returnOnEquity: fd.returnOnEquity?.raw ?? null,
              returnOnAssets: fd.returnOnAssets?.raw ?? null,
              debtToEquity: fd.debtToEquity?.raw ?? null,
              currentRatio: fd.currentRatio?.raw ?? null,
              freeCashflow: fd.freeCashflow?.raw ?? null,
              totalRevenue: fd.totalRevenue?.raw ?? null,
              totalDebt: fd.totalDebt?.raw ?? null,
              ebitda: fd.ebitda?.raw ?? null,
              totalCash: fd.totalCash?.raw ?? null,
              operatingCashflow: fd.operatingCashflow?.raw ?? null,
              heldPercentInsiders: ks.heldPercentInsiders?.raw ?? null,
              heldPercentInstitutions: ks.heldPercentInstitutions?.raw ?? null,
              institutionsCount: mh.institutionsCount?.raw ?? null,
              shortPercentOfFloat: ks.shortPercentOfFloat?.raw ?? null,
              targetMeanPrice: fd.targetMeanPrice?.raw != null ? fd.targetMeanPrice.raw * targetPxFx : null,
              pegRatio: ks.pegRatio?.raw ?? null,
              // ESG Scores
              esgScore: esg.totalEsg?.raw ?? null,
              esgEnvironment: esg.environmentScore?.raw ?? null,
              esgSocial: esg.socialScore?.raw ?? null,
              esgGovernance: esg.governanceScore?.raw ?? null,
              esgPercentile: esg.percentile?.raw ?? null,
            });
            break;
          } catch {
            if (attempt < 1) await delay(500);
          }
        }
        await delay(80); // rate limiting
      })
    )
  );

  return result;
}

// ---------- FinViz Scraper (US stocks fundamentals) ----------

interface Fundamentals {
  marketCap: number;
  pe: number | null;
  forwardPe: number | null;
  beta: number | null;
  earningsGrowth: number | null;
  revenueGrowth: number | null;
  avgVolume: number;
  priceToBook: number | null;
  trailingEps: number | null;
  forwardEps: number | null;
  bookValue: number | null;
  sharesOutstanding: number | null;
  dividendYield: number | null;
  averageAnalystRating: string | null;
  earningsTimestamp: number | null;
}

function parseFinvizNumber(val: string): number | null {
  if (!val || val === '-') return null;
  const cleaned = val.replace(/,/g, '').replace('%', '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseMarketCap(val: string): number {
  if (!val || val === '-') return 0;
  const num = parseFloat(val);
  if (isNaN(num)) return 0;
  if (val.endsWith('T')) return num * 1e12;
  if (val.endsWith('B')) return num * 1e9;
  if (val.endsWith('M')) return num * 1e6;
  return num;
}

function parseVolume(val: string): number {
  if (!val || val === '-') return 0;
  const num = parseFloat(val.replace(/,/g, ''));
  if (isNaN(num)) return 0;
  if (val.endsWith('M')) return num * 1e6;
  if (val.endsWith('K')) return num * 1e3;
  return num;
}

async function fetchFinvizFundamentals(ticker: string): Promise<Fundamentals | null> {
  try {
    const url = `https://finviz.com/quote.ashx?t=${ticker}&ty=c&p=d&b=1`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);

    const data: Record<string, string> = {};
    let currentKey = '';
    $('table.snapshot-table2 td').each((i, el) => {
      const text = $(el).text().trim();
      if (i % 2 === 0) {
        currentKey = text;
      } else {
        data[currentKey] = text;
      }
    });

    return {
      marketCap: parseMarketCap(data['Market Cap'] || ''),
      pe: parseFinvizNumber(data['P/E'] || ''),
      forwardPe: parseFinvizNumber(data['Forward P/E'] || ''),
      beta: parseFinvizNumber(data['Beta'] || ''),
      earningsGrowth: (() => { const v = parseFinvizNumber(data['EPS Q/Q'] || ''); return v != null ? v / 100 : null; })(),
      revenueGrowth: (() => { const v = parseFinvizNumber(data['Sales Q/Q'] || ''); return v != null ? v / 100 : null; })(),
      avgVolume: parseVolume(data['Avg Volume'] || ''),
      priceToBook: null,
      trailingEps: null,
      forwardEps: null,
      bookValue: null,
      sharesOutstanding: null,
      dividendYield: null,
      averageAnalystRating: null,
      earningsTimestamp: null,
    };
  } catch {
    return null;
  }
}

// ---------- Main fetch ----------

export async function fetchAllStocks(stocks: StockMeta[]): Promise<QuoteData[]> {
  const startTime = Date.now();

  // Phase 1: Fetch all Yahoo charts in parallel (high concurrency)
  console.log(`  Phase 1: Fetching ${stocks.length} charts (concurrency ${CONFIG.concurrency})...`);
  const chartLimit = pLimit(CONFIG.concurrency);
  const chartResults = await Promise.all(
    stocks.map((meta, idx) =>
      chartLimit(async () => {
        const chart = await fetchChart(meta.ticker);
        if ((idx + 1) % 50 === 0) {
          console.log(`    Charts: ${idx + 1}/${stocks.length}`);
        }
        return { meta, chart };
      })
    )
  );

  const validCharts = chartResults.filter(r => r.chart !== null) as { meta: StockMeta; chart: ChartData }[];
  const chartElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`  Phase 1 done: ${validCharts.length}/${stocks.length} charts in ${chartElapsed}s`);

  // Phase 2: Fetch fundamentals via Yahoo v7 batch for ALL stocks (fast & reliable)
  // Then enrich US stocks with FinViz for extra data (earnings/revenue growth)
  const usStocks = validCharts.filter(r => r.meta.market === 'US');
  const ukStocks = validCharts.filter(r => r.meta.market === 'UK');
  const allTickers = validCharts.map(r => r.meta.ticker);
  console.log(`  Phase 2: Fetching fundamentals — ${allTickers.length} stocks (Yahoo v7 batch + FinViz enrichment)...`);

  const finvizLimit = pLimit(CONFIG.finvizConcurrency);
  const fundamentalsMap = new Map<string, Fundamentals | YahooFundamentals | null>();

  // Step 2a: Yahoo v7 batch for ALL stocks (market cap, P/E, beta, volume)
  const yahooFundamentals = await fetchYahooFundamentalsBatch(allTickers);
  for (const [ticker, f] of yahooFundamentals) {
    fundamentalsMap.set(ticker, f);
  }
  console.log(`    Yahoo v7 batch: ${yahooFundamentals.size}/${allTickers.length} fundamentals`);

  // Step 2b + 2c: Run FinViz enrichment and quoteSummary in parallel
  const usTickersNeedingFinviz = usStocks.filter(r => {
    const yf = fundamentalsMap.get(r.meta.ticker);
    return !yf || yf.earningsGrowth == null;
  });
  console.log(`    FinViz enrichment: ${usTickersNeedingFinviz.length} US stocks | quoteSummary: ${allTickers.length} stocks (parallel)...`);

  const [, quoteSummaryMap] = await Promise.all([
    // FinViz enrichment
    Promise.all(
      usTickersNeedingFinviz.map((r, idx) =>
        finvizLimit(async () => {
          await delay(300);
          const f = await fetchFinvizFundamentals(r.meta.ticker);
          if (f) {
            const existing = fundamentalsMap.get(r.meta.ticker);
            fundamentalsMap.set(r.meta.ticker, {
              marketCap: existing?.marketCap || f.marketCap,
              pe: existing?.pe ?? f.pe,
              forwardPe: existing?.forwardPe ?? f.forwardPe,
              beta: existing?.beta ?? f.beta,
              earningsGrowth: f.earningsGrowth ?? existing?.earningsGrowth ?? null,
              revenueGrowth: f.revenueGrowth ?? existing?.revenueGrowth ?? null,
              avgVolume: existing?.avgVolume || f.avgVolume,
              priceToBook: existing?.priceToBook ?? null,
              trailingEps: existing?.trailingEps ?? null,
              forwardEps: existing?.forwardEps ?? null,
              bookValue: existing?.bookValue ?? null,
              sharesOutstanding: existing?.sharesOutstanding ?? null,
              dividendYield: existing?.dividendYield ?? null,
              averageAnalystRating: existing?.averageAnalystRating ?? null,
              earningsTimestamp: existing?.earningsTimestamp ?? null,
            });
          }
          if ((idx + 1) % 50 === 0) {
            console.log(`    FinViz: ${idx + 1}/${usTickersNeedingFinviz.length}`);
          }
        })
      )
    ),
    // quoteSummary (independent, runs in parallel with FinViz)
    fetchQuoteSummaryBatch(allTickers),
  ]);

  const finvizElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`  Phase 2 done: ${fundamentalsMap.size} fundamentals, ${quoteSummaryMap.size} summaries in ${finvizElapsed}s`);

  // Phase 3: Assemble results
  const results: QuoteData[] = [];

  for (const { meta, chart } of validCharts) {
    const fundamentals = fundamentalsMap.get(meta.ticker) ?? null;
    const summary = quoteSummaryMap.get(meta.ticker) ?? null;
    const changePercent = chart.previousClose
      ? ((chart.price - chart.previousClose) / chart.previousClose) * 100
      : 0;
    const marketCap = fundamentals?.marketCap ?? 0;

    results.push({
      ticker: meta.ticker,
      name: meta.name,
      market: meta.market,
      sector: meta.sector,
      trading212: meta.trading212,
      price: chart.price,
      previousClose: chart.previousClose,
      changePercent,
      marketCap,
      capCategory: classifyCap(marketCap),
      currency: MARKET_CURRENCIES[meta.market] || 'USD',
      pe: fundamentals?.pe ?? null,
      forwardPe: fundamentals?.forwardPe ?? null,
      earningsGrowth: fundamentals?.earningsGrowth ?? null,
      revenueGrowth: fundamentals?.revenueGrowth ?? null,
      beta: fundamentals?.beta ?? null,
      volume: chart.volume,
      avgVolume: fundamentals?.avgVolume ?? 0,
      fiftyTwoWeekHigh: chart.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: chart.fiftyTwoWeekLow,
      historicalClose: chart.closes,
      historicalVolume: chart.volumes,
      ohlcvTimestamps: chart.timestamps,
      ohlcvOpen: chart.opens,
      ohlcvHigh: chart.highs,
      ohlcvLow: chart.lows,
      // Expanded from v7 quote
      priceToBook: fundamentals?.priceToBook ?? null,
      trailingEps: fundamentals?.trailingEps ?? null,
      forwardEps: fundamentals?.forwardEps ?? null,
      bookValue: fundamentals?.bookValue ?? null,
      sharesOutstanding: fundamentals?.sharesOutstanding ?? null,
      dividendYield: fundamentals?.dividendYield ?? null,
      averageAnalystRating: fundamentals?.averageAnalystRating ?? null,
      // From quoteSummary
      pegRatio: summary?.pegRatio ?? null,
      enterpriseValue: summary?.enterpriseValue ?? null,
      profitMargins: summary?.profitMargins ?? null,
      grossMargins: summary?.grossMargins ?? null,
      operatingMargins: summary?.operatingMargins ?? null,
      returnOnEquity: summary?.returnOnEquity ?? null,
      returnOnAssets: summary?.returnOnAssets ?? null,
      debtToEquity: summary?.debtToEquity ?? null,
      currentRatio: summary?.currentRatio ?? null,
      freeCashflow: summary?.freeCashflow ?? null,
      totalRevenue: summary?.totalRevenue ?? null,
      totalDebt: summary?.totalDebt ?? null,
      ebitda: summary?.ebitda ?? null,
      totalCash: summary?.totalCash ?? null,
      operatingCashflow: summary?.operatingCashflow ?? null,
      heldPercentInsiders: summary?.heldPercentInsiders ?? null,
      heldPercentInstitutions: summary?.heldPercentInstitutions ?? null,
      institutionsCount: summary?.institutionsCount ?? null,
      shortPercentOfFloat: summary?.shortPercentOfFloat ?? null,
      targetMeanPrice: summary?.targetMeanPrice ?? null,
      earningsDate: (() => {
        const ts = fundamentals?.earningsTimestamp;
        if (ts == null) return null;
        const d = new Date(ts * 1000);
        return d.toISOString().slice(0, 10);
      })(),
      dividendHistory: chart.dividends,
      // ESG Scores
      esgScore: summary?.esgScore ?? null,
      esgEnvironment: summary?.esgEnvironment ?? null,
      esgSocial: summary?.esgSocial ?? null,
      esgGovernance: summary?.esgGovernance ?? null,
      esgPercentile: summary?.esgPercentile ?? null,
    });
  }

  console.log(`Successfully fetched ${results.length}/${stocks.length} stocks`);
  return results;
}
