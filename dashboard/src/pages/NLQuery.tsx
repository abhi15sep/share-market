import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { StockRecord } from '../types';
import { MarketTag, CapTag, ScoreBadge, ChangePercent, PriceDisplay } from '../components/common/Tags';

interface Props {
  stocks: StockRecord[];
}

interface ParsedFilter {
  label: string;
  fn: (s: StockRecord) => boolean;
}

const EXAMPLES = [
  'large cap tech stocks with high ROE',
  'undervalued stocks with low PE below 15',
  'high momentum growth stocks',
  'safe dividend stocks with low debt',
  'small cap breakout candidates above SMA200',
  'stocks with Sharpe ratio above 1',
  'healthcare stocks with Piotroski above 7',
  'Altman safe zone stocks in technology',
  'SMR rating A or B',
  'factor grade A in profitability',
  'UK stocks with positive earnings growth',
  'oversold stocks with rising OBV',
  'Minervini 8 of 8 technology stocks',
  'IN market large cap with low debt',
];

function parseQuery(query: string, stocks: StockRecord[]): { filters: ParsedFilter[]; results: StockRecord[] } {
  const q = query.toLowerCase().trim();
  if (!q) return { filters: [], results: [] };

  const filters: ParsedFilter[] = [];

  // Market cap
  if (/\blarge\s*cap\b/.test(q)) filters.push({ label: 'Large Cap', fn: s => s.capCategory === 'Large' });
  if (/\bmid\s*cap\b/.test(q)) filters.push({ label: 'Mid Cap', fn: s => s.capCategory === 'Mid' });
  if (/\bsmall\s*cap\b/.test(q)) filters.push({ label: 'Small Cap', fn: s => s.capCategory === 'Small' });

  // Market
  if (/\bus\b|\bamerican\b|\busa\b/.test(q)) filters.push({ label: 'US Market', fn: s => s.market === 'US' });
  if (/\buk\b|\bbritish\b|\blondon\b/.test(q)) filters.push({ label: 'UK Market', fn: s => s.market === 'UK' });
  if (/\bin\b|\bindian?\b/.test(q)) filters.push({ label: 'IN Market', fn: s => s.market === 'IN' });
  if (/\bhk\b|\bhong\s*kong\b/.test(q)) filters.push({ label: 'HK Market', fn: s => s.market === 'HK' });
  if (/\bjp\b|\bjapan(ese)?\b/.test(q)) filters.push({ label: 'JP Market', fn: s => s.market === 'JP' });
  if (/\bde\b|\bgerman\b/.test(q)) filters.push({ label: 'DE Market', fn: s => s.market === 'DE' });
  if (/\bfr\b|\bfrench\b/.test(q)) filters.push({ label: 'FR Market', fn: s => s.market === 'FR' });

  // Sectors
  const sectors = ['technology', 'healthcare', 'financial', 'energy', 'consumer', 'industrial', 'communication', 'utilities', 'real estate', 'materials'];
  for (const sec of sectors) {
    if (q.includes(sec)) filters.push({ label: `Sector: ${sec}`, fn: s => (s.sector ?? '').toLowerCase().includes(sec) });
  }
  if (/\btech\b/.test(q) && !q.includes('technology')) filters.push({ label: 'Sector: Technology', fn: s => (s.sector ?? '').toLowerCase().includes('technol') });

  // Valuation
  const peMatch = q.match(/pe\s*(?:below|under|<)\s*(\d+)/);
  if (peMatch) filters.push({ label: `P/E < ${peMatch[1]}`, fn: s => s.pe != null && s.pe > 0 && s.pe < +peMatch[1] });
  if (/\blow\s*pe\b|\bundervalued\b|\bcheap\b/.test(q) && !peMatch) filters.push({ label: 'Low P/E (<15)', fn: s => s.pe != null && s.pe > 0 && s.pe < 15 });
  if (/\bhigh\s*pe\b|\bexpensive\b/.test(q)) filters.push({ label: 'High P/E (>30)', fn: s => s.pe != null && s.pe > 30 });

  // ROE
  if (/\bhigh\s*roe\b/.test(q)) filters.push({ label: 'High ROE (>15%)', fn: s => s.returnOnEquity != null && s.returnOnEquity > 0.15 });
  const roeMatch = q.match(/roe\s*(?:above|over|>)\s*(\d+)/);
  if (roeMatch) filters.push({ label: `ROE > ${roeMatch[1]}%`, fn: s => s.returnOnEquity != null && s.returnOnEquity > +roeMatch[1] / 100 });

  // Momentum
  if (/\bhigh\s*momentum\b|\bstrong\s*momentum\b/.test(q)) filters.push({ label: 'High RS (>70)', fn: s => s.rsPercentile >= 70 });
  if (/\blow\s*momentum\b|\bweak\b/.test(q)) filters.push({ label: 'Low RS (<30)', fn: s => s.rsPercentile <= 30 });

  // Growth
  if (/\bgrowth\b/.test(q) && !q.includes('revenue growth') && !q.includes('earnings growth')) {
    filters.push({ label: 'Growth style', fn: s => s.styleClassification === 'Growth' || (s.earningsGrowth != null && s.earningsGrowth > 0.1) });
  }
  if (/\bvalue\b/.test(q) && !q.includes('dcf value') && !q.includes('graham')) {
    filters.push({ label: 'Value style', fn: s => s.styleClassification === 'Value' || (s.pe != null && s.pe > 0 && s.pe < 15) });
  }

  // Dividends
  if (/\bdividend\b/.test(q)) filters.push({ label: 'Pays dividend', fn: s => s.dividendYield != null && s.dividendYield > 0 });

  // Debt
  if (/\blow\s*debt\b/.test(q)) filters.push({ label: 'Low D/E (<0.5)', fn: s => s.debtToEquity != null && s.debtToEquity >= 0 && s.debtToEquity < 50 });

  // Safe / quality
  if (/\bsafe\b|\bdefensive\b/.test(q) && !q.includes('altman') && !q.includes('z-score')) {
    filters.push({ label: 'Low volatility', fn: s => s.volatility < 0.3 });
  }

  // Moving averages
  if (/\babove\s*sma\s*200\b|\babove\s*200/.test(q)) filters.push({ label: 'Above SMA200', fn: s => s.sma200 != null && s.price > s.sma200 });
  if (/\babove\s*sma\s*50\b|\babove\s*50/.test(q)) filters.push({ label: 'Above SMA50', fn: s => s.sma50 != null && s.price > s.sma50 });
  if (/\bbreakout\b/.test(q)) filters.push({ label: 'Near 52W high', fn: s => s.fiftyTwoWeekRangePercent >= 80 });
  if (/\boversold\b/.test(q)) filters.push({ label: 'RSI < 30', fn: s => s.rsi != null && s.rsi < 30 });
  if (/\boverbought\b/.test(q)) filters.push({ label: 'RSI > 70', fn: s => s.rsi != null && s.rsi > 70 });

  // Piotroski
  const pioMatch = q.match(/piotroski\s*(?:above|over|>|>=)\s*(\d+)/);
  if (pioMatch) filters.push({ label: `Piotroski >= ${pioMatch[1]}`, fn: s => s.piotroskiScore != null && s.piotroskiScore >= +pioMatch[1] });
  if (/\bhigh\s*piotroski\b/.test(q) && !pioMatch) filters.push({ label: 'Piotroski >= 7', fn: s => s.piotroskiScore != null && s.piotroskiScore >= 7 });

  // Sharpe
  const sharpeMatch = q.match(/sharpe\s*(?:ratio\s*)?(?:above|over|>)\s*([\d.]+)/);
  if (sharpeMatch) filters.push({ label: `Sharpe > ${sharpeMatch[1]}`, fn: s => s.sharpeRatio != null && s.sharpeRatio > +sharpeMatch[1] });

  // Altman Z-Score
  if (/\baltman\s*safe\b|\bsafe\s*zone\b/.test(q)) filters.push({ label: 'Altman Safe Zone', fn: s => s.altmanZone === 'safe' });
  if (/\baltman\s*distress\b|\bdistress\s*zone\b/.test(q)) filters.push({ label: 'Altman Distress', fn: s => s.altmanZone === 'distress' });

  // SMR Rating — parse all grades mentioned (e.g. "A or B", "A", "C")
  if (/\bsmr\b/i.test(q)) {
    const smrGrades = [...q.matchAll(/\b([a-e])\b/gi)].map(m => m[1].toUpperCase());
    const unique = [...new Set(smrGrades)].filter(g => 'ABCDE'.includes(g));
    if (unique.length > 0) {
      filters.push({ label: `SMR ${unique.join(' or ')}`, fn: s => unique.includes(s.smrRating ?? '') });
    }
  }

  // Factor grades — e.g. "factor grade A in profitability"
  const factorGradeMatch = q.match(/factor\s*(?:grade\s*)?(a\+?|b\+?|c|d|f)\s*(?:in\s*)?(value|growth|profitability|momentum|safety|overall)?/i);
  if (factorGradeMatch) {
    const grade = factorGradeMatch[1].toUpperCase();
    const factor = (factorGradeMatch[2]?.toLowerCase() ?? 'overall') as keyof NonNullable<StockRecord['factorGrades']>;
    // Grade order: A+ > A > B+ > B > C > D > F — pass if stock grade <= requested grade (i.e. as good or better)
    const GRADE_ORDER = ['A+', 'A', 'B+', 'B', 'C', 'D', 'F'];
    const cutoff = GRADE_ORDER.indexOf(grade);
    filters.push({ label: `Factor ${factor} >= ${grade}`, fn: s => {
      if (!s.factorGrades) return false;
      const g = s.factorGrades[factor];
      if (!g) return false;
      const idx = GRADE_ORDER.indexOf(g);
      return idx !== -1 && idx <= cutoff;
    }});
  }

  // Composite score
  const scoreMatch = q.match(/(?:composite\s*)?score\s*(?:above|over|>)\s*(\d+)/);
  if (scoreMatch) filters.push({ label: `Score > ${scoreMatch[1]}`, fn: s => s.score.composite > +scoreMatch[1] });
  if (/\btop\s*rated\b|\bhighest\s*score\b|\bbest\b/.test(q) && !scoreMatch) {
    filters.push({ label: 'Score > 65', fn: s => s.score.composite > 65 });
  }

  // OBV
  if (/\brising\s*obv\b|\bobv\s*rising\b|\bobv\s*up\b/.test(q)) filters.push({ label: 'OBV Rising', fn: s => s.obvTrend === 'rising' });
  if (/\bdeclining\s*obv\b|\bobv\s*declining\b|\bobv\s*down\b/.test(q)) filters.push({ label: 'OBV Declining', fn: s => s.obvTrend === 'declining' });

  // Earnings growth
  if (/\bpositive\s*earnings\b|\bearnings\s*growth\b/.test(q)) filters.push({ label: 'Positive earnings growth', fn: s => s.earningsGrowth != null && s.earningsGrowth > 0 });
  if (/\bnegative\s*earnings\b|\bearnings\s*loss\b/.test(q)) filters.push({ label: 'Negative earnings', fn: s => s.earningsGrowth != null && s.earningsGrowth < 0 });

  // Revenue growth
  if (/\brevenue\s*growth\b|\bgrowing\s*revenue\b/.test(q)) filters.push({ label: 'Revenue growing', fn: s => s.revenueGrowth != null && s.revenueGrowth > 0 });

  // Bollinger squeeze
  if (/\bsqueeze\b|\bbollinger\s*squeeze\b/.test(q)) filters.push({ label: 'Bollinger Squeeze', fn: s => s.bollingerSqueeze === true });

  // Minervini
  const minerviniMatch = q.match(/minervini\s*(\d+)/);
  if (minerviniMatch) {
    const n = +minerviniMatch[1];
    filters.push({ label: `Minervini ${n}+/8`, fn: s => s.minerviniChecks.passed >= n });
  } else if (/\bminervini\b/.test(q)) {
    filters.push({ label: 'Minervini 7+/8', fn: s => s.minerviniChecks.passed >= 7 });
  }

  // Trading212
  if (/\btrading\s*212\b|\bt212\b/.test(q)) filters.push({ label: 'On Trading212', fn: s => s.trading212 });

  // Apply all filters
  let results = stocks;
  for (const f of filters) {
    results = results.filter(f.fn);
  }

  // If no specific filters matched, do a text search on ticker/name/sector
  if (filters.length === 0) {
    const words = q.split(/\s+/).filter(w => w.length >= 2);
    results = stocks.filter(s => {
      const text = `${s.ticker} ${s.name} ${s.sector}`.toLowerCase();
      return words.every(w => text.includes(w));
    });
    if (words.length > 0) filters.push({ label: `Text: "${q}"`, fn: () => true });
  }

  // Sort by composite score descending
  results = [...results].sort((a, b) => b.score.composite - a.score.composite);

  return { filters, results };
}

export default function NLQuery({ stocks }: Props) {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  const { filters, results } = useMemo(() => {
    setShowAll(false);
    return parseQuery(query, stocks);
  }, [query, stocks]);

  const PAGE = 50;
  const visible = showAll ? results : results.slice(0, PAGE);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold t-primary mb-1">Natural Language Query</h1>
        <p className="text-sm t-muted">Describe what you're looking for in plain English</p>
      </div>

      {/* Search input */}
      <div className="card p-5">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="e.g., large cap tech stocks with high ROE and low debt"
            className="w-full px-4 py-3 pr-10 rounded-lg bg-surface border border-surface-border t-primary text-sm focus:outline-none focus:border-accent placeholder:t-faint"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 t-faint hover:t-secondary transition-colors text-lg leading-none"
              title="Clear"
            >
              ×
            </button>
          )}
        </div>

        {/* Active filter chips + result count */}
        {filters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {filters.map((f, i) => (
              <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-accent/10 text-accent-light border border-accent/20">
                {f.label}
              </span>
            ))}
            <span className="ml-auto badge bg-surface-tertiary t-secondary ring-1 ring-surface-border text-xs">
              {results.length} stock{results.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Examples */}
        {!query && (
          <div className="mt-4">
            <p className="text-xs t-muted mb-2">Try these examples:</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setQuery(ex)}
                  className="px-2.5 py-1 text-xs rounded-lg bg-surface-hover border border-surface-border t-tertiary hover:t-primary hover:border-accent/30 transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {query && (
        <div className="card overflow-hidden">
          {results.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm t-muted">No stocks match your query.</p>
              <p className="text-xs t-faint mt-1">Try different keywords or check the examples above.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-border bg-surface-tertiary/30">
                      <th className="text-left py-2.5 px-4 t-muted font-medium text-xs">Ticker</th>
                      <th className="text-left py-2.5 px-3 t-muted font-medium text-xs">Name</th>
                      <th className="text-center py-2.5 px-3 t-muted font-medium text-xs">Market</th>
                      <th className="text-center py-2.5 px-3 t-muted font-medium text-xs">Cap</th>
                      <th className="text-right py-2.5 px-3 t-muted font-medium text-xs">Price</th>
                      <th className="text-right py-2.5 px-3 t-muted font-medium text-xs">Change</th>
                      <th className="text-center py-2.5 px-3 t-muted font-medium text-xs">Score</th>
                      <th className="text-left py-2.5 px-3 t-muted font-medium text-xs">Sector</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map(s => (
                      <tr key={s.ticker} className="border-b border-surface-border/50 hover:bg-surface-hover/50 transition-colors">
                        <td className="py-2.5 px-4">
                          <Link to={`/stock/${s.ticker}`} className="font-bold text-sm text-accent-light hover:underline">
                            {s.ticker}
                          </Link>
                        </td>
                        <td className="py-2.5 px-3 t-muted text-xs truncate max-w-[150px]">{s.name}</td>
                        <td className="py-2.5 px-3 text-center"><MarketTag market={s.market} /></td>
                        <td className="py-2.5 px-3 text-center"><CapTag cap={s.capCategory} /></td>
                        <td className="py-2.5 px-3 text-right"><PriceDisplay value={s.price} market={s.market} /></td>
                        <td className="py-2.5 px-3 text-right"><ChangePercent value={s.changePercent} /></td>
                        <td className="py-2.5 px-3 text-center"><ScoreBadge score={s.score.composite} size="sm" /></td>
                        <td className="py-2.5 px-3 t-faint text-xs">{s.sector}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {results.length > PAGE && !showAll && (
                <div className="p-4 border-t border-surface-border text-center">
                  <button
                    onClick={() => setShowAll(true)}
                    className="text-xs text-accent-light hover:underline"
                  >
                    Show all {results.length} results (showing {PAGE})
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
