import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { StockRecord } from '../types';
import { MarketTag, CapTag, ScoreBadge, ChangePercent, PriceDisplay } from '../components/common/Tags';
import { currencySymbol } from '../lib/format';

type SortKey = 'changePercent' | 'institutionOwnership' | 'dividendYield' | 'rsi' | 'marketCap' | 'volumeRatio' | 'score' | 'beta';
type CapFilter = 'all' | 'Large' | 'Mid' | 'Small';
type DividendFilter = 'any' | 'hasDividend' | '1' | '2' | '3' | '4';
type GainThreshold = '1' | '2' | '3' | '5' | '10';
type MarketFilter = 'all' | 'US' | 'UK' | 'IN' | 'DE' | 'FR' | 'JP' | 'HK';

function fmtCap(mc: number): string {
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(1)}T`;
  if (mc >= 1e9) return `$${(mc / 1e9).toFixed(1)}B`;
  if (mc >= 1e6) return `$${(mc / 1e6).toFixed(0)}M`;
  return `$${mc.toLocaleString()}`;
}

function getSectors(stocks: StockRecord[]): string[] {
  const sectors = new Set(stocks.map(s => s.sector).filter(Boolean));
  return ['all', ...Array.from(sectors).sort()];
}

function gainColor(pct: number): string {
  if (pct >= 10) return 'text-bullish';
  if (pct >= 5) return 'text-emerald-500 dark:text-emerald-400';
  if (pct >= 3) return 'text-green-600 dark:text-green-400';
  return 't-secondary';
}

function gainBg(pct: number): string {
  if (pct >= 10) return 'border-bullish/25 hover:border-bullish/50 hover:shadow-glow-blue';
  if (pct >= 5) return 'border-emerald-500/20 hover:border-emerald-500/40';
  if (pct >= 3) return 'border-green-600/20 hover:border-green-600/40';
  return 'hover:border-accent/30';
}

export default function RisingStocks({ stocks }: { stocks: StockRecord[] }) {
  const [threshold, setThreshold] = useState<GainThreshold>('1');
  const [capFilter, setCapFilter] = useState<CapFilter>('all');
  const [marketFilter, setMarketFilter] = useState<MarketFilter>('all');
  const [dividendFilter, setDividendFilter] = useState<DividendFilter>('any');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortKey>('changePercent');
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const [notifEnabled, setNotifEnabled] = useState(() => {
    try { return localStorage.getItem('sm-rising-notif') === 'true'; } catch { return false; }
  });
  const [notifiedTickers, setNotifiedTickers] = useState<Set<string>>(new Set());

  const sectors = useMemo(() => getSectors(stocks), [stocks]);
  const minGain = parseFloat(threshold);

  const rising = useMemo(() => {
    return stocks.filter(s => {
      if (s.changePercent < minGain) return false;
      if (capFilter !== 'all' && s.capCategory !== capFilter) return false;
      if (marketFilter !== 'all' && s.market !== marketFilter) return false;
      if (sectorFilter !== 'all' && s.sector !== sectorFilter) return false;
      if (dividendFilter === 'hasDividend') {
        if (!s.dividendYield || s.dividendYield <= 0) return false;
      } else if (dividendFilter !== 'any') {
        const minYield = parseFloat(dividendFilter);
        const dy = (s.dividendYield ?? 0) * 100;
        if (dy < minYield) return false;
      }
      return true;
    });
  }, [stocks, minGain, capFilter, marketFilter, sectorFilter, dividendFilter]);

  const sorted = useMemo(() => {
    return [...rising].sort((a, b) => {
      switch (sortBy) {
        case 'changePercent': return b.changePercent - a.changePercent;
        case 'institutionOwnership': return (b.heldPercentInstitutions ?? 0) - (a.heldPercentInstitutions ?? 0);
        case 'dividendYield': return (b.dividendYield ?? 0) - (a.dividendYield ?? 0);
        case 'rsi': return (b.rsi ?? 0) - (a.rsi ?? 0);
        case 'marketCap': return b.marketCap - a.marketCap;
        case 'volumeRatio': return b.volumeRatio - a.volumeRatio;
        case 'score': return b.score.composite - a.score.composite;
        case 'beta': return (b.beta ?? 0) - (a.beta ?? 0);
        default: return 0;
      }
    });
  }, [rising, sortBy]);

  // Summary stats
  const stats = useMemo(() => {
    const all = stocks.filter(s => s.changePercent > 0);
    return {
      up1: stocks.filter(s => s.changePercent >= 1).length,
      up3: stocks.filter(s => s.changePercent >= 3).length,
      up5: stocks.filter(s => s.changePercent >= 5).length,
      up10: stocks.filter(s => s.changePercent >= 10).length,
      avgGain: all.length > 0 ? all.reduce((s, x) => s + x.changePercent, 0) / all.length : 0,
      withDividend: stocks.filter(s => s.changePercent >= 1 && s.dividendYield && s.dividendYield > 0).length,
    };
  }, [stocks]);

  // Notifications for stocks up >5%
  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    if (result === 'granted') {
      setNotifEnabled(true);
      localStorage.setItem('sm-rising-notif', 'true');
    }
  }, []);

  const toggleNotif = useCallback(() => {
    if (!notifEnabled && notifPermission !== 'granted') {
      requestPermission();
      return;
    }
    const next = !notifEnabled;
    setNotifEnabled(next);
    localStorage.setItem('sm-rising-notif', next ? 'true' : 'false');
  }, [notifEnabled, notifPermission, requestPermission]);

  useEffect(() => {
    if (!notifEnabled || notifPermission !== 'granted') return;
    const bigGainers = stocks.filter(s => s.changePercent >= 5);
    const newTickers = bigGainers.filter(s => !notifiedTickers.has(s.ticker));
    if (newTickers.length === 0) return;

    newTickers.forEach(s => {
      try {
        new Notification(`${s.ticker} up +${s.changePercent.toFixed(1)}%`, {
          body: `${s.name} gained ${s.changePercent.toFixed(2)}% to ${currencySymbol(s.market)}${s.price.toFixed(2)}`,
          icon: '/icons/icon-192.svg',
        });
      } catch { /* notifications blocked */ }
    });

    setNotifiedTickers(prev => {
      const next = new Set(prev);
      newTickers.forEach(s => next.add(s.ticker));
      return next;
    });
  }, [stocks, notifEnabled, notifPermission, notifiedTickers]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold t-primary">Rising Stocks</h1>
          <p className="text-sm t-muted mt-1">Stocks up today — spot momentum, breakouts, and dividend gainers</p>
        </div>
        <span className="badge bg-bullish/15 text-bullish ring-1 ring-bullish/30 text-sm">
          {sorted.length} stocks
        </span>
        <button
          onClick={toggleNotif}
          title={notifEnabled ? 'Disable alerts for stocks up >5%' : 'Enable alerts for stocks up >5%'}
          className={`ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
            notifEnabled
              ? 'bg-bullish/10 border-bullish/30 text-bullish'
              : 'bg-surface-tertiary border-surface-border t-tertiary hover:t-secondary'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill={notifEnabled ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {notifEnabled ? 'Alerts on (>5%)' : 'Alert me (>5%)'}
        </button>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Up 1%+', value: stats.up1, color: 't-secondary' },
          { label: 'Up 3%+', value: stats.up3, color: 'text-green-600 dark:text-green-400' },
          { label: 'Up 5%+', value: stats.up5, color: 'text-emerald-500 dark:text-emerald-400' },
          { label: 'Up 10%+', value: stats.up10, color: 'text-bullish' },
          { label: 'Avg gain today', value: `+${stats.avgGain.toFixed(2)}%`, color: 'text-bullish', isText: true },
          { label: 'With dividend', value: stats.withDividend, color: 'text-teal-600 dark:text-teal-400' },
        ].map(({ label, value, color, isText }) => (
          <div key={label} className="card p-3 text-center">
            <div className={`text-xl font-bold font-mono ${color}`}>{isText ? value : value}</div>
            <div className="text-[11px] t-muted mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* How to use */}
      <div className="card p-4 bg-bullish/5 border-bullish/15">
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium t-secondary select-none">
            <span className="text-xs t-muted group-open:rotate-90 transition-transform">&#9654;</span>
            How to use this page
          </summary>
          <div className="mt-3 text-sm t-muted space-y-2">
            <p>
              Every stock here is up <strong className="t-secondary">at least {threshold}%</strong> today.
              Use filters to find high-quality gainers worth investigating — not every rise is worth chasing.
            </p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li><strong className="t-secondary">Volume Ratio &gt;2×</strong> — strong institutional conviction behind the move</li>
              <li><strong className="t-secondary">RSI &lt;60</strong> — still room to run, not yet overbought</li>
              <li><strong className="t-secondary">Golden Cross</strong> — SMA50 above SMA200, long-term uptrend confirmed</li>
              <li><strong className="t-secondary">Near 52W High</strong> — breakout territory, momentum stocks</li>
              <li><strong className="t-secondary">Dividend + rise</strong> — income stocks recovering, yield locked in at lower prices</li>
            </ul>
            <p className="text-xs pt-2 border-t border-surface-border">
              <strong>Enable notifications</strong> (top right) to get a browser alert when any stock gains more than 5% — useful to catch big moves early.
            </p>
          </div>
        </details>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-3">
        {/* Row 1 */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium t-muted whitespace-nowrap">Min gain:</label>
            <div className="flex gap-1">
              {(['1', '2', '3', '5', '10'] as GainThreshold[]).map(v => (
                <button
                  key={v}
                  onClick={() => setThreshold(v)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    threshold === v
                      ? 'bg-bullish/15 text-bullish ring-1 ring-bullish/30'
                      : 'bg-surface-tertiary t-tertiary hover:t-secondary'
                  }`}
                >
                  {v}%+
                </button>
              ))}
            </div>
          </div>

          <div className="w-px h-5 bg-surface-border" />

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium t-muted">Cap:</label>
            <div className="flex gap-1">
              {(['all', 'Large', 'Mid', 'Small'] as CapFilter[]).map(c => (
                <button
                  key={c}
                  onClick={() => setCapFilter(c)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    capFilter === c
                      ? 'bg-accent/15 text-accent-light ring-1 ring-accent/30'
                      : 'bg-surface-tertiary t-tertiary hover:t-secondary'
                  }`}
                >
                  {c === 'all' ? 'All' : c}
                </button>
              ))}
            </div>
          </div>

          <div className="w-px h-5 bg-surface-border" />

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium t-muted">Market:</label>
            <select
              value={marketFilter}
              onChange={e => setMarketFilter(e.target.value as MarketFilter)}
              className="text-xs bg-surface-tertiary border border-surface-border rounded-md px-2 py-1 t-secondary"
            >
              {(['all', 'US', 'UK', 'IN', 'DE', 'FR', 'JP', 'HK'] as MarketFilter[]).map(m => (
                <option key={m} value={m}>{m === 'all' ? 'All Markets' : m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2 */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium t-muted whitespace-nowrap">Dividend:</label>
            <div className="flex gap-1">
              {([
                ['any', 'Any'],
                ['hasDividend', 'Has div'],
                ['1', '1%+'],
                ['2', '2%+'],
                ['3', '3%+'],
                ['4', '4%+'],
              ] as [DividendFilter, string][]).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setDividendFilter(val)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    dividendFilter === val
                      ? 'bg-teal-600/15 text-teal-600 dark:text-teal-400 ring-1 ring-teal-600/30'
                      : 'bg-surface-tertiary t-tertiary hover:t-secondary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="w-px h-5 bg-surface-border" />

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium t-muted">Sector:</label>
            <select
              value={sectorFilter}
              onChange={e => setSectorFilter(e.target.value)}
              className="text-xs bg-surface-tertiary border border-surface-border rounded-md px-2 py-1 t-secondary max-w-[160px]"
            >
              {sectors.map(s => (
                <option key={s} value={s}>{s === 'all' ? 'All Sectors' : s}</option>
              ))}
            </select>
          </div>

          <div className="w-px h-5 bg-surface-border" />

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium t-muted">Sort by:</label>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortKey)}
              className="text-xs bg-surface-tertiary border border-surface-border rounded-md px-2 py-1 t-secondary"
            >
              <option value="changePercent">Biggest gain today</option>
              <option value="institutionOwnership">Most institutionally owned</option>
              <option value="volumeRatio">Highest volume spike</option>
              <option value="score">Composite score</option>
              <option value="marketCap">Largest market cap</option>
              <option value="dividendYield">Highest dividend yield</option>
              <option value="rsi">Highest RSI (momentum)</option>
              <option value="beta">Highest beta</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      {sorted.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">&#128269;</div>
          <h3 className="text-lg font-semibold t-secondary mb-1">No stocks match your filters</h3>
          <p className="t-muted text-sm">Try reducing the minimum gain threshold or removing filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(stock => {
            const divYieldPct = stock.dividendYield != null ? stock.dividendYield * 100 : null;
            const instOwnedPct = stock.heldPercentInstitutions != null ? stock.heldPercentInstitutions * 100 : null;
            const isBigGainer = stock.changePercent >= 5;
            const dropFrom52High = stock.fiftyTwoWeekHigh > 0
              ? ((stock.fiftyTwoWeekHigh - stock.price) / stock.fiftyTwoWeekHigh) * 100
              : null;
            const near52High = dropFrom52High != null && dropFrom52High <= 5;
            const goldenCross = stock.sma50 != null && stock.sma200 != null && stock.sma50 > stock.sma200;

            return (
              <Link
                key={stock.ticker}
                to={`/stock/${stock.ticker}`}
                className={`card p-5 block transition-all ${gainBg(stock.changePercent)}`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-lg font-bold t-primary">{stock.ticker}</span>
                      <span className="t-tertiary text-sm truncate">{stock.name}</span>
                      <MarketTag market={stock.market} />
                      <CapTag cap={stock.capCategory} />
                      {isBigGainer && (
                        <span className="badge bg-bullish/15 text-bullish ring-1 ring-bullish/30 animate-pulse">
                          Big gainer
                        </span>
                      )}
                      {stock.volumeRatio >= 2 && (
                        <span className="badge bg-amber-600/12 text-amber-600 dark:text-amber-400 ring-1 ring-amber-600/20">
                          Vol spike {stock.volumeRatio.toFixed(1)}×
                        </span>
                      )}
                      {goldenCross && (
                        <span className="badge bg-bullish/10 text-bullish ring-1 ring-bullish/20">
                          Golden Cross
                        </span>
                      )}
                      {near52High && (
                        <span className="badge bg-emerald-600/12 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-600/20">
                          Near 52W High
                        </span>
                      )}
                      {divYieldPct != null && divYieldPct > 0 && (
                        <span className="badge bg-teal-600/12 text-teal-600 dark:text-teal-400 ring-1 ring-teal-600/20">
                          {divYieldPct.toFixed(2)}% div
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <PriceDisplay value={stock.price} market={stock.market} />
                      <ChangePercent value={stock.changePercent} />
                      {stock.sector && (
                        <span className="text-xs t-muted hidden sm:inline">{stock.sector}</span>
                      )}
                    </div>
                  </div>

                  {/* Today's gain — hero number */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-medium t-muted uppercase tracking-wider mb-0.5">Today</div>
                    <div className={`text-3xl font-bold font-mono ${gainColor(stock.changePercent)}`}>
                      +{stock.changePercent.toFixed(2)}%
                    </div>
                    {stock.marketCap > 0 && (
                      <div className="text-xs t-muted mt-0.5">{fmtCap(stock.marketCap)}</div>
                    )}
                  </div>
                </div>

                {/* Key metrics grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mb-3">
                  {stock.rsi != null && (
                    <MetricPill label="RSI">
                      <span className={`font-mono font-semibold ${stock.rsi > 70 ? 'text-amber-600 dark:text-amber-400' : stock.rsi < 50 ? 'text-bullish' : 't-secondary'}`}>
                        {stock.rsi.toFixed(1)}
                      </span>
                    </MetricPill>
                  )}
                  <MetricPill label="Vol ratio">
                    <span className={`font-mono font-semibold ${stock.volumeRatio >= 2 ? 'text-amber-600 dark:text-amber-400' : 't-secondary'}`}>
                      {stock.volumeRatio.toFixed(1)}×
                    </span>
                  </MetricPill>
                  {stock.beta != null && (
                    <MetricPill label="Beta">
                      <span className="font-mono font-semibold t-secondary">{stock.beta.toFixed(2)}</span>
                    </MetricPill>
                  )}
                  {divYieldPct != null && divYieldPct > 0 && (
                    <MetricPill label="Div yield">
                      <span className="font-mono font-semibold text-teal-600 dark:text-teal-400">{divYieldPct.toFixed(2)}%</span>
                    </MetricPill>
                  )}
                  {instOwnedPct != null && (
                    <MetricPill label="Inst. owned">
                      <span className="font-mono font-semibold t-secondary">{instOwnedPct.toFixed(0)}%</span>
                    </MetricPill>
                  )}
                  {dropFrom52High != null && (
                    <MetricPill label="From 52W high">
                      <span className={`font-mono font-semibold ${dropFrom52High <= 5 ? 'text-bullish' : dropFrom52High <= 15 ? 'text-emerald-500 dark:text-emerald-400' : 't-secondary'}`}>
                        -{dropFrom52High.toFixed(1)}%
                      </span>
                    </MetricPill>
                  )}
                </div>

                {/* 52W range bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-[10px] t-muted mb-1">
                    <span>{currencySymbol(stock.market)}{stock.fiftyTwoWeekLow.toFixed(2)}</span>
                    <span className="t-faint">52-Week Range</span>
                    <span>{currencySymbol(stock.market)}{stock.fiftyTwoWeekHigh.toFixed(2)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-tertiary border border-surface-border relative overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-bearish/30 to-bullish/50"
                      style={{ width: `${Math.max(1, Math.min(100, stock.fiftyTwoWeekRangePercent))}%` }}
                    />
                    <div
                      className="absolute inset-y-0 w-0.5 bg-bullish"
                      style={{ left: `${Math.max(0, Math.min(99, stock.fiftyTwoWeekRangePercent))}%` }}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center gap-4 flex-wrap pt-3 border-t border-surface-border">
                  <div className="flex items-center gap-2">
                    <span className="text-xs t-muted">Score:</span>
                    <ScoreBadge score={stock.score.composite} size="sm" />
                  </div>
                  {stock.pe != null && stock.pe > 0 && (
                    <span className="text-xs t-muted">P/E <span className="t-secondary font-mono">{stock.pe.toFixed(1)}</span></span>
                  )}
                  {stock.priceReturn3m > 0.10 && (
                    <span className="text-xs text-bullish">+{(stock.priceReturn3m * 100).toFixed(0)}% 3M</span>
                  )}
                  {stock.sma50 != null && stock.price > stock.sma50 && (
                    <span className="text-xs text-bullish">Above 50 SMA</span>
                  )}
                  {stock.piotroskiScore != null && stock.piotroskiScore >= 6 && (
                    <span className="text-xs t-muted">Piotroski {stock.piotroskiScore}/9</span>
                  )}
                  {stock.dividendMetrics?.growthStreak != null && stock.dividendMetrics.growthStreak >= 5 && (
                    <span className="text-xs text-teal-600 dark:text-teal-400">
                      {stock.dividendMetrics.growthStreak}yr div growth
                    </span>
                  )}
                  {stock.altmanZone === 'safe' && (
                    <span className="text-xs text-bullish">Altman: safe</span>
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

function MetricPill({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-tertiary rounded-lg px-2.5 py-1.5 flex flex-col gap-0.5">
      <span className="text-[10px] t-muted uppercase tracking-wide">{label}</span>
      <span className="text-xs">{children}</span>
    </div>
  );
}