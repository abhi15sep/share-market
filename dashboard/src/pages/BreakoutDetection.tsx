import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { StockRecord } from '../types';
import { MarketTag, CapTag, ScoreBadge, ChangePercent, PriceDisplay } from '../components/common/Tags';
import MultiSelect from '../components/common/MultiSelect';

const ALL_MARKETS = ['US', 'UK', 'IN', 'HK', 'JP', 'DE', 'FR'];
const ALL_CAPS = ['Large', 'Mid', 'Small'];
const ALL_SECTORS = [
  'Communication', 'Consumer Cyclical', 'Consumer Defensive', 'Energy',
  'Financials', 'Fintech', 'Healthcare', 'Industrials', 'Materials',
  'Real Estate', 'Technology', 'Utilities',
];

type SortKey = 'breakoutScore' | 'volumeRatio' | 'marketCap' | 'score' | 'changePercent' | 'rsi';

interface BreakoutStock {
  stock: StockRecord;
  matched: string[];
  breakoutScore: number;
}

function getBreakoutCriteria(stock: StockRecord): string[] {
  const matched: string[] = [];
  if (stock.bollingerSqueeze) matched.push('Bollinger Squeeze');
  if (stock.bollingerUpper != null && stock.price > stock.bollingerUpper) matched.push('Above Upper Band');
  if (stock.volumeRatio > 1.5) matched.push('Strong Volume');
  if (stock.obvTrend === 'rising') matched.push('OBV Rising');
  return matched;
}

export default function BreakoutDetection({ stocks }: { stocks: StockRecord[] }) {
  const [markets, setMarkets] = useState<string[]>([]);
  const [caps, setCaps] = useState<string[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);
  const [hasDividend, setHasDividend] = useState(false);
  const [minScore, setMinScore] = useState(2);
  const [minVolRatio, setMinVolRatio] = useState(0);
  const [sortBy, setSortBy] = useState<SortKey>('breakoutScore');

  const breakouts = useMemo<BreakoutStock[]>(() => {
    return stocks
      .map(stock => { const matched = getBreakoutCriteria(stock); return { stock, matched, breakoutScore: matched.length }; })
      .filter(b => b.breakoutScore >= minScore)
      .filter(b => minVolRatio === 0 || b.stock.volumeRatio >= minVolRatio)
      .filter(b => markets.length === 0 || markets.includes(b.stock.market))
      .filter(b => caps.length === 0 || caps.includes(b.stock.capCategory))
      .filter(b => sectors.length === 0 || sectors.includes(b.stock.sector ?? ''))
      .filter(b => !hasDividend || (b.stock.dividendYield != null && b.stock.dividendYield > 0))
      .sort((a, b) => {
        switch (sortBy) {
          case 'breakoutScore': return b.breakoutScore - a.breakoutScore || b.stock.volumeRatio - a.stock.volumeRatio;
          case 'volumeRatio': return b.stock.volumeRatio - a.stock.volumeRatio;
          case 'marketCap': return b.stock.marketCap - a.stock.marketCap;
          case 'score': return b.stock.score.composite - a.stock.score.composite;
          case 'changePercent': return b.stock.changePercent - a.stock.changePercent;
          case 'rsi': return (b.stock.rsi ?? 0) - (a.stock.rsi ?? 0);
          default: return 0;
        }
      });
  }, [stocks, minScore, minVolRatio, markets, caps, sectors, hasDividend, sortBy]);

  const anyFilterActive = markets.length > 0 || caps.length > 0 || sectors.length > 0 || hasDividend || minScore > 2 || minVolRatio > 0;

  const resetFilters = () => {
    setMarkets([]); setCaps([]); setSectors([]); setHasDividend(false); setMinScore(2); setMinVolRatio(0);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold t-primary">Breakout Detection</h1>
          <p className="text-sm t-muted mt-1">Stocks poised for a big move after a quiet period</p>
        </div>
        <span className="badge bg-accent/15 text-accent-light ring-1 ring-accent/30 text-sm">
          {breakouts.length} match{breakouts.length !== 1 ? 'es' : ''}
        </span>
      </div>

      {/* How it works */}
      <div className="card p-4 bg-accent/5 border-accent/15">
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium t-secondary select-none">
            <span className="text-xs t-muted group-open:rotate-90 transition-transform">&#9654;</span>
            How does this work?
          </summary>
          <div className="mt-3 text-sm t-muted space-y-2">
            <p>Catches stocks about to make a big move after a quiet period. Checked against 4 breakout conditions:</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li><strong className="t-secondary">Bollinger Squeeze</strong> — Volatility is extremely low (bands tightening), calm before the storm</li>
              <li><strong className="t-secondary">Above Upper Band</strong> — Price has broken above the upper Bollinger Band</li>
              <li><strong className="t-secondary">Strong Volume</strong> — Volume ratio above 1.5x average, confirming the breakout</li>
              <li><strong className="t-secondary">OBV Rising</strong> — On-Balance Volume trending up, money flowing in</li>
            </ul>
          </div>
        </details>
      </div>

      {/* Filters */}
      <div className="card p-3">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Min Score */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium t-muted">Min Score:</span>
            {[1, 2, 3, 4].map(n => (
              <button
                key={n}
                onClick={() => setMinScore(n)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  minScore === n
                    ? 'bg-accent/15 text-accent-light ring-1 ring-accent/30'
                    : 'bg-surface-tertiary t-tertiary hover:t-secondary'
                }`}
              >
                {n}+
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-surface-border" />

          {/* Min Volume Ratio */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium t-muted">Vol Ratio:</span>
            {[[0, 'Any'], [1.5, '1.5x+'], [2, '2x+'], [3, '3x+']].map(([val, label]) => (
              <button
                key={String(val)}
                onClick={() => setMinVolRatio(Number(val))}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  minVolRatio === Number(val)
                    ? 'bg-accent/15 text-accent-light ring-1 ring-accent/30'
                    : 'bg-surface-tertiary t-tertiary hover:t-secondary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-surface-border" />

          <MultiSelect label="Market" options={ALL_MARKETS} selected={markets} onChange={setMarkets} activeClass="bg-accent/15 text-accent-light ring-1 ring-accent/30" />
          <MultiSelect label="Cap" options={ALL_CAPS} selected={caps} onChange={setCaps} activeClass="bg-accent/15 text-accent-light ring-1 ring-accent/30" />
          <MultiSelect label="Sector" options={ALL_SECTORS} selected={sectors} onChange={setSectors} activeClass="bg-accent/15 text-accent-light ring-1 ring-accent/30" />

          <div className="w-px h-5 bg-surface-border" />

          <button
            onClick={() => setHasDividend(v => !v)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              hasDividend
                ? 'bg-accent/15 text-accent-light ring-1 ring-accent/30'
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
              <option value="breakoutScore">Breakout Score</option>
              <option value="volumeRatio">Volume Ratio</option>
              <option value="rsi">Highest RSI (Momentum)</option>
              <option value="marketCap">Largest Market Cap</option>
              <option value="score">Composite Score</option>
              <option value="changePercent">Biggest Gain Today</option>
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
      {breakouts.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">⏸</div>
          <h3 className="text-lg font-semibold t-secondary mb-1">No breakout candidates right now</h3>
          <p className="t-muted text-sm">
            Stocks qualify when {minScore}+ breakout signals align. Try lowering the minimum score or adjusting filters.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {breakouts.map(({ stock, matched, breakoutScore }) => (
            <Link
              key={stock.ticker}
              to={`/stock/${stock.ticker}`}
              className="card p-5 block hover:border-accent/30 hover:shadow-glow-blue transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                    <span className="text-lg font-bold t-primary">{stock.ticker}</span>
                    <span className="t-tertiary text-sm">{stock.name}</span>
                    <MarketTag market={stock.market} />
                    <CapTag cap={stock.capCategory} />
                  </div>
                  <div className="flex items-center gap-4 text-sm flex-wrap">
                    <PriceDisplay value={stock.price} market={stock.market} />
                    <ChangePercent value={stock.changePercent} />
                    <span className="t-muted">
                      Vol <span className={`font-mono ${stock.volumeRatio > 1.5 ? 'text-accent-light' : 't-secondary'}`}>{stock.volumeRatio.toFixed(2)}x</span>
                    </span>
                    {stock.rsi != null && (
                      <span className="t-muted">
                        RSI <span className={`font-mono ${stock.rsi > 70 ? 'text-accent-light' : 't-secondary'}`}>{stock.rsi.toFixed(1)}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium t-muted uppercase tracking-wider mb-1">Breakout Score</div>
                  <div className="text-3xl font-bold font-mono text-accent-light">{breakoutScore}<span className="text-base t-muted">/4</span></div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {matched.map(label => (
                  <span key={label} className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent/15 text-accent-light ring-1 ring-accent/30">
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
                  <span className="text-xs t-muted">
                    Cap: <span className="t-secondary">{stock.marketCap >= 1e12 ? `$${(stock.marketCap / 1e12).toFixed(1)}T` : stock.marketCap >= 1e9 ? `$${(stock.marketCap / 1e9).toFixed(1)}B` : `$${(stock.marketCap / 1e6).toFixed(0)}M`}</span>
                  </span>
                )}
                {stock.dividendYield != null && stock.dividendYield > 0 && (
                  <span className="text-xs t-muted">Div <span className="text-bullish">{stock.dividendYield.toFixed(2)}%</span></span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
