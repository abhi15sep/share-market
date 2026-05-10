import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { StockRecord } from '../types';
import { currencySymbol } from '../lib/format';

type ColorMode = 'change' | 'score' | 'rs';
type MarketFilter = 'All' | 'US' | 'UK' | 'JP' | 'HK' | 'IN' | 'DE' | 'FR';
type CapFilter = 'all' | 'large' | 'mid';

const CAP_THRESHOLDS: Record<CapFilter, number> = { all: 0, large: 10e9, mid: 2e9 };
const MARKETS: MarketFilter[] = ['All', 'US', 'UK', 'JP', 'HK', 'IN', 'DE', 'FR'];

function getChangeColor(value: number): string {
  const clamped = Math.max(-8, Math.min(8, value));
  const ratio = clamped / 8;
  if (ratio >= 0) {
    const s = 55 + ratio * 20;
    const l = 45 - ratio * 15;
    return `hsl(120, ${s}%, ${l}%)`;
  }
  const s = 55 + Math.abs(ratio) * 20;
  const l = 45 - Math.abs(ratio) * 15;
  return `hsl(0, ${s}%, ${l}%)`;
}

function getScoreColor(score: number): string {
  const clamped = Math.max(0, Math.min(100, score));
  const hue = (clamped / 100) * 120;
  return `hsl(${hue}, 70%, ${hue > 60 ? 40 : 50}%)`;
}

function getRsColor(rs: number): string {
  const clamped = Math.max(0, Math.min(100, rs));
  const hue = (clamped / 100) * 120;
  return `hsl(${hue}, 65%, 42%)`;
}

function getDisplayValue(stock: StockRecord, mode: ColorMode): string {
  switch (mode) {
    case 'change': return `${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(1)}%`;
    case 'score':  return `${stock.score.composite}`;
    case 'rs':     return `${stock.rsPercentile}`;
  }
}

function getColor(stock: StockRecord, mode: ColorMode): string {
  switch (mode) {
    case 'change': return getChangeColor(stock.changePercent);
    case 'score':  return getScoreColor(stock.score.composite);
    case 'rs':     return getRsColor(stock.rsPercentile);
  }
}

export default function HeatMap({ stocks }: { stocks: StockRecord[] }) {
  const [colorMode, setColorMode]     = useState<ColorMode>('change');
  const [marketFilter, setMarketFilter] = useState<MarketFilter>('All');
  const [capFilter, setCapFilter]     = useState<CapFilter>('all');
  const [collapsed, setCollapsed]     = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return stocks.filter(s => {
      if (!s.sector || s.sector === 'Unknown') return false;
      if (marketFilter !== 'All' && s.market !== marketFilter) return false;
      if (s.marketCap < CAP_THRESHOLDS[capFilter]) return false;
      return true;
    });
  }, [stocks, marketFilter, capFilter]);

  const sectorGroups = useMemo(() => {
    const groups: Record<string, StockRecord[]> = {};
    for (const stock of filtered) {
      if (!groups[stock.sector]) groups[stock.sector] = [];
      groups[stock.sector].push(stock);
    }

    const sorted = Object.entries(groups)
      .sort((a, b) => b[1].reduce((s, st) => s + st.marketCap, 0) - a[1].reduce((s, st) => s + st.marketCap, 0));

    for (const [, ss] of sorted) {
      ss.sort((a, b) => b.marketCap - a.marketCap);
    }
    return sorted;
  }, [filtered]);

  // Market-wide stats
  const stats = useMemo(() => {
    if (filtered.length === 0) return null;
    const gainers = filtered.filter(s => s.changePercent > 0).length;
    const losers  = filtered.filter(s => s.changePercent < 0).length;
    const avgChange = filtered.reduce((a, s) => a + s.changePercent, 0) / filtered.length;
    return { gainers, losers, flat: filtered.length - gainers - losers, avgChange, total: filtered.length };
  }, [filtered]);

  const toggleCollapse = (sector: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(sector) ? next.delete(sector) : next.add(sector);
      return next;
    });
  };

  const modeMeta: Record<ColorMode, { label: string; description: string }> = {
    change: { label: 'Daily Change %',  description: 'Green for gains, red for losses' },
    score:  { label: 'Composite Score', description: 'Red (0) → green (100)'           },
    rs:     { label: 'RS Percentile',   description: 'Relative strength ranking'        },
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold t-primary">Market Heat Map</h1>
        <p className="text-sm t-muted mt-1">Visual overview of the entire market, grouped by sector</p>
      </div>

      {/* Controls */}
      <div className="card p-4 space-y-3">
        {/* Color mode */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs t-muted w-14">Color by:</span>
          {(Object.keys(modeMeta) as ColorMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setColorMode(mode)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                colorMode === mode ? 'bg-accent/15 text-accent-light ring-1 ring-accent/30' : 't-tertiary hover:t-primary hover:bg-surface-hover'
              }`}
            >
              {modeMeta[mode].label}
            </button>
          ))}
          <span className="ml-auto text-xs t-faint">{modeMeta[colorMode].description}</span>
        </div>

        {/* Market filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs t-muted w-14">Market:</span>
          {MARKETS.map(m => (
            <button
              key={m}
              onClick={() => setMarketFilter(m)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                marketFilter === m ? 'bg-accent/20 text-accent-light ring-1 ring-accent/30' : 'bg-surface-hover t-muted hover:t-secondary'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Cap filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs t-muted w-14">Cap size:</span>
          {([['all', 'All'], ['large', 'Large (>$10B)'], ['mid', 'Mid+ (>$2B)']] as [CapFilter, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setCapFilter(key)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                capFilter === key ? 'bg-accent/20 text-accent-light ring-1 ring-accent/30' : 'bg-surface-hover t-muted hover:t-secondary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Market stats bar */}
      {stats && (
        <div className="card p-3 flex flex-wrap items-center gap-4 text-xs">
          <span className="t-muted">{stats.total} stocks</span>
          <span className="text-bullish font-semibold">{stats.gainers} gainers</span>
          <span className="text-bearish font-semibold">{stats.losers} losers</span>
          {stats.flat > 0 && <span className="t-muted">{stats.flat} flat</span>}
          <span className={`font-mono font-semibold ml-auto ${stats.avgChange >= 0 ? 'text-bullish' : 'text-bearish'}`}>
            Avg {stats.avgChange >= 0 ? '+' : ''}{stats.avgChange.toFixed(2)}%
          </span>
          {/* Gainers ratio bar */}
          <div className="w-32 h-2 rounded-full bg-bearish/40 overflow-hidden">
            <div className="h-full rounded-full bg-bullish transition-all" style={{ width: `${(stats.gainers / stats.total) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Heat map grid */}
      <div className="space-y-3">
        {sectorGroups.map(([sector, sectorStocks]) => {
          const avgChange = sectorStocks.reduce((a, s) => a + s.changePercent, 0) / sectorStocks.length;
          const isCollapsed = collapsed.has(sector);

          return (
            <div key={sector} className="card-flat p-4">
              <button
                className="flex items-center gap-2 mb-3 w-full text-left group"
                onClick={() => toggleCollapse(sector)}
              >
                <span className="text-xs t-faint group-hover:t-muted transition-colors">{isCollapsed ? '▶' : '▼'}</span>
                <h2 className="text-sm font-semibold t-primary">{sector}</h2>
                <span className="text-xs t-faint">({sectorStocks.length})</span>
                {/* Sector avg change chip */}
                <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ml-1 ${
                  avgChange >= 0 ? 'text-bullish bg-bullish/10' : 'text-bearish bg-bearish/10'
                }`}>
                  {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(2)}% avg
                </span>
                <span className="ml-auto text-[10px] t-faint">{sectorStocks.filter(s => s.changePercent > 0).length}↑ {sectorStocks.filter(s => s.changePercent < 0).length}↓</span>
              </button>

              {!isCollapsed && (
                <div className="flex flex-wrap gap-1.5">
                  {sectorStocks.map(stock => {
                    const size = Math.max(60, Math.min(140, (Math.log10(Math.max(stock.marketCap, 1e6)) - 6) * 30 + 60));
                    const bgColor  = getColor(stock, colorMode);
                    const sym = currencySymbol(stock.market);

                    return (
                      <Link
                        key={stock.ticker}
                        to={`/stock/${stock.ticker}`}
                        className="rounded-md flex flex-col items-center justify-center hover:brightness-125 hover:scale-105 transition-all cursor-pointer overflow-hidden"
                        style={{
                          width: `${size}px`,
                          height: `${size * 0.7}px`,
                          backgroundColor: bgColor,
                          color: 'rgba(255,255,255,0.95)',
                          minWidth: '56px',
                          minHeight: '40px',
                        }}
                        title={`${stock.ticker} — ${stock.name}\nPrice: ${sym}${stock.price.toFixed(2)}\nChange: ${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%\nScore: ${stock.score.composite}\nRS: ${stock.rsPercentile}`}
                      >
                        <span className="text-xs font-bold leading-tight truncate px-1">{stock.ticker}</span>
                        <span className="text-[10px] font-mono leading-tight opacity-90">{getDisplayValue(stock, colorMode)}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="card p-3 flex flex-wrap items-center gap-4">
        <span className="text-xs t-muted">Legend:</span>
        <div className="flex items-center gap-1">
          {colorMode === 'change' && [-6, -3, -1, 0, 1, 3, 6].map(v => (
            <div key={v} className="w-5 h-3 rounded-sm" style={{ backgroundColor: getChangeColor(v) }} />
          ))}
          {colorMode === 'score' && [10, 30, 50, 70, 90].map(v => (
            <div key={v} className="w-5 h-3 rounded-sm" style={{ backgroundColor: getScoreColor(v) }} />
          ))}
          {colorMode === 'rs' && [10, 30, 50, 70, 90].map(v => (
            <div key={v} className="w-5 h-3 rounded-sm" style={{ backgroundColor: getRsColor(v) }} />
          ))}
          <span className="text-xs t-faint ml-1">
            {colorMode === 'change' ? '-6% → +6%' : colorMode === 'score' ? '0 → 100' : '0th → 100th %ile'}
          </span>
        </div>
        <span className="ml-auto text-xs t-faint">Tile size = market cap · Click sector to collapse</span>
      </div>
    </div>
  );
}
