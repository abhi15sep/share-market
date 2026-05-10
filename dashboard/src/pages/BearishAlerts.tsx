import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { StockRecord } from '../types';
import { MarketTag, CapTag, SignalBadge, ScoreBadge, ChangePercent, PriceDisplay } from '../components/common/Tags';
import MultiSelect from '../components/common/MultiSelect';
import { formatMarketCap } from '../lib/format';

const ALL_MARKETS = ['US', 'UK', 'IN', 'HK', 'JP', 'DE', 'FR'];
const ALL_CAPS = ['Large', 'Mid', 'Small'];
const ALL_SECTORS = [
  'Communication', 'Consumer Cyclical', 'Consumer Defensive', 'Energy',
  'Financials', 'Fintech', 'Healthcare', 'Industrials', 'Materials',
  'Real Estate', 'Technology', 'Utilities',
];

type SortKey = 'bearishScore' | 'rsi' | 'marketCap' | 'score' | 'changePercent';

export default function BearishAlerts({ alerts }: { alerts: StockRecord[] }) {
  const [markets, setMarkets] = useState<string[]>([]);
  const [caps, setCaps] = useState<string[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);
  const [hasDividend, setHasDividend] = useState(false);
  const [minScore, setMinScore] = useState(4);
  const [sortBy, setSortBy] = useState<SortKey>('bearishScore');

  const filtered = useMemo(() => {
    return alerts
      .filter(s => s.bearishScore >= minScore)
      .filter(s => markets.length === 0 || markets.includes(s.market))
      .filter(s => caps.length === 0 || caps.includes(s.capCategory))
      .filter(s => sectors.length === 0 || sectors.includes(s.sector ?? ''))
      .filter(s => !hasDividend || (s.dividendYield != null && s.dividendYield > 0))
      .sort((a, b) => {
        switch (sortBy) {
          case 'bearishScore': return b.bearishScore - a.bearishScore;
          case 'rsi': return (b.rsi ?? 0) - (a.rsi ?? 0); // highest RSI first = most overbought
          case 'marketCap': return b.marketCap - a.marketCap;
          case 'score': return b.score.composite - a.score.composite;
          case 'changePercent': return b.changePercent - a.changePercent; // biggest drop first
          default: return 0;
        }
      });
  }, [alerts, minScore, markets, caps, sectors, hasDividend, sortBy]);

  const anyFilterActive = markets.length > 0 || caps.length > 0 || sectors.length > 0 || hasDividend || minScore > 4;

  const resetFilters = () => {
    setMarkets([]); setCaps([]); setSectors([]); setHasDividend(false); setMinScore(4);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold t-primary">Bearish Alerts</h1>
          <p className="text-sm t-muted mt-1">Stocks with cumulative bearish score &ge; {minScore}</p>
        </div>
        <span className="badge bg-bearish/15 text-bearish ring-1 ring-bearish/30 text-sm">
          {filtered.length} alert{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* How it works */}
      <div className="card p-4 bg-bearish/5 border-bearish/15">
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium t-secondary select-none">
            <span className="text-xs t-muted group-open:rotate-90 transition-transform">&#9654;</span>
            How does this work?
          </summary>
          <div className="mt-3 text-sm t-muted space-y-2">
            <p>
              Each stock is scored for bearish signals — RSI overbought (&gt;70), bearish MACD, death crosses,
              declining OBV. Each signal adds to a cumulative <strong className="t-secondary">Bearish Score</strong>.
              Stocks with score &ge; {minScore} appear here. Higher score = more reasons for caution.
            </p>
            <p>Signals are uptrend-aware: overbought readings in a strong uptrend (price &gt;5% above SMA200) carry reduced weight.</p>
          </div>
        </details>
      </div>

      {/* How to use */}
      <div className="card p-4 bg-bearish/5 border-bearish/15">
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium t-secondary select-none">
            <span className="text-xs t-muted group-open:rotate-90 transition-transform">&#9654;</span>
            How to use this page
          </summary>
          <div className="mt-3 text-sm t-muted space-y-2">
            <p><strong className="t-secondary">Primary use:</strong> check stocks you already own or are watching before adding to a position or ahead of earnings.</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li><strong className="t-secondary">Score 4–5</strong> — mild caution; don&apos;t add more, monitor closely</li>
              <li><strong className="t-secondary">Score 6–7</strong> — consider reducing or hedging your position</li>
              <li><strong className="t-secondary">Score 8+</strong> — multiple strong signals aligned; act on your thesis or reduce exposure</li>
            </ul>
            <p>The strongest combination is <strong className="t-secondary">RSI overbought (&gt;70) + Death Cross + declining OBV</strong> — all three together rarely produce false signals.</p>
            <p className="text-xs pt-2 border-t border-surface-border">
              <strong>Important:</strong> A high bearish score is not a sell signal in isolation. Always check recent news, upcoming earnings, and whether the sector itself is rotating out. Sort by <strong>Highest RSI</strong> to quickly find the most extended stocks.
            </p>
          </div>
        </details>
      </div>

      {/* Filters */}
      <div className="card p-3">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Min Bearish Score */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium t-muted">Min Score:</span>
            {[4, 5, 6, 8, 10].map(n => (
              <button
                key={n}
                onClick={() => setMinScore(n)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  minScore === n
                    ? 'bg-bearish/15 text-bearish ring-1 ring-bearish/30'
                    : 'bg-surface-tertiary t-tertiary hover:t-secondary'
                }`}
              >
                {n}+
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-surface-border" />

          <MultiSelect label="Market" options={ALL_MARKETS} selected={markets} onChange={setMarkets} activeClass="bg-bearish/15 text-bearish ring-1 ring-bearish/30" />
          <MultiSelect label="Cap" options={ALL_CAPS} selected={caps} onChange={setCaps} activeClass="bg-bearish/15 text-bearish ring-1 ring-bearish/30" />
          <MultiSelect label="Sector" options={ALL_SECTORS} selected={sectors} onChange={setSectors} activeClass="bg-bearish/15 text-bearish ring-1 ring-bearish/30" />

          <div className="w-px h-5 bg-surface-border" />

          <button
            onClick={() => setHasDividend(v => !v)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              hasDividend
                ? 'bg-bearish/15 text-bearish ring-1 ring-bearish/30'
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
              <option value="bearishScore">Bearish Score</option>
              <option value="rsi">Highest RSI (Overbought)</option>
              <option value="marketCap">Largest Market Cap</option>
              <option value="score">Composite Score</option>
              <option value="changePercent">Biggest Drop Today</option>
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
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">✓</div>
          <h3 className="text-lg font-semibold text-bullish mb-1">No alerts match your filters</h3>
          <p className="t-muted">Try lowering the minimum score or adjusting market/sector filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(stock => (
            <Link
              key={stock.ticker}
              to={`/stock/${stock.ticker}`}
              className="card p-5 block hover:border-bearish/30 hover:shadow-glow-red transition-all"
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
                    {stock.rsi != null && (
                      <span className="t-muted">
                        RSI <span className={`font-mono ${stock.rsi > 70 ? 'text-bearish' : 't-secondary'}`}>{stock.rsi.toFixed(1)}</span>
                      </span>
                    )}
                    {stock.dividendYield != null && stock.dividendYield > 0 && (
                      <span className="t-muted">Div <span className="font-mono">{stock.dividendYield.toFixed(2)}%</span></span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium t-muted uppercase tracking-wider mb-1">Bearish Score</div>
                  <div className="text-3xl font-bold font-mono text-bearish">{stock.bearishScore}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {stock.signals
                  .filter(s => s.direction === 'bearish')
                  .map((s, i) => (
                    <SignalBadge key={i} direction={s.direction} type={s.type} />
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
