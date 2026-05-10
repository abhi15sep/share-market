import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { StockRecord } from '../types';
import { ScoreBadge, MarketTag, CapTag } from '../components/common/Tags';
import { currencySymbol, formatMarketCap } from '../lib/format';
import MultiSelect from '../components/common/MultiSelect';

const CHECK_LABELS: { key: keyof StockRecord['minerviniChecks']; label: string }[] = [
  { key: 'priceAbove150and200', label: 'Price above 150 & 200 SMA' },
  { key: 'sma150Above200', label: '150 SMA above 200 SMA' },
  { key: 'sma200Trending', label: '200 SMA trending up (1 month+)' },
  { key: 'sma50Above150and200', label: '50 SMA above 150 & 200 SMA' },
  { key: 'priceAbove50', label: 'Price above 50 SMA' },
  { key: 'price30PctAboveLow', label: 'Price 30%+ above 52-week low' },
  { key: 'priceWithin25PctOfHigh', label: 'Price within 25% of 52-week high' },
  { key: 'rsAbove70', label: 'RS Percentile above 70' },
];

const ALL_MARKETS = ['US', 'UK', 'IN', 'HK', 'JP', 'DE', 'FR'];
const ALL_CAPS = ['Large', 'Mid', 'Small'];
const ALL_SECTORS = [
  'Communication', 'Consumer Cyclical', 'Consumer Defensive', 'Energy',
  'Financials', 'Fintech', 'Healthcare', 'Industrials', 'Materials',
  'Real Estate', 'Technology', 'Utilities',
];

type SortKey = 'rs' | 'checks' | 'changePercent' | 'rsi' | 'score' | 'marketCap';

export default function MinerviniScreen({ stocks }: { stocks: StockRecord[] }) {
  const [minPassed, setMinPassed] = useState(6);
  const [markets, setMarkets] = useState<string[]>([]);
  const [caps, setCaps] = useState<string[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>('rs');

  const filtered = useMemo(() => {
    return stocks
      .filter(s => s.minerviniChecks.passed >= minPassed)
      .filter(s => markets.length === 0 || markets.includes(s.market))
      .filter(s => caps.length === 0 || caps.includes(s.capCategory))
      .filter(s => sectors.length === 0 || sectors.includes(s.sector ?? ''))
      .sort((a, b) => {
        switch (sortBy) {
          case 'rs': {
            if (b.minerviniChecks.passed !== a.minerviniChecks.passed)
              return b.minerviniChecks.passed - a.minerviniChecks.passed;
            return b.rsPercentile - a.rsPercentile;
          }
          case 'checks': return b.minerviniChecks.passed - a.minerviniChecks.passed || b.rsPercentile - a.rsPercentile;
          case 'changePercent': return b.changePercent - a.changePercent;
          case 'rsi': return (b.rsi ?? 0) - (a.rsi ?? 0);
          case 'score': return b.score.composite - a.score.composite;
          case 'marketCap': return b.marketCap - a.marketCap;
          default: return 0;
        }
      });
  }, [stocks, minPassed, markets, caps, sectors, sortBy]);

  const anyFilterActive = markets.length > 0 || caps.length > 0 || sectors.length > 0 || minPassed !== 6 || sortBy !== 'rs';

  const resetFilters = () => {
    setMarkets([]); setCaps([]); setSectors([]); setMinPassed(6); setSortBy('rs');
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold t-primary">Minervini Trend Template</h1>
        <p className="text-sm t-muted mt-1">
          Stocks passing Mark Minervini's SEPA trend criteria
        </p>
      </div>

      {/* What is it */}
      <div className="card p-4 bg-accent/5 border-accent/15">
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium t-secondary select-none">
            <span className="text-xs t-muted group-open:rotate-90 transition-transform">&#9654;</span>
            What is the Minervini Trend Template?
          </summary>
          <div className="mt-3 text-sm t-muted space-y-2">
            <p>
              Mark Minervini's <strong className="t-secondary">SEPA (Specific Entry Point Analysis)</strong> strategy
              identifies stocks in a confirmed Stage 2 uptrend — the phase where stocks make their biggest gains.
              The trend template uses 8 criteria based on moving averages, price positioning, and relative strength.
            </p>
            <p>
              Stocks passing <strong className="t-secondary">all 8 checks</strong> are in a textbook uptrend.
              Those with 6–7 checks are approaching or transitioning into Stage 2. Stocks with fewer than 6
              are typically not in the ideal buying zone.
            </p>
            <ol className="list-decimal list-inside space-y-1 ml-1">
              {CHECK_LABELS.map(c => (
                <li key={c.key}>{c.label}</li>
              ))}
            </ol>
          </div>
        </details>
      </div>

      {/* How to use */}
      <div className="card p-4 bg-accent/5 border-accent/15">
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium t-secondary select-none">
            <span className="text-xs t-muted group-open:rotate-90 transition-transform">&#9654;</span>
            How to use this page
          </summary>
          <div className="mt-3 text-sm t-muted space-y-2">
            <ol className="list-decimal list-inside space-y-1.5 ml-1">
              <li><strong className="t-secondary">Start at 8/8</strong> — only textbook Stage 2 stocks. Use 7/8 if you want more candidates but accept slightly less confirmation.</li>
              <li><strong className="t-secondary">Sort by RS Percentile</strong> — highest relative strength first. Minervini specifically targets stocks with RS above 70; 90+ are the leaders.</li>
              <li><strong className="t-secondary">Avoid "Strong Move" stocks</strong> — stocks up 10–34% in a single day are already extended. Wait for a pullback to the 50 SMA or a base before entering.</li>
              <li><strong className="t-secondary">Check RSI</strong> — RSI above 80 means the stock is short-term overbought even if the trend is intact. Better entries come from RSI pulling back to 50–60.</li>
              <li><strong className="t-secondary">Filter by sector</strong> — Minervini focuses on leading sectors. Look for multiple stocks from the same sector passing 8/8 — that confirms a sector-wide move.</li>
            </ol>
            <p className="text-xs pt-2 border-t border-surface-border">
              <strong>Best entry:</strong> 8/8 checks + RS 90+ + RSI pulling back to 50–65 + price consolidating near 50 SMA in a tight base (low volatility). Never chase a 20%+ gap-up day.
            </p>
          </div>
        </details>
      </div>

      {/* Filters */}
      <div className="card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium t-muted">Min checks:</span>
          <div className="flex items-center gap-1">
            {[5, 6, 7, 8].map(n => (
              <button
                key={n}
                onClick={() => setMinPassed(n)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  minPassed === n
                    ? 'bg-accent/15 text-accent-light ring-1 ring-accent/30'
                    : 'bg-surface-tertiary t-tertiary hover:t-secondary'
                }`}
              >
                {n}/8
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-surface-border" />

          <MultiSelect label="Market" options={ALL_MARKETS} selected={markets} onChange={setMarkets} activeClass="bg-accent/15 text-accent-light ring-1 ring-accent/30" />
          <MultiSelect label="Cap" options={ALL_CAPS} selected={caps} onChange={setCaps} activeClass="bg-accent/15 text-accent-light ring-1 ring-accent/30" />
          <MultiSelect label="Sector" options={ALL_SECTORS} selected={sectors} onChange={setSectors} activeClass="bg-accent/15 text-accent-light ring-1 ring-accent/30" />

          <div className="w-px h-5 bg-surface-border" />

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium t-muted">Sort:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortKey)}
              className="text-xs bg-surface-tertiary border border-surface-border rounded-md px-2 py-1 t-secondary"
            >
              <option value="rs">RS Percentile</option>
              <option value="checks">Checks Passed</option>
              <option value="changePercent">Biggest Gain Today</option>
              <option value="rsi">Highest RSI</option>
              <option value="score">Composite Score</option>
              <option value="marketCap">Largest Market Cap</option>
            </select>
          </div>

          <span className="ml-auto badge bg-surface-tertiary t-secondary ring-1 ring-surface-border text-xs">
            {filtered.length} stock{filtered.length !== 1 ? 's' : ''}
          </span>

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
          <div className="text-4xl mb-3">--</div>
          <h3 className="text-lg font-semibold t-secondary mb-1">No stocks match</h3>
          <p className="t-muted">
            Try lowering the minimum checks or adjusting filters.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(stock => {
            const checks = stock.minerviniChecks;
            const changeColor = stock.changePercent >= 0 ? 'text-bullish' : 'text-bearish';

            return (
              <Link
                key={stock.ticker}
                to={`/stock/${stock.ticker}`}
                className="card p-5 block hover:border-accent/30 hover:shadow-glow-blue transition-all"
              >
                {/* Top row */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                      <span className="text-lg font-bold t-primary">{stock.ticker}</span>
                      <span className="t-tertiary text-sm">{stock.name}</span>
                      <MarketTag market={stock.market} />
                      <CapTag cap={stock.capCategory} />
                      {stock.changePercent >= 15 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-bearish/20 text-bearish ring-1 ring-bearish/30">
                          Strong Move +{stock.changePercent.toFixed(1)}%
                        </span>
                      )}
                      {stock.changePercent >= 7 && stock.changePercent < 15 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30">
                          Up +{stock.changePercent.toFixed(1)}%
                        </span>
                      )}
                      {stock.changePercent <= -7 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-bearish/20 text-bearish ring-1 ring-bearish/30">
                          Sharp Drop {stock.changePercent.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm flex-wrap">
                      <span className="font-mono tabular-nums font-medium t-primary">
                        {currencySymbol(stock.market)}{stock.price.toFixed(2)}
                      </span>
                      <span className={`font-mono tabular-nums font-medium ${changeColor}`}>
                        {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                      </span>
                      <span className="t-muted">
                        RS <span className={`font-mono font-semibold ${
                          stock.rsPercentile >= 90 ? 'text-bullish' : stock.rsPercentile >= 70 ? 'text-bullish/70' : 't-secondary'
                        }`}>{stock.rsPercentile}</span>
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <div>
                      <div className="text-xs font-medium t-muted uppercase tracking-wider mb-1">Checks</div>
                      <div className={`text-3xl font-bold font-mono ${
                        checks.passed === 8 ? 'text-bullish' : checks.passed >= 6 ? 'text-accent-light' : 'text-bearish'
                      }`}>
                        {checks.passed}<span className="text-lg t-faint">/8</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Check items */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 mb-4">
                  {CHECK_LABELS.map(({ key, label }) => {
                    const passed = key === 'passed' ? false : checks[key] as boolean;
                    return (
                      <div key={key} className="flex items-center gap-2 text-sm">
                        <span className={`text-base leading-none ${passed ? 'text-bullish' : 'text-bearish'}`}>
                          {passed ? '✓' : '✗'}
                        </span>
                        <span className={passed ? 't-secondary' : 't-faint'}>{label}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="flex items-center gap-3 pt-3 border-t border-surface-border flex-wrap">
                  <span className="text-xs t-muted">Composite Score:</span>
                  <ScoreBadge score={stock.score.composite} size="sm" />
                  {stock.rsi != null && (
                    <>
                      <span className="text-xs t-muted ml-2">RSI:</span>
                      <span className={`text-xs font-mono tabular-nums font-semibold ${
                        stock.rsi >= 80 ? 'text-bearish' : stock.rsi >= 70 ? 'text-amber-400' : stock.rsi < 30 ? 'text-bullish' : 't-secondary'
                      }`}>
                        {stock.rsi.toFixed(1)}{stock.rsi >= 80 ? ' ⚠' : ''}
                      </span>
                    </>
                  )}
                  {stock.sector && <span className="text-xs t-muted ml-2">{stock.sector}</span>}
                  {stock.marketCap > 0 && (
                    <span className="text-xs t-muted">Cap: <span className="t-secondary">{formatMarketCap(stock.marketCap, stock.market)}</span></span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
