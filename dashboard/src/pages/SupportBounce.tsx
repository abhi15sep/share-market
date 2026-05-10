import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { StockRecord } from '../types';
import { MarketTag, CapTag, ScoreBadge, ChangePercent, PriceDisplay } from '../components/common/Tags';
import { currencySymbol, formatMarketCap } from '../lib/format';
import MultiSelect from '../components/common/MultiSelect';

const ALL_MARKETS = ['US', 'UK', 'IN', 'HK', 'JP', 'DE', 'FR'];
const ALL_CAPS = ['Large', 'Mid', 'Small'];
const ALL_SECTORS = [
  'Communication', 'Consumer Cyclical', 'Consumer Defensive', 'Energy',
  'Financials', 'Fintech', 'Healthcare', 'Industrials', 'Materials',
  'Real Estate', 'Technology', 'Utilities',
];

interface BounceStock {
  stock: StockRecord;
  matched: string[];
  bounceScore: number;
  nearestSupport: { price: number; strength: number } | null;
  nearestResistance: { price: number; strength: number } | null;
  distanceToSupport: number;
  distanceToResistance: number;
  rr: number | null;
}

type SortKey = 'bounceScore' | 'distanceToSupport' | 'supportStrength' | 'score' | 'rsi' | 'marketCap' | 'changePercent' | 'dividendYield';

function getBounceCriteria(stock: StockRecord): {
  matched: string[];
  nearestSupport: { price: number; strength: number } | null;
  nearestResistance: { price: number; strength: number } | null;
  distanceToSupport: number;
  distanceToResistance: number;
} {
  const matched: string[] = [];
  const sr = stock.supportResistance ?? [];

  const supports = sr.filter(l => l.type === 'support').sort((a, b) => b.price - a.price);
  const resistances = sr.filter(l => l.type === 'resistance').sort((a, b) => a.price - b.price);

  const nearestSupport = supports[0] ?? null;
  const nearestResistance = resistances[0] ?? null;

  if (!nearestSupport) return { matched, nearestSupport, nearestResistance, distanceToSupport: 999, distanceToResistance: 999 };

  const distanceToSupport = ((stock.price - nearestSupport.price) / stock.price) * 100;
  const distanceToResistance = nearestResistance
    ? ((nearestResistance.price - stock.price) / stock.price) * 100
    : 999;

  // Only count "Near Support" when actually closer to support than resistance
  if (distanceToSupport >= 0 && distanceToSupport <= 4 && distanceToSupport < distanceToResistance) {
    matched.push(`Near Support (${distanceToSupport.toFixed(1)}% away)`);
  }
  if (nearestSupport.strength >= 3) matched.push(`Strong Support (${nearestSupport.strength} touches)`);
  if (stock.sma50 != null && stock.sma200 != null && stock.sma50 > stock.sma200) matched.push('Uptrend (SMA50 > SMA200)');
  if (stock.rsi != null && stock.rsi >= 30 && stock.rsi <= 50) matched.push(`Healthy Pullback (RSI ${stock.rsi.toFixed(0)})`);
  if (stock.obvTrend === 'rising' || stock.obvTrend === 'flat') matched.push('No Panic Selling (OBV OK)');
  if ((stock.pe != null && stock.pe > 0 && stock.pe < 40) || (stock.earningsGrowth != null && stock.earningsGrowth > 0))
    matched.push('Reasonable Fundamentals');
  if (stock.fiftyTwoWeekRangePercent > 40 && stock.fiftyTwoWeekRangePercent < 85) matched.push('Pulled Back from Higher Levels');

  return { matched, nearestSupport, nearestResistance, distanceToSupport, distanceToResistance };
}

export default function SupportBounce({ stocks }: { stocks: StockRecord[] }) {
  const [minScore, setMinScore] = useState(4);
  const [markets, setMarkets] = useState<string[]>([]);
  const [caps, setCaps] = useState<string[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);
  const [hasDividend, setHasDividend] = useState(false);
  const [minRR, setMinRR] = useState(0);
  const [sortBy, setSortBy] = useState<SortKey>('bounceScore');

  const bounceStocks = useMemo<BounceStock[]>(() => {
    return stocks
      .map(stock => {
        const { matched, nearestSupport, nearestResistance, distanceToSupport, distanceToResistance } = getBounceCriteria(stock);
        const risk = nearestSupport ? stock.price - nearestSupport.price : 0;
        const reward = nearestResistance ? nearestResistance.price - stock.price : 0;
        const rr = risk > 0.001 ? Math.min(reward / risk, 20) : null;
        return { stock, matched, bounceScore: matched.length, nearestSupport, nearestResistance, distanceToSupport, distanceToResistance, rr };
      })
      // Exclude stocks within 1% of resistance — they're testing resistance, not bouncing from support
      .filter(d => d.distanceToResistance >= 1)
      .filter(d => d.bounceScore >= minScore)
      .filter(d => minRR === 0 || (d.rr != null && d.rr >= minRR))
      .filter(d => markets.length === 0 || markets.includes(d.stock.market))
      .filter(d => caps.length === 0 || caps.includes(d.stock.capCategory))
      .filter(d => sectors.length === 0 || sectors.includes(d.stock.sector ?? ''))
      .filter(d => !hasDividend || (d.stock.dividendYield != null && d.stock.dividendYield > 0))
      .sort((a, b) => {
        switch (sortBy) {
          case 'bounceScore': return b.bounceScore - a.bounceScore || a.distanceToSupport - b.distanceToSupport;
          case 'distanceToSupport': return a.distanceToSupport - b.distanceToSupport;
          case 'supportStrength': return (b.nearestSupport?.strength ?? 0) - (a.nearestSupport?.strength ?? 0);
          case 'score': return b.stock.score.composite - a.stock.score.composite;
          case 'rsi': return (a.stock.rsi ?? 100) - (b.stock.rsi ?? 100);
          case 'marketCap': return b.stock.marketCap - a.stock.marketCap;
          case 'changePercent': return a.stock.changePercent - b.stock.changePercent;
          case 'dividendYield': return (b.stock.dividendYield ?? 0) - (a.stock.dividendYield ?? 0);
          default: return 0;
        }
      });
  }, [stocks, minScore, minRR, markets, caps, sectors, hasDividend, sortBy]);

  const anyFilterActive = markets.length > 0 || caps.length > 0 || sectors.length > 0 || hasDividend || minScore > 4 || minRR > 0;

  const resetFilters = () => {
    setMarkets([]); setCaps([]); setSectors([]); setHasDividend(false); setMinScore(4); setMinRR(0);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold t-primary">Support Bounce</h1>
          <p className="text-sm t-muted mt-1">Stocks pulling back to support — potential bounce candidates</p>
        </div>
        <span className="badge bg-accent/15 text-accent-light ring-1 ring-accent/30 text-sm">
          {bounceStocks.length} match{bounceStocks.length !== 1 ? 'es' : ''}
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
            <p>Finds stocks that have pulled back from higher prices and are now near a <strong className="t-secondary">support level</strong> — a price zone where buyers have historically stepped in.</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li><strong className="t-secondary">Near Support</strong> — Price within 4% of a tested support level</li>
              <li><strong className="t-secondary">Strong Support</strong> — Support tested 3+ times (more reliable)</li>
              <li><strong className="t-secondary">Uptrend Intact</strong> — SMA50 still above SMA200</li>
              <li><strong className="t-secondary">Healthy Pullback</strong> — RSI between 30-50, cooled off but not broken</li>
              <li><strong className="t-secondary">No Panic Selling</strong> — OBV flat or rising, smart money not exiting</li>
              <li><strong className="t-secondary">Reasonable Fundamentals</strong> — P/E under 40 or positive earnings growth</li>
              <li><strong className="t-secondary">Pulled Back from Higher Levels</strong> — Was trading higher recently (40-85% of 52-week range)</li>
            </ul>
            <p className="text-xs mt-2 pt-2 border-t border-surface-border">
              <strong>Strategy tip:</strong> Look for bullish candlestick patterns (hammer, engulfing) at the support level for extra confirmation before buying.
            </p>
          </div>
        </details>
      </div>

      {/* Filters */}
      <div className="card p-3">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Min Bounce Score */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium t-muted">Min Score:</span>
            {[2, 3, 4, 5].map(n => (
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

          {/* Min Risk/Reward */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium t-muted">Min R/R:</span>
            {([[0, 'Any'], [1.5, '1.5:1+'], [2, '2:1+'], [3, '3:1+']] as [number, string][]).map(([val, label]) => (
              <button
                key={String(val)}
                onClick={() => setMinRR(val)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  minRR === val
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
              <option value="bounceScore">Bounce Score</option>
              <option value="distanceToSupport">Closest to Support</option>
              <option value="supportStrength">Support Strength</option>
              <option value="marketCap">Largest Market Cap</option>
              <option value="score">Composite Score</option>
              <option value="rsi">Lowest RSI</option>
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
      {bounceStocks.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">&#9974;</div>
          <h3 className="text-lg font-semibold t-secondary mb-1">No support bounce candidates right now</h3>
          <p className="t-muted text-sm">
            Stocks qualify when {minScore}+ support-bounce signals align. Try lowering the minimum score or adjusting filters.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {bounceStocks.map(({ stock, matched, bounceScore, nearestSupport, nearestResistance, distanceToSupport, distanceToResistance, rr }) => (
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
                    {stock.rsi != null && (
                      <span className="t-muted">
                        RSI <span className={`font-mono ${stock.rsi < 40 ? 'text-bullish' : stock.rsi > 70 ? 'text-bearish' : 't-secondary'}`}>{stock.rsi.toFixed(1)}</span>
                      </span>
                    )}
                    {stock.dividendYield != null && stock.dividendYield > 0 && (
                      <span className="t-muted">Div <span className="font-mono text-bullish">{stock.dividendYield.toFixed(2)}%</span></span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium t-muted uppercase tracking-wider mb-1">Bounce Score</div>
                  <div className={`text-3xl font-bold font-mono ${bounceScore >= 5 ? 'text-bullish' : bounceScore >= 4 ? 'text-accent-light' : 't-secondary'}`}>
                    {bounceScore}<span className="text-base t-muted">/7</span>
                  </div>
                </div>
              </div>

              {/* Support / Resistance levels */}
              <div className="flex flex-wrap gap-4 mb-3 text-xs">
                {nearestSupport && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-bullish" />
                    <span className="t-muted">Support:</span>
                    <span className="font-mono font-medium t-primary">{currencySymbol(stock.market)}{nearestSupport.price.toFixed(2)}</span>
                    <span className="t-muted">({nearestSupport.strength} touches)</span>
                    <span className="font-mono text-bullish">{distanceToSupport.toFixed(1)}% away</span>
                  </div>
                )}
                {nearestResistance && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-bearish" />
                    <span className="t-muted">Resistance:</span>
                    <span className="font-mono font-medium t-primary">{currencySymbol(stock.market)}{nearestResistance.price.toFixed(2)}</span>
                    <span className="t-muted">({nearestResistance.strength} touches)</span>
                    <span className="font-mono text-bearish">{distanceToResistance.toFixed(1)}% away</span>
                  </div>
                )}
                {rr != null && (
                  <div className="flex items-center gap-1.5">
                    <span className="t-muted">Risk/Reward:</span>
                    <span className={`font-mono font-medium ${rr >= 2 ? 'text-bullish' : rr >= 1 ? 'text-accent-light' : 'text-bearish'}`}>
                      1:{rr.toFixed(1)}{rr >= 20 ? '+' : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Matched criteria */}
              <div className="flex flex-wrap gap-2 mb-3">
                {matched.map(label => (
                  <span key={label} className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent-light ring-1 ring-accent/20">
                    {label}
                  </span>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center gap-4 pt-3 border-t border-surface-border flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs t-muted">Composite:</span>
                  <ScoreBadge score={stock.score.composite} size="sm" />
                </div>
                {stock.sector && <span className="text-xs t-muted">{stock.sector}</span>}
                {stock.marketCap > 0 && (
                  <span className="text-xs t-muted">Cap: <span className="t-secondary">{formatMarketCap(stock.marketCap, stock.market)}</span></span>
                )}
                {stock.sectorRank != null && stock.sectorCount != null && (
                  <span className="text-xs t-muted">Sector Rank: {stock.sectorRank}/{stock.sectorCount}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
