import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { StockRecord } from '../types';
import ScoreGauge from '../components/charts/ScoreGauge';
import MiniSparkline from '../components/charts/MiniSparkline';
import { useOhlcvData } from '../hooks/useOhlcvData';
import InfoTooltip from '../components/common/InfoTooltip';
import { TIPS } from '../lib/tooltips';
import { currencySymbol } from '../lib/format';
import { MarketTag } from '../components/common/Tags';

/* ─── METRIC DEFINITIONS ─── */
interface MetricDef {
  label: string;
  getValue: (s: StockRecord) => number | string | null | undefined;
  format?: (v: number) => string;
  bestDirection: 'higher' | 'lower' | 'none';
  tip?: string;
}

const pct  = (v: number) => `${(v * 100).toFixed(1)}%`;
const pct2 = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
const f1   = (v: number) => v.toFixed(1);
const f2   = (v: number) => v.toFixed(2);
const f0   = (v: number) => v.toFixed(0);

const METRIC_GROUPS: { title: string; metrics: MetricDef[] }[] = [
  {
    title: 'Price & Momentum',
    metrics: [
      { label: 'Price',            getValue: s => s.price,           format: f2,   bestDirection: 'none' },
      { label: 'Change %',         getValue: s => s.changePercent,   format: pct2, bestDirection: 'higher' },
      { label: 'Composite Score',  getValue: s => s.score.composite, format: f0,   bestDirection: 'higher' },
      { label: 'RS Percentile',    getValue: s => s.rsPercentile,    format: f0,   bestDirection: 'higher' },
    ],
  },
  {
    title: 'Returns',
    metrics: [
      { label: '3M Return',  getValue: s => s.priceReturn3m * 100, format: pct2, bestDirection: 'higher' },
      { label: '6M Return',  getValue: s => s.priceReturn6m * 100, format: pct2, bestDirection: 'higher' },
      { label: '1Y Return',  getValue: s => s.priceReturn1y * 100, format: pct2, bestDirection: 'higher' },
      { label: '2Y Return',  getValue: s => s.priceReturn2y * 100, format: pct2, bestDirection: 'higher' },
    ],
  },
  {
    title: 'Valuation',
    metrics: [
      { label: 'P/E',         getValue: s => s.pe,            format: f1,  bestDirection: 'lower' },
      { label: 'Forward P/E', getValue: s => s.forwardPe,     format: f1,  bestDirection: 'lower' },
      { label: 'PEG Ratio',   getValue: s => s.pegRatio,      format: f2,  bestDirection: 'lower' },
      { label: 'P/B',         getValue: s => s.priceToBook,   format: f2,  bestDirection: 'lower' },
    ],
  },
  {
    title: 'Profitability',
    metrics: [
      { label: 'ROE',              getValue: s => s.returnOnEquity,  format: pct, bestDirection: 'higher' },
      { label: 'ROA',              getValue: s => s.returnOnAssets,  format: pct, bestDirection: 'higher' },
      { label: 'Gross Margin',     getValue: s => s.grossMargins,    format: pct, bestDirection: 'higher' },
      { label: 'Operating Margin', getValue: s => s.operatingMargins,format: pct, bestDirection: 'higher' },
      { label: 'Profit Margin',    getValue: s => s.profitMargins,   format: pct, bestDirection: 'higher' },
    ],
  },
  {
    title: 'Financial Health',
    metrics: [
      { label: 'Debt/Equity',   getValue: s => s.debtToEquity, format: f2, bestDirection: 'lower'  },
      { label: 'Current Ratio', getValue: s => s.currentRatio, format: f2, bestDirection: 'higher' },
    ],
  },
  {
    title: 'Technical Indicators',
    metrics: [
      { label: 'RSI',             getValue: s => s.rsi,     format: f1,   bestDirection: 'none' },
      { label: 'SMA 50 vs Price', getValue: s => s.sma50  != null ? ((s.price - s.sma50)  / s.sma50)  * 100 : null, format: pct2, bestDirection: 'higher' },
      { label: 'SMA 200 vs Price',getValue: s => s.sma200 != null ? ((s.price - s.sma200) / s.sma200) * 100 : null, format: pct2, bestDirection: 'higher' },
    ],
  },
  {
    title: 'Risk & Income',
    metrics: [
      { label: 'Beta',           getValue: s => s.beta,          format: f2,  bestDirection: 'lower'  },
      { label: 'Volatility',     getValue: s => s.volatility,    format: pct, bestDirection: 'lower'  },
      { label: 'Dividend Yield', getValue: s => s.dividendYield, format: pct, bestDirection: 'higher' },
    ],
  },
  {
    title: 'Signals & Scores',
    metrics: [
      { label: 'Bullish Score',     getValue: s => s.bullishScore,   format: f0, bestDirection: 'higher' },
      { label: 'Bearish Score',     getValue: s => s.bearishScore,   format: f0, bestDirection: 'lower'  },
      { label: 'Piotroski Score',   getValue: s => s.piotroskiScore, format: v => `${v}/9`, bestDirection: 'higher' },
      { label: 'Buffett Score',     getValue: s => s.buffettScore,   format: v => `${v}/7`, bestDirection: 'higher' },
      { label: 'Minervini Checks',  getValue: s => s.minerviniChecks.passed, format: v => `${v}/8`, bestDirection: 'higher' },
    ],
  },
  {
    title: 'Classification',
    metrics: [
      { label: 'Data Completeness', getValue: s => s.dataCompleteness, format: v => `${v.toFixed(0)}%`, bestDirection: 'higher' },
      { label: 'Style',             getValue: s => s.styleClassification, bestDirection: 'none' },
    ],
  },
];

/* ─── PRESET COMPARISON GROUPS ─── */
const PRESETS = [
  { label: 'Tech Giants',    tickers: ['AAPL', 'MSFT', 'GOOGL', 'META'] },
  { label: 'Semiconductors', tickers: ['NVDA', 'AMD', 'INTC', 'AMAT']  },
  { label: 'Energy Majors',  tickers: ['XOM', 'CVX', 'COP', 'EOG']     },
  { label: 'Space & Defense',tickers: ['RKLB', 'LMT', 'RTX', 'BA']     },
  { label: 'Pharma',         tickers: ['MRNA', 'PFE', 'JNJ', 'ABBV']   },
  { label: 'Banks',          tickers: ['JPM', 'BAC', 'GS', 'MS']       },
];

/* ─── HELPERS ─── */
function findBestIndex(values: (number | null)[], direction: 'higher' | 'lower'): number | null {
  let bestIdx: number | null = null;
  let bestVal: number | null = null;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null) continue;
    if (bestVal == null || (direction === 'higher' && v > bestVal) || (direction === 'lower' && v < bestVal)) {
      bestVal = v; bestIdx = i;
    }
  }
  return bestIdx;
}

/** Returns 0–1 fill fraction for bar visualization */
function barFill(value: number | null, allValues: (number | null)[], direction: 'higher' | 'lower'): number {
  if (value == null) return 0;
  const nums = allValues.filter((v): v is number => v != null);
  if (nums.length < 2) return 0;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (max === min) return 0.5;
  const norm = (value - min) / (max - min);
  return direction === 'higher' ? norm : 1 - norm;
}

/* ─── COMPONENT ─── */
export default function StockComparison({ stocks }: { stocks: StockRecord[] }) {
  const [selectedTickers, setSelectedTickers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery]         = useState('');
  const [showDropdown, setShowDropdown]       = useState(false);

  const { data: ohlcvData } = useOhlcvData(selectedTickers);

  const selectedStocks = useMemo(
    () => selectedTickers.map(t => stocks.find(s => s.ticker === t)).filter(Boolean) as StockRecord[],
    [selectedTickers, stocks],
  );

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return stocks
      .filter(s => !selectedTickers.includes(s.ticker) && (s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [searchQuery, stocks, selectedTickers]);

  // Valid presets — only show if at least 2 tickers exist in our universe
  const validPresets = useMemo(() => {
    const tickerSet = new Set(stocks.map(s => s.ticker));
    return PRESETS.map(p => ({
      ...p,
      available: p.tickers.filter(t => tickerSet.has(t)),
    })).filter(p => p.available.length >= 2);
  }, [stocks]);

  const addStock = (ticker: string) => {
    if (selectedTickers.length >= 4 || selectedTickers.includes(ticker)) return;
    setSelectedTickers(prev => [...prev, ticker]);
    setSearchQuery('');
    setShowDropdown(false);
  };

  const removeStock = (ticker: string) => setSelectedTickers(prev => prev.filter(t => t !== ticker));

  const loadPreset = (tickers: string[]) => setSelectedTickers(tickers.slice(0, 4));

  const n = selectedStocks.length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold t-primary">Stock Comparison</h1>
        <p className="text-sm t-muted mt-1">Compare up to 4 stocks side by side</p>
      </div>

      {/* Search & chips */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search ticker or name..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              className="input-field w-60"
              disabled={selectedTickers.length >= 4}
            />
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-72 bg-surface-secondary border border-surface-border rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                {searchResults.map(s => (
                  <button
                    key={s.ticker}
                    onMouseDown={() => addStock(s.ticker)}
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

          {selectedTickers.map(ticker => (
            <span key={ticker} className="badge bg-accent/15 text-accent-light ring-1 ring-accent/20 flex items-center gap-1.5 px-2.5 py-1">
              {ticker}
              <button onClick={() => removeStock(ticker)} className="hover:text-bearish transition-colors font-bold ml-0.5">×</button>
            </span>
          ))}

          {selectedTickers.length > 0 && (
            <>
              <span className="badge bg-surface-tertiary t-secondary ring-1 ring-surface-border">{selectedTickers.length}/4</span>
              <button onClick={() => setSelectedTickers([])} className="text-xs t-faint hover:t-secondary transition-colors ml-1">
                Clear all
              </button>
            </>
          )}
        </div>
      </div>

      {/* Empty state with presets */}
      {selectedStocks.length === 0 && (
        <div className="space-y-4">
          <div className="card p-5">
            <p className="text-xs font-semibold t-tertiary uppercase tracking-wider mb-3">Quick Comparisons</p>
            <div className="flex flex-wrap gap-2">
              {validPresets.map(p => (
                <button
                  key={p.label}
                  onClick={() => loadPreset(p.available)}
                  className="group px-3 py-2 rounded-lg border border-surface-border hover:border-accent/30 bg-surface-hover/50 hover:bg-accent/5 transition-all text-left"
                >
                  <span className="text-sm font-medium t-primary group-hover:text-accent-light transition-colors block">{p.label}</span>
                  <span className="text-[10px] t-faint">{p.available.join(' · ')}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="card p-10 text-center">
            <p className="t-muted text-sm">Search and select 2–4 stocks above, or pick a preset to begin comparing.</p>
          </div>
        </div>
      )}

      {/* Comparison content */}
      {n >= 1 && (
        <div className="card-flat overflow-hidden">
          {/* Stock headers */}
          <div className="grid gap-0" style={{ gridTemplateColumns: `180px repeat(${n}, 1fr)` }}>
            <div className="p-4 border-b border-r border-surface-border" />
            {selectedStocks.map(stock => (
              <div key={stock.ticker} className="p-4 border-b border-r border-surface-border last:border-r-0 text-center">
                <Link to={`/stock/${stock.ticker}`} className="font-semibold text-accent-light hover:t-primary transition-colors text-lg">
                  {stock.ticker}
                </Link>
                <p className="t-muted text-xs mt-0.5 truncate">{stock.name}</p>
                <div className="flex justify-center mt-1 mb-1">
                  <MarketTag market={stock.market} />
                </div>
                <div className="flex justify-center mt-1">
                  <ScoreGauge score={stock.score.composite} size={90} />
                </div>
                {ohlcvData.has(stock.ticker) && (
                  <div className="flex justify-center mt-2">
                    <MiniSparkline data={ohlcvData.get(stock.ticker)!} color="auto" />
                  </div>
                )}
                <p className="text-xs font-mono t-secondary mt-1">
                  {currencySymbol(stock.market)}{stock.price.toFixed(2)}
                </p>
              </div>
            ))}
          </div>

          {/* Metric rows */}
          {METRIC_GROUPS.map(group => (
            <div key={group.title}>
              {/* Group header */}
              <div className="grid gap-0" style={{ gridTemplateColumns: `180px repeat(${n}, 1fr)` }}>
                <div className="px-4 py-2 bg-surface-tertiary/50 border-b border-r border-surface-border text-xs font-semibold t-tertiary uppercase tracking-wider col-span-full">
                  {group.title}
                </div>
              </div>

              {group.metrics.map(metric => {
                const rawValues = selectedStocks.map(s => {
                  const v = metric.getValue(s);
                  return typeof v === 'number' ? v : null;
                });
                const bestIdx = metric.bestDirection !== 'none' ? findBestIndex(rawValues, metric.bestDirection) : null;

                return (
                  <div key={metric.label} className="grid gap-0" style={{ gridTemplateColumns: `180px repeat(${n}, 1fr)` }}>
                    <div className="px-4 py-2.5 border-b border-r border-surface-border text-sm t-tertiary flex items-center">
                      <InfoTooltip text={TIPS[metric.label] ?? metric.tip ?? ''}>{metric.label}</InfoTooltip>
                    </div>

                    {selectedStocks.map((stock, idx) => {
                      const raw = metric.getValue(stock);
                      const isNumeric = typeof raw === 'number';
                      const isBest = bestIdx === idx && isNumeric && n >= 2;
                      const fill = isNumeric && metric.bestDirection !== 'none' && n >= 2
                        ? barFill(raw as number, rawValues, metric.bestDirection)
                        : 0;

                      let display: string;
                      if (raw == null) display = '—';
                      else if (typeof raw === 'string') display = raw;
                      else if (metric.format) display = metric.format(raw as number);
                      else display = String(raw);

                      // Color return values intrinsically (not just "best")
                      let colorClass = 't-primary';
                      if (raw == null) colorClass = 't-faint';
                      else if (isBest) colorClass = 'text-bullish font-bold';
                      else if (metric.label.includes('Return') && isNumeric) {
                        colorClass = (raw as number) >= 0 ? 'text-bullish' : 'text-bearish';
                      }

                      return (
                        <div
                          key={stock.ticker}
                          className="relative px-4 py-2.5 border-b border-r border-surface-border last:border-r-0 text-center font-mono tabular-nums text-sm overflow-hidden"
                        >
                          {/* Background fill bar */}
                          {fill > 0 && (
                            <div
                              className="absolute inset-y-0 left-0 bg-accent/6 pointer-events-none transition-all"
                              style={{ width: `${fill * 100}%` }}
                            />
                          )}
                          <span className={`relative ${colorClass}`}>{display}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
