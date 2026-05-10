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

type SortKey = 'pctBelow' | 'uptrendYears' | 'score' | 'return1y' | 'strength' | 'marketCap' | 'dividendYield';
type BucketFilter = 'all' | '5' | '10' | '15' | '20' | '25';
type UptrendMode = 'any1' | 'any2' | 'any3' | 'any4' | 'consec2' | 'consec3' | 'consec4';

interface UptrendStock {
  stock: StockRecord;
  pctBelow: number;
  nearestResistance: { price: number; strength: number };
  nearestSupport: { price: number; strength: number } | null;
  bucket: string;
  qualitySignals: string[];
  positiveYears: number;
  totalYears: number;
}

function getBucket(pct: number): string {
  if (pct < 5) return '0-5%';
  if (pct < 10) return '5-10%';
  if (pct < 15) return '10-15%';
  if (pct < 20) return '15-20%';
  if (pct < 25) return '20-25%';
  return '25%+';
}

function matchesUptrendMode(yearlyReturns: number[], mode: UptrendMode): boolean {
  const positiveYears = yearlyReturns.filter(r => r > 0).length;
  const totalYears = yearlyReturns.length;

  switch (mode) {
    case 'any1': return positiveYears >= 1;
    case 'any2': return positiveYears >= 2;
    case 'any3': return positiveYears >= 3;
    case 'any4': return positiveYears >= 4;
    case 'consec2': {
      // Most recent 2 years must all be positive
      if (totalYears < 2) return false;
      return yearlyReturns[0] > 0 && yearlyReturns[1] > 0;
    }
    case 'consec3': {
      if (totalYears < 3) return false;
      return yearlyReturns[0] > 0 && yearlyReturns[1] > 0 && yearlyReturns[2] > 0;
    }
    case 'consec4': {
      if (totalYears < 4) return false;
      return yearlyReturns[0] > 0 && yearlyReturns[1] > 0 && yearlyReturns[2] > 0 && yearlyReturns[3] > 0;
    }
    default: return false;
  }
}

function getQualitySignals(stock: StockRecord): string[] {
  const signals: string[] = [];
  if (stock.sma50 != null && stock.sma200 != null && stock.sma50 > stock.sma200)
    signals.push('Golden Cross (SMA50 > SMA200)');
  if (stock.sma200Slope != null && stock.sma200Slope > 0)
    signals.push('SMA200 Trending Up');
  if (stock.rsi != null && stock.rsi >= 30 && stock.rsi <= 55)
    signals.push(`Healthy RSI (${stock.rsi.toFixed(0)})`);
  if (stock.obvTrend === 'rising' || stock.obvTrend === 'flat')
    signals.push('Volume Healthy (OBV OK)');
  if (stock.returnOnEquity != null && stock.returnOnEquity > 0.12)
    signals.push(`Strong ROE (${(stock.returnOnEquity * 100).toFixed(0)}%)`);
  if (stock.earningsGrowth != null && stock.earningsGrowth > 0)
    signals.push('Positive Earnings Growth');
  if (stock.piotroskiScore != null && stock.piotroskiScore >= 6)
    signals.push(`Piotroski ${stock.piotroskiScore}/9`);
  if (stock.accDistRating === 'A' || stock.accDistRating === 'B')
    signals.push(`Accumulation (${stock.accDistRating})`);
  return signals;
}

const UPTREND_OPTIONS: { value: UptrendMode; label: string; desc: string }[] = [
  { value: 'any1', label: '1yr+', desc: 'At least 1 positive year' },
  { value: 'any2', label: '2yr+', desc: 'At least 2 positive years (any)' },
  { value: 'any3', label: '3yr+', desc: 'At least 3 positive years (any)' },
  { value: 'any4', label: '4yr+', desc: 'All 4 years positive' },
  { value: 'consec2', label: '2yr strict', desc: 'Last 2 years both positive' },
  { value: 'consec3', label: '3yr strict', desc: 'Last 3 years all positive' },
  { value: 'consec4', label: '4yr strict', desc: 'Last 4 years all positive' },
];

export default function YearlyUptrend({ stocks }: { stocks: StockRecord[] }) {
  const [uptrendMode, setUptrendMode] = useState<UptrendMode>('consec2');
  const [sortBy, setSortBy] = useState<SortKey>('pctBelow');
  const [markets, setMarkets] = useState<string[]>([]);
  const [caps, setCaps] = useState<string[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);
  const [hasDividend, setHasDividend] = useState(false);
  const [bucketFilter, setBucketFilter] = useState<BucketFilter>('5');

  const uptrendStocks = useMemo(() => {
    const results: UptrendStock[] = [];

    for (const stock of stocks) {
      if (!matchesUptrendMode(stock.yearlyReturns, uptrendMode)) continue;
      if (stock.pctBelowResistance == null || stock.pctBelowResistance <= 0) continue;
      if (markets.length > 0 && !markets.includes(stock.market)) continue;
      if (caps.length > 0 && !caps.includes(stock.capCategory)) continue;
      if (sectors.length > 0 && !sectors.includes(stock.sector ?? '')) continue;
      if (hasDividend && !(stock.dividendYield != null && stock.dividendYield > 0)) continue;

      const sr = stock.supportResistance ?? [];
      const resistances = sr.filter(l => l.type === 'resistance').sort((a, b) => a.price - b.price);
      const supports = sr.filter(l => l.type === 'support').sort((a, b) => b.price - a.price);
      if (resistances.length === 0) continue;

      const pctBelow = stock.pctBelowResistance;
      const bucket = getBucket(pctBelow);

      if (bucketFilter !== 'all') {
        const minBucket = parseInt(bucketFilter);
        if (pctBelow < minBucket) continue;
      }

      const positiveYears = stock.yearlyReturns.filter(r => r > 0).length;

      results.push({
        stock,
        pctBelow,
        nearestResistance: resistances[0],
        nearestSupport: supports[0] ?? null,
        bucket,
        qualitySignals: getQualitySignals(stock),
        positiveYears,
        totalYears: stock.yearlyReturns.length,
      });
    }

    results.sort((a, b) => {
      switch (sortBy) {
        case 'pctBelow':
          return b.pctBelow - a.pctBelow;
        case 'uptrendYears':
          return b.positiveYears - a.positiveYears || b.pctBelow - a.pctBelow;
        case 'score':
          return b.stock.score.composite - a.stock.score.composite;
        case 'return1y':
          return b.stock.priceReturn1y - a.stock.priceReturn1y;
        case 'strength':
          return b.nearestResistance.strength - a.nearestResistance.strength || b.pctBelow - a.pctBelow;
        case 'marketCap':
          return b.stock.marketCap - a.stock.marketCap;
        case 'dividendYield':
          return (b.stock.dividendYield ?? 0) - (a.stock.dividendYield ?? 0);
        default:
          return 0;
      }
    });

    return results;
  }, [stocks, uptrendMode, sortBy, markets, caps, sectors, hasDividend, bucketFilter]);

  // Bucket summary counts
  const bucketCounts = useMemo(() => {
    const counts: Record<string, number> = { '0-5%': 0, '5-10%': 0, '10-15%': 0, '15-20%': 0, '20-25%': 0, '25%+': 0 };
    for (const stock of stocks) {
      if (!matchesUptrendMode(stock.yearlyReturns, uptrendMode)) continue;
      if (stock.pctBelowResistance == null || stock.pctBelowResistance <= 0) continue;
      if (markets.length > 0 && !markets.includes(stock.market)) continue;
      if (caps.length > 0 && !caps.includes(stock.capCategory)) continue;
      if (sectors.length > 0 && !sectors.includes(stock.sector ?? '')) continue;
      if (hasDividend && !(stock.dividendYield != null && stock.dividendYield > 0)) continue;
      const bucket = getBucket(stock.pctBelowResistance);
      counts[bucket] = (counts[bucket] || 0) + 1;
    }
    return counts;
  }, [stocks, uptrendMode, markets, caps, sectors, hasDividend]);

  const selectedOption = UPTREND_OPTIONS.find(o => o.value === uptrendMode)!;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold t-primary">Yearly Uptrend</h1>
          <p className="text-sm t-muted mt-1">Multi-year uptrending stocks currently below resistance — buy the discount</p>
        </div>
        <span className="badge bg-bullish/15 text-bullish ring-1 ring-bullish/30 text-sm">
          {uptrendStocks.length} match{uptrendStocks.length !== 1 ? 'es' : ''}
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
            <p>
              This screen finds stocks with a <strong className="t-secondary">proven upward trend over multiple years</strong> that
              are currently trading <strong className="t-secondary">below their resistance level</strong>. You're getting a "discount"
              on a stock that has a strong long-term track record.
            </p>
            <p className="font-medium t-secondary">Two types of uptrend filters:</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li><strong className="t-secondary">Flexible (1yr+ / 2yr+ / 3yr+ / 4yr+)</strong> — Counts total positive years out of available data. A stock with +20%, -5%, +15%, +30% has <strong>3 positive years</strong>. This catches great stocks that had one bad year but are overall strong performers.</li>
              <li><strong className="t-secondary">Strict (2yr / 3yr / 4yr strict)</strong> — Requires the most recent N years to ALL be positive, with no down year. Use this for the most consistent uptrenders only.</li>
            </ul>
            <ul className="list-disc list-inside space-y-1 ml-1 mt-2">
              <li><strong className="t-secondary">Below Resistance</strong> — Current price is below the nearest resistance level</li>
              <li><strong className="t-secondary">% Below Resistance</strong> — Higher % = bigger pullback = potentially better entry point</li>
            </ul>
            <p className="text-xs mt-2 pt-2 border-t border-surface-border">
              <strong>Strategy tip:</strong> The default "2yr strict" requires both recent years to be positive, filtering out stocks in active downtrends. Use "2yr+" for a wider pool, or "3yr strict" for the most consistent uptrenders. Stocks 10-20% below resistance with multiple quality signals are the best candidates.
              Set up an <strong>Uptrend Below Resistance</strong> alert in Alert Settings to get Telegram notifications.
            </p>
          </div>
        </details>
      </div>

      {/* Bucket summary bar */}
      <div className="card p-4">
        <div className="text-xs font-semibold t-tertiary uppercase tracking-wider mb-3">Discount Distribution</div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {Object.entries(bucketCounts).map(([bucket, count]) => (
            <button
              key={bucket}
              onClick={() => {
                const num = parseInt(bucket);
                setBucketFilter(isNaN(num) ? (bucket.startsWith('25') ? '25' : 'all') : num.toString() as BucketFilter);
              }}
              className={`p-3 rounded-lg text-center transition-all border ${
                count > 0 ? 'cursor-pointer hover:border-bullish/30' : 'opacity-40'
              } ${
                bucketFilter !== 'all' && bucket.startsWith(bucketFilter)
                  ? 'bg-bullish/10 border-bullish/30'
                  : 'bg-surface-tertiary border-surface-border'
              }`}
            >
              <div className="text-lg font-bold font-mono t-primary">{count}</div>
              <div className="text-xs t-muted mt-0.5">{bucket}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Uptrend mode */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium t-muted">Uptrend:</span>
            <div className="flex gap-1 flex-wrap">
              {UPTREND_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setUptrendMode(opt.value)}
                  title={opt.desc}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    uptrendMode === opt.value
                      ? 'bg-bullish/15 text-bullish ring-1 ring-bullish/30'
                      : 'bg-surface-tertiary t-tertiary hover:t-secondary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="w-px h-5 bg-surface-border" />

          {/* Min Discount */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium t-muted">Discount:</span>
            {([['all', 'Any'], ['5', '5%+'], ['10', '10%+'], ['15', '15%+'], ['20', '20%+']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setBucketFilter(val as BucketFilter)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  bucketFilter === val
                    ? 'bg-bullish/15 text-bullish ring-1 ring-bullish/30'
                    : 'bg-surface-tertiary t-tertiary hover:t-secondary'
                }`}
              >
                {label}
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
              <option value="pctBelow">Biggest Discount</option>
              <option value="uptrendYears">Most Positive Years</option>
              <option value="marketCap">Largest Market Cap</option>
              <option value="score">Composite Score</option>
              <option value="return1y">1Y Return</option>
              <option value="strength">Resistance Strength</option>
              <option value="dividendYield">Dividend Yield</option>
            </select>
          </div>

          {(markets.length > 0 || caps.length > 0 || sectors.length > 0 || hasDividend || bucketFilter !== '5' || uptrendMode !== 'consec2') && (
            <>
              <div className="w-px h-5 bg-surface-border" />
              <button
                onClick={() => { setMarkets([]); setCaps([]); setSectors([]); setHasDividend(false); setBucketFilter('5'); setUptrendMode('consec2'); }}
                className="px-2.5 py-1 rounded-md text-xs font-medium text-bearish bg-bearish/10 hover:bg-bearish/20 transition-all"
              >
                Reset
              </button>
            </>
          )}
        </div>
      </div>

      {/* Active filter description */}
      <div className="text-xs t-muted px-1">
        Showing: <span className="font-medium t-secondary">{selectedOption.desc}</span>
        {bucketFilter !== 'all' && <span> &middot; {bucketFilter}%+ below resistance</span>}
        {markets.length > 0 && <span> &middot; {markets.join(', ')}</span>}
        {caps.length > 0 && <span> &middot; {caps.join(', ')} cap</span>}
        {sectors.length > 0 && <span> &middot; {sectors.length} sector{sectors.length > 1 ? 's' : ''}</span>}
        {hasDividend && <span> &middot; dividend stocks</span>}
      </div>

      {/* Results */}
      {uptrendStocks.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">&#128200;</div>
          <h3 className="text-lg font-semibold t-secondary mb-1">No uptrend discount candidates found</h3>
          <p className="t-muted text-sm">
            No stocks match "{selectedOption.desc}" and are currently below resistance.
            Try a less strict uptrend filter or lower the discount threshold.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {uptrendStocks.map(({ stock, pctBelow, nearestResistance, nearestSupport, bucket, qualitySignals, positiveYears, totalYears }) => (
            <Link
              key={stock.ticker}
              to={`/stock/${stock.ticker}`}
              className="card p-5 block hover:border-bullish/30 hover:shadow-glow-green transition-all"
            >
              {/* Header row */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                    <span className="text-lg font-bold t-primary">{stock.ticker}</span>
                    <span className="t-tertiary text-sm">{stock.name}</span>
                    <MarketTag market={stock.market} />
                    <CapTag cap={stock.capCategory} />
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-bullish/15 text-bullish ring-1 ring-bullish/30">
                      {positiveYears}/{totalYears} yrs up
                    </span>
                    {stock.changePercent <= -10 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-bearish/20 text-bearish ring-1 ring-bearish/30">Sharp Drop {stock.changePercent.toFixed(1)}%</span>
                    )}
                    {stock.changePercent > -10 && stock.changePercent <= -5 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30">Down {stock.changePercent.toFixed(1)}%</span>
                    )}
                    {stock.changePercent >= 10 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-bearish/20 text-bearish ring-1 ring-bearish/30">Strong Move +{stock.changePercent.toFixed(1)}%</span>
                    )}
                    {stock.changePercent >= 5 && stock.changePercent < 10 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30">Up +{stock.changePercent.toFixed(1)}%</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <PriceDisplay value={stock.price} market={stock.market} />
                    <ChangePercent value={stock.changePercent} />
                    {stock.rsi != null && (
                      <span className="t-muted">
                        RSI{' '}
                        <span className={`font-mono ${stock.rsi < 40 ? 'text-bullish' : stock.rsi > 70 ? 'text-bearish' : 't-secondary'}`}>
                          {stock.rsi.toFixed(1)}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium t-muted uppercase tracking-wider mb-1">Below Resistance</div>
                  <div className={`text-3xl font-bold font-mono ${
                    pctBelow >= 15 ? 'text-bullish' : pctBelow >= 10 ? 'text-accent-light' : 't-secondary'
                  }`}>
                    {pctBelow.toFixed(1)}%
                  </div>
                  <div className="text-xs t-muted mt-0.5">{bucket}</div>
                </div>
              </div>

              {/* Price levels */}
              <div className="flex flex-wrap gap-4 mb-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-bearish" />
                  <span className="t-muted">Resistance:</span>
                  <span className="font-mono font-medium t-primary">
                    {currencySymbol(stock.market)}{nearestResistance.price.toFixed(2)}
                  </span>
                  <span className="t-muted">({nearestResistance.strength} touches)</span>
                </div>
                {nearestSupport && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-bullish" />
                    <span className="t-muted">Support:</span>
                    <span className="font-mono font-medium t-primary">
                      {currencySymbol(stock.market)}{nearestSupport.price.toFixed(2)}
                    </span>
                    <span className="t-muted">({nearestSupport.strength} touches)</span>
                  </div>
                )}
              </div>

              {/* Yearly returns - visual bar for each year */}
              <div className="flex flex-wrap gap-2 mb-3">
                {stock.yearlyReturns.map((ret, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono ${
                      ret > 0
                        ? 'bg-bullish/10 text-bullish ring-1 ring-bullish/20'
                        : 'bg-bearish/10 text-bearish ring-1 ring-bearish/20'
                    }`}
                  >
                    <span className="font-medium opacity-60">Y{i + 1}</span>
                    <span className="font-bold">{ret >= 0 ? '+' : ''}{(ret * 100).toFixed(1)}%</span>
                  </div>
                ))}
                {stock.yearlyReturns.length >= 2 && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono bg-surface-tertiary t-secondary ring-1 ring-surface-border">
                    <span className="font-medium opacity-60">Total</span>
                    <span className={`font-bold ${stock.priceReturn3y > 0 ? 'text-bullish' : 'text-bearish'}`}>
                      {stock.priceReturn3y >= 0 ? '+' : ''}{(stock.priceReturn3y * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Quality signals */}
              {qualitySignals.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {qualitySignals.map(label => (
                    <span
                      key={label}
                      className="px-2 py-0.5 rounded-full text-xs font-medium bg-bullish/10 text-bullish ring-1 ring-bullish/20"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center gap-4 pt-3 border-t border-surface-border">
                <div className="flex items-center gap-2">
                  <span className="text-xs t-muted">Composite:</span>
                  <ScoreBadge score={stock.score.composite} size="sm" />
                </div>
                {stock.sector && (
                  <span className="text-xs t-muted">{stock.sector}</span>
                )}
                {stock.minerviniChecks.passed >= 5 && (
                  <span className="text-xs t-muted">
                    Minervini {stock.minerviniChecks.passed}/8
                  </span>
                )}
                {stock.piotroskiScore != null && stock.piotroskiScore >= 5 && (
                  <span className="text-xs t-muted">
                    Piotroski {stock.piotroskiScore}/9
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}