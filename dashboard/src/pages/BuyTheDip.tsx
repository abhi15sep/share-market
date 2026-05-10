import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { StockRecord } from '../types';
import { MarketTag, CapTag, ScoreBadge, ChangePercent, PriceDisplay } from '../components/common/Tags';
import MultiSelect from '../components/common/MultiSelect';
import { formatMarketCap } from '../lib/format';

const ALL_MARKETS = ['US', 'UK', 'IN', 'HK', 'JP', 'DE', 'FR'];
const ALL_CAPS = ['Large', 'Mid', 'Small'];
const ALL_SECTORS = [
  'Communication', 'Consumer Cyclical', 'Consumer Defensive', 'Energy',
  'Financials', 'Fintech', 'Healthcare', 'Industrials', 'Materials',
  'Real Estate', 'Technology', 'Utilities',
];

type SortKey = 'dipScore' | 'rsi' | 'marketCap' | 'score' | 'changePercent' | 'dividendYield';

interface DipStock {
  stock: StockRecord;
  matched: string[];
  dipScore: number;
}

function getDipCriteria(stock: StockRecord): string[] {
  const matched: string[] = [];
  if (stock.rsi != null && stock.rsi < 35) matched.push('RSI Oversold');
  if (stock.stochasticK != null && stock.stochasticK < 20) matched.push('Stochastic Oversold');
  if (stock.obvDivergence === 'bullish') matched.push('OBV Bullish Divergence');
  if ((stock.pe != null && stock.pe < 50) || (stock.earningsGrowth != null && stock.earningsGrowth > 0))
    matched.push('Reasonable Fundamentals');
  if (stock.bollingerPercentB != null && stock.bollingerPercentB < 0.1) matched.push('Near Bollinger Lower');
  return matched;
}

export default function BuyTheDip({ stocks }: { stocks: StockRecord[] }) {
  const [markets, setMarkets] = useState<string[]>([]);
  const [caps, setCaps] = useState<string[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);
  const [hasDividend, setHasDividend] = useState(false);
  const [minScore, setMinScore] = useState(2);
  const [sortBy, setSortBy] = useState<SortKey>('dipScore');

  const dipStocks = useMemo<DipStock[]>(() => {
    return stocks
      .map(stock => { const matched = getDipCriteria(stock); return { stock, matched, dipScore: matched.length }; })
      .filter(d => d.dipScore >= minScore)
      .filter(d => markets.length === 0 || markets.includes(d.stock.market))
      .filter(d => caps.length === 0 || caps.includes(d.stock.capCategory))
      .filter(d => sectors.length === 0 || sectors.includes(d.stock.sector ?? ''))
      .filter(d => !hasDividend || (d.stock.dividendYield != null && d.stock.dividendYield > 0))
      .sort((a, b) => {
        switch (sortBy) {
          case 'dipScore': return b.dipScore - a.dipScore || (a.stock.rsi ?? 100) - (b.stock.rsi ?? 100);
          case 'rsi': return (a.stock.rsi ?? 100) - (b.stock.rsi ?? 100);
          case 'marketCap': return b.stock.marketCap - a.stock.marketCap;
          case 'score': return b.stock.score.composite - a.stock.score.composite;
          case 'changePercent': return a.stock.changePercent - b.stock.changePercent;
          case 'dividendYield': return (b.stock.dividendYield ?? 0) - (a.stock.dividendYield ?? 0);
          default: return 0;
        }
      });
  }, [stocks, minScore, markets, caps, sectors, hasDividend, sortBy]);

  const anyFilterActive = markets.length > 0 || caps.length > 0 || sectors.length > 0 || hasDividend || minScore > 2;

  const resetFilters = () => {
    setMarkets([]); setCaps([]); setSectors([]); setHasDividend(false); setMinScore(2);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold t-primary">Buy the Dip</h1>
          <p className="text-sm t-muted mt-1">Value + reversal candidates with 2+ dip signals</p>
        </div>
        <span className="badge bg-bullish/15 text-bullish ring-1 ring-bullish/30 text-sm">
          {dipStocks.length} match{dipStocks.length !== 1 ? 'es' : ''}
        </span>
      </div>

      {/* How it works */}
      <div className="card p-4 bg-bullish/5 border-bullish/15">
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium t-secondary select-none">
            <span className="text-xs t-muted group-open:rotate-90 transition-transform">&#9654;</span>
            How does this work?
          </summary>
          <div className="mt-3 text-sm t-muted space-y-2">
            <p>Finds quality stocks that may have dropped too far and could be due for a bounce. Each stock is checked against 5 value + reversal conditions:</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li><strong className="t-secondary">RSI Oversold</strong> — RSI below 35, selling pressure may be exhausted</li>
              <li><strong className="t-secondary">Stochastic Oversold</strong> — Stochastic %K below 20</li>
              <li><strong className="t-secondary">OBV Bullish Divergence</strong> — Volume trending up even as price drops (smart money accumulating)</li>
              <li><strong className="t-secondary">Reasonable Fundamentals</strong> — P/E under 50 or positive earnings growth</li>
              <li><strong className="t-secondary">Near Bollinger Lower</strong> — Price near the lower Bollinger Band (%B &lt; 0.1)</li>
            </ul>
            <p className="text-xs mt-2 pt-2 border-t border-surface-border">
              <strong>Volume tip:</strong> Vol shown in amber (1.5-2x) or red (&gt;2x) means heavy selling — treat these as higher risk. Low volume dips are safer bounce candidates.
              A <strong>Sharp Drop</strong> badge (&gt;5% today) means investigate the news before buying — it may be falling on bad fundamentals, not just sentiment.
            </p>
          </div>
        </details>
      </div>

      {/* How to use */}
      <div className="card p-4 bg-bullish/5 border-bullish/15">
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium t-secondary select-none">
            <span className="text-xs t-muted group-open:rotate-90 transition-transform">&#9654;</span>
            How to use this page
          </summary>
          <div className="mt-3 text-sm t-muted space-y-2">
            <ol className="list-decimal list-inside space-y-1.5 ml-1">
              <li><strong className="t-secondary">Raise Min Score to 3+</strong> — at 2+ you get too many marginal candidates; 3+ filters to stocks with real conviction</li>
              <li><strong className="t-secondary">Pick your market</strong> — start with US or a single market you know before expanding globally</li>
              <li><strong className="t-secondary">Sort by Lowest RSI</strong> — most technically oversold stocks first; RSI &lt;30 is the strongest reading</li>
              <li><strong className="t-secondary">Check the volume ratio</strong> — amber/red volume means heavy selling (distribution), not capitulation; prefer low-volume dips where smart money is accumulating</li>
              <li><strong className="t-secondary">Sharp Drop badge?</strong> — always check the news first before buying; it may be falling on a fundamental issue, not just sentiment</li>
            </ol>
            <p className="text-xs pt-2 border-t border-surface-border">
              <strong>Best setup:</strong> RSI &lt;30 + OBV Bullish Divergence + Near Bollinger Lower + low volume ratio = highest-conviction dip. Cross-reference with Support Bounce to confirm it&apos;s at a tested level.
            </p>
          </div>
        </details>
      </div>

      {/* Filters */}
      <div className="card p-3">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Min Dip Score */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium t-muted">Min Score:</span>
            {[2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setMinScore(n)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  minScore === n
                    ? 'bg-bullish/15 text-bullish ring-1 ring-bullish/30'
                    : 'bg-surface-tertiary t-tertiary hover:t-secondary'
                }`}
              >
                {n}+
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-surface-border" />

          <MultiSelect label="Market" options={ALL_MARKETS} selected={markets} onChange={setMarkets} activeClass="bg-bullish/15 text-bullish ring-1 ring-bullish/30" />
          <MultiSelect label="Cap" options={ALL_CAPS} selected={caps} onChange={setCaps} activeClass="bg-bullish/15 text-bullish ring-1 ring-bullish/30" />
          <MultiSelect label="Sector" options={ALL_SECTORS} selected={sectors} onChange={setSectors} activeClass="bg-bullish/15 text-bullish ring-1 ring-bullish/30" />

          <div className="w-px h-5 bg-surface-border" />

          <button
            onClick={() => setHasDividend(v => !v)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              hasDividend
                ? 'bg-bullish/15 text-bullish ring-1 ring-bullish/30'
                : 'bg-surface-tertiary t-tertiary hover:t-secondary'
            }`}
          >
            Dividend Only
          </button>

          <div className="w-px h-5 bg-surface-border" />

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium t-muted">Sort:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortKey)}
              className="text-xs bg-surface-tertiary border border-surface-border rounded-md px-2 py-1 t-secondary"
            >
              <option value="dipScore">Dip Score</option>
              <option value="rsi">Lowest RSI</option>
              <option value="marketCap">Largest Market Cap</option>
              <option value="score">Composite Score</option>
              <option value="changePercent">Biggest Drop Today</option>
              <option value="dividendYield">Dividend Yield</option>
            </select>
          </div>

          {anyFilterActive && (
            <>
              <div className="w-px h-5 bg-surface-border" />
              <button onClick={resetFilters} className="px-2.5 py-1 rounded-md text-xs font-medium text-bearish bg-bearish/10 hover:bg-bearish/20 transition-all">
                Reset
              </button>
            </>
          )}
        </div>
      </div>

      {/* Results */}
      {dipStocks.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">☁</div>
          <h3 className="text-lg font-semibold t-secondary mb-1">No dip opportunities right now</h3>
          <p className="t-muted text-sm">
            Stocks qualify when {minScore}+ value/reversal signals align. Try lowering the minimum score or adjusting filters.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {dipStocks.map(({ stock, matched, dipScore }) => (
            <Link
              key={stock.ticker}
              to={`/stock/${stock.ticker}`}
              className="card p-5 block hover:border-bullish/30 hover:shadow-glow-green transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                    <span className="text-lg font-bold t-primary">{stock.ticker}</span>
                    <span className="t-tertiary text-sm">{stock.name}</span>
                    <MarketTag market={stock.market} />
                    <CapTag cap={stock.capCategory} />
                    {stock.changePercent < -5 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-bearish/20 text-bearish ring-1 ring-bearish/30">Sharp Drop</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm flex-wrap">
                    <PriceDisplay value={stock.price} market={stock.market} />
                    <ChangePercent value={stock.changePercent} />
                    {stock.rsi != null && (
                      <span className="t-muted">
                        RSI <span className={`font-mono ${stock.rsi < 30 ? 'text-bullish font-bold' : stock.rsi < 35 ? 'text-bullish' : 't-secondary'}`}>{stock.rsi.toFixed(1)}</span>
                      </span>
                    )}
                    <span className="t-muted">
                      Vol <span className={`font-mono ${stock.volumeRatio > 2 ? 'text-bearish' : stock.volumeRatio > 1.5 ? 'text-amber-400' : 't-secondary'}`}>{stock.volumeRatio.toFixed(2)}x</span>
                    </span>
                    {stock.dividendYield != null && stock.dividendYield > 0 && (
                      <span className="t-muted">Div <span className="font-mono text-bullish">{stock.dividendYield.toFixed(2)}%</span></span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium t-muted uppercase tracking-wider mb-1">Dip Score</div>
                  <div className="text-3xl font-bold font-mono text-bullish">{dipScore}<span className="text-base t-muted">/5</span></div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {matched.map(label => (
                  <span key={label} className="px-2 py-0.5 rounded-full text-xs font-medium bg-bullish/15 text-bullish ring-1 ring-bullish/30">
                    {label}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-4 pt-3 border-t border-surface-border flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs t-muted">Composite:</span>
                  <ScoreBadge score={stock.score.composite} size="sm" />
                </div>
                {stock.sector && <span className="text-xs t-muted">{stock.sector}</span>}
                {stock.marketCap > 0 && (
                  <span className="text-xs t-muted">Cap: <span className="t-secondary">{formatMarketCap(stock.marketCap, stock.market)}</span></span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
