import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { StockRecord } from '../types';
import { MarketTag, CapTag, ScoreBadge, ChangePercent, PriceDisplay } from '../components/common/Tags';
import { currencySymbol } from '../lib/format';
import MultiSelect from '../components/common/MultiSelect';

const ALL_MARKETS = ['US', 'UK', 'IN', 'HK', 'JP', 'DE', 'FR'];
const ALL_CAPS = ['Large', 'Mid', 'Small'];
const ALL_SECTORS = [
  'Communication', 'Consumer Cyclical', 'Consumer Defensive', 'Energy',
  'Financials', 'Fintech', 'Healthcare', 'Industrials', 'Materials',
  'Real Estate', 'Technology', 'Utilities',
];

type SortKey = 'dropPct' | 'ownership' | 'marketCap' | 'institutionsCount' | 'score' | 'dividendYield' | 'rsi';
type DropBucket = 'all' | '5' | '10' | '15' | '20' | '25' | '30';

interface OwnedStock {
  stock: StockRecord;
  ownershipPct: number;
  dropFromHigh: number; // % drop from 52-week high
  bucket: string;
}

function formatMarketCap(mc: number): string {
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(1)}T`;
  if (mc >= 1e9) return `$${(mc / 1e9).toFixed(1)}B`;
  if (mc >= 1e6) return `$${(mc / 1e6).toFixed(0)}M`;
  return `$${mc.toLocaleString()}`;
}

function getDropBucket(pct: number): string {
  if (pct < 5) return '0-5%';
  if (pct < 10) return '5-10%';
  if (pct < 15) return '10-15%';
  if (pct < 20) return '15-20%';
  if (pct < 25) return '20-25%';
  if (pct < 30) return '25-30%';
  return '30%+';
}


export default function MostOwned({ stocks }: { stocks: StockRecord[] }) {
  const [sortBy, setSortBy] = useState<SortKey>('dropPct');
  const [markets, setMarkets] = useState<string[]>([]);
  const [caps, setCaps] = useState<string[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);
  const [dropBucket, setDropBucket] = useState<DropBucket>('all');
  const [minDividend, setMinDividend] = useState(0);
  const [maxRsi, setMaxRsi] = useState(100);
  const [showOnlyDropped, setShowOnlyDropped] = useState(true);

  // Get top 200 by market cap (largest companies)
  const top200 = useMemo(() => {
    return [...stocks]
      .filter(s => s.marketCap > 0)
      .sort((a, b) => b.marketCap - a.marketCap)
      .slice(0, 200);
  }, [stocks]);

  const filteredStocks = useMemo(() => {
    const results: OwnedStock[] = [];

    for (const stock of top200) {
      const ownershipPct = (stock.heldPercentInstitutions ?? 0) * 100;
      const dropFromHigh = stock.fiftyTwoWeekHigh > 0
        ? ((stock.fiftyTwoWeekHigh - stock.price) / stock.fiftyTwoWeekHigh) * 100
        : 0;

      // Only show stocks that have actually dropped
      if (showOnlyDropped && dropFromHigh < 1) continue;

      if (markets.length > 0 && !markets.includes(stock.market)) continue;
      if (caps.length > 0 && !caps.includes(stock.capCategory)) continue;
      if (sectors.length > 0 && !sectors.includes(stock.sector ?? '')) continue;

      // Dividend filter
      if (minDividend > 0) {
        const dy = (stock.dividendYield ?? 0) * 100;
        if (dy < minDividend) continue;
      }

      // RSI filter
      if (maxRsi < 100 && stock.rsi != null && stock.rsi > maxRsi) continue;

      // Drop bucket filter
      if (dropBucket !== 'all') {
        const minDrop = parseInt(dropBucket);
        if (dropFromHigh < minDrop) continue;
      }

      results.push({
        stock,
        ownershipPct,
        dropFromHigh,
        bucket: getDropBucket(dropFromHigh),
      });
    }

    results.sort((a, b) => {
      switch (sortBy) {
        case 'dropPct':
          return b.dropFromHigh - a.dropFromHigh;
        case 'ownership':
          return b.ownershipPct - a.ownershipPct;
        case 'marketCap':
          return b.stock.marketCap - a.stock.marketCap;
        case 'institutionsCount':
          return (b.stock.institutionsCount ?? 0) - (a.stock.institutionsCount ?? 0);
        case 'score':
          return b.stock.score.composite - a.stock.score.composite;
        case 'dividendYield':
          return (b.stock.dividendYield ?? 0) - (a.stock.dividendYield ?? 0);
        case 'rsi':
          return (a.stock.rsi ?? 100) - (b.stock.rsi ?? 100);
        default:
          return 0;
      }
    });

    return results;
  }, [top200, sortBy, markets, caps, sectors, dropBucket, minDividend, maxRsi, showOnlyDropped]);

  // Bucket counts for the distribution bar
  const bucketCounts = useMemo(() => {
    const counts: Record<string, number> = {
      '0-5%': 0, '5-10%': 0, '10-15%': 0, '15-20%': 0, '20-25%': 0, '25-30%': 0, '30%+': 0,
    };
    for (const stock of top200) {
      const drop = stock.fiftyTwoWeekHigh > 0
        ? ((stock.fiftyTwoWeekHigh - stock.price) / stock.fiftyTwoWeekHigh) * 100
        : 0;
      if (markets.length > 0 && !markets.includes(stock.market)) continue;
      if (caps.length > 0 && !caps.includes(stock.capCategory)) continue;
      if (sectors.length > 0 && !sectors.includes(stock.sector ?? '')) continue;
      const bucket = getDropBucket(drop);
      counts[bucket] = (counts[bucket] || 0) + 1;
    }
    return counts;
  }, [top200, markets, caps, sectors]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold t-primary">Most Owned Stocks</h1>
          <p className="text-sm t-muted mt-1">Top 200 largest companies by market cap — find quality names on sale</p>
        </div>
        <span className="badge bg-accent/15 text-accent-light ring-1 ring-accent/30 text-sm">
          {filteredStocks.length} of {top200.length}
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
            <p>
              This page shows the <strong className="t-secondary">top 200 largest companies by market cap</strong> —
              these are the biggest, most established companies in the market.
              The <strong className="t-secondary">institutional holder count</strong> shows how many funds, pensions, and hedge funds own each stock.
            </p>
            <p>
              When one of these quality stocks <strong className="t-secondary">drops significantly from its 52-week high</strong>,
              it could be a buying opportunity. The drop percentage shows how much "discount" you're getting from the peak price.
            </p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li><strong className="t-secondary">5-10% drop</strong> — Normal pullback, may continue dropping</li>
              <li><strong className="t-secondary">10-15% drop</strong> — Getting interesting, start watching closely</li>
              <li><strong className="t-secondary">15-20% drop</strong> — Significant correction, good entry if fundamentals are intact</li>
              <li><strong className="t-secondary">20-30%+ drop</strong> — Deep discount on quality — investigate why it dropped. If temporary issue, could be excellent buy</li>
            </ul>
            <p className="text-xs mt-2 pt-2 border-t border-surface-border">
              <strong>Strategy tip:</strong> Filter for Large cap + 15%+ drop + RSI below 40 + positive dividend yield to find
              blue-chip stocks that are temporarily beaten down but still paying dividends. Set up <strong>Top Owned Drop</strong> alerts
              to get notified when these stocks hit your target discount level.
            </p>
          </div>
        </details>
      </div>

      {/* Drop distribution */}
      <div className="card p-4">
        <div className="text-xs font-semibold t-tertiary uppercase tracking-wider mb-3">
          Drop from 52-Week High — Distribution of Top 200
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {Object.entries(bucketCounts).map(([bucket, count]) => {
            const num = parseInt(bucket);
            const isSelected = dropBucket !== 'all' && bucket.startsWith(dropBucket);
            return (
              <button
                key={bucket}
                onClick={() => {
                  if (isNaN(num)) {
                    setDropBucket(bucket.startsWith('30') ? '30' : 'all');
                  } else {
                    setDropBucket(num.toString() as DropBucket);
                  }
                }}
                className={`p-3 rounded-lg text-center transition-all border ${
                  count > 0 ? 'cursor-pointer hover:border-accent/30' : 'opacity-40'
                } ${
                  isSelected
                    ? 'bg-accent/10 border-accent/30'
                    : 'bg-surface-tertiary border-surface-border'
                }`}
              >
                <div className="text-lg font-bold font-mono t-primary">{count}</div>
                <div className="text-[10px] t-muted mt-0.5">{bucket}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Min Drop */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium t-muted">Min Drop:</span>
            {([['all', 'Any'], ['5', '5%+'], ['10', '10%+'], ['15', '15%+'], ['20', '20%+'], ['30', '30%+']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setDropBucket(val as DropBucket)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  dropBucket === val
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

          {/* Min Dividend Yield */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium t-muted">Min Div:</span>
            {[0, 1, 2, 3, 4].map(d => (
              <button
                key={d}
                onClick={() => setMinDividend(d)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  minDividend === d
                    ? 'bg-accent/15 text-accent-light ring-1 ring-accent/30'
                    : 'bg-surface-tertiary t-tertiary hover:t-secondary'
                }`}
              >
                {d === 0 ? 'Any' : `${d}%+`}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-surface-border" />

          {/* Max RSI */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium t-muted">Max RSI:</span>
            {[100, 50, 40, 30].map(r => (
              <button
                key={r}
                onClick={() => setMaxRsi(r)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  maxRsi === r
                    ? 'bg-accent/15 text-accent-light ring-1 ring-accent/30'
                    : 'bg-surface-tertiary t-tertiary hover:t-secondary'
                }`}
              >
                {r === 100 ? 'Any' : `<${r}`}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-surface-border" />

          {/* Sort */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium t-muted">Sort:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortKey)}
              className="text-xs bg-surface-tertiary border border-surface-border rounded-md px-2 py-1 t-secondary"
            >
              <option value="dropPct">Biggest Drop</option>
              <option value="marketCap">Largest Market Cap</option>
              <option value="institutionsCount">Most Institutions</option>
              <option value="ownership">Highest Ownership %</option>
              <option value="score">Composite Score</option>
              <option value="dividendYield">Dividend Yield</option>
              <option value="rsi">Lowest RSI</option>
            </select>
          </div>

          <div className="w-px h-5 bg-surface-border" />

          <label className="flex items-center gap-1.5 cursor-pointer text-xs t-muted">
            <input
              type="checkbox"
              checked={showOnlyDropped}
              onChange={e => setShowOnlyDropped(e.target.checked)}
              className="accent-accent w-3 h-3"
            />
            <span>Dropped only</span>
          </label>

          {(markets.length > 0 || caps.length > 0 || sectors.length > 0 || minDividend > 0 || maxRsi < 100 || dropBucket !== 'all') && (
            <>
              <div className="w-px h-5 bg-surface-border" />
              <button
                onClick={() => { setMarkets([]); setCaps([]); setSectors([]); setMinDividend(0); setMaxRsi(100); setDropBucket('all'); }}
                className="px-2.5 py-1 rounded-md text-xs font-medium text-bearish bg-bearish/10 hover:bg-bearish/20 transition-all"
              >
                Reset
              </button>
            </>
          )}
        </div>
      </div>

      {/* Results */}
      {filteredStocks.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">&#128176;</div>
          <h3 className="text-lg font-semibold t-secondary mb-1">No matching stocks</h3>
          <p className="t-muted text-sm">
            Try adjusting your filters — reduce the minimum drop percentage or remove sector/dividend filters.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredStocks.map(({ stock, ownershipPct, dropFromHigh, bucket }) => (
            <Link
              key={stock.ticker}
              to={`/stock/${stock.ticker}`}
              className="card p-5 block hover:border-accent/30 hover:shadow-glow-blue transition-all"
            >
              {/* Header row */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                    <span className="text-lg font-bold t-primary">{stock.ticker}</span>
                    <span className="t-tertiary text-sm">{stock.name}</span>
                    <MarketTag market={stock.market} />
                    <CapTag cap={stock.capCategory} />
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-surface-tertiary t-secondary ring-1 ring-surface-border">
                      {formatMarketCap(stock.marketCap)}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-accent/15 text-accent-light ring-1 ring-accent/30">
                      {ownershipPct.toFixed(0)}% inst. owned
                    </span>
                    {stock.institutionsCount != null && stock.institutionsCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-sky-600/12 text-sky-600 dark:text-sky-400 ring-1 ring-sky-600/20">
                        {stock.institutionsCount.toLocaleString()} holders
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <PriceDisplay value={stock.price} market={stock.market} />
                    <ChangePercent value={stock.changePercent} />
                    {stock.rsi != null && (
                      <span className="t-muted">
                        RSI{' '}
                        <span className={`font-mono ${stock.rsi < 30 ? 'text-bullish' : stock.rsi > 70 ? 'text-bearish' : 't-secondary'}`}>
                          {stock.rsi.toFixed(1)}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium t-muted uppercase tracking-wider mb-1">From 52W High</div>
                  <div className={`text-3xl font-bold font-mono ${
                    dropFromHigh >= 20 ? 'text-bearish' : dropFromHigh >= 10 ? 'text-neutral' : 't-secondary'
                  }`}>
                    -{dropFromHigh.toFixed(1)}%
                  </div>
                  <div className="text-xs t-muted mt-0.5">{bucket}</div>
                </div>
              </div>

              {/* Key metrics */}
              <div className="flex flex-wrap gap-3 mb-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="t-muted">52W High:</span>
                  <span className="font-mono font-medium t-primary">
                    {currencySymbol(stock.market)}{stock.fiftyTwoWeekHigh.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="t-muted">52W Low:</span>
                  <span className="font-mono font-medium t-primary">
                    {currencySymbol(stock.market)}{stock.fiftyTwoWeekLow.toFixed(2)}
                  </span>
                </div>
                {stock.dividendYield != null && stock.dividendYield > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="t-muted">Div Yield:</span>
                    <span className="font-mono font-medium text-bullish">
                      {(stock.dividendYield * 100).toFixed(2)}%
                    </span>
                  </div>
                )}
                {stock.pe != null && (
                  <div className="flex items-center gap-1.5">
                    <span className="t-muted">P/E:</span>
                    <span className="font-mono font-medium t-secondary">{stock.pe.toFixed(1)}</span>
                  </div>
                )}
                {stock.sector && (
                  <div className="flex items-center gap-1.5">
                    <span className="t-muted">Sector:</span>
                    <span className="t-secondary">{stock.sector}</span>
                  </div>
                )}
              </div>

              {/* Visual drop bar */}
              <div className="mb-3">
                <div className="flex items-center gap-2 text-[10px] t-muted mb-1">
                  <span>52W Low</span>
                  <div className="flex-1" />
                  <span>Current</span>
                  <div className="flex-1" />
                  <span>52W High</span>
                </div>
                <div className="h-2 rounded-full bg-surface-tertiary border border-surface-border relative overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-bearish/40 to-accent/40"
                    style={{ width: `${stock.fiftyTwoWeekRangePercent}%` }}
                  />
                  <div
                    className="absolute inset-y-0 w-1 bg-accent-light rounded-full"
                    style={{ left: `${Math.max(0, Math.min(100, stock.fiftyTwoWeekRangePercent))}%` }}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center gap-4 pt-3 border-t border-surface-border">
                <div className="flex items-center gap-2">
                  <span className="text-xs t-muted">Composite:</span>
                  <ScoreBadge score={stock.score.composite} size="sm" />
                </div>
                {stock.piotroskiScore != null && stock.piotroskiScore >= 5 && (
                  <span className="text-xs t-muted">Piotroski {stock.piotroskiScore}/9</span>
                )}
                {stock.yearlyUptrendYears >= 2 && (
                  <span className="text-xs t-muted">{stock.yearlyUptrendYears}yr uptrend</span>
                )}
                {stock.sma50 != null && stock.sma200 != null && stock.sma50 > stock.sma200 && (
                  <span className="text-xs text-bullish">Golden Cross</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}