import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { stringify } from 'csv-stringify/sync';
import { CONFIG } from '../config.js';
import type { MarketRegime } from '../indicators/regime.js';
import type { FinancialData } from '../fundamentals/financials.js';
import type { InsiderSummary } from '../insider/edgar.js';
import type { VolumeProfileData } from '../indicators/technical.js';
import type { MacroData } from '../indicators/macro.js';
import type { SocialSentiment } from '../news/social-sentiment.js';
import type { OnlinePick, OnlinePicksOutput } from '../research/online-picks.js';
import path from 'path';

export interface StockRecord {
  ticker: string;
  name: string;
  market: 'US' | 'UK' | 'IN' | 'DE' | 'FR' | 'JP' | 'HK';
  currency: string;
  sector: string;
  trading212: boolean;
  price: number;
  changePercent: number;
  marketCap: number;
  capCategory: string;
  pe: number | null;
  forwardPe: number | null;
  earningsGrowth: number | null;
  revenueGrowth: number | null;
  beta: number | null;
  volume: number;
  avgVolume: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  rsi: number | null;
  macdHistogram: number | null;
  sma50: number | null;
  sma150: number | null;
  sma200: number | null;
  sma20: number | null;
  sma200Slope: number | null;
  bollingerUpper: number | null;
  bollingerLower: number | null;
  bollingerBandwidth: number | null;
  bollingerPercentB: number | null;
  bollingerSqueeze: boolean;
  stochasticK: number | null;
  stochasticD: number | null;
  obvTrend: string | null;
  obvDivergence: string | null;
  volumeRatio: number;
  priceReturn3m: number;
  priceReturn6m: number;
  priceReturn1y: number;
  priceReturn2y: number;
  priceReturn3y: number;
  priceReturn4y: number;
  yearlyReturns: number[];       // per-year returns [year1, year2, year3, year4] most recent first
  yearlyUptrendYears: number;    // total positive-return years (0-4)
  weightedAlpha: number | null;       // exponentially-weighted 1-year return %
  pctBelowResistance: number | null;  // how far below nearest resistance (%)
  volatility: number;
  signals: { type: string; direction: string; severity: number; description: string; timeframe: string }[];
  timeframeSentiment: {
    short: { opinion: string; signalCount: number };
    medium: { opinion: string; signalCount: number };
    long: { opinion: string; signalCount: number };
  };
  bearishScore: number;
  bullishScore: number;
  sentimentAvg: number;
  score: {
    priceMomentum: number;
    technicalSignals: number;
    newsSentiment: number;
    fundamentals: number;
    volumeTrend: number;
    riskInverse: number;
    composite: number;
  };
  // Expanded fundamentals
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
  // Computed metrics
  rsPercentile: number;          // 1-99 relative strength
  fiftyTwoWeekRangePercent: number; // 0-100, position in 52W range
  weeklyHighLowRange: number | null; // consolidation range %
  accDistRating: string;         // A-E rating
  styleClassification: string;   // Value / Blend / Growth
  dataCompleteness: number;      // 0-100 %
  // Minervini trend template
  minerviniChecks: {
    priceAbove150and200: boolean;
    sma150Above200: boolean;
    sma200Trending: boolean;
    sma50Above150and200: boolean;
    priceAbove50: boolean;
    price30PctAboveLow: boolean;
    priceWithin25PctOfHigh: boolean;
    rsAbove70: boolean;
    passed: number; // count of checks passed
  };
  // Sector-relative scoring
  sectorZScore: number | null;  // z-score within sector
  sectorRank: number;           // rank within sector (1=best)
  sectorCount: number;          // total in sector
  // Support & resistance levels
  supportResistance: { price: number; strength: number; type: 'support' | 'resistance' }[];
  // Expert screens (Piotroski, Graham, Buffett)
  piotroskiScore: number | null;
  piotroskiDetails: string[];
  grahamNumber: number | null;
  buffettScore: number | null;
  buffettDetails: string[];
  // N6: Additional Technical Indicators
  adx: number | null;
  plusDI: number | null;
  minusDI: number | null;
  williamsR: number | null;
  chaikinMoneyFlow: number | null;
  // N4: Risk-Adjusted Returns
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  maxDrawdown: number | null;
  // N3: Altman Z-Score
  altmanZScore: number | null;
  altmanZone: 'safe' | 'grey' | 'distress' | null;
  // N2: Factor Grades
  factorGrades: {
    value: string;        // A+ to F
    growth: string;
    profitability: string;
    momentum: string;
    safety: string;
    overall: string;
  } | null;
  // N8: SMR Rating (Sales-Margins-ROE)
  smrRating: string | null;  // A-E
  // N7: Earnings Drift
  earningsDrift: {
    lastEarningsDate: string;
    return1d: number | null;
    return5d: number | null;
    return20d: number | null;
  } | null;
  // Earnings & valuation
  earningsDate: string | null;
  dcfValue: number | null;
  dividendMetrics: {
    annualDividends: { year: number; totalDPS: number }[];
    currentAnnualDPS: number | null;
    fiveYearCAGR: number | null;
    growthStreak: number;
    payoutConsistency: number;
  } | null;
  // N17: Beneish M-Score
  beneishMScore: number | null;
  beneishZone: 'unlikely' | 'possible' | 'likely' | null;
  // N14: Ichimoku Cloud
  ichimoku: {
    tenkan: number;
    kijun: number;
    senkouA: number;
    senkouB: number;
    signal: 'bullish' | 'bearish' | 'neutral';
  } | null;
  // N10: Candlestick Patterns
  candlestickPatterns: { name: string; direction: 'bullish' | 'bearish' | 'neutral'; }[];
  // N9: Chart Patterns
  chartPatterns: { name: string; direction: 'bullish' | 'bearish' | 'neutral'; confidence: number; }[];
  // N13: Theme/Sector Tags
  themes: string[];
  // N12: Predictive Score
  predictiveScore: {
    predicted: number;
    direction: 'improving' | 'stable' | 'declining';
    confidence: 'low' | 'medium' | 'high';
    slope: number;
    r2: number;
    factors: {
      trendMomentum: number;
      meanReversion: number;
      technicalSupport: number;
    };
  } | null;
  // N16: Volume Profile
  volumeProfile: VolumeProfileData | null;
  // N25: ESG Scores
  esgScore: number | null;
  esgEnvironment: number | null;
  esgSocial: number | null;
  esgGovernance: number | null;
  esgPercentile: number | null;
}

export interface OhlcvData {
  ticker: string;
  timestamps: number[];
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
}

export function writeOutputs(
  stocks: StockRecord[],
  newsItems: any[],
  bearishAlerts: StockRecord[],
  ohlcvData?: OhlcvData[],
  marketRegime?: MarketRegime | null,
  financialsMap?: Map<string, FinancialData>,
  insiderTradesMap?: Map<string, InsiderSummary>,
  aiResearchNotes?: Map<string, string[]>,
  macroData?: MacroData | null,
  redditSentimentMap?: Map<string, SocialSentiment>,
  onlinePicks?: OnlinePick[],
) {
  const dataDir = CONFIG.dataDir;
  mkdirSync(dataDir, { recursive: true });

  // latest.json — full dataset
  writeFileSync(
    path.join(dataDir, 'latest.json'),
    JSON.stringify(stocks, null, 2)
  );

  // summary.json — top/bottom 10
  const sorted = [...stocks].sort((a, b) => b.score.composite - a.score.composite);
  const summary = {
    topOverall: sorted.slice(0, 10).map(s => ({ ticker: s.ticker, name: s.name, score: s.score.composite, market: s.market, capCategory: s.capCategory })),
    bottomOverall: sorted.slice(-10).reverse().map(s => ({ ticker: s.ticker, name: s.name, score: s.score.composite, market: s.market, capCategory: s.capCategory })),
    topLargeCap: sorted.filter(s => s.capCategory === 'Large').slice(0, 10).map(s => ({ ticker: s.ticker, name: s.name, score: s.score.composite, market: s.market })),
    topMidCap: sorted.filter(s => s.capCategory === 'Mid').slice(0, 10).map(s => ({ ticker: s.ticker, name: s.name, score: s.score.composite, market: s.market })),
    topSmallCap: sorted.filter(s => s.capCategory === 'Small').slice(0, 10).map(s => ({ ticker: s.ticker, name: s.name, score: s.score.composite, market: s.market })),
    totalStocks: stocks.length,
    avgScore: Math.round(sorted.reduce((a, s) => a + s.score.composite, 0) / sorted.length),
    bearishAlertCount: bearishAlerts.length,
  };
  writeFileSync(
    path.join(dataDir, 'summary.json'),
    JSON.stringify(summary, null, 2)
  );

  // bearish-alerts.json
  writeFileSync(
    path.join(dataDir, 'bearish-alerts.json'),
    JSON.stringify(bearishAlerts, null, 2)
  );

  // news-sentiment.json
  writeFileSync(
    path.join(dataDir, 'news-sentiment.json'),
    JSON.stringify(newsItems, null, 2)
  );

  // metadata.json
  writeFileSync(
    path.join(dataDir, 'metadata.json'),
    JSON.stringify({
      lastUpdated: new Date().toISOString(),
      stockCount: stocks.length,
      bearishAlerts: bearishAlerts.length,
      newsCount: newsItems.length,
      marketRegime: marketRegime ?? null,
    }, null, 2)
  );

  // financials.json — multi-year revenue/earnings for charts
  if (financialsMap && financialsMap.size > 0) {
    // Build a lookup of quote-level margins for fallback estimation
    const marginLookup = new Map<string, { gm: number | null; om: number | null }>();
    for (const s of stocks) {
      marginLookup.set(s.ticker, { gm: s.grossMargins, om: s.operatingMargins });
    }

    const financialsOut: Record<string, { y: string; rev: number | null; ni: number | null; gp: number | null; oi: number | null }[]> = {};
    for (const [ticker, fd] of financialsMap) {
      if (fd.annuals.length === 0) continue;
      const margins = marginLookup.get(ticker);
      financialsOut[ticker] = fd.annuals.map(a => {
        const rev = a.totalRevenue;
        // Yahoo incomeStatementHistory often returns 0/null for GP and OI.
        // Fall back to estimating from revenue * quote-level margins.
        let gp = a.grossProfit;
        if ((gp == null || gp === 0) && rev != null && rev > 0 && margins?.gm != null) {
          gp = Math.round(rev * margins.gm);
        }
        let oi = a.operatingIncome;
        if ((oi == null || oi === 0) && rev != null && rev > 0 && margins?.om != null) {
          oi = Math.round(rev * margins.om);
        }
        return { y: a.year, rev, ni: a.netIncome, gp, oi };
      });
    }
    writeFileSync(
      path.join(dataDir, 'financials.json'),
      JSON.stringify(financialsOut)
    );
    console.log(`Wrote financials.json for ${Object.keys(financialsOut).length} stocks`);
  }

  // insider-trades.json — insider trading data (separate file)
  if (insiderTradesMap && insiderTradesMap.size > 0) {
    const insiderOut: Record<string, any> = {};
    for (const [ticker, summary] of insiderTradesMap) {
      insiderOut[ticker] = {
        trades: summary.trades,
        netShares90d: summary.netShares90d,
        buyCount90d: summary.buyCount90d,
        sellCount90d: summary.sellCount90d,
        sentiment: summary.sentiment,
      };
    }
    writeFileSync(
      path.join(dataDir, 'insider-trades.json'),
      JSON.stringify(insiderOut)
    );
    console.log(`Wrote insider-trades.json for ${insiderTradesMap.size} stocks`);
  }

  // ai-research-notes.json — AI-generated research notes per ticker
  if (aiResearchNotes && aiResearchNotes.size > 0) {
    const notesOut: Record<string, string[]> = {};
    for (const [ticker, paragraphs] of aiResearchNotes) {
      notesOut[ticker] = paragraphs;
    }
    writeFileSync(
      path.join(dataDir, 'ai-research-notes.json'),
      JSON.stringify(notesOut)
    );
    console.log(`Wrote ai-research-notes.json for ${aiResearchNotes.size} stocks`);
  }

  // macro.json — macro indicators from FRED
  if (macroData) {
    writeFileSync(
      path.join(dataDir, 'macro.json'),
      JSON.stringify(macroData, null, 2)
    );
    console.log('Wrote macro.json');
  }

  // social-sentiment.json — Reddit sentiment per ticker
  if (redditSentimentMap && redditSentimentMap.size > 0) {
    const socialOut: Record<string, SocialSentiment> = {};
    for (const [ticker, sentiment] of redditSentimentMap) {
      socialOut[ticker] = sentiment;
    }
    writeFileSync(
      path.join(dataDir, 'social-sentiment.json'),
      JSON.stringify(socialOut)
    );
    console.log(`Wrote social-sentiment.json for ${redditSentimentMap.size} tickers`);
  }

  // CSV files
  const csvColumns = [
    'ticker', 'name', 'market', 'sector', 'price', 'changePercent',
    'marketCap', 'capCategory', 'pe', 'rsi', 'sma50', 'sma200',
    'bearishScore', 'bullishScore', 'sentimentAvg', 'compositeScore',
  ];

  const toCsvRow = (s: StockRecord) => ({
    ticker: s.ticker,
    name: s.name,
    market: s.market,
    sector: s.sector,
    price: s.price,
    changePercent: s.changePercent.toFixed(2),
    marketCap: s.marketCap,
    capCategory: s.capCategory,
    pe: s.pe ?? '',
    rsi: s.rsi?.toFixed(1) ?? '',
    sma50: s.sma50?.toFixed(2) ?? '',
    sma200: s.sma200?.toFixed(2) ?? '',
    bearishScore: s.bearishScore,
    bullishScore: s.bullishScore,
    sentimentAvg: s.sentimentAvg.toFixed(3),
    compositeScore: s.score.composite,
  });

  const marketCsvFiles: Record<string, string> = {
    US: 'us-stocks.csv', UK: 'uk-stocks.csv', IN: 'in-stocks.csv',
    DE: 'de-stocks.csv', FR: 'fr-stocks.csv', JP: 'jp-stocks.csv', HK: 'hk-stocks.csv',
  };

  for (const [market, filename] of Object.entries(marketCsvFiles)) {
    const filtered = stocks.filter(s => s.market === market);
    if (filtered.length > 0) {
      writeFileSync(
        path.join(dataDir, filename),
        stringify(filtered.map(toCsvRow), { header: true, columns: csvColumns })
      );
    }
  }

  // OHLCV chart data — per-stock files for lightweight-charts
  if (ohlcvData && ohlcvData.length > 0) {
    const chartsDir = path.join(dataDir, 'charts');
    mkdirSync(chartsDir, { recursive: true });

    for (const chart of ohlcvData) {
      // Compact format: array of [time, open, high, low, close, volume]
      const candles = chart.timestamps.map((t, i) => ([
        t,
        +chart.open[i].toFixed(2),
        +chart.high[i].toFixed(2),
        +chart.low[i].toFixed(2),
        +chart.close[i].toFixed(2),
        chart.volume[i],
      ]));
      writeFileSync(
        path.join(chartsDir, `${chart.ticker.replace(/[^a-zA-Z0-9.-]/g, '_')}.json`),
        JSON.stringify(candles)
      );
    }
    console.log(`Wrote ${ohlcvData.length} chart files to ${chartsDir}`);
  }

  // online-picks.json — aggregated online stock recommendations
  if (onlinePicks && onlinePicks.length > 0) {
    const output: OnlinePicksOutput = {
      updatedAt: new Date().toISOString(),
      picks: onlinePicks,
    };
    writeFileSync(
      path.join(dataDir, 'online-picks.json'),
      JSON.stringify(output, null, 2)
    );
    console.log(`Wrote online-picks.json with ${onlinePicks.length} picks`);
  }

  // Score history — daily composite scores per ticker (last 90 days)
  const historyPath = path.join(dataDir, 'score-history.json');
  let history: Record<string, Record<string, number>> = {};
  try {
    const existing = readFileSync(historyPath, 'utf-8');
    history = JSON.parse(existing);
  } catch { /* first run */ }

  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  for (const s of stocks) {
    if (!history[s.ticker]) history[s.ticker] = {};
    history[s.ticker][today] = s.score.composite;
    // Prune old entries
    for (const date of Object.keys(history[s.ticker])) {
      if (date < cutoffStr) delete history[s.ticker][date];
    }
  }

  writeFileSync(historyPath, JSON.stringify(history));

  console.log(`Wrote ${stocks.length} stocks to ${dataDir}`);
}
