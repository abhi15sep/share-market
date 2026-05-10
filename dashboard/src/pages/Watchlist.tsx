import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { StockRecord } from '../types';
import { ScoreBadge, ChangePercent, MarketTag } from '../components/common/Tags';
import { currencySymbol } from '../lib/format';
import InfoTooltip from '../components/common/InfoTooltip';
import { TIPS } from '../lib/tooltips';

/* ─── WATCHLIST HOOK ─── */
const STORAGE_KEY = 'sm-watchlist';

function readWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeWatchlist(tickers: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickers));
}

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<string[]>(readWatchlist);

  useEffect(() => { writeWatchlist(watchlist); }, [watchlist]);

  const addTicker    = useCallback((ticker: string) => setWatchlist(prev => prev.includes(ticker) ? prev : [...prev, ticker]), []);
  const removeTicker = useCallback((ticker: string) => setWatchlist(prev => prev.filter(t => t !== ticker)), []);
  const isWatched    = useCallback((ticker: string) => watchlist.includes(ticker), [watchlist]);
  const clearAll     = useCallback(() => setWatchlist([]), []);

  return { watchlist, addTicker, removeTicker, isWatched, clearAll };
}

/* ─── SORT TYPES ─── */
type SortKey = 'ticker' | 'changePercent' | 'score' | 'rsPercentile' | 'return3m' | 'bearishScore' | 'price';

/* ─── PAGE ─── */
export default function Watchlist({ stocks }: { stocks: StockRecord[] }) {
  const { watchlist, addTicker, removeTicker, clearAll } = useWatchlist();
  const [searchQuery, setSearchQuery]   = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [sortKey, setSortKey]           = useState<SortKey>('score');
  const [sortDir, setSortDir]           = useState<'asc' | 'desc'>('desc');
  const [confirmClear, setConfirmClear] = useState(false);

  const watchedStocks = useMemo(
    () => watchlist.map(t => stocks.find(s => s.ticker === t)).filter(Boolean) as StockRecord[],
    [watchlist, stocks],
  );

  const sorted = useMemo(() => {
    const mul = sortDir === 'desc' ? -1 : 1;
    return [...watchedStocks].sort((a, b) => {
      switch (sortKey) {
        case 'ticker':       return mul * a.ticker.localeCompare(b.ticker);
        case 'changePercent':return mul * (a.changePercent - b.changePercent);
        case 'score':        return mul * (a.score.composite - b.score.composite);
        case 'rsPercentile': return mul * (a.rsPercentile - b.rsPercentile);
        case 'return3m':     return mul * (a.priceReturn3m - b.priceReturn3m);
        case 'bearishScore': return mul * ((a.bearishScore ?? 0) - (b.bearishScore ?? 0));
        case 'price':        return mul * (a.price - b.price);
        default: return 0;
      }
    });
  }, [watchedStocks, sortKey, sortDir]);

  const stats = useMemo(() => {
    if (watchedStocks.length === 0) return null;
    const gainers = watchedStocks.filter(s => s.changePercent > 0).length;
    const avgScore = watchedStocks.reduce((a, s) => a + s.score.composite, 0) / watchedStocks.length;
    const best  = watchedStocks.reduce((a, s) => s.changePercent > a.changePercent ? s : a);
    const worst = watchedStocks.reduce((a, s) => s.changePercent < a.changePercent ? s : a);
    const danger = watchedStocks.filter(s => (s.bearishScore ?? 0) >= 4).length;
    return { gainers, losers: watchedStocks.length - gainers, avgScore, best, worst, danger };
  }, [watchedStocks]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return stocks
      .filter(s => !watchlist.includes(s.ticker) && (s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [searchQuery, stocks, watchlist]);

  const handleAdd = (ticker: string) => {
    addTicker(ticker);
    setSearchQuery('');
    setShowDropdown(false);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const arrow = (key: SortKey) => sortKey === key ? (sortDir === 'desc' ? ' ▼' : ' ▲') : '';

  const thBtn = (key: SortKey, label: string, tip?: string, align: 'left' | 'right' | 'center' = 'right') => (
    <th className={`px-4 py-3 text-${align} table-header`}>
      <button onClick={() => toggleSort(key)} className="hover:text-accent-light transition-colors whitespace-nowrap">
        {tip ? <InfoTooltip text={tip}>{label}{arrow(key)}</InfoTooltip> : <>{label}{arrow(key)}</>}
      </button>
    </th>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold t-primary">Watchlist</h1>
        <p className="text-sm t-muted mt-1">Track your favourite stocks in one place</p>
      </div>

      {/* Search + actions */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search ticker or name to add..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              className="input-field w-64"
            />
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-72 bg-surface-secondary border border-surface-border rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                {searchResults.map(s => (
                  <button
                    key={s.ticker}
                    onMouseDown={() => handleAdd(s.ticker)}
                    className="w-full text-left px-3 py-2 hover:bg-surface-hover transition-colors flex items-center gap-2"
                  >
                    <span className="font-semibold text-accent-light text-sm">{s.ticker}</span>
                    <span className="t-muted text-xs truncate flex-1">{s.name}</span>
                    <span className="text-xs font-mono t-faint">{currencySymbol(s.market)}{s.price.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="badge bg-surface-tertiary t-secondary ring-1 ring-surface-border">{watchedStocks.length} watched</span>

          {watchedStocks.length > 0 && (
            confirmClear ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-bearish">Remove all?</span>
                <button onClick={() => { clearAll(); setConfirmClear(false); }} className="text-xs text-bearish hover:font-semibold transition-all">Yes</button>
                <button onClick={() => setConfirmClear(false)} className="text-xs t-muted hover:t-secondary transition-colors">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirmClear(true)} className="text-xs t-faint hover:t-secondary transition-colors ml-1">Clear all</button>
            )
          )}
        </div>
      </div>

      {/* Stats summary */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="stat-card">
            <p className="text-xs t-tertiary uppercase tracking-wider font-medium">Avg Score</p>
            <p className="text-xl font-bold font-mono t-primary mt-1">{stats.avgScore.toFixed(0)}</p>
            <p className="text-xs t-muted mt-1">{stats.gainers} up · {stats.losers} down today</p>
          </div>
          <div className="stat-card">
            <p className="text-xs t-tertiary uppercase tracking-wider font-medium">Best Today</p>
            <p className="text-xl font-bold text-bullish font-mono mt-1">
              {stats.best.changePercent >= 0 ? '+' : ''}{stats.best.changePercent.toFixed(1)}%
            </p>
            <p className="text-xs t-muted mt-1">{stats.best.ticker}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs t-tertiary uppercase tracking-wider font-medium">Worst Today</p>
            <p className="text-xl font-bold text-bearish font-mono mt-1">
              {stats.worst.changePercent.toFixed(1)}%
            </p>
            <p className="text-xs t-muted mt-1">{stats.worst.ticker}</p>
          </div>
          <div className={`stat-card ${stats.danger > 0 ? 'border-t-2 border-t-bearish' : ''}`}>
            <p className="text-xs t-tertiary uppercase tracking-wider font-medium">Bearish Alerts</p>
            <p className={`text-xl font-bold font-mono mt-1 ${stats.danger > 0 ? 'text-bearish' : 'text-bullish'}`}>{stats.danger}</p>
            <p className="text-xs t-muted mt-1">{stats.danger > 0 ? 'stocks with score ≥ 4' : 'all clear'}</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {watchedStocks.length === 0 && (
        <div className="card p-12 text-center">
          <p className="t-muted text-sm">No stocks in your watchlist. Use the search above to add stocks.</p>
        </div>
      )}

      {/* Table */}
      {sorted.length > 0 && (
        <div className="card-flat overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border bg-surface-tertiary/30">
                  {thBtn('ticker', 'Ticker', TIPS['Ticker'], 'left')}
                  <th className="px-4 py-3 text-left table-header">Name</th>
                  <th className="px-4 py-3 text-left table-header"><InfoTooltip text={TIPS['Market']}>Market</InfoTooltip></th>
                  {thBtn('price', 'Price', TIPS['Price'])}
                  {thBtn('changePercent', 'Change', TIPS['Change'])}
                  {thBtn('score', 'Score', TIPS['Score'], 'center')}
                  {thBtn('rsPercentile', 'RS %ile', TIPS['RS %ile'])}
                  {thBtn('return3m', '3M Ret')}
                  {thBtn('bearishScore', 'Bear⚠', TIPS['Bearish Score'])}
                  <th className="px-4 py-3 text-left table-header"><InfoTooltip text={TIPS['Style']}>Style</InfoTooltip></th>
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {sorted.map(stock => {
                  const cur = currencySymbol(stock.market);
                  const bScore = stock.bearishScore ?? 0;
                  const ret3m = stock.priceReturn3m * 100;

                  return (
                    <tr
                      key={stock.ticker}
                      className={`border-b border-surface-border/50 hover:bg-surface-hover/50 transition-colors ${bScore >= 4 ? 'bg-bearish/3' : ''}`}
                    >
                      <td className="px-4 py-2.5">
                        <Link to={`/stock/${stock.ticker}`} className="font-semibold text-accent-light hover:t-primary transition-colors">
                          {stock.ticker}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="t-secondary truncate max-w-[140px] block text-xs">{stock.name}</span>
                      </td>
                      <td className="px-4 py-2.5"><MarketTag market={stock.market} /></td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-xs t-primary">
                        {cur}{stock.price.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-right"><ChangePercent value={stock.changePercent} /></td>
                      <td className="px-4 py-2.5 text-center"><ScoreBadge score={stock.score.composite} /></td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-xs t-primary">{stock.rsPercentile}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`font-mono tabular-nums text-xs ${ret3m >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                          {ret3m >= 0 ? '+' : ''}{ret3m.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`font-mono tabular-nums text-xs font-semibold ${
                          bScore >= 5 ? 'text-bearish' : bScore >= 3 ? 'text-amber-400' : 't-muted'
                        }`}>
                          {bScore > 0 ? bScore : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="t-secondary text-xs">{stock.styleClassification}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={() => removeTicker(stock.ticker)}
                          className="t-faint hover:text-bearish transition-colors font-bold px-1 text-sm"
                          title="Remove from watchlist"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
