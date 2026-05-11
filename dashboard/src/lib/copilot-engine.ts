import type { StockRecord, Metadata } from '../types';
import { currencySymbol } from './format';

export interface CopilotResponse {
  text: string;
  source: 'engine';
}

function fmt(v: number | null | undefined, suffix = '', decimals = 1): string {
  if (v == null) return 'N/A';
  return v.toFixed(decimals) + suffix;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return 'N/A';
  return (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%';
}

function fmtDollar(v: number | null | undefined): string {
  if (v == null) return 'N/A';
  if (Math.abs(v) >= 1e12) return '$' + (v / 1e12).toFixed(1) + 'T';
  if (Math.abs(v) >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
  if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  return '$' + v.toFixed(2);
}

function fmtPrice(stock: StockRecord, v: number | null | undefined): string {
  if (v == null) return 'N/A';
  return currencySymbol(stock.market) + v.toFixed(2);
}

function findStock(stocks: StockRecord[], query: string): StockRecord | undefined {
  const q = query.toUpperCase().trim();
  return stocks.find(s => s.ticker === q) || stocks.find(s => s.name.toLowerCase().includes(query.toLowerCase()));
}

function extractTicker(input: string, stocks: StockRecord[]): { stock: StockRecord | undefined; query: string } {
  // Try to find a ticker mention in the input
  const words = input.toUpperCase().split(/\s+/);
  for (const word of words) {
    const clean = word.replace(/[^A-Z.]/g, '');
    if (clean.length >= 1 && clean.length <= 6) {
      const stock = stocks.find(s => s.ticker === clean);
      if (stock) return { stock, query: clean };
    }
  }
  // Try name matching
  for (const s of stocks) {
    if (input.toLowerCase().includes(s.name.toLowerCase().split(' ')[0].toLowerCase()) && s.name.length > 3) {
      return { stock: s, query: s.ticker };
    }
  }
  return { stock: undefined, query: '' };
}

/**
 * Client-side Q&A engine. Returns a response for structured queries, or null for open-ended questions.
 */
export function processQuery(
  input: string,
  stocks: StockRecord[],
  contextStock?: StockRecord | null,
  metadata?: Metadata | null,
): CopilotResponse | null {
  const q = input.toLowerCase().trim();

  // Use context stock or extract from query
  const { stock: extractedStock } = extractTicker(input, stocks);
  const stock = contextStock ?? extractedStock;

  // ── Market Regime ──
  if (q.includes('market regime') || q.includes('market condition') || q.includes('bull or bear')) {
    if (metadata?.marketRegime) {
      const mr = metadata.marketRegime;
      return {
        text: `**Market Regime: ${mr.overall.toUpperCase()}**\n\n` +
          `- US: ${mr.us.regime} (${mr.us.index} at $${mr.us.price.toFixed(0)}, ${mr.us.signal})\n` +
          `- UK: ${mr.uk.regime} (${mr.uk.index} at ${mr.uk.price.toFixed(0)}, ${mr.uk.signal})\n\n` +
          `${mr.summary}`,
        source: 'engine',
      };
    }
    return { text: 'Market regime data is not available.', source: 'engine' };
  }

  // ── Top stocks by metric ──
  const topMatch = q.match(/(?:top|best|highest)\s+(?:(\d+)\s+)?stocks?\s+(?:by|for|with)\s+(\w+)/);
  if (topMatch) {
    const count = parseInt(topMatch[1] || '5');
    const metric = topMatch[2].toLowerCase();
    return handleTopStocks(stocks, metric, Math.min(count, 10));
  }

  // ── Worst/bottom stocks ──
  const bottomMatch = q.match(/(?:worst|bottom|lowest)\s+(?:(\d+)\s+)?stocks?\s+(?:by|for|with)\s+(\w+)/);
  if (bottomMatch) {
    const count = parseInt(bottomMatch[1] || '5');
    const metric = bottomMatch[2].toLowerCase();
    return handleTopStocks(stocks, metric, Math.min(count, 10), true);
  }

  // ── Compare X to/vs Y ──
  const compareMatch = q.match(/compare\s+(\w+)\s+(?:to|vs|versus|and|with)\s+(\w+)/i);
  if (compareMatch) {
    const s1 = findStock(stocks, compareMatch[1]);
    const s2 = findStock(stocks, compareMatch[2]);
    if (s1 && s2) return handleCompare(s1, s2);
    return { text: `Could not find both stocks. Make sure you use valid tickers.`, source: 'engine' };
  }

  // ── Stock-specific queries (need a stock context) ──
  if (!stock) {
    // Try some general queries without a stock
    if (q.includes('how many stocks') || q.includes('total stocks')) {
      return { text: `There are **${stocks.length}** stocks in the database.`, source: 'engine' };
    }
    if (q.includes('average score') || q.includes('avg score')) {
      const avg = Math.round(stocks.reduce((a, s) => a + s.score.composite, 0) / stocks.length);
      return { text: `The average composite score across all ${stocks.length} stocks is **${avg}/100**.`, source: 'engine' };
    }
    if (q.includes('last updated') || q.includes('when was') && q.includes('updated')) {
      if (metadata?.lastUpdated) {
        return { text: `Data was last updated on **${new Date(metadata.lastUpdated).toLocaleString()}**.`, source: 'engine' };
      }
    }
    return null; // Can't answer without a stock context
  }

  // ── Score / Rating ──
  if (q.includes('score') || q.includes('rating') || q.includes('how good') || q.includes('composite')) {
    const s = stock.score;
    return {
      text: `**${stock.ticker} Score: ${s.composite}/100**\n\n` +
        `| Factor | Score |\n|---|---|\n` +
        `| Momentum | ${s.priceMomentum} |\n` +
        `| Technical | ${s.technicalSignals} |\n` +
        `| Sentiment | ${s.newsSentiment} |\n` +
        `| Fundamentals | ${s.fundamentals} |\n` +
        `| Volume | ${s.volumeTrend} |\n` +
        `| Risk (inv.) | ${s.riskInverse} |\n\n` +
        `Sector rank: #${stock.sectorRank}/${stock.sectorCount} in ${stock.sector}`,
      source: 'engine',
    };
  }

  // ── RSI ──
  if (q.includes('rsi')) {
    const rsi = stock.rsi;
    const label = rsi == null ? 'N/A' : rsi > 70 ? 'overbought' : rsi < 30 ? 'oversold' : 'neutral';
    return {
      text: `**${stock.ticker} RSI: ${fmt(rsi)}** (${label})\n\nRSI measures if a stock has been bought or sold too much recently. Over 70 = overbought (might drop), under 30 = oversold (might bounce).`,
      source: 'engine',
    };
  }

  // ── P/E ──
  if (q.includes('p/e') || q.includes('pe ratio') || q.includes('price to earnings') || q.includes('price-to-earnings')) {
    return {
      text: `**${stock.ticker} P/E: ${fmt(stock.pe)}** | Forward P/E: ${fmt(stock.forwardPe)} | PEG: ${fmt(stock.pegRatio)}\n\n` +
        `P/E tells you how many years of earnings you're paying for. Lower is cheaper. Forward P/E uses next year's expected earnings.` +
        (stock.pe != null && stock.forwardPe != null && stock.forwardPe < stock.pe ? '\n\nForward P/E is lower, meaning analysts expect earnings growth.' : ''),
      source: 'engine',
    };
  }

  // ── Why bullish/bearish ──
  if (q.includes('why') && (q.includes('bullish') || q.includes('buy') || q.includes('good'))) {
    const bullish = stock.signals.filter(s => s.direction === 'bullish').sort((a, b) => b.severity - a.severity);
    if (bullish.length === 0) return { text: `${stock.ticker} has no active bullish signals.`, source: 'engine' };
    return {
      text: `**${stock.ticker} Bullish Signals (${bullish.length}):**\n\n` +
        bullish.slice(0, 8).map(s => `- ${s.description} (severity: ${s.severity})`).join('\n'),
      source: 'engine',
    };
  }

  if (q.includes('why') && (q.includes('bearish') || q.includes('sell') || q.includes('bad') || q.includes('down'))) {
    const bearish = stock.signals.filter(s => s.direction === 'bearish').sort((a, b) => b.severity - a.severity);
    if (bearish.length === 0) return { text: `${stock.ticker} has no active bearish signals.`, source: 'engine' };
    return {
      text: `**${stock.ticker} Bearish Signals (${bearish.length}):**\n\n` +
        bearish.slice(0, 8).map(s => `- ${s.description} (severity: ${s.severity})`).join('\n'),
      source: 'engine',
    };
  }

  // ── Signals ──
  if (q.includes('signal')) {
    const bullish = stock.signals.filter(s => s.direction === 'bullish');
    const bearish = stock.signals.filter(s => s.direction === 'bearish');
    return {
      text: `**${stock.ticker} Signals:** ${bullish.length} bullish, ${bearish.length} bearish\n\n` +
        `**Bullish:** ${bullish.length > 0 ? bullish.map(s => s.type).join(', ') : 'None'}\n` +
        `**Bearish:** ${bearish.length > 0 ? bearish.map(s => s.type).join(', ') : 'None'}`,
      source: 'engine',
    };
  }

  // ── Risk ──
  if (q.includes('risk') || q.includes('volatile') || q.includes('volatility') || q.includes('safe')) {
    return {
      text: `**${stock.ticker} Risk Profile:**\n\n` +
        `- Beta: ${fmt(stock.beta)} (${stock.beta != null ? (stock.beta > 1.5 ? 'high volatility' : stock.beta < 0.5 ? 'low volatility' : 'moderate') : 'N/A'})\n` +
        `- Volatility: ${(stock.volatility * 100).toFixed(1)}%\n` +
        `- Sharpe Ratio: ${fmt(stock.sharpeRatio, '', 2)}\n` +
        `- Sortino Ratio: ${fmt(stock.sortinoRatio, '', 2)}\n` +
        `- Max Drawdown: ${fmt(stock.maxDrawdown != null ? stock.maxDrawdown * 100 : null, '%')}\n` +
        `- Altman Z-Score: ${fmt(stock.altmanZScore)} (${stock.altmanZone ?? 'N/A'})`,
      source: 'engine',
    };
  }

  // ── Overvalued / Undervalued ──
  if (q.includes('overvalued') || q.includes('undervalued') || q.includes('fair value') || q.includes('intrinsic')) {
    const cur = currencySymbol(stock.market);
    const lines: string[] = [`**${stock.ticker} Valuation Analysis:**\n`];
    lines.push(`- Price: ${cur}${stock.price.toFixed(2)}`);
    if (stock.dcfValue != null) {
      const diff = ((stock.price - stock.dcfValue) / stock.dcfValue * 100).toFixed(0);
      lines.push(`- DCF Value: ${fmtPrice(stock, stock.dcfValue)} (${+diff > 0 ? '+' : ''}${diff}% vs price)`);
    }
    if (stock.grahamNumber != null) {
      const diff = ((stock.price - stock.grahamNumber) / stock.grahamNumber * 100).toFixed(0);
      lines.push(`- Graham Number: ${fmtPrice(stock, stock.grahamNumber)} (${+diff > 0 ? '+' : ''}${diff}% vs price)`);
    }
    if (stock.targetMeanPrice != null) {
      const diff = ((stock.targetMeanPrice - stock.price) / stock.price * 100).toFixed(0);
      lines.push(`- Analyst Target: ${fmtPrice(stock, stock.targetMeanPrice)} (${+diff > 0 ? '+' : ''}${diff}% upside)`);
    }
    lines.push(`- P/E: ${fmt(stock.pe)} | Forward P/E: ${fmt(stock.forwardPe)} | P/B: ${fmt(stock.priceToBook)}`);

    const overvalued = (stock.dcfValue != null && stock.price > stock.dcfValue * 1.2) ||
      (stock.grahamNumber != null && stock.price > stock.grahamNumber * 1.3);
    const undervalued = (stock.dcfValue != null && stock.price < stock.dcfValue * 0.8) ||
      (stock.grahamNumber != null && stock.price < stock.grahamNumber * 0.8);

    if (overvalued) lines.push('\nThe stock appears **overvalued** relative to intrinsic value estimates.');
    else if (undervalued) lines.push('\nThe stock appears **undervalued** relative to intrinsic value estimates.');
    else lines.push('\nThe stock appears **fairly valued** based on available estimates.');

    return { text: lines.join('\n'), source: 'engine' };
  }

  // ── Insider activity ──
  if (q.includes('insider')) {
    return {
      text: `**${stock.ticker} Insider Activity:**\n\n` +
        `- Insider Ownership: ${stock.heldPercentInsiders != null ? (stock.heldPercentInsiders * 100).toFixed(1) + '%' : 'N/A'}\n` +
        `- Institutional Ownership: ${stock.heldPercentInstitutions != null ? (stock.heldPercentInstitutions * 100).toFixed(1) + '%' : 'N/A'}\n` +
        `- Institutions Count: ${stock.institutionsCount ?? 'N/A'}\n` +
        `- Short Float: ${stock.shortPercentOfFloat != null ? (stock.shortPercentOfFloat * 100).toFixed(1) + '%' : 'N/A'}`,
      source: 'engine',
    };
  }

  // ── Dividends ──
  if (q.includes('dividend')) {
    if (!stock.dividendYield && !stock.dividendMetrics) {
      return { text: `${stock.ticker} does not pay a dividend.`, source: 'engine' };
    }
    return {
      text: `**${stock.ticker} Dividend:**\n\n` +
        `- Yield: ${stock.dividendYield != null ? (stock.dividendYield * 100).toFixed(2) + '%' : 'N/A'}\n` +
        (stock.dividendMetrics ? `- Annual DPS: $${stock.dividendMetrics.currentAnnualDPS?.toFixed(2) ?? 'N/A'}\n` +
        `- 5Y CAGR: ${stock.dividendMetrics.fiveYearCAGR != null ? (stock.dividendMetrics.fiveYearCAGR * 100).toFixed(1) + '%' : 'N/A'}\n` +
        `- Growth Streak: ${stock.dividendMetrics.growthStreak} years\n` +
        `- Consistency: ${(stock.dividendMetrics.payoutConsistency * 100).toFixed(0)}%` : ''),
      source: 'engine',
    };
  }

  // ── Fundamentals summary ──
  if (q.includes('fundamental') || q.includes('financials') || q.includes('earnings') || q.includes('revenue')) {
    return {
      text: `**${stock.ticker} Fundamentals:**\n\n` +
        `- Revenue Growth: ${fmtPct(stock.revenueGrowth)}\n` +
        `- Earnings Growth: ${fmtPct(stock.earningsGrowth)}\n` +
        `- Profit Margin: ${fmtPct(stock.profitMargins)}\n` +
        `- ROE: ${fmtPct(stock.returnOnEquity)}\n` +
        `- D/E: ${fmt(stock.debtToEquity)}\n` +
        `- Current Ratio: ${fmt(stock.currentRatio)}\n` +
        `- Free Cash Flow: ${fmtDollar(stock.freeCashflow)}\n` +
        `- Piotroski: ${stock.piotroskiScore ?? 'N/A'}/9 | Buffett: ${stock.buffettScore ?? 'N/A'}/5`,
      source: 'engine',
    };
  }

  // ── Technical summary ──
  if (q.includes('technical') || q.includes('moving average') || q.includes('sma') || q.includes('macd') || q.includes('bollinger')) {
    const cur = currencySymbol(stock.market);
    return {
      text: `**${stock.ticker} Technical Summary:**\n\n` +
        `- Price: ${cur}${stock.price.toFixed(2)} (${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(1)}%)\n` +
        `- SMA 20/50/150/200: ${fmt(stock.sma20)} / ${fmt(stock.sma50)} / ${fmt(stock.sma150)} / ${fmt(stock.sma200)}\n` +
        `- RSI: ${fmt(stock.rsi)}\n` +
        `- MACD Histogram: ${fmt(stock.macdHistogram, '', 3)}\n` +
        `- Bollinger %B: ${fmt(stock.bollingerPercentB, '', 2)} | Squeeze: ${stock.bollingerSqueeze ? 'Yes' : 'No'}\n` +
        `- ADX: ${fmt(stock.adx)} | Williams %R: ${fmt(stock.williamsR)}\n` +
        `- Volume Ratio: ${stock.volumeRatio.toFixed(2)}x avg`,
      source: 'engine',
    };
  }

  // ── Price / Summary ──
  if (q.includes('price') || q.includes('summary') || q.includes('overview') || q.includes('tell me about')) {
    const cur = currencySymbol(stock.market);
    return {
      text: `**${stock.ticker} — ${stock.name}**\n\n` +
        `${stock.sector} | ${stock.capCategory} Cap | ${stock.market}\n\n` +
        `- Price: ${cur}${stock.price.toFixed(2)} (${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(1)}%)\n` +
        `- Market Cap: ${fmtDollar(stock.marketCap)}\n` +
        `- Score: ${stock.score.composite}/100\n` +
        `- 52W Range: ${cur}${stock.fiftyTwoWeekLow.toFixed(2)} — ${cur}${stock.fiftyTwoWeekHigh.toFixed(2)} (at ${stock.fiftyTwoWeekRangePercent}%)\n` +
        `- P/E: ${fmt(stock.pe)} | RSI: ${fmt(stock.rsi)} | Beta: ${fmt(stock.beta)}`,
      source: 'engine',
    };
  }

  // ── Prediction ──
  if (q.includes('predict') || q.includes('forecast') || q.includes('future') || q.includes('outlook')) {
    if (stock.predictiveScore) {
      const ps = stock.predictiveScore;
      return {
        text: `**${stock.ticker} Predictive Score:**\n\n` +
          `- Current: ${stock.score.composite} | Predicted: ${ps.predicted}\n` +
          `- Direction: ${ps.direction} | Confidence: ${ps.confidence}\n` +
          `- Trend slope: ${ps.slope} pts/day | R\u00B2: ${ps.r2}\n` +
          `- Factors: Momentum ${ps.factors.trendMomentum.toFixed(2)}, Reversion ${ps.factors.meanReversion.toFixed(2)}, Technical ${ps.factors.technicalSupport.toFixed(2)}`,
        source: 'engine',
      };
    }
    return { text: `Predictive score data is not available for ${stock.ticker}. Need at least 5 days of score history.`, source: 'engine' };
  }

  // No match — return null to trigger LLM fallback
  return null;
}

function handleTopStocks(stocks: StockRecord[], metric: string, count: number, reverse = false): CopilotResponse | null {
  let sorted: StockRecord[];
  let label: string;

  switch (metric) {
    case 'score':
    case 'composite':
      sorted = [...stocks].sort((a, b) => b.score.composite - a.score.composite);
      label = 'Composite Score';
      break;
    case 'momentum':
      sorted = [...stocks].sort((a, b) => b.score.priceMomentum - a.score.priceMomentum);
      label = 'Momentum Score';
      break;
    case 'rsi':
      sorted = [...stocks].filter(s => s.rsi != null).sort((a, b) => (b.rsi ?? 0) - (a.rsi ?? 0));
      label = 'RSI';
      break;
    case 'pe':
      sorted = [...stocks].filter(s => s.pe != null && s.pe > 0).sort((a, b) => (a.pe ?? 999) - (b.pe ?? 999));
      label = 'P/E (lowest)';
      break;
    case 'dividend':
    case 'yield':
      sorted = [...stocks].filter(s => s.dividendYield != null && s.dividendYield > 0).sort((a, b) => (b.dividendYield ?? 0) - (a.dividendYield ?? 0));
      label = 'Dividend Yield';
      break;
    case 'growth':
      sorted = [...stocks].filter(s => s.earningsGrowth != null).sort((a, b) => (b.earningsGrowth ?? 0) - (a.earningsGrowth ?? 0));
      label = 'Earnings Growth';
      break;
    case 'volume':
      sorted = [...stocks].sort((a, b) => b.volumeRatio - a.volumeRatio);
      label = 'Volume Ratio';
      break;
    default:
      return null;
  }

  if (reverse) sorted.reverse();
  const top = sorted.slice(0, count);
  const direction = reverse ? 'Bottom' : 'Top';

  return {
    text: `**${direction} ${count} Stocks by ${label}:**\n\n` +
      top.map((s, i) => {
        let val = '';
        switch (metric) {
          case 'score': case 'composite': val = `${s.score.composite}`; break;
          case 'momentum': val = `${s.score.priceMomentum}`; break;
          case 'rsi': val = fmt(s.rsi); break;
          case 'pe': val = fmt(s.pe); break;
          case 'dividend': case 'yield': val = `${((s.dividendYield ?? 0) * 100).toFixed(2)}%`; break;
          case 'growth': val = fmtPct(s.earningsGrowth); break;
          case 'volume': val = `${s.volumeRatio.toFixed(2)}x`; break;
        }
        return `${i + 1}. **${s.ticker}** (${s.name.slice(0, 25)}) — ${val}`;
      }).join('\n'),
    source: 'engine',
  };
}

function handleCompare(s1: StockRecord, s2: StockRecord): CopilotResponse {
  return {
    text: `**${s1.ticker} vs ${s2.ticker}:**\n\n` +
      `| Metric | ${s1.ticker} | ${s2.ticker} |\n|---|---|---|\n` +
      `| Price | ${currencySymbol(s1.market)}${s1.price.toFixed(2)} | ${currencySymbol(s2.market)}${s2.price.toFixed(2)} |\n` +
      `| Score | ${s1.score.composite} | ${s2.score.composite} |\n` +
      `| P/E | ${fmt(s1.pe)} | ${fmt(s2.pe)} |\n` +
      `| RSI | ${fmt(s1.rsi)} | ${fmt(s2.rsi)} |\n` +
      `| Beta | ${fmt(s1.beta)} | ${fmt(s2.beta)} |\n` +
      `| Div Yield | ${s1.dividendYield != null ? (s1.dividendYield * 100).toFixed(2) + '%' : 'N/A'} | ${s2.dividendYield != null ? (s2.dividendYield * 100).toFixed(2) + '%' : 'N/A'} |\n` +
      `| Market Cap | ${fmtDollar(s1.marketCap)} | ${fmtDollar(s2.marketCap)} |\n` +
      `| 3M Return | ${(s1.priceReturn3m * 100).toFixed(1)}% | ${(s2.priceReturn3m * 100).toFixed(1)}% |\n` +
      `| Sector | ${s1.sector} | ${s2.sector} |`,
    source: 'engine',
  };
}
